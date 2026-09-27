/**
 * What a site offers the programs that read it: the sitemap for search
 * engines, `robots.txt` that points to it, the RSS feed of dated pages, and
 * `llms.txt` with the Markdown copy of each page.
 *
 * Pure functions: the generator gathers the published pages and writes the
 * files.
 *
 * @module @docpensieve/core/discovery
 */

import { languageName } from '@docpensieve/shared';

import { toISODate } from './structured-data.js';

/**
 * A page as the site publishes it.
 *
 * @typedef {object} PublishedPage
 * @property {string} url Page URL, deployment prefix included
 *   (`/docs/versions/v1.0/guide/`).
 * @property {Record<string, any>} frontmatter Frontmatter of its source.
 * @property {string} [lang] Language the page is written in.
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

/** File a page's Markdown copy is written to, beside its HTML. */
export const MARKDOWN_COPY = 'index.html.md';

/**
 * Builds `llms.txt`: the index of a documentation, for a reader that is a
 * program.
 *
 * Follows the proposal as it stands: a title, a one-line summary, then a list
 * of links, each to the Markdown copy of a page — the address of the page with
 * `index.html.md` appended, since the pages are folders. A program reads that
 * copy as the author wrote it, instead of prying the text out of the markup.
 *
 * @param {PublishedPage[]} pages Pages of the version the site serves first.
 * @param {{ projectName: string, summary?: string, base?: string }} site
 *   `base` makes each link absolute when the site has a public address, and
 *   root-relative otherwise.
 * @returns {string}
 */
export function buildLlms(pages, site) {
  /** @param {string} value A line break or a bracket would break the list. */
  const line = (value) =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  const lines = [`# ${line(site.projectName)}`, ''];
  if (site.summary) lines.push(`> ${line(site.summary)}`, '');

  // One section per language, in the order the site builds them — its own
  // language first. A program reading for one language skips the others
  // without having to guess them from the addresses.
  /** @type {Map<string, PublishedPage[]>} */
  const byLanguage = new Map();
  for (const page of pages) {
    const lang = page.lang ?? '';
    byLanguage.set(lang, [...(byLanguage.get(lang) ?? []), page]);
  }

  for (const [lang, group] of byLanguage) {
    lines.push(`## ${byLanguage.size > 1 && lang ? languageName(lang) : 'Pages'}`, '');
    for (const page of group) {
      const title = line(page.frontmatter.title ?? site.projectName).replace(/[[\]]/g, '');
      const path = `${page.url}${MARKDOWN_COPY}`;
      const href = site.base ? new URL(path, site.base).href : path;
      const description = line(page.frontmatter.description ?? '');
      lines.push(`- [${title}](${href})${description ? `: ${description}` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Rewrites the targets of the links and media of a Markdown text, leaving its
 * code alone: a link shown in a code block is an example, not a link.
 *
 * Covers what a page writes a target with — `[text](target)`, an image, a
 * reference definition, and an `href` or `src` attribute of a tag.
 *
 * @param {string} text
 * @param {(target: string) => string | null} resolve The new target, or
 *   `null` to keep it.
 * @returns {string}
 */
function rewriteTargets(text, resolve) {
  /** @param {string} target */
  const swap = (target) => {
    const bracketed = target.startsWith('<') && target.endsWith('>');
    const next = resolve(bracketed ? target.slice(1, -1) : target);
    if (next === null) return target;
    return bracketed ? `<${next}>` : next;
  };

  /** @param {string} prose */
  const inProse = (prose) =>
    prose
      .replace(/(\]\(\s*)(<[^>\n]*>|[^\s)]+)/g, (_, head, target) => head + swap(target))
      .replace(
        /(\b(?:href|src)=)(["'])([^"'\n]*)\2/g,
        (_, head, quote, target) => `${head}${quote}${swap(target)}${quote}`,
      )
      .replace(
        /^(\s{0,3}\[[^\]\n]+\]:\s*)(<[^>\n]*>|\S+)/,
        (_, head, target) => head + swap(target),
      );

  // Split on the code spans of a line: the odd parts are code.
  /** @param {string} line */
  const outsideCode = (line) =>
    line
      .split(/(`+[^`]*`+)/)
      .map((part, index) => (index % 2 === 1 ? part : inProse(part)))
      .join('');

  let fence = '';
  return text
    .split('\n')
    .map((line) => {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (fence) {
        // Closed by a run of the same character, at least as long, alone on
        // its line.
        if (
          marker &&
          marker[0] === fence[0] &&
          marker.length >= fence.length &&
          !line.trim().replace(/[`~]/g, '')
        ) {
          fence = '';
        }
        return line;
      }
      if (marker) {
        fence = marker;
        return line;
      }
      return outsideCode(line);
    })
    .join('\n');
}

/**
 * The Markdown copy of a page: its source, as the author wrote it.
 *
 * The title is added when the page does not open on one, since a program
 * handed the copy alone has no frontmatter to read it from. What a component
 * draws at build time is not in the copy — a snippet's file, a grid of cards:
 * the copy says what was written, not what was rendered.
 *
 * The links are the exception. The build resolves them from the folder of the
 * source file, and a version-root one from the version: read from where the
 * copy is served, as written, they would lead nowhere. `resolve` gives each the
 * address the HTML page carries.
 *
 * @param {{ title?: string, description?: string }} frontmatter
 * @param {string} content Source of the page, frontmatter removed.
 * @param {(target: string) => string | null} [resolve] Address of a target
 *   on the site, or `null` to keep it as written.
 * @returns {string}
 */
export function markdownCopy(frontmatter, content, resolve = () => null) {
  let body = rewriteTargets(String(content ?? ''), resolve).trim();
  // The title the page opens on is kept, and the description goes under it
  // rather than above: a document reads title first.
  let title = frontmatter.title ? `# ${frontmatter.title}` : '';
  if (body.startsWith('# ')) {
    const end = body.indexOf('\n');
    title = end === -1 ? body : body.slice(0, end);
    body = end === -1 ? '' : body.slice(end).trim();
  }
  const description = frontmatter.description ? `> ${frontmatter.description}` : '';
  return [title, description, body].filter(Boolean).join('\n\n') + '\n';
}
