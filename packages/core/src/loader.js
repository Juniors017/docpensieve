/**
 * Loads the Markdown/MDX sources of a version.
 *
 * @module @docpensieve/core/loader
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import {
  blankSegments,
  DOC_EXTENSIONS,
  INDEX_SLUGS,
  LoaderError,
  filePathToSlug,
  orderOf,
  slugToUrl,
} from '@docpensieve/shared';
import matter from 'gray-matter';

/** Folders never walked, whatever they contain. */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'coverage']);

/**
 * @typedef {object} Doc
 * @property {string} slug        Page slug (`'guide/install'`).
 * @property {string} path        Absolute path of the source file.
 * @property {string} url         Site URL (`'/guide/install/'`).
 * @property {Record<string, any>} frontmatter Frontmatter parsed by gray-matter.
 * @property {string} content     Raw Markdown/MDX body, frontmatter removed.
 * @property {number} order       Ordering weight for the sidebar.
 */

/**
 * Compares two entries of the same folder for reading order.
 *
 * Three rules, in this order: the folder's index page comes first, then the
 * numeric prefix (`01-`, `02-`), then alphabetical order.
 *
 * @param {import('node:fs').Dirent} a
 * @param {import('node:fs').Dirent} b
 * @returns {number}
 */
function compareEntries(a, b) {
  const indexDelta = Number(isIndexEntry(b)) - Number(isIndexEntry(a));
  if (indexDelta !== 0) return indexDelta;

  const orderA = orderOf(a.name);
  const orderB = orderOf(b.name);
  // `orderOf` returns Infinity without a prefix: a subtraction would give NaN
  // for two unprefixed files, which silently breaks the sort.
  if (orderA !== orderB) return orderA - orderB;

  return a.name.localeCompare(b.name, 'en');
}

/**
 * Is an entry the index page of its folder (`index.md`, `readme.mdx`)?
 *
 * @param {import('node:fs').Dirent} entry
 * @returns {boolean}
 */
function isIndexEntry(entry) {
  if (entry.isDirectory()) return false;
  const base = path.basename(entry.name, path.extname(entry.name)).toLowerCase();
  return INDEX_SLUGS.includes(base);
}

/** Walks a version folder and produces the list of documents. */
export class DocLoader {
  /**
   * @param {{ extensions?: string[], includeDrafts?: boolean }} [options]
   *   `extensions` replaces the default list (`.md`, `.mdx`);
   *   `includeDrafts` keeps the pages marked `draft: true`.
   */
  constructor(options = {}) {
    this.options = options;
    this.extensions = (options.extensions ?? DOC_EXTENSIONS).map((ext) => ext.toLowerCase());
    this.includeDrafts = options.includeDrafts ?? false;
  }

  /**
   * Recursively loads every document of a folder.
   *
   * Documents come back in the site's reading order: at each level, the index
   * page first, then numeric prefixes, then alphabetical. That is the order
   * the sidebar needs, hence sorting during the walk rather than a flat sort
   * of the result.
   *
   * The URLs produced carry no version prefix: the loader does not know which
   * version it works on, the generator adds it.
   *
   * @param {string} dir Version folder (e.g. `docs/v1.0`).
   * @returns {Promise<Doc[]>}
   * @throws {LoaderError} Missing folder, invalid frontmatter, colliding slugs.
   */
  async load(dir) {
    const root = path.resolve(dir);

    let stats;
    try {
      stats = await stat(root);
    } catch (cause) {
      throw new LoaderError(`Documentation folder not found: ${root}.`, {
        cause,
        hint: 'Check the "folder" field of the version in the configuration file.',
      });
    }
    if (!stats.isDirectory()) {
      throw new LoaderError(`${root} is not a folder.`, {
        hint: 'The "folder" field must point to a folder, not a file.',
      });
    }

    const files = await this.#collect(root);
    const docs = await Promise.all(files.map((file) => this.#read(root, file)));

    // Filtering comes before collision detection: a draft left out of the
    // build conflicts with nothing.
    const kept = this.includeDrafts ? docs : docs.filter((doc) => doc.frontmatter.draft !== true);
    this.#assertNoSlugCollision(kept);
    return kept;
  }

  /**
   * Lists the documentation files, depth first, already sorted.
   *
   * @param {string} dir
   * @returns {Promise<string[]>} Absolute paths.
   */
  async #collect(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries.sort(compareEntries)) {
      // Hidden entries are not documentation: tool folders, editor metadata,
      // file-system leftovers.
      if (entry.name.startsWith('.')) continue;

      // Safety net: a misconfigured "folder" pointing at the project root
      // would swallow thousands of dependency files.
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;

      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.#collect(full)));
      } else if (this.extensions.includes(path.extname(entry.name).toLowerCase())) {
        files.push(full);
      }
    }

    return files;
  }

  /**
   * Reads a file and turns it into a document.
   *
   * @param {string} root Root of the version folder, for the relative slug.
   * @param {string} absolutePath
   * @returns {Promise<Doc>}
   */
  async #read(root, absolutePath) {
    const relative = path.relative(root, absolutePath);

    let raw;
    try {
      raw = await readFile(absolutePath, 'utf8');
    } catch (cause) {
      throw new LoaderError(`Could not read ${relative}.`, { cause });
    }

    let parsed;
    try {
      parsed = matter(raw);
    } catch (cause) {
      throw new LoaderError(`Invalid frontmatter in ${relative}.`, {
        cause,
        // gray-matter surfaces the raw YAML error: repeat it as is, it is the
        // one that gives the offending line.
        hint: cause instanceof Error ? cause.message : undefined,
      });
    }

    // The frontmatter must be a map of fields. A string or a list went
    // through, and every field of the page was ignored without a word.
    const data = parsed.data;
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new LoaderError(`Frontmatter of ${relative}: a map of fields is expected.`, {
        hint: 'Write "key: value" pairs, one per line — title: Installation.',
      });
    }
    /** @type {Record<string, any>} */
    const frontmatter = { ...data };

    // The title feeds <title>, the menu and the JSON-LD: it must be text. A
    // list came out as "one,two", an object as "[object Object]". A number
    // reads as text; an empty title counts as none.
    const title = frontmatter.title;
    if (
      title === null ||
      title === undefined ||
      (typeof title === 'string' && title.trim() === '')
    ) {
      delete frontmatter.title;
    } else if (typeof title === 'number') {
      frontmatter.title = String(title);
    } else if (typeof title === 'string') {
      frontmatter.title = title.trim();
    } else {
      throw new LoaderError(`Invalid title in ${relative}: text is expected.`, {
        hint: 'title: My title — without brackets or braces.',
      });
    }

    // A name without a Latin letter or a digit yields no URL: the page
    // silently took the home page's place, or its folder vanished from the
    // address.
    const blank = blankSegments(relative);
    if (blank.length > 0) {
      throw new LoaderError(`"${relative}" yields no URL for "${blank.join('", "')}".`, {
        hint: 'Give the file or folder a name that contains Latin letters or digits.',
      });
    }

    const slug = filePathToSlug(relative);
    return {
      slug,
      path: absolutePath,
      url: slugToUrl(slug),
      frontmatter,
      content: parsed.content,
      order: orderOf(path.basename(absolutePath)),
    };
  }

  /**
   * Refuses two documents that would produce the same URL.
   *
   * The classic case is `guide.md` and `guide/index.md`: two legitimate files,
   * a single slug. Better to say so at build time than to ship a page
   * overwritten by the other.
   *
   * @param {Doc[]} docs
   * @throws {LoaderError}
   */
  #assertNoSlugCollision(docs) {
    /** @type {Map<string, string>} */
    const seen = new Map();

    for (const doc of docs) {
      const previous = seen.get(doc.slug);
      if (previous !== undefined) {
        throw new LoaderError(`Two files produce the same slug "${doc.slug || '(root)'}".`, {
          hint: `Conflicting: ${previous} and ${doc.path}. Rename one of them.`,
        });
      }
      seen.set(doc.slug, doc.path);
    }
  }
}
