import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ADMONITION_KINDS } from '@docpensieve/components';
import { DEFAULT_CONFIG, loadConfig } from '@docpensieve/core';
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

/** Everything `init` printed, in one string. */
const printed = () => vi.mocked(console.log).mock.calls.flat().join(' ');

describe('init', () => {
  it('sets up configuration, pages and .gitignore', async () => {
    const dir = scratch();
    await init(dir, { yes: true, name: 'My docs' });

    expect(existsSync(path.join(dir, 'docpensieve.config.mjs'))).toBe(true);
    expect(existsSync(path.join(dir, 'docs', 'v1.0', 'index.md'))).toBe(true);
    expect(existsSync(path.join(dir, 'docs', 'v1.0', '01-guide', '01-installation.md'))).toBe(true);
    expect(read(dir, '.gitignore')).toContain('dist/');
  });

  it('creates the target folder when it does not exist', async () => {
    const dir = path.join(scratch(), 'new', 'project');
    await init(dir, { yes: true });
    expect(existsSync(path.join(dir, 'docpensieve.config.mjs'))).toBe(true);
  });

  it('takes the requested name, URL and theme', async () => {
    const dir = scratch();
    await init(dir, {
      yes: true,
      name: 'Workshop',
      siteUrl: 'https://example.com/docs',
      theme: 'custom',
    });

    const config = read(dir, 'docpensieve.config.mjs');
    expect(config).toContain("projectName: 'Workshop'");
    expect(config).toContain("siteUrl: 'https://example.com/docs'");
    expect(config).toContain("framework: 'custom'");
  });

  it('quotes strings in the project style, apostrophes included', async () => {
    // It is the first file the user opens: it must be readable, and above all
    // valid.
    const dir = scratch();
    await init(dir, { yes: true, name: "Élise's workshop" });

    const config = read(dir, 'docpensieve.config.mjs');
    expect(config).toContain("projectName: 'Élise\\'s workshop'");
    expect(config).not.toContain('"É');
  });

  it('accepts “1.0” as well as “v1.0” for the first version', async () => {
    for (const version of ['1.0', 'v1.0']) {
      const dir = scratch();
      await init(dir, { yes: true, version, minimal: true });

      expect(existsSync(path.join(dir, 'docs', 'v1.0', 'index.md'))).toBe(true);
      expect(read(dir, 'docpensieve.config.mjs')).toContain("slug: 'v1.0'");
    }
  });

  it('announces nothing to install, whatever the theme', async () => {
    // Tailwind comes with the tool: announcing “npm install tailwindcss” would
    // send the user to install what they already have.
    for (const theme of ['tailwind', 'custom']) {
      vi.mocked(console.log).mockClear();
      await init(scratch(), { yes: true, theme, minimal: true });
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
    expect(existsSync(path.join(dir, 'docpensieve.config.mjs'))).toBe(false);
  });

  it('refuses to overwrite an existing project', async () => {
    const dir = scratch();
    await init(dir, { yes: true, name: 'First', minimal: true });

    await expect(init(dir, { yes: true, name: 'Second' })).rejects.toThrow(/already exists/);
    expect(read(dir, 'docpensieve.config.mjs')).toContain("projectName: 'First'");
  });

  it('overwrites on explicit request', async () => {
    const dir = scratch();
    await init(dir, { yes: true, name: 'First', minimal: true });
    await init(dir, { yes: true, name: 'Second', force: true, minimal: true });

    expect(read(dir, 'docpensieve.config.mjs')).toContain("projectName: 'Second'");
  });

  it('replaces an older docpensieve.config.js when forced to', async () => {
    // A project keeps a single configuration file: two would make every build
    // refuse both.
    const dir = scratch();
    writeFileSync(path.join(dir, 'docpensieve.config.js'), 'export default {};', 'utf8');

    await expect(init(dir, { yes: true, minimal: true })).rejects.toThrow(
      /docpensieve\.config\.js already exists/,
    );
    await init(dir, { yes: true, force: true, minimal: true });
    expect(existsSync(path.join(dir, 'docpensieve.config.js'))).toBe(false);
    expect(existsSync(path.join(dir, 'docpensieve.config.mjs'))).toBe(true);
  });

  it('writes a configuration no package.json can misread', async () => {
    // "npm init -y" now writes "type": "commonjs": a .js file written as an ES
    // module would not even load there. A .mjs file loads anywhere.
    const dir = scratch();
    writeFileSync(path.join(dir, 'package.json'), '{ "type": "commonjs" }', 'utf8');
    await init(dir, { yes: true, name: 'CommonJS project', minimal: true });

    const config = await loadConfig(dir);
    expect(config.projectName).toBe('CommonJS project');
  });

  it('completes an existing .gitignore without overwriting it', async () => {
    const dir = scratch();
    writeFileSync(path.join(dir, '.gitignore'), '*.log\n', 'utf8');

    await init(dir, { yes: true, minimal: true });

    const ignore = read(dir, '.gitignore');
    expect(ignore).toContain('*.log');
    expect(ignore).toContain('dist/');
  });

  it('does not duplicate an entry already present', async () => {
    const dir = scratch();
    writeFileSync(path.join(dir, '.gitignore'), 'dist/\n', 'utf8');

    await init(dir, { yes: true, minimal: true });

    expect(read(dir, '.gitignore').match(/dist\//g)).toHaveLength(1);
  });
});

describe('init — the .gitignore', () => {
  it('adds a line break when the file does not end with one', async () => {
    // Without it, “dist/” would stick to the last rule and distort it.
    const dir = scratch();
    writeFileSync(path.join(dir, '.gitignore'), '*.log', 'utf8');
    await init(dir, { yes: true, minimal: true });

    const contents = read(dir, '.gitignore');
    expect(contents).toContain('*.log\ndist/');
  });
});

describe('init — the configuration file', () => {
  it('shows every field the configuration accepts', async () => {
    // The first file a user opens also tells them what they can change: a
    // field added to the configuration without appearing here would stay
    // unknown to them.
    const dir = scratch();
    await init(dir, { yes: true, minimal: true });
    const config = read(dir, 'docpensieve.config.mjs');

    const fields = [
      ...Object.keys(DEFAULT_CONFIG),
      'lang',
      'framework',
      'darkMode',
      'toggle',
      'tokens',
      'css',
      'source',
    ];
    for (const field of fields) expect(config, field).toMatch(new RegExp(`\\b${field}:`));
    for (const field of ['current', 'prerelease', 'archived'])
      expect(config, field).toContain(field);
  });

  it('only offers the Tailwind entry stylesheet with the Tailwind theme', async () => {
    const dir = scratch();
    await init(dir, { yes: true, theme: 'custom', minimal: true });
    expect(read(dir, 'docpensieve.config.mjs')).not.toContain('source:');
  });

  it('writes a configuration the engine accepts as is', async () => {
    // Commented fields must break nothing, and the values set must stay the
    // defaults.
    const dir = scratch();
    await init(dir, { yes: true, siteUrl: 'https://example.com/docs', minimal: true });

    const config = await loadConfig(dir);
    expect(config.baseUrl).toBe('/docs/');
    expect(config.lang).toBe('en');
    expect(config.scrollToTop).toBe(true);
    expect(config.globalComponents).toBe(true);
  });
});

describe('init — DocPensieve documentation', () => {
  /** @param {string} dir */
  const section = (dir) => path.join(dir, 'docs', 'v1.0', '99-docpensieve');

  it('installs it by default, in its own folder', async () => {
    const dir = scratch();
    const { docs } = await init(dir, { yes: true });

    expect(docs).toBe(true);
    expect(read(section(dir), 'index.md')).toContain('title: DocPensieve');
    expect(existsSync(path.join(section(dir), '01-guide', '01-installation.md'))).toBe(true);
    expect(existsSync(path.join(section(dir), '02-components', 'icons', 'banner.svg'))).toBe(true);
    // Its home page, and the icons only that page uses, belong to
    // DocPensieve's own site.
    expect(existsSync(path.join(section(dir), 'index.mdx'))).toBe(false);
    expect(existsSync(path.join(section(dir), 'icons'))).toBe(false);
    // So do the example site and the author descriptions. Installed, the
    // author file would be published as a plain file on the user's site —
    // a leak no dead link would ever reveal.
    expect(existsSync(path.join(section(dir), '06-examples'))).toBe(false);
    expect(existsSync(path.join(section(dir), 'authors.json'))).toBe(false);
    // The project's home page points to it.
    expect(read(dir, 'docs', 'v1.0', 'index.md')).toContain('(/docpensieve/)');
  });

  it('leaves it out with --minimal', async () => {
    const dir = scratch();
    const { docs } = await init(dir, { yes: true, minimal: true });

    expect(docs).toBe(false);
    expect(existsSync(section(dir))).toBe(false);
    expect(read(dir, 'docs', 'v1.0', 'index.md')).not.toContain('/docpensieve/');
  });

  it('keeps its links relative, so that they work from their new folder', async () => {
    // Installed under 99-docpensieve, a link written /guide/… would leave the
    // section — and land on the project's own /guide/installation/ page,
    // which exists: no dead link would give it away.
    const dir = scratch();
    await init(dir, { yes: true });

    const pages = readdirSync(section(dir), { recursive: true })
      .map(String)
      .filter((file) => /\.mdx?$/.test(file));
    expect(pages.length).toBeGreaterThan(10);

    const absolute = /(\]\(|(?:href|src)=")\/(?:guide|components|reference|architecture)\//;
    for (const page of pages) {
      // Code shows examples to the reader: only the links actually followed count.
      const prose = read(section(dir), page)
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`\n]*`/g, '');
      expect(prose, page).not.toMatch(absolute);
    }
  });

  it('renders nothing this site alone has installed', async () => {
    // The pages are built in the reader's project, which has neither the icon
    // sets nor the admonition kinds of our own configuration. An example
    // rendered rather than shown would stop their build — and pass here, where
    // both are within reach.
    const dir = scratch();
    await init(dir, { yes: true });

    const pages = readdirSync(section(dir), { recursive: true })
      .map(String)
      .filter((file) => /\.mdx?$/.test(file));

    const iconOfSet = /src="[a-z0-9-]+:[a-z0-9-]+"/;
    const kind = /<Admonition[^>]*\btype="([a-z-]+)"/g;
    for (const page of pages) {
      const rendered = read(section(dir), page).replace(/```[\s\S]*?```/g, '');
      expect(rendered, page).not.toMatch(iconOfSet);
      for (const [, type] of rendered.matchAll(kind)) {
        expect(ADMONITION_KINDS, `${page}: <Admonition type="${type}">`).toHaveProperty(type);
      }
    }
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
    dialogue.answers = ['My project', 'https://example.com/doc', '2.0', 'custom', 'n'];
    const dir = scratch();
    await init(dir);

    const config = read(dir, 'docpensieve.config.mjs');
    expect(config).toContain("projectName: 'My project'");
    expect(config).toContain("siteUrl: 'https://example.com/doc'");
    expect(config).toContain("slug: 'v2.0'");
    expect(config).toContain("framework: 'custom'");
  });

  it('keeps the default value on an empty answer', async () => {
    // Empty answers: the user accepts everything without typing.
    const dir = scratch();
    const { docs } = await init(dir);

    const config = read(dir, 'docpensieve.config.mjs');
    expect(config).toContain("framework: 'tailwind'");
    expect(config).toContain("slug: 'v1.0'");
    expect(docs).toBe(true);
  });

  it('picks the framework by its number', async () => {
    dialogue.answers = ['', '', '', '2', 'n'];
    const dir = scratch();
    expect((await init(dir)).theme).toBe('custom');
  });

  it('picks the framework by its name', async () => {
    // Typing “custom” is more natural than counting lines.
    dialogue.answers = ['', '', '', 'CUSTOM', 'n'];
    const dir = scratch();
    expect((await init(dir)).theme).toBe('custom');
  });

  it('asks again after an answer it does not understand', async () => {
    dialogue.answers = ['', '', '', 'bootstrap', '9', 'tailwind', 'maybe', 'n'];
    const dir = scratch();
    const result = await init(dir);
    expect(result.theme).toBe('tailwind');
    expect(result.docs).toBe(false);

    expect(dialogue.asked.filter((q) => q.includes('Your choice'))).toHaveLength(3);
    expect(dialogue.asked.filter((q) => q.includes("DocPensieve's documentation"))).toHaveLength(2);
  });

  it('does not ask for the framework when the option gives it', async () => {
    dialogue.answers = ['My project', '', '', 'n'];
    const dir = scratch();
    expect((await init(dir, { theme: 'custom' })).theme).toBe('custom');
    expect(dialogue.asked.some((q) => q.includes('Your choice'))).toBe(false);
  });

  it('asks whether to install the documentation', async () => {
    dialogue.answers = ['', '', '', '', 'no'];
    const dir = scratch();
    expect((await init(dir)).docs).toBe(false);
    expect(existsSync(path.join(dir, 'docs', 'v1.0', '99-docpensieve'))).toBe(false);
  });

  it('does not ask about the documentation with --minimal', async () => {
    const dir = scratch();
    expect((await init(dir, { minimal: true })).docs).toBe(false);
    expect(dialogue.asked.some((q) => q.includes("DocPensieve's documentation"))).toBe(false);
  });

  it('opens no dialogue with --yes', async () => {
    await init(scratch(), { yes: true, minimal: true });
    expect(dialogue.openings).toBe(0);
  });

  it('opens no dialogue without a terminal, and says so', async () => {
    // Script, continuous integration, pipe: the dialogue would never complete.
    // Some terminals also run programs without handing them one: the
    // questions used to vanish without a word.
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    await init(scratch(), { minimal: true });
    expect(dialogue.openings).toBe(0);
    expect(printed()).toContain('No interactive terminal');
    expect(printed()).toContain('--name');
  });

  it('stays quiet about the terminal with --yes', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    await init(scratch(), { yes: true, minimal: true });
    expect(printed()).not.toContain('No interactive terminal');
  });
});

describe('init — the theme folder', () => {
  it('gives the custom theme its stylesheets', async () => {
    const dir = scratch();
    await init(dir, { yes: true, theme: 'custom' });
    expect(read(dir, 'theme', 'custom.css')).toContain('--dp-accent');
    // The classes of the documentation's examples come with it, in a file of
    // their own rather than among the pages.
    expect(read(dir, 'theme', '99-docpensieve.css')).toContain('.narrow');
    expect(existsSync(path.join(dir, 'docs', 'v1.0', '99-docpensieve', 'examples.css'))).toBe(
      false,
    );
  });

  it('leaves the examples stylesheet out with --minimal', async () => {
    const dir = scratch();
    await init(dir, { yes: true, theme: 'custom', minimal: true });
    expect(existsSync(path.join(dir, 'theme', 'custom.css'))).toBe(true);
    expect(existsSync(path.join(dir, 'theme', '99-docpensieve.css'))).toBe(false);
  });

  it('writes no theme folder for Tailwind', async () => {
    const dir = scratch();
    await init(dir, { yes: true, theme: 'tailwind' });
    expect(existsSync(path.join(dir, 'theme'))).toBe(false);
  });

  it("never overwrites the project's own stylesheet, even when forced", async () => {
    const dir = scratch();
    await init(dir, { yes: true, theme: 'custom', minimal: true });
    writeFileSync(path.join(dir, 'theme', 'custom.css'), '.mine { color: red; }', 'utf8');
    await init(dir, { yes: true, theme: 'custom', minimal: true, force: true });
    expect(read(dir, 'theme', 'custom.css')).toBe('.mine { color: red; }');
  });

  it('points to the folder from the configuration', async () => {
    const dir = scratch();
    await init(dir, { yes: true, minimal: true });
    expect(read(dir, 'docpensieve.config.mjs')).toContain('theme/ folder');
  });
});
