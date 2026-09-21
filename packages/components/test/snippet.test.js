import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DocPensieveError } from '@docpensieve/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { Snippet, setSnippetIcons } from '../src/snippet.js';

const render = (/** @type {any} */ element) => renderToStaticMarkup(element);
const block = h('pre', null, h('code', null, 'const a = 1;'));

describe('Snippet', () => {
  it('frames a block and labels it with the file', () => {
    const html = render(h(Snippet, { source: 'src/index.js', title: 'index.js' }, block));

    expect(html).toContain('<figure class="dp-snippet">');
    expect(html).toContain('<span class="dp-snippet-name">index.js</span>');
    expect(html).toContain('const a = 1;');
  });

  it('falls back to the file it names when no title is given', () => {
    const html = render(h(Snippet, { source: 'src/index.js' }, block));
    expect(html).toContain('>src/index.js</span>');
  });

  it('folds into a details, which needs no script', () => {
    // A long file can then sit in a page without burying what follows it.
    const html = render(h(Snippet, { title: 'long.js', collapsed: true }, block));

    expect(html).toContain('<details class="dp-snippet dp-snippet--collapsed">');
    expect(html).toContain('<summary class="dp-snippet-title">');
    expect(html).toContain('>long.js</span>');
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

describe('what a snippet says of its language', () => {
  afterEach(() => setSnippetIcons(''));

  it('carries its colour as a variable, never as a rule of its own', () => {
    // A component does not get to fight the theme: the stylesheet decides
    // what the colour paints, and a project can set another.
    const html = render(h(Snippet, { title: 'a.py', lang: 'python' }, block));

    expect(html).toContain('--dp-snippet-color:#2c628d');
    expect(html).toContain('<span class="dp-snippet-mark">PY</span>');
  });

  it('shows nothing of a language it does not know', () => {
    const html = render(h(Snippet, { title: 'a.brainfuck', lang: 'brainfuck' }, block));

    expect(html).not.toContain('dp-snippet-mark');
    expect(html).not.toContain('--dp-snippet-color');
  });

  it('draws the icon of the collection a project lends it', () => {
    setSnippetIcons('simple-icons');
    const html = render(h(Snippet, { title: 'a.py', lang: 'python' }, block));

    expect(html).toContain('dp-snippet-icon');
    expect(html).toContain('<svg');
    expect(html).not.toContain('dp-snippet-mark');
  });

  it('falls back to the mark rather than fail on a collection it cannot read', () => {
    // The icon is the engine's idea, not something the page asked for: a
    // documentation installed in a project without that collection must
    // still build.
    setSnippetIcons('a-set-nobody-installed');
    const html = render(h(Snippet, { title: 'a.py', lang: 'python' }, block));

    expect(html).toContain('<span class="dp-snippet-mark">PY</span>');
  });
});
