import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DocPensieveError } from '@docpensieve/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { Menu, MenuGroup, MenuLink } from '../src/menu.js';
import { setSiteContext } from '../src/site.js';

const render = (/** @type {any} */ element) => renderToStaticMarkup(element);

afterEach(() => setSiteContext({}));

describe('Menu', () => {
  it('writes its entries twice: a row, and a fold for a narrow screen', () => {
    // One of the two shows at a time, so a screen reader never meets the menu
    // twice. A single rendering would need CSS that some browsers ignore,
    // and there the links would vanish.
    const html = render(h(Menu, null, h(MenuLink, { href: '/guide/' }, 'Guide')));

    expect(html.match(/dp-page-menu-link/g)).toHaveLength(2);
    expect(html).toContain('<nav class="dp-page-menu-row" aria-label="Menu">');
    expect(html).toMatch(/<details class="dp-page-menu-fold">\s*<summary>Menu<\/summary>/);
  });

  it('takes a label, for the button and for screen readers', () => {
    const html = render(h(Menu, { label: 'Sections' }, h(MenuLink, { href: '/a/' }, 'A')));
    expect(html).toContain('<summary>Sections</summary>');
    expect(html.match(/aria-label="Sections"/g)).toHaveLength(2);
  });

  it('resolves a target as the rest of the site does', () => {
    setSiteContext({ url: '/v/guide/install/', dirUrl: '/v/guide/', basePath: '/v/' });
    const html = render(
      h(
        Menu,
        null,
        h(MenuLink, { href: './deploy/' }, 'Deploy'),
        h(MenuLink, { href: '/other/' }, 'Other'),
      ),
    );

    expect(html).toContain('href="/v/guide/deploy/"');
    expect(html).toContain('href="/v/other/"');
  });

  it('keeps the classes and the styling given at use', () => {
    const html = render(
      h(
        Menu,
        { className: 'narrow', style: { marginTop: '2rem' } },
        h(MenuLink, { href: '/a/', className: 'strong' }, 'A'),
      ),
    );

    expect(html).toContain('class="dp-page-menu narrow"');
    expect(html).toContain('margin-top:2rem');
    expect(html).toContain('class="dp-page-menu-link strong"');
  });

  it('groups entries under a title, folded in place', () => {
    const html = render(
      h(
        Menu,
        null,
        h(MenuGroup, { title: 'Reference' }, h(MenuLink, { href: '/cli/' }, 'Commands')),
      ),
    );

    expect(html).toMatch(/<details class="dp-page-menu-group">/);
    expect(html).toContain('<summary class="dp-page-menu-title">Reference</summary>');
    expect(html).toContain('<div class="dp-page-menu-panel">');
  });

  it('refuses an entry written outside a menu', () => {
    // Alone, it would render a link styled as an entry, standing nowhere.
    let failure;
    try {
      render(h(MenuLink, { href: '/a/' }, 'A'));
    } catch (error) {
      failure = /** @type {DocPensieveError} */ (error);
    }
    expect(failure).toBeInstanceOf(DocPensieveError);
    expect(failure?.hint).toContain('<Menu>');
  });

  it('refuses an entry that leads nowhere, and a group without a title', () => {
    expect(() => render(h(Menu, null, h(MenuLink, null, 'A')))).toThrow(/without href/);
    expect(() => render(h(Menu, null, h(MenuGroup, null, 'A')))).toThrow(/without title/);
    expect(() => render(h(MenuGroup, { title: 'Reference' }, 'A'))).toThrow(/outside a <Menu>/);
  });
});
