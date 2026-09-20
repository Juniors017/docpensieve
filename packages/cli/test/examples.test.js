/**
 * The example projects of the repository, built and checked as a reader
 * would: an example that no longer builds teaches the wrong thing.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { build, check } from '../src/index.js';

const EXAMPLES = fileURLToPath(new URL('../../../examples/', import.meta.url));

/** @type {string[]} */
const dirs = [];

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/**
 * Copies an example to a throwaway folder: building in place would write
 * into the repository.
 * @param {string} name
 */
function copy(name) {
  const dir = mkdtempSync(path.join(tmpdir(), `docpensieve-example-${name}-`));
  dirs.push(dir);
  cpSync(path.join(EXAMPLES, name), dir, { recursive: true });
  return dir;
}

describe('the examples', () => {
  it('build the Tailwind example, its menu and its feed', { timeout: 120_000 }, async () => {
    const cwd = copy('tailwind');
    await build(undefined, { cwd });

    const { faults } = await check({ cwd });
    expect(faults).toEqual([]);
    const feed = readFileSync(path.join(cwd, 'dist', 'feed.xml'), 'utf8');
    expect(feed).toContain('<title>Acme 1.0 is out</title>');
  });

  it('build the custom example, kept dark', { timeout: 120_000 }, async () => {
    const cwd = copy('custom');
    await build(undefined, { cwd });

    const { faults } = await check({ cwd });
    expect(faults).toEqual([]);
    const home = readFileSync(path.join(cwd, 'dist', 'versions', 'v1.0', 'index.html'), 'utf8');
    expect(home).toContain('<html lang="en" dir="ltr" class="dark">');
    const css = readFileSync(
      path.join(cwd, 'dist', 'versions', 'v1.0', 'assets', 'docpensieve.css'),
      'utf8',
    );
    expect(css).toContain('.highlight{');
  });
});
