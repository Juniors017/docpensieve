/**
 * Orchestration: loader → compiler → Handlebars shell → disk.
 *
 * @module @docpensieve/core/generator
 */

import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOC_EXTENSIONS,
  assetPathToSlug,
  dirPathToSlug,
  GeneratorError,
  PAGE_LAYOUTS,
  ThemeError,
  VERSIONS_MANIFEST,
} from '@docpensieve/shared';
import Handlebars from 'handlebars';

import { Compiler } from './compiler.js';
import { resolveVersion } from './config.js';
import { DocLoader } from './loader.js';
import { buildSidebar, collectSectionTitles } from './sidebar.js';
import { StructuredDataBuilder } from './structured-data.js';

/** Template folder, resolved from this module rather than from the cwd. */
const TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');

/** Path of the stylesheet written into every version. */
const STYLESHEET = 'assets/docpensieve.css';

/** Collects the values of the `class` attributes of an HTML document. */
const CLASS_ATTRIBUTE = /class="([^"]*)"/g;

/** Folders never copied from the sources. */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'coverage']);

/**
 * Joins a URL path while avoiding doubled slashes.
 *
 * @param {...string} parts
 * @returns {string} Path starting and ending with `/`.
 */
function joinUrl(...parts) {
  const segments = parts.flatMap((part) => String(part).split('/')).filter(Boolean);
  return segments.length > 0 ? `/${segments.join('/')}/` : '/';
}

/**
 * Contents of the `<title>` tag.
 *
 * The page title followed by the project name, which tells tabs and search
 * results apart — unless both are the same, as on a home page named after the
 * project: "DocPensieve · DocPensieve" said nothing more.
 *
 * @param {string | undefined} title Title from the frontmatter.
 * @param {string} projectName
 * @returns {string}
 */
function documentTitle(title, projectName) {
  if (!title || title === projectName) return projectName;
  return projectName ? `${title} · ${projectName}` : title;
}

/**
 * Layout requested by a page.
 *
 * @param {import('./loader.js').Doc} doc
 * @returns {string} A value of `PAGE_LAYOUTS`.
 * @throws {GeneratorError} When the frontmatter asks for another one: a typo
 *   would otherwise render the page in a layout other than the intended one,
 *   without a word.
 */
function pageLayout(doc) {
  const requested = doc.frontmatter?.layout;
  if (requested === undefined || requested === null || requested === '') return 'doc';

  if (!PAGE_LAYOUTS.includes(requested)) {
    throw new GeneratorError(`Unknown layout in "${doc.path}": "${requested}".`, {
      hint: `Accepted values: ${PAGE_LAYOUTS.join(', ')}.`,
    });
  }
  return requested;
}

/**
 * Notice to put on the pages of a version that is not the current one.
 *
 * A version in preparation, or an archived one, looks exactly like the one
 * that counts. Someone landing there from a search engine has no way of
 * noticing: they must be told, and given somewhere to go.
 *
 * @param {import('./config.js').Version} version
 * @param {import('./config.js').Version | undefined} current
 * @param {string} baseUrl
 * @returns {{ prerelease: boolean, name: string, url: string } | null}
 */
function versionNotice(version, current, baseUrl) {
  if (version.current) return null;
  if (!version.prerelease && !version.archived) return null;
  // Without a current version, the notice would have nowhere to point to.
  if (!current || current.slug === version.slug) return null;

  return {
    prerelease: version.prerelease === true,
    name: current.name,
    url: joinUrl(baseUrl, 'versions', current.slug),
  };
}

/** Generates the static site of one or more versions. */
export class SiteGenerator {
  /** @type {((data: any) => string) | null} */
  #layout = null;

  /**
   * @param {import('./config.js').DocPensieveConfig} config Normalised config.
   * @param {{
   *   components?: Record<string, Function>,
   *   theme?: any,
   *   loader?: DocLoader,
   *   compiler?: Compiler,
   *   onPage?: (page: {
   *     url: string, dirUrl?: string, basePath: string,
   *     filepath?: string, sourceDir?: string,
   *   }) => void,
   * }} [deps]
   *   Global components and the theme are injected rather than imported:
   *   `core` stays independent of `components` and `theme` (ADR-002). `loader`
   *   and `compiler` only serve tests. `onPage` is called before every page:
   *   components learn from it the URL they render, which the compiler
   *   plugins cannot tell them (ADR-006), and how to find a file of the
   *   version.
   */
  constructor(config, deps = {}) {
    this.config = config;
    this.deps = deps;
    this.loader = deps.loader ?? new DocLoader();
    this.compiler = deps.compiler ?? new Compiler({ components: deps.components ?? {} });
  }

  /**
   * Generates one version into a folder.
   *
   * @param {string} versionSlug Slug of the version to generate.
   * @param {string} outDir Output folder of that version.
   * @returns {Promise<{ pages: number, outDir: string }>}
   * @throws {GeneratorError} Write failure.
   */
  async buildVersion(versionSlug, outDir) {
    const version = resolveVersion(this.config, versionSlug);
    const rootDir = this.config.rootDir ?? process.cwd();
    const target = path.resolve(rootDir, outDir);

    const sourceDir = path.resolve(rootDir, version.folder);
    const docs = await this.loader.load(sourceDir);

    // A version without pages still published a redirect to itself: the site
    // root led to a page that did not exist.
    if (docs.length === 0) {
      throw new GeneratorError(`Version "${version.slug}" has no page to publish.`, {
        hint: `Add a page to ${version.folder}, or remove "draft: true" from the existing ones.`,
      });
    }

    const versionBase = joinUrl(this.config.baseUrl, 'versions', version.slug);
    /** @param {import('./loader.js').Doc} doc */
    const pageUrl = (doc) => joinUrl(versionBase, doc.slug);

    const current = this.config.versions.find((candidate) => candidate.current);
    const notice = versionNotice(version, current, this.config.baseUrl);

    const sidebar = buildSidebar(docs, pageUrl, { brand: this.config.projectName });
    const breadcrumbTitles = collectSectionTitles(docs);
    const layout = await this.#loadLayout();
    const classes = this.#classes();

    // The classes of every rendered page are collected along the way: a
    // utility provider such as Tailwind only emits the rules actually used,
    // including those written by hand in the MDX.
    /** @type {Set<string>} */
    const candidates = new Set();

    // Everything written into the version, and where it comes from. An asset
    // landing on a page, on another asset or on the theme stylesheet
    // overwrote it without a word: the last one written won.
    /** @type {Map<string, string>} */
    const written = new Map([
      [path.join(target, ...STYLESHEET.split('/')), 'the theme stylesheet'],
    ]);

    for (const doc of docs) {
      const url = pageUrl(doc);

      // Base of relative targets: the source file's folder, mapped into URL
      // space. Not the page URL, which has one more level — `./diagram.png`
      // written in `guide/install.md` would otherwise point to
      // `/guide/install/diagram.png`, whereas the file is output under `/guide/`.
      const folder = dirPathToSlug(path.relative(sourceDir, path.dirname(doc.path)));
      const dirUrl = joinUrl(versionBase, folder);
      // Components need to know which page they render: a link they produce
      // escapes the compiler plugins (ADR-006).
      this.deps.onPage?.({ url, dirUrl, basePath: versionBase, filepath: doc.path, sourceDir });

      const { html, toc, preloads } = await this.compiler.compile(doc.content, {
        filepath: doc.path,
        url,
        dirUrl,
        basePath: versionBase,
      });

      const jsonld = new StructuredDataBuilder(doc.frontmatter, url, this.config, {
        breadcrumbTitles,
        basePath: versionBase,
        dirUrl,
      }).toScriptTag();

      // A home page has neither menu nor table of contents: those are reading
      // landmarks within a document, not in an entrance hall.
      const wide = pageLayout(doc) === 'home';

      const page = layout({
        lang: this.config.lang ?? 'en',
        darkModeClass: null,
        title: documentTitle(doc.frontmatter.title, this.config.projectName),
        description: doc.frontmatter.description ?? '',
        canonical: this.config.siteUrl ? new URL(url, this.config.siteUrl).href : '',
        projectName: this.config.projectName,
        versionName: version.name,
        homeUrl: versionBase,
        currentUrl: url,
        cssHref: joinUrl(versionBase, path.dirname(STYLESHEET)) + path.basename(STYLESHEET),
        cls: classes,
        versions: this.#versionLinks(version.slug),
        // A switcher offering a single choice is not a switcher.
        showVersions: this.config.versions.length > 1,
        wide,
        // The back-to-top button is page furniture, not content: writing it in
        // every file would repeat it everywhere, and forget it somewhere.
        scrollToTop: this.config.scrollToTop !== false,
        notice,
        // A version in preparation must not compete with the current one:
        // same content, two addresses, and the wrong one comes up. "follow"
        // still lets its links be followed.
        noindex: version.prerelease === true,
        sidebar: wide ? [] : sidebar,
        toc: wide ? [] : toc,
        preloads,
        content: html,
        jsonld,
      });

      for (const [, value] of page.matchAll(CLASS_ATTRIBUTE)) {
        for (const token of value.split(/\s+/)) if (token) candidates.add(token);
      }

      const destination = path.join(target, ...doc.slug.split('/').filter(Boolean), 'index.html');
      written.set(destination, path.relative(sourceDir, doc.path).split(path.sep).join('/'));
      await this.#write(destination, page);
    }

    await this.#copyAssets(sourceDir, target, '', written);

    // The stylesheet is compiled last: it needs the classes above.
    const { css } = await this.deps.theme.compile({ candidates: [...candidates] });
    await this.#write(path.join(target, ...STYLESHEET.split('/')), css);

    return { pages: docs.length, outDir: target };
  }

  /**
   * Generates every declared version, plus `versions.json` and a root that
   * redirects to the current version.
   *
   * @returns {Promise<{ versions: number, pages: number, outDir: string }>}
   */
  async buildAll() {
    const rootDir = this.config.rootDir ?? process.cwd();
    const target = path.resolve(rootDir, this.config.outDir);

    let pages = 0;
    for (const version of this.config.versions) {
      const result = await this.buildVersion(
        version.slug,
        path.join(target, 'versions', version.slug),
      );
      pages += result.pages;
    }

    await this.#writeManifest(target);
    await this.#writeRootRedirect(target);

    return { versions: this.config.versions.length, pages, outDir: target };
  }

  /**
   * Class aliases of the injected theme.
   *
   * The theme is a dependency, not an option: without it the site would come
   * out with no style and no classes, which would be noticed much later than
   * an error here.
   *
   * @returns {Record<string, string>}
   * @throws {ThemeError} When no theme was injected.
   */
  #classes() {
    if (!this.deps.theme?.compile) {
      throw new ThemeError('No theme injected into the generator.', {
        hint: 'Pass a ThemeEngine in the second argument of SiteGenerator.',
      });
    }
    return this.deps.theme.classes ?? {};
  }

  /**
   * Loads and compiles the shell once per generator.
   *
   * Partials are registered on an isolated Handlebars environment: the
   * package's global singleton is shared by the whole process, including
   * application code that asked for nothing.
   *
   * @returns {Promise<(data: any) => string>}
   */
  async #loadLayout() {
    if (this.#layout) return this.#layout;

    const [layout, navItems, tocItems] = await Promise.all(
      ['layout.hbs', 'nav-items.hbs', 'toc-items.hbs'].map((file) =>
        readFile(path.join(TEMPLATE_DIR, file), 'utf8'),
      ),
    );

    const handlebars = Handlebars.create();
    handlebars.registerHelper('eq', (a, b) => a === b);
    handlebars.registerPartial('navItems', navItems);
    handlebars.registerPartial('tocItems', tocItems);

    this.#layout = handlebars.compile(layout);
    return this.#layout;
  }

  /**
   * Links of the version switcher.
   *
   * @param {string} currentSlug
   * @returns {{ slug: string, name: string, url: string, current: boolean }[]}
   */
  #versionLinks(currentSlug) {
    return this.config.versions.map((version) => ({
      slug: version.slug,
      name: version.name,
      url: joinUrl(this.config.baseUrl, 'versions', version.slug),
      current: version.slug === currentSlug,
      prerelease: version.prerelease === true,
    }));
  }

  /**
   * Writes a file, creating its folder on the way.
   *
   * @param {string} filepath
   * @param {string} contents
   */
  async #write(filepath, contents) {
    try {
      await mkdir(path.dirname(filepath), { recursive: true });
      await writeFile(filepath, contents, 'utf8');
    } catch (cause) {
      throw new GeneratorError(`Could not write ${filepath}.`, {
        cause,
        hint: 'Check the permissions on the output folder.',
      });
    }
  }

  /**
   * Copies everything that is not a page: images, PDFs, attachments.
   *
   * Folders go through the same transformation as pages: without it, a
   * folder's ordering prefix — `02-guide` — would vanish from the URLs of the
   * pages but stay in those of their images, and every relative reference
   * would miss. The file name itself stays untouched: it is the one the
   * author wrote.
   *
   * @param {string} sourceDir
   * @param {string} target
   * @param {string} [relative] Current sub-path, for recursion.
   * @param {Map<string, string>} [written] Destinations already taken, and their origin.
   * @returns {Promise<number>} Number of files copied.
   * @throws {GeneratorError} Destination collision, symbolic link, copy failure.
   */
  async #copyAssets(sourceDir, target, relative = '', written = new Map()) {
    const current = path.join(sourceDir, relative);
    const entries = await readdir(current, { withFileTypes: true });
    let copied = 0;

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const next = path.join(relative, entry.name);
      // For messages: the same path, separated as in a URL whatever the
      // system — that is how the author reads it in their pages.
      const readable = next.split(path.sep).join('/');

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        copied += await this.#copyAssets(sourceDir, target, next, written);
        continue;
      }

      // A symbolic link is not followed: it could lead outside the version.
      // Copying it blindly crashed the copy on a linked folder, stack
      // included, and its pages went missing without anything saying so.
      if (!entry.isFile()) {
        throw new GeneratorError(`Symbolic link not followed: "${readable}".`, {
          hint: 'Put its content in the version folder rather than linking to it.',
        });
      }

      if (DOC_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) continue;

      const destination = path.join(target, ...assetPathToSlug(next).split('/'));
      const existing = written.get(destination);
      if (existing !== undefined) {
        throw new GeneratorError(
          `"${readable}" and "${existing}" would be written to the same place.`,
          { hint: 'Rename or move one of them: the second would overwrite the first.' },
        );
      }
      written.set(destination, readable);

      try {
        await mkdir(path.dirname(destination), { recursive: true });
        await copyFile(path.join(current, entry.name), destination);
      } catch (cause) {
        throw new GeneratorError(`Could not copy "${readable}".`, {
          cause,
          hint: 'Check the permissions on the file and on the output folder.',
        });
      }
      copied += 1;
    }

    return copied;
  }

  /**
   * Writes the manifest the version switcher will read (roadmap § 4.1).
   *
   * @param {string} target
   */
  async #writeManifest(target) {
    const manifest = {
      versions: this.config.versions.map((version) => ({
        slug: version.slug,
        name: version.name,
        url: joinUrl(this.config.baseUrl, 'versions', version.slug),
        current: version.current === true,
        archived: version.archived === true,
        prerelease: version.prerelease === true,
      })),
    };

    await this.#write(
      path.join(target, VERSIONS_MANIFEST),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  /**
   * Writes a root that leads to the current version.
   *
   * An HTML redirect rather than a server rule: the output must stay
   * publishable on any static hosting, GitHub Pages included.
   *
   * @param {string} target
   */
  async #writeRootRedirect(target) {
    const current = resolveVersion(this.config);
    const url = joinUrl(this.config.baseUrl, 'versions', current.slug);

    // The project and version names come from the configuration: a "<" or a
    // "&" in them would break the page.
    /** @param {unknown} value */
    const escape = (value) =>
      String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    const name = escape(this.config.projectName);

    await this.#write(
      path.join(target, 'index.html'),
      [
        '<!doctype html>',
        `<html lang="${escape(this.config.lang ?? 'en')}">`,
        '  <head>',
        '    <meta charset="utf-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
        `    <meta http-equiv="refresh" content="0; url=${url}" />`,
        `    <link rel="canonical" href="${url}" />`,
        `    <title>${name}</title>`,
        '  </head>',
        '  <body>',
        `    <h1>${name}</h1>`,
        // A label that says where it goes, rather than a raw URL that some
        // screen readers spell out character by character.
        `    <p><a href="${url}">Read version ${escape(current.name)}</a></p>`,
        '  </body>',
        '</html>',
        '',
      ].join('\n'),
    );
  }
}
