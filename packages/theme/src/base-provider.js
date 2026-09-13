/**
 * Contract shared by every theme provider.
 * @module @docpensieve/theme/base-provider
 */

/**
 * @typedef {object} ThemeOutput
 * @property {string} css CSS to concatenate into the final stylesheet.
 * @property {Record<string, string>} variables Exposed CSS variables (`--dp-*`).
 */

/**
 * @typedef {object} CompileContext
 * @property {string[]} [candidates] Class names collected from the rendered
 *   pages. A utility provider, Tailwind first and foremost, only emits the
 *   matching rules; the others ignore them.
 */

/**
 * Base class to extend in order to plug in a CSS framework.
 *
 * A provider generates no HTML: it supplies CSS, variables and a table of
 * class aliases. That is what lets a single template render correctly under
 * Tailwind as well as under the custom theme.
 */
export class BaseThemeProvider {
  /** Short provider identifier, unique within the engine. */
  static id = 'base';

  /** @param {Record<string, any>} [options] Options taken from `config.theme`. */
  constructor(options = {}) {
    if (new.target === BaseThemeProvider) {
      throw new TypeError('BaseThemeProvider is abstract: extend it instead of instantiating it.');
    }
    this.options = options;
  }

  /**
   * Class aliases this provider imposes on the shell slots.
   *
   * Deliberately synchronous and outside `compile()`: templates need these
   * classes to be rendered, and a utility provider needs the rendered pages to
   * compile its CSS. Keeping them apart breaks that circular dependency.
   *
   * @returns {Record<string, string>} Redefined slots, the others falling back
   *   to `DEFAULT_THEME_CLASSES`.
   */
  get classes() {
    return {};
  }

  /**
   * Produces the provider's CSS contribution.
   *
   * @param {CompileContext} [_context]
   * @returns {Promise<ThemeOutput>}
   * @abstract
   */
  async compile(_context) {
    throw new Error(`${this.constructor.name} must implement compile().`);
  }
}
