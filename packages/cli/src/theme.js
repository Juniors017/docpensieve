/**
 * Builds the theme engine from the configuration.
 *
 * @module docpensieve/theme
 */

import { setThemeClasses } from '@docpensieve/components';
import { ConfigError, THEME_FRAMEWORKS } from '@docpensieve/shared';
import { CustomProvider, TailwindProvider, ThemeEngine } from '@docpensieve/theme';

/**
 * Mounts the ThemeEngine matching the declared framework.
 *
 * The CLI does this wiring: `core` deliberately ignores the `theme` package
 * and receives the engine by injection (ADR-002).
 *
 * Along the way, the class table is handed to the components: that is what
 * lets them ask for their class instead of hard-coding it (ADR-007).
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

  // Components first, project CSS second: the latter must be able to correct
  // them.
  const options = {
    tokens: theme.tokens,
    css: [extraCss, theme.css].filter(Boolean).join('\n\n'),
  };

  /** @param {ThemeEngine} engine */
  const mount = (engine) => {
    setThemeClasses(engine.classes);
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
