/**
 * What the build prepares for search: the index of a version, and its search
 * page.
 *
 * Search is built here, not in the reader's browser: the index holds the
 * plain text of every page, and the search page already lists every page,
 * so that it is useful before any script runs — and without one.
 *
 * @module @docpensieve/core/search-index
 */

import { UI_STRINGS, pageCount } from '@docpensieve/shared';

/** Path of the search page within a version. */
export const SEARCH_SLUG = 'search';

/** @type {Record<string, string>} */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * Turns rendered HTML into the plain text a reader sees.
 *
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  return html
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
      if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? entity;
      const code =
        name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escapes a value for HTML.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Renders the content of the search page: a field, and the list of every
 * page of the version, which the script filters.
 *
 * @param {{ title: string, url: string, description: string }[]} entries
 *   Pages of the version, in reading order.
 * @param {string} indexUrl URL of the version's index.
 * @param {import('@docpensieve/shared').UiStrings} [strings] Wording of the page.
 * @param {string} [lang] Language, which decides the plural of a count.
 * @returns {string}
 */
export function searchPageContent(entries, indexUrl, strings = UI_STRINGS.en, lang = 'en') {
  const items = entries.map((entry) => {
    const description = entry.description ? `<p>${escapeHtml(entry.description)}</p>` : '';
    return `<li data-url="${escapeHtml(entry.url)}"><a href="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</a>${description}</li>`;
  });

  return [
    `<h1 id="search">${escapeHtml(strings.searchTitle)}</h1>`,
    // The script is copied as it is, so its wording travels with the page
    // rather than inside the file: one script, every language.
    `<form class="dp-search-page" role="search" data-search-page data-index="${escapeHtml(indexUrl)}" data-strings="${escapeHtml(
      JSON.stringify({
        lang,
        failed: strings.searchIndexFailed,
        pages: strings.pages,
        noResultFor: strings.noResultFor,
        resultsFor: strings.resultsFor,
      }),
    )}">`,
    `<label for="dp-search-query">${escapeHtml(strings.searchTheDocumentation)}</label>`,
    '<input id="dp-search-query" type="search" name="q" autocomplete="off" />',
    '</form>',
    `<p class="dp-search-status" data-search-status aria-live="polite">${escapeHtml(pageCount(entries.length, strings, lang))}.</p>`,
    `<ol class="dp-search-results" data-search-results>${items.join('')}</ol>`,
  ].join('');
}
