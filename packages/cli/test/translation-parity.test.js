import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The French translation of the version being prepared must stay **iso** with
 * the English one — the user's decision (2026-09-20): the 0.4 launches the
 * site in both languages, so a page added on one side without the other is a
 * hole nobody would see until a reader hits the language switcher and finds
 * the language named but not offered.
 */
const ROOT = fileURLToPath(new URL('../../../docs/', import.meta.url));
const PAIR = { en: 'v0.5', fr: 'v0.5-fr' };

/**
 * The published version is guarded too: a fix written on one side only is the
 * way a translation drifts once nobody is watching it any more.
 */
const PUBLISHED = { en: 'v0.4', fr: 'v0.4-fr' };

/**
 * What a page is made of, beyond its words.
 *
 * Counting files caught a missing page; it never saw a missing paragraph. A
 * lesson of the course showed the menu it teaches and, in English only, the
 * MDX that produces it — the French reader got the result without the code,
 * and every test passed. These numbers are what that gap looks like.
 *
 * @param {string} text
 * @returns {Record<string, number>}
 */
function shapeOf(text) {
  const count = (/** @type {RegExp} */ pattern) => (text.match(pattern) ?? []).length;
  return {
    headings: count(/^#{1,4}\s/gm),
    fences: count(/^```/gm),
    bullets: count(/^\s*[-*]\s/gm),
    rows: count(/^\|/gm),
    links: count(/\]\(/g),
  };
}

/**
 * @param {string} folder
 * @param {RegExp} [keep]
 * @returns {string[]} Paths within the folder, sorted.
 */
function pagesOf(folder, keep = /\.mdx?$/) {
  /**
   * @param {string} dir
   * @returns {string[]}
   */
  const walk = (dir) =>
    readdirSync(ROOT + dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
    );
  return walk(folder)
    .filter((file) => keep.test(file))
    .map((file) => file.slice(folder.length + 1))
    .sort();
}

describe('the French translation of the beta', () => {
  it('has exactly the pages the English one has', () => {
    expect(pagesOf(PAIR.fr)).toEqual(pagesOf(PAIR.en));
  });

  it('carries the files those pages need', () => {
    // Icons, covers, the authors file: a page whose image is missing renders
    // an empty box, and the build says nothing.
    const assets = /\.(svg|jpg|jpeg|png|css|json)$/;
    expect(pagesOf(PAIR.fr, assets)).toEqual(pagesOf(PAIR.en, assets));
  });

  it('is written in French, not copied from the English', () => {
    // A page copied and forgotten is the failure this parity invites: the file
    // exists, the switcher offers it, and the reader gets English.
    const copied = pagesOf(PAIR.fr).filter((page) => {
      const french = readFileSync(`${ROOT}${PAIR.fr}/${page}`, 'utf8');
      const english = readFileSync(`${ROOT}${PAIR.en}/${page}`, 'utf8');
      // The API page is generated: its entries come from the English JSDoc by
      // rule, and only its own prose is translated.
      if (page.endsWith('05-api.md')) return false;
      return french === english;
    });

    expect(copied).toEqual([]);
  });
});

describe('what the two sides are made of', () => {
  for (const { name, pair } of [
    { name: 'the beta', pair: PAIR },
    { name: 'the published version', pair: PUBLISHED },
  ]) {
    it(`matches page by page, in ${name}`, () => {
      const drifted = pagesOf(pair.en)
        .map((page) => ({
          page,
          en: shapeOf(readFileSync(`${ROOT}${pair.en}/${page}`, 'utf8')),
          fr: shapeOf(readFileSync(`${ROOT}${pair.fr}/${page}`, 'utf8')),
        }))
        .filter(({ en, fr }) => JSON.stringify(en) !== JSON.stringify(fr))
        .map(({ page, en, fr }) => `${page}: ${JSON.stringify(en)} vs ${JSON.stringify(fr)}`);

      expect(drifted).toEqual([]);
    });
  }

  it('has the same pages on both sides of the published version', () => {
    expect(pagesOf(PUBLISHED.fr)).toEqual(pagesOf(PUBLISHED.en));
  });
});
