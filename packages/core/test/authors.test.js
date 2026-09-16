import { describe, expect, it } from 'vitest';

import { ConfigError } from '@docpensieve/shared';

import { buildAuthorTable, buildByline, readDate, resolvePageAuthors } from '../src/authors.js';

/** The description a version would carry, in its usual shape. */
const description = {
  ada: {
    name: 'Ada Lovelace',
    bio: 'Wrote the first algorithm meant for a machine.',
    avatar: 'authors/ada.png',
    url: 'https://example.com/ada',
  },
  grace: { name: 'Grace Hopper' },
};

describe('buildAuthorTable', () => {
  it('keeps every declared field, and only the declared ones', () => {
    const table = buildAuthorTable(description, { source: 'docs/v1.0/authors.json' });

    expect(table.get('ada')).toEqual({
      key: 'ada',
      name: 'Ada Lovelace',
      bio: 'Wrote the first algorithm meant for a machine.',
      avatar: 'authors/ada.png',
      url: 'https://example.com/ada',
    });
    // An author may be a name and nothing else: the rest is optional.
    expect(table.get('grace')).toEqual({ key: 'grace', name: 'Grace Hopper' });
  });

  it('refuses a description that is not an object', () => {
    for (const wrong of [['ada'], 'ada', null]) {
      let failure;
      try {
        buildAuthorTable(wrong, { source: 'docs/v1.0/authors.json' });
      } catch (error) {
        failure = /** @type {ConfigError} */ (error);
      }
      expect(failure).toBeInstanceOf(ConfigError);
      expect(failure?.message).toContain('docs/v1.0/authors.json');
      expect(failure?.hint).toContain('one entry per author');
    }
  });

  it('names the author whose entry is not an object', () => {
    let failure;
    try {
      buildAuthorTable({ ada: 'Ada Lovelace' }, { source: 'authors.json' });
    } catch (error) {
      failure = /** @type {ConfigError} */ (error);
    }
    expect(failure).toBeInstanceOf(ConfigError);
    expect(failure?.message).toContain('"ada"');
    expect(failure?.hint).toContain('name');
  });

  it('refuses an unknown field rather than ignoring it', () => {
    // A typo — "biography" for "bio" — would otherwise drop the text without
    // a word, and the page would come out silently poorer.
    let failure;
    try {
      buildAuthorTable({ ada: { name: 'Ada', biography: 'Hello' } }, { source: 'authors.json' });
    } catch (error) {
      failure = /** @type {ConfigError} */ (error);
    }
    expect(failure).toBeInstanceOf(ConfigError);
    expect(failure?.message).toContain('biography');
    expect(failure?.hint).toContain('bio');
  });

  it('demands a name, and text for the other fields', () => {
    expect(() => buildAuthorTable({ ada: {} }, { source: 'authors.json' })).toThrow(ConfigError);
    expect(() => buildAuthorTable({ ada: { name: '  ' } }, { source: 'authors.json' })).toThrow(
      ConfigError,
    );
    expect(() =>
      buildAuthorTable({ ada: { name: 'Ada', bio: 42 } }, { source: 'authors.json' }),
    ).toThrow(ConfigError);
  });

  it('trims what it keeps', () => {
    const table = buildAuthorTable(
      { ada: { name: '  Ada  ', bio: ' Hello ' } },
      { source: 'authors.json' },
    );
    expect(table.get('ada')).toEqual({ key: 'ada', name: 'Ada', bio: 'Hello' });
  });
});

describe('resolvePageAuthors', () => {
  const table = buildAuthorTable(description, { source: 'authors.json' });

  it('reads one name as well as a list', () => {
    expect(resolvePageAuthors('ada', table).map((a) => a.name)).toEqual(['Ada Lovelace']);
    expect(resolvePageAuthors(['ada', 'grace'], table).map((a) => a.name)).toEqual([
      'Ada Lovelace',
      'Grace Hopper',
    ]);
  });

  it('keeps the order the page gives', () => {
    expect(resolvePageAuthors(['grace', 'ada'], table).map((a) => a.key)).toEqual(['grace', 'ada']);
  });

  it('shows an undescribed key as it is written', () => {
    // It is what lets a project name its authors before describing them, and
    // what keeps pages written before the file working.
    expect(resolvePageAuthors(['Valentin Chevoleau'], table)).toEqual([
      { key: 'Valentin Chevoleau', name: 'Valentin Chevoleau' },
    ]);
    expect(resolvePageAuthors(['ada'])).toEqual([{ key: 'ada', name: 'ada' }]);
  });

  it('gives nothing when the page names nobody', () => {
    expect(resolvePageAuthors(undefined, table)).toEqual([]);
    expect(resolvePageAuthors([' ', ''], table)).toEqual([]);
  });
});

describe('readDate', () => {
  it('reads a quoted date as well as one YAML turned into a Date', () => {
    expect(readDate('2026-09-16', 'date', 'a page')).toEqual({
      iso: '2026-09-16',
      label: '16 September 2026',
    });
    expect(readDate(new Date('2026-01-02T00:00:00Z'), 'date', 'a page')).toEqual({
      iso: '2026-01-02',
      label: '2 January 2026',
    });
  });

  it('gives nothing for an absent date', () => {
    expect(readDate(undefined, 'date', 'a page')).toBeNull();
    expect(readDate('', 'date', 'a page')).toBeNull();
  });

  it('refuses a date it cannot read, rather than showing it broken', () => {
    let failure;
    try {
      readDate('last tuesday', 'modified', 'guide/install');
    } catch (error) {
      failure = /** @type {ConfigError} */ (error);
    }
    expect(failure).toBeInstanceOf(ConfigError);
    expect(failure?.message).toContain('guide/install');
    expect(failure?.hint).toContain('modified: 2026-09-16');
  });
});

describe('buildByline', () => {
  const table = buildAuthorTable(description, { source: 'authors.json' });

  it('gathers the authors and both dates', () => {
    const byline = buildByline(
      { authors: ['ada'], date: '2026-01-02', modified: '2026-03-04' },
      table,
      'guide/install',
    );

    expect(byline?.authors.map((a) => a.name)).toEqual(['Ada Lovelace']);
    expect(byline?.created?.iso).toBe('2026-01-02');
    expect(byline?.updated?.iso).toBe('2026-03-04');
  });

  it('drops an update made the day the page was written', () => {
    // Same day, same event: announcing both says nothing.
    const byline = buildByline({ date: '2026-01-02', modified: '2026-01-02' }, table, 'a page');
    expect(byline?.created?.iso).toBe('2026-01-02');
    expect(byline?.updated).toBeNull();
  });

  it('gives nothing at all for a page that says neither', () => {
    expect(buildByline({ title: 'Install' }, table, 'a page')).toBeNull();
  });

  it('stands on a date alone, or on an author alone', () => {
    expect(buildByline({ date: '2026-01-02' }, table, 'a page')?.authors).toEqual([]);
    expect(buildByline({ authors: 'grace' }, table, 'a page')?.created).toBeNull();
  });
});
