/**
 * Loading and normalisation of the configuration file,
 * `docpensieve.config.mjs`.
 * @module @docpensieve/core/config
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  ADMONITION_TONES,
  CONFIG_FILENAME,
  CONFIG_FILENAMES,
  ConfigError,
  DEFAULT_OUT_DIR,
  THEME_FRAMEWORKS,
  UI_STRINGS,
  isLanguageCode,
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
 * @property {Record<string, string>} [translations] Folder of each translation,
 *   by language code. The pages of the site language stay at the root of the
 *   version; a translation is served under its code.
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
 * @property {{ label: string, href?: string, version?: string, columns?: { title?: string, items: { label: string, href: string, version?: string }[] }[] }[]} [headerLinks]
 *   Links of the header, beside the version switcher. An entry carrying
 *   `columns` opens a panel of links instead of leading anywhere itself.
 * @property {boolean} [foldedSidebar] Categories of the menu fold, opened on
 *   the branch of the page being read.
 * @property {Record<string, Record<string, string>>} [ui]
 * @property {Record<string, { label: string, tone: string, icon?: string }>} [admonitions]
 *   Kinds of admonition the project adds to the ones shipped. `icon` names an
 *   SVG of the version folder, inlined in place of the tone's drawing.
 * @property {boolean} globalComponents
 * @property {boolean} scrollToTop Back-to-top button on every page.
 * @property {boolean} copyCode A button copying each block of code. It is the
 *   first thing a DocPensieve page asks a reader to load, so it is off until
 *   a project asks for it.
 * @property {boolean} [stickyHeader] Header held at the top of the screen.
 *   `false` lets it scroll away with the page.
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
  // No link in the header by default: the version switcher and the search
  // field are there already.
  headerLinks: [],
  // The menu shows whole by default: a documentation of a few dozen pages
  // reads better open than behind folds. Long ones turn this on.
  foldedSidebar: false,
  // Six kinds of admonition ship with the tool; a project names its own here
  // rather than waiting for that list to grow.
  ui: {},
  admonitions: {},
  globalComponents: true,
  scrollToTop: true,
  copyCode: false,
  // The header stays in reach: search, versions and menu are in it. A site
  // that would rather give the height back to the text turns this off.
  stickyHeader: true,
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

  // A translation belongs to a version, since a version is what has pages.
  // Written at the root, it was read by nobody: the build succeeded, no
  // language appeared, and nothing said why.
  if (userConfig.translations !== undefined) {
    throw new ConfigError('"translations" belongs to a version, not to the configuration root.', {
      hint: "Move it into the version it translates: { slug: 'v1.0', folder: 'docs/v1.0', translations: { fr: 'docs/v1.0-fr' } }.",
    });
  }

  const seen = new Set();
  for (const version of config.versions) {
    // The language of the site is declared once, at the root: a version
    // carries translations, not a language of its own.
    if (/** @type {Record<string, unknown>} */ (version)?.lang !== undefined) {
      throw new ConfigError(`The version "${version.slug}" declares a language of its own.`, {
        hint: 'The site has one language, set by "lang" at the root; a version names its translations in "translations".',
      });
    }
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
    // A translation names a language and the folder holding it. The pages of
    // the site language keep their address: only a translation takes a prefix,
    // so nothing already published moves.
    if (version.translations !== undefined) {
      if (
        version.translations === null ||
        typeof version.translations !== 'object' ||
        Array.isArray(version.translations)
      ) {
        throw new ConfigError(`The translations of version "${version.slug}" must be an object.`, {
          hint: "Write translations: { fr: 'docs/v1.0-fr' } — one folder per language.",
        });
      }
      for (const [lang, folder] of Object.entries(version.translations)) {
        if (!isLanguageCode(lang)) {
          throw new ConfigError(
            `"${lang}" does not name a language, in version "${version.slug}".`,
            {
              hint: 'Write the code, not the name: "fr" for French, "pt-BR", "zh-Hans". It becomes the lang of the document and a segment of the address.',
            },
          );
        }
        if (typeof folder !== 'string' || folder === '') {
          throw new ConfigError(
            `The translation "${lang}" of version "${version.slug}" has no folder.`,
            {
              hint: "Give the folder holding those pages: { ${lang}: 'docs/v1.0-${lang}' }.",
            },
          );
        }
        if (folder === version.folder) {
          throw new ConfigError(
            `The translation "${lang}" of version "${version.slug}" reads the same folder as the version.`,
            {
              hint: 'A translation is a folder of its own: the same pages would be published twice.',
            },
          );
        }
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

  // Kinds of admonition the project adds. A kind is a label and a tone: the
  // tone carries the colour, taken from the theme, so a new kind needs no
  // stylesheet and follows whichever theme is active.
  if (config.ui !== undefined) {
    if (config.ui === null || typeof config.ui !== 'object' || Array.isArray(config.ui)) {
      throw new ConfigError('ui must be an object of languages.', {
        hint: "Write ui: { fr: { search: 'Chercher' } } — one entry per language.",
      });
    }
    const known = Object.keys(UI_STRINGS.en);
    for (const [lang, words] of Object.entries(config.ui)) {
      if (!words || typeof words !== 'object' || Array.isArray(words)) {
        throw new ConfigError(`The wording of "${lang}" must be an object.`, {
          hint: "Write ui: { fr: { search: 'Chercher' } }.",
        });
      }
      for (const [key, value] of Object.entries(words)) {
        // A key nobody reads would leave the shipped wording in place without
        // a word, and a typo is exactly what this field invites.
        if (!known.includes(key)) {
          throw new ConfigError(`Unknown wording key in "${lang}": "${key}".`, {
            hint: `Keys: ${known.join(', ')}.`,
          });
        }
        // `pages` counts, so it is written by plural category rather than as
        // one word: a language with four of them cannot be served by a pair.
        if (key === 'pages') {
          const forms = Object.values(value ?? {});
          if (typeof value !== 'object' || Array.isArray(value) || forms.length === 0) {
            throw new ConfigError(`The wording "pages" of "${lang}" must be a set of plurals.`, {
              hint: "Write pages: { one: 'page', other: 'pages' } — the categories of the language, 'other' at least.",
            });
          }
          if (forms.some((form) => typeof form !== 'string' || form === '')) {
            throw new ConfigError(`A plural of "pages" in "${lang}" is not a text.`, {
              hint: 'Every category gives the word that follows the number.',
            });
          }
          continue;
        }
        if (typeof value !== 'string' || value === '') {
          throw new ConfigError(`The wording "${key}" of "${lang}" must be a text.`, {
            hint: 'An empty label would leave the element unnamed on screen.',
          });
        }
      }
    }
  }

  if (config.admonitions !== undefined) {
    if (
      config.admonitions === null ||
      typeof config.admonitions !== 'object' ||
      Array.isArray(config.admonitions)
    ) {
      throw new ConfigError('admonitions must be an object of kinds.', {
        hint: "Write admonitions: { review: { label: 'Review', tone: 'info' } }.",
      });
    }
    for (const [name, kind] of Object.entries(config.admonitions)) {
      if (!kind || typeof kind.label !== 'string' || kind.label.trim() === '') {
        throw new ConfigError(`The admonition "${name}" has no label.`, {
          hint: `Write "${name}": { label: '…', tone: '${ADMONITION_TONES[0]}' } — the label is what the reader sees.`,
        });
      }
      if (kind.icon !== undefined && (typeof kind.icon !== 'string' || kind.icon.trim() === '')) {
        throw new ConfigError(`The icon of the admonition "${name}" must be a path.`, {
          hint: "Give an SVG of the version folder — icon: '/icons/review.svg' — or leave the field out.",
        });
      }
      if (!ADMONITION_TONES.includes(kind.tone)) {
        throw new ConfigError(
          `The admonition "${name}" has an unknown tone: "${String(kind.tone)}".`,
          { hint: `Tones: ${ADMONITION_TONES.join(', ')}. The tone is what colours the block.` },
        );
      }
    }
  }

  if (config.stickyHeader !== undefined && typeof config.stickyHeader !== 'boolean') {
    throw new ConfigError('stickyHeader must be true or false.', {
      hint: 'true holds the header at the top of the screen; false lets it scroll away.',
    });
  }

  // Links of the header: site navigation, not page content. A target starts
  // from the root of a version, or names another site; a relative one would
  // change meaning from page to page. A link may name the version it lives in,
  // so that a section written in one version is reachable from all of them.
  if (config.headerLinks !== undefined) {
    if (!Array.isArray(config.headerLinks)) {
      throw new ConfigError('headerLinks must be a list of links.', {
        hint: "For instance headerLinks: [{ label: 'Examples', href: '/examples/' }].",
      });
    }
    const slugs = new Set(config.versions.map((version) => version.slug));

    /** @param {any} link @param {string} where */
    const checkTarget = (link, where) => {
      if (
        typeof link.href !== 'string' ||
        !(link.href.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(link.href))
      ) {
        throw new ConfigError(`${where} needs an absolute target: "${String(link.href)}".`, {
          hint: "Start from the root of the version — '/examples/' — or give a full address.",
        });
      }
      if (link.version !== undefined && !slugs.has(link.version)) {
        throw new ConfigError(`${where} names an unknown version: "${String(link.version)}".`, {
          hint: `Declared versions: ${[...slugs].join(', ')}.`,
        });
      }
    };

    for (const link of config.headerLinks) {
      if (!link || typeof link.label !== 'string' || link.label.trim() === '') {
        throw new ConfigError(`A header link has no label: ${JSON.stringify(link)}.`, {
          hint: "Write { label: 'Examples', href: '/examples/' }.",
        });
      }

      // An entry either leads somewhere, or opens a panel of links: both at
      // once would leave a click meaning two things.
      if (link.columns !== undefined) {
        if (!Array.isArray(link.columns) || link.columns.length === 0) {
          throw new ConfigError(`The columns of "${link.label}" must be a list of columns.`, {
            hint: "Write columns: [{ title: 'Guide', items: [{ label: 'Install', href: '/guide/install/' }] }].",
          });
        }
        if (link.href !== undefined) {
          throw new ConfigError(`The header entry "${link.label}" has both href and columns.`, {
            hint: 'An entry either leads somewhere, or opens a panel: drop one of the two.',
          });
        }
        for (const column of link.columns) {
          if (!column || !Array.isArray(column.items) || column.items.length === 0) {
            throw new ConfigError(`A column of "${link.label}" holds no link.`, {
              hint: "Every column needs items: [{ label: 'Install', href: '/guide/install/' }].",
            });
          }
          if (column.title !== undefined && typeof column.title !== 'string') {
            throw new ConfigError(`A column title of "${link.label}" must be text.`, {
              hint: 'Either write a title, or leave the field out.',
            });
          }
          for (const item of column.items) {
            if (!item || typeof item.label !== 'string' || item.label.trim() === '') {
              throw new ConfigError(
                `A link of "${link.label}" has no label: ${JSON.stringify(item)}.`,
                { hint: "Write { label: 'Install', href: '/guide/install/' }." },
              );
            }
            checkTarget(item, `The link "${item.label}" of "${link.label}"`);
          }
        }
        continue;
      }

      checkTarget(link, `The header link "${link.label}"`);
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
