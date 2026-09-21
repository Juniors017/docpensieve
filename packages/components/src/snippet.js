/**
 * A block of code that names a real file, rather than copying it.
 *
 * It answers the oldest fault of a documented example: it is a copy, so it
 * stops being true the day the code changes, and nothing reports it — the
 * page keeps showing something that once worked. Naming the file instead
 * leaves nothing to drift.
 *
 * This component draws the frame only. The file itself is read while the page
 * compiles and put back as an ordinary code block, so the highlighter and the
 * stylesheet treat it like any block a page writes by hand.
 *
 * @module @docpensieve/components/snippet
 */

import { createElement as h } from 'react';

import { DocPensieveError, SNIPPET_LANGUAGES } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';
import { iconSvg, isIconName } from './iconify.js';
import { LogoIcon } from './logo-icon.js';

/**
 * Icon collection a project lends to its snippets, set once by the CLI.
 *
 * Module state rather than a context, as the theme table is: `core` must not
 * have to know this package (ADR-002). Empty until a project declares one,
 * and then the short mark of the language stands in.
 */
let iconSet = '';

/**
 * Declares the collection snippet icons are taken from.
 *
 * @param {string} [prefix] Prefix of an icon collection, `simple-icons`.
 */
export function setSnippetIcons(prefix = '') {
  iconSet = String(prefix ?? '');
}

/** @returns {string} The collection in use, or `''`. */
export function getSnippetIcons() {
  return iconSet;
}

/**
 * A code block, framed and labelled.
 *
 * @example
 * <Snippet source="packages/core/src/minify-css.js" region="guard" />
 *
 * @example
 * <Snippet title="who_are_you.py">
 * ```python
 * name = input("What's your name? ")
 * ```
 * </Snippet>
 *
 * @param {{
 *   className?: string, style?: object, children?: any,
 *   source?: string, title?: string, lang?: string,
 *   lines?: string, region?: string, collapsed?: boolean, icon?: string,
 * }} props `source` names a file of the project, read at generation; `lines`
 *   or `region` keep part of it; `title` replaces the file name shown above
 *   the block. Without `source`, the block is the one written in the page.
 * @throws {DocPensieveError} With neither a file nor a block of its own.
 */
export function Snippet({
  className,
  style,
  children,
  source,
  title,
  lang,
  icon,
  collapsed = false,
  // Read while compiling, and named here so that they never reach the markup
  // as attributes of an unknown element.
  lines: _lines,
  region: _region,
}) {
  // An empty frame is the one outcome nobody wants: it looks deliberate.
  if (!children) {
    throw new DocPensieveError('A snippet shows nothing.', {
      hint: source
        ? `The file "${source}" was named but never read. Snippets are resolved while the page compiles: check that the page is compiled by DocPensieve.`
        : 'Give it a file — source="src/index.js" — or write a code block inside it.',
    });
  }

  const label = title ?? source;
  const known = SNIPPET_LANGUAGES[String(lang ?? '').toLowerCase()];
  const body = h('div', { className: cls('snippetBody') }, children);

  // The colour of the language is an accent — a rule above the block, the
  // mark beside its name — never a background: it must not be able to fight
  // the theme, nor to fail a contrast check.
  const framed = {
    className: classNames(cls('snippet', collapsed && 'collapsed'), className),
    style: known ? { '--dp-snippet-color': known.color, ...style } : style,
  };

  const head = label
    ? [mark(known, icon), h('span', { className: cls('snippetName'), key: 'name' }, label)]
    : null;

  // A folded snippet is a <details>, which needs no script: a long file can
  // then sit in a page without burying what follows it.
  if (collapsed) {
    return h(
      'details',
      framed,
      head ? h('summary', { className: cls('snippetTitle') }, head) : null,
      body,
    );
  }

  return h(
    'figure',
    framed,
    head ? h('figcaption', { className: cls('snippetTitle') }, head) : null,
    body,
  );
}

/**
 * What stands for the language beside the file name.
 *
 * The drawing of an icon collection when the project declares one and holds
 * that icon, the short mark of the language otherwise. Never a failure: the
 * icon is the engine's idea, not something the page asked for, and a
 * documentation installed in a project without that collection must still
 * build.
 *
 * @param {{ label: string, icon: string } | undefined} known
 * @param {string} [icon] Icon named by the page, which wins over both.
 * @returns {any}
 */
function mark(known, icon) {
  const named = icon ?? (iconSet && known ? `${iconSet}:${known.icon}` : '');
  if (named && available(named)) {
    return h(LogoIcon, { className: cls('snippetIcon'), src: named, key: 'mark' });
  }
  return known ? h('span', { className: cls('snippetMark'), key: 'mark' }, known.label) : null;
}

/**
 * @param {string} name
 * @returns {boolean} Whether that icon can be drawn at all.
 */
function available(name) {
  if (!isIconName(name)) return true;
  try {
    iconSvg(name);
    return true;
  } catch {
    return false;
  }
}
