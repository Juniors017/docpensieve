/**
 * What a site offers the programs that read it: the sitemap for search
 * engines, `robots.txt` that points to it, and the RSS feed of dated pages.
 *
 * Pure functions: the generator gathers the published pages and writes the
 * files.
 *
 * @module @docpensieve/core/discovery
 */

import { toISODate } from './structured-data.js';

/**
 * A page as the site publishes it.
 *
 * @typedef {object} PublishedPage
 * @property {string} url Page URL, deployment prefix included
 *   (`/docs/versions/v1.0/guide/`).
 * @property {Record<string, any>} frontmatter Frontmatter of its source.
 */

/**
 * Escapes a value for an XML text or attribute.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Builds `sitemap.xml`.
 *
 * `lastmod` is the page's `modified` date, or failing that its `date`; a page
 * that carries neither is listed without one rather than with a made-up date.
 *
 * @param {PublishedPage[]} pages Pages of the versions to list.
 * @param {string} siteUrl Public address of the site: the sitemap only holds
 *   absolute addresses.
 * @returns {string}
 */
export function buildSitemap(pages, siteUrl) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const page of pages) {
    const modified = toISODate(page.frontmatter.modified) ?? toISODate(page.frontmatter.date);
    lines.push('  <url>', `    <loc>${escapeXml(new URL(page.url, siteUrl).href)}</loc>`);
    if (modified) lines.push(`    <lastmod>${modified}</lastmod>`);
    lines.push('  </url>');
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}

/**
 * Builds `robots.txt`, which lets every crawler in and names the sitemap.
 *
 * @param {string} sitemapUrl Absolute address of the sitemap.
 * @returns {string}
 */
export function buildRobots(sitemapUrl) {
  return ['User-agent: *', 'Allow: /', `Sitemap: ${sitemapUrl}`, ''].join('\n');
}

/**
 * Builds the RSS feed of the dated pages, newest first.
 *
 * Only a page with a `date` enters it: a documentation page without one is
 * reference material, not news, and dating it at build time would announce
 * every page again at every build.
 *
 * @param {PublishedPage[]} pages Pages of the current version.
 * @param {{
 *   projectName: string, siteUrl: string, homeUrl: string, feedUrl: string, lang?: string,
 * }} site `homeUrl` and `feedUrl` are absolute.
 * @returns {string}
 */
export function buildFeed(pages, site) {
  /** @type {{ page: PublishedPage, date: string }[]} */
  const dated = [];
  for (const page of pages) {
    const date = toISODate(page.frontmatter.date);
    if (date) dated.push({ page, date });
  }
  // ISO dates sort as strings; newest first, as a feed reader expects.
  dated.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  /** @param {string} iso */
  const rfc822 = (iso) => new Date(`${iso}T00:00:00Z`).toUTCString();

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(site.projectName)}</title>`,
    `    <link>${escapeXml(site.homeUrl)}</link>`,
    `    <description>${escapeXml(`Dated pages of ${site.projectName}`)}</description>`,
    `    <language>${escapeXml(site.lang ?? 'en')}</language>`,
    `    <atom:link href="${escapeXml(site.feedUrl)}" rel="self" type="application/rss+xml" />`,
  ];
  if (dated.length > 0) lines.push(`    <lastBuildDate>${rfc822(dated[0].date)}</lastBuildDate>`);

  for (const { page, date } of dated) {
    const link = new URL(page.url, site.siteUrl).href;
    lines.push(
      '    <item>',
      `      <title>${escapeXml(page.frontmatter.title ?? site.projectName)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `      <pubDate>${rfc822(date)}</pubDate>`,
    );
    if (page.frontmatter.description) {
      lines.push(`      <description>${escapeXml(page.frontmatter.description)}</description>`);
    }
    lines.push('    </item>');
  }

  lines.push('  </channel>', '</rss>', '');
  return lines.join('\n');
}
