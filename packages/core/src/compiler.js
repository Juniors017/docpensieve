/**
 * Compiles Markdown/MDX content into static HTML.
 *
 * Chosen pipeline: `.md` and `.mdx` both go through @mdx-js/mdx, then the
 * resulting component is rendered by `react-dom/server`. React only serves
 * the build; the HTML produced contains no React runtime.
 *
 * @module @docpensieve/core/compiler
 */

import { closeSync, openSync, readFileSync, readSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as runtime from 'react/jsx-runtime';

import { CompileError, DocPensieveError, slugify } from '@docpensieve/shared';
import { evaluate } from '@mdx-js/mdx';
import rehypeShiki from '@shikijs/rehype';
import remarkGfm from 'remark-gfm';

import { imageSize } from './image-size.js';
import { snippetLanguage, snippetLines, snippetPath } from './snippet.js';

/**
 * Default Shiki themes: the dual theme follows dark mode without JS.
 *
 * The plugin keeps its highlighter in a module singleton: loading the engine
 * and the grammars (~4 s) is paid once per process, not per page. No need,
 * then, to cache a highlighter on the instance.
 */
const DEFAULT_HIGHLIGHT = { themes: { light: 'github-light', dark: 'github-dark' } };

/** Heading depths kept for the table of contents. */
const DEFAULT_TOC_DEPTH = [2, 3];

/** Targets left as they are: external link, anchor, mailto, data:. */
const EXTERNAL_TARGET = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * Attributes carrying a target, per tag.
 * @type {Record<string, string>}
 */
const LINK_ATTRIBUTES = { img: 'src', a: 'href', source: 'src', video: 'src', audio: 'src' };

/**
 * Preload tags that React 19 hoists to the top of its output.
 *
 * React emits one `<link rel="preload">` per image, before the content, with
 * no way to turn it off. They belong in the `<head>`: take them out of the
 * fragment and hand them back to the caller rather than lose them.
 */
const PRELOAD_TAG = /<link\b[^>]*\brel="preload"[^>]*>/g;

/**
 * Extracts the value of an HTML attribute from a serialised tag.
 * @param {string} tag
 * @param {string} name
 */
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

/**
 * @typedef {object} TocEntry
 * @property {string} id      Heading anchor (`'installation'`).
 * @property {string} text    Heading text, tags removed.
 * @property {number} depth   Heading level (2 for `h2`).
 * @property {TocEntry[]} children Nested sub-headings.
 */

/**
 * @typedef {object} Preload
 * @property {string} href Resource to preload.
 * @property {string} as   Resource type (`'image'`).
 */

/**
 * @typedef {object} CompileResult
 * @property {string} html    HTML fragment of the content alone.
 * @property {TocEntry[]} toc Nested table of contents.
 * @property {Preload[]} preloads Resources to preload, meant for the `<head>`.
 */

/**
 * Walks a hast tree depth first.
 *
 * Avoids a dependency on `unist-util-visit` for a dozen lines.
 *
 * @param {any} node
 * @param {(node: any) => void} visitor
 */
function walk(node, visitor) {
  visitor(node);
  for (const child of node.children ?? []) walk(child, visitor);
}

/**
 * Concatenates the text of a hast node, inline tags included.
 *
 * @param {any} node
 * @returns {string}
 */
function textOf(node) {
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

/**
 * Rehype plugin: sets an anchor on every heading and collects the table of
 * contents.
 *
 * Anchors go through `slugify`, like page slugs: a project written in an
 * accented language should not have to choose between accented URLs here
 * and clean ones elsewhere. That is also why `rehype-slug` is not used, since
 * it keeps accents.
 *
 * @param {{ id: string, text: string, depth: number }[]} collected Filled in place.
 * @returns {() => (tree: any) => void}
 */
function rehypeHeadingIds(collected) {
  return () => (tree) => {
    /** @type {Map<string, number>} */
    const counts = new Map();

    walk(tree, (node) => {
      if (node.type !== 'element' || !/^h[1-6]$/.test(node.tagName)) return;

      const text = textOf(node).trim();
      const base = slugify(text) || 'section';

      // Two identical headings in a page are legitimate: suffix the second
      // rather than produce two colliding anchors.
      const seen = counts.get(base) ?? 0;
      counts.set(base, seen + 1);
      const id = seen === 0 ? base : `${base}-${seen}`;

      node.properties = { ...node.properties, id };
      collected.push({ id, text, depth: Number(node.tagName.slice(1)) });
    });
  };
}

/**
 * Rehype plugin: wraps every table in a scrolling container.
 *
 * A table wider than its column must scroll on its own, without widening the
 * page. Scrolling the table itself required `display: block`, which stripped
 * its table role: a screen reader no longer announced rows or columns. The
 * wrapper carries the scrolling, the table stays a table. It is reachable
 * from the keyboard, otherwise a table too wide could only be read with a
 * mouse.
 *
 * @returns {() => (tree: any) => void}
 */
function rehypeTableScroll() {
  return () => (tree) => {
    /** @param {any} parent */
    const wrap = (parent) => {
      const children = parent.children ?? [];
      for (let i = 0; i < children.length; i += 1) {
        const node = children[i];
        if (node.type === 'element' && node.tagName === 'table') {
          children[i] = {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['dp-table-scroll'],
              tabIndex: 0,
              role: 'region',
              ariaLabel: 'Scrollable table',
            },
            children: [node],
          };
        } else {
          wrap(node);
        }
      }
    };
    wrap(tree);
  };
}

/**
 * Rehype plugin: rewrites internal links and media into site URLs.
 *
 * Two rules, from the point of view of a page's author:
 *
 * - a **relative** target (`./diagram.png`, `../guide/`) resolves against the
 *   page's folder, as in any document;
 * - an **absolute** target (`/guide/installation/`) is read as starting from
 *   the version root, not from the domain root. That is what the author
 *   means: their documentation does not know it may be served under
 *   `/docpensieve/versions/v1.0/`.
 *
 * Without the second rule, every absolute internal link would break as soon
 * as a `baseUrl` or a version prefix comes into play. To target a real domain
 * URL, the full URL remains available.
 *
 * @param {{ url?: string, dirUrl?: string, basePath?: string }} context
 *   `dirUrl` is the source file's folder mapped into URL space. It is the base
 *   of relative targets, not the page URL: the latter has one more level, so
 *   `./diagram.png` written in `guide/install.md` would point to
 *   `/guide/install/diagram.png` instead of `/guide/diagram.png`.
 * @returns {() => (tree: any) => void}
 */
function rehypeSiteLinks({ url, dirUrl, basePath }) {
  const base = basePath ?? '/';
  const from = dirUrl ?? url;

  /**
   * Applies both rules to a target.
   *
   * @param {string} target
   * @returns {string | null} The rewritten target, or `null` when there is nothing to do.
   */
  const rewrite = (target) => {
    if (typeof target !== 'string' || target === '' || EXTERNAL_TARGET.test(target)) return null;

    if (target.startsWith('/')) {
      if (base === '/' || target.startsWith(base)) return null;
      return `${base.replace(/\/$/, '')}${target}`;
    }

    if (!from) return null;

    // The origin is throwaway: only the resolved pathname matters. Going
    // through URL handles "./" and "../" without hand-writing a normalisation.
    const resolved = new URL(target, `https://docpensieve.invalid${from}`);
    return resolved.pathname + resolved.search + resolved.hash;
  };

  return () => (tree) => {
    walk(tree, (node) => {
      if (node.type === 'element') {
        const attribute = LINK_ATTRIBUTES[node.tagName];
        if (!attribute) return;

        const rewritten = rewrite(node.properties?.[attribute]);
        if (rewritten !== null) node.properties[attribute] = rewritten;
        return;
      }

      // An HTML tag written in JSX — `<a href="…">` in an `.mdx` page — is
      // not an `element` node: without this second case, it would escape the
      // rewrite and point outside the deployment prefix.
      if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return;

      // Components resolve their own targets: their name starts with a
      // capital letter, and what they do with the value cannot be guessed
      // from here.
      const attribute = LINK_ATTRIBUTES[node.name];
      if (!attribute) return;

      for (const attr of node.attributes ?? []) {
        if (attr.type !== 'mdxJsxAttribute' || attr.name !== attribute) continue;
        // A value in braces is an expression: its result does not exist yet
        // at this stage.
        const rewritten = rewrite(attr.value);
        if (rewritten !== null) attr.value = rewritten;
      }
    });
  };
}

/**
 * Prepares the images of a page for the browser: their dimensions, read from
 * their file, so that the text does not jump when they arrive; and a lazy
 * loading for all but the first, which is often in view — and which React
 * then stops preloading, as it does for every image not loaded lazily.
 *
 * It runs before the targets are rewritten, while `src` is still the path
 * the author wrote next to the page.
 *
 * @param {{ filepath?: string, sourceDir?: string }} context `sourceDir` is
 *   the version's folder, from which an absolute `src` starts.
 * @returns {() => (tree: any) => void}
 */
function rehypeImages({ filepath, sourceDir }) {
  /** @param {string} src @returns {string | null} */
  const fileOf = (src) => {
    let clean;
    try {
      clean = decodeURI(src.split('?')[0].split('#')[0]);
    } catch {
      return null;
    }
    if (clean.startsWith('/')) return sourceDir ? path.join(sourceDir, clean) : null;
    return filepath ? path.resolve(path.dirname(filepath), clean) : null;
  };

  /** @param {string} file */
  const sizeOf = (file) => {
    try {
      const handle = openSync(file, 'r');
      try {
        const bytes = Buffer.alloc(65536);
        const read = readSync(handle, bytes, 0, bytes.length, 0);
        return imageSize(bytes.subarray(0, read), path.extname(file));
      } finally {
        closeSync(handle);
      }
    } catch {
      // A missing image is the link check's business, not this one's.
      return null;
    }
  };

  return () => (tree) => {
    let first = true;
    walk(tree, (node) => {
      if (node.type !== 'element' || node.tagName !== 'img') return;
      const properties = (node.properties ??= {});

      const src = properties.src;
      if (typeof src === 'string' && src !== '' && !EXTERNAL_TARGET.test(src)) {
        const file = fileOf(src);
        const size = file ? sizeOf(file) : null;
        if (size && properties.width === undefined && properties.height === undefined) {
          properties.width = size.width;
          properties.height = size.height;
        }
      }

      if (first) {
        first = false;
        return;
      }
      properties.loading ??= 'lazy';
      properties.decoding ??= 'async';
    });
  };
}

/**
 * Nests a flat list of headings into a tree, by depth.
 *
 * @param {{ id: string, text: string, depth: number }[]} headings
 * @returns {TocEntry[]}
 */
function nest(headings) {
  /** @type {TocEntry[]} */
  const root = [];
  /** @type {TocEntry[]} */
  const stack = [];

  for (const heading of headings) {
    const entry = { ...heading, children: [] };
    // Loop on the index rather than `.at(-1)`: to the analyser, the result of
    // `at` is always possibly `undefined`, even under a length check, and
    // writing it this way makes the invariant readable.
    while (stack.length > 0 && stack[stack.length - 1].depth >= entry.depth) stack.pop();
    (stack.length > 0 ? stack[stack.length - 1].children : root).push(entry);
    stack.push(entry);
  }

  return root;
}

/**
 * Enriches an MDX compilation error with the file and the offending position.
 *
 * @param {any} cause Error raised by MDX, whose shape is not typed.
 * @param {string} [filepath]
 * @returns {CompileError}
 */
function compileError(cause, filepath) {
  const where = filepath ?? 'MDX source';
  const line = cause?.line ?? cause?.place?.start?.line;
  const column = cause?.column ?? cause?.place?.start?.column;
  const position = line ? `${where}:${line}${column ? `:${column}` : ''}` : where;
  const reason = cause?.reason ?? (cause instanceof Error ? cause.message : String(cause));

  return new CompileError(`Compilation error in ${position} — ${reason}`, {
    cause,
    hint: cause?.ruleId === 'acorn' ? 'Check the JSX syntax of the block concerned.' : undefined,
  });
}

/**
 * Fills a `<Snippet>` with the file it names.
 *
 * A remark plugin, not a rehype one: by the time the tree is HTML the
 * attributes of a JSX element are gone — the same reason a `<Card href>`
 * escapes the link rewriting. Here the element is still `mdxJsxFlowElement`,
 * and the file can be read into a code block, which the highlighter then
 * treats like any other.
 *
 * @param {{ filepath?: string, rootDir?: string }} context Page being
 *   compiled, and root of the project.
 * @returns {() => (tree: any, file: any) => void}
 */
function remarkSnippets({ filepath, rootDir }) {
  return () => (/** @type {any} */ tree, /** @type {any} */ file) => {
    const page = String(file?.value ?? '');
    walk(tree, (node) => {
      if (node.type !== 'mdxJsxFlowElement' || node.name !== 'Snippet') return;

      const attributes = (node.attributes ??= []);
      /** @param {string} name @returns {string | undefined} */
      const read = (name) => {
        const found = attributes.find(
          (/** @type {any} */ item) => item.type === 'mdxJsxAttribute' && item.name === name,
        );
        return typeof found?.value === 'string' ? found.value : undefined;
      };

      // No file named: the code is written in the page itself.
      const source = read('source');
      if (source === undefined) {
        inlineCode(node, page, read('lang'), read('title'));
        return;
      }

      const file = snippetPath(source, { filepath, rootDir });
      let content;
      try {
        content = readFileSync(file, 'utf8');
      } catch (cause) {
        throw new CompileError(`The snippet "${source}" reads no file.`, {
          cause,
          hint: `Looked for ${file}. A path starting with "./" or "../" is read from the page, any other from the root of the project.`,
        });
      }

      const value = snippetLines(content, {
        lines: read('lines'),
        region: read('region'),
        file: source,
      });

      // Put back as a code block: the highlighter, the stylesheet and the
      // table of contents then treat it like any block a page writes itself.
      node.children = [{ type: 'code', lang: read('lang') ?? snippetLanguage(file), value }];
      if (read('title') === undefined) {
        attributes.push({ type: 'mdxJsxAttribute', name: 'title', value: path.basename(file) });
      }
    });
  };
}

/**
 * Turns code typed straight into a `<Snippet>` back into a code block.
 *
 * Read from the page source, not from the parsed tree: MDX reads the children
 * of a tag as Markdown, so indentation is collapsed and `*args` comes out in
 * italics. The offsets of the nodes say where the content sits in the file,
 * and the file tells the truth.
 *
 * A fenced block is left alone — it already carries anything, braces and `<`
 * included, which bare code cannot: MDX reads those as expressions before any
 * plugin runs.
 *
 * @param {any} node The `<Snippet>` element.
 * @param {string} page Source of the page being compiled.
 * @param {string | undefined} lang Language the page declared.
 * @param {string | undefined} title Label, whose extension names a language.
 */
function inlineCode(node, page, lang, title) {
  const children = node.children ?? [];
  if (children.length === 0 || children.some((/** @type {any} */ child) => child.type === 'code')) {
    return;
  }

  const first = children[0]?.position?.start?.offset;
  const last = children[children.length - 1]?.position?.end?.offset;
  if (typeof first !== 'number' || typeof last !== 'number') return;

  // From the start of the line: the indentation of the first line is part of
  // the code, and Markdown has already eaten it once.
  const lineStart = page.lastIndexOf('\n', first - 1) + 1;

  node.children = [
    {
      type: 'code',
      lang: lang ?? snippetLanguage(title ?? ''),
      value: snippetLines(page.slice(lineStart, last)),
    },
  ];
}

/** Compiles an MDX/Markdown source into an HTML fragment. */
export class Compiler {
  /**
   * @param {{
   *   components?: Record<string, Function>,
   *   remarkPlugins?: any[],
   *   rehypePlugins?: any[],
   *   highlight?: false | Record<string, any>,
   *   tocDepth?: [number, number],
   * }} [options]
   *   `components` is the table of global components injected into MDX: it is
   *   what lets a page write `<Card>` without an import. `highlight` takes the
   *   @shikijs/rehype options, or `false` to turn highlighting off. `tocDepth`
   *   bounds the headings kept in the table of contents.
   */
  constructor(options = {}) {
    this.options = options;
    this.components = options.components ?? {};
    this.remarkPlugins = options.remarkPlugins ?? [];
    this.rehypePlugins = options.rehypePlugins ?? [];
    this.highlight = options.highlight === undefined ? DEFAULT_HIGHLIGHT : options.highlight;
    this.tocDepth = options.tocDepth ?? DEFAULT_TOC_DEPTH;
  }

  /**
   * Compiles a source into an HTML fragment and a table of contents.
   *
   * @param {string} source Markdown/MDX content, frontmatter already removed.
   * @param {{
   *   filepath?: string, url?: string, dirUrl?: string, basePath?: string,
   *   sourceDir?: string, rootDir?: string,
   * }} [context]
   *   `filepath` locates errors, `dirUrl` is the base of relative targets and
   *   `basePath` prefixes absolute targets (the version root). `rootDir` is
   *   the project a snippet may read a file from.
   * @returns {Promise<CompileResult>}
   * @throws {CompileError} Invalid syntax, or a component unknown at use.
   */
  async compile(source, context = {}) {
    const { filepath, url, dirUrl, basePath, sourceDir, rootDir } = context;

    /** @type {{ id: string, text: string, depth: number }[]} */
    const headings = [];

    const rehypePlugins = [
      rehypeHeadingIds(headings),
      rehypeImages({ filepath, sourceDir }),
      rehypeSiteLinks({ url, dirUrl, basePath }),
      rehypeTableScroll(),
      ...(this.highlight ? [[rehypeShiki, this.highlight]] : []),
      ...this.rehypePlugins,
    ];

    /** @type {any} */
    let MDXContent;
    try {
      ({ default: MDXContent } = await evaluate(source, {
        ...runtime,
        remarkPlugins: [remarkGfm, remarkSnippets({ filepath, rootDir }), ...this.remarkPlugins],
        rehypePlugins,
      }));
    } catch (cause) {
      // An error of ours already says what to do: re-wrapped, it would come
      // out as a generic syntax complaint and lose its hint. A snippet naming
      // a file that is not there is the case that showed it.
      if (cause instanceof DocPensieveError) throw cause;
      throw compileError(cause, filepath);
    }

    /** @type {string} */
    let rendered;
    try {
      rendered = renderToStaticMarkup(createElement(MDXContent, { components: this.components }));
    } catch (cause) {
      throw this.#renderError(cause, filepath);
    }

    const preloads = [...rendered.matchAll(PRELOAD_TAG)].map(([tag]) => ({
      href: attribute(tag, 'href') ?? '',
      as: attribute(tag, 'as') ?? '',
    }));
    const html = rendered.replace(PRELOAD_TAG, '');

    const [min, max] = this.tocDepth;
    const toc = nest(headings.filter((heading) => heading.depth >= min && heading.depth <= max));

    return { html, toc, preloads };
  }

  /**
   * Turns a React rendering error into an actionable message.
   *
   * The common case is a `<Thing>` used in a page while no component of that
   * name is registered: MDX then raises an error that does not say what *is*
   * available.
   *
   * @param {unknown} cause
   * @param {string} [filepath]
   * @returns {CompileError}
   */
  #renderError(cause, filepath) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const missing = message.match(/Expected component `([^`]+)`/);

    if (missing) {
      const available = Object.keys(this.components).sort();
      return new CompileError(
        `Unknown component "${missing[1]}" in ${filepath ?? 'the MDX source'}.`,
        {
          cause,
          hint:
            available.length > 0
              ? `Available components: ${available.join(', ')}.`
              : 'No global component is registered for this compilation.',
        },
      );
    }

    return compileError(cause, filepath);
  }
}
