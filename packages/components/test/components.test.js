import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DocPensieveError } from '@docpensieve/shared';
import { afterEach, describe, expect, it } from 'vitest';

import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardImage,
  Column,
  Columns,
  FallbackAfter,
  FallbackBefore,
  ForTheme,
  TimeTimer,
  builtinComponents,
  classNames,
  cls,
  componentsCss,
  fallbackClass,
  resolveUrl,
  setSiteContext,
  setThemeClasses,
  setThemeFramework,
} from '../src/index.js';

/**
 * Renders a component to HTML, as the generator does.
 * @param {any} element
 */
const render = (element) => renderToStaticMarkup(element);

afterEach(() => {
  // The class table and the page context are module state: resetting them
  // keeps one test from contaminating another.
  setThemeClasses({});
  setThemeFramework('');
  setSiteContext({});
});

describe('URL resolution', () => {
  // The compiler plugins rewrite the tree built from the Markdown, before
  // React renders the components: a target written in a prop escapes them and
  // must resolve here, following the same rules (ADR-006).
  it('prefixes an absolute target with the version path', () => {
    setSiteContext({ url: '/guide/', basePath: '/docs/versions/v1/' });
    expect(resolveUrl('/api/')).toBe('/docs/versions/v1/api/');
  });

  it('does not prefix twice', () => {
    setSiteContext({ url: '/guide/', basePath: '/docs/versions/v1/' });
    expect(resolveUrl('/docs/versions/v1/api/')).toBe('/docs/versions/v1/api/');
  });

  it('resolves a relative target against the page', () => {
    setSiteContext({ url: '/docs/versions/v1/guide/intro/', basePath: '/docs/versions/v1/' });
    expect(resolveUrl('../api/')).toBe('/docs/versions/v1/guide/api/');
    expect(resolveUrl('./sibling/')).toBe('/docs/versions/v1/guide/intro/sibling/');
  });

  it('resolves a relative target from the folder of the source file', () => {
    // The page URL has one more level than its file: resolving against it
    // would point to a file that does not exist.
    setSiteContext({
      url: '/docs/v1/guide/intro/',
      dirUrl: '/docs/v1/guide/',
      basePath: '/docs/v1/',
    });
    expect(resolveUrl('./diagram.png')).toBe('/docs/v1/guide/diagram.png');
    expect(resolveUrl('../api/')).toBe('/docs/v1/api/');
  });

  it('leaves alone what is none of its business', () => {
    setSiteContext({ url: '/guide/', basePath: '/docs/' });
    for (const target of ['https://example.com', '//example.com', '#anchor', 'mailto:a@b.com'])
      expect(resolveUrl(target)).toBe(target);
    expect(resolveUrl(undefined)).toBeUndefined();
  });
});

describe('class resolution', () => {
  it('falls back to a dp-* class when the theme does not answer', () => {
    expect(cls('card')).toBe('dp-card');
    expect(fallbackClass('cardHeader')).toBe('dp-card-header');
  });

  it('suffixes the variants', () => {
    expect(cls('card', 'shadow-md')).toBe('dp-card dp-card--shadow-md');
    expect(cls('text', 'center', 'bold')).toBe('dp-text dp-text--center dp-text--bold');
  });

  it('ignores falsy variants, which allows cls(slot, x && y)', () => {
    expect(cls('card', false, null, undefined)).toBe('dp-card');
  });

  it('lets the theme replace a slot', () => {
    setThemeClasses({ card: 'rounded-lg border p-4' });
    expect(cls('card')).toBe('rounded-lg border p-4');
  });

  it('lets the theme replace a specific variant', () => {
    setThemeClasses({ 'text.center': 'text-center' });
    expect(cls('text', 'center')).toBe('dp-text text-center');
  });

  it('emits no empty class', () => {
    expect(classNames(false, null, '')).toBeUndefined();
    expect(classNames('a', false, 'b')).toBe('a b');
  });
});

describe('Card', () => {
  it('renders a card with its parts', () => {
    const html = render(
      h(
        Card,
        null,
        h(CardHeader, null, 'Title'),
        h(CardBody, null, 'Body'),
        h(CardFooter, null, 'Footer'),
      ),
    );
    expect(html).toContain('class="dp-card"');
    expect(html).toContain('class="dp-card-header"');
    expect(html).toContain('class="dp-card-body"');
    expect(html).toContain('class="dp-card-footer"');
  });

  it('accepts an elevation', () => {
    expect(render(h(Card, { elevated: true }))).toContain('dp-card dp-card--elevated');
  });

  it('becomes a whole link when given href', () => {
    // A link on the title alone leaves the rest of the card inert.
    const html = render(h(Card, { href: '/guide/' }, 'x'));
    expect(html).toContain('<a class="dp-card" href="/guide/"');
  });

  it('resolves its href as a Markdown link would', () => {
    // Otherwise the link pointed to the domain root and was dead as soon as a
    // deployment prefix came into play.
    setSiteContext({ url: '/site/v1/components/', basePath: '/site/v1/' });
    expect(render(h(Card, { href: '/guide/' }, 'x'))).toContain('href="/site/v1/guide/"');
  });

  it('also resolves the src of an image', () => {
    setSiteContext({ url: '/site/v1/components/', basePath: '/site/v1/' });
    expect(render(h(CardImage, { src: './photo.png' }))).toContain(
      'src="/site/v1/components/photo.png"',
    );
  });

  it('leaves the look to className rather than to props', () => {
    // Typography is set with the theme's utilities, not with one prop per
    // setting: the component only provides the structure.
    const html = render(h(CardHeader, { className: 'text-center font-bold' }, 'x'));
    expect(html).toBe('<div class="dp-card-header text-center font-bold">x</div>');
  });

  it('keeps the project className', () => {
    expect(render(h(Card, { className: 'project' }))).toContain('class="dp-card project"');
  });

  it('gives an empty alt by default', () => {
    // Without an alt attribute, a screen reader would announce the file URL.
    expect(render(h(CardImage, { src: '/a.png' }))).toContain('alt=""');
  });
});

describe('Columns', () => {
  /** Columns only exist inside a row: the tests set one up. */
  const row = (/** @type {any[]} */ ...children) => render(h(Columns, null, ...children));

  it('groups the columns in a single container', () => {
    // A second div brought nothing and deprived the row of its className.
    const html = row(h(Column, null, 'a'), h(Column, null, 'b'));
    expect(html).toContain('class="dp-columns"');
    expect(html).not.toContain('dp-columns-row');
    expect(html.match(/dp-column"/g)).toHaveLength(2);
  });

  it('accepts the className of the row', () => {
    // The gap is set there without breaking anything: the grid recomputes the
    // widths by itself.
    expect(render(h(Columns, { className: 'gap-8' }))).toBe('<div class="dp-columns gap-8"></div>');
  });

  it('accepts a width in twelfths', () => {
    expect(row(h(Column, { span: 6 }))).toContain('dp-column dp-column--span-6');
  });

  it('switches the row to twelfths as soon as a width is declared', () => {
    // Two layouts: equal shares without a width, twelve tracks with one.
    expect(row(h(Column, null, 'a'), h(Column, null, 'b'))).toContain('class="dp-columns"');
    expect(row(h(Column, { span: 6 }), h(Column, { span: 6 }))).toContain(
      'class="dp-columns dp-columns--twelfths"',
    );
  });

  it('spots a width even through a paragraph', () => {
    // Depending on how the author spaces out their MDX, the columns are not
    // always direct children of the row.
    const html = render(h(Columns, null, h('p', null, h(Column, { span: 12 }, 'a'))));
    expect(html).toContain('dp-columns--twelfths');
  });

  it('refuses to mix columns with and without a width', () => {
    // Without span, the column would take one track out of twelve: a sliver,
    // where the author expected a column.
    expect(() => row(h(Column, { span: 8 }), h(Column, null, 'b'))).toThrow(DocPensieveError);
  });

  it('refuses a lone column instead of rendering it inert', () => {
    // Outside a row, it produced a flex item without a flex container: full
    // width, without the slightest error.
    expect(() => render(h(Column, null, 'alone'))).toThrow(DocPensieveError);
  });

  it('refuses a width outside the twelfths', () => {
    expect(() => row(h(Column, { span: 13 }))).toThrow(DocPensieveError);
    expect(() => row(h(Column, { span: 2.5 }))).toThrow(DocPensieveError);
  });
});

describe('TimeTimer', () => {
  /** @type {any[]} */
  const children = [
    'During',
    h(FallbackBefore, { key: 'b' }, 'Before'),
    h(FallbackAfter, { key: 'a' }, 'After'),
  ];

  it('wraps nothing: a paragraph from the author stays valid', () => {
    // A `span` around the content produced `<span><p>…</p></span>`, invalid as
    // soon as a blank line separates the text written in the component.
    const html = render(
      h(TimeTimer, { date: '15/06/2024', now: new Date('2024-06-15T10:00') }, h('p', null, 'x')),
    );
    expect(html).toBe('<p>x</p>');
  });

  it('shows the main content during the period', () => {
    const html = render(
      h(TimeTimer, { date: '15/06/2024', now: new Date('2024-06-15T10:00') }, ...children),
    );
    expect(html).toContain('During');
    expect(html).not.toContain('Before');
  });

  it('shows the before fallback', () => {
    const html = render(
      h(TimeTimer, { date: '15/06/2024', now: new Date('2024-01-01') }, ...children),
    );
    expect(html).toBe('Before');
  });

  it('shows the after fallback', () => {
    const html = render(
      h(TimeTimer, { date: '15/06/2024', now: new Date('2025-01-01') }, ...children),
    );
    expect(html).toBe('After');
  });

  it('finds the fallbacks even inside a paragraph', () => {
    // MDX wraps the children in a <p> when no blank line separates them — the
    // most natural way to write. A first-level search would then show
    // nothing, without saying so.
    const html = render(
      h(
        TimeTimer,
        { date: '15/06/2024', now: new Date('2025-01-01') },
        h('p', null, 'During', h(FallbackAfter, null, 'After')),
      ),
    );
    expect(html).toBe('After');
  });

  it('shows nothing outside the period and without a fallback', () => {
    expect(render(h(TimeTimer, { date: '15/06/2024', now: new Date('2025-01-01') }, 'x'))).toBe('');
  });

  it('accepts a duration', () => {
    const props = { start: '01/06/2024', duration: '30d', now: new Date('2024-06-15') };
    expect(render(h(TimeTimer, props, 'Active'))).toContain('Active');
  });

  it('refuses a misspelt duration instead of vanishing', () => {
    expect(() => render(h(TimeTimer, { start: '01/06/2024', duration: '30 days' }, 'x'))).toThrow(
      DocPensieveError,
    );
  });

  it('reads in UTC with strict', () => {
    const local = render(
      h(TimeTimer, { date: '15/06/2024', now: new Date('2024-06-15T00:30Z') }, 'x'),
    );
    const utc = render(
      h(TimeTimer, { date: '15/06/2024', strict: true, now: new Date('2024-06-15T00:30Z') }, 'x'),
    );
    expect(utc).toContain('x');
    expect(typeof local).toBe('string');
  });
});

describe('registry and stylesheet', () => {
  it('exposes the shipped components', () => {
    expect(Object.keys(builtinComponents)).toEqual(
      expect.arrayContaining(['Card', 'Columns', 'Column', 'TimeTimer']),
    );
  });

  it('ships a stylesheet built on the theme tokens', async () => {
    const css = await componentsCss();
    expect(css).toContain('.dp-card');
    // Widths are grid tracks, not computed percentages: the grid subtracts
    // the gaps by itself.
    expect(css).toContain('grid-column: span 8');
    // No hard-coded colour: the component follows the active palette.
    expect(css).toContain('var(--dp-border)');
  });

  it('puts its rules in the components layer', async () => {
    // Outside a layer, they beat the utilities and the className set at use
    // was silently ignored.
    const css = await componentsCss();
    expect(css.trimStart().startsWith('/*')).toBe(true);
    expect(css).toContain('@layer components {');
  });
});

describe('ForTheme', () => {
  const page = h(
    'div',
    null,
    h(ForTheme, { framework: 'tailwind' }, 'utilities'),
    h(ForTheme, { framework: 'custom' }, 'own classes'),
  );

  it('keeps the variant of the active theme only', () => {
    setThemeFramework('custom');
    expect(render(page)).toBe('<div>own classes</div>');
    setThemeFramework('tailwind');
    expect(render(page)).toBe('<div>utilities</div>');
  });

  it('refuses a framework the configuration does not know', () => {
    setThemeFramework('custom');
    expect(() => render(h(ForTheme, { framework: 'bootstrap' }, 'x'))).toThrow(DocPensieveError);
  });

  it('refuses to render before a theme is announced', () => {
    // Rendering nothing would empty the page of every variant, without a word.
    expect(() => render(h(ForTheme, { framework: 'custom' }, 'x'))).toThrow(/before any theme/);
  });

  it('is available without an import', () => {
    expect(builtinComponents.ForTheme).toBe(ForTheme);
  });
});
