/**
 * Constants shared by every DocPensieve package.
 * @module @docpensieve/shared/constants
 */

/** File extensions recognised as documentation pages. */
export const DOC_EXTENSIONS = ['.md', '.mdx'];

/**
 * Name of the configuration file `init` writes at the project root.
 *
 * `.mjs` rather than `.js`: the file is an ES module, and Node reads a `.js`
 * file as one only when the nearest package.json declares "type": "module".
 * Elsewhere it warns on every build — or refuses the file outright when that
 * package.json says "commonjs", as `npm init -y` now writes.
 */
export const CONFIG_FILENAME = 'docpensieve.config.mjs';

/**
 * Names accepted for the configuration file, in the order they are looked for.
 * The `.js` spelling still works in a project whose package.json declares
 * "type": "module".
 *
 * @type {readonly string[]}
 */
export const CONFIG_FILENAMES = Object.freeze([CONFIG_FILENAME, 'docpensieve.config.js']);

/**
 * Folder of the project's own stylesheets, at its root. Every `.css` file in
 * it is appended to the site's stylesheet, after the theme's.
 */
export const THEME_FOLDER = 'theme';

/** Default output directory of a build. */
export const DEFAULT_OUT_DIR = 'dist';

/** Version manifest written by every build. */
export const VERSIONS_MANIFEST = 'versions.json';

/** Page slugs treated as the root of their folder (they take the folder's own URL). */
export const INDEX_SLUGS = ['index', 'readme'];

/** JSON-LD types supported by the `jsonld.type` frontmatter field. */
export const JSONLD_TYPES = ['Article', 'TechArticle', 'BlogPosting'];

/** CSS frameworks known to the ThemeEngine. */
export const THEME_FRAMEWORKS = ['tailwind', 'custom'];

/**
 * Layouts accepted in a page's frontmatter.
 *
 * `doc` is the documentation layout: menu on the left, table of contents on
 * the right, content held to reading width. `home` removes all three, which
 * is what a landing page expects.
 *
 * @type {readonly string[]}
 */
export const PAGE_LAYOUTS = Object.freeze(['doc', 'home']);

/**
 * Class slots of the page shell.
 *
 * Templates hard-code no class: they ask the theme for the class of each
 * slot. A provider only redefines what it wants to change; everything else
 * falls back to these values. That is what lets a single template render
 * either `dp-nav` or a string of Tailwind utilities.
 *
 * This table is shared: `core` reads it in its templates, `theme` extends it
 * in its providers.
 */
/**
 * Tones an admonition can take: what colours it, nothing more.
 *
 * Here rather than with the component: the configuration validates the kinds a
 * project declares, and `core` never imports `components` (ADR-002).
 */
export const ADMONITION_TONES = Object.freeze(['note', 'info', 'tip', 'attention', 'danger']);

export const DEFAULT_THEME_CLASSES = Object.freeze({
  skip: 'dp-skip',
  header: 'dp-header',
  headerStatic: 'dp-header dp-header--static',
  brand: 'dp-brand',
  brandLogo: 'dp-brand-logo',
  versions: 'dp-versions',
  versionsList: 'dp-versions-list',
  shell: 'dp-shell',
  shellWide: 'dp-shell dp-shell--wide',
  sidebar: 'dp-sidebar',
  nav: 'dp-nav',
  navItem: 'dp-nav-item',
  navItemParent: 'dp-nav-item--parent',
  navLink: 'dp-nav-link',
  navLabel: 'dp-nav-label',
  navGroup: 'dp-nav-group',
  navSummary: 'dp-nav-summary',
  sidebarMenu: 'dp-sidebar-menu',
  notice: 'dp-notice',
  skillIcon: 'dp-skill-icon',
  main: 'dp-main',
  article: 'dp-article',
  toc: 'dp-toc',
  tocTitle: 'dp-toc-title',
  tocList: 'dp-toc-list',
  tocItem: 'dp-toc-item',
  footer: 'dp-footer',
  scrollTop: 'dp-scroll-top',
  scrollTopIcon: 'dp-scroll-top-icon',
  search: 'dp-search',
  schemeToggle: 'dp-scheme-toggle',
  byline: 'dp-byline',
  bylineAuthors: 'dp-byline-authors',
  bylineAuthor: 'dp-byline-author',
  bylineAvatar: 'dp-byline-avatar',
  bylineName: 'dp-byline-name',
  bylineBio: 'dp-byline-bio',
  bylineDates: 'dp-byline-dates',
  tags: 'dp-tags',
  tag: 'dp-tag',
  headerNav: 'dp-header-nav',
  headerLinks: 'dp-header-links',
  menu: 'dp-menu',
  menuPanel: 'dp-menu-panel',
  mega: 'dp-mega',
  megaPanel: 'dp-mega-panel',
  megaColumn: 'dp-mega-column',
  megaTitle: 'dp-mega-title',
});
