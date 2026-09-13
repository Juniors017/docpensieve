/**
 * Builds the sidebar from the loaded documents.
 *
 * @module @docpensieve/core/sidebar
 */

import { humanizeSlug } from '@docpensieve/shared';

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
