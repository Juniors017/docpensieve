import { DEFAULT_THEME_CLASSES, ThemeError } from '@docpensieve/shared';
import { describe, expect, it } from 'vitest';

import { BaseThemeProvider, CustomProvider, DEFAULT_TOKENS, ThemeEngine } from '../src/index.js';

/**
 * Test provider, configurable to check the merging rules.
 *
 * @param {{ css?: string, variables?: Record<string, string> }} output
 * @param {Record<string, string>} [classes] Redefined slots — outside
 *   `compile()`, as the contract requires.
 */
function fakeProvider(output, classes = {}) {
  return new (class extends BaseThemeProvider {
    get classes() {
      return classes;
    }
    async compile() {
      return { css: '', variables: {}, ...output };
    }
  })();
}

describe('BaseThemeProvider', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new BaseThemeProvider()).toThrow(TypeError);
  });

  it('accepts a subclass', () => {
    expect(fakeProvider({})).toBeInstanceOf(BaseThemeProvider);
  });

  it('requires an implementation of compile()', async () => {
    class Incomplete extends BaseThemeProvider {}
    await expect(new Incomplete().compile()).rejects.toThrow('compile()');
  });
});

describe('ThemeEngine — registration', () => {
  it('registers and retrieves a provider', () => {
    const engine = new ThemeEngine().register('a', fakeProvider({}));
    expect(engine.get('a')).toBeInstanceOf(BaseThemeProvider);
  });

  it('chains registrations', () => {
    const engine = new ThemeEngine()
      .register('a', fakeProvider({}))
      .register('b', fakeProvider({}));
    expect(engine.providers.size).toBe(2);
  });

  it('rejects a provider that does not extend BaseThemeProvider', () => {
    // Deliberately incomplete object: the refusal is what is checked.
    // @ts-expect-error
    expect(() => new ThemeEngine().register('nope', { compile: () => {} })).toThrow(TypeError);
  });
});

describe('ThemeEngine — compilation', () => {
  it('refuses to compile without any provider', async () => {
    await expect(new ThemeEngine().compile()).rejects.toThrow(ThemeError);
  });

  it('emits the merged variables in a leading :root block', async () => {
    const engine = new ThemeEngine().register(
      'a',
      fakeProvider({ variables: { '--dp-accent': 'rebeccapurple' }, css: '.x { color: red; }' }),
    );
    const { css } = await engine.compile();

    // The :root block comes before the CSS: a provider can thus override
    // another's palette without duplicating its rules.
    expect(css.indexOf(':root {')).toBeLessThan(css.indexOf('.x {'));
    expect(css).toContain('--dp-accent: rebeccapurple;');
  });

  it('prefixes variables written without the two dashes', async () => {
    const engine = new ThemeEngine().register('a', fakeProvider({ variables: { 'dp-x': '1px' } }));
    expect((await engine.compile()).css).toContain('--dp-x: 1px;');
  });

  it('gives precedence to the last registered provider', async () => {
    const engine = new ThemeEngine()
      .register('a', fakeProvider({ variables: { '--dp-accent': 'red' }, css: '.a {}' }))
      .register('b', fakeProvider({ variables: { '--dp-accent': 'blue' }, css: '.b {}' }));

    const { css, variables } = await engine.compile();
    expect(variables['--dp-accent']).toBe('blue');
    // At equal specificity, the CSS concatenated last wins.
    expect(css.indexOf('.a {}')).toBeLessThan(css.indexOf('.b {}'));
  });

  it('merges class aliases over the default slots', () => {
    const engine = new ThemeEngine()
      .register('a', fakeProvider({}, { article: 'a1', nav: 'n1' }))
      .register('b', fakeProvider({}, { article: 'a2' }));

    // Synchronous and outside compile(): templates need them to be rendered,
    // whereas a utility provider needs the rendered pages.
    const { classes } = engine;
    expect(classes).toMatchObject({ article: 'a2', nav: 'n1' });
    // Slots no provider redefines fall back to the shared value: a template
    // never receives an undefined class.
    expect(classes.footer).toBe(DEFAULT_THEME_CLASSES.footer);
    expect(Object.keys(classes)).toHaveLength(Object.keys(DEFAULT_THEME_CLASSES).length);
  });

  it('names the faulty provider when its compilation fails', async () => {
    const broken = new (class extends BaseThemeProvider {
      /** @returns {Promise<import('../src/base-provider.js').ThemeOutput>} */
      async compile() {
        throw new Error('boom');
      }
    })();

    await expect(new ThemeEngine().register('broken', broken).compile()).rejects.toThrow(/broken/);
  });
});

describe('CustomProvider', () => {
  it('ships the package stylesheet and the default palette', async () => {
    const { css, variables } = await new CustomProvider().compile();

    expect(css).toContain('.dp-nav');
    expect(css).toContain('.dp-article');
    expect(variables['--dp-accent']).toBe(DEFAULT_TOKENS['--dp-accent']);
    // The custom theme redefines no slot: the dp-* classes of shared are
    // precisely its own.
    expect(new CustomProvider().classes).toEqual({});
  });

  it('includes the prose typography', async () => {
    const { css } = await new CustomProvider().compile();
    expect(css).toContain('.dp-article h2');
    expect(css).toContain('.dp-article blockquote');
  });

  it('includes the shared skeleton on top of its skin', async () => {
    const { css } = await new CustomProvider().compile();
    expect(css).toContain('.dp-shell');
    expect(css).toContain('grid-template-columns');
    // The skeleton comes first: the skin must be able to override it.
    expect(css.indexOf('.dp-shell')).toBeLessThan(css.indexOf('--dp-accent-soft'));
  });

  it('carries the Shiki dark switch, without JavaScript', async () => {
    const { css } = await new CustomProvider().compile();
    expect(css).toContain('--shiki-dark');
    expect(css).toContain('prefers-color-scheme: dark');
  });

  it('accepts an overridden palette', async () => {
    const { variables } = await new CustomProvider({
      tokens: { '--dp-accent': '#008060' },
    }).compile();

    expect(variables['--dp-accent']).toBe('#008060');
    // The other tokens stay in place.
    expect(variables['--dp-bg']).toBe(DEFAULT_TOKENS['--dp-bg']);
  });

  it('appends the project CSS after its own', async () => {
    const { css } = await new CustomProvider({ css: '.project { color: red; }' }).compile();
    expect(css.trimEnd().endsWith('.project { color: red; }')).toBe(true);
  });

  it('plugs into the engine', async () => {
    const { css } = await new ThemeEngine().register('custom', new CustomProvider()).compile();
    expect(css).toContain('--dp-accent:');
    expect(css).toContain('.dp-nav-link');
  });
});
