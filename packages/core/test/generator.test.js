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
    expect(html.match(/dp-nav-link/g)).toHaveLength(1);
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

describe('errors', () => {
  it('reports a write failure', async () => {
    const config = project({ 'index.md': page('Home') });
    // A file where the generator wants to create a folder.
    const out = path.join(config.rootDir, 'out');
    writeFileSync(out, 'obstacle', 'utf8');

    await expect(generatorFor(config).buildVersion('v1.0', out)).rejects.toThrow(GeneratorError);
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

describe('shell accessibility', () => {
  it('makes the main area and the header focusable by in-page jumps', async () => {
    // Without tabindex, the skip link and the back-to-top link moved the view
    // but left the focus where it was.
    const config = project({ 'index.md': page('Home') });
    const out = path.join(config.rootDir, 'out');
    await generatorFor(config).buildVersion('v1.0', out);

    const html = read(out, 'index.html');
    expect(html).toMatch(/<main[^>]*id="content"[^>]*tabindex="-1"/);
    expect(html).toMatch(/<header[^>]*id="top"[^>]*tabindex="-1"/);
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
