import { describe, expect, it } from 'vitest';

import { TailwindProvider, ThemeEngine } from '../src/index.js';

/** The first call to Tailwind loads its engine: generous timeout. */
const TAILWIND_TIMEOUT = 40_000;

describe('TailwindProvider', () => {
  it('dresses the slots in utilities', () => {
    const { classes } = new TailwindProvider();
    expect(classes.navLink).toContain('dp-nav-link');
    expect(classes.navLink).toContain('rounded');
    // The current-page state is expressed as a variant, since a static
    // template cannot set a conditional class.
    expect(classes.navLink).toContain('aria-[current=page]:');
  });

  it(
    'only emits the requested utilities',
    async () => {
      const { css } = await new TailwindProvider().compile({ candidates: ['flex', 'gap-2'] });

      expect(css).toContain('.flex');
      expect(css).toContain('.gap-2');
      // A class nobody writes has no business in the output.
      expect(css).not.toContain('.text-9xl');
    },
    TAILWIND_TIMEOUT,
  );

  it(
    'includes its own slots even without candidates',
    async () => {
      const { css } = await new TailwindProvider().compile();
      expect(css).toContain('aria-current');
    },
    TAILWIND_TIMEOUT,
  );

  it(
    'restores the typography that Preflight wipes out',
    async () => {
      // Without prose.css, a Tailwind article would come out entirely bare.
      const { css } = await new TailwindProvider().compile({ candidates: [] });
      expect(css).toContain('.dp-article h2');
      expect(css).toContain('.dp-article blockquote');
    },
    TAILWIND_TIMEOUT,
  );

  it(
    'plugs into the engine',
    async () => {
      const engine = new ThemeEngine().register('tailwind', new TailwindProvider());
      const { css, variables } = await engine.compile({ candidates: ['flex'] });

      expect(variables['--dp-accent']).toMatch(/^oklch/);
      expect(css).toContain('--dp-accent:');
      expect(engine.classes.navLink).toContain('dp-nav-link');
    },
    TAILWIND_TIMEOUT,
  );
});
