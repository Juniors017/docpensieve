/**
 * SVG icon inlined at build time.
 *
 * The file is read once and its content placed in the page. That is what
 * lets it take its colour from `currentColor` and be styled like everything
 * else — impossible through an `img` tag, which isolates the document.
 *
 * @module @docpensieve/components/logo-icon
 */

import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';

import { DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';
import { iconSvg, isIconName } from './iconify.js';
import { resolveFile } from './site.js';

/** Isolates the `svg` root: XML header, doctype and comments stay out. */
const SVG_ROOT = /<svg\b[\s\S]*<\/svg>/i;

/** A script embedded in an SVG would run in the page. */
const SCRIPT = /<script\b[\s\S]*?<\/script\s*>/gi;

/** Event handlers written as attributes, for the same reason. */
const HANDLER = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/**
 * Files already read, by absolute path.
 *
 * The same icon often comes back within a page and from one page to the
 * next: without this cache, every occurrence would read the disk again.
 *
 * @type {Map<string, string>}
 */
const cache = new Map();

/**
 * Reads an SVG and strips what would run.
 *
 * The file comes from the project, so from a trusted source; the stripping
 * mostly matters for an icon fetched elsewhere and dropped in without review.
 * The produced site loads no JavaScript, and a component is not going to
 * introduce any.
 *
 * @param {string} src Path written by the author.
 * @returns {string} The content of the `svg` tag.
 * @throws {DocPensieveError} File not found, or without an `svg` tag.
 */
function readSvg(src) {
  // `prefix:name` names an icon of a set rather than a file of the project:
  // the drawing then comes from the set the project installed, and is placed
  // in the page all the same.
  if (isIconName(src)) return iconSvg(src).replace(SCRIPT, '').replace(HANDLER, '');

  /** @type {string} */
  let file;
  try {
    file = resolveFile(src);
  } catch (cause) {
    throw new DocPensieveError(
      `Icon "${src}": ${(cause instanceof Error && cause.message) || cause}`,
      {
        cause,
        hint: 'A relative path starts from the page, an absolute path from the version folder.',
      },
    );
  }

  const cached = cache.get(file);
  if (cached !== undefined) return cached;

  /** @type {string} */
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (cause) {
    throw new DocPensieveError(`Icon not found: "${src}".`, {
      cause,
      hint: `Expected file here: ${file}`,
    });
  }

  const match = raw.match(SVG_ROOT);
  if (!match) {
    throw new DocPensieveError(`The file "${src}" contains no <svg> tag.`, {
      hint: 'LogoIcon expects an SVG file.',
    });
  }

  const clean = match[0].replace(SCRIPT, '').replace(HANDLER, '');
  cache.set(file, clean);
  return clean;
}

/**
 * Project SVG icon, inlined in the page.
 *
 * @example
 * <LogoIcon src="./icons/book.svg" label="Documentation" />
 *
 * @param {{
 *   className?: string, style?: object,
 *   src?: string, label?: string, size?: string,
 * }} props `label` describes the icon; without it the icon is treated as
 *   decorative and hidden from screen readers — which is right when nearby
 *   text already says the same thing. `size` accepts any CSS length.
 * @throws {DocPensieveError} Without `src`, or when the file cannot be read.
 */
export function LogoIcon({ className, style, src, label, size }) {
  if (typeof src !== 'string' || src === '') {
    throw new DocPensieveError('A <LogoIcon> without src.', {
      hint: 'Give the path of the file: <LogoIcon src="./logo.svg" />.',
    });
  }

  const decorative = label === undefined || label === null || label === '';

  return h('span', {
    className: classNames(cls('logoIcon'), className),
    style: size ? { '--dp-logo-icon-size': size, ...style } : style,
    role: decorative ? undefined : 'img',
    'aria-label': decorative ? undefined : label,
    'aria-hidden': decorative ? 'true' : undefined,
    // The only way to put an SVG read from disk into the rendered tree. Its
    // content comes from the project sources and has been stripped of any
    // script.
    dangerouslySetInnerHTML: { __html: readSvg(src) },
  });
}
