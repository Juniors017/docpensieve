/**
 * Reads the stylesheets shipped with the package.
 *
 * @module @docpensieve/theme/styles
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ThemeError } from '@docpensieve/shared';

/** Stylesheet folder, resolved from this module rather than from the cwd. */
const STYLES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'styles');

/**
 * Reads a stylesheet of the package.
 *
 * @param {string} name File name, `'structure.css'` for instance.
 * @returns {Promise<string>} Contents, trimmed.
 * @throws {ThemeError} When the stylesheet is missing.
 */
export async function readStyle(name) {
  try {
    return (await readFile(path.join(STYLES_DIR, name), 'utf8')).trim();
  } catch (cause) {
    throw new ThemeError(`Theme stylesheet not found: ${name}.`, {
      cause,
      hint: 'The @docpensieve/theme package looks incomplete: reinstall the dependencies.',
    });
  }
}

/**
 * Joins several CSS fragments into one stylesheet.
 *
 * @param {...(string | undefined | null)} parts
 * @returns {string}
 */
export function joinCss(...parts) {
  return parts
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
}
