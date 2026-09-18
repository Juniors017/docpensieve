/**
 * Icons taken from an icon set, at build time.
 *
 * An icon is named `prefix:name` — the way those collections name them. The
 * set is read from the package the project installed, and the drawing is
 * placed in the page like any other icon: the reader downloads nothing, and no
 * request leaves their browser. The online service those collections offer
 * would mean both.
 *
 * The sets are **optional dependencies of the project**: a site installs the
 * ones it uses, and this package keeps depending on nothing but `shared`. A
 * set that is not installed stops the build, naming what to install.
 *
 * @module @docpensieve/components/iconify
 */

import { createRequire } from 'node:module';
import path from 'node:path';

import { DocPensieveError } from '@docpensieve/shared';

/** `prefix:name` — never a path, which always holds a dot or a slash. */
const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-.][a-z0-9]+)*$/;

/**
 * Whether a target names an icon of a set rather than a file.
 *
 * @param {string} src
 * @returns {boolean}
 */
export function isIconName(src) {
  return ICON_NAME.test(src) && !src.includes('/');
}

/**
 * Sets already read, by prefix. A page uses the same set many times over.
 *
 * @type {Map<string, any>}
 */
const sets = new Map();

/** Drawings already assembled, by full name. @type {Map<string, string>} */
const drawings = new Map();

/**
 * Loads an icon set from the project.
 *
 * Two resolutions are tried: from this package — where a hoisted install puts
 * the set within reach — and from the project folder, which covers the rest.
 *
 * @param {string} prefix
 * @returns {any} The set, as the collection ships it.
 * @throws {DocPensieveError} When the set is not installed.
 */
function loadSet(prefix) {
  const known = sets.get(prefix);
  if (known) return known;

  const specifier = `@iconify-json/${prefix}/icons.json`;
  const froms = [import.meta.url, path.join(process.cwd(), 'noop.js')];

  for (const from of froms) {
    try {
      const set = createRequire(from)(specifier);
      sets.set(prefix, set);
      return set;
    } catch {
      // Tried elsewhere before giving up.
    }
  }

  throw new DocPensieveError(`No icon set installed for "${prefix}".`, {
    hint: `Install the set beside your project: npm install --save-dev @iconify-json/${prefix}`,
  });
}

/**
 * The drawing of an icon, as a complete `svg` tag.
 *
 * @param {string} name Full name, `prefix:icon`.
 * @returns {string}
 * @throws {DocPensieveError} Set not installed, or icon absent from it.
 */
export function iconSvg(name) {
  const known = drawings.get(name);
  if (known !== undefined) return known;

  const [prefix, icon] = name.split(':');
  const set = loadSet(prefix);

  // A set names some icons twice: the second name is an alias of the first.
  const alias = set.aliases?.[icon];
  const entry = set.icons?.[icon] ?? (alias ? set.icons?.[alias.parent] : undefined);

  if (!entry) {
    throw new DocPensieveError(`The icon set "${prefix}" holds no icon named "${icon}".`, {
      hint: `Check the name in that collection: it is written ${prefix}:some-icon.`,
    });
  }

  const width = entry.width ?? set.width ?? 16;
  const height = entry.height ?? set.height ?? 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${entry.body}</svg>`;

  drawings.set(name, svg);
  return svg;
}
