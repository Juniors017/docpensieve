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
