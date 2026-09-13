/**
 * Slug and URL generation from file paths.
 * @module @docpensieve/shared/slug
 */

import { INDEX_SLUGS } from './constants.js';

/** Numeric ordering prefix: `01-`, `02_`, `10.` */
const ORDER_PREFIX = /^\d+[-_.]/;

/**
 * Turns free text into a URL-safe slug.
 *
 * Accents are decomposed then dropped (`Crème` → `creme`), which keeps URLs
 * readable instead of percent-encoded.
 *
 * @param {string} input
 * @returns {string} Lowercase slug, dash-separated.
 */
export function slugify(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Converts a file path, relative to the version folder, into a page slug.
 *
 * Ordering prefixes are removed from every segment: they sort the sidebar,
 * they do not build the URL.
 *
 * @example
 * filePathToSlug('guide/01-install.md')  // 'guide/install'
 * filePathToSlug('intro.mdx')            // 'intro'
 * filePathToSlug('guide/index.md')       // 'guide'
 * filePathToSlug('index.md')             // ''
 *
 * @param {string} relativePath Path relative to the version folder.
 * @returns {string} Slug with no leading or trailing slash.
 */
export function filePathToSlug(relativePath) {
  const withoutExt = String(relativePath).replace(/\.mdx?$/i, '');
  const segments = withoutExt
    .split(/[/\\]/)
    .filter(Boolean)
    .map((segment) => slugify(segment.replace(ORDER_PREFIX, '')));

  const last = segments.at(-1);
  if (last !== undefined && INDEX_SLUGS.includes(last)) {
    segments.pop();
  }

  return segments.filter(Boolean).join('/');
}

/**
 * Maps an asset path into URL space.
 *
 * Folders follow the page rule — ordering prefix removed, segment slugified —
 * so that `02-guide/diagram.png` lands under `/guide/`, where the pages of the
 * same folder expect it. Otherwise the sorting prefix, which never shows in a
 * page URL, would show in the URL of its images.
 *
 * The file name itself stays untouched: it is the one the author writes in
 * their Markdown, and rewriting it would break the reference.
 *
 * @example
 * assetPathToSlug('02-guide/diagram.png')  // 'guide/diagram.png'
 * assetPathToSlug('My Notes/a.png')        // 'my-notes/a.png'
 *
 * @param {string} relativePath Path relative to the version folder.
 * @returns {string} Output path, slash-separated.
 */
export function assetPathToSlug(relativePath) {
  const segments = String(relativePath).split(/[/\\]/).filter(Boolean);

  const file = segments.pop();
  const folders = segments.map((segment) => slugify(segment.replace(ORDER_PREFIX, '')));

  return [...folders, file].filter(Boolean).join('/');
}

/**
 * Segments of a path that leave nothing behind once slugified.
 *
 * `slugify` only keeps Latin letters and digits: a name made entirely of
 * ideograms, or of punctuation, vanishes. For a page, that meant taking the
 * home page's URL; for a folder, disappearing from the address.
 *
 * @example
 * blankSegments('guide/日本語.md')   // ['日本語']
 * blankSegments('02-guide/page.md')  // []
 *
 * @param {string} relativePath Path relative to the version folder.
 * @returns {string[]} The offending segments, extension removed.
 */
export function blankSegments(relativePath) {
  return String(relativePath)
    .replace(/\.mdx?$/i, '')
    .split(/[/\\]/)
    .filter(Boolean)
    .filter((segment) => slugify(segment.replace(ORDER_PREFIX, '')) === '');
}

/**
 * Maps a **folder** path into URL space.
 *
 * Sibling of `assetPathToSlug`, but with no file name to spare: every segment
 * goes through the page rule. Applying `assetPathToSlug` to a folder left its
 * last segment untouched — `02-guide` stayed `02-guide` — and every relative
 * target of a page in that folder missed the file actually copied.
 *
 * @example
 * dirPathToSlug('02-guide/03-sub')  // 'guide/sub'
 * dirPathToSlug('My Notes')         // 'my-notes'
 * dirPathToSlug('')                 // ''
 *
 * @param {string} relativePath Path relative to the version folder.
 * @returns {string} Output path, slash-separated.
 */
export function dirPathToSlug(relativePath) {
  return String(relativePath)
    .split(/[/\\]/)
    .filter(Boolean)
    .map((segment) => slugify(segment.replace(ORDER_PREFIX, '')))
    .filter(Boolean)
    .join('/');
}

/**
 * Converts a page slug into an absolute site URL (trailing slash included).
 *
 * @example
 * slugToUrl('guide/install')  // '/guide/install/'
 * slugToUrl('')               // '/'
 * slugToUrl('intro', 'v1.0')  // '/versions/v1.0/intro/'
 *
 * @param {string} slug Slug produced by {@link filePathToSlug}.
 * @param {string} [versionSlug] When given, prefixes `/versions/<version>`.
 * @returns {string} URL starting and ending with `/`.
 */
export function slugToUrl(slug, versionSlug) {
  const parts = [];
  if (versionSlug) parts.push('versions', versionSlug);
  if (slug) parts.push(...slug.split('/').filter(Boolean));
  return parts.length ? `/${parts.join('/')}/` : '/';
}

/**
 * Turns a slug segment back into a readable label.
 *
 * A deliberate, imperfect fallback: since `slugify` dropped the accents,
 * `creme-brulee` comes back as “Creme brulee”. Only use it when there is no
 * real title — the sidebar and the breadcrumb prefer the frontmatter title.
 *
 * @example
 * humanizeSlug('getting-started')  // 'Getting started'
 *
 * @param {string} segment
 * @returns {string}
 */
export function humanizeSlug(segment) {
  const words = String(segment).replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Reads the ordering weight of a prefixed file name.
 *
 * @example
 * orderOf('01-install.md')  // 1
 * orderOf('install.md')     // Infinity
 *
 * @param {string} filename
 * @returns {number} The prefix number, or `Infinity` when absent (sorted last).
 */
export function orderOf(filename) {
  const match = String(filename).match(/^(\d+)[-_.]/);
  return match ? Number(match[1]) : Infinity;
}
