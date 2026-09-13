/**
 * Tooltip on hover and from the keyboard.
 *
 * No JavaScript: the bubble is a real element that CSS reveals on hover and
 * on focus. The trigger is therefore reachable from the keyboard, and the
 * bubble announced through `aria-describedby` rather than guessed.
 *
 * @module @docpensieve/components/tooltip
 */

import { Children, createElement as h, isValidElement, useId } from 'react';

import { DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';

/** Sides the bubble can sit on. */
export const TOOLTIP_PLACEMENTS = Object.freeze(['top', 'bottom', 'left', 'right']);

/**
 * Removes the paragraph MDX sometimes wraps the term in.
 *
 * The content of a tag left alone on its line becomes a paragraph — and the
 * formatter puts that content on its own line as soon as the tag is somewhat
 * indented, inside a card or a column for instance. The trigger being an
 * inline element, the result would be invalid markup that the browser would
 * silently undo.
 *
 * A tooltip term is text by nature: unwrapping that paragraph gives back what
 * the author meant to write.
 *
 * @param {any} children
 * @returns {any}
 */
function withoutParagraph(children) {
  const nodes = Children.toArray(children);
  if (nodes.length !== 1) return children;

  const only = nodes[0];
  if (!isValidElement(only) || only.type !== 'p') return children;

  return /** @type {{ children?: any }} */ (only.props).children;
}

/**
 * Term with a tooltip.
 *
 * @example
 * <Tooltip text="Generation of a complete site">build</Tooltip>
 *
 * @param {{
 *   className?: string, style?: object, children?: any,
 *   text?: string, placement?: string,
 * }} props `text` is the content of the bubble; the children are the term it
 *   explains.
 * @throws {DocPensieveError} Without text, or with an unknown side.
 */
export function Tooltip({ className, style, children, text, placement = 'top' }) {
  // An empty bubble would never appear: better to say so at build time than
  // to leave a hover with no effect.
  if (typeof text !== 'string' || text.trim() === '') {
    throw new DocPensieveError('A <Tooltip> without text.', {
      hint: 'Give the content of the bubble: <Tooltip text="…">term</Tooltip>.',
    });
  }

  if (!TOOLTIP_PLACEMENTS.includes(placement)) {
    throw new DocPensieveError(`Unknown tooltip placement: "${placement}".`, {
      hint: `Accepted values: ${TOOLTIP_PLACEMENTS.join(', ')}.`,
    });
  }

  // `useId` gives an identifier stable for the page; its colons are valid in
  // HTML but get in the way everywhere else, so they are removed.
  const id = `dp-tooltip-${useId().replace(/:/g, '')}`;

  return h(
    'span',
    { className: classNames(cls('tooltip', placement), className), style },
    // `tabIndex` makes the term reachable from the keyboard: without it, the
    // bubble would only exist for mouse users.
    h(
      'span',
      { className: cls('tooltipTrigger'), tabIndex: 0, 'aria-describedby': id },
      withoutParagraph(children),
    ),
    h('span', { className: cls('tooltipBubble'), id, role: 'tooltip' }, text),
  );
}
