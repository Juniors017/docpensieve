import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DocPensieveError } from '@docpensieve/shared';
import { describe, expect, it } from 'vitest';

import { Snippet } from '../src/snippet.js';

const render = (/** @type {any} */ element) => renderToStaticMarkup(element);
const block = h('pre', null, h('code', null, 'const a = 1;'));

describe('Snippet', () => {
  it('frames a block and labels it with the file', () => {
    const html = render(h(Snippet, { source: 'src/index.js', title: 'index.js' }, block));

    expect(html).toContain('<figure class="dp-snippet">');
    expect(html).toContain('<figcaption class="dp-snippet-title">index.js</figcaption>');
    expect(html).toContain('const a = 1;');
  });

  it('falls back to the file it names when no title is given', () => {
    const html = render(h(Snippet, { source: 'src/index.js' }, block));
    expect(html).toContain('>src/index.js</figcaption>');
  });

  it('folds into a details, which needs no script', () => {
    // A long file can then sit in a page without burying what follows it.
    const html = render(h(Snippet, { title: 'long.js', collapsed: true }, block));

    expect(html).toContain('<details class="dp-snippet dp-snippet--collapsed">');
    expect(html).toContain('<summary class="dp-snippet-title">long.js</summary>');
  });

  it('never writes the attributes the compiler reads', () => {
    // `lang`, `lines` and `region` are consumed while the page compiles:
    // reaching the markup, they would land on an element that knows nothing
    // of them.
    const html = render(
      h(Snippet, { source: 'a.js', lang: 'javascript', lines: '1-3', region: 'x' }, block),
    );

    expect(html).not.toContain('region');
    expect(html).not.toContain('lines');
  });

  it('refuses to render an empty frame', () => {
    // An empty frame looks deliberate, which is the one outcome to refuse.
    try {
      render(h(Snippet, { source: 'src/gone.js' }));
      expect.unreachable('Snippet should have thrown');
    } catch (error) {
      const failure = /** @type {DocPensieveError} */ (error);
      expect(failure).toBeInstanceOf(DocPensieveError);
      expect(failure.hint).toContain('src/gone.js');
    }
  });

  it('says what to write when it has neither a file nor a block', () => {
    try {
      render(h(Snippet, null));
      expect.unreachable('Snippet should have thrown');
    } catch (error) {
      const failure = /** @type {DocPensieveError} */ (error);
      expect(failure.hint).toContain('source=');
    }
  });
});
