/**
 * Card and its parts.
 *
 * The component provides the **structure** — the wrapper, the separators, the
 * spacing. The look is set through `className`, with the utilities of the
 * active theme. One prop per typographic setting would mean reimplementing,
 * less well, what CSS already does.
 *
 * Classes come from the theme (ADR-007), never from a hard-coded framework.
 *
 * The files of this package are plain JavaScript, with no build step: no JSX,
 * hence `createElement` — shortened to `h` for readability.
 *
 * @module @docpensieve/components/card
 */

import { createElement as h } from 'react';

import { classNames, cls } from './classes.js';
import { resolveUrl } from './site.js';

/**
 * @typedef {object} PartProps
 * @property {string} [className] Classes added to the component's own.
 * @property {object} [style]
 * @property {any} [children]
 */

/**
 * Makes a card part: header, body or footer.
 *
 * The three only differ by their theme slot.
 *
 * @param {string} slot Theme slot, `'cardHeader'` for instance.
 * @param {string} name Name shown in errors and rendering tools.
 * @returns {(props: PartProps) => any}
 */
function cardPart(slot, name) {
  /** @param {PartProps} props */
  function Part({ className, style, children }) {
    return h('div', { className: classNames(cls(slot), className), style }, children);
  }
  Object.defineProperty(Part, 'name', { value: name });
  return Part;
}

/**
 * Card container.
 *
 * @param {PartProps & { elevated?: boolean, href?: string }} props
 *   `elevated` adds a shadow. `href` makes the whole card clickable, rather
 *   than a link on the title alone that would leave the rest inert.
 */
export function Card({ className, style, children, elevated = false, href }) {
  return h(
    href ? 'a' : 'div',
    {
      className: classNames(cls('card', elevated && 'elevated'), className),
      style,
      // A link produced by a component escapes the compiler plugins: it
      // resolves itself, following the same rules (ADR-006).
      ...(href ? { href: resolveUrl(href) } : {}),
    },
    children,
  );
}

export const CardHeader = cardPart('cardHeader', 'CardHeader');
export const CardBody = cardPart('cardBody', 'CardBody');
export const CardFooter = cardPart('cardFooter', 'CardFooter');

/**
 * Image at the top of a card.
 *
 * `src` resolves as in Markdown — relative to the page, absolute from the
 * version root. The compiler plugins cannot handle it: they work on the
 * Markdown tree, before React renders anything. So the component does it
 * itself (ADR-006).
 *
 * @param {{
 *   className?: string, style?: object, src?: string,
 *   alt?: string, title?: string, srcSet?: string, sizes?: string, loading?: 'lazy' | 'eager',
 * }} props `alt` defaults to the empty string: without that attribute, a
 *   screen reader would announce the file URL.
 */
export function CardImage({ className, style, src, alt = '', loading = 'lazy', ...rest }) {
  return h('img', {
    className: classNames(cls('cardImage'), className),
    style,
    src: resolveUrl(src),
    alt,
    // Lazy by default: a card image is rarely what the reader sees first,
    // and React stops preloading an image loaded lazily.
    loading,
    decoding: 'async',
    ...rest,
  });
}
