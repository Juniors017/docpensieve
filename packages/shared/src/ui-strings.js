/**
 * Wording of the page shell, by language.
 *
 * The pages are written by the project; these are the words the tool adds
 * around them — the menu, the notices, the search field. Left in English on a
 * French site, they would announce the language of the shell rather than the
 * language of the documentation.
 *
 * A language the tool does not ship keeps the English wording: that is what
 * `lang` did before this table existed, and a project already running
 * `lang: 'de'` must not stop building because of it. Its own wording goes in
 * the `ui` field of the configuration.
 *
 * @module @docpensieve/shared/ui-strings
 */

/**
 * @typedef {object} UiStrings
 * @property {string} skipToContent Link to the content, first in the tab order.
 * @property {string} site Accessible name of the header navigation.
 * @property {string} menu Accessible name of the narrow-screen menu button.
 * @property {string} switchScheme Accessible name of the light/dark button.
 * @property {string} switchVersion Completes the accessible name of the version switcher.
 * @property {string} versionLabel The word before a version number, mid-sentence.
 * @property {string} versionSwitch The same word opening a label, where a capital is due.
 * @property {string} documentationMenu Handle of the folded menu, on a narrow screen.
 * @property {string} documentationNavigation Accessible name of the menu.
 * @property {string} onThisPage Heading of the table of contents.
 * @property {string} tags Accessible name of the tag list.
 * @property {string} backToTop Accessible name of the back-to-top link.
 * @property {string} search Placeholder of the header field.
 * @property {string} searchTitle Heading of the search page.
 * @property {string} searchTheDocumentation Label of the search fields.
 * @property {Record<string, string>} pages Counting results, by plural
 *   category of the language (CLDR): `one`, `other`, and `few`, `many`,
 *   `two`, `zero` where the language has them.
 * @property {string} searchIndexFailed Shown when the index cannot be loaded.
 * @property {string} noResultFor Shown when a query matches nothing. `{query}` is the query.
 * @property {string} resultsFor Counts the matches. `{count}` reads `3 pages`, `{query}` is the query.
 * @property {string} prereleaseNotice Banner of a version in preparation.
 * @property {string} archivedNotice Banner of a version no longer maintained.
 * @property {string} currentVersionIs Introduces the link to the current version.
 * @property {string} written Byline prefix for the publication date.
 * @property {string} updated Byline prefix for the modification date.
 * @property {string} language Accessible name of the language switcher.
 * @property {string} dateLocale Locale used to write a date in full.
 */

/**
 * The shipped languages.
 *
 * @type {Record<string, UiStrings>}
 */
export const UI_STRINGS = Object.freeze({
  en: Object.freeze({
    skipToContent: 'Skip to content',
    site: 'Site',
    menu: 'Menu',
    switchScheme: 'Switch the colour scheme',
    switchVersion: 'switch version',
    versionLabel: 'version',
    versionSwitch: 'Version',
    documentationMenu: 'Documentation menu',
    documentationNavigation: 'Documentation navigation',
    onThisPage: 'On this page',
    tags: 'Tags',
    backToTop: 'Back to top',
    search: 'Search',
    searchTitle: 'Search',
    searchTheDocumentation: 'Search the documentation',
    pages: { one: 'page', other: 'pages' },
    searchIndexFailed: 'The search index could not be loaded: every page is listed below.',
    noResultFor: 'No page matches “{query}”.',
    resultsFor: '{count} for “{query}”.',
    prereleaseNotice: 'This version is in preparation and may change.',
    archivedNotice: 'This version is no longer maintained.',
    currentVersionIs: 'The current version is',
    written: 'Written',
    updated: 'Updated',
    language: 'Language',
    dateLocale: 'en-GB',
  }),
  fr: Object.freeze({
    skipToContent: 'Aller au contenu',
    site: 'Site',
    menu: 'Menu',
    switchScheme: 'Basculer entre clair et sombre',
    switchVersion: 'changer de version',
    versionLabel: 'version',
    versionSwitch: 'Version',
    documentationMenu: 'Menu de la documentation',
    documentationNavigation: 'Navigation de la documentation',
    onThisPage: 'Sur cette page',
    tags: 'Étiquettes',
    backToTop: 'Retour en haut',
    search: 'Rechercher',
    searchTitle: 'Recherche',
    searchTheDocumentation: 'Rechercher dans la documentation',
    pages: { one: 'page', other: 'pages' },
    searchIndexFailed:
      "L'index de recherche n'a pas pu être chargé : toutes les pages sont listées ci-dessous.",
    noResultFor: 'Aucune page ne correspond à « {query} ».',
    resultsFor: '{count} pour « {query} ».',
    prereleaseNotice: 'Cette version est en préparation et peut encore changer.',
    archivedNotice: "Cette version n'est plus maintenue.",
    currentVersionIs: 'La version actuelle est',
    written: 'Écrit',
    updated: 'Mis à jour',
    language: 'Langue',
    dateLocale: 'fr-FR',
  }),
});

/** Language used when nothing else is known. */
export const DEFAULT_LANGUAGE = 'en';

/**
 * The wording of a language, completed by English for anything it omits.
 *
 * @param {string} [lang] Language code, `fr` or `fr-CA`.
 * @param {Record<string, Partial<UiStrings>>} [overrides] Wording declared by the project.
 * @returns {UiStrings}
 */
export function uiStrings(lang, overrides) {
  // `fr-CA` reads the wording of `fr`: a regional variant shares its language,
  // and asking a project to declare each one would serve nobody.
  const code = (lang ?? DEFAULT_LANGUAGE).toLowerCase();
  const base = UI_STRINGS[code] ?? UI_STRINGS[code.split('-')[0]] ?? UI_STRINGS[DEFAULT_LANGUAGE];
  const own = overrides?.[code] ?? overrides?.[code.split('-')[0]];

  // English fills the gaps: a project translating half the wording gets the
  // other half in a language, never an empty label.
  return own ? { ...UI_STRINGS[DEFAULT_LANGUAGE], ...base, ...own } : base;
}

/**
 * Counts pages in the language of the page.
 *
 * The plural category comes from the language itself, through the CLDR rules
 * `Intl` carries: `count === 1` is an English rule and gets French wrong on
 * zero — "0 page", not "0 pages" — and has nothing to say about Polish or
 * Arabic, which have four and six categories.
 *
 * @param {number} count
 * @param {UiStrings} strings
 * @param {string} [lang] Language of the page.
 * @returns {string} For instance `12 pages` or `1 page`.
 */
export function pageCount(count, strings, lang = DEFAULT_LANGUAGE) {
  const category = new Intl.PluralRules(lang).select(count);
  // `other` is the one category every language has: it answers for the ones a
  // translation did not fill in.
  return `${count} ${strings.pages[category] ?? strings.pages.other}`;
}

/**
 * Writing direction of a language, for the `dir` attribute.
 *
 * Read from the language rather than from a list of our own: `Intl` carries
 * what CLDR knows, and a list would go stale the day someone translates into
 * a language nobody thought of.
 *
 * @param {string} [lang]
 * @returns {'ltr' | 'rtl'} `ltr` when the language is unknown — the safe
 *   default, and what every page did before this existed.
 */
export function textDirection(lang) {
  try {
    // The Locale Info API is not in the TypeScript library yet, though Node
    // carries it: the cast says what the runtime actually returns.
    const locale = /** @type {{ textInfo?: { direction?: string } }} */ (
      /** @type {unknown} */ (new Intl.Locale(lang ?? DEFAULT_LANGUAGE))
    );
    return locale.textInfo?.direction === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}
