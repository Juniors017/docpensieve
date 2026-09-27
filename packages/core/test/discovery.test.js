import { describe, expect, it } from 'vitest';

import { buildFeed, buildLlms, buildRobots, buildSitemap, markdownCopy } from '../src/index.js';

/** A site served under a sub-path, as on GitHub Pages. */
const site = {
  projectName: 'My docs',
  siteUrl: 'https://example.com/docs',
  homeUrl: 'https://example.com/docs/versions/v1.0/',
  feedUrl: 'https://example.com/docs/feed.xml',
};

describe('buildSitemap', () => {
  it('lists every page with its absolute address', () => {
    const xml = buildSitemap(
      [
        { url: '/docs/versions/v1.0/', frontmatter: {} },
        { url: '/docs/versions/v1.0/guide/', frontmatter: {} },
      ],
      site.siteUrl,
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<loc>https://example.com/docs/versions/v1.0/</loc>');
    expect(xml).toContain('<loc>https://example.com/docs/versions/v1.0/guide/</loc>');
  });

  it('dates a page by its modification, else by its publication', () => {
    const xml = buildSitemap(
      [
        { url: '/a/', frontmatter: { date: '2026-01-02', modified: '2026-03-04' } },
        { url: '/b/', frontmatter: { date: '2026-01-02' } },
        { url: '/c/', frontmatter: {} },
      ],
      'https://example.com',
    );
    expect(xml).toContain('<lastmod>2026-03-04</lastmod>');
    expect(xml).toContain('<lastmod>2026-01-02</lastmod>');
    // No made-up date for the page that carries none.
    expect(xml.split('<lastmod>')).toHaveLength(3);
  });

  it('escapes what XML reserves', () => {
    const xml = buildSitemap([{ url: '/a/?x=1&y=2', frontmatter: {} }], 'https://example.com');
    expect(xml).toContain('x=1&amp;y=2');
  });
});

describe('buildRobots', () => {
  it('lets every crawler in and names the sitemap', () => {
    const text = buildRobots('https://example.com/sitemap.xml');
    expect(text).toContain('User-agent: *');
    expect(text).toContain('Sitemap: https://example.com/sitemap.xml');
  });
});

describe('buildFeed', () => {
  const pages = [
    { url: '/docs/versions/v1.0/', frontmatter: { title: 'Home' } },
    { url: '/docs/versions/v1.0/older/', frontmatter: { title: 'Older', date: '2025-05-01' } },
    {
      url: '/docs/versions/v1.0/news/',
      frontmatter: { title: 'News & notes', date: '2026-01-02', description: 'What changed.' },
    },
  ];

  it('holds the dated pages only, newest first', () => {
    const xml = buildFeed(pages, site);
    expect(xml).not.toContain('<title>Home</title>');
    expect(xml.indexOf('<title>News &amp; notes</title>')).toBeLessThan(
      xml.indexOf('<title>Older</title>'),
    );
    expect(xml).toContain('<pubDate>Fri, 02 Jan 2026 00:00:00 GMT</pubDate>');
    expect(xml).toContain('<description>What changed.</description>');
  });

  it('points to itself and to the site', () => {
    const xml = buildFeed(pages, site);
    expect(xml).toContain(
      '<atom:link href="https://example.com/docs/feed.xml" rel="self" type="application/rss+xml" />',
    );
    expect(xml).toContain('<link>https://example.com/docs/versions/v1.0/</link>');
    expect(xml).toContain(
      '<guid isPermaLink="true">https://example.com/docs/versions/v1.0/news/</guid>',
    );
  });

  it('stays a valid, empty feed when no page carries a date', () => {
    const xml = buildFeed([pages[0]], site);
    expect(xml).not.toContain('<item>');
    expect(xml).not.toContain('lastBuildDate');
    expect(xml).toContain('</channel>');
  });
});

describe('buildLlms', () => {
  const pages = [
    { url: '/versions/v1.0/', frontmatter: { title: 'Home', description: 'What it is.' } },
    { url: '/versions/v1.0/guide/', frontmatter: { title: 'The [guide]' } },
  ];

  it('opens on the project, summed up in one line', () => {
    const text = buildLlms(pages, { projectName: 'My docs', summary: 'Docs\n  for all.' });
    expect(text.startsWith('# My docs\n\n> Docs for all.\n\n## Pages\n\n')).toBe(true);
  });

  it('links each page to its Markdown copy, with its description', () => {
    const text = buildLlms(pages, { projectName: 'My docs' });
    expect(text).toContain('- [Home](/versions/v1.0/index.html.md): What it is.');
    // A bracket in a title would close the link early.
    expect(text).toContain('- [The guide](/versions/v1.0/guide/index.html.md)\n');
  });

  it('writes absolute links once the site has an address', () => {
    const text = buildLlms(pages, { projectName: 'My docs', base: 'https://example.com' });
    expect(text).toContain('(https://example.com/versions/v1.0/index.html.md)');
  });

  it('gives each language its section, the site language first', () => {
    const text = buildLlms(
      [
        { url: '/v/', frontmatter: { title: 'Home' }, lang: 'en' },
        { url: '/v/fr/', frontmatter: { title: 'Accueil' }, lang: 'fr' },
      ],
      { projectName: 'My docs' },
    );
    expect(text.indexOf('## English')).toBeLessThan(text.indexOf('## French'));
    expect(text.indexOf('## French')).toBeLessThan(text.indexOf('[Accueil]'));
    expect(text).not.toContain('## Pages');
  });

  it('names a page after the project when it has no title', () => {
    expect(buildLlms([{ url: '/', frontmatter: {} }], { projectName: 'Docs' })).toContain(
      '- [Docs](/index.html.md)',
    );
  });
});

describe('markdownCopy', () => {
  it('adds the title and the description the frontmatter held', () => {
    expect(markdownCopy({ title: 'Install', description: 'Two steps.' }, '\nRun it.\n\n')).toBe(
      '# Install\n\n> Two steps.\n\nRun it.\n',
    );
  });

  it('keeps the title the page opens on, the description under it', () => {
    expect(
      markdownCopy({ title: 'Install', description: 'Two steps.' }, '# Installing\n\nRun it.'),
    ).toBe('# Installing\n\n> Two steps.\n\nRun it.\n');
    expect(markdownCopy({ description: 'Nothing else.' }, '# Alone')).toBe(
      '# Alone\n\n> Nothing else.\n',
    );
  });

  it('keeps what the author wrote, components included', () => {
    expect(markdownCopy({}, '<Cards />')).toBe('<Cards />\n');
  });

  describe('its links', () => {
    /** @param {string} target */
    const resolve = (target) =>
      /^(?:[a-z]+:|#)/.test(target) ? null : `/v/${target.replace(/^[./]+/, '')}`;

    it('lead where the page leads', () => {
      const copy = markdownCopy(
        {},
        [
          '[Install](../guide/install/) and ![diagram](<./a b.png> "A title")',
          '[site]: /reference/',
          '<Card href="/guide/" /> <img src=\'./logo.png\' />',
        ].join('\n'),
        resolve,
      );
      expect(copy).toBe(
        [
          '[Install](/v/guide/install/) and ![diagram](</v/a b.png> "A title")',
          '[site]: /v/reference/',
          '<Card href="/v/guide/" /> <img src=\'/v/logo.png\' />',
          '',
        ].join('\n'),
      );
    });

    it('keep the addresses of other sites and the anchors', () => {
      const text = '[Home](https://example.com/) [Below](#below)';
      expect(markdownCopy({}, text, resolve)).toBe(`${text}\n`);
    });

    it('leave the code alone, where a link is an example', () => {
      const text = [
        'Write `[a](./b/)` for a link.',
        '````mdx',
        '```',
        '[inside](./fence/)',
        '```',
        '````',
        '~~~',
        '<Card href="./tilde/" />',
        '~~~',
        '[after](./after/)',
      ].join('\n');
      const copy = markdownCopy({}, text, resolve);

      expect(copy).toContain('`[a](./b/)`');
      expect(copy).toContain('[inside](./fence/)');
      expect(copy).toContain('<Card href="./tilde/" />');
      // The fence closed where it should: what follows is prose again.
      expect(copy).toContain('[after](/v/after/)');
    });
  });
});
