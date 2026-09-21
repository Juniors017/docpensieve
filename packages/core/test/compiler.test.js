import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement } from 'react';

import { CompileError } from '@docpensieve/shared';
import { afterAll, describe, expect, it } from 'vitest';

import { Compiler } from '../src/index.js';

/**
 * Sample global component, representative of those the project ships.
 * @param {{ title?: any, children?: any }} props
 */
const Card = ({ title, children }) =>
  createElement('div', { className: 'card' }, createElement('h4', null, title), children);

/** Compiler without highlighting: Shiki loads grammars, useless here. */
const plain = (options = {}) => new Compiler({ highlight: false, ...options });

describe('content rendering', () => {
  it('compiles plain Markdown', async () => {
    const { html } = await plain().compile('# Title\n\nA paragraph.');
    expect(html).toBe('<h1 id="title">Title</h1>\n<p>A paragraph.</p>');
  });

  it('applies remark-gfm', async () => {
    const { html } = await plain().compile('~~struck~~\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<del>struck</del>');
    expect(html).toContain('<table>');
  });

  it('accepts an empty source', async () => {
    await expect(plain().compile('')).resolves.toMatchObject({ html: '', toc: [] });
  });

  it('leaves no React marker in the output', async () => {
    const { html } = await plain().compile('# Title');
    expect(html).not.toContain('data-reactroot');
    expect(html).not.toMatch(/<!--\s*-->/);
  });
});

describe('global components', () => {
  it('renders a component without an import in the source', async () => {
    const { html } = await plain({ components: { Card } }).compile(
      '<Card title="Trial">Body</Card>',
    );
    expect(html).toBe('<div class="card"><h4>Trial</h4>Body</div>');
  });

  it('mixes Markdown and a component', async () => {
    const { html } = await plain({ components: { Card } }).compile(
      '## Section\n\n<Card title="T">**bold**</Card>',
    );
    expect(html).toContain('<h2 id="section">Section</h2>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('names the unknown component and lists the existing ones', async () => {
    try {
      await plain({ components: { Card } }).compile('<Timeline />', { filepath: 'page.mdx' });
      expect.unreachable('compile should have thrown');
    } catch (error) {
      const failure = /** @type {CompileError} */ (error);
      expect(failure).toBeInstanceOf(CompileError);
      expect(failure.message).toContain('Timeline');
      expect(failure.message).toContain('page.mdx');
      expect(failure.hint).toContain('Card');
    }
  });

  it('says so clearly when no component is registered', async () => {
    try {
      await plain().compile('<Timeline />');
      expect.unreachable('compile should have thrown');
    } catch (error) {
      const failure = /** @type {Error & { hint?: string }} */ (error);
      expect(failure.hint).toMatch(/No global component/);
    }
  });
});

describe('compilation errors', () => {
  it('locates an invalid JSX syntax in the file', async () => {
    try {
      await plain().compile('# ok\n\n<Bad attr={ >', { filepath: 'guide/broken.mdx' });
      expect.unreachable('compile should have thrown');
    } catch (error) {
      const failure = /** @type {CompileError} */ (error);
      expect(failure).toBeInstanceOf(CompileError);
      expect(failure.message).toContain('guide/broken.mdx');
      // The position is what makes the message usable.
      expect(failure.message).toMatch(/guide\/broken\.mdx:\d+/);
    }
  });

  it('stays readable without a filepath', async () => {
    await expect(plain().compile('<Bad attr={ >')).rejects.toThrow(/MDX source/);
  });
});

describe('heading anchors', () => {
  it('drops accents, like page slugs', async () => {
    const { html } = await plain().compile('## Première étape');
    expect(html).toContain('id="premiere-etape"');
  });

  it('suffixes duplicate headings instead of producing two identical anchors', async () => {
    const { toc } = await plain().compile('## Notes\n\n## Notes\n\n## Notes');
    expect(toc.map((entry) => entry.id)).toEqual(['notes', 'notes-1', 'notes-2']);
  });

  it('gives a fallback anchor to a heading without usable text', async () => {
    const { html } = await plain().compile('## !!!');
    expect(html).toContain('id="section"');
  });
});

describe('table of contents', () => {
  it('nests the levels', async () => {
    const { toc } = await plain().compile('## A\n\n### A1\n\n### A2\n\n## B');
    expect(toc).toHaveLength(2);
    expect(toc[0]).toMatchObject({ id: 'a', text: 'A', depth: 2 });
    expect(toc[0].children.map((entry) => entry.id)).toEqual(['a1', 'a2']);
    expect(toc[1].children).toEqual([]);
  });

  it('excludes h1 and h4 by default', async () => {
    const { toc } = await plain().compile('# Title\n\n## Section\n\n#### Detail');
    expect(toc.map((entry) => entry.id)).toEqual(['section']);
  });

  it('honours tocDepth', async () => {
    const { toc } = await plain({ tocDepth: [1, 2] }).compile('# Title\n\n## Section\n\n### Sub');
    expect(toc.map((entry) => entry.id)).toEqual(['title']);
    expect(toc[0].children.map((entry) => entry.id)).toEqual(['section']);
  });

  it('keeps the text of headings with markup', async () => {
    const { toc } = await plain().compile('## The `code` word counts');
    expect(toc[0].text).toBe('The code word counts');
  });
});

describe('images', () => {
  it('resolves a relative image against the page URL when no folder is given', async () => {
    const { html } = await plain().compile('![a](./diagram.png)', { url: '/guide/install/' });
    expect(html).toContain('src="/guide/install/diagram.png"');
  });

  it('climbs .. segments', async () => {
    const { html } = await plain().compile('![a](../shared/logo.png)', { url: '/guide/install/' });
    expect(html).toContain('src="/guide/shared/logo.png"');
  });

  it('leaves absolute and external URLs untouched', async () => {
    const { html } = await plain().compile(
      '![a](/assets/a.png)\n\n![b](https://example.com/b.png)\n\n![c](data:image/gif;base64,R0lGOD)',
      { url: '/guide/install/' },
    );
    expect(html).toContain('src="/assets/a.png"');
    expect(html).toContain('src="https://example.com/b.png"');
    expect(html).toContain('src="data:image/gif;base64,R0lGOD"');
  });

  it('leaves the src as is without a page URL', async () => {
    const { html } = await plain().compile('![a](./diagram.png)');
    expect(html).toContain('src="./diagram.png"');
  });
});

describe('preloads', () => {
  it('takes link rel=preload out of the fragment and returns them apart', async () => {
    // React 19 hoists them before the content with no way to turn it off;
    // they belong in the <head>, which the generator will write.
    const { html, preloads } = await plain().compile('![a](./a.png)', { url: '/p/' });
    expect(html).not.toContain('rel="preload"');
    expect(html.startsWith('<p>')).toBe(true);
    expect(preloads).toEqual([{ href: '/p/a.png', as: 'image' }]);
  });

  it('returns an empty list when there is nothing to preload', async () => {
    const { preloads } = await plain().compile('# Nothing');
    expect(preloads).toEqual([]);
  });
});

describe('syntax highlighting', () => {
  // Generous timeout: the very first call loads the Shiki engine and grammars
  // (~4 s). The cost is paid once per process, not per page — the following
  // compilations drop to a few milliseconds.
  it('highlights code blocks with Shiki in a dual theme', async () => {
    const { html } = await new Compiler().compile('```js\nconst x = 1;\n```');
    expect(html).toContain('class="shiki');
    // The dual theme goes through CSS variables: no stylesheet to ship.
    expect(html).toContain('--shiki-dark');
  }, 30_000);

  it('leaves a raw block when highlighting is off', async () => {
    const { html } = await plain().compile('```js\nconst x = 1;\n```');
    expect(html).not.toContain('shiki');
    expect(html).toContain('<code');
  });
});

describe('extensibility', () => {
  it('accepts additional rehype plugins', async () => {
    const addClass = () => (/** @type {any} */ tree) => {
      for (const node of tree.children) {
        if (node.type === 'element' && node.tagName === 'p') {
          node.properties = { ...node.properties, className: ['added'] };
        }
      }
    };
    const { html } = await plain({ rehypePlugins: [addClass] }).compile('Text.');
    expect(html).toContain('class="added"');
  });
});

describe('internal links', () => {
  it('resolves a relative link against the page URL', async () => {
    const { html } = await plain().compile('[see](../other/)', { url: '/guide/install/' });
    expect(html).toContain('href="/guide/other/"');
  });

  it('reads an absolute link as starting from the version root', async () => {
    // The author writes /guide/ without knowing their docs will be served
    // under /docpensieve/versions/v1.0/: without this rule, the link breaks.
    const { html } = await plain().compile('[see](/guide/installation/)', {
      url: '/docpensieve/versions/v1.0/',
      basePath: '/docpensieve/versions/v1.0/',
    });
    expect(html).toContain('href="/docpensieve/versions/v1.0/guide/installation/"');
  });

  it('does not prefix an already complete link twice', async () => {
    const { html } = await plain().compile('[see](/versions/v1.0/guide/)', {
      url: '/versions/v1.0/',
      basePath: '/versions/v1.0/',
    });
    expect(html).toContain('href="/versions/v1.0/guide/"');
  });

  it('also rewrites an HTML tag written in JSX', async () => {
    // An `<a href>` written in JSX is not an element node: without its own
    // handling, it escaped the rewrite and pointed outside the prefix.
    const { html } = await plain().compile('<a href="/guide/">see</a>', {
      url: '/base/v1/page/',
      basePath: '/base/v1/',
    });
    expect(html).toContain('href="/base/v1/guide/"');
  });

  it('resolves a relative target written in JSX against the page', async () => {
    const { html } = await plain().compile('<img src="./diagram.png" alt="" />', {
      url: '/base/v1/guide/',
      basePath: '/base/v1/',
    });
    expect(html).toContain('src="/base/v1/guide/diagram.png"');
  });

  it('resolves a relative target from the file folder, not from the page', async () => {
    // A page "guide/install.md" is served under "/guide/install/", one level
    // below the file. Resolving against the page URL would make
    // "./diagram.png" point to a file that does not exist.
    const { html } = await plain().compile('![](./diagram.png)', {
      url: '/guide/install/',
      dirUrl: '/guide/',
      basePath: '/',
    });
    expect(html).toContain('src="/guide/diagram.png"');
  });

  it('resolves a link to a sibling page the same way', async () => {
    const { html } = await plain().compile('[x](./configuration/)', {
      url: '/guide/install/',
      dirUrl: '/guide/',
      basePath: '/',
    });
    expect(html).toContain('href="/guide/configuration/"');
  });

  it('leaves absolute links alone when the site is at the root', async () => {
    const { html } = await plain().compile('[see](/guide/)', { url: '/', basePath: '/' });
    expect(html).toContain('href="/guide/"');
  });

  it('touches neither external links, nor anchors, nor mailto', async () => {
    const { html } = await plain().compile(
      '[a](https://example.com/x) [b](#section) [c](mailto:someone@example.com)',
      { url: '/p/', basePath: '/base/' },
    );
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('href="#section"');
    expect(html).toContain('href="mailto:someone@example.com"');
  });

  it('keeps the query and the fragment of a relative link', async () => {
    const { html } = await plain().compile('[see](./page/?q=1#anchor)', { url: '/guide/' });
    expect(html).toContain('href="/guide/page/?q=1#anchor"');
  });

  it('applies the same rule to absolute images', async () => {
    const { html } = await plain().compile('![a](/img/a.png)', {
      url: '/versions/v1.0/',
      basePath: '/versions/v1.0/',
    });
    expect(html).toContain('src="/versions/v1.0/img/a.png"');
  });
});

describe('tables', () => {
  it('wraps every table in a scrolling, reachable container', async () => {
    // Scrolling the table itself stripped its table role.
    const { html } = await plain().compile(
      `| a | b |
| - | - |
| 1 | 2 |
`,
      { url: '/', basePath: '/' },
    );
    expect(html).toContain('class="dp-table-scroll"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="region"');
    expect(html).toMatch(/dp-table-scroll[^>]*><table/);
  });
});

describe('a snippet, which names a file rather than copying it', () => {
  /** Minimal frame, standing in for the shipped component. */
  const Snippet = (/** @type {{ title?: any, children?: any }} */ { title, children }) =>
    createElement('figure', null, createElement('figcaption', null, title), children);

  const root = mkdtempSync(path.join(tmpdir(), 'docpensieve-snippet-'));
  const file = path.join(root, 'src', 'add.js');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    [
      'export function add(a, b) {',
      '  // #region sum',
      '  return a + b;',
      '  // #endregion',
      '}',
    ].join('\n'),
    'utf8',
  );
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const withSnippet = (options = {}) => plain({ components: { Snippet }, ...options });

  it('reads the file it names and shows it as a block', async () => {
    const { html } = await withSnippet().compile('<Snippet source="src/add.js" />', {
      rootDir: root,
    });

    expect(html).toContain('export function add(a, b)');
    // The file name labels the block, so that a reader can go and open it.
    expect(html).toContain('<figcaption>add.js</figcaption>');
  });

  it('keeps only the region asked for, indentation removed', async () => {
    const { html } = await withSnippet().compile(
      '<Snippet source="src/add.js" region="sum" title="The sum" />',
      { rootDir: root },
    );

    expect(html).toContain('return a + b;');
    expect(html).not.toContain('export function');
    expect(html).toContain('<figcaption>The sum</figcaption>');
  });

  it('takes code typed straight into it, indentation and all', async () => {
    // Read from the page source, not from the parsed tree: Markdown collapses
    // the indentation and reads *args as emphasis. The result would be wrong
    // code, printed as if it were right.
    const { html } = await withSnippet().compile(
      ['<Snippet title="who.py">', 'def f(*args):', '    return args', '</Snippet>'].join('\n'),
      { rootDir: root },
    );

    expect(html).toContain('def f(*args):');
    expect(html).toContain('    return args');
    expect(html).not.toContain('<em>');
    // The extension of the label says the language when nothing else does.
    expect(html).toContain('language-python');
  });

  it('lets the page name the language of code it typed', async () => {
    const { html } = await withSnippet().compile(
      ['<Snippet title="A shell" lang="bash">', 'npm run build', '</Snippet>'].join('\n'),
      { rootDir: root },
    );

    expect(html).toContain('language-bash');
  });

  it('leaves a block the page wrote itself alone', async () => {
    // Without a file named, the component only asked for the frame.
    const { html } = await withSnippet().compile(
      '<Snippet title="who.py">\n\n```python\nname = input()\n```\n\n</Snippet>',
      { rootDir: root },
    );

    expect(html).toContain('name = input()');
    expect(html).toContain('<figcaption>who.py</figcaption>');
  });

  it('stops the build on a file that is not there, and says where it looked', async () => {
    // A snippet resolving to nothing would leave an empty frame that looks
    // deliberate: it is the one outcome to refuse.
    try {
      await withSnippet().compile('<Snippet source="src/absent.js" />', { rootDir: root });
      expect.unreachable('compile should have thrown');
    } catch (error) {
      const failure = /** @type {CompileError} */ (error);
      expect(failure).toBeInstanceOf(CompileError);
      expect(failure.hint).toContain('absent.js');
    }
  });

  it('refuses a file outside the project', async () => {
    await expect(
      withSnippet().compile('<Snippet source="../../../secrets.txt" />', {
        rootDir: root,
        filepath: path.join(root, 'docs', 'page.md'),
      }),
    ).rejects.toThrow(CompileError);
  });
});
