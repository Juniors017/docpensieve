/**
 * DocPensieve's custom theme, with no external dependency.
 *
 * @module @docpensieve/theme/custom-provider
 */

import { BaseThemeProvider } from './base-provider.js';
import { joinCss, readStyle } from './styles.js';

/**
 * Palette and measures of the light theme.
 *
 * Dark mode does not live here: it fits in two blocks of `custom.css`, since
 * a flat table of variables cannot express a media query.
 */
export const DEFAULT_TOKENS = Object.freeze({
  '--dp-bg': '#ffffff',
  '--dp-bg-soft': '#f7f8fa',
  '--dp-text': '#1c1e21',
  '--dp-text-soft': '#5f6773',
  '--dp-border': '#e3e6ea',
  '--dp-rule': '#e8ebef',
  '--dp-accent': '#5b57d1',
  '--dp-accent-soft': '#f0effc',
  '--dp-shadow': 'rgba(20, 24, 34, 0.12)',
  '--dp-radius': '6px',
  '--dp-font': 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  '--dp-font-mono':
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  '--dp-content-width': 'none',
  '--dp-sidebar-width': '15.5rem',
  '--dp-toc-width': '13rem',
});

/** Custom theme: hand-written CSS, no dependency. */
export class CustomProvider extends BaseThemeProvider {
  static id = 'custom';

  /**
   * @param {{ tokens?: Record<string, string>, css?: string }} [options]
   *   `tokens` overrides the palette and the measures — keys without a
   *   leading `--` are prefixed by the engine. `css` is appended after the
   *   default stylesheet, so it wins at equal specificity.
   */
  constructor(options = {}) {
    super(options);
    this.tokens = { ...DEFAULT_TOKENS, ...(options.tokens ?? {}) };
    this.extraCss = options.css ?? '';
  }

  /**
   * @returns {Promise<import('./base-provider.js').ThemeOutput>}
   * @throws {ThemeError} When a stylesheet of the package is missing.
   */
  async compile() {
    // Skeleton first, skin second: the grid and the sticky columns are shared
    // with the other providers, only the visual decisions belong to this theme.
    const [structure, prose, skin] = await Promise.all([
      readStyle('structure.css'),
      readStyle('prose.css'),
      readStyle('custom.css'),
    ]);

    return {
      css: joinCss(structure, prose, skin, this.extraCss),
      variables: this.tokens,
    };
  }
}
