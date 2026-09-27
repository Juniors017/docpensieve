import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { afterEach, describe, expect, it } from 'vitest';

import { Menu, MenuLink } from '../src/menu.js';
import { ScrollToTop } from '../src/scroll-to-top.js';
import { setSiteContext } from '../src/site.js';

/**
 * The words a component writes by default follow the page.
 *
 * `ScrollToTop` named itself "Back to top" on every page, French ones
 * included, because the default was written here in English rather than asked
 * of the page — while the shell's own button, beside it, already said
 * "Retour en haut". A screen reader then announced the two in two languages.
 */

afterEach(() => setSiteContext({}));

const nameOf = (/** @type {string} */ html) => /aria-label="([^"]*)"/.exec(html)?.[1];

describe('the default names of components', () => {
  it('speak the language of the page', () => {
    setSiteContext({ url: '/', basePath: '/', lang: 'fr' });
    expect(nameOf(renderToStaticMarkup(h(ScrollToTop)))).toBe('Retour en haut');
  });

  it('keep English for a language the tool does not ship', () => {
    // As the shell does: no project stops building for a missing word.
    setSiteContext({ url: '/', basePath: '/', lang: 'de' });
    expect(nameOf(renderToStaticMarkup(h(ScrollToTop)))).toBe('Back to top');
  });

  it('give way to a name the page writes itself', () => {
    setSiteContext({ url: '/', basePath: '/', lang: 'fr' });
    expect(nameOf(renderToStaticMarkup(h(ScrollToTop, { label: 'Haut' })))).toBe('Haut');
    expect(
      nameOf(
        renderToStaticMarkup(h(Menu, { label: 'Sections' }, h(MenuLink, { href: '/a/' }, 'A'))),
      ),
    ).toBe('Sections');
  });

  it('name a menu in the words of the page when it names nothing', () => {
    setSiteContext({ url: '/', basePath: '/', lang: 'fr' });
    expect(nameOf(renderToStaticMarkup(h(Menu, null, h(MenuLink, { href: '/a/' }, 'A'))))).toBe(
      'Menu',
    );
  });
});
