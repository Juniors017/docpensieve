import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { DEFAULT_THEME_CLASSES, GeneratorError, ThemeError } from '@docpensieve/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { Compiler, SiteGenerator, normalizeConfig } from '../src/index.js';

/** @type {string[]} */
const created = [];

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Sets up a throwaway project and returns its normalised config.
 *
 * @param {Record<string, string>} files Paths relative to `docs/v1.0`.
 * @param {Record<string, any>} [overrides] Configuration fields.
 * @returns {import('../src/config.js').DocPensieveConfig & { rootDir: string }}
 *   `rootDir` is always set here, while it is optional in the configuration:
 *   saying so saves checking it at every use.
 */
function project(files, overrides = {}) {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'docpensieve-gen-'));
  created.push(rootDir);

  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(rootDir, 'docs', 'v1.0', relative);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents, 'utf8');
  }

  const config = normalizeConfig({
    projectName: 'My docs',
    versions: [{ slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true }],
    ...overrides,
  });
  config.rootDir = rootDir;
  return /** @type {import('../src/config.js').DocPensieveConfig & { rootDir: string }} */ (config);
}

/**
 * Stub theme: `core` does not depend on `@docpensieve/theme` (ADR-002), it
 * only knows its `compile()` contract. That contract is what is tested here.
 */
const stubTheme = {
  // Aliases are synchronous and outside compile(): templates need them to be
  // rendered, whereas a utility provider needs the rendered pages to compile
  // its CSS.
  classes: { ...DEFAULT_THEME_CLASSES },
  compile: async () => ({
    css: ':root { --dp-bg: #ffffff; }',
    variables: { '--dp-bg': '#ffffff' },
  }),
};

/**
 * Generator without highlighting: Shiki brings nothing to these tests.
 * @param {import('../src/config.js').DocPensieveConfig} config
 */
const generatorFor = (config) =>
  new SiteGenerator(config, { compiler: new Compiler({ highlight: false }), theme: stubTheme });

/** @param {string} title @param {string} [body] */
const page = (title, body = 'Content.') => `---\ntitle: ${title}\n---\n\n${body}\n`;

/** @param {string} root @param {...string} parts */
const read = (root, ...parts) => readFileSync(path.join(root, ...parts), 'utf8');

describe('buildVersion', () => {
  it('writes one page per document, as folder/index.html', async () => {
    const config = project({
      'index.md': page('Home'),
      'guide/01-installation.md': page('Installation'),
    });
    const out = path.join(config.rootDir, 'out');

    const result = await generatorFor(config).buildVersion('v1.0', out);

    expect(result.pages).toBe(2);
    expect(existsSync(path.join(out, 'index.html'))).toBe(true);
    expect(existsSync(path.join(out, 'guide', 'installation', 'index.html'))).toBe(true);
  });

  it('produces a complete HTML document', async () => {
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('<title>Home · My docs</title>');
    expect(html).toContain('</html>');
  });

  it('does not repeat the project name in the title of a page named after it', async () => {
    // The home page usually carries the project name: "My docs · My docs"
    // told the reader nothing more.
    const config = project({ 'index.md': page('My docs'), 'guide.md': page('Guide') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).toContain('<title>My docs</title>');
    expect(read(out, 'guide', 'index.html')).toContain('<title>Guide · My docs</title>');
  });

  it('injects the compiled content', async () => {
    const config = project({ 'index.md': page('Home', '## Section\n\nSome text.') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).toContain('<h2 id="section">Section</h2>');
  });

  it('injects the sidebar with the current page marked', async () => {
    const config = project({
      'index.md': page('Home'),
      'guide/installation.md': page('Installation'),
    });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'guide', 'installation', 'index.html');
    expect(html).toContain('dp-nav-label">Guide<');
    expect(html).toContain('href="/versions/v1.0/guide/installation/" aria-current="page"');
  });

  it('injects the table of contents', async () => {
    const config = project({ 'index.md': page('Home', '## One\n\n## Two') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toContain('href="#one"');
    expect(html).toContain('href="#two"');
  });

  it('injects the JSON-LD into the head', async () => {
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toContain('<script type="application/ld+json">');
    expect(html.indexOf('application/ld+json')).toBeLessThan(html.indexOf('</head>'));
  });

  it('writes the stylesheet of the injected theme', async () => {
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'assets', 'docpensieve.css')).toContain('--dp-bg');
    expect(read(out, 'index.html')).toContain('href="/versions/v1.0/assets/docpensieve.css"');
  });

  it('refuses to generate without an injected theme', async () => {
    // An unstyled site would be noticed much later than an error here.
    const config = project({ 'index.md': page('Home') });
    const bare = new SiteGenerator(config, { compiler: new Compiler({ highlight: false }) });

    await expect(bare.buildVersion('v1.0', path.join(config.rootDir, 'out'))).rejects.toThrow(
      ThemeError,
    );
  });

  it('drops from the sidebar a root entry that repeats the brand', async () => {
    // "My docs" in the header and "My docs" as the first menu entry, an inch
    // apart, tells nothing: the brand already leads to that page.
    const config = project({ 'index.md': page('My docs'), 'guide.md': page('Guide') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toContain('>Guide</a>');
    // The menu is written twice — the column, and the folded menu of a narrow
    // screen — so the count is taken in the column alone.
    const column = html.slice(
      html.indexOf('<nav class="dp-sidebar"'),
      html.indexOf('</nav>', html.indexOf('<nav class="dp-sidebar"')),
    );
    expect(column.match(/dp-nav-link/g)).toHaveLength(1);
  });

  it('copies attachments while keeping the file tree', async () => {
    const config = project({
      'index.md': page('Home'),
      'guide/diagram.png': 'fake-png',
      'guide/notes.txt': 'text',
    });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    // The compiler rewrites "./diagram.png" assuming this layout.
    expect(read(out, 'guide', 'diagram.png')).toBe('fake-png');
    expect(read(out, 'guide', 'notes.txt')).toBe('text');
  });

  it('removes the ordering prefix from asset folders, as for pages', async () => {
    // The sorting prefix never shows in a page URL. If it stayed in the URL of
    // its images, every relative reference would miss — and nothing would say
    // so at build time.
    const config = project({
      '02-guide/index.md': page('Guide'),
      '02-guide/diagram.png': 'fake-png',
    });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'guide', 'diagram.png')).toBe('fake-png');
    expect(existsSync(path.join(out, '02-guide'))).toBe(false);
  });

  it('points a relative image to the file actually copied', async () => {
    // The rule end to end: the page is output one level below its source file,
    // the image stays next to the latter. Both must meet — which no test
    // checked.
    const config = project({
      'guide/installation.md': `${page('Installation')}

![](./diagram.png)
`,
      'guide/diagram.png': 'fake-png',
    });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'guide', 'installation', 'index.html');
    expect(html).toContain('src="/versions/v1.0/guide/diagram.png"');
    expect(read(out, 'guide', 'diagram.png')).toBe('fake-png');
  });

  it('does not copy the Markdown sources', async () => {
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(existsSync(path.join(out, 'index.md'))).toBe(false);
  });

  it('reports an unknown version', async () => {
    const config = project({ 'index.md': page('Home') });
    await expect(generatorFor(config).buildVersion('v9.9', 'out')).rejects.toThrow(
      /Unknown version/,
    );
  });
});

describe('URLs and baseUrl', () => {
  it('prefixes with /versions/<slug>/ by default', async () => {
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).toContain('href="/versions/v1.0/"');
  });

  it('applies a sub-path deployment baseUrl', async () => {
    const config = project({ 'index.md': page('Home') }, { baseUrl: '/docpensieve' });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toContain('href="/docpensieve/versions/v1.0/assets/docpensieve.css"');
  });

  it('writes a complete canonical when siteUrl is configured', async () => {
    const config = project(
      { 'guide/installation.md': page('Installation') },
      { siteUrl: 'https://example.com/docs' },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    // baseUrl is derived from the sub-path of siteUrl: otherwise the canonical
    // would silently lose "/docs".
    expect(read(out, 'guide', 'installation', 'index.html')).toContain(
      'rel="canonical" href="https://example.com/docs/versions/v1.0/guide/installation/"',
    );
  });

  it('omits the canonical without a siteUrl', async () => {
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).not.toContain('rel="canonical"');
  });

  it('counts the breadcrumb from the version root', async () => {
    const config = project(
      { 'guide/installation.md': page('Installation') },
      { siteUrl: 'https://example.com' },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'guide', 'installation', 'index.html');
    const block = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    if (block === null) throw new Error('No JSON-LD block in the page.');
    const json = block[1];
    const graph = JSON.parse(json.replaceAll('\\u003c', '<'));
    const crumbs = graph['@graph'].find(
      (/** @type {Record<string, any>} */ node) => node['@type'] === 'BreadcrumbList',
    );

    // "Versions" and "V1.0" are neither pages nor titles: they must not show
    // up as crumbs.
    expect(
      crumbs.itemListElement.map((/** @type {Record<string, any>} */ item) => item.name),
    ).toEqual(['Home', 'Guide', 'Installation']);
  });
});

describe('buildAll', () => {
  it('generates every version under versions/<slug>/', async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'docpensieve-multi-'));
    created.push(rootDir);
    for (const slug of ['v1.0', 'v0.9']) {
      const dir = path.join(rootDir, 'docs', slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'index.md'), page(`Home ${slug}`), 'utf8');
    }

    const config = normalizeConfig({
      projectName: 'My docs',
      outDir: 'dist',
      versions: [
        { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
        { slug: 'v0.9', name: '0.9', folder: 'docs/v0.9', archived: true },
      ],
    });
    config.rootDir = rootDir;

    const result = await generatorFor(config).buildAll();
    const out = path.join(rootDir, 'dist');

    expect(result).toMatchObject({ versions: 2, pages: 2 });
    expect(read(out, 'versions', 'v1.0', 'index.html')).toContain('Home v1.0');
    expect(read(out, 'versions', 'v0.9', 'index.html')).toContain('Home v0.9');
  });

  it('writes versions.json', async () => {
    const config = project({ 'index.md': page('Home') }, { outDir: 'dist' });
    await generatorFor(config).buildAll();

    const manifest = JSON.parse(read(path.join(config.rootDir, 'dist'), 'versions.json'));
    expect(manifest.versions).toEqual([
      {
        slug: 'v1.0',
        name: '1.0',
        url: '/versions/v1.0/',
        current: true,
        archived: false,
        prerelease: false,
      },
    ]);
  });

  it('writes a root that leads to the current version', async () => {
    const config = project({ 'index.md': page('Home') }, { outDir: 'dist' });
    await generatorFor(config).buildAll();

    const html = read(path.join(config.rootDir, 'dist'), 'index.html');
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('url=/versions/v1.0/');
    // An HTML redirect rather than a server rule: the output must stay
    // publishable on any static hosting.
    expect(html).toContain('<a href="/versions/v1.0/">');
  });

  it('lists every version in the switcher of every page', async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'docpensieve-sel-'));
    created.push(rootDir);
    for (const slug of ['v1.0', 'v0.9']) {
      const dir = path.join(rootDir, 'docs', slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'index.md'), page('Home'), 'utf8');
    }

    const config = normalizeConfig({
      projectName: 'My docs',
      outDir: 'dist',
      versions: [
        { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
        { slug: 'v0.9', name: '0.9', folder: 'docs/v0.9' },
      ],
    });
    config.rootDir = rootDir;
    await generatorFor(config).buildAll();

    const html = read(path.join(rootDir, 'dist'), 'versions', 'v0.9', 'index.html');
    expect(html).toContain('href="/versions/v1.0/"');
    expect(html).toContain('href="/versions/v0.9/" aria-current="true"');
  });
});

describe('search', () => {
  it('builds a search page, its index and its script, and links to it from every page', async () => {
    const config = project({
      'index.md': page('Home', 'Welcome.'),
      'guide/install.md': page('Install', 'Run the **installer** twice.'),
    });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).toContain(
      '<form class="dp-search" role="search" action="/versions/v1.0/search/">',
    );

    const search = read(out, 'search', 'index.html');
    expect(search).toContain('<li data-url="/versions/v1.0/guide/install/">');
    expect(search).toContain(
      '<script type="module" src="/versions/v1.0/assets/search.js"></script>',
    );
    expect(search).toContain('<meta name="robots" content="noindex, follow" />');
    expect(existsSync(path.join(out, 'assets', 'search.js'))).toBe(true);

    const index = JSON.parse(read(out, 'assets', 'search-index.json'));
    expect(index.find((/** @type {any} */ found) => found.title === 'Install')?.text).toContain(
      'Run the installer twice.',
    );
  });

  it('loads the search script on the search page only', async () => {
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);
    expect(read(out, 'index.html')).not.toContain('<script type="module"');
  });

  it('can be turned off', async () => {
    const config = project({ 'index.md': page('Home') }, { search: false });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).not.toContain('role="search"');
    expect(existsSync(path.join(out, 'search'))).toBe(false);
    expect(existsSync(path.join(out, 'assets', 'search-index.json'))).toBe(false);
  });

  it('refuses a page that would take the place of the search page', async () => {
    const config = project({ 'index.md': page('Home'), 'search.md': page('Search') });
    const out = path.join(config.rootDir, 'out');
    await expect(generatorFor(config).buildVersion('v1.0', out)).rejects.toThrow(
      'takes the place of the search page',
    );
  });
});

describe('sitemap, robots.txt and feed', () => {
  /** @param {string} title @param {string} date */
  const dated = (title, date) => `---
title: ${title}
date: ${date}
---

${title}.
`;

  /**
   * A site with three versions: in preparation, current and archived.
   * @param {Record<string, any>} overrides Configuration fields.
   */
  const site = (overrides) => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'docpensieve-disc-'));
    created.push(rootDir);
    const files = {
      'v2.0/index.md': page('Next'),
      'v1.0/index.md': page('Home'),
      'v1.0/news.md': dated('News', '2026-01-02'),
      'v1.0/older.md': dated('Older', '2025-05-01'),
      'v0.9/index.md': page('Old'),
    };
    for (const [relative, contents] of Object.entries(files)) {
      const full = path.join(rootDir, 'docs', ...relative.split('/'));
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, contents, 'utf8');
    }
    const config = normalizeConfig({
      projectName: 'My docs',
      outDir: 'dist',
      versions: [
        { slug: 'v2.0', name: '2.0', folder: 'docs/v2.0', prerelease: true },
        { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
        { slug: 'v0.9', name: '0.9', folder: 'docs/v0.9', archived: true },
      ],
      ...overrides,
    });
    config.rootDir = rootDir;
    return { config, out: path.join(rootDir, 'dist') };
  };

  it('lists the published versions, not the one in preparation', async () => {
    const { config, out } = site({ siteUrl: 'https://example.com' });
    await generatorFor(config).buildAll();

    const sitemap = read(out, 'sitemap.xml');
    expect(sitemap).toContain('<loc>https://example.com/versions/v1.0/news/</loc>');
    expect(sitemap).toContain('<lastmod>2026-01-02</lastmod>');
    expect(sitemap).toContain('<loc>https://example.com/versions/v0.9/</loc>');
    // Its pages carry noindex: listing them would contradict it.
    expect(sitemap).not.toContain('/versions/v2.0/');
    expect(read(out, 'robots.txt')).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  it('writes no robots.txt under a sub-path, where no crawler reads it', async () => {
    const { config, out } = site({ siteUrl: 'https://example.com/docs' });
    await generatorFor(config).buildAll();

    expect(read(out, 'sitemap.xml')).toContain(
      '<loc>https://example.com/docs/versions/v1.0/</loc>',
    );
    expect(existsSync(path.join(out, 'robots.txt'))).toBe(false);
  });

  it('waits for siteUrl, and can be turned off', async () => {
    for (const overrides of [{}, { siteUrl: 'https://example.com', sitemap: false }]) {
      const { config, out } = site(overrides);
      await generatorFor(config).buildAll();
      expect(existsSync(path.join(out, 'sitemap.xml')), JSON.stringify(overrides)).toBe(false);
    }
  });

  it('writes the feed of dated pages when asked, and every page announces it', async () => {
    const { config, out } = site({ siteUrl: 'https://example.com', feed: true });
    await generatorFor(config).buildAll();

    const feed = read(out, 'feed.xml');
    expect(feed.indexOf('<title>News</title>')).toBeLessThan(feed.indexOf('<title>Older</title>'));
    expect(feed).not.toContain('<title>Home</title>');
    expect(read(out, 'versions', 'v1.0', 'index.html')).toContain(
      '<link rel="alternate" type="application/rss+xml" title="My docs" href="https://example.com/feed.xml" />',
    );
  });

  it('writes no feed by default', async () => {
    const { config, out } = site({ siteUrl: 'https://example.com' });
    await generatorFor(config).buildAll();

    expect(existsSync(path.join(out, 'feed.xml'))).toBe(false);
    expect(read(out, 'versions', 'v1.0', 'index.html')).not.toContain('application/rss+xml');
  });
});

describe('errors', () => {
  it('reports an output folder it cannot empty or write', async () => {
    const config = project({ 'index.md': page('Home') });
    // A file where the generator wants a folder: emptying it fails, and the
    // failure must come out as an error of the build, not as a raw system one.
    const obstacle = path.join(config.rootDir, 'obstacle');
    writeFileSync(obstacle, 'obstacle', 'utf8');

    await expect(
      generatorFor(config).buildVersion('v1.0', path.join(obstacle, 'out')),
    ).rejects.toThrow(GeneratorError);
  });
});

describe('versions that are not the current one', () => {
  /**
   * Sets up two versions: the current one, and another one to qualify.
   *
   * @param {Record<string, any>} other Fields of the second version.
   * @returns {import('../src/config.js').DocPensieveConfig & { rootDir: string }}
   */
  function twoVersions(other) {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'docpensieve-notice-'));
    created.push(rootDir);

    for (const slug of ['v1.0', 'v2.0']) {
      const dir = path.join(rootDir, 'docs', slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'index.md'), page(`Home ${slug}`), 'utf8');
    }

    const config = normalizeConfig({
      projectName: 'My docs',
      outDir: 'dist',
      versions: [
        { slug: 'v2.0', name: '2.0', folder: 'docs/v2.0', ...other },
        { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
      ],
    });
    config.rootDir = rootDir;
    return /** @type {import('../src/config.js').DocPensieveConfig & { rootDir: string }} */ (
      config
    );
  }

  it('warns on every page of a version in preparation', async () => {
    // It looks exactly like the current one: without a word, nothing tells
    // them apart for someone arriving from a search engine.
    const config = twoVersions({ prerelease: true });
    await generatorFor(config).buildAll();

    const html = read(path.join(config.rootDir, 'dist'), 'versions', 'v2.0', 'index.html');
    expect(html).toContain('in preparation');
    expect(html).toContain('href="/versions/v1.0/"');
    expect(html).toContain('1.0');
  });

  it('keeps it out of search indexes', async () => {
    // Same content at two addresses: otherwise the wrong one comes up.
    const config = twoVersions({ prerelease: true });
    await generatorFor(config).buildAll();

    const html = read(path.join(config.rootDir, 'dist'), 'versions', 'v2.0', 'index.html');
    expect(html).toContain('name="robots" content="noindex, follow"');
  });

  it('warns differently on an archived version, which stays indexed', async () => {
    // A past version still matters to those who use it: it is flagged without
    // being removed from searches.
    const config = twoVersions({ archived: true });
    await generatorFor(config).buildAll();

    const html = read(path.join(config.rootDir, 'dist'), 'versions', 'v2.0', 'index.html');
    expect(html).toContain('no longer maintained');
    expect(html).not.toContain('noindex');
  });

  it('does not warn on the current version', async () => {
    const config = twoVersions({ prerelease: true });
    await generatorFor(config).buildAll();

    const html = read(path.join(config.rootDir, 'dist'), 'versions', 'v1.0', 'index.html');
    expect(html).not.toContain('dp-notice');
    expect(html).not.toContain('noindex');
  });

  it('publishes the status of every version in the manifest', async () => {
    const config = twoVersions({ prerelease: true });
    await generatorFor(config).buildAll();

    const manifest = JSON.parse(read(path.join(config.rootDir, 'dist'), 'versions.json'));
    expect(manifest.versions[0]).toMatchObject({ slug: 'v2.0', prerelease: true, current: false });
    expect(manifest.versions[1]).toMatchObject({ slug: 'v1.0', prerelease: false, current: true });
  });
});

describe('layout', () => {
  it('refuses an unknown layout and names the file', async () => {
    // A typo would otherwise render the page in a layout other than the
    // intended one, without a word.
    const config = project({ 'index.md': '---\ntitle: X\nlayout: hoem\n---\n\n# X\n' });
    const out = path.join(config.rootDir, 'out');

    await expect(generatorFor(config).buildVersion('v1.0', out)).rejects.toThrow(/Unknown layout/);
  });

  it('accepts both known layouts', async () => {
    for (const layout of ['doc', 'home']) {
      const config = project({
        'index.md': `---
title: X
layout: ${layout}
---

# X
`,
      });
      const out = path.join(config.rootDir, 'out');
      await expect(generatorFor(config).buildVersion('v1.0', out)).resolves.toBeTruthy();
    }
  });
});

describe('project images', () => {
  /** @param {string} rootDir */
  const drawImages = (rootDir) => {
    mkdirSync(path.join(rootDir, 'brand'));
    writeFileSync(path.join(rootDir, 'brand', 'logo.svg'), '<svg/>', 'utf8');
    writeFileSync(path.join(rootDir, 'brand', 'icon.png'), 'png', 'utf8');
    writeFileSync(path.join(rootDir, 'brand', 'social.jpg'), 'jpg', 'utf8');
  };

  /**
   * The graph of structured data a page carries.
   * @param {string} html
   * @returns {Record<string, any>[]}
   */
  const graphOf = (html) => {
    const opening = html.indexOf('>', html.indexOf('application/ld+json')) + 1;
    return JSON.parse(html.slice(opening, html.indexOf('</script>', opening)))['@graph'];
  };

  it('copies them into the version and shows each one in its place', async () => {
    const config = project(
      { 'index.md': page('Home', 'Content.') },
      {
        siteUrl: 'https://example.com/docs',
        logo: 'brand/logo.svg',
        favicon: 'brand/icon.png',
        socialImage: 'brand/social.jpg',
      },
    );
    drawImages(config.rootDir);
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    for (const name of ['logo.svg', 'favicon.png', 'social-image.jpg']) {
      expect(existsSync(path.join(out, 'assets', name)), name).toBe(true);
    }

    const html = read(out, 'index.html');
    const assets = '/docs/versions/v1.0/assets';
    expect(html).toContain(`<img class="dp-brand-logo" src="${assets}/logo.svg" alt="" />`);
    expect(html).toContain(`<link rel="icon" href="${assets}/favicon.png" type="image/png" />`);
    // Social networks only read an absolute address.
    expect(html).toContain(
      `<meta property="og:image" content="https://example.com${assets}/social-image.jpg" />`,
    );
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');

    const organization = graphOf(html).find((node) => node['@type'] === 'Organization');
    expect(organization?.logo).toBe(`https://example.com${assets}/logo.svg`);
  });

  it('shows none of them when none is declared', async () => {
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).not.toContain('dp-brand-logo');
    expect(html).not.toContain('rel="icon"');
    expect(html).not.toContain('og:image');
    expect(graphOf(html).find((node) => node['@type'] === 'Organization')).not.toHaveProperty(
      'logo',
    );
  });

  it('names the field of an image that does not exist', async () => {
    // Silently skipped, a misspelt path would leave the header without its
    // logo, and nobody would know why.
    const config = project({ 'index.md': page('Home') }, { logo: 'brand/missing.png' });
    const out = path.join(config.rootDir, 'out');
    const build = generatorFor(config).buildVersion('v1.0', out);

    await expect(build).rejects.toThrow(GeneratorError);
    await expect(generatorFor(config).buildVersion('v1.0', out)).rejects.toThrow(
      /logo image does not exist: "brand\/missing.png"/,
    );
  });
});

describe('a sidebar described by a file', () => {
  /** @param {string} html @returns {string} The navigation part of a page. */
  const navOf = (html) => {
    // The closing tag after the sidebar's own: the header holds navs too, and
    // the first closing tag of the page is no longer this one.
    const start = html.indexOf('<nav class="dp-sidebar"');
    return html.slice(start, html.indexOf('</nav>', start));
  };

  it('follows the file, and does not publish it', async () => {
    const config = project(
      {
        'index.md': page('Home'),
        'a.md': page('A'),
        'b.md': page('B'),
        'sidebar.json': JSON.stringify(['b', { label: 'Site', href: 'https://example.com' }]),
      },
      { sidebar: 'sidebar.json' },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const nav = navOf(read(out, 'b', 'index.html'));
    expect(nav).toContain('href="/versions/v1.0/b/" aria-current="page">B</a>');
    expect(nav.indexOf('>B<')).toBeLessThan(nav.indexOf('>Site<'));
    // Left out of the description, the page is published but off the menu.
    expect(nav).not.toContain('/versions/v1.0/a/');
    expect(existsSync(path.join(out, 'a', 'index.html'))).toBe(true);
    expect(existsSync(path.join(out, 'sidebar.json'))).toBe(false);
  });

  it('keeps the menu of the folders in a version without a description', async () => {
    // The field names a file where a version has one: describing the menu of
    // a new version must not force a file into every older one (ADR-017).
    const config = project(
      { 'index.md': page('Home'), 'a.md': page('A') },
      { sidebar: 'sidebar.json' },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(navOf(read(out, 'a', 'index.html'))).toContain('/versions/v1.0/a/');
  });

  it('still reports a description it cannot read', async () => {
    // Only an absent file is optional: a folder in its place is a mistake.
    const config = project({ 'index.md': page('Home') }, { sidebar: 'sidebar.json' });
    mkdirSync(path.join(config.rootDir, 'docs', 'v1.0', 'sidebar.json'));
    const out = path.join(config.rootDir, 'out');
    await expect(generatorFor(config).buildVersion('v1.0', out)).rejects.toThrow(
      'Could not read the sidebar description at docs/v1.0/sidebar.json',
    );
  });

  it('reports a description that is not JSON', async () => {
    const config = project(
      { 'index.md': page('Home'), 'sidebar.json': '[ "index", ]' },
      { sidebar: 'sidebar.json' },
    );
    const out = path.join(config.rootDir, 'out');
    await expect(generatorFor(config).buildVersion('v1.0', out)).rejects.toThrow(
      'docs/v1.0/sidebar.json is not valid JSON',
    );
  });
});

describe('colour scheme and version images', () => {
  it('sets a fixed scheme on <html>', async () => {
    const config = project(
      { 'index.md': page('Home') },
      { theme: { framework: 'custom', darkMode: 'dark' } },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);
    expect(read(out, 'index.html')).toContain('<html lang="en" class="dark">');
  });

  it('leaves <html> without a class when the scheme follows the system', async () => {
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);
    expect(read(out, 'index.html')).toContain('<html lang="en">');
  });

  it("puts a version's own logo in place of the project's", async () => {
    const config = project(
      { 'index.md': page('Home') },
      {
        logo: 'brand/logo.svg',
        versions: [
          { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true, logo: 'brand/beta.svg' },
        ],
      },
    );
    mkdirSync(path.join(config.rootDir, 'brand'));
    writeFileSync(path.join(config.rootDir, 'brand', 'logo.svg'), '<svg id="project"/>', 'utf8');
    writeFileSync(path.join(config.rootDir, 'brand', 'beta.svg'), '<svg id="beta"/>', 'utf8');
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).toContain('src="/versions/v1.0/assets/logo.svg"');
    expect(read(out, 'assets', 'logo.svg')).toBe('<svg id="beta"/>');
  });
});

describe('the output folder', () => {
  it('drops a page removed from the sources', async () => {
    const config = project({ 'index.md': page('Home'), 'old.md': page('Old') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);
    expect(existsSync(path.join(out, 'old', 'index.html'))).toBe(true);

    rmSync(path.join(config.rootDir, 'docs', 'v1.0', 'old.md'));
    await generatorFor(config).buildVersion('v1.0', out);
    // Left behind, it would have been published with the rest.
    expect(existsSync(path.join(out, 'old'))).toBe(false);
  });

  it('keeps what it does not write, and drops what is no longer declared', async () => {
    const config = project(
      { 'index.md': page('Home') },
      { outDir: 'dist', siteUrl: 'https://example.com', feed: true },
    );
    const dist = path.join(config.rootDir, 'dist');
    mkdirSync(path.join(dist, 'versions', 'v0.9'), { recursive: true });
    writeFileSync(path.join(dist, 'versions', 'v0.9', 'index.html'), 'old', 'utf8');
    writeFileSync(path.join(dist, 'CNAME'), 'docs.example.com', 'utf8');
    await generatorFor(config).buildAll();

    expect(existsSync(path.join(dist, 'versions', 'v0.9'))).toBe(false);
    expect(read(dist, 'CNAME')).toBe('docs.example.com');
    expect(existsSync(path.join(dist, 'feed.xml'))).toBe(true);

    // A feed turned off since the last build does not linger.
    const off = normalizeConfig({ ...config, feed: false });
    off.rootDir = config.rootDir;
    await generatorFor(off).buildAll();
    expect(existsSync(path.join(dist, 'feed.xml'))).toBe(false);
  });

  it('refuses, before deleting anything, an output folder that holds the project or its pages', async () => {
    for (const outDir of ['.', '..', 'docs', 'docs/v1.0/out']) {
      const config = project({ 'index.md': page('Home') }, { outDir });
      await expect(generatorFor(config).buildAll(), outDir).rejects.toThrow(GeneratorError);
      expect(existsSync(path.join(config.rootDir, 'docs', 'v1.0', 'index.md')), outDir).toBe(true);
    }
  });

  it('accepts an output folder outside the project', async () => {
    const elsewhere = mkdtempSync(path.join(tmpdir(), 'docpensieve-out-'));
    created.push(elsewhere);
    const config = project({ 'index.md': page('Home') }, { outDir: elsewhere });
    await generatorFor(config).buildAll();
    expect(existsSync(path.join(elsewhere, 'versions', 'v1.0', 'index.html'))).toBe(true);
  });
});

describe('the light / dark switch', () => {
  it('adds a button and its few lines of script when asked, and they parse', async () => {
    const config = project(
      { 'index.md': page('Home') },
      { theme: { framework: 'custom', darkMode: 'dark', toggle: true } },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    // Hidden until its script runs: without JavaScript, it would do nothing.
    expect(html).toContain('data-scheme-toggle hidden');
    const scripts = html
      .split('<script>')
      .slice(1)
      .map((part) => part.slice(0, part.indexOf('</script>')));
    expect(scripts).toHaveLength(2);
    for (const code of scripts) expect(() => new Function(code)).not.toThrow();
  });

  it('leaves the pages without any script once turned off', async () => {
    const config = project(
      { 'index.md': page('Home') },
      { theme: { framework: 'custom', toggle: false } },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);
    const html = read(out, 'index.html');
    expect(html).not.toContain('data-scheme-toggle');
    // The structured data stay: they are read, not run.
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('type="module"');
  });
});

describe('page furniture', () => {
  it('puts the back-to-top link on every page', async () => {
    // It is furniture, not content: writing it in every file would mean
    // repeating it everywhere, and forgetting it somewhere.
    const config = project({ 'index.md': page('Home'), 'guide/a.md': page('A') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    for (const html of [read(out, 'index.html'), read(out, 'guide', 'a', 'index.html')]) {
      expect(html).toContain('dp-scroll-top');
      expect(html).toContain('href="#top"');
    }
  });

  it('can do without it', async () => {
    const config = project({ 'index.md': page('Home') }, { scrollToTop: false });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).not.toContain('dp-scroll-top');
  });
});

describe('assets and collisions', () => {
  /** @param {import('../src/config.js').DocPensieveConfig & { rootDir: string }} config */
  const build = (config) =>
    generatorFor(config).buildVersion('v1.0', path.join(config.rootDir, 'out'));

  it('points a relative image of a prefixed folder to the copied file', async () => {
    // "02-guide" is output under "guide": the base of relative targets must
    // follow, otherwise the image is copied on one side and targeted on the other.
    const config = project({
      'index.md': page('Home'),
      '02-guide/page.md': page('Page', '![diagram](./diagram.png)'),
      '02-guide/diagram.png': 'fake-png',
    });
    await build(config);

    const out = path.join(config.rootDir, 'out');
    expect(read(out, 'guide', 'page', 'index.html')).toContain(
      'src="/versions/v1.0/guide/diagram.png"',
    );
    expect(read(out, 'guide', 'diagram.png')).toBe('fake-png');
  });

  it('refuses an asset that would overwrite a page', async () => {
    // Copied after the pages, assets won: the page was lost.
    const config = project({ 'guide/index.md': page('Guide'), 'guide/index.html': '<p>raw</p>' });
    await expect(build(config)).rejects.toThrow(GeneratorError);
  });

  it('refuses two assets that would land in the same place', async () => {
    const config = project({
      'index.md': page('Home'),
      '01-guide/diagram.png': 'a',
      'guide/diagram.png': 'b',
    });
    await expect(build(config)).rejects.toThrow(/same place/);
  });

  it('refuses an asset in place of the theme stylesheet', async () => {
    const config = project({ 'index.md': page('Home'), 'assets/docpensieve.css': 'body{}' });
    await expect(build(config)).rejects.toThrow(/theme stylesheet/);
  });

  it('refuses to follow a linked folder', async () => {
    // Copied blindly, it crashed the copy with a raw error.
    const config = project({ 'index.md': page('Home') });
    const elsewhere = mkdtempSync(path.join(tmpdir(), 'docpensieve-linked-'));
    created.push(elsewhere);
    writeFileSync(path.join(elsewhere, 'x.png'), 'x');
    symlinkSync(elsewhere, path.join(config.rootDir, 'docs', 'v1.0', 'link'), 'junction');
    await expect(build(config)).rejects.toThrow(/Symbolic link/);
  });
});

describe('inputs the engine refuses or straightens', () => {
  /** @param {import('../src/config.js').DocPensieveConfig & { rootDir: string }} config */
  const build = (config) =>
    generatorFor(config).buildVersion('v1.0', path.join(config.rootDir, 'out'));

  /** @param {import('../src/config.js').DocPensieveConfig & { rootDir: string }} config @param {...string} parts */
  const readOut = (config, ...parts) => read(path.join(config.rootDir, 'out'), ...parts);

  /** @param {string} html */
  const graphOf = (html) => {
    const marker = 'application/ld+json">';
    const start = html.indexOf(marker) + marker.length;
    return JSON.parse(html.slice(start, html.indexOf('</script>', start)));
  };

  it('refuses a frontmatter that is not a map of fields', async () => {
    // Accepted, it made every field of the page ignored without a word.
    const string = project({
      'index.md': `---
just a string
---

# X
`,
    });
    await expect(build(string)).rejects.toThrow(/map of fields/);

    const list = project({
      'index.md': `---
- one
- two
---

# X
`,
    });
    await expect(build(list)).rejects.toThrow(/map of fields/);
  });

  it('refuses a title that is not text', async () => {
    // A list came out as "one,two" in <title>, an object as "[object Object]".
    const config = project({
      'index.md': `---
title: [one, two]
---
`,
    });
    await expect(build(config)).rejects.toThrow(/Invalid title/);
  });

  it('reads a numeric title as text', async () => {
    const config = project({
      'index.md': `---
title: 2024
---
`,
    });
    await build(config);
    expect(readOut(config, 'index.html')).toContain('<title>2024 · My docs</title>');
  });

  it('treats an empty title as missing', async () => {
    const config = project({
      'index.md': `---
title: ''
---
`,
    });
    await build(config);
    expect(readOut(config, 'index.html')).not.toContain('<title> ·');
  });

  it('refuses a file name that yields no URL', async () => {
    // Without a Latin letter, the slug was empty: the page took the home URL.
    const config = project({ 'index.md': page('Home'), '日本語.md': page('Japanese') });
    await expect(build(config)).rejects.toThrow(/yields no URL/);
  });

  it('refuses a folder whose name yields no URL', async () => {
    const config = project({ 'index.md': page('Home'), '日本/page.md': page('Page') });
    await expect(build(config)).rejects.toThrow(/yields no URL/);
  });

  it('keeps their own titles for two folders sharing a name', async () => {
    // Keyed by their last segment, "api/advanced" and "guide/advanced"
    // swapped their titles in the breadcrumb.
    const config = project({
      'index.md': page('Home'),
      'api/advanced/index.md': page('Advanced API'),
      'guide/advanced/index.md': page('Advanced guide'),
      'guide/advanced/x.md': page('X'),
    });
    await build(config);

    const built = graphOf(readOut(config, 'guide', 'advanced', 'x', 'index.html'));
    const trail = built['@graph'].find(
      (/** @type {Record<string, any>} */ n) => n['@type'] === 'BreadcrumbList',
    );
    const names = trail.itemListElement.map((/** @type {Record<string, any>} */ i) => i.name);
    expect(names).toContain('Advanced guide');
    expect(names).not.toContain('Advanced API');
  });

  it('resolves a relative preview from the page folder', async () => {
    // Resolved against the site root, it pointed to an image that does not exist.
    const config = project(
      {
        'index.md': page('Home'),
        'guide/a.md': `---
title: A
preview: ./thumb.png
---
`,
      },
      { siteUrl: 'https://example.com' },
    );
    await build(config);

    const built = graphOf(readOut(config, 'guide', 'a', 'index.html'));
    const article = built['@graph'].find((/** @type {Record<string, any>} */ n) => n.image);
    expect(article.image).toBe('https://example.com/versions/v1.0/guide/thumb.png');
  });

  it('refuses a version without a published page', async () => {
    // It still published a redirect to itself, which led nowhere.
    const config = project({
      'index.md': `---
title: A
draft: true
---
`,
    });
    await expect(build(config)).rejects.toThrow(/no page to publish/);
  });
});

describe('the byline of a page', () => {
  /** The first bytes of a PNG: signature, then the IHDR chunk. */
  const pngHeader = (/** @type {number} */ width, /** @type {number} */ height) => {
    const bytes = Buffer.alloc(24);
    bytes.writeUInt32BE(0x89504e47, 0);
    bytes.writeUInt32BE(0x0d0a1a0a, 4);
    bytes.writeUInt32BE(13, 8);
    bytes.write('IHDR', 12, 'ascii');
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);
    return bytes;
  };

  /** @param {string} title @param {string} frontmatter */
  const authored = (title, frontmatter) =>
    `---\ntitle: ${title}\n${frontmatter}\n---\n\nContent.\n`;

  it('shows the names and the dates the page gives, without any file', async () => {
    const config = project({
      'index.md': authored('Install', 'authors: [Ada Lovelace]\ndate: 2026-01-02'),
    });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toContain('dp-byline');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('<time datetime="2026-01-02">2 January 2026</time>');
    expect(html).toContain('Written');
  });

  it('adds the biography, the link and the avatar the version describes', async () => {
    const config = project(
      {
        'index.md': authored('Install', 'authors: [ada]\ndate: 2026-01-02\nmodified: 2026-03-04'),
        'authors.json': JSON.stringify({
          ada: {
            name: 'Ada Lovelace',
            bio: 'Wrote the first algorithm meant for a machine.',
            avatar: 'authors/ada.png',
            url: 'https://example.com/ada',
          },
        }),
      },
      { authors: 'authors.json' },
    );
    mkdirSync(path.join(config.rootDir, 'docs', 'v1.0', 'authors'), { recursive: true });
    writeFileSync(
      path.join(config.rootDir, 'docs', 'v1.0', 'authors', 'ada.png'),
      pngHeader(64, 64),
    );

    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);
    const html = read(out, 'index.html');

    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Wrote the first algorithm meant for a machine.');
    expect(html).toContain('href="https://example.com/ada"');
    // Measured at the build, so that the text does not jump when it arrives.
    expect(html).toContain('width="64"');
    expect(html).toContain('height="64"');
    expect(html).toContain('Updated');

    // The description feeds the pages; it is not a page.
    expect(existsSync(path.join(out, 'authors.json'))).toBe(false);
    // The avatar, itself, travels with the version.
    expect(existsSync(path.join(out, 'authors', 'ada.png'))).toBe(true);
  });

  it('points an avatar where it is published, its folder prefix dropped', async () => {
    // A folder ordered by a prefix is served without it, like a page: the
    // avatar URL must follow, or it names a file that is never written.
    const config = project(
      {
        'index.md': authored('Install', 'authors: [ada]'),
        'authors.json': JSON.stringify({ ada: { name: 'Ada', avatar: '02-team/ada.png' } }),
      },
      { authors: 'authors.json' },
    );
    mkdirSync(path.join(config.rootDir, 'docs', 'v1.0', '02-team'), { recursive: true });
    writeFileSync(path.join(config.rootDir, 'docs', 'v1.0', '02-team', 'ada.png'), pngHeader(8, 8));

    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).toContain('src="/versions/v1.0/team/ada.png"');
    expect(existsSync(path.join(out, 'team', 'ada.png'))).toBe(true);
  });

  it('enriches the structured data with the same description', async () => {
    // The page and its metadata must not disagree about an author.
    const config = project(
      {
        'index.md': authored('Install', 'authors: [ada]'),
        'authors.json': JSON.stringify({
          ada: { name: 'Ada Lovelace', bio: 'A biography.', url: 'https://example.com/ada' },
        }),
      },
      { authors: 'authors.json' },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toContain('"description":"A biography."');
    expect(html).toContain('"url":"https://example.com/ada"');
  });

  it('shows a key nobody describes as it is written', async () => {
    const config = project(
      {
        'index.md': authored('Install', 'authors: [Grace Hopper]'),
        'authors.json': JSON.stringify({ ada: { name: 'Ada Lovelace' } }),
      },
      { authors: 'authors.json' },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).toContain('Grace Hopper');
  });

  it('adds nothing to a page that says neither author nor date', async () => {
    const config = project({ 'index.md': page('Install') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).not.toContain('dp-byline');
  });

  it('adds nothing to a home page, whatever it declares', async () => {
    // A byline under an entrance hall designates nothing.
    const config = project({
      'index.md': authored('Home', 'layout: home\nauthors: [Ada Lovelace]\ndate: 2026-01-02'),
    });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).not.toContain('dp-byline');
  });

  it('shows the names alone in a version without a description', async () => {
    // Describing the authors of a new version must not force a file into
    // every older one (ADR-017).
    const config = project(
      { 'index.md': authored('Install', 'authors: [Ada Lovelace]') },
      { authors: 'authors.json' },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).toContain('Ada Lovelace');
  });

  it('still reports a description it cannot read', async () => {
    // Only an absent file is optional: a folder in its place is a mistake.
    const config = project({ 'index.md': page('Install') }, { authors: 'authors.json' });
    mkdirSync(path.join(config.rootDir, 'docs', 'v1.0', 'authors.json'));
    const out = path.join(config.rootDir, 'out');

    let failure;
    try {
      await generatorFor(config).buildVersion('v1.0', out);
    } catch (error) {
      failure = /** @type {import('@docpensieve/shared').DocPensieveError} */ (error);
    }
    expect(failure?.message).toContain('Could not read the author description');
    expect(failure?.message).toContain('docs/v1.0/authors.json');
    expect(failure?.hint).toContain('file');
  });

  it('reports an avatar it cannot find, rather than a broken image', async () => {
    const config = project(
      {
        'index.md': authored('Install', 'authors: [ada]'),
        'authors.json': JSON.stringify({ ada: { name: 'Ada', avatar: 'authors/gone.png' } }),
      },
      { authors: 'authors.json' },
    );
    const out = path.join(config.rootDir, 'out');

    let failure;
    try {
      await generatorFor(config).buildVersion('v1.0', out);
    } catch (error) {
      failure = /** @type {import('@docpensieve/shared').DocPensieveError} */ (error);
    }
    expect(failure?.message).toContain('authors/gone.png');
    expect(failure?.hint).toContain('version folder');
  });
});

describe('the header at the top of the screen', () => {
  it('is held there by default', async () => {
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toContain('<header class="dp-header">');
    expect(html).not.toContain('dp-header--static');
  });

  it('scrolls away with the page when the project says so', async () => {
    const config = project({ 'index.md': page('Home') }, { stickyHeader: false });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).toContain('<header class="dp-header dp-header--static">');
  });
});

describe('the menu of the documentation', () => {
  const files = {
    'index.md': page('Home'),
    'guide/index.md': page('Guide'),
    'guide/01-install.md': page('Install'),
    'reference/index.md': page('Reference'),
    'reference/01-cli.md': page('Commands'),
  };

  it('writes it twice: the column, and a folded menu for a narrow screen', async () => {
    // One of the two is displayed at a time. Open above the content, a full
    // menu would eat the first screen before a word is read.
    const config = project(files);
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'guide', 'install', 'index.html');
    expect(html).toContain('<nav class="dp-sidebar"');
    expect(html).toMatch(
      /<details class="dp-sidebar-menu">\s*<summary>Documentation menu<\/summary>/,
    );
    expect(html.match(/href="\/versions\/v1\.0\/guide\/install\/"/g)).toHaveLength(2);
  });

  it('shows every entry unfolded by default', async () => {
    const config = project(files);
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).not.toContain('dp-nav-group');
  });

  it('folds the categories on request, open where the reader stands', async () => {
    const config = project(files, { foldedSidebar: true });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'guide', 'install', 'index.html');
    // The branch of the page is open, the other one closed.
    expect(html).toMatch(/<details class="dp-nav-group" open>\s*<summary[^>]*>Guide</);
    expect(html).toMatch(/<details class="dp-nav-group">\s*<summary[^>]*>Reference</);
    // The category is a page too: folded, it gains its own entry.
    expect(html).toContain('href="/versions/v1.0/guide/">Guide</a>');
  });
});

describe('the header menu', () => {
  it('shows the links twice, in a row and behind the menu button', async () => {
    // One of the two is displayed at a time: in a row on a wide screen, behind
    // the button on a narrow one.
    const config = project(
      { 'index.md': page('Home') },
      { headerLinks: [{ label: 'Blog', href: '/blog/' }] },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html.match(/<a href="\/versions\/v1\.0\/blog\/">Blog<\/a>/g)).toHaveLength(2);
    expect(html).toContain('<nav class="dp-header-nav" aria-label="Site">');
    expect(html).toMatch(/<details class="dp-menu">\s*<summary aria-label="Menu">/);
  });

  it('leads to the version a link names, and leaves another site alone', async () => {
    const config = project(
      { 'index.md': page('Home') },
      {
        versions: [
          { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
          { slug: 'beta', name: '2.0', folder: 'docs/v1.0', prerelease: true },
        ],
        headerLinks: [
          { label: 'Examples', href: '/examples/', version: 'beta' },
          { label: 'Repository', href: 'https://example.com/repo' },
        ],
      },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    // Built for v1.0, the link still leads to the beta, where the section is.
    expect(html).toContain('href="/versions/beta/examples/"');
    expect(html).toContain('href="https://example.com/repo"');
  });

  it('opens a panel of links for an entry that carries columns', async () => {
    const config = project(
      { 'index.md': page('Home') },
      {
        headerLinks: [
          {
            label: 'Product',
            columns: [
              {
                title: 'Guide',
                items: [
                  { label: 'Install', href: '/guide/install/' },
                  { label: 'Deploy', href: 'https://example.com/deploy' },
                ],
              },
              { items: [{ label: 'Blog', href: '/blog/' }] },
            ],
          },
        ],
      },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toMatch(/<details class="dp-mega">\s*<summary>Product<\/summary>/);
    expect(html).toContain('<p class="dp-mega-title">Guide</p>');
    expect(html).toContain('href="/versions/v1.0/guide/install/"');
    expect(html).toContain('href="https://example.com/deploy"');
    // A column may go without a title, and the panel is written twice: in the
    // row and in the menu of a narrow screen.
    expect(html.match(/dp-mega-panel/g)).toHaveLength(2);
  });

  it('writes no menu with nothing to put in it', async () => {
    // A single version, no search, no link: a button that opens onto nothing
    // would be worse than no button.
    const config = project({ 'index.md': page('Home') }, { search: false });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).not.toContain('dp-menu');
    expect(html).not.toContain('dp-header-nav');
  });
});

describe('the tags of a page', () => {
  /** @param {string} title @param {string} frontmatter */
  const tagged = (title, frontmatter) => `---\ntitle: ${title}\n${frontmatter}\n---\n\nContent.\n`;

  it('shows them at the bottom, after the article', async () => {
    const config = project({ 'index.md': tagged('Install', 'tags: [guide, installation]') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toContain('<li class="dp-tag">guide</li>');
    expect(html).toContain('<li class="dp-tag">installation</li>');
    // Read after the text, they say what it was about.
    expect(html.indexOf('dp-tags')).toBeGreaterThan(html.indexOf('</article>'));
  });

  it('reads a single tag, and drops blanks and repeats', async () => {
    const config = project({ 'index.md': tagged('Install', "tags: [guide, guide, '', ' ']") });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);
    expect(read(out, 'index.html').match(/class="dp-tag"/g)).toHaveLength(1);

    const single = project({ 'index.md': tagged('Install', 'tags: guide') });
    const singleOut = path.join(single.rootDir, 'out');
    await generatorFor(single).buildVersion('v1.0', singleOut);
    expect(read(singleOut, 'index.html')).toContain('<li class="dp-tag">guide</li>');
  });

  it('adds nothing to a page without tags, or to a home page', async () => {
    const plain = project({ 'index.md': page('Install') });
    const plainOut = path.join(plain.rootDir, 'out');
    await generatorFor(plain).buildVersion('v1.0', plainOut);
    expect(read(plainOut, 'index.html')).not.toContain('dp-tags');

    const home = project({ 'index.md': tagged('Home', 'layout: home\ntags: [home]') });
    const homeOut = path.join(home.rootDir, 'out');
    await generatorFor(home).buildVersion('v1.0', homeOut);
    expect(read(homeOut, 'index.html')).not.toContain('dp-tags');
  });
});

describe('shell accessibility', () => {
  it('makes the main area and the top of the page focusable by in-page jumps', async () => {
    // Without tabindex, the skip link and the back-to-top link moved the view
    // but left the focus where it was.
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toMatch(/<main[^>]*id="content"[^>]*tabindex="-1"/);
    expect(html).toMatch(/<div id="top" tabindex="-1"><\/div>/);
  });

  it('keeps the back-to-top target off the sticky header', async () => {
    // The header carried the identifier, and the button did nothing: pinned to
    // the top of the viewport, a sticky header is already in view, so there
    // was never anything to scroll. The target belongs above it, in the flow.
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toContain('href="#top"');
    expect(html).not.toMatch(/<header[^>]*id="top"/);
    expect(html.indexOf('id="top"')).toBeLessThan(html.indexOf('<header'));
  });

  it('keeps the visible label in the name of the version switcher', async () => {
    // Dictating "1.0", what is read on screen, must find the button: an
    // accessible name that does not contain it made it unreachable by voice.
    const config = project(
      { 'index.md': page('Home') },
      {
        versions: [
          { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
          { slug: 'v2.0', name: '2.0', folder: 'docs/v1.0', prerelease: true },
        ],
      },
    );
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    expect(read(out, 'index.html')).toContain(
      'aria-label="Version 1.0, switch version">1.0</summary>',
    );
  });
});

describe('a version in two languages', () => {
  /**
   * Same project, with a translation: three pages in English, two in French,
   * so that one page has no twin — the case every decision here turns on.
   *
   * @param {Record<string, any>} [overrides]
   */
  const bilingual = (overrides = {}) => {
    const config = project(
      {
        'index.md': page('Home'),
        'guide/01-install.md': page('Install'),
        'guide/02-advanced.md': page('Advanced'),
      },
      {
        versions: [
          {
            slug: 'v1.0',
            name: '1.0',
            folder: 'docs/v1.0',
            current: true,
            translations: { fr: 'docs/v1.0-fr' },
          },
        ],
        ...overrides,
      },
    );
    for (const [relative, contents] of Object.entries({
      'index.md': page('Accueil'),
      'guide/01-install.md': page('Installation'),
    })) {
      const full = path.join(config.rootDir, 'docs', 'v1.0-fr', relative);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, contents, 'utf8');
    }
    return config;
  };

  it('serves the site language where it was, and the translation under its code', async () => {
    // Nothing already published moves: that is the whole point of the shape.
    const config = bilingual();
    const out = path.join(config.rootDir, 'out');

    const result = await generatorFor(config).buildVersion('v1.0', out);

    expect(result.pages).toBe(5);
    expect(existsSync(path.join(out, 'guide', 'install', 'index.html'))).toBe(true);
    expect(existsSync(path.join(out, 'fr', 'guide', 'install', 'index.html'))).toBe(true);
  });

  it('writes each page in its own language, shell included', async () => {
    const config = bilingual();
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const french = read(out, 'fr', 'guide', 'install', 'index.html');
    expect(french).toContain('<html lang="fr"');
    expect(french).toContain('Aller au contenu');
    expect(french).not.toContain('Skip to content');

    // The language of the site is untouched by the translation.
    expect(read(out, 'guide', 'install', 'index.html')).toContain('Skip to content');
  });

  it('offers the other language only where the page exists', async () => {
    const config = bilingual();
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const translated = read(out, 'guide', 'install', 'index.html');
    expect(translated).toContain('/out/fr/guide/install/'.replace('/out', ''));

    // A page nobody translated: the language is named so that the reader knows
    // it exists, and inert so that they are not sent to a page that is not.
    const alone = read(out, 'guide', 'advanced', 'index.html');
    const switcher = alone.slice(alone.indexOf('dp-languages-list'));
    expect(switcher).toContain('aria-disabled="true"');
    expect(alone).not.toContain('fr/guide/advanced/');
  });

  it('announces to search engines only the twins that exist', async () => {
    const config = bilingual({ siteUrl: 'https://acme.example.com' });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const translated = read(out, 'guide', 'install', 'index.html');
    expect(translated).toContain('hreflang="fr"');
    expect(translated).toContain('https://acme.example.com/versions/v1.0/fr/guide/install/');

    // A page with no twin announcing one would send a French reader to English.
    const alone = read(out, 'guide', 'advanced', 'index.html');
    expect(alone).toContain('hreflang="en"');
    expect(alone).not.toContain('hreflang="fr"');
  });

  it('publishes the pages of every language, and only those', async () => {
    const config = bilingual({ siteUrl: 'https://acme.example.com' });
    const out = path.join(config.rootDir, 'out');

    const { published } = await generatorFor(config).buildVersion('v1.0', out);
    const urls = published.map((entry) => entry.url);

    expect(urls).toContain('/versions/v1.0/fr/guide/install/');
    expect(urls).not.toContain('/versions/v1.0/fr/guide/advanced/');
  });

  it('gives each language its own search page', async () => {
    const config = bilingual();
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    // A French reader searching English pages would find nothing of use.
    expect(read(out, 'fr', 'search', 'index.html')).toContain('Rechercher dans la documentation');
    expect(read(out, 'search', 'index.html')).toContain('Search the documentation');
  });

  it('refuses a translation folder with nothing in it', async () => {
    const config = bilingual();
    rmSync(path.join(config.rootDir, 'docs', 'v1.0-fr'), { recursive: true, force: true });
    const out = path.join(config.rootDir, 'out');

    /** @type {any} */
    let failure;
    try {
      await generatorFor(config).buildVersion('v1.0', out);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(GeneratorError);
    expect(failure.message).toContain('"fr" translation');
    expect(failure.hint).toContain('docs/v1.0-fr');
  });
});
