import { describe, expect, it } from 'vitest';

import { CustomProvider, TailwindProvider } from '../src/index.js';

describe('a colour scheme set on <html>', () => {
  it('drives the dark: utilities, which still follow the system otherwise', async () => {
    // Tailwind alone follows the system only: a site kept dark showed its
    // light utilities — dark text — on a dark ground.
    const { css } = await new TailwindProvider().compile({ candidates: ['dark:bg-slate-900'] });
    expect(css).toContain(':where(.dark, .dark *)');
    expect(css).toContain(':where(:not(.light, .light *))');
  });

  it('switches the tokens and the native controls of both skins', async () => {
    for (const provider of [new CustomProvider(), new TailwindProvider()]) {
      const { css } = await provider.compile({ candidates: [] });
      expect(css, provider.constructor.name).toContain(':root.dark');
      expect(css, provider.constructor.name).toContain('color-scheme: dark');
      expect(css, provider.constructor.name).toContain(':root.light');
    }
  });
});
