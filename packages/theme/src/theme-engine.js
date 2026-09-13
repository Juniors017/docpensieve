/**
 * Registration and merging of theme providers.
 *
 * @module @docpensieve/theme/theme-engine
 */

import { DEFAULT_THEME_CLASSES, ThemeError } from '@docpensieve/shared';

import { BaseThemeProvider } from './base-provider.js';

/**
 * Serialises a table of variables into a `:root` block.
 *
 * @param {Record<string, string>} variables
 * @returns {string} CSS block, or an empty string when there is nothing to write.
 */
function toRootBlock(variables) {
  const entries = Object.entries(variables);
  if (entries.length === 0) return '';

  const declarations = entries
    .map(([name, value]) => `  ${name.startsWith('--') ? name : `--${name}`}: ${value};`)
    .join('\n');

  return `:root {\n${declarations}\n}\n`;
}

/** Combines several providers into a single CSS output. */
export class ThemeEngine {
  constructor() {
    /** @type {Map<string, BaseThemeProvider>} */
    this.providers = new Map();
  }

  /**
   * @param {string} id Provider identifier.
   * @param {BaseThemeProvider} provider
   * @returns {this} To chain registrations.
   */
  register(id, provider) {
    if (!(provider instanceof BaseThemeProvider)) {
      throw new TypeError(`The provider "${id}" must extend BaseThemeProvider.`);
    }
    this.providers.set(id, provider);
    return this;
  }

  /**
   * @param {string} id
   * @returns {BaseThemeProvider | undefined}
   */
  get(id) {
    return this.providers.get(id);
  }

  /**
   * Shell class aliases, all providers combined.
   *
   * Synchronous and independent of `compile()`: templates need these classes
   * to be rendered, whereas a utility provider needs the rendered pages to
   * compile its CSS.
   *
   * @returns {Record<string, string>} Shared slots, overridden by each
   *   provider in registration order.
   */
  get classes() {
    const merged = { ...DEFAULT_THEME_CLASSES };
    for (const provider of this.providers.values()) Object.assign(merged, provider.classes ?? {});
    return merged;
  }

  /**
   * Merges the outputs of every registered provider.
   *
   * Registration order sets precedence: the last one registered wins on
   * variables and class aliases, and its CSS is concatenated last, so it wins
   * at equal specificity.
   *
   * The merged variables are emitted in a single `:root` block placed
   * **before** the providers' CSS. That is what lets a provider override
   * another's palette without duplicating its rules.
   *
   * @param {import('./base-provider.js').CompileContext} [context] Passed as
   *   is to every provider.
   * @returns {Promise<import('./base-provider.js').ThemeOutput>}
   * @throws {ThemeError} When no provider is registered.
   */
  async compile(context) {
    if (this.providers.size === 0) {
      throw new ThemeError('No theme provider registered.', {
        hint: 'Register at least one provider, for example new CustomProvider(), before calling compile().',
      });
    }

    /** @type {Record<string, string>} */
    const variables = {};
    /** @type {string[]} */
    const sheets = [];

    for (const [id, provider] of this.providers) {
      let output;
      try {
        output = await provider.compile(context);
      } catch (cause) {
        if (cause instanceof ThemeError) throw cause;
        throw new ThemeError(`The provider "${id}" failed.`, { cause });
      }

      Object.assign(variables, output?.variables ?? {});
      if (output?.css) sheets.push(output.css.trim());
    }

    const css = [toRootBlock(variables), ...sheets].filter(Boolean).join('\n\n');
    return { css: `${css}\n`, variables };
  }
}
