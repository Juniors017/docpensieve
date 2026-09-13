/**
 * Theme built on Tailwind CSS.
 *
 * @module @docpensieve/theme/tailwind-provider
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import { ThemeError } from '@docpensieve/shared';

import { BaseThemeProvider } from './base-provider.js';
import { joinCss, readStyle } from './styles.js';

/**
 * DocPensieve tokens, as literal values of the Tailwind palette.
 *
 * Tailwind only emits a theme variable when a class uses it:
 * `var(--color-slate-700)` would stay empty as long as nobody writes
 * `text-slate-700`. The values are therefore copied, at the cost of a possible
 * drift if Tailwind retouches its palette.
 */
const TAILWIND_TOKENS = Object.freeze({
  '--dp-bg': '#ffffff',
  '--dp-bg-soft': 'oklch(96.8% 0.007 247.896)',
  '--dp-text': 'oklch(20.8% 0.042 265.755)',
  '--dp-text-soft': 'oklch(55.4% 0.046 257.417)',
  '--dp-border': 'oklch(92.9% 0.013 255.508)',
  '--dp-rule': 'oklch(92.9% 0.013 255.508)',
  '--dp-accent': 'oklch(51.1% 0.262 276.966)',
  '--dp-accent-soft': 'oklch(96.2% 0.018 272.314)',
  '--dp-shadow': 'rgba(15, 23, 42, 0.12)',
  '--dp-radius': '0.375rem',
  '--dp-font': 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
  '--dp-font-mono': 'var(--font-mono, ui-monospace, monospace)',
  '--dp-content-width': 'none',
  '--dp-sidebar-width': '15.5rem',
  '--dp-toc-width': '13rem',
});

/**
 * Slots dressed in Tailwind utilities.
 *
 * The `dp-*` classes stay first: they are what the shared skeleton and the
 * bridge target. Everything else is utilities, including the current-page
 * state, expressed through the `aria-[current=page]` variant.
 */
const TAILWIND_CLASSES = Object.freeze({
  header:
    'dp-header border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90',
  brand: 'dp-brand font-semibold tracking-tight text-slate-900 no-underline dark:text-slate-100',
  versionsList:
    'dp-versions-list rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900',
  sidebar: 'dp-sidebar text-sm',
  navLink:
    'dp-nav-link block rounded px-2 py-1 no-underline text-slate-600 hover:bg-slate-100 hover:text-slate-900 aria-[current=page]:bg-indigo-50 aria-[current=page]:font-medium aria-[current=page]:text-indigo-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:aria-[current=page]:bg-slate-800 dark:aria-[current=page]:text-indigo-300',
  navLabel:
    'dp-nav-label block px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500',
  toc: 'dp-toc text-sm',
  tocTitle: 'dp-toc-title mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
  tocList: 'dp-toc-list border-l border-slate-200 dark:border-slate-800',
  footer:
    'dp-footer border-t border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800',
});

/** Minimal stylesheet handed to Tailwind, unless the project says otherwise. */
const DEFAULT_SOURCE = '@import "tailwindcss";';

/** Tailwind theme: on-demand compilation of the classes actually used. */
export class TailwindProvider extends BaseThemeProvider {
  static id = 'tailwind';

  /**
   * @param {{ tokens?: Record<string, string>, css?: string, source?: string }} [options]
   *   `source` replaces the entry stylesheet handed to Tailwind, to put a
   *   `@theme` block or additional directives in it.
   */
  constructor(options = {}) {
    super(options);
    this.tokens = { ...TAILWIND_TOKENS, ...(options.tokens ?? {}) };
    this.extraCss = options.css ?? '';
    this.source = options.source ?? DEFAULT_SOURCE;
  }

  /** @returns {Record<string, string>} Slots dressed in utilities. */
  get classes() {
    return { ...TAILWIND_CLASSES };
  }

  /**
   * Loads Tailwind.
   *
   * It ships as a dependency of this package, but is only loaded when this
   * provider compiles: a project on the custom theme never pays for it. A
   * failure here means a broken installation.
   *
   * @returns {Promise<{ compile: Function, dir: string }>}
   * @throws {ThemeError} When the `tailwindcss` package cannot be found.
   */
  async #loadTailwind() {
    try {
      const require = createRequire(import.meta.url);
      const dir = path.dirname(require.resolve('tailwindcss/package.json'));
      const { compile } = await import('tailwindcss');
      return { compile, dir };
    } catch (cause) {
      throw new ThemeError('The "tailwindcss" package cannot be found.', {
        cause,
        hint: 'Reinstall the dependencies with "npm install", or choose the custom theme in the configuration file.',
      });
    }
  }

  /**
   * @param {import('./base-provider.js').CompileContext} [context]
   * @returns {Promise<import('./base-provider.js').ThemeOutput>}
   * @throws {ThemeError} When Tailwind is missing or its compilation fails.
   */
  async compile(context = {}) {
    const { compile, dir } = await this.#loadTailwind();

    // The classes collected from the rendered pages, plus ours in case the
    // provider is compiled outside the generator. The union avoids emitting
    // rules for utilities nobody writes.
    const candidates = new Set(context.candidates ?? []);
    for (const value of Object.values(TAILWIND_CLASSES)) {
      for (const token of value.split(/\s+/)) if (token) candidates.add(token);
    }

    let utilities;
    try {
      const compiler = await compile(this.source, {
        base: dir,
        /** @param {string} id */
        async loadStylesheet(id) {
          const relative =
            id === 'tailwindcss' ? 'index.css' : `${id.replace(/^tailwindcss\//, '')}.css`;
          const file = path.join(dir, relative);
          return { path: file, base: path.dirname(file), content: await readFile(file, 'utf8') };
        },
        async loadModule() {
          throw new ThemeError('Tailwind plugins are not supported yet.', {
            hint: 'Remove the @plugin directives from theme.source.',
          });
        },
      });
      utilities = compiler.build([...candidates]);
    } catch (cause) {
      if (cause instanceof ThemeError) throw cause;
      throw new ThemeError('Tailwind compilation failed.', { cause });
    }

    const [structure, prose, bridge] = await Promise.all([
      readStyle('structure.css'),
      readStyle('prose.css'),
      readStyle('tailwind-bridge.css'),
    ]);

    // Tailwind first — Preflight included: the skeleton, the prose and the
    // bridge must be able to correct it.
    return {
      css: joinCss(utilities, structure, prose, bridge, this.extraCss),
      variables: this.tokens,
    };
  }
}
