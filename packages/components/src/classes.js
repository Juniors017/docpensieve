/**
 * Resolution of component classes.
 *
 * A component never writes a framework class. It asks for the class of its
 * slot, and the theme answers — or not. Without an answer, the fallback is a
 * `dp-*` class that the package stylesheet styles on the `--dp-*` tokens: the
 * component therefore follows the active palette without knowing anything
 * about it (ADR-007).
 *
 * @module @docpensieve/components/classes
 */

/**
 * Table supplied by the theme, set once by the generator.
 *
 * Module state rather than a React context: MDX compilation happens in a
 * single process, with a single configuration, and a context would force
 * `core` to know this package — which ADR-002 forbids.
 *
 * @type {Record<string, string>}
 */
let themeClasses = {};

/**
 * Declares the theme table for the whole compilation.
 *
 * @param {Record<string, string>} [classes]
 */
export function setThemeClasses(classes = {}) {
  themeClasses = classes;
}

/** @returns {Record<string, string>} The current table, for inspection. */
export function getThemeClasses() {
  return themeClasses;
}

/**
 * Framework of the active theme, announced alongside the class table. Empty
 * until then.
 */
let themeFramework = '';

/**
 * Declares the framework of the active theme, which `ForTheme` reads.
 *
 * @param {string} [framework]
 */
export function setThemeFramework(framework = '') {
  themeFramework = framework;
}

/** @returns {string} The active framework, or `''` when none was announced. */
export function getThemeFramework() {
  return themeFramework;
}

/**
 * Converts a slot name into a fallback class.
 *
 * @example
 * fallbackClass('cardHeader')  // 'dp-card-header'
 *
 * @param {string} slot
 * @returns {string}
 */
export function fallbackClass(slot) {
  return `dp-${slot.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

/**
 * Class of a slot, variants included.
 *
 * @example
 * cls('card')                  // 'dp-card'
 * cls('card', 'shadow')        // 'dp-card dp-card--shadow'
 * cls('alert', false && 'x')   // 'dp-alert' — falsy values are ignored
 *
 * @param {string} slot Slot name.
 * @param {...unknown} modifiers Variants, each one suffixed as `--variant`.
 *   Falsy values are ignored, which allows writing `cls('card', shadow && shadow)`.
 * @returns {string}
 */
export function cls(slot, ...modifiers) {
  const base = themeClasses[slot] ?? fallbackClass(slot);
  const root = fallbackClass(slot);

  // `filter(Boolean)` lets 0 through: a `span && ...` on a zero number would
  // produce “--0”. Only non-empty strings are kept.
  const variants = modifiers
    .filter((modifier) => typeof modifier === 'string' && modifier !== '')
    .map((modifier) => themeClasses[`${slot}.${modifier}`] ?? `${root}--${modifier}`);

  return [base, ...variants].join(' ');
}

/**
 * Joins classes while ignoring falsy values.
 *
 * A minimal equivalent of `clsx`: one more dependency is not worth it for six
 * lines.
 *
 * @param {...unknown} parts
 * @returns {string | undefined} `undefined` when nothing is left, to avoid a
 *   `class=""` in the produced HTML.
 */
export function classNames(...parts) {
  const kept = parts.filter(Boolean).join(' ').trim();
  return kept === '' ? undefined : kept;
}
