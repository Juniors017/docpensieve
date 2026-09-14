/**
 * Builds the theme engine from the configuration.
 *
 * @module docpensieve/theme
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { setThemeClasses, setThemeFramework } from '@docpensieve/components';
import { ConfigError, THEME_FOLDER, THEME_FRAMEWORKS } from '@docpensieve/shared';
import { CustomProvider, TailwindProvider, ThemeEngine } from '@docpensieve/theme';

/**
 * Reads the project's own stylesheets: every `.css` file of its `theme/`
 * folder, in name order. None when the folder does not exist.
 *
 * @param {string} [rootDir] Project root.
 * @returns {string[]} The contents of each file.
 */
export function projectCss(rootDir) {
  const folder = rootDir ? path.join(rootDir, THEME_FOLDER) : '';
  if (!folder || !existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => name.toLowerCase().endsWith('.css'))
    .sort()
    .map((name) => readFileSync(path.join(folder, name), 'utf8').trim());
}

/**
 * Mounts the ThemeEngine matching the declared framework.
 *
 * The CLI does this wiring: `core` deliberately ignores the `theme` package
 * and receives the engine by injection (ADR-002).
 *
 * Along the way, the class table and the framework are handed to the
 * components: that is what lets them ask for their class instead of
 * hard-coding it (ADR-007), and lets `ForTheme` keep the variant of the active
 * theme.
 *
 * @param {Record<string, any>} config Normalised configuration.
 * @param {string} [extraCss] CSS appended after the theme's — the look of the
 *   components, which the caller has read.
 * @returns {ThemeEngine}
 * @throws {ConfigError} For a framework the project does not know.
 */
export function createTheme(config, extraCss = '') {
  const theme = config.theme ?? {};
  const framework = theme.framework ?? 'tailwind';

  // Components first, project CSS after: the latter must be able to correct
  // them. The theme folder comes last — the project's final word, and the
  // only place the custom theme finds the classes a page uses.
  const options = {
    tokens: theme.tokens,
    css: [extraCss, theme.css, ...projectCss(config.rootDir)].filter(Boolean).join('\n\n'),
  };

  /** @param {ThemeEngine} engine */
  const mount = (engine) => {
    setThemeClasses(engine.classes);
    setThemeFramework(framework);
    return engine;
  };

  if (framework === 'custom') {
    return mount(new ThemeEngine().register('custom', new CustomProvider(options)));
  }
  if (framework === 'tailwind') {
    return mount(
      new ThemeEngine().register(
        'tailwind',
        new TailwindProvider({ ...options, source: theme.source }),
      ),
    );
  }

  // The announced frameworks are all written: getting here means a faulty
  // configuration, not an upcoming milestone.
  throw new ConfigError(`Unknown theme framework: "${framework}".`, {
    hint: `Accepted values: ${THEME_FRAMEWORKS.join(', ')}.`,
  });
}
