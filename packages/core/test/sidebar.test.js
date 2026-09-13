import { describe, expect, it } from 'vitest';

import { buildSidebar, collectSectionTitles } from '../src/index.js';

/**
 * Builds a document, in the order the loader would return it.
 *
 * Complete rather than minimal: the sidebar only reads the slug and the
 * title, but handing it anything other than a real document would let a gap
 * open between what it receives here and what it will receive for real.
 *
 * @param {string} slug
 * @param {string} [title]
 * @returns {import('../src/loader.js').Doc}
 */
const doc = (slug, title) => ({
  slug,
  url: slug ? `/${slug}/` : '/',
  frontmatter: title ? { title } : {},
  path: `docs/v1.0/${slug || 'index'}.md`,
  content: '',
  order: Number.POSITIVE_INFINITY,
});

describe('buildSidebar', () => {
  it('puts the root page at the top level', () => {
    const tree = buildSidebar([doc('', 'Home')]);
    expect(tree).toEqual([{ label: 'Home', url: '/', items: [] }]);
  });

  it('creates one category per folder', () => {
    const tree = buildSidebar([doc('guide/installation', 'Installation')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].label).toBe('Guide');
    expect(tree[0].url).toBeNull();
    expect(tree[0].items).toEqual([
      { label: 'Installation', url: '/guide/installation/', items: [] },
    ]);
  });

  it('gives a category with an index page its real title', () => {
    // The loader puts index.md before its siblings: the category receives its
    // title before a child page creates it with a default one.
    const tree = buildSidebar([
      doc('getting-started', 'Getting started'),
      doc('getting-started/step', 'First step'),
    ]);
    expect(tree[0].label).toBe('Getting started');
    expect(tree[0].url).toBe('/getting-started/');
    expect(tree[0].items).toHaveLength(1);
  });

  it('humanises the name of a folder without an index page', () => {
    const tree = buildSidebar([doc('setting-up/page', 'Page')]);
    expect(tree[0].label).toBe('Setting up');
  });

  it('nests over several levels', () => {
    const tree = buildSidebar([doc('a/b/c', 'C')]);
    expect(tree[0].label).toBe('A');
    expect(tree[0].items[0].label).toBe('B');
    expect(tree[0].items[0].items[0]).toMatchObject({ label: 'C', url: '/a/b/c/' });
  });

  it('keeps the loader order without re-sorting', () => {
    const tree = buildSidebar([doc('zebra', 'Zebra'), doc('alpha', 'Alpha')]);
    expect(tree.map((node) => node.label)).toEqual(['Zebra', 'Alpha']);
  });

  it('groups the pages of a folder under a single category', () => {
    const tree = buildSidebar([doc('guide/a', 'A'), doc('guide/b', 'B')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].items.map((node) => node.label)).toEqual(['A', 'B']);
  });

  it('accepts a URL function, to prefix with the version', () => {
    const tree = buildSidebar([doc('intro', 'Intro')], (d) => `/versions/v1.0/${d.slug}/`);
    expect(tree[0].url).toBe('/versions/v1.0/intro/');
  });

  it('falls back to “Home” when the root page has no title', () => {
    expect(buildSidebar([doc('')])[0].label).toBe('Home');
  });
});

describe('collectSectionTitles', () => {
  it('maps the full folder slug to its title', () => {
    const titles = collectSectionTitles([
      doc('getting-started', 'Getting started'),
      doc('guide/installation', 'Installation'),
    ]);
    expect(titles).toEqual({
      'getting-started': 'Getting started',
      'guide/installation': 'Installation',
    });
  });

  it('ignores the root page and untitled documents', () => {
    expect(collectSectionTitles([doc('', 'Home'), doc('untitled')])).toEqual({});
  });

  it('keeps their own titles for two folders sharing a name', () => {
    // Keyed by their last segment alone, “a/notes” and “b/notes” shared an
    // entry: B's breadcrumb showed A's title.
    const titles = collectSectionTitles([
      doc('a/notes', 'Notes of A'),
      doc('b/notes', 'Notes of B'),
    ]);
    expect(titles['a/notes']).toBe('Notes of A');
    expect(titles['b/notes']).toBe('Notes of B');
  });
});
