import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  UI_STRINGS,
  isLanguageCode,
  languageName,
  pageCount,
  textDirection,
  uiStrings,
} from '../src/ui-strings.js';

describe('the wording of the shell', () => {
  it('ships the same keys in every language', () => {
    // A key missing from one language would render an empty label there, and
    // nothing would report it: the page still builds.
    const reference = Object.keys(UI_STRINGS[DEFAULT_LANGUAGE]).sort();
    for (const [lang, strings] of Object.entries(UI_STRINGS)) {
      expect(Object.keys(strings).sort(), lang).toEqual(reference);
    }
  });

  it('answers in the language asked for', () => {
    expect(uiStrings('fr').onThisPage).toBe('Sur cette page');
    expect(uiStrings('en').onThisPage).toBe('On this page');
  });

  it('reads a regional variant as its language', () => {
    expect(uiStrings('fr-CA').onThisPage).toBe('Sur cette page');
    expect(uiStrings('EN-GB').search).toBe('Search');
  });

  it('keeps English for a language it does not ship', () => {
    // What `lang: 'de'` did before this table existed. Refusing it now would
    // stop projects that build today.
    expect(uiStrings('de')).toBe(UI_STRINGS.en);
    expect(uiStrings(undefined).onThisPage).toBe('On this page');
  });

  it('takes the wording a project declares, and fills the rest', () => {
    const strings = uiStrings('de', { de: { onThisPage: 'Auf dieser Seite' } });

    expect(strings.onThisPage).toBe('Auf dieser Seite');
    // Half a translation is still half a page: the rest stays readable.
    expect(strings.search).toBe('Search');
  });

  it('lets a project correct a language it ships', () => {
    expect(uiStrings('fr', { fr: { search: 'Chercher' } }).search).toBe('Chercher');
    expect(uiStrings('fr', { fr: { search: 'Chercher' } }).onThisPage).toBe('Sur cette page');
  });

  it('counts in the plural rules of the language, not in English ones', () => {
    // CLDR, through Intl: French puts zero in the singular, and a language
    // with four categories cannot be served by a pair of words.
    expect(pageCount(1, uiStrings('en'), 'en')).toBe('1 page');
    expect(pageCount(12, uiStrings('en'), 'en')).toBe('12 pages');
    expect(pageCount(0, uiStrings('en'), 'en')).toBe('0 pages');

    expect(pageCount(1, uiStrings('fr'), 'fr')).toBe('1 page');
    expect(pageCount(0, uiStrings('fr'), 'fr')).toBe('0 page');
    expect(pageCount(12, uiStrings('fr'), 'fr')).toBe('12 pages');
  });

  it('falls back on the category every language has', () => {
    // A translation that fills only the `other` category still reads.
    const sparse = uiStrings('pl', { pl: { pages: { other: 'stron' } } });

    expect(pageCount(5, sparse, 'pl')).toBe('5 stron');
  });

  it('reads the writing direction from the language', () => {
    expect(textDirection('fr')).toBe('ltr');
    expect(textDirection('ar')).toBe('rtl');
    expect(textDirection('he')).toBe('rtl');
    // An unknown tag must not break a build: left to right is what every
    // page did before this existed.
    expect(textDirection('not a language')).toBe('ltr');
    expect(textDirection(undefined)).toBe('ltr');
  });

  it('names the locale a date is written in', () => {
    expect(uiStrings('fr').dateLocale).toBe('fr-FR');
    expect(uiStrings('en').dateLocale).toBe('en-GB');
  });
});

describe('what names a language', () => {
  it('accepts the tags BCP 47 accepts', () => {
    // A regex of our own refused "zh-Hans-CN", which is valid.
    expect(isLanguageCode('fr')).toBe(true);
    expect(isLanguageCode('pt-BR')).toBe(true);
    expect(isLanguageCode('zh-Hans-CN')).toBe(true);
  });

  it('refuses a tag that names no language', () => {
    // Well formed is not the same as real: BCP 47 allows a subtag of five to
    // eight letters, so "francais" is well formed and would land in the
    // markup as lang="francais", which no browser maps to a language.
    expect(isLanguageCode('francais')).toBe(false);
    expect(isLanguageCode('zz')).toBe(false);
    expect(isLanguageCode('')).toBe(false);
    expect(isLanguageCode('a b')).toBe(false);
  });

  it('names a language, in the language asked for', () => {
    expect(languageName('fr')).toBe('French');
    expect(languageName('fr', 'fr')).toBe('français');
  });

  it('gives the code back when nothing names it', () => {
    // Used in a message to the user: a throw here would turn a helpful line
    // into a failed command.
    expect(languageName('zz')).toBe('zz');
    expect(languageName('')).toBe('');
  });
});
