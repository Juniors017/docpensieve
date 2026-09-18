/**
 * Builds the sidebar from the loaded documents.
 *
 * @module @docpensieve/core/sidebar
 */

import { ConfigError, humanizeSlug } from '@docpensieve/shared';

/**
 * @typedef {object} SidebarNode
 * @property {string} label   Displayed title.
 * @property {string | null} url Page URL, or `null` for a folder without an
 *   index page — the category is then a mere grouping.
 * @property {SidebarNode[]} items Child entries.
 */

/**
 * Builds the navigation tree of a version.
 *
 * The order is the `DocLoader`'s, which has already sorted: index page first,
 * then numeric prefixes, then alphabetical. Nothing is re-sorted here, which
 * guarantees that the sidebar follows the reading order of the files exactly.
 *
 * That order has a useful consequence: since `guide/index.md` is loaded
 * before `guide/installation.md`, the “guide” category receives its real
 * title before a child page creates it with a default one.
 *
 * @param {import('./loader.js').Doc[]} docs Documents in loader order.
 * @param {(doc: import('./loader.js').Doc) => string} [toUrl] Turns a
 *   document into a URL. By default, the document's URL as is.
 * @param {{ brand?: string }} [options] `brand` is the name shown in the
 *   header: a root entry carrying exactly that title is dropped, since the
 *   brand already leads to that page. The same word twice, an inch apart,
 *   tells the reader nothing.
 * @returns {SidebarNode[]}
 */
export function buildSidebar(docs, toUrl = (doc) => doc.url, options = {}) {
  /** @type {SidebarNode[]} */
  const root = [];
  /** @type {Map<string, SidebarNode>} */
  const byPath = new Map();

  for (const doc of docs) {
    const label = doc.frontmatter?.title;
    const segments = doc.slug ? doc.slug.split('/') : [];

    // The root page has no segment: it becomes a top-level entry rather than
    // the category that would hold everything else.
    if (segments.length === 0) {
      if (options.brand && label === options.brand) continue;
      root.push({ label: label ?? 'Home', url: toUrl(doc), items: [] });
      continue;
    }

    let level = root;
    let path = '';

    segments.forEach((segment, index) => {
      path = path ? `${path}/${segment}` : segment;

      let node = byPath.get(path);
      if (!node) {
        node = { label: humanizeSlug(segment), url: null, items: [] };
        byPath.set(path, node);
        level.push(node);
      }

      if (index === segments.length - 1) {
        if (label) node.label = label;
        node.url = toUrl(doc);
      }

      level = node.items;
    });
  }

  return root;
}

/**
 * Collects folder titles, for the breadcrumb.
 *
 * Only folders with an index page have a known title; the others will be
 * humanised from their slug by `StructuredDataBuilder`.
 *
 * @param {import('./loader.js').Doc[]} docs
 * @returns {Record<string, string>} Full folder slug to title.
 */
export function collectSectionTitles(docs) {
  /** @type {Record<string, string>} */
  const titles = {};

  for (const doc of docs) {
    const title = doc.frontmatter?.title;
    if (!doc.slug || !title) continue;

    // `guide/advanced/index.md` has the slug “guide/advanced”: that whole path
    // names the folder. Keyed by its last segment alone, two folders sharing a
    // name — `api/advanced` and `guide/advanced` — swapped their titles in the
    // breadcrumb, first come first served.
    if (titles[doc.slug] === undefined) titles[doc.slug] = String(title);
  }

  return titles;
}

/**
 * Prepares a menu whose categories fold, for the page being rendered.
 *
 * Two things change. Every category carries `open`, true along the branch
 * holding the current page: a long menu opens where the reader stands, and
 * stays closed everywhere else. And a category that is itself a page gains
 * that page as its first entry — folded, its title becomes the handle of the
 * fold, which cannot be a link as well without a click meaning two things.
 *
 * The tree is rebuilt rather than marked in place: it is shared by every page
 * of the version, and marking it would leave one page's branch open on all the
 * others.
 *
 * @typedef {object} FoldedNode
 * @property {string} label
 * @property {string | null} url
 * @property {FoldedNode[]} items
 * @property {boolean} [open] Whether the category starts open. Absent on a
 *   plain entry, which has nothing to fold.
 */

/**
 * @param {SidebarNode[]} nodes
 * @param {string} [currentUrl] URL of the page being rendered.
 * @returns {FoldedNode[]}
 */
export function foldSidebar(nodes, currentUrl = '') {
  return nodes.map((node) => {
    if (node.items.length === 0) return { ...node };

    const items = foldSidebar(
      node.url ? [{ label: node.label, url: node.url, items: [] }, ...node.items] : node.items,
      currentUrl,
    );

    // Open when the reader is inside: on the category's own page, or on any
    // page it holds, however deep.
    return { ...node, items, open: node.url === currentUrl || holds(items, currentUrl) };
  });
}

/**
 * Whether a branch holds the current page.
 *
 * @param {FoldedNode[]} nodes
 * @param {string} currentUrl
 * @returns {boolean}
 */
function holds(nodes, currentUrl) {
  return nodes.some((node) => node.url === currentUrl || holds(node.items, currentUrl));
}

/**
 * An entry of a sidebar description: a page path, or an object — see
 * `buildSidebarFromDescription`.
 *
 * @typedef {string | {
 *   page?: string, label?: string, items?: SidebarEntry[], href?: string, auto?: string,
 * }} SidebarEntry
 */

/** The kinds of entry, for the hints. */
const ENTRY_KINDS =
  'Entries: "guide/installation", { "page", "label" }, { "label", "items", "page" }, ' +
  '{ "label", "href" } or { "auto": "folder" }.';

/**
 * @param {string} value
 * @returns {string} The value without its leading and trailing slashes.
 */
function trimSlashes(value) {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '/') start += 1;
  while (end > start && value[end - 1] === '/') end -= 1;
  return value.slice(start, end);
}

/**
 * Builds the navigation tree of a version from a description.
 *
 * The description is an array of entries, kept in the order written:
 *
 * - `"guide/installation"` — a page, by its path within the version, as in
 *   its URL; `"/"` is the home page. Its title becomes the label.
 * - `{ "page": "guide/installation", "label": "Install" }` — the same, with a
 *   label of its own.
 * - `{ "label": "Guide", "items": [ … ], "page": "guide" }` — a category,
 *   clickable when it names a page.
 * - `{ "label": "Repository", "href": "https://…" }` — a link outside the site.
 * - `{ "auto": "docpensieve" }` — the automatic tree of a folder: a section
 *   keeps its own menu without listing its pages one by one.
 *
 * A page left out stays published: it is only absent from the menu, which is
 * how a page is kept off it.
 *
 * @param {unknown} description Parsed content of the description file.
 * @param {import('./loader.js').Doc[]} docs Documents of the version.
 * @param {(doc: import('./loader.js').Doc) => string} [toUrl] As for
 *   `buildSidebar`.
 * @param {{ source?: string }} [options] `source` names the file in messages.
 * @returns {SidebarNode[]}
 * @throws {ConfigError} For a path that names no page, a page listed twice,
 *   or an entry of no known kind.
 */
export function buildSidebarFromDescription(
  description,
  docs,
  toUrl = (doc) => doc.url,
  options = {},
) {
  const source = options.source ?? 'The sidebar description';
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  /** @type {Set<string>} */
  const listed = new Set();

  /** @param {string} message @param {string} hint */
  const fail = (message, hint) => new ConfigError(`${source}: ${message}`, { hint });

  /** @param {string} slug @returns {string} Up to five known paths near it. */
  const nearby = (slug) => {
    const known = [...bySlug.keys()];
    const first = slug.split('/')[0];
    const close = known.filter((candidate) => candidate.split('/')[0] === first);
    return (close.length > 0 ? close : known)
      .slice(0, 5)
      .map((candidate) => `"${candidate || '/'}"`)
      .join(', ');
  };

  /** @param {string} slug */
  const claim = (slug) => {
    // The menu marks a single entry as the current page: listed twice, a page
    // would light up in two places, or in the wrong one.
    if (listed.has(slug)) {
      throw fail(`the page "${slug || '/'}" is listed twice.`, 'List each page once.');
    }
    listed.add(slug);
  };

  /** @param {unknown} raw @returns {import('./loader.js').Doc} */
  const pageOf = (raw) => {
    const slug = trimSlashes(String(raw));
    const doc = bySlug.get(slug);
    if (!doc) {
      throw fail(
        `no page "${String(raw)}".`,
        `A page is named by its path within the version, as in its URL. Close to it: ${nearby(slug)}.`,
      );
    }
    claim(slug);
    return doc;
  };

  /** @param {import('./loader.js').Doc} doc @returns {string} */
  const titleOf = (doc) =>
    String(
      doc.frontmatter?.title ?? (doc.slug ? humanizeSlug(doc.slug.split('/').pop() ?? '') : 'Home'),
    );

  /** @param {unknown} entry @returns {SidebarNode[]} */
  const expand = (entry) => {
    if (typeof entry === 'string') {
      const doc = pageOf(entry);
      return [{ label: titleOf(doc), url: toUrl(doc), items: [] }];
    }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw fail(
        `an entry must be a page path or an object: ${JSON.stringify(entry)}.`,
        ENTRY_KINDS,
      );
    }

    const item = /** @type {Record<string, unknown>} */ (entry);
    const label = typeof item.label === 'string' && item.label ? item.label : undefined;

    if (item.href !== undefined) {
      if (!label || typeof item.href !== 'string') {
        throw fail(`a link needs a label and an href: ${JSON.stringify(entry)}.`, ENTRY_KINDS);
      }
      return [{ label, url: item.href, items: [] }];
    }

    if (item.auto !== undefined) {
      const folder = trimSlashes(String(item.auto));
      const inside = docs.filter(
        (doc) => !folder || doc.slug === folder || doc.slug.startsWith(`${folder}/`),
      );
      if (inside.length === 0) {
        throw fail(
          `the folder "${String(item.auto)}" holds no page.`,
          `Name a folder of the version, as in its URLs. Close to it: ${nearby(folder)}.`,
        );
      }
      for (const doc of inside) claim(doc.slug);

      const tree = buildSidebar(inside, toUrl);
      if (!folder) return tree;
      // The tree starts at the version's root, one node per level down to the
      // folder, since every page shares its path.
      let [node] = tree;
      for (let depth = 1; depth < folder.split('/').length; depth += 1) [node] = node.items;
      return [{ ...node, label: label ?? node.label }];
    }

    if (item.items !== undefined) {
      if (!label || !Array.isArray(item.items)) {
        throw fail(
          `a category needs a label and a list of items: ${JSON.stringify(entry)}.`,
          ENTRY_KINDS,
        );
      }
      const url = item.page !== undefined ? toUrl(pageOf(item.page)) : null;
      return [{ label, url, items: item.items.flatMap(expand) }];
    }

    if (item.page !== undefined) {
      const doc = pageOf(item.page);
      return [{ label: label ?? titleOf(doc), url: toUrl(doc), items: [] }];
    }

    throw fail(
      `${JSON.stringify(entry)} is neither a page, a category, a link nor an automatic folder.`,
      ENTRY_KINDS,
    );
  };

  if (!Array.isArray(description)) {
    throw fail('it must hold an array of entries.', ENTRY_KINDS);
  }
  return description.flatMap(expand);
}
