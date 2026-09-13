import { describe, expect, it } from 'vitest';

import {
  assetPathToSlug,
  dirPathToSlug,
  filePathToSlug,
  orderOf,
  slugify,
  slugToUrl,
} from '../src/index.js';

describe('slugify', () => {
  it('drops accents instead of percent-encoding them', () => {
    expect(slugify('Crème Brûlée')).toBe('creme-brulee');
    expect(slugify('Déjà vu à Noël')).toBe('deja-vu-a-noel');
  });

  it('normalises separators and apostrophes', () => {
    expect(slugify("User's guide")).toBe('users-guide');
    expect(slugify('User’s guide')).toBe('users-guide');
    expect(slugify('  Multiple   spaces  ')).toBe('multiple-spaces');
  });

  it('leaves no leading or trailing dash', () => {
    expect(slugify('!! Warning !!')).toBe('warning');
  });
});

describe('filePathToSlug', () => {
  it('removes the extension and the ordering prefix', () => {
    expect(filePathToSlug('guide/01-install.md')).toBe('guide/install');
    expect(filePathToSlug('02_advanced.mdx')).toBe('advanced');
    expect(filePathToSlug('10.migration.md')).toBe('migration');
  });

  it('treats index and readme as the root of their folder', () => {
    expect(filePathToSlug('guide/index.md')).toBe('guide');
    expect(filePathToSlug('guide/README.md')).toBe('guide');
    expect(filePathToSlug('index.md')).toBe('');
  });

  it('accepts Windows separators', () => {
    expect(filePathToSlug('guide\\01-install.md')).toBe('guide/install');
  });

  it('applies slugify to every segment', () => {
    expect(filePathToSlug('Café Guide/01-Première Étape.mdx')).toBe('cafe-guide/premiere-etape');
  });
});

describe('slugToUrl', () => {
  it('wraps the slug in slashes', () => {
    expect(slugToUrl('guide/install')).toBe('/guide/install/');
    expect(slugToUrl('intro')).toBe('/intro/');
  });

  it('returns the root for an empty slug', () => {
    expect(slugToUrl('')).toBe('/');
  });

  it('prefixes /versions/<slug> when a version is given', () => {
    expect(slugToUrl('intro', 'v1.0')).toBe('/versions/v1.0/intro/');
    expect(slugToUrl('', 'v0.9')).toBe('/versions/v0.9/');
  });
});

describe('orderOf', () => {
  it('reads the numeric prefix', () => {
    expect(orderOf('01-install.md')).toBe(1);
    expect(orderOf('10_migration.md')).toBe(10);
  });

  it('returns Infinity without a prefix, to sort last', () => {
    expect(orderOf('install.md')).toBe(Infinity);
  });

  it('orders a mixed list correctly', () => {
    const files = ['zzz.md', '02-b.md', '01-a.md'];
    expect(files.sort((a, b) => orderOf(a) - orderOf(b))).toEqual(['01-a.md', '02-b.md', 'zzz.md']);
  });
});

describe('assetPathToSlug', () => {
  it('removes the ordering prefix of folders, as for a page', () => {
    // Otherwise the prefix vanishes from page URLs but stays in the URLs of
    // their images: every relative reference misses.
    expect(assetPathToSlug('02-guide/diagram.png')).toBe('guide/diagram.png');
    expect(assetPathToSlug('01-a/02-b/x.png')).toBe('a/b/x.png');
  });

  it('slugifies folders the way a page path does', () => {
    expect(assetPathToSlug('My Notes/a.png')).toBe('my-notes/a.png');
  });

  it('leaves the file name untouched', () => {
    // It is the one the author writes in their Markdown: rewriting it would
    // break the reference.
    expect(assetPathToSlug('guide/01-Schéma Final.PNG')).toBe('guide/01-Schéma Final.PNG');
  });

  it('accepts a file at the root', () => {
    expect(assetPathToSlug('logo.svg')).toBe('logo.svg');
  });
});

describe('dirPathToSlug', () => {
  it('slugifies every segment, the last one included', () => {
    // Applied to a folder, the asset rule spared the last segment as if it
    // were a file name: “02-guide” stayed “02-guide”, and the relative targets
    // of the pages in that folder missed.
    expect(dirPathToSlug('02-guide')).toBe('guide');
    expect(dirPathToSlug('02-guide/03-sub')).toBe('guide/sub');
    expect(dirPathToSlug('My Notes')).toBe('my-notes');
  });

  it('returns an empty string for the version root', () => {
    expect(dirPathToSlug('')).toBe('');
  });
});
