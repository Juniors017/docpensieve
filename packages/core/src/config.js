/**
 * Loading and normalisation of the configuration file,
 * `docpensieve.config.mjs`.
 * @module @docpensieve/core/config
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  CONFIG_FILENAME,
  CONFIG_FILENAMES,
  ConfigError,
  DEFAULT_OUT_DIR,
  THEME_FRAMEWORKS,
} from '@docpensieve/shared';

/**
 * @typedef {object} Version
 * @property {string} slug   URL and branch identifier (`'v1.0'`).
 * @property {string} name   Label shown in the version switcher (`'1.0'`).
 * @property {string} folder Source folder, relative to the root.
 * @property {boolean} [current]  Version served by default. At most one.
 * @property {boolean} [archived] Version kept but no longer maintained.
 * @property {boolean} [prerelease] Version in preparation, not yet the
 *   reference one. Its pages carry a notice and are not indexed.
 * @property {string} [logo]    Logo of this version, instead of the project's.
 * @property {string} [favicon] Favicon of this version, instead of the project's.
 */

/**
 * @typedef {object} DocPensieveConfig
 * @property {string} projectName Name shown in the header and in the JSON-LD.
 * @property {string} siteUrl     Public URL, empty when unknown.
 * @property {string} baseUrl     Deployment prefix, slashes included.
 * @property {string} outDir      Output folder, relative to the root.
 * @property {Version[]} versions At least one.
 * @property {{ framework: string, darkMode?: string, toggle?: boolean, tokens?: Record<string, string>, css?: string, source?: string }} theme
 * @property {string} sidebar     `'auto'`, or the path of a description.
 * @property {string} [authors]   Path of a JSON describing the authors, read in each version folder.
 * @property {boolean} globalComponents
 * @property {boolean} scrollToTop Back-to-top button on every page.
 * @property {{ enabled: boolean }} jsonld
 * @property {string} [logo]        Image beside the project name, in the header.
 * @property {string} [favicon]     Icon of the browser tab: `.ico`, `.png` or `.svg`.
 * @property {string} [socialImage] Preview of a shared page. Needs `siteUrl`.
 * @property {boolean} [sitemap] `sitemap.xml` of the published versions.
 * @property {boolean} [feed] RSS feed of the dated pages of the current version.
 * @property {boolean} [search] Search field, index and search page of each version.
 * @property {string} [rootDir]   Project root, set by `loadConfig`.
 * @property {string} [configFile] Path of the configuration file, set by `loadConfig`.
 * @property {string} [lang]      Document language, `'en'` by default.
 */

/**
 * Values applied when the user config leaves them out.
 *
 * The type is spelled out: without it, TypeScript would infer
 * `versions: never[]` from the empty array and refuse every read of its
 * elements elsewhere in the file.
 *
 * @type {Readonly<DocPensieveConfig>}
 */
export const DEFAULT_CONFIG = Object.freeze({
  projectName: 'Documentation',
  siteUrl: '',
  baseUrl: '/',
  outDir: DEFAULT_OUT_DIR,
  versions: [],
  // The light / dark switch is on unless the project turns it off (ADR-014).
  theme: { framework: 'tailwind', darkMode: 'class', toggle: true },
  sidebar: 'auto',
  // No author file by default: a page still shows the names its frontmatter
  // gives. The file only adds what a name cannot carry — a biography, an
  // avatar, a link.
  authors: '',
  globalComponents: true,
  scrollToTop: true,
  jsonld: { enabled: true },
  logo: '',
  favicon: '',
  socialImage: '',
  // On by default, but only written once siteUrl is set: it lists absolute
  // addresses.
  sitemap: true,
  // Off by default: most documentation pages carry no date, and a feed that
  // is always empty would be announced in every page.
  feed: false,
  search: true,
});

/** Values of `theme.darkMode`. */
const DARK_MODES = ['class', 'dark', 'light'];

/**
 * Extensions accepted for each project image, and what to do otherwise.
 *
 * @type {Record<'logo' | 'favicon' | 'socialImage', { extensions: string[], hint: string }>}
 */
const IMAGE_KINDS = {
  logo: {
    extensions: ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'],
    hint: 'Give an image the browser displays: SVG, PNG, JPEG, WebP, GIF or AVIF.',
  },
  favicon: {
    extensions: ['.ico', '.png', '.svg'],
    hint: 'Browser tabs show .ico, .png and .svg icons.',
  },
  socialImage: {
    extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
    hint: 'Social networks read neither SVG nor AVIF: export a PNG or a JPEG, 1200 × 630 pixels.',
  },
};

/**
 * Identity over the config, used only for autocompletion and type checking
 * in the editor.
 *
 * @template T
 * @param {T} config
 * @returns {T}
 */
export function defineConfig(config) {
  return config;
}

/**
 * Merges the user config with the defaults and validates it.
 *
 * @param {Record<string, unknown>} userConfig
 * @returns {DocPensieveConfig} Normalised config.
 * @throws {ConfigError} When the config is structurally invalid.
 */
export function normalizeConfig(userConfig) {
  if (userConfig === null || typeof userConfig !== 'object') {
    throw new ConfigError('The configuration must be an object.', {
      hint: `Export a default object from ${CONFIG_FILENAME}.`,
    });
  }

  const config = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    // Copied one by one: normalisation completes the versions (the first one
    // becomes current when none is marked), and used to do so in the user's
    // own array — to the point of crashing on a frozen configuration.
    // The shape is checked right below: an array, and every entry with its
    // three fields.
    versions: /** @type {Version[]} */ (
      Array.isArray(userConfig.versions)
        ? userConfig.versions.map((version) =>
            version && typeof version === 'object' ? { ...version } : version,
          )
        : userConfig.versions
    ),
    theme: { ...DEFAULT_CONFIG.theme, ...(userConfig.theme ?? {}) },
    jsonld: { ...DEFAULT_CONFIG.jsonld, ...(userConfig.jsonld ?? {}) },
  };

  if (!Array.isArray(config.versions) || config.versions.length === 0) {
    throw new ConfigError('The configuration must declare at least one version.', {
      hint: "Add for example versions: [{ slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true }].",
    });
  }

  // The slug becomes an output folder and a URL segment: it must be able to
  // be both. "../../elsewhere" wrote outside the output folder, "a/b" nested
  // the version, "Été" produced an encoded URL.
  const VERSION_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

  const seen = new Set();
  for (const version of config.versions) {
    for (const field of /** @type {const} */ (['slug', 'name', 'folder'])) {
      if (typeof version?.[field] !== 'string' || version[field].length === 0) {
        throw new ConfigError(
          `Every version must define "${field}" (offending version: ${JSON.stringify(version)}).`,
        );
      }
    }
    if (!VERSION_SLUG.test(version.slug)) {
      throw new ConfigError(`Invalid version slug: "${version.slug}".`, {
        hint: 'Letters, digits, dot, dash and underscore, starting with a letter or a digit — "v1.0", "next".',
      });
    }
    // A version may carry its own logo and favicon — a beta told apart at a
    // glance. Checked like the project's.
    for (const field of /** @type {const} */ (['logo', 'favicon'])) {
      const value = version[field];
      if (value === undefined) continue;
      const { extensions, hint } = IMAGE_KINDS[field];
      if (typeof value !== 'string' || !extensions.includes(path.extname(value).toLowerCase())) {
        throw new ConfigError(
          `The ${field} of version "${version.slug}" must be a ${extensions.join(', ')} file: "${String(value)}".`,
          { hint },
        );
      }
    }
    if (seen.has(version.slug)) {
      throw new ConfigError(`The version slug "${version.slug}" is declared twice.`);
    }
    seen.add(version.slug);
  }

  // A version cannot be both the one served by default and the one being
  // prepared: the notice on the latter would contradict the role of the
  // former, and readers would no longer know where they are.
  const conflicting = config.versions.filter((version) => version.current && version.prerelease);
  if (conflicting.length > 0) {
    throw new ConfigError(
      `A version cannot be both "current" and "prerelease": ${conflicting
        .map((version) => version.slug)
        .join(', ')}.`,
      { hint: 'Remove "prerelease" from the version served by default.' },
    );
  }

  const currents = config.versions.filter((version) => version.current);
  if (currents.length > 1) {
    throw new ConfigError(
      `Only one version can be "current" (found: ${currents.map((v) => v.slug).join(', ')}).`,
    );
  }
  if (currents.length === 0) {
    // With no explicit choice, the first declared version is the reference.
    config.versions[0].current = true;
  }

  // 'auto' derives the sidebar from the file tree. Anything else names a JSON
  // description, which the generator reads from each version's folder: each
  // version has its own pages, so its own menu.
  if (config.sidebar !== 'auto') {
    const file = typeof config.sidebar === 'string' ? config.sidebar : '';
    if (
      !file.toLowerCase().endsWith('.json') ||
      path.isAbsolute(file) ||
      file.split('/').includes('..')
    ) {
      throw new ConfigError(
        `sidebar must be 'auto' or a .json file within each version folder: "${String(config.sidebar)}".`,
        {
          hint: "For instance sidebar: 'sidebar.json', read as docs/v1.0/sidebar.json for that version.",
        },
      );
    }
  }

  // Like the menu, the authors are described in each version's folder: a
  // biography corrected in the beta must not rewrite a published version.
  if (config.authors) {
    const file = typeof config.authors === 'string' ? config.authors : '';
    if (
      !file.toLowerCase().endsWith('.json') ||
      path.isAbsolute(file) ||
      file.split('/').includes('..')
    ) {
      throw new ConfigError(
        `authors must be a .json file within each version folder: "${String(config.authors)}".`,
        {
          hint: "For instance authors: 'authors.json', read as docs/v1.0/authors.json for that version.",
        },
      );
    }
  }

  // siteUrl feeds everything that must be absolute: canonical, JSON-LD.
  // Invalid, it went through here and blew up further on as a raw TypeError,
  // stack included; with an exotic scheme, it built a nonsensical prefix.
  if (config.siteUrl) {
    /** @type {URL} */
    let address;
    try {
      address = new URL(config.siteUrl);
    } catch (cause) {
      throw new ConfigError(`siteUrl is not a URL: "${config.siteUrl}".`, {
        cause,
        hint: 'Give the full address, scheme included: "https://example.com/docs".',
      });
    }
    if (address.protocol !== 'https:' && address.protocol !== 'http:') {
      throw new ConfigError(`siteUrl must be a web address: "${config.siteUrl}".`, {
        hint: 'Only http and https make sense for a published site.',
      });
    }
    // Without an explicit baseUrl, the sub-path of siteUrl is the reference.
    // Otherwise a siteUrl such as "https://example.com/docs" would silently
    // produce links and canonicals stripped of "/docs".
    if (userConfig.baseUrl === undefined) config.baseUrl = address.pathname;
  }

  // A baseUrl is a URL prefix: it needs both slashes, otherwise concatenation
  // yields paths like "/docsversions/v1.0/".
  config.baseUrl = `/${String(config.baseUrl ?? '/').replace(/^\/+|\/+$/g, '')}/`.replace(
    /^\/\/$/,
    '/',
  );

  // The project's images: paths from the root, checked here for their kind.
  // Whether they exist is checked when the build copies them.
  for (const field of /** @type {const} */ (['logo', 'favicon', 'socialImage'])) {
    const value = config[field];
    if (value === undefined || value === '') continue;
    const { extensions, hint } = IMAGE_KINDS[field];
    if (typeof value !== 'string') {
      throw new ConfigError(`${field} must be the path of an image, from the project root.`, {
        hint,
      });
    }
    if (!extensions.includes(path.extname(value).toLowerCase())) {
      throw new ConfigError(`${field} must be a ${extensions.join(', ')} file: "${value}".`, {
        hint,
      });
    }
  }
  // Both list absolute addresses. Asked for explicitly without siteUrl, they
  // could only be written wrong; left to their default, they wait for it.
  for (const field of /** @type {const} */ (['sitemap', 'feed'])) {
    if (typeof config[field] !== 'boolean') {
      throw new ConfigError(`${field} must be true or false.`, {
        hint: `For instance ${field}: true.`,
      });
    }
    if (userConfig[field] === true && !config.siteUrl) {
      throw new ConfigError(`${field} needs siteUrl.`, {
        hint: 'It lists absolute addresses: set siteUrl, the public address of the site.',
      });
    }
  }

  if (typeof config.search !== 'boolean') {
    throw new ConfigError('search must be true or false.', { hint: 'For instance search: false.' });
  }

  if (config.socialImage && !config.siteUrl) {
    throw new ConfigError('socialImage needs siteUrl.', {
      hint: 'Social networks only read an absolute address: set siteUrl, the public address of the site.',
    });
  }

  // 'class' follows the reader's system, and a dark or light class on <html>
  // wins; 'dark' and 'light' set that class at build time, for a site that
  // keeps one look whatever the system.
  if (!DARK_MODES.includes(config.theme.darkMode ?? 'class')) {
    throw new ConfigError(`Unknown darkMode: "${config.theme.darkMode}".`, {
      hint: `Accepted values: ${DARK_MODES.join(', ')}.`,
    });
  }

  if (config.theme.toggle !== undefined && typeof config.theme.toggle !== 'boolean') {
    throw new ConfigError('theme.toggle must be true or false.', {
      hint: 'true adds a light / dark button to the header, with a few lines of inline script.',
    });
  }

  if (!THEME_FRAMEWORKS.includes(config.theme.framework)) {
    throw new ConfigError(`Unknown theme framework: "${config.theme.framework}".`, {
      hint: `Accepted values: ${THEME_FRAMEWORKS.join(', ')}.`,
    });
  }

  return config;
}

/**
 * Loads the configuration file of a project folder.
 *
 * `docpensieve.config.mjs` is looked for first, then `docpensieve.config.js`,
 * which a project whose package.json declares "type": "module" can still use.
 *
 * @param {string} [cwd] Project root. Default: `process.cwd()`.
 * @returns {Promise<DocPensieveConfig>} Normalised config.
 * @throws {ConfigError} When no file, or two, are found, or when the file does
 *   not load or exports no object.
 */
export async function loadConfig(cwd = process.cwd()) {
  const found = CONFIG_FILENAMES.map((name) => path.resolve(cwd, name)).filter((file) =>
    existsSync(file),
  );

  if (found.length === 0) {
    throw new ConfigError(`No ${CONFIG_FILENAME} found in ${cwd}.`, {
      hint: `Create a ${CONFIG_FILENAME} at the project root, or run "docpensieve init".`,
    });
  }
  // Picking one silently would leave the other edited in vain.
  if (found.length > 1) {
    throw new ConfigError(`Two configuration files in ${cwd}: ${CONFIG_FILENAMES.join(' and ')}.`, {
      hint: `Keep only one of them — ${CONFIG_FILENAME} reads the same in any project.`,
    });
  }

  const [configPath] = found;
  const name = path.basename(configPath);

  let module;
  try {
    // pathToFileURL: on Windows, a raw path is not a valid specifier.
    module = await import(pathToFileURL(configPath).href);
  } catch (cause) {
    // The reason is the useful part: a syntax error in the file, a missing
    // module it imports. "Could not load" alone left the author guessing.
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new ConfigError(`Could not load ${name}: ${reason}`, {
      cause,
      // Node reads a .js file as an ES module only when the nearest
      // package.json says so; "npm init -y" now writes "type": "commonjs",
      // and "export default" then does not even parse.
      hint:
        name.endsWith('.js') && cause instanceof SyntaxError
          ? `A .js file is read as an ES module only when the nearest package.json declares "type": "module". Rename it ${CONFIG_FILENAME}.`
          : undefined,
    });
  }

  const normalized = normalizeConfig(module.default);
  normalized.rootDir = cwd;
  normalized.configFile = configPath;
  return normalized;
}

/**
 * Finds a declared version by its slug.
 *
 * @param {DocPensieveConfig} config Normalised config.
 * @param {string} [slug] Slug to look for. Omitted: the "current" version.
 * @returns {Version} The requested version.
 * @throws {ConfigError} When the slug does not exist.
 */
export function resolveVersion(config, slug) {
  const version = slug
    ? config.versions.find((candidate) => candidate.slug === slug)
    : config.versions.find((candidate) => candidate.current);

  if (!version) {
    throw new ConfigError(`Unknown version: "${slug}".`, {
      hint: `Declared versions: ${config.versions.map((v) => v.slug).join(', ')}.`,
    });
  }
  return version;
}
