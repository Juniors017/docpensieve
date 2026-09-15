/// <reference lib="dom" />
/**
 * Search, in the reader's browser: the one script a DocPensieve site loads,
 * and only on its search page.
 *
 * The build does the heavy work. It writes an index of each version, and a
 * search page that already lists every page. This script only reads the
 * query, filters that list against the index and shows an excerpt. Without
 * it, the page stays the full list: search adds to the site, nothing depends
 * on it.
 *
 * The functions below are exported so that the ranking can be tested outside
 * a browser; the page wiring only runs where there is a document. The DOM
 * types are referenced here, the only file that needs them.
 */

/**
 * A page of the index, as the build writes it.
 *
 * @typedef {object} IndexEntry
 * @property {string} title
 * @property {string} url
 * @property {string} description
 * @property {string} text Plain text of the page.
 */

/**
 * Lowercases and strips accents, so that "ete" finds "été".
 *
 * An accented letter written as one character stays one character: the
 * normalised text keeps the offsets of the original, which the excerpt
 * relies on.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * @param {string} query
 * @returns {string[]} The distinct words of the query.
 */
export function tokenize(query) {
  return [
    ...new Set(
      normalize(query)
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean),
    ),
  ];
}

/**
 * The pages that hold every word of the query, best first.
 *
 * A word in the title weighs more than one in the description, which weighs
 * more than one in the text; repetitions in the text count up to five, so
 * that a long page does not win by length alone.
 *
 * @param {IndexEntry[]} entries
 * @param {string} query
 * @returns {IndexEntry[]}
 */
export function rank(entries, query) {
  const words = tokenize(query);
  if (words.length === 0) return [];

  /** @type {{ entry: IndexEntry, score: number }[]} */
  const scored = [];
  for (const entry of entries) {
    const title = normalize(entry.title);
    const description = normalize(entry.description);
    const text = normalize(entry.text);

    let score = 0;
    let everyWord = true;
    for (const word of words) {
      const inTitle = title.includes(word);
      const inDescription = description.includes(word);
      const inText = text.split(word).length - 1;
      if (!inTitle && !inDescription && inText === 0) {
        everyWord = false;
        break;
      }
      score += (inTitle ? 10 : 0) + (inDescription ? 3 : 0) + Math.min(inText, 5);
    }
    if (everyWord) scored.push({ entry, score });
  }

  return scored.sort((a, b) => b.score - a.score).map((item) => item.entry);
}

/**
 * The passage of a text around the first word of the query found in it.
 *
 * @param {string} text
 * @param {string} query
 * @param {number} [radius] Characters kept on each side.
 * @returns {{ before: string, match: string, after: string } | null}
 */
export function excerpt(text, query, radius = 80) {
  const normalized = normalize(text);
  for (const word of tokenize(query)) {
    const at = normalized.indexOf(word);
    if (at < 0) continue;
    const start = Math.max(0, at - radius);
    const end = Math.min(text.length, at + word.length + radius);
    return {
      before: (start > 0 ? '…' : '') + text.slice(start, at),
      match: text.slice(at, at + word.length),
      after: text.slice(at + word.length, end) + (end < text.length ? '…' : ''),
    };
  }
  return null;
}

/** Wires the search page: reads the query, filters the list, shows excerpts. */
async function init() {
  const form = /** @type {HTMLFormElement | null} */ (
    document.querySelector('form[data-search-page]')
  );
  const input = /** @type {HTMLInputElement | null | undefined} */ (
    form?.querySelector('input[name="q"]')
  );
  const list = /** @type {HTMLElement | null} */ (document.querySelector('[data-search-results]'));
  const status = /** @type {HTMLElement | null} */ (document.querySelector('[data-search-status]'));
  if (!form || !input || !list || !status) return;

  /** @type {Map<string, HTMLElement>} */
  const items = new Map();
  const listed = /** @type {NodeListOf<HTMLElement>} */ (list.querySelectorAll('li[data-url]'));
  for (const item of listed) items.set(item.dataset.url ?? '', item);

  /** @type {IndexEntry[]} */
  let entries;
  try {
    const response = await fetch(form.dataset.index ?? '');
    entries = await response.json();
  } catch {
    status.textContent = 'The search index could not be loaded: every page is listed below.';
    return;
  }

  /** @param {HTMLElement} item */
  const reset = (item) => {
    item.hidden = false;
    item.querySelector('.dp-search-excerpt')?.remove();
  };

  const show = () => {
    const query = input.value.trim();

    // Without a query, the page is the full list it was without the script.
    if (!query) {
      for (const item of items.values()) {
        reset(item);
        list.append(item);
      }
      status.textContent = `${items.size} pages.`;
      return;
    }

    const found = rank(entries, query);
    for (const item of items.values()) item.hidden = true;
    for (const entry of found) {
      const item = items.get(entry.url);
      if (!item) continue;
      reset(item);
      const passage = excerpt(entry.text, query);
      if (passage) {
        const paragraph = document.createElement('p');
        paragraph.className = 'dp-search-excerpt';
        const mark = document.createElement('mark');
        mark.textContent = passage.match;
        paragraph.append(passage.before, mark, passage.after);
        item.append(paragraph);
      }
      // Appending moves the item: the list ends up best first.
      list.append(item);
    }

    status.textContent =
      found.length === 0
        ? `No page matches “${query}”.`
        : `${found.length} ${found.length === 1 ? 'page' : 'pages'} for “${query}”.`;
  };

  input.value = new URLSearchParams(location.search).get('q') ?? '';
  input.addEventListener('input', show);
  // Searching again needs no reload, and the address follows the query, so
  // that a search can be shared.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    history.replaceState(null, '', `?q=${encodeURIComponent(input.value.trim())}`);
    show();
  });
  show();
}

if (typeof document !== 'undefined') init();
