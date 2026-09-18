/**
 * @docpensieve/core — the generation engine.
 *
 * Depends on `@docpensieve/shared` only. Global components and the theme are
 * injected by the caller (the CLI), which keeps the engine testable without
 * React or CSS.
 *
 * @module @docpensieve/core
 */

/**
 * Engine types, re-exported for consumers of the published package: without
 * this they would only be reachable through an internal path.
 *
 * @typedef {import('./config.js').DocPensieveConfig} DocPensieveConfig
 * @typedef {import('./config.js').Version} Version
 * @typedef {import('./loader.js').Doc} Doc
 * @typedef {import('./compiler.js').CompileResult} CompileResult
 * @typedef {import('./compiler.js').TocEntry} TocEntry
 * @typedef {import('./compiler.js').Preload} Preload
 * @typedef {import('./sidebar.js').SidebarNode} SidebarNode
 * @typedef {import('./sidebar.js').FoldedNode} FoldedNode
 * @typedef {import('./authors.js').Author} Author
 * @typedef {import('./authors.js').Byline} Byline
 */

export {
  DEFAULT_CONFIG,
  defineConfig,
  loadConfig,
  normalizeConfig,
  resolveVersion,
} from './config.js';
export { DocLoader } from './loader.js';
export { Compiler } from './compiler.js';
export { StructuredDataBuilder } from './structured-data.js';
export { SiteGenerator } from './generator.js';
export {
  buildSidebar,
  buildSidebarFromDescription,
  collectSectionTitles,
  foldSidebar,
} from './sidebar.js';
export { buildFeed, buildRobots, buildSitemap } from './discovery.js';
export { buildAuthorTable, buildByline, readDate, resolvePageAuthors } from './authors.js';
