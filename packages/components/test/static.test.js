/**
 * The five components that render an interaction without JavaScript.
 *
 * What these tests check above all is that none of them vanishes silently:
 * each one refuses what it cannot do instead of rendering an inert element.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DocPensieveError } from '@docpensieve/shared';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LogoIcon,
  ScrollToTop,
  Skill,
  Tooltip,
  Tree,
  TreeItem,
  setSiteContext,
  setThemeClasses,
} from '../src/index.js';

/**
 * Renders a component to HTML, as the generator does.
 * @param {any} element
 */
const render = (element) => renderToStaticMarkup(element);

/**
 * Temporary folders created by the icon tests, to delete afterwards.
 * @type {string[]}
 */
const dirs = [];

afterEach(() => {
  setThemeClasses({});
  setSiteContext({});
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Sets up a version folder holding one file, and declares it to the context.
 *
 * @param {string} name Name of the file to write.
 * @param {string} contents
 * @returns {string} The created folder.
 */
function versionWith(name, contents) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dp-icon-'));
  dirs.push(dir);
  writeFileSync(path.join(dir, name), contents, 'utf8');
  setSiteContext({
    url: '/v1/page/',
    basePath: '/v1/',
    sourceDir: dir,
    filepath: path.join(dir, 'page.mdx'),
  });
  return dir;
}

describe('Tooltip', () => {
  it('binds the bubble to the term it explains', () => {
    const html = render(h(Tooltip, { text: 'Explanation' }, 'term'));
    const id = html.match(/aria-describedby="([^"]+)"/)?.[1];

    expect(id).toBeTruthy();
    // Without this match, the bubble would never be announced.
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('Explanation');
  });

  it('makes the term reachable from the keyboard', () => {
    // Without tabindex, the bubble would only exist for mouse users.
    expect(render(h(Tooltip, { text: 'x' }, 'term'))).toContain('tabindex="0"');
  });

  it('unwraps the paragraph MDX wraps the term in', () => {
    // The formatter puts the content on its own line as soon as the tag is a
    // little indented; MDX then turns it into a paragraph, and a paragraph in
    // the trigger — an inline element — is invalid markup.
    const html = render(h(Tooltip, { text: 'x' }, h('p', null, 'term')));
    expect(html).toContain('>term<');
    expect(html).not.toContain('<p>');
  });

  it('leaves alone content that is not a lone paragraph', () => {
    const html = render(h(Tooltip, { text: 'x' }, h('code', null, 'baseUrl')));
    expect(html).toContain('<code>baseUrl</code>');
  });

  it('puts the bubble on the requested side', () => {
    expect(render(h(Tooltip, { text: 'x', placement: 'right' }, 'y'))).toContain(
      'dp-tooltip dp-tooltip--right',
    );
  });

  it('refuses an empty bubble rather than a hover with no effect', () => {
    expect(() => render(h(Tooltip, {}, 'term'))).toThrow(DocPensieveError);
    expect(() => render(h(Tooltip, { text: '   ' }, 'term'))).toThrow(DocPensieveError);
  });

  it('refuses an unknown side', () => {
    expect(() => render(h(Tooltip, { text: 'x', placement: 'up-top' }, 'y'))).toThrow(
      DocPensieveError,
    );
  });
});

describe('Tree', () => {
  it('expands a branch with the native elements', () => {
    // `details` expands from the keyboard and stays printable, without a line
    // of JS.
    const html = render(
      h(Tree, null, h(TreeItem, { label: 'src' }, h(TreeItem, { label: 'index.js' }))),
    );
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).toContain('src');
    expect(html).toContain('index.js');
  });

  it('tells a leaf from a branch by the presence of children', () => {
    const leaf = render(h(Tree, null, h(TreeItem, { label: 'a' })));
    expect(leaf).toContain('dp-tree-item--leaf');
    expect(leaf).not.toContain('<details');

    const branch = render(h(Tree, null, h(TreeItem, { label: 'a' }, h(TreeItem, { label: 'b' }))));
    expect(branch).toContain('dp-tree-item--branch');
  });

  it('can open from the start', () => {
    const html = render(
      h(Tree, null, h(TreeItem, { label: 'a', open: true }, h(TreeItem, { label: 'b' }))),
    );
    expect(html).toContain('<details class="dp-tree-details" open');
  });

  it('does not announce a navigation it does not implement', () => {
    // `role="tree"` promises arrow-key movement: nothing here provides it.
    expect(render(h(Tree, null, h(TreeItem, { label: 'a' })))).not.toContain('role="tree');
  });

  it('refuses a lone entry, which would be an li outside a list', () => {
    expect(() => render(h(TreeItem, { label: 'a' }))).toThrow(DocPensieveError);
  });

  it('refuses an entry without a label', () => {
    expect(() => render(h(Tree, null, h(TreeItem, null)))).toThrow(DocPensieveError);
  });
});

describe('ScrollToTop', () => {
  it('targets the top of the document without requiring anything from the page', () => {
    // The specification reserves the “top” fragment for the top of the
    // document when no element carries that identifier: nothing to add to the
    // template.
    const html = render(h(ScrollToTop, null));
    expect(html).toContain('href="#top"');
    expect(html).toContain('aria-label="Back to top"');
  });

  it('hides the arrow from screen readers', () => {
    // It repeats the label of the link: announcing it twice tells nothing.
    expect(render(h(ScrollToTop, null))).toContain('aria-hidden="true"');
  });

  it('accepts content in place of the arrow', () => {
    const html = render(h(ScrollToTop, { label: 'Top' }, 'Top of page'));
    expect(html).toContain('Top of page');
    expect(html).not.toContain('<svg');
  });
});

describe('Skill', () => {
  it('describes a measure within a known range', () => {
    const html = render(h(Skill, { name: 'CSS', level: 80 }));
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="80"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('--dp-skill-level:80%');
  });

  it('can hide the figure without removing it from what is announced', () => {
    const html = render(h(Skill, { name: 'CSS', level: 80, showValue: false }));
    expect(html).not.toContain('dp-skill-value');
    expect(html).toContain('aria-valuenow="80"');
  });

  it('accepts a comment under the bar', () => {
    expect(render(h(Skill, { name: 'CSS', level: 40 }, 'In progress'))).toContain('In progress');
  });

  it('draws a dial when asked', () => {
    const html = render(h(Skill, { name: 'CSS', level: 85, shape: 'circle' }));
    expect(html).toContain('dp-skill dp-skill--circle');
    expect(html).toContain('<svg');
    // The circumference is a hundred: the level is directly the drawn share.
    expect(html).toContain('--dp-skill-level:85');
    expect(html).not.toContain('dp-skill-track');
  });

  it('announces the measure whatever the shape', () => {
    // The SVG is decorative: the wrapper carries the role, so what is
    // announced does not depend on what is drawn.
    const circle = render(h(Skill, { name: 'CSS', level: 85, shape: 'circle' }));
    expect(circle).toContain('role="meter"');
    expect(circle).toContain('aria-valuenow="85"');
    expect(circle).toContain('aria-hidden="true"');
  });

  it('accepts an icon before the name', () => {
    const html = render(h(Skill, { name: 'CSS', level: 50, icon: h('i', null, '★') }));
    expect(html).toContain('dp-skill-icon');
    expect(html).toContain('★');
  });

  it('tints the fill without touching what it announces', () => {
    // A variable, read in the same place by the bar and by the circle.
    const html = render(h(Skill, { name: 'CSS', level: 50, color: 'tomato' }));
    expect(html).toContain('--dp-skill-color:tomato');
    expect(html).toContain('aria-valuenow="50"');
  });

  it('requires label when the name is not text', () => {
    // A composite name gave no accessible name: the gauge announced itself as
    // “50%” without saying of what.
    const name = h('em', null, 'CSS');
    expect(() => render(h(Skill, { name, level: 50 }))).toThrow(DocPensieveError);
    expect(render(h(Skill, { name, level: 50, label: 'CSS' }))).toContain('aria-label="CSS"');
  });

  it('refuses an unknown shape', () => {
    expect(() => render(h(Skill, { name: 'CSS', level: 50, shape: 'square' }))).toThrow(
      DocPensieveError,
    );
  });

  it('refuses a level outside the range', () => {
    // The string is deliberate: a level that is not a number must be refused
    // like an out-of-bounds level.
    for (const level of /** @type {any[]} */ ([-1, 101, Number.NaN, '80']))
      expect(() => render(h(Skill, { name: 'CSS', level }))).toThrow(DocPensieveError);
  });

  it('refuses a gauge without a name', () => {
    expect(() => render(h(Skill, { level: 50 }))).toThrow(DocPensieveError);
  });
});

describe('TimeTimer — refused dates', () => {
  it('refuses a date that does not exist', async () => {
    // The Date constructor rolls over rather than failing: without reading
    // back, 32/13 became a valid date of the following year and the block
    // showed at the wrong time, without a word.
    const { TimeTimer } = await import('../src/index.js');
    for (const date of ['32/13/2024', '30/02/2024', '00/01/2024', '15/00/2024'])
      expect(() => render(h(TimeTimer, { date }, 'x')), date).toThrow(DocPensieveError);
  });

  it('accepts a boundary date that really exists', async () => {
    const { TimeTimer } = await import('../src/index.js');
    // 2024 is a leap year: 29 February exists.
    expect(() => render(h(TimeTimer, { date: '29/02/2024' }, 'x'))).not.toThrow();
    expect(() => render(h(TimeTimer, { date: '31/12/2024 23:59' }, 'x'))).not.toThrow();
  });
});

describe('resolveFile outside a build', () => {
  it('refuses to resolve a file without a page context', async () => {
    // A component used outside the generator has no root to search from.
    const { resolveFile } = await import('../src/index.js');
    setSiteContext({});
    expect(() => resolveFile('./logo.svg')).toThrow(/source folder/);
  });
});

describe('LogoIcon', () => {
  const SVG = '<svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z" fill="currentColor"/></svg>';

  it('puts the content of the file in the page', () => {
    // That is the point compared to an img tag: the SVG becomes stylable.
    versionWith('logo.svg', SVG);
    const html = render(h(LogoIcon, { src: './logo.svg' }));
    expect(html).toContain('viewBox="0 0 16 16"');
    expect(html).toContain('currentColor');
  });

  it('removes what would run', () => {
    versionWith(
      'dirty.svg',
      '<svg onload="alert(1)"><script>alert(2)</script><path onclick="x()"/></svg>',
    );
    const html = render(h(LogoIcon, { src: './dirty.svg' }));
    expect(html).not.toContain('onload');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('alert(2)');
  });

  it('resolves an absolute target from the version folder', () => {
    versionWith('logo.svg', SVG);
    expect(render(h(LogoIcon, { src: '/logo.svg' }))).toContain('viewBox');
  });

  it('hides a decorative icon, describes an icon that carries meaning', () => {
    versionWith('logo.svg', SVG);
    expect(render(h(LogoIcon, { src: './logo.svg' }))).toContain('aria-hidden="true"');

    const described = render(h(LogoIcon, { src: './logo.svg', label: 'Repository' }));
    expect(described).toContain('role="img"');
    expect(described).toContain('aria-label="Repository"');
  });

  it('accepts a size', () => {
    versionWith('logo.svg', SVG);
    expect(render(h(LogoIcon, { src: './logo.svg', size: '2rem' }))).toContain(
      '--dp-logo-icon-size:2rem',
    );
  });

  it('refuses to leave the version folder', () => {
    versionWith('logo.svg', SVG);
    expect(() => render(h(LogoIcon, { src: '../elsewhere.svg' }))).toThrow(DocPensieveError);
  });

  it('names the missing file instead of rendering an empty box', () => {
    versionWith('logo.svg', SVG);
    expect(() => render(h(LogoIcon, { src: './missing.svg' }))).toThrow(DocPensieveError);
  });

  it('refuses a file that is not an SVG', () => {
    versionWith('fake.svg', 'this is not an SVG');
    expect(() => render(h(LogoIcon, { src: './fake.svg' }))).toThrow(DocPensieveError);
  });

  it('refuses a call without src', () => {
    expect(() => render(h(LogoIcon, {}))).toThrow(DocPensieveError);
  });
});
