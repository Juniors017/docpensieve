/**
 * Stylesheet of the shipped components.
 *
 * @module @docpensieve/components/styles
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DocPensieveError } from '@docpensieve/shared';

/** Stylesheet folder, resolved from this module rather than from the cwd. */
const STYLES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'styles');

/**
 * Reads the default look of the components.
 *
 * It is concatenated with the theme's by the caller: a provider that
 * redefines a slot replaces the `dp-*` class with its own, and these rules
 * then stop applying by themselves.
 *
 * @returns {Promise<string>} CSS, trimmed.
 * @throws {DocPensieveError} When the stylesheet is missing.
 */
export async function componentsCss() {
  try {
    return (await readFile(path.join(STYLES_DIR, 'components.css'), 'utf8')).trim();
  } catch (cause) {
    throw new DocPensieveError('Components stylesheet not found.', {
      cause,
      hint: 'The @docpensieve/components package looks incomplete: reinstall the dependencies.',
    });
  }
}
