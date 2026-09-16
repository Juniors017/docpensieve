/**
 * Back to the top of the page.
 *
 * No JavaScript: a link to the `top` fragment, which the HTML specification
 * reserves for the top of the document when no element carries that
 * identifier. The button therefore works without adding anything to the page.
 * The generated shell does declare a target, to bring the focus back and not
 * only the view — placed above the sticky header, which being always in view
 * would leave the browser nothing to scroll.
 *
 * It only shows once the page has scrolled, through `animation-timeline`.
 * Where the browser ignores it, it simply stays visible: a button always there
 * is better than a button never there.
 *
 * @module @docpensieve/components/scroll-to-top
 */

import { createElement as h } from 'react';

import { classNames, cls } from './classes.js';

/**
 * Arrow of the button.
 *
 * Drawn here rather than written as a character: a typographic chevron
 * changes shape and alignment from one font to another.
 */
function Chevron() {
  return h(
    'svg',
    {
      className: cls('scrollTopIcon'),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      // The arrow duplicates the accessible name of the link: announcing it a
      // second time would tell nothing.
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('path', { d: 'M12 19V5' }),
    h('path', { d: 'm5 12 7-7 7 7' }),
  );
}

/**
 * Back-to-top button.
 *
 * @param {{
 *   className?: string, style?: object, children?: any, label?: string,
 * }} props `label` is read by screen readers. The children replace the arrow
 *   with whatever you want.
 */
export function ScrollToTop({ className, style, children, label = 'Back to top' }) {
  return h(
    'a',
    {
      className: classNames(cls('scrollTop'), className),
      style,
      href: '#top',
      'aria-label': label,
    },
    children ?? h(Chevron),
  );
}
