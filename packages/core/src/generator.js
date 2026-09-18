/**
 * Orchestration: loader → compiler → Handlebars shell → disk.
 *
 * @module @docpensieve/core/generator
 */

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ConfigError,
  DOC_EXTENSIONS,
  assetPathToSlug,
  dirPathToSlug,
  GeneratorError,
  PAGE_LAYOUTS,
  ThemeError,
  VERSIONS_MANIFEST,
} from '@docpensieve/shared';
import Handlebars from 'handlebars';

import { buildAuthorTable, buildByline, readDate } from './authors.js';
import { Compiler } from './compiler.js';
import { resolveVersion } from './config.js';
import { DocLoader } from './loader.js';
import { buildFeed, buildRobots, buildSitemap } from './discovery.js';
import { imageSize } from './image-size.js';
import { minifyCss } from './minify-css.js';
import { SEARCH_SLUG, htmlToText, searchPageContent } from './search-index.js';
import {
  buildSidebar,
  buildSidebarFromDescription,
  collectSectionTitles,
  foldSidebar,
} from './sidebar.js';
import { StructuredDataBuilder } from './structured-data.js';

/** Template folder, resolved from this module rather than from the cwd. */
const TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');

/** Path of the stylesheet written into every version. */
const STYLESHEET = 'assets/docpensieve.css';

/** Index of a version, which the search page reads. */
const SEARCH_INDEX = 'assets/search-index.json';

/** Script of the search page, the only one a site loads. */
const SEARCH_SCRIPT = 'assets/search.js';

/** Source of that script, shipped with this package. */
const CLIENT_SEARCH = fileURLToPath(new URL('../client/search.js', import.meta.url));

/**
 * Targets a preview keeps as they are: another site, an anchor, a data URI.
 * Same rule as the compiler and the components apply to a link.
 */
const EXTERNAL_PREVIEW = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * Tags of a page, as the reader sees them: in the order written, blanks and
 * repeats dropped. A single tag may be written without brackets, as a single
 * author may — accepting only a list lost the value without a word.
 *
 * @param {unknown} value `tags` from the frontmatter.
 * @returns {string[]}
 */
function pageTags(value) {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return [...new Set(list.map((tag) => String(tag).trim()).filter(Boolean))];
}

/**
 * Where each project image is written in a version, before its extension.
 * @type {Record<'logo' | 'favicon' | 'socialImage', string>}
 */
const IMAGE_FILES = {
  logo: 'assets/logo',
  favicon: 'assets/favicon',
  socialImage: 'assets/social-image',
};

/**
 * Type announced to the browser, by favicon extension.
 * @type {Record<string, string>}
 */
const FAVICON_TYPES = { '.ico': 'image/x-icon', '.png': 'image/png', '.svg': 'image/svg+xml' };

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
   *     filepath?: string, sourceDir?: string, slug?: string,
   *     pages?: { url: string, slug: string, title: string, description?: string,
   *       preview?: string, modified?: { iso: string, label: string } }[],
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
   * @returns {Promise<{ pages: number, outDir: string, published: import('./discovery.js').PublishedPage[] }>}
   *   `published` lists the pages as the site serves them, for the sitemap and the feed.
   * @throws {GeneratorError} Write failure.
   */
  async buildVersion(versionSlug, outDir) {
    const version = resolveVersion(this.config, versionSlug);
    const rootDir = this.config.rootDir ?? process.cwd();
    const target = path.resolve(rootDir, outDir);

    // A page removed from the sources must not stay online: the version's
    // folder is emptied before it is written — once it is certain to hold
    // nothing but what a build wrote there.
    this.#guardOutput(target);
    try {
      await rm(target, { recursive: true, force: true });
    } catch (cause) {
      throw new GeneratorError(`Could not empty the output folder "${target}".`, {
        cause,
        hint: 'Check that the path is a folder, and that nothing holds it open.',
      });
    }

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

    // 'auto' follows the file tree; otherwise each version describes its menu
    // in a file of its own, since each has its own pages.
    const described =
      this.config.sidebar && this.config.sidebar !== 'auto'
        ? await this.#describedSidebar(sourceDir, docs, pageUrl, version.folder)
        : null;
    const sidebar = described ?? buildSidebar(docs, pageUrl, { brand: this.config.projectName });
    const folded = this.config.foldedSidebar === true;
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

    // The project's images go into every version: each one stands on its
    // own, down to the orphan branch it is published on.
    const images = await this.#copyImages(target, versionBase, written, version);

    // What every page of the version shares, the search page included.
    const searchUrl = this.config.search !== false ? joinUrl(versionBase, SEARCH_SLUG) : '';
    // Described once per version, like the menu: the same authors serve every
    // page, and a biography corrected in one version leaves the others alone.
    const authors = await this.#readAuthors(sourceDir, version.folder, versionBase);

    // Links of the header, resolved once per version. A link naming a version
    // leads there from every version: a section written in one version only
    // stays reachable from the others.
    /** @param {{ href: string, version?: string }} link */
    const headerTarget = (link) =>
      EXTERNAL_PREVIEW.test(link.href)
        ? link.href
        : joinUrl(this.config.baseUrl, 'versions', link.version ?? version.slug) +
          link.href.replace(/^\/+/, '');

    const headerLinks = (this.config.headerLinks ?? []).map((link) =>
      link.columns
        ? {
            label: link.label,
            columns: link.columns.map((column) => ({
              title: column.title,
              items: column.items.map((item) => ({ label: item.label, href: headerTarget(item) })),
            })),
          }
        : // Without columns the configuration has checked the target: an entry
          // that leads nowhere and opens nothing never gets here.
          {
            label: link.label,
            href: headerTarget({ href: String(link.href), version: link.version }),
          },
    );

    const shell = {
      lang: this.config.lang ?? 'en',
      // A fixed scheme is a class on <html>, which the skins and the dark
      // variant of the utilities both obey.
      darkModeClass: ['dark', 'light'].includes(this.config.theme?.darkMode ?? '')
        ? this.config.theme.darkMode
        : null,
      projectName: this.config.projectName,
      versionName: version.name,
      homeUrl: versionBase,
      cssHref: joinUrl(versionBase, path.dirname(STYLESHEET)) + path.basename(STYLESHEET),
      feedUrl: this.#feedUrl(),
      logoUrl: images.logo ?? '',
      favicon: images.favicon
        ? { href: images.favicon, type: FAVICON_TYPES[path.extname(images.favicon).toLowerCase()] }
        : null,
      // Social networks only read an absolute address: normalisation
      // refuses a preview image without siteUrl.
      socialImage:
        images.socialImage && this.config.siteUrl
          ? new URL(images.socialImage, this.config.siteUrl).href
          : '',
      searchUrl,
      headerLinks,
      // A menu with nothing in it would be a button that opens onto nothing.
      headerMenu: this.config.versions.length > 1 || headerLinks.length > 0 || searchUrl !== '',
      // The light / dark switch: a button, and the few lines of script it needs.
      schemeToggle: this.config.theme?.toggle !== false,
      cls: classes,
      versions: this.#versionLinks(version.slug),
      // A switcher offering a single choice is not a switcher.
      showVersions: this.config.versions.length > 1,
      // The back-to-top button is page furniture, not content: writing it in
      // every file would repeat it everywhere, and forget it somewhere.
      scrollToTop: this.config.scrollToTop !== false,
      notice,
    };
    // Every page of the version, for the components that list pages: one of
    // them renders a single page at a time and could never gather this by
    // itself. Targets are resolved here, each against the folder of the page
    // that declares it — a preview written in one page is not relative to the
    // page that shows it in a card.
    const pages = docs.map((doc) => {
      const folder = dirPathToSlug(path.relative(sourceDir, path.dirname(doc.path)));
      const dirUrl = joinUrl(versionBase, folder);
      const target = String(doc.frontmatter.preview ?? '');
      const absolute = target.startsWith('/');

      return {
        url: pageUrl(doc),
        slug: doc.slug,
        title: String(doc.frontmatter.title ?? this.config.projectName),
        description: doc.frontmatter.description ? String(doc.frontmatter.description) : undefined,
        preview:
          target === '' || EXTERNAL_PREVIEW.test(target)
            ? target || undefined
            : new URL(
                absolute ? target.slice(1) : target,
                `https://docpensieve.invalid${absolute ? versionBase : dirUrl}`,
              ).pathname,
        // The same date the byline and the sitemap read, formatted once.
        modified:
          readDate(
            doc.frontmatter.modified ?? doc.frontmatter.date,
            'modified',
            doc.slug || 'the home page',
          ) ?? undefined,
      };
    });

    /** @type {{ title: string, url: string, description: string, text: string }[]} */
    const entries = [];

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
      this.deps.onPage?.({
        url,
        dirUrl,
        basePath: versionBase,
        filepath: doc.path,
        sourceDir,
        slug: doc.slug,
        pages,
      });

      const { html, toc, preloads } = await this.compiler.compile(doc.content, {
        filepath: doc.path,
        url,
        dirUrl,
        basePath: versionBase,
        sourceDir,
      });

      // Who wrote the page, and when. Read before the structured data, which
      // describes the same people: the page and its metadata must not
      // disagree about an author.
      const credits = buildByline(doc.frontmatter, authors, doc.slug || 'the home page');

      const jsonld = new StructuredDataBuilder(doc.frontmatter, url, this.config, {
        breadcrumbTitles,
        basePath: versionBase,
        dirUrl,
        logo: images.logo,
        // A described author carries a biography and a link, which a bare
        // name in the frontmatter cannot.
        authors: credits?.authors ?? [],
      }).toScriptTag();

      // A home page has neither menu nor table of contents: those are reading
      // landmarks within a document, not in an entrance hall.
      const wide = pageLayout(doc) === 'home';

      entries.push({
        title: String(doc.frontmatter.title ?? this.config.projectName),
        url,
        description: String(doc.frontmatter.description ?? ''),
        text: htmlToText(html),
      });

      const byline =
        wide || !credits
          ? null
          : {
              authors: credits.authors,
              dates: [
                credits.created && { prefix: 'Written', ...credits.created },
                credits.updated && { prefix: 'Updated', ...credits.updated },
              ].filter(Boolean),
            };

      const page = layout({
        ...shell,
        title: documentTitle(doc.frontmatter.title, this.config.projectName),
        description: doc.frontmatter.description ?? '',
        canonical: this.config.siteUrl ? new URL(url, this.config.siteUrl).href : '',
        currentUrl: url,
        wide,
        // A version in preparation must not compete with the current one:
        // same content, two addresses, and the wrong one comes up. "follow"
        // still lets its links be followed.
        noindex: version.prerelease === true,
        byline,
        tags: wide ? [] : pageTags(doc.frontmatter.tags),
        // Folded, the menu opens on the branch of the page being rendered, so
        // it is prepared per page rather than once per version.
        sidebar: wide ? [] : folded ? foldSidebar(sidebar, url) : sidebar,
        foldedSidebar: folded,
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

    // The search page and the index it reads, built with the site: content
    // pages load no script, and this page is useful before its own runs.
    if (searchUrl) {
      const destination = path.join(target, SEARCH_SLUG, 'index.html');
      const taken = written.get(destination);
      if (taken !== undefined) {
        throw new GeneratorError(`"${taken}" takes the place of the search page, ${searchUrl}.`, {
          hint: 'Rename that page, or set search: false in the configuration.',
        });
      }

      /** @param {string} file */
      const assetUrl = (file) =>
        joinUrl(versionBase, path.posix.dirname(file)) + path.posix.basename(file);
      const indexFile = path.join(target, ...SEARCH_INDEX.split('/'));
      const scriptFile = path.join(target, ...SEARCH_SCRIPT.split('/'));
      await this.#write(indexFile, JSON.stringify(entries));
      await mkdir(path.dirname(scriptFile), { recursive: true });
      await copyFile(CLIENT_SEARCH, scriptFile);

      const page = layout({
        ...shell,
        title: documentTitle('Search', this.config.projectName),
        description: `Search the pages of ${this.config.projectName} ${version.name}.`,
        canonical: '',
        currentUrl: searchUrl,
        wide: false,
        // A list of every page, and a script: nothing a search engine should
        // offer as a result.
        noindex: true,
        sidebar,
        toc: [],
        preloads: [],
        scripts: [assetUrl(SEARCH_SCRIPT)],
        content: searchPageContent(entries, assetUrl(SEARCH_INDEX)),
        jsonld: '',
      });
      for (const [, value] of page.matchAll(CLASS_ATTRIBUTE)) {
        for (const token of value.split(/\s+/)) if (token) candidates.add(token);
      }
      await this.#write(destination, page);
      for (const file of [destination, indexFile, scriptFile]) written.set(file, 'the search page');
    }

    await this.#copyAssets(sourceDir, target, '', written);

    // The stylesheet is compiled last: it needs the classes above.
    const { css } = await this.deps.theme.compile({ candidates: [...candidates] });
    // Comments and indentation make the stylesheet readable, and heavier on
    // every page: the reader receives it minified.
    await this.#write(path.join(target, ...STYLESHEET.split('/')), minifyCss(css));

    return {
      pages: docs.length,
      outDir: target,
      published: docs.map((doc) => ({ url: pageUrl(doc), frontmatter: doc.frontmatter })),
    };
  }

  /**
   * Reads the authors a version describes, their avatars resolved.
   *
   * The file is optional: without it, a page still shows the names its
   * frontmatter gives. Named in the configuration but missing, it is an
   * error — leaving every biography out without a word would be worse.
   *
   * @param {string} sourceDir Source folder of the version.
   * @param {string} folder The version's folder, as the configuration names it.
   * @param {string} versionBase URL of the version.
   * @returns {Promise<Map<string, import('./authors.js').Author>>} Authors by
   *   key, their avatars resolved to a URL and measured.
   * @throws {ConfigError} Unreadable file, invalid JSON, wrong author, missing avatar.
   */
  async #readAuthors(sourceDir, folder, versionBase) {
    const name = this.config.authors;
    if (!name) return new Map();

    const source = `${folder}/${name}`;

    let text;
    try {
      text = await readFile(path.join(sourceDir, ...name.split('/')), 'utf8');
    } catch (cause) {
      // Absent, the file has nothing to add: this version shows the names its
      // pages give (ADR-017). Present but unreadable, it is a fault.
      if (/** @type {{ code?: string }} */ (cause).code === 'ENOENT') return new Map();
      throw new ConfigError(`Could not read the author description at ${source}.`, {
        cause,
        hint: 'Check that it is a file, and that nothing holds it open.',
      });
    }

    let description;
    try {
      description = JSON.parse(text);
    } catch (cause) {
      throw new ConfigError(
        `${source} is not valid JSON: ${/** @type {Error} */ (cause).message}`,
        {
          cause,
          hint: 'A trailing comma or a missing quote is enough: open it in an editor that checks JSON.',
        },
      );
    }

    const table = buildAuthorTable(description, { source });

    // Resolved once per version, not once per page: the same handful of
    // images would otherwise be read and measured on every page.
    for (const author of table.values()) {
      if (!author.avatar) continue;
      const segments = author.avatar.split('/').filter(Boolean);

      let bytes;
      try {
        bytes = await readFile(path.join(sourceDir, ...segments));
      } catch (cause) {
        throw new ConfigError(
          `No avatar at ${folder}/${author.avatar}, declared by author "${author.key}".`,
          {
            cause,
            hint: 'The path starts at the version folder, so that the image travels with the version.',
          },
        );
      }

      // Published where the asset copy puts it: folders lose their ordering
      // prefix, as pages do. The raw source path pointed at a file that is
      // never written — `06-examples/` is served as `examples/`.
      const published = assetPathToSlug(author.avatar).split('/');
      const entry = /** @type {Record<string, any>} */ (author);
      entry.avatarUrl =
        joinUrl(versionBase, published.slice(0, -1).join('/')) + published[published.length - 1];

      // Dimensions spare the reader a jump when the image arrives, as for
      // every other image of a page.
      const size = imageSize(bytes, path.extname(author.avatar));
      if (size) {
        entry.avatarWidth = size.width;
        entry.avatarHeight = size.height;
      }
    }

    return table;
  }

  /**
   * Reads the sidebar description of a version.
   *
   * @param {string} sourceDir Source folder of the version.
   * @param {import('./loader.js').Doc[]} docs Documents of the version.
   * @param {(doc: import('./loader.js').Doc) => string} pageUrl
   * @param {string} folder The version's folder, as the configuration names it.
   * @returns {Promise<import('./sidebar.js').SidebarNode[] | null>} `null`
   *   when this version has no description, which then keeps the automatic menu.
   * @throws {ConfigError} When the file cannot be read, is not JSON, or
   *   describes the menu wrongly.
   */
  async #describedSidebar(sourceDir, docs, pageUrl, folder) {
    const name = this.config.sidebar;
    const source = `${folder}/${name}`;

    let text;
    try {
      text = await readFile(path.join(sourceDir, ...name.split('/')), 'utf8');
    } catch (cause) {
      // Absent, the version keeps the menu of its folders (ADR-017): a project
      // can describe the menu of its new version without touching the others.
      if (/** @type {{ code?: string }} */ (cause).code === 'ENOENT') return null;
      throw new ConfigError(`Could not read the sidebar description at ${source}.`, {
        cause,
        hint: 'Check that it is a file, and that nothing holds it open.',
      });
    }

    let description;
    try {
      description = JSON.parse(text);
    } catch (cause) {
      throw new ConfigError(
        `${source} is not valid JSON: ${/** @type {Error} */ (cause).message}`,
        {
          cause,
          hint: 'JSON accepts neither comments nor a comma after the last entry.',
        },
      );
    }

    return buildSidebarFromDescription(description, docs, pageUrl, { source });
  }

  /**
   * Refuses an output folder the build could not empty without harm: the
   * project itself, a folder above it, or one that holds a version's pages —
   * or lies inside them. Checked before anything is deleted.
   *
   * @param {string} folder Absolute path.
   * @throws {GeneratorError}
   */
  #guardOutput(folder) {
    const rootDir = path.resolve(this.config.rootDir ?? process.cwd());
    /** @param {string} child @param {string} parent */
    const within = (child, parent) => {
      const relative = path.relative(parent, child);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    };

    if (within(rootDir, folder)) {
      throw new GeneratorError(`The output folder "${folder}" holds the project itself.`, {
        hint: 'Point outDir to a folder of its own, such as "dist": the build empties the folders it writes there.',
      });
    }
    for (const version of this.config.versions) {
      const sources = path.resolve(rootDir, version.folder);
      if (within(sources, folder) || within(folder, sources)) {
        throw new GeneratorError(
          `The output folder "${folder}" overlaps the pages of version "${version.slug}".`,
          {
            hint: 'Keep outDir apart from the documentation folders: the build empties what it writes.',
          },
        );
      }
    }
  }

  /**
   * Absolute address of the RSS feed, or `''` when none is written.
   *
   * Known before any page is rendered: every page announces the feed in its
   * head, whereas the feed itself is written once every version is built.
   *
   * @returns {string}
   */
  #feedUrl() {
    if (!this.config.feed || !this.config.siteUrl) return '';
    return new URL(`${this.config.baseUrl}feed.xml`, this.config.siteUrl).href;
  }

  /**
   * Writes what search engines and feed readers read, at the root of the
   * site: `sitemap.xml`, `robots.txt` and the RSS feed.
   *
   * @param {string} target Output folder.
   * @param {Map<string, import('./discovery.js').PublishedPage[]>} published
   *   Pages of each version, by slug.
   */
  async #writeDiscovery(target, published) {
    // Written anew every time: a sitemap or a feed turned off since the last
    // build must not linger at the root of the site.
    for (const file of ['sitemap.xml', 'robots.txt', 'feed.xml']) {
      await rm(path.join(target, file), { force: true });
    }

    const { siteUrl, baseUrl } = this.config;
    if (!siteUrl) return;

    if (this.config.sitemap !== false) {
      // A version in preparation is kept out of search engines: its pages
      // carry noindex, and listing them would contradict it.
      const pages = this.config.versions
        .filter((version) => !version.prerelease)
        .flatMap((version) => published.get(version.slug) ?? []);
      await this.#write(path.join(target, 'sitemap.xml'), buildSitemap(pages, siteUrl));

      // Crawlers only read robots.txt at the root of a domain: under a
      // sub-path, the file would be written for nobody.
      if (baseUrl === '/') {
        const sitemapUrl = new URL('/sitemap.xml', siteUrl).href;
        await this.#write(path.join(target, 'robots.txt'), buildRobots(sitemapUrl));
      }
    }

    const feedUrl = this.#feedUrl();
    if (feedUrl) {
      const current = resolveVersion(this.config);
      const feed = buildFeed(published.get(current.slug) ?? [], {
        projectName: this.config.projectName,
        siteUrl,
        homeUrl: new URL(joinUrl(baseUrl, 'versions', current.slug), siteUrl).href,
        feedUrl,
        lang: this.config.lang,
      });
      await this.#write(path.join(target, 'feed.xml'), feed);
    }
  }

  /**
   * Copies the project's images into a version's assets.
   *
   * @param {string} target Output folder of the version.
   * @param {string} versionBase URL of the version.
   * @param {Map<string, string>} written Files already written, for collisions.
   * @param {import('./config.js').Version} version The version being built.
   * @returns {Promise<Partial<Record<keyof typeof IMAGE_FILES, string>>>} URL
   *   of each declared image.
   * @throws {GeneratorError} When a declared image does not exist.
   */
  async #copyImages(target, versionBase, written, version) {
    const rootDir = this.config.rootDir ?? process.cwd();
    /** @type {Partial<Record<keyof typeof IMAGE_FILES, string>>} */
    const urls = {};

    for (const field of /** @type {(keyof typeof IMAGE_FILES)[]} */ (Object.keys(IMAGE_FILES))) {
      // A version's own logo or favicon replaces the project's.
      const declared = (field !== 'socialImage' && version[field]) || this.config[field];
      if (!declared) continue;

      const file = `${IMAGE_FILES[field]}${path.extname(declared).toLowerCase()}`;
      const destination = path.join(target, ...file.split('/'));
      written.set(destination, `the ${field} image`);

      try {
        await mkdir(path.dirname(destination), { recursive: true });
        await copyFile(path.resolve(rootDir, declared), destination);
      } catch (cause) {
        const missing = /** @type {NodeJS.ErrnoException} */ (cause).code === 'ENOENT';
        throw new GeneratorError(
          missing
            ? `The ${field} image does not exist: "${declared}".`
            : `Could not copy the ${field} image "${declared}".`,
          {
            cause,
            hint: missing
              ? `The path starts from the project root, ${rootDir}.`
              : 'Check the permissions on the file and on the output folder.',
          },
        );
      }
      urls[field] = joinUrl(versionBase, path.posix.dirname(file)) + path.posix.basename(file);
    }

    return urls;
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
    this.#guardOutput(target);

    // The folder of a version no longer declared would stay online, unlisted
    // but reachable. Everything else in the output folder is left alone.
    const declared = new Set(this.config.versions.map((version) => version.slug));
    /** @type {import('node:fs').Dirent[]} */
    let existing;
    try {
      existing = await readdir(path.join(target, 'versions'), { withFileTypes: true });
    } catch {
      existing = [];
    }
    for (const entry of existing) {
      if (entry.isDirectory() && !declared.has(entry.name)) {
        await rm(path.join(target, 'versions', entry.name), { recursive: true, force: true });
      }
    }

    let pages = 0;
    /** @type {Map<string, import('./discovery.js').PublishedPage[]>} */
    const published = new Map();
    for (const version of this.config.versions) {
      const result = await this.buildVersion(
        version.slug,
        path.join(target, 'versions', version.slug),
      );
      pages += result.pages;
      published.set(version.slug, result.published);
    }

    await this.#writeManifest(target);
    await this.#writeRootRedirect(target);
    await this.#writeDiscovery(target, published);

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

    const [layout, navItems, tocItems, headerMenu] = await Promise.all(
      ['layout.hbs', 'nav-items.hbs', 'toc-items.hbs', 'header-menu.hbs'].map((file) =>
        readFile(path.join(TEMPLATE_DIR, file), 'utf8'),
      ),
    );

    const handlebars = Handlebars.create();
    handlebars.registerHelper('eq', (a, b) => a === b);
    handlebars.registerPartial('navItems', navItems);
    handlebars.registerPartial('tocItems', tocItems);
    handlebars.registerPartial('headerMenu', headerMenu);

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

      // The sidebar description is read by the build, not published.
      if (this.config.sidebar !== 'auto' && readable === this.config.sidebar) continue;
      // The author descriptions too: they feed the pages, they are not pages.
      if (this.config.authors && readable === this.config.authors) continue;
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
