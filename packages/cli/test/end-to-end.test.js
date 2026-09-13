/**
 * The whole journey, as someone discovering the tool lives it: `init`, then
 * `build`, then `check`.
 *
 * Each command is tested on its own, but nothing checked that they chain —
 * that a freshly set-up project builds, and that what it produces passes the
 * review. Yet it is the first thing a user does, and the first thing that can
 * put them off.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { build, check, init } from '../src/index.js';

/** @type {string[]} */
const dirs = [];

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Throwaway empty folder. */
function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), 'docpensieve-e2e-'));
  dirs.push(dir);
  return dir;
}

/** @param {string} root @param {...string} parts */
const read = (root, ...parts) => readFileSync(path.join(root, ...parts), 'utf8');

describe('init, build, check', () => {
  // Compiling the stylesheet and warming up highlighting take a few seconds:
  // this test pays the price of being real.
  it('produces a complete, checkable site from an empty folder', { timeout: 120_000 }, async () => {
    const cwd = scratch();

    const { theme } = await init(cwd, { yes: true, name: 'My docs' });
    expect(theme).toBe('tailwind');
    expect(existsSync(path.join(cwd, 'docpensieve.config.js'))).toBe(true);

    await build(undefined, { cwd });

    const out = path.join(cwd, 'dist');
    const home = read(out, 'versions', 'v1.0', 'index.html');

    // The requested name makes it to the page.
    expect(home).toContain('My docs');
    // The shell is the project's, not a bare page.
    expect(home).toContain('dp-shell');
    expect(home).toContain('dp-scroll-top');
    // The stylesheet is compiled and referenced.
    expect(existsSync(path.join(out, 'versions', 'v1.0', 'assets', 'docpensieve.css'))).toBe(true);
    // The root leads to the current version.
    expect(read(out, 'index.html')).toContain('versions/v1.0/');
    expect(JSON.parse(read(out, 'versions.json')).versions).toHaveLength(1);

    // And the review finds nothing to complain about.
    const { faults, pages } = await check({ cwd });
    expect(faults).toEqual([]);
    expect(pages).toBeGreaterThan(0);
  });

  it('produces a complete site with the dependency-free theme', { timeout: 120_000 }, async () => {
    // The other installation path: nothing to install beyond the tool.
    const cwd = scratch();
    await init(cwd, { yes: true, name: 'No dependency', theme: 'custom' });
    await build(undefined, { cwd });

    const css = read(path.join(cwd, 'dist'), 'versions', 'v1.0', 'assets', 'docpensieve.css');
    expect(css).toContain('--dp-bg');

    const { faults } = await check({ cwd });
    expect(faults).toEqual([]);
  });

  it('also checks a site served under a sub-path', { timeout: 120_000 }, async () => {
    // It is the setting that breaks the most sites: every internal link must
    // carry the prefix, and "check" is what verifies it.
    const cwd = scratch();
    await init(cwd, {
      yes: true,
      name: 'My docs',
      siteUrl: 'https://example.com/my-project',
    });
    await build(undefined, { cwd });

    const home = read(path.join(cwd, 'dist'), 'versions', 'v1.0', 'index.html');
    expect(home).toContain('/my-project/versions/v1.0/');

    const { faults } = await check({ cwd });
    expect(faults).toEqual([]);
  });
});
