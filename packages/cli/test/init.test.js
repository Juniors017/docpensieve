import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { DocPensieveError } from '@docpensieve/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { init } from '../src/index.js';

/**
 * Answers served to the dialogue, and opening count.
 *
 * `vi.hoisted` because `vi.mock` is hoisted above the imports: an object
 * declared normally would not exist yet when the factory runs.
 */
const dialogue = vi.hoisted(() => ({
  /** @type {string[]} */
  answers: [],
  openings: 0,
  /** @type {string[]} */
  asked: [],
}));

vi.mock('node:readline/promises', () => ({
  createInterface: () => {
    dialogue.openings += 1;
    return {
      /** @param {string} question */
      question: async (question) => {
        dialogue.asked.push(question);
        return dialogue.answers.shift() ?? '';
      },
      close: () => {},
    };
  },
}));

/** @type {string[]} */
const dirs = [];

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  dialogue.answers = [];
  dialogue.asked = [];
  dialogue.openings = 0;
});

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Throwaway empty folder. */
function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), 'docpensieve-init-'));
  dirs.push(dir);
  return dir;
}

/** @param {string} root @param {...string} parts */
const read = (root, ...parts) => readFileSync(path.join(root, ...parts), 'utf8');

describe('init', () => {
  it('sets up configuration, pages and .gitignore', async () => {
    const dir = scratch();
    await init(dir, { yes: true, name: 'My docs' });

    expect(existsSync(path.join(dir, 'docpensieve.config.js'))).toBe(true);
    expect(existsSync(path.join(dir, 'docs', 'v1.0', 'index.md'))).toBe(true);
    expect(existsSync(path.join(dir, 'docs', 'v1.0', 'guide', '01-installation.md'))).toBe(true);
    expect(read(dir, '.gitignore')).toContain('dist/');
  });

  it('creates the target folder when it does not exist', async () => {
    const dir = path.join(scratch(), 'new', 'project');
    await init(dir, { yes: true });
    expect(existsSync(path.join(dir, 'docpensieve.config.js'))).toBe(true);
  });

  it('takes the requested name, URL and theme', async () => {
    const dir = scratch();
    await init(dir, {
      yes: true,
      name: 'Workshop',
      siteUrl: 'https://example.com/docs',
      theme: 'custom',
    });

    const config = read(dir, 'docpensieve.config.js');
    expect(config).toContain("projectName: 'Workshop'");
    expect(config).toContain("siteUrl: 'https://example.com/docs'");
    expect(config).toContain("framework: 'custom'");
  });

  it('quotes strings in the project style, apostrophes included', async () => {
    // It is the first file the user opens: it must be readable, and above all
    // valid.
    const dir = scratch();
    await init(dir, { yes: true, name: "Élise's workshop" });

    const config = read(dir, 'docpensieve.config.js');
    expect(config).toContain("projectName: 'Élise\\'s workshop'");
    expect(config).not.toContain('"É');
  });

  it('accepts “1.0” as well as “v1.0” for the first version', async () => {
    for (const version of ['1.0', 'v1.0']) {
      const dir = scratch();
      await init(dir, { yes: true, version });

      expect(existsSync(path.join(dir, 'docs', 'v1.0', 'index.md'))).toBe(true);
      expect(read(dir, 'docpensieve.config.js')).toContain("slug: 'v1.0'");
    }
  });

  it('announces nothing to install, whatever the theme', async () => {
    // Tailwind comes with the tool: announcing “npm install tailwindcss” would
    // send the user to install what they already have.
    for (const theme of ['tailwind', 'custom']) {
      vi.mocked(console.log).mockClear();
      await init(scratch(), { yes: true, theme });
      const output = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(output, theme).not.toContain('npm install');
    }
  });

  it('refuses an unknown framework and lists the accepted values', async () => {
    const dir = scratch();
    try {
      await init(dir, { yes: true, theme: 'bootstrap' });
      expect.unreachable('init should have thrown');
    } catch (error) {
      const failure = /** @type {DocPensieveError} */ (error);
      expect(failure).toBeInstanceOf(DocPensieveError);
      expect(failure.hint).toContain('tailwind');
    }
    expect(existsSync(path.join(dir, 'docpensieve.config.js'))).toBe(false);
  });

  it('refuses to overwrite an existing project', async () => {
    const dir = scratch();
    await init(dir, { yes: true, name: 'First' });

    await expect(init(dir, { yes: true, name: 'Second' })).rejects.toThrow(/already exists/);
    expect(read(dir, 'docpensieve.config.js')).toContain("projectName: 'First'");
  });

  it('overwrites on explicit request', async () => {
    const dir = scratch();
    await init(dir, { yes: true, name: 'First' });
    await init(dir, { yes: true, name: 'Second', force: true });

    expect(read(dir, 'docpensieve.config.js')).toContain("projectName: 'Second'");
  });

  it('completes an existing .gitignore without overwriting it', async () => {
    const dir = scratch();
    writeFileSync(path.join(dir, '.gitignore'), '*.log\n', 'utf8');

    await init(dir, { yes: true });

    const ignore = read(dir, '.gitignore');
    expect(ignore).toContain('*.log');
    expect(ignore).toContain('dist/');
  });

  it('does not duplicate an entry already present', async () => {
    const dir = scratch();
    writeFileSync(path.join(dir, '.gitignore'), 'dist/\n', 'utf8');

    await init(dir, { yes: true });

    expect(read(dir, '.gitignore').match(/dist\//g)).toHaveLength(1);
  });
});

describe('init — the .gitignore', () => {
  it('adds a line break when the file does not end with one', async () => {
    // Without it, “dist/” would stick to the last rule and distort it.
    const dir = scratch();
    writeFileSync(path.join(dir, '.gitignore'), '*.log', 'utf8');
    await init(dir, { yes: true });

    const contents = read(dir, '.gitignore');
    expect(contents).toContain('*.log\ndist/');
  });
});

describe('init — the dialogue', () => {
  /** @type {boolean | undefined} */
  let tty;

  beforeEach(() => {
    tty = process.stdin.isTTY;
    // Without a terminal, `init` skips the dialogue: the tests must simulate one.
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: tty, configurable: true });
  });

  it('takes the typed answers', async () => {
    dialogue.answers = ['My project', 'https://example.com/doc', '2.0', 'custom'];
    const dir = scratch();
    await init(dir);

    const config = read(dir, 'docpensieve.config.js');
    expect(config).toContain("projectName: 'My project'");
    expect(config).toContain("siteUrl: 'https://example.com/doc'");
    expect(config).toContain("slug: 'v2.0'");
    expect(config).toContain("framework: 'custom'");
  });

  it('keeps the default value on an empty answer', async () => {
    // Four empty answers: the user accepts everything without typing.
    const dir = scratch();
    await init(dir);

    const config = read(dir, 'docpensieve.config.js');
    expect(config).toContain("framework: 'tailwind'");
    expect(config).toContain("slug: 'v1.0'");
  });

  it('picks the framework by its number', async () => {
    dialogue.answers = ['', '', '', '2'];
    const dir = scratch();
    expect((await init(dir)).theme).toBe('custom');
  });

  it('picks the framework by its name', async () => {
    // Typing “custom” is more natural than counting lines.
    dialogue.answers = ['', '', '', 'CUSTOM'];
    const dir = scratch();
    expect((await init(dir)).theme).toBe('custom');
  });

  it('asks again after an answer it does not understand', async () => {
    dialogue.answers = ['', '', '', 'bootstrap', '9', 'tailwind'];
    const dir = scratch();
    expect((await init(dir)).theme).toBe('tailwind');

    const questions = dialogue.asked.filter((q) => q.includes('Your choice'));
    expect(questions).toHaveLength(3);
  });

  it('does not ask for the framework when the option gives it', async () => {
    dialogue.answers = ['My project', '', ''];
    const dir = scratch();
    expect((await init(dir, { theme: 'custom' })).theme).toBe('custom');
    expect(dialogue.asked.some((q) => q.includes('Your choice'))).toBe(false);
  });

  it('opens no dialogue with --yes', async () => {
    await init(scratch(), { yes: true });
    expect(dialogue.openings).toBe(0);
  });

  it('opens no dialogue without a terminal', async () => {
    // Script, continuous integration, pipe: the dialogue would never complete.
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    await init(scratch());
    expect(dialogue.openings).toBe(0);
  });
});
