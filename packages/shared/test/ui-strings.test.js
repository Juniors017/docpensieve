import { describe, expect, it } from 'vitest';

import { DEFAULT_LANGUAGE, UI_STRINGS, pageCount, uiStrings } from '../src/ui-strings.js';

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

  it('counts one page in the singular', () => {
    expect(pageCount(1, uiStrings('en'))).toBe('1 page');
    expect(pageCount(12, uiStrings('en'))).toBe('12 pages');
    expect(pageCount(1, uiStrings('fr'))).toBe('1 page');
  });

  it('names the locale a date is written in', () => {
    expect(uiStrings('fr').dateLocale).toBe('fr-FR');
    expect(uiStrings('en').dateLocale).toBe('en-GB');
  });
});
