/**
 * A menu of links, placed anywhere in a page.
 *
 * The header already carries the navigation of the site, and the sidebar that
 * of the documentation. This one belongs to a page: the links a section wants
 * to offer where it stands — a summary at the top of a landing page, the
 * chapters of a guide, the entries of a portal.
 *
 * It holds no state and loads no script. On a narrow screen it folds behind a
 * button, a native `details` element: the menu is therefore written once and
 * rendered twice, a row and a fold, of which the stylesheet shows one. The
 * alternative, a single rendering revealed by a recent CSS pseudo-element,
 * hides the links outright on a browser that does not know it.
 *
 * Classes come from the theme (ADR-007), never from a hard-coded framework.
 *
 * @module @docpensieve/components/menu
 */

import { createContext, createElement as h, useContext } from 'react';

import { DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';
import { resolveUrl } from './site.js';

/**
 * What an entry learns from the menu holding it.
 *
 * `false` outside a menu: without this landmark, a lone `MenuLink` rendered a
 * link with no menu around it — styled as an entry, standing nowhere, and
 * without a word to say so.
 *
 * @type {import('react').Context<boolean>}
 */
const InMenu = createContext(false);

/**
 * Menu of links.
 *
 * @param {{
 *   className?: string, style?: object, children?: any, label?: string,
 * }} props `label` names the menu for screen readers, and labels the button it
 *   folds into on a narrow screen.
 */
export function Menu({ className, style, children, label = 'Menu' }) {
  const entries = h(InMenu.Provider, { value: true }, children);

  return h(
    'div',
    { className: classNames(cls('pageMenu'), className), style },
    // The row and the fold hold the same entries; the stylesheet shows one or
    // the other, so a screen reader never meets the menu twice.
    h('nav', { className: cls('pageMenuRow'), 'aria-label': label }, entries),
    h(
      'details',
      { className: cls('pageMenuFold') },
      h('summary', null, label),
      h('nav', { className: cls('pageMenuFoldList'), 'aria-label': label }, entries),
    ),
  );
}

/**
 * Entry of a menu.
 *
 * @param {{
 *   className?: string, style?: object, children?: any, href?: string,
 * }} props
 * @throws {DocPensieveError} Outside a `Menu`, or without a target.
 */
export function MenuLink({ className, style, children, href }) {
  if (!useContext(InMenu)) {
    throw new DocPensieveError('A <MenuLink> was written outside a <Menu>.', {
      hint: 'Wrap the entries in <Menu>…</Menu>.',
    });
  }

  // A menu entry that leads nowhere is furniture: better said at build time
  // than left for a reader to click.
  if (typeof href !== 'string' || href.trim() === '') {
    throw new DocPensieveError('A <MenuLink> without href.', {
      hint: 'Give the target: <MenuLink href="/guide/">Guide</MenuLink>.',
    });
  }

  return h(
    'a',
    {
      className: classNames(cls('pageMenuLink'), className),
      style,
      // A link produced by a component escapes the compiler plugins: it
      // resolves itself, following the same rules (ADR-006).
      href: resolveUrl(href),
    },
    children,
  );
}

/**
 * Group of entries, folded under a title.
 *
 * In the row it opens as a panel below its title; folded, it unfolds in place
 * rather than over the rest — on a narrow screen a panel would open off
 * screen.
 *
 * @param {{
 *   className?: string, style?: object, children?: any, title?: string,
 * }} props
 * @throws {DocPensieveError} Outside a `Menu`, or without a title.
 */
export function MenuGroup({ className, style, children, title }) {
  if (!useContext(InMenu)) {
    throw new DocPensieveError('A <MenuGroup> was written outside a <Menu>.', {
      hint: 'Wrap the groups in <Menu>…</Menu>.',
    });
  }

  if (typeof title !== 'string' || title.trim() === '') {
    throw new DocPensieveError('A <MenuGroup> without title.', {
      hint: 'The title is what opens the group: <MenuGroup title="Reference">…</MenuGroup>.',
    });
  }

  return h(
    'details',
    { className: classNames(cls('pageMenuGroup'), className), style },
    h('summary', { className: cls('pageMenuTitle') }, title),
    h('div', { className: cls('pageMenuPanel') }, children),
  );
}
