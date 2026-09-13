/**
 * Constants shared by every DocPensieve package.
 * @module @docpensieve/shared/constants
 */

/** File extensions recognised as documentation pages. */
export const DOC_EXTENSIONS = ['.md', '.mdx'];

/** Name of the configuration file at the project root. */
export const CONFIG_FILENAME = 'docpensieve.config.js';

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
export const DEFAULT_THEME_CLASSES = Object.freeze({
  skip: 'dp-skip',
  header: 'dp-header',
  brand: 'dp-brand',
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
});
