/**
 * Content kept for one theme only.
 *
 * A page that shows how to style a component cannot say the same thing to
 * every site: with the utility theme, the look comes from its classes; with
 * the custom theme, from classes the project writes itself. `ForTheme` keeps
 * each variant for the site whose theme matches, at build time — the other
 * one does not even reach the HTML. Changing the theme in the configuration
 * therefore changes what the pages show, without editing them.
 *
 * @module @docpensieve/components/for-theme
 */

import { Fragment, createElement as h } from 'react';

import { DocPensieveError, THEME_FRAMEWORKS } from '@docpensieve/shared';

import { getThemeFramework } from './classes.js';

/**
 * Renders its children only when the site's theme is `framework`.
 *
 * @param {{ framework?: string, children?: any }} props
 * @returns {any}
 * @throws {DocPensieveError} For a framework the configuration does not know,
 *   or when no theme was announced.
 */
export function ForTheme({ framework, children }) {
  if (!framework || !THEME_FRAMEWORKS.includes(framework)) {
    throw new DocPensieveError(`<ForTheme> does not know the framework "${framework ?? ''}".`, {
      hint: `framework expects one of: ${THEME_FRAMEWORKS.join(', ')}.`,
    });
  }

  // Rendering nothing here would drop every variant: a page emptied without
  // a word.
  const active = getThemeFramework();
  if (!active) {
    throw new DocPensieveError('<ForTheme> was rendered before any theme was announced.', {
      hint: 'The generator announces the theme with setThemeFramework() before rendering.',
    });
  }

  return active === framework ? h(Fragment, null, children) : null;
}
