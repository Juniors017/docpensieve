/**
 * The whole journey, as someone discovering the tool lives it: `init`, then
 * `build`, then `check`.
 *
 * Each command is tested on its own, but nothing checked that they chain —
 * that a freshly set-up project builds, and that what it produces passes the
 * review. Yet it is the first thing a user does, and the first thing that can
 * put them off.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOCUMENTATION_URL } from '@docpensieve/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { build, check, init } from '../src/index.js';

/** The command as users run it, for the cases only a real Node process shows. */
const CLI = fileURLToPath(new URL('../bin/docpensieve.js', import.meta.url));

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

/**
 * Classes of the installed documentation's pages that no rule of the
 * stylesheet mentions: an example that renders unstyled.
 *
 * The examples used to be written with utilities only: under the custom
 * theme, the columns kept no gap, the cards no colour, and nothing said so.
 * The code highlighter's classes are left out, and so are the `dp-*` classes,
 * which belong to the theme and the components.
 *
 * @param {string} out Output folder.
 * @returns {string[]} `page: class` entries.
 */
function unstyledClasses(out) {
  const version = path.join(out, 'versions', 'v1.0');
  // Selectors escape their special characters, class attributes do not.
  const css = read(version, 'assets', 'docpensieve.css').split(String.fromCharCode(92)).join('');
  /** @param {string} name */
  const styled = (name) => {
    for (let at = css.indexOf(`.${name}`); at >= 0; at = css.indexOf(`.${name}`, at + 1)) {
      const next = css[at + name.length + 1];
      if (!next || !/[a-zA-Z0-9_-]/.test(next)) return true;
    }
    return false;
  };
  const ignored = (/** @type {string} */ name) =>
    !name || name === 'line' || /^(dp-|shiki|github-)/.test(name);

  const section = path.join(version, 'docpensieve');
  /** @type {Set<string>} */
  const faults = new Set();
  for (const file of readdirSync(section, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.html')) continue;
    const html = read(section, file);
    const article = html.slice(html.indexOf('<article'), html.lastIndexOf('</article>'));
    for (const [, value] of article.matchAll(/class="([^"]*)"/g)) {
      for (const name of value.replaceAll('&amp;', '&').split(' ')) {
        if (!ignored(name) && !styled(name)) faults.add(`${file}: ${name}`);
      }
    }
  }
  return [...faults];
}

describe('init, build, check', () => {
  // Compiling the stylesheet and warming up highlighting take a few seconds:
  // this test pays the price of being real.
  it('produces a complete, checkable site from an empty folder', { timeout: 120_000 }, async () => {
    const cwd = scratch();

    const { theme } = await init(cwd, { yes: true, name: 'My docs' });
    expect(theme).toBe('tailwind');
    expect(existsSync(path.join(cwd, 'docpensieve.config.mjs'))).toBe(true);

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
    // DocPensieve's own documentation comes with the project, in its section,
    // and the home page leads to it.
    expect(
      existsSync(
        path.join(out, 'versions', 'v1.0', 'docpensieve', 'guide', 'installation', 'index.html'),
      ),
    ).toBe(true);
    expect(home).toContain('href="/versions/v1.0/docpensieve/"');

    // And the review finds nothing to complain about — the links of the
    // installed documentation included.
    const { faults, pages } = await check({ cwd });
    expect(faults).toEqual([]);
    expect(pages).toBeGreaterThan(0);

    // Every example of the documentation renders with the utility theme.
    expect(unstyledClasses(out)).toEqual([]);
  });

  it('produces a complete site with the dependency-free theme', { timeout: 120_000 }, async () => {
    // The other installation path: nothing to install beyond the tool.
    const cwd = scratch();
    await init(cwd, { yes: true, name: 'No dependency', theme: 'custom' });
    await build(undefined, { cwd });

    const css = read(path.join(cwd, 'dist'), 'versions', 'v1.0', 'assets', 'docpensieve.css');
    expect(css).toContain('--dp-bg');

    // The documentation's examples find their classes in the theme folder
    // init wrote: each page shows the variant of the custom theme.
    expect(existsSync(path.join(cwd, 'theme', '99-docpensieve.css'))).toBe(true);
    expect(unstyledClasses(path.join(cwd, 'dist'))).toEqual([]);

    const { faults } = await check({ cwd });
    expect(faults).toEqual([]);
  });

  /**
   * What a component says about a heading, a paragraph or a table cell has to
   * be said outside the `components` layer, since an unlayered rule of
   * prose.css beats a layered one whatever their order. Left inside it, the
   * snippet frame drew a box inside a box, the banner's title carried the
   * rule that divides a page, and the calendar's cells took the padding of a
   * table of prose — three times the same fault, none of them reported.
   */
  const OVER_PROSE = [
    '.dp-article .dp-hero >',
    '.dp-article .dp-calendar-grid th',
    '.dp-article .dp-calendar-day',
    '.dp-article .dp-snippet-body >',
  ];

  /** Rules a component owns, which both themes must carry all the same. */
  const OWNED = ['.dp-hero', '.dp-hero-actions', '.dp-calendar', '.dp-calendar--compact'];

  for (const framework of ['tailwind', 'custom']) {
    it(
      `styles its components the same way under the ${framework} theme`,
      { timeout: 120_000 },
      async () => {
        const cwd = scratch();
        await init(cwd, { yes: true, name: 'Both themes', theme: framework });
        await build(undefined, { cwd });

        const css = read(path.join(cwd, 'dist'), 'versions', 'v1.0', 'assets', 'docpensieve.css');
        const flat = css.replace(/\s*\{/g, '{');

        for (const selector of [...OWNED, ...OVER_PROSE]) {
          expect(flat, `${selector} is missing under ${framework}`).toContain(selector);
        }

        // And they must sit where they can win: before the layer, or outside
        // any layer at all.
        const layer = flat.indexOf('@layer components');
        for (const selector of OVER_PROSE) {
          const at = flat.indexOf(selector);
          expect(layer === -1 || at < layer, `${selector} is layered under ${framework}`).toBe(
            true,
          );
        }
      },
    );
  }

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

  it(
    'builds without a module warning, whatever package.json surrounds the project',
    { timeout: 120_000 },
    async () => {
      // "npm init -y" writes "type": "commonjs", where a .js configuration
      // written as a module did not even load; a package.json saying nothing
      // made Node warn on every build. Only Node itself shows either — the
      // test runner loads modules its own way — hence a real process.
      for (const manifest of [{ name: 'site', type: 'commonjs' }, { name: 'site' }]) {
        const cwd = scratch();
        writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(manifest), 'utf8');
        await init(cwd, { yes: true, minimal: true });

        const { status, stderr } = spawnSync(process.execPath, [CLI, 'build'], {
          cwd,
          encoding: 'utf8',
        });
        expect(stderr, JSON.stringify(manifest)).not.toMatch(/ES module|Module type/);
        expect(status, stderr).toBe(0);
      }
    },
  );

  it('sends a stuck reader to the documentation', () => {
    // Someone typing --help has usually run out of ideas; a list of commands
    // with no address leaves them exactly where they were.
    const { stdout, status } = spawnSync(process.execPath, [CLI, '--help'], { encoding: 'utf8' });

    expect(status).toBe(0);
    expect(stdout).toContain(DOCUMENTATION_URL);
  });
});
