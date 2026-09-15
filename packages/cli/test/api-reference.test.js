import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { API_PAGE, renderApiReference } from '../../../scripts/api-reference.mjs';

describe('the API reference', () => {
  it('matches the JSDoc of the sources', () => {
    // Written by hand, such a page goes stale at the first renamed parameter.
    // Generated, it only needs running again: npm run api:docs.
    expect(readFileSync(API_PAGE, 'utf8')).toBe(renderApiReference());
  });
});
