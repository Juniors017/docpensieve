import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { API_PAGES, renderApiReference } from '../../../scripts/api-reference.mjs';

describe('the API reference', () => {
  for (const [lang, file] of Object.entries(API_PAGES)) {
    it(`matches the JSDoc of the sources, in ${lang}`, () => {
      // Written by hand, such a page goes stale at the first renamed parameter.
      // Generated, it only needs running again: npm run api:docs.
      expect(readFileSync(file, 'utf8')).toBe(renderApiReference(lang));
    });
  }

  it('translates its own prose, never the sources', () => {
    // The JSDoc of this project is English by rule, so a French page can only
    // translate what the script writes around them. Saying so is what keeps
    // the next reader from "fixing" the English inside.
    const french = renderApiReference('fr');

    expect(french).toContain('| Paramètre | Type |');
    expect(french).toContain('**Renvoie**');
    expect(french).toContain('Les signatures et leurs descriptions restent en anglais');
  });
});
