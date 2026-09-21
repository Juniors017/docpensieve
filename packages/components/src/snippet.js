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

import { DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';

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
 *   lines?: string, region?: string, collapsed?: boolean,
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
  collapsed = false,
  // Read while compiling, and named here so that they never reach the markup
  // as attributes of an unknown element.
  lang: _lang,
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
  const body = h('div', { className: cls('snippetBody') }, children);

  // A folded snippet is a <details>, which needs no script: a long file can
  // then sit in a page without burying what follows it.
  if (collapsed) {
    return h(
      'details',
      { className: classNames(cls('snippet', 'collapsed'), className), style },
      label ? h('summary', { className: cls('snippetTitle') }, label) : null,
      body,
    );
  }

  return h(
    'figure',
    { className: classNames(cls('snippet'), className), style },
    label ? h('figcaption', { className: cls('snippetTitle') }, label) : null,
    body,
  );
}
