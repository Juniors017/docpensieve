import { ConfigError } from '@docpensieve/shared';
import { describe, expect, it } from 'vitest';

import { defineConfig, normalizeConfig } from '../src/index.js';

/**
 * Every refusal of the configuration, each on its own input.
 *
 * "Nothing fails silently" is a promise this validator keeps line by line, and
 * a refusal nobody has ever triggered is a promise nobody has checked: these
 * lines were the ones a coverage report showed untouched. Each case names what
 * a user would write, what the message must say, and the hint must exist —
 * the CLI prints both, and they regress separately.
 */
const base = {
  projectName: 'Docs',
  versions: [{ slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true }],
};

/** @param {Record<string, any>} version */
const withVersion = (version) => ({ ...base, versions: [{ ...base.versions[0], ...version }] });

/** @type {[string, Record<string, any>, RegExp][]} */
const REFUSALS = [
  // translations
  ['translations written as a list', withVersion({ translations: ['fr'] }), /must be an object/],
  ['a translation without its folder', withVersion({ translations: { fr: '' } }), /has no folder/],
  [
    'a translation reading the folder of its version',
    withVersion({ translations: { fr: 'docs/v1.0' } }),
    /same folder as the version/,
  ],

  // ui
  ['ui written as a list', { ...base, ui: [] }, /ui must be an object of languages/],
  [
    'the wording of a language as a sentence',
    { ...base, ui: { fr: 'Chercher' } },
    /must be an object/,
  ],
  ['a wording key nobody reads', { ...base, ui: { en: { serch: 'Find' } } }, /Unknown wording key/],
  [
    'pages written as a pair',
    { ...base, ui: { en: { pages: ['page', 'pages'] } } },
    /set of plurals/,
  ],
  [
    'an empty plural',
    { ...base, ui: { en: { pages: { one: '', other: 'pages' } } } },
    /is not a text/,
  ],
  ['an empty label', { ...base, ui: { en: { search: '' } } }, /must be a text/],

  // admonitions
  ['admonitions written as a list', { ...base, admonitions: [] }, /object of kinds/],
  [
    'a kind without a label',
    { ...base, admonitions: { review: { tone: 'info' } } },
    /has no label/,
  ],
  [
    'a kind with an empty icon',
    { ...base, admonitions: { review: { label: 'Review', tone: 'info', icon: ' ' } } },
    /must be a path/,
  ],
  [
    'a kind with a colour instead of a tone',
    { ...base, admonitions: { review: { label: 'Review', tone: 'purple' } } },
    /unknown tone/,
  ],

  // header
  ['stickyHeader written as a word', { ...base, stickyHeader: 'yes' }, /true or false/],
  ['headerLinks written as an object', { ...base, headerLinks: {} }, /list of links/],
  ['a header link without a label', { ...base, headerLinks: [{ href: '/x/' }] }, /has no label/],
  [
    'a header link with a relative target',
    { ...base, headerLinks: [{ label: 'A', href: 'x/' }] },
    /absolute target/,
  ],
  [
    'a header link to a version nobody declared',
    { ...base, headerLinks: [{ label: 'A', href: '/x/', version: 'v9' }] },
    /unknown version/,
  ],
  [
    'a panel with no column',
    { ...base, headerLinks: [{ label: 'A', columns: [] }] },
    /list of columns/,
  ],
  [
    'an entry that both leads somewhere and opens a panel',
    {
      ...base,
      headerLinks: [
        { label: 'A', href: '/x/', columns: [{ items: [{ label: 'B', href: '/b/' }] }] },
      ],
    },
    /both href and columns/,
  ],
  [
    'a column holding no link',
    { ...base, headerLinks: [{ label: 'A', columns: [{ title: 'T', items: [] }] }] },
    /holds no link/,
  ],
  [
    'a column titled with a number',
    {
      ...base,
      headerLinks: [{ label: 'A', columns: [{ title: 3, items: [{ label: 'B', href: '/b/' }] }] }],
    },
    /must be text/,
  ],
  [
    'a link of a column without a label',
    { ...base, headerLinks: [{ label: 'A', columns: [{ items: [{ href: '/b/' }] }] }] },
    /has no label/,
  ],

  // files and the fields added with the client file
  ['authors given as a text file', { ...base, authors: 'authors.txt' }, /\.json file/],
  ['copyCode written as a word', { ...base, copyCode: 'yes' }, /copyCode must be true or false/],
  ['copyCode written as a number', { ...base, copyCode: 1 }, /copyCode must be true or false/],
  ['llms written as a word', { ...base, llms: 'yes' }, /llms must be true or false/],
  ['snippetIcons given a number', { ...base, snippetIcons: 42 }, /name an icon collection/],
  [
    'snippetIcons given a path out of the collections',
    { ...base, snippetIcons: '../elsewhere' },
    /name an icon collection/,
  ],
];

describe('what the configuration refuses', () => {
  for (const [what, config, message] of REFUSALS) {
    it(`refuses ${what}, and says what to write instead`, () => {
      try {
        normalizeConfig(config);
        expect.unreachable('normalizeConfig should have thrown');
      } catch (error) {
        const failure = /** @type {ConfigError} */ (error);
        expect(failure).toBeInstanceOf(ConfigError);
        expect(failure.message).toMatch(message);
        expect(failure.hint?.length ?? 0).toBeGreaterThan(0);
      }
    });
  }
});

describe('what it accepts', () => {
  it('takes the two client fields when they are what they say', () => {
    // Refusals are only half of a field: its presence must still work.
    const config = normalizeConfig({ ...base, copyCode: true, snippetIcons: 'simple-icons' });
    expect(config.copyCode).toBe(true);
    expect(config.snippetIcons).toBe('simple-icons');
  });

  it('leaves both off when they are not written', () => {
    const config = normalizeConfig(base);
    expect(config.copyCode).toBe(false);
    expect(config.snippetIcons).toBe('');
  });

  it('hands a configuration back untouched through defineConfig', () => {
    // It exists for editors, which read its type; at run time it must be the
    // identity, or a project using it would build differently from one without.
    const config = { ...base };
    expect(defineConfig(config)).toBe(config);
  });
});
