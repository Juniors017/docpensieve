import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { addCopyButtons, codeOf, wordsFor } from '../client/copy.js';

/**
 * The smallest document `addCopyButtons` can work on.
 *
 * Hand-rolled rather than a DOM library: what is checked here is the wiring —
 * one button per block, the right words, nothing done twice — and a fake that
 * fits on a screen says exactly which calls the script depends on.
 *
 * @param {string} lang
 * @param {number} blocks How many code blocks the page holds.
 */
function fakeDocument(lang, blocks) {
  /** @param {string} tag */
  const element = (tag) => ({
    tag,
    type: '',
    className: '',
    textContent: '',
    /** @type {Record<string, string>} */
    attributes: {},
    /** @type {string[]} */
    classes: [],
    /** @type {any[]} */
    children: [],
    /** @param {string} name @param {string} value */
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener() {},
    classList: {
      /** @type {string[]} */
      added: [],
      /** @param {string} name */
      add(name) {
        this.added.push(name);
      },
      remove() {},
    },
    /** @param {any} child */
    appendChild(child) {
      this.children.push(child);
    },
    /** @param {string} selector */
    querySelector(selector) {
      if (selector === 'code')
        return this.children.find((/** @type {any} */ c) => c.tag === 'code');
      return this.children.find((/** @type {any} */ c) => c.className === 'dp-copy') ?? null;
    },
  });

  const pres = Array.from({ length: blocks }, () => {
    const pre = element('pre');
    const code = element('code');
    code.textContent = 'const a = 1;\n';
    pre.children.push(code);
    return pre;
  });

  return {
    documentElement: { lang },
    pres,
    querySelectorAll: () => pres,
    createElement: element,
  };
}

describe('the words of the copy button', () => {
  it('follows the language of the document', () => {
    // A French page must not grow an English button: the wording is read from
    // the document, as the shell reads it from the configuration.
    expect(wordsFor('fr').copy).toBe('Copier');
    expect(wordsFor('en').copy).toBe('Copy');
  });

  it('reads a regional variant as its language, and falls back to English', () => {
    expect(wordsFor('fr-CA').copy).toBe('Copier');
    expect(wordsFor('de').copy).toBe('Copy');
    expect(wordsFor('').copy).toBe('Copy');
  });
});

describe('the code a button copies', () => {
  it('takes the text, not the colours around it', () => {
    // The highlighter wraps every token in a span: reading the markup would
    // put the colours in the reader's clipboard.
    expect(codeOf({ textContent: 'const a = 1;\n\n' })).toBe('const a = 1;');
    expect(codeOf({ innerText: 'npm run build\n' })).toBe('npm run build');
    expect(codeOf({ textContent: null })).toBe('');
  });
});

describe('fitting the buttons', () => {
  it('gives every block one, labelled in the language of the page', () => {
    const doc = fakeDocument('fr', 2);
    addCopyButtons(/** @type {any} */ (doc));

    const buttons = doc.pres.map((pre) => pre.children.at(-1));
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.textContent).toBe('Copier');
    // The label repeats what the button does, for a reader who meets it
    // without the block above.
    expect(buttons[0]?.attributes['aria-label']).toBe('Copier');
    expect(doc.pres[0].classList.added).toContain('dp-has-copy');
  });

  it('never fits the same block twice', () => {
    // The page may be rebuilt under a reader who never reloaded it.
    const doc = fakeDocument('en', 1);
    addCopyButtons(/** @type {any} */ (doc));
    addCopyButtons(/** @type {any} */ (doc));

    expect(doc.pres[0].children.filter((child) => child.className === 'dp-copy')).toHaveLength(1);
  });
});

describe('what a page makes the reader download', () => {
  /**
   * Budgets, in bytes once compressed, as a server sends them.
   *
   * The rule of no script at all was replaced by a promise that has to be
   * measured (ADR-021): without a number, "light" means nothing in six
   * months. These fail loudly rather than drift — raising one is a decision,
   * and it should be taken on purpose.
   */
  const BUDGET = { 'copy.js': 2048, 'search.js': 3072 };

  for (const [file, budget] of Object.entries(BUDGET)) {
    it(`keeps ${file} under ${budget} bytes compressed`, () => {
      const source = readFileSync(fileURLToPath(new URL(`../client/${file}`, import.meta.url)));
      expect(gzipSync(source).length).toBeLessThanOrEqual(budget);
    });
  }

  it('loads no framework: the client files import nothing', () => {
    // Hydration is allowed to components that declare it (ADR-021), but a
    // behaviour added to a page is not one of them. An import creeping in
    // here is a runtime creeping in with it.
    for (const file of Object.keys(BUDGET)) {
      const source = readFileSync(
        fileURLToPath(new URL(`../client/${file}`, import.meta.url)),
        'utf8',
      );
      expect(source).not.toMatch(/^\s*import\s/m);
    }
  });
});
