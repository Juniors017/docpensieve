/**
 * `docpensieve check` command — reads the produced site back.
 *
 * A successful build says nothing of a dead link or of invalid markup:
 * nothing in the chain looks at them, and they only show when opening the
 * pages one by one. This command does that reading.
 *
 * @module docpensieve/commands/check
 */

import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from '@docpensieve/core';
import { DocPensieveError } from '@docpensieve/shared';
import chalk from 'chalk';

/** Targets outside our remit: another domain, an anchor, a special protocol. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * Attributes likely to carry an internal target.
 *
 * `content` is one of them for header metadata; the values that are not URLs
 * do not start with a slash and are set aside.
 *
 * The lookbehind sets compound names aside: without it, `data-src` ends with
 * `src` and would be taken for a target, although the browser will never
 * fetch it — a dead link reported for nothing.
 */
const ATTRIBUTES = /(?<![\w-])(?:href|src|content)="([^"]*)"/g;

/** Opening or closing tag, with its name. */
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;

/** Contents whose inside is not markup. */
const RAW = /<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/** Elements without content: they open nothing that must be closed. */
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Elements that only accept text content.
 *
 * A paragraph inside one of them is invalid: the browser takes it out of its
 * wrapper, and the intended layout disappears.
 */
const INLINE = new Set([
  'abbr',
  'b',
  'button',
  'cite',
  'code',
  'em',
  'i',
  'kbd',
  'label',
  'mark',
  'q',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
]);

/**
 * Block elements: a paragraph can contain none of them.
 *
 * The browser closes the paragraph by itself when it meets one: a heading
 * written in a paragraph escapes it, and the text that followed ends up bare,
 * outside any paragraph.
 */
const BLOCK = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'main',
  'nav',
  'ol',
  'pre',
  'section',
  'table',
  'ul',
]);

/**
 * @typedef {object} Fault
 * @property {string} page    Page path, relative to the checked root.
 * @property {string} subject What is at stake — a target, a tag.
 * @property {string} reason  What is wrong.
 */

/**
 * @typedef {object} Page
 * @property {string} relative Path relative to the checked root.
 * @property {string} html     File contents.
 */

/**
 * Recursively lists the HTML pages of a folder.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function htmlFilesIn(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFilesIn(file)));
    else if (entry.name.endsWith('.html')) found.push(file);
  }
  return found;
}

/**
 * Loads the pages of a produced site.
 *
 * @param {string} root
 * @returns {Promise<Page[]>}
 */
async function readPages(root) {
  const files = await htmlFilesIn(root);
  return Promise.all(
    files.map(async (file) => ({
      relative: path.relative(root, file).split(path.sep).join('/'),
      html: await readFile(file, 'utf8'),
    })),
  );
}

/**
 * Tells whether a target matches a produced file.
 *
 * `/guide/` means `guide/index.html`; `/guide` can mean either depending on
 * the host, so both forms are accepted.
 *
 * @param {string} root Checked folder.
 * @param {string} urlPath URL path, deployment prefix already removed.
 * @returns {Promise<boolean>}
 */
async function existsInOutput(root, urlPath) {
  const relative = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const candidates = urlPath.endsWith('/')
    ? [path.join(relative, 'index.html')]
    : [relative, `${relative}.html`, path.join(relative, 'index.html')];

  for (const candidate of candidates) {
    try {
      const info = await stat(path.join(root, candidate));
      if (info.isFile()) return true;
    } catch {
      // Missing candidate: try the next form.
    }
  }
  return false;
}

/**
 * Looks for internal links that lead nowhere.
 *
 * @param {string} root
 * @param {string} baseUrl
 * @param {Page[]} pages
 * @returns {Promise<Fault[]>}
 */
async function deadLinks(root, baseUrl, pages) {
  /** @type {Fault[]} */
  const faults = [];
  const prefix = baseUrl === '/' ? '' : baseUrl.replace(/\/$/, '');

  for (const { relative, html } of pages) {
    // The same target often comes back within a page — the menu, the
    // breadcrumb: reporting it once is enough.
    const seen = new Set();

    for (const [, raw] of html.matchAll(ATTRIBUTES)) {
      if (raw === '' || EXTERNAL.test(raw) || !raw.startsWith('/')) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);

      const target = raw.split('#')[0].split('?')[0];
      if (target === '') continue;

      if (prefix && !target.startsWith(`${prefix}/`) && target !== prefix) {
        faults.push({
          page: relative,
          subject: raw,
          reason: `ignores the deployment prefix "${baseUrl}"`,
        });
        continue;
      }

      if (!(await existsInOutput(root, target.slice(prefix.length)))) {
        faults.push({ page: relative, subject: raw, reason: 'leads to no file' });
      }
    }
  }

  return faults;
}

/**
 * Looks for paragraphs placed where they cannot fit.
 *
 * The content of a JSX tag left alone on its line becomes a paragraph. A
 * `<p className="…">` used as a wrapper therefore produces two nested
 * paragraphs: the browser closes the first one by itself, the wrapper
 * disappears, and the intended layout with it. Nothing reports it.
 *
 * The formatter makes the trap sneaky — it breaks a long string of classes
 * over several lines, which leaves the text alone on its line after the fact.
 *
 * The analysis holds on a stack because the output **always** closes its
 * paragraphs: nothing here is produced by hand, so a `<p>` opened while
 * another one is open is indeed a nesting, never an implicit close.
 *
 * @param {Page[]} pages
 * @returns {Fault[]}
 */
function invalidMarkup(pages) {
  /** @type {Fault[]} */
  const faults = [];

  for (const { relative, html } of pages) {
    // The inside of a script or a style is not markup.
    const markup = html.replace(RAW, '');

    /** @type {string[]} */
    const stack = [];
    let reported = false;

    for (const [, closing, name, selfClosing] of markup.matchAll(TAG)) {
      const tag = name.toLowerCase();

      if (closing) {
        const position = stack.lastIndexOf(tag);
        if (position !== -1) stack.length = position;
        continue;
      }

      if (tag !== 'p' && BLOCK.has(tag) && !reported && stack.includes('p')) {
        faults.push({
          page: relative,
          subject: `<${tag}>`,
          reason: `block element "${tag}" inside a paragraph`,
        });
        reported = true;
      }

      if (tag === 'p' && !reported) {
        if (stack.includes('p')) {
          faults.push({
            page: relative,
            subject: '<p>',
            reason: 'paragraph nested in a paragraph',
          });
          reported = true;
        } else {
          const wrapper = stack.findLast((open) => INLINE.has(open));
          if (wrapper !== undefined) {
            faults.push({
              page: relative,
              subject: '<p>',
              reason: `paragraph inside a "${wrapper}", which only accepts text`,
            });
            reported = true;
          }
        }
      }

      if (!VOID.has(tag) && selfClosing !== '/') stack.push(tag);
    }
  }

  return faults;
}

/**
 * Checks the internal links of a generated site.
 *
 * Exported apart from the command: it reads no configuration and addresses no
 * one, which makes it usable elsewhere and testable on its own.
 *
 * @param {string} root      Folder of the produced site.
 * @param {string} [baseUrl] Deployment prefix, slashes included.
 * @returns {Promise<{ pages: number, faults: Fault[] }>}
 */
export async function verifyLinks(root, baseUrl = '/') {
  const pages = await readPages(root);
  return { pages: pages.length, faults: await deadLinks(root, baseUrl, pages) };
}

/**
 * Checks the markup of a generated site.
 *
 * @param {string} root Folder of the produced site.
 * @returns {Promise<{ pages: number, faults: Fault[] }>}
 */
export async function verifyMarkup(root) {
  const pages = await readPages(root);
  return { pages: pages.length, faults: invalidMarkup(pages) };
}

/**
 * Reads the produced site back and reports what is wrong.
 *
 * @param {{ dir?: string, cwd?: string }} [options]
 * @returns {Promise<{ root: string, pages: number, faults: Fault[] }>}
 * @throws {DocPensieveError} When the folder does not exist, or when something
 *   is left to fix — the exit code is then that of an expected error, which is
 *   enough to fail a continuous integration run.
 */
export async function check(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd);
  const root = path.resolve(cwd, options.dir ?? config.outDir);

  if (!existsSync(root)) {
    throw new DocPensieveError(`Nothing to check: ${root} does not exist.`, {
      hint: 'Run "docpensieve build" before "check".',
    });
  }

  // The pages are only read once for both checks.
  const pages = await readPages(root);
  const faults = [...(await deadLinks(root, config.baseUrl, pages)), ...invalidMarkup(pages)];

  if (faults.length === 0) {
    console.log(`${pages.length} page(s) read in ${root}`);
    console.log(chalk.green('No dead link, no invalid markup.'));
    return { root, pages: pages.length, faults };
  }

  // The details come out before the error: the final message only carries a
  // count, and the list says what to fix.
  console.error(`${pages.length} page(s) read in ${root}\n`);
  for (const { page, subject, reason } of faults) {
    console.error(`  ${chalk.bold(page)}`);
    console.error(`    ${subject}`);
    console.error(`    ${chalk.dim(`→ ${reason}`)}\n`);
  }

  throw new DocPensieveError(`${faults.length} issue(s) to fix.`, {
    hint: 'An absolute target starts from the version root. A paragraph cannot contain another one.',
  });
}
