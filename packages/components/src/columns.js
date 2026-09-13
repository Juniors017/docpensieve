/**
 * Column grid.
 *
 * Not to be confused with CSS multi-column (`column-count`), where content
 * *flows* from one column to the next as in a newspaper. Here every block is
 * placed explicitly: it is a grid, not a flow. For a flow, the theme's
 * utilities are enough, without a component.
 *
 * Two layouts, depending on what the row holds:
 *
 * - **no declared width** — the columns share the space equally, whatever
 *   their number;
 * - **declared widths** — twelve tracks, and each column takes the number it
 *   asks for.
 *
 * The grid works out the gap between columns by itself: a width therefore has
 * no calculation to make, and changing the gap breaks nothing.
 *
 * Classes come from the theme (ADR-007), never from a hard-coded framework.
 *
 * @module @docpensieve/components/columns
 */

import { Children, createContext, createElement as h, isValidElement, useContext } from 'react';

import { DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';

/** Number of tracks when widths are declared. */
const TRACKS = 12;

/**
 * What a column learns from its row.
 *
 * `null` outside a row: without this landmark, a lone `Column` rendered a
 * grid cell without a grid — full width, with no error or warning. A tag that
 * silently does nothing is what this project sets out to avoid.
 *
 * @type {import('react').Context<{ sized: boolean } | null>}
 */
const Row = createContext(/** @type {{ sized: boolean } | null} */ (null));

/**
 * Tells whether at least one column of the row declares a width.
 *
 * The walk goes down into the children: depending on how the author spaces
 * out their MDX, the columns are not always direct children of the row.
 *
 * @param {any} children
 * @returns {boolean}
 */
function hasSizedColumn(children) {
  return Children.toArray(children).some((child) => {
    if (!isValidElement(child)) return false;
    // `props` is not typed on an arbitrary element: open it here rather than
    // impose a shape on everything an author can write.
    const props = /** @type {{ span?: number, children?: any }} */ (child.props);
    if (child.type === Column) return props.span !== undefined;
    return props?.children !== undefined && hasSizedColumn(props.children);
  });
}

/**
 * Row of columns.
 *
 * The gap is set through `className` or `style`, with the theme's utilities:
 * the grid recomputes the widths by itself.
 *
 * @param {{ className?: string, style?: object, children?: any }} props
 */
export function Columns({ className, style, children }) {
  const sized = hasSizedColumn(children);

  return h(
    Row.Provider,
    { value: { sized } },
    h(
      'div',
      { className: classNames(cls('columns', sized && 'twelfths'), className), style },
      children,
    ),
  );
}

/**
 * Column of a row.
 *
 * @param {{ className?: string, style?: object, children?: any, span?: number }} props
 *   `span` is the number of tracks taken out of twelve — `span={6}` for a
 *   half, `span={8}` for two thirds. Twelve because twelve divides by two,
 *   three, four and six. Without `span`, the columns share the space equally.
 * @throws {DocPensieveError} Outside a `Columns`, or when the row mixes
 *   columns with and without a width.
 */
export function Column({ className, style, children, span }) {
  const row = useContext(Row);

  if (row === null) {
    throw new DocPensieveError('A <Column> was written outside a <Columns>.', {
      hint: 'Wrap the columns: <Columns><Column>…</Column></Columns>.',
    });
  }

  if (span !== undefined && (!Number.isInteger(span) || span < 1 || span > TRACKS)) {
    throw new DocPensieveError(`Invalid column width: "${span}".`, {
      hint: `span expects an integer from 1 to ${TRACKS}, the number of tracks taken out of ${TRACKS}.`,
    });
  }

  // A column without a width in a row that declares some would take a single
  // track out of twelve: a sliver, where the author expected a column.
  if (row.sized && span === undefined) {
    throw new DocPensieveError('A <Column> without a width in a row that declares some.', {
      hint: `Give a span to every column of the row, or to none. The total is ${TRACKS}.`,
    });
  }

  return h(
    'div',
    { className: classNames(cls('column', span && `span-${span}`), className), style },
    children,
  );
}
