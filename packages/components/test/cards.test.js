import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { afterEach, describe, expect, it } from 'vitest';

import { Cards } from '../src/cards.js';
import { setSiteContext } from '../src/site.js';

/** A version with two series, one of which holds two pages. */
const pages = [
  { url: '/v/', slug: '', title: 'Home' },
  {
    url: '/v/guide/',
    slug: 'guide',
    title: 'Guide',
    description: 'From installation to deployment.',
    preview: '/v/guide/cover.png',
  },
  {
    url: '/v/guide/install/',
    slug: 'guide/install',
    title: 'Installation',
    description: 'What you need.',
    modified: { iso: '2026-03-04', label: '4 March 2026' },
  },
  { url: '/v/guide/deploy/', slug: 'guide/deploy', title: 'Deployment' },
  { url: '/v/reference/', slug: 'reference', title: 'Reference' },
  { url: '/v/reference/cli/', slug: 'reference/cli', title: 'CLI' },
  { url: '/v/about/', slug: 'about', title: 'About' },
];

/** @param {string} slug @param {string} url */
const onPage = (slug, url) => setSiteContext({ url, basePath: '/v/', slug, pages });

const render = (/** @type {any} */ props) => renderToStaticMarkup(h(Cards, props));

afterEach(() => setSiteContext({}));

describe('Cards', () => {
  it('shows the folders of the root as series, beside its plain pages', () => {
    onPage('', '/v/');
    const html = render({});

    expect(html).toContain('href="/v/guide/"');
    expect(html).toContain('href="/v/reference/"');
    expect(html).toContain('href="/v/about/"');
    // A series announces its size; a plain page has none to announce.
    expect(html).toContain('2 pages');
    expect(html).toContain('1 page');
  });

  it('lists the instalments of a series from its own index page', () => {
    // The slug of a folder index is the folder itself: read naively, the page
    // would list its neighbours instead of its own pages.
    onPage('guide', '/v/guide/');
    const html = render({});

    expect(html).toContain('href="/v/guide/install/"');
    expect(html).toContain('href="/v/guide/deploy/"');
    expect(html).not.toContain('href="/v/reference/"');
  });

  it('lists the neighbours of a page that is not an index', () => {
    onPage('guide/install', '/v/guide/install/');
    const html = render({});

    expect(html).toContain('href="/v/guide/deploy/"');
    // Never itself: a card leading to the page being read leads nowhere.
    expect(html).not.toContain('href="/v/guide/install/"');
  });

  it('narrows to the series or to the pages', () => {
    onPage('', '/v/');

    const series = render({ of: 'series' });
    expect(series).toContain('href="/v/guide/"');
    expect(series).not.toContain('href="/v/about/"');

    const plain = render({ of: 'pages' });
    expect(plain).toContain('href="/v/about/"');
    expect(plain).not.toContain('href="/v/guide/"');
  });

  it('reads another folder on request', () => {
    onPage('about', '/v/about/');
    const html = render({ from: 'guide' });

    expect(html).toContain('href="/v/guide/install/"');
    expect(html).toContain('href="/v/guide/deploy/"');
  });

  it('carries the description, the cover and the update date', () => {
    onPage('', '/v/');
    const html = render({ of: 'series' });
    expect(html).toContain('From installation to deployment.');
    expect(html).toContain('src="/v/guide/cover.png"');

    onPage('guide', '/v/guide/');
    expect(render({})).toContain('Updated 4 March 2026');
  });

  it('makes the whole card the link, not the title alone', () => {
    onPage('guide', '/v/guide/');
    // A link on the title would leave the rest of the card inert.
    expect(render({})).toMatch(/<a class="[^"]*dp-card[^"]*" href="\/v\/guide\/install\/"/);
  });

  it('refuses to render without the page list', () => {
    setSiteContext({ url: '/v/', basePath: '/v/' });
    // Rendering an empty grid would look like a folder with nothing in it.
    expect(() => render({})).toThrow(/list of pages/);
  });

  it('refuses a folder that holds nothing', () => {
    onPage('', '/v/');
    expect(() => render({ from: 'guied' })).toThrow(/guied/);
  });
});
