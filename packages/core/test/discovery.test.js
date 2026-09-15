import { describe, expect, it } from 'vitest';

import { buildFeed, buildRobots, buildSitemap } from '../src/index.js';

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
