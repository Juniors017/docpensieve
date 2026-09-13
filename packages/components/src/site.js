/**
 * Page context handed to components.
 *
 * The compiler plugins rewrite the URLs of the tree built from the Markdown,
 * but that work happens **before** React renders the components: a link
 * produced by a component escapes them. This module gives it what it needs
 * to resolve itself, following the same rules (ADR-006).
 *
 * It also carries what is needed to find a **file** of the version, which a
 * component that includes a resource at build time requires.
 *
 * @module @docpensieve/components/site
 */

import path from 'node:path';

/**
 * Targets left as they are: external link, anchor, mailto, data:.
 * Same rule as in the compiler.
 */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * @typedef {object} SiteContext
 * @property {string} url URL of the page being rendered.
 * @property {string} [dirUrl] Folder of the source file, mapped into URL
 *   space. Base of relative targets: the page URL has one more level.
 * @property {string} basePath Version root, deployment prefix included.
 * @property {string} [filepath] Source file of the page, on disk.
 * @property {string} [sourceDir] Source folder of the version.
 */

/** @type {SiteContext} */
let context = { url: '/', basePath: '/' };

/**
 * Declares the page being rendered.
 *
 * Set by the generator before every page, like the class table.
 *
 * @param {Partial<SiteContext>} [page]
 */
export function setSiteContext(page = {}) {
  context = {
    url: page.url ?? '/',
    dirUrl: page.dirUrl,
    basePath: page.basePath ?? '/',
    filepath: page.filepath,
    sourceDir: page.sourceDir,
  };
}

/** @returns {SiteContext} The current context. */
export function getSiteContext() {
  return context;
}

/**
 * Resolves a target written by an author into a site URL.
 *
 * Same rules as for Markdown content: a relative target resolves against the
 * page's folder, an absolute target starts from the version root.
 *
 * @param {string | undefined} target
 * @returns {string | undefined} The resolved target, or as is when external.
 */
export function resolveUrl(target) {
  if (typeof target !== 'string' || target === '' || EXTERNAL.test(target)) return target;

  const { url, dirUrl, basePath } = context;

  if (target.startsWith('/')) {
    if (basePath === '/' || target.startsWith(basePath)) return target;
    return `${basePath.replace(/\/$/, '')}${target}`;
  }

  // The origin is throwaway: only the resolved path matters. The base is the
  // source file's folder, not the page URL — see `dirUrl`.
  const resolved = new URL(target, `https://docpensieve.invalid${dirUrl ?? url}`);
  return resolved.pathname + resolved.search + resolved.hash;
}

/**
 * Resolves a target into a file path, for a resource read at build time.
 *
 * Same landmarks as for a URL, mapped to the disk: a relative target starts
 * from the page's file, an absolute one from the version folder. Nothing can
 * leave that folder — a page does not read the rest of the machine.
 *
 * @param {string} target
 * @returns {string} Absolute path, inside the source folder.
 * @throws {Error} When the context is missing or the target escapes it.
 */
export function resolveFile(target) {
  const { filepath, sourceDir } = context;
  if (!sourceDir) {
    throw new Error('No source folder known: the page context was not set.');
  }

  const base = target.startsWith('/')
    ? path.join(sourceDir, target.slice(1))
    : path.resolve(path.dirname(filepath ?? sourceDir), target);

  const resolved = path.resolve(base);
  const root = path.resolve(sourceDir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`The target "${target}" leaves the version folder.`);
  }
  return resolved;
}
