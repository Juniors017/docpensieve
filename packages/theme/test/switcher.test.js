import { describe, expect, it } from 'vitest';

import { CustomProvider, TailwindProvider } from '../src/index.js';

describe('the version switcher', () => {
  it('draws its chevron as a box, whatever its parent', async () => {
    // Under Tailwind the summary is not a flex container: an inline ::after
    // ignored its size, and the chevron came out as a single vertical stroke.
    for (const provider of [new CustomProvider(), new TailwindProvider()]) {
      const { css } = await provider.compile({ candidates: [] });
      const at = css.indexOf('.dp-versions > summary::after {');
      expect(at, provider.constructor.name).toBeGreaterThan(-1);
      expect(css.slice(at, css.indexOf('}', at)), provider.constructor.name).toContain(
        'display: inline-block',
      );
    }
  });
});
