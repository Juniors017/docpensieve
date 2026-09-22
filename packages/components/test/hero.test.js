import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DocPensieveError } from '@docpensieve/shared';
import { describe, expect, it } from 'vitest';

import { Hero, HeroActions } from '../src/hero.js';

const render = (/** @type {any} */ element) => renderToStaticMarkup(element);

describe('Hero', () => {
  it('opens a page with a section of its own', () => {
    // A section rather than a div: a banner is the head of the page, and a
    // screen reader should be able to skip it.
    const html = render(h(Hero, null, h('h1', null, 'DocPensieve')));

    expect(html).toContain('<section class="dp-hero">');
    expect(html).toContain('<h1>DocPensieve</h1>');
  });

  it('can sit at the start instead of the centre', () => {
    const html = render(h(Hero, { align: 'start' }, 'Body'));
    expect(html).toContain('class="dp-hero dp-hero--start"');
  });

  it('refuses an alignment that does not exist, and lists the ones that do', () => {
    try {
      render(h(Hero, { align: 'middle' }, 'Body'));
      expect.unreachable('Hero should have thrown');
    } catch (error) {
      const failure = /** @type {DocPensieveError} */ (error);
      expect(failure).toBeInstanceOf(DocPensieveError);
      expect(failure.message).toContain('middle');
      expect(failure.hint).toContain('center');
    }
  });

  it('turns the links of a row into ways in', () => {
    // Markdown writes them as links; the row is what makes them something to
    // press, and the stylesheet what tells the first from the rest.
    const html = render(
      h(
        HeroActions,
        null,
        h('a', { href: '/guide/' }, 'Get started'),
        h('a', { href: '/x/' }, 'X'),
      ),
    );

    expect(html).toContain('<div class="dp-hero-actions">');
    expect(html.match(/<a /g)).toHaveLength(2);
  });

  it('takes a class and a style of its own, like every component', () => {
    const html = render(h(Hero, { className: 'tight', style: { paddingTop: '1rem' } }, 'Body'));
    expect(html).toContain('class="dp-hero tight"');
    expect(html).toContain('padding-top:1rem');
  });
});
