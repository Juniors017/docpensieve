import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DocPensieveError } from '@docpensieve/shared';
import { describe, expect, it } from 'vitest';

import { iconSvg, isIconName } from '../src/iconify.js';
import { LogoIcon } from '../src/logo-icon.js';

const render = (/** @type {any} */ element) => renderToStaticMarkup(element);

describe('icons of a set', () => {
  it('tells a name of a set from a path', () => {
    expect(isIconName('simple-icons:claude')).toBe(true);
    expect(isIconName('mdi:home-outline')).toBe(true);
    // A path always carries a slash or an extension.
    expect(isIconName('./icons/book.svg')).toBe(false);
    expect(isIconName('/icons/book.svg')).toBe(false);
    expect(isIconName('book.svg')).toBe(false);
  });

  it('assembles the drawing with the box of its set', () => {
    const svg = iconSvg('simple-icons:claude');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('</svg>');
  });

  it('inlines it in the page, where it takes the colour of the text', () => {
    // Inlined rather than behind an img tag, which would isolate it from the
    // page and from its colour.
    const html = render(h(LogoIcon, { src: 'simple-icons:githubcopilot', label: 'Copilot' }));
    expect(html).toContain('<svg');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Copilot"');
  });

  it('names the package to install for a set nobody installed', () => {
    let failure;
    try {
      iconSvg('nothing-of-the-sort:home');
    } catch (error) {
      failure = /** @type {DocPensieveError} */ (error);
    }
    expect(failure).toBeInstanceOf(DocPensieveError);
    expect(failure?.hint).toContain('@iconify-json/nothing-of-the-sort');
  });

  it('refuses an icon the set does not hold', () => {
    let failure;
    try {
      iconSvg('simple-icons:no-such-icon');
    } catch (error) {
      failure = /** @type {DocPensieveError} */ (error);
    }
    expect(failure).toBeInstanceOf(DocPensieveError);
    expect(failure?.message).toContain('"no-such-icon"');
  });
});
