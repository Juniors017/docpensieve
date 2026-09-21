import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ADMONITION_KINDS } from '@docpensieve/components';
import { DEFAULT_THEME_CLASSES } from '@docpensieve/shared';
import { CustomProvider, TailwindProvider } from '@docpensieve/theme';
import { describe, expect, it } from 'vitest';

/**
 * The documentation counts things out loud — "the forty-eight slots", "six
 * kinds". Those sentences are the first thing to go stale: nothing breaks when
 * a slot is added, and the page keeps saying a number that was true once.
 *
 * The user asked for the documentation to be challenged like the code
 * (2026-09-18), after three such claims had drifted at the same time. These
 * tests are that challenge, run on every suite.
 */
const DOCS = fileURLToPath(new URL('../../../docs/v0.5/', import.meta.url));
const read = (/** @type {string} */ file) => readFileSync(DOCS + file, 'utf8');

/** Numbers the pages write out in words, as prose deserves. */
const WORDS = /** @type {Record<string, number>} */ ({
  six: 6,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fifteen: 15,
  twenty: 20,
  'twenty-one': 21,
  'twenty-four': 24,
  'forty-eight': 48,
  fifty: 50,
});

/**
 * Reads the number a sentence announces, from the word before a noun.
 *
 * @param {string} text Page content.
 * @param {string} noun What is being counted, as written — `slots`, `tokens`.
 * @returns {number | undefined}
 */
function claimed(text, noun) {
  // Only the words that are numbers count: a page says "the tokens are listed"
  // as readily as "twenty-one tokens", and the first match is rarely the one
  // making a claim.
  const matches = [...text.matchAll(new RegExp(`\\b([a-z]+(?:-[a-z]+)?)\\s+${noun}\\b`, 'gi'))];
  const numbers = matches.map((match) => WORDS[match[1].toLowerCase()]).filter(Boolean);
  return numbers[0];
}

describe('what the documentation counts out loud', () => {
  it('announces as many theme slots as the theme defines', () => {
    const guide = read('01-guide/05-themes.mdx');
    expect(claimed(guide, 'slots')).toBe(Object.keys(DEFAULT_THEME_CLASSES).length);
  });

  it('announces as many tokens as its own table lists', () => {
    const reference = read('03-reference/04-theme.md');
    const rows = new Set(
      [...reference.matchAll(/^\| `(--dp-[a-z-]+)`\s*\|/gm)].map((match) => match[1]),
    );
    expect(claimed(reference, 'tokens')).toBe(rows.size);
  });

  it('lists every slot the templates can ask for', () => {
    // A slot missing from this table is a class a project cannot find, and
    // nothing reports it: the site builds, the slot works, the reader looking
    // for it does not. Two language slots drifted out of it that way.
    const reference = read('03-reference/04-theme.md');
    const missing = Object.keys(DEFAULT_THEME_CLASSES).filter(
      (slot) => !reference.includes(`| \`${slot}\``),
    );

    expect(missing).toEqual([]);
  });

  it('lists every token both themes define', () => {
    const reference = read('03-reference/04-theme.md');
    // The tones of an admonition were reachable and listed nowhere: a token
    // absent from this table is a colour a project cannot find.
    const defined = new Set([
      ...Object.keys(new CustomProvider().tokens),
      ...Object.keys(new TailwindProvider().tokens),
    ]);
    const missing = [...defined].filter((token) => !reference.includes(`\`${token}\``));
    expect(missing).toEqual([]);
  });

  it('announces as many components as it has pages for', () => {
    const home = read('index.mdx');
    const pages = readdirSync(`${DOCS}02-components`).filter(
      (file) => file.endsWith('.mdx') && file !== 'index.mdx',
    );
    expect(claimed(home, 'components')).toBe(pages.length);
  });

  it('announces as many admonition kinds as the component ships', () => {
    const page = read('02-components/12-admonition.mdx');
    expect(claimed(page, 'kinds')).toBe(Object.keys(ADMONITION_KINDS).length);
  });
});
