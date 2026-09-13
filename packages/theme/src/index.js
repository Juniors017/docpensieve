/**
 * @docpensieve/theme — composable theme providers.
 * @module @docpensieve/theme
 */

/**
 * Types of the provider contract, re-exported for consumers of the published
 * package: without this they would only be reachable through an internal path.
 *
 * @typedef {import('./base-provider.js').ThemeOutput} ThemeOutput
 * @typedef {import('./base-provider.js').CompileContext} CompileContext
 */

export { BaseThemeProvider } from './base-provider.js';
export { CustomProvider, DEFAULT_TOKENS } from './custom-provider.js';
export { TailwindProvider } from './tailwind-provider.js';
export { ThemeEngine } from './theme-engine.js';
