import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ConfigError } from '@docpensieve/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, loadConfig, normalizeConfig, resolveVersion } from '../src/index.js';

/** Smallest valid version, reused by the nominal cases. */
const v1 = { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0' };

describe('normalizeConfig', () => {
  it('applies the defaults without overwriting the given values', () => {
    const config = normalizeConfig({ projectName: 'My docs', versions: [v1] });
    expect(config.projectName).toBe('My docs');
    expect(config.outDir).toBe(DEFAULT_CONFIG.outDir);
    expect(config.sidebar).toBe('auto');
  });

  it('deep-merges theme and jsonld', () => {
    const config = normalizeConfig({ versions: [v1], theme: { framework: 'tailwind' } });
    expect(config.theme).toEqual({ framework: 'tailwind', darkMode: 'class', toggle: true });
    expect(config.jsonld.enabled).toBe(true);
  });

  it('marks the first version as current when none is', () => {
    const config = normalizeConfig({
      versions: [{ ...v1 }, { slug: 'v0.9', name: '0.9', folder: 'docs/v0.9' }],
    });
    expect(config.versions[0].current).toBe(true);
    expect(config.versions[1].current).toBeUndefined();
  });

  it('refuses an empty config', () => {
    expect(() => normalizeConfig({})).toThrow(ConfigError);
    // Deliberately invalid input: the refusal is what is checked. The marker
    // fails if the function ever starts accepting it.
    // @ts-expect-error
    expect(() => normalizeConfig(null)).toThrow(ConfigError);
  });

  it('refuses an incomplete version', () => {
    expect(() => normalizeConfig({ versions: [{ slug: 'v1.0' }] })).toThrow(/name/);
  });

  it('refuses two versions with the same slug', () => {
    expect(() => normalizeConfig({ versions: [v1, { ...v1 }] })).toThrow(/declared twice/);
  });

  it('refuses two current versions', () => {
    expect(() =>
      normalizeConfig({
        versions: [
          { ...v1, current: true },
          { slug: 'v0.9', name: '0.9', folder: 'docs/v0.9', current: true },
        ],
      }),
    ).toThrow(/only one version/i);
  });

  it('refuses a version that is both current and in preparation', () => {
    // The notice on a version in preparation would contradict the role of the
    // one served by default: readers would no longer know where they are.
    expect(() =>
      normalizeConfig({ versions: [{ ...v1, current: true, prerelease: true }] }),
    ).toThrow(/current.*prerelease/);
  });

  it('accepts a version in preparation next to a current one', () => {
    const config = normalizeConfig({
      versions: [
        { slug: 'v2.0', name: '2.0', folder: 'docs/v2.0', prerelease: true },
        { ...v1, current: true },
      ],
    });
    expect(config.versions[0].prerelease).toBe(true);
    expect(config.versions[1].current).toBe(true);
  });

  it('accepts a sidebar described by a JSON file', () => {
    expect(normalizeConfig({ versions: [v1], sidebar: 'sidebar.json' }).sidebar).toBe(
      'sidebar.json',
    );
    expect(normalizeConfig({ versions: [v1], sidebar: 'nav/menu.json' }).sidebar).toBe(
      'nav/menu.json',
    );
  });

  it('refuses a sidebar that is neither auto nor a JSON file of the version', () => {
    // Read from each version's folder: a path leaving it, or another kind of
    // file, could only be a mistake.
    for (const sidebar of ['sidebar.js', '../sidebar.json', '/nav/sidebar.json', 'manual']) {
      expect(() => normalizeConfig({ versions: [v1], sidebar }), sidebar).toThrow(
        /sidebar must be 'auto' or a .json file/,
      );
    }
  });

  it('accepts the automatic sidebar', () => {
    expect(normalizeConfig({ versions: [v1] }).sidebar).toBe('auto');
    expect(normalizeConfig({ versions: [v1], sidebar: 'auto' }).sidebar).toBe('auto');
  });

  it('refuses an unknown theme framework', () => {
    expect(() => normalizeConfig({ versions: [v1], theme: { framework: 'bootstrap' } })).toThrow(
      /Unknown theme framework/,
    );
  });
});

describe('resolveVersion', () => {
  const config = normalizeConfig({
    versions: [
      { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
      { slug: 'v0.9', name: '0.9', folder: 'docs/v0.9' },
    ],
  });

  it('returns the current version without an argument', () => {
    expect(resolveVersion(config).slug).toBe('v1.0');
  });

  it('returns the version requested by slug', () => {
    expect(resolveVersion(config, 'v0.9').name).toBe('0.9');
  });

  it('lists the known versions in the hint when the slug is unknown', () => {
    // The message says what is wrong, the hint says what to do: that pair is
    // what the CLI prints. Both deserve their own check.
    expect(() => resolveVersion(config, 'v2.0')).toThrow(/Unknown version/);
    try {
      resolveVersion(config, 'v2.0');
      expect.unreachable('resolveVersion should have thrown');
    } catch (error) {
      const failure = /** @type {Error & { hint?: string }} */ (error);
      expect(failure.hint).toMatch(/v1\.0, v0\.9/);
    }
  });
});

describe('loadConfig', () => {
  /** @type {string[]} */
  const created = [];

  /**
   * Creates a throwaway project. `contents` omitted = project without a
   * config file.
   * @param {string} [contents]
   */
  const makeProject = (contents) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'docpensieve-'));
    created.push(dir);
    if (contents !== undefined) {
      writeFileSync(path.join(dir, 'docpensieve.config.js'), contents, 'utf8');
    }
    return dir;
  };

  afterEach(() => {
    for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('loads and normalises a config file', async () => {
    const dir = makeProject(
      `export default { projectName: 'From disk', versions: [${JSON.stringify(v1)}] };`,
    );
    const config = await loadConfig(dir);
    expect(config.projectName).toBe('From disk');
    expect(config.rootDir).toBe(dir);
    expect(config.versions[0].current).toBe(true);
  });

  it('clearly reports a missing config', async () => {
    const dir = makeProject(undefined);
    await expect(loadConfig(dir)).rejects.toThrow(/No docpensieve\.config\.mjs/);
  });

  it('reports a config that does not compile, with the reason', async () => {
    const dir = makeProject('export default { versions: [ ;');
    await expect(loadConfig(dir)).rejects.toThrow(ConfigError);
    // "Could not load" alone left the author guessing what was wrong.
    await expect(loadConfig(dir)).rejects.toThrow(/Could not load docpensieve\.config\.js: \S/);
  });

  it('loads a docpensieve.config.mjs whatever the package.json declares', async () => {
    // "npm init -y" now writes "type": "commonjs": a .js configuration
    // written as a module is then refused outright. A .mjs file is a module
    // anywhere.
    const dir = makeProject(undefined);
    writeFileSync(path.join(dir, 'package.json'), '{ "type": "commonjs" }', 'utf8');
    writeFileSync(
      path.join(dir, 'docpensieve.config.mjs'),
      `export default { projectName: 'Module', versions: [${JSON.stringify(v1)}] };`,
      'utf8',
    );

    const config = await loadConfig(dir);
    expect(config.projectName).toBe('Module');
    expect(config.configFile).toBe(path.join(dir, 'docpensieve.config.mjs'));
  });

  it('refuses two configuration files rather than pick one', async () => {
    // Picking one silently would leave the other edited in vain.
    const contents = `export default { versions: [${JSON.stringify(v1)}] };`;
    const dir = makeProject(contents);
    writeFileSync(path.join(dir, 'docpensieve.config.mjs'), contents, 'utf8');

    await expect(loadConfig(dir)).rejects.toThrow(/Two configuration files/);
  });

  it(
    'explains why a .js configuration cannot be read as a module',
    { timeout: 30_000 },
    async () => {
      // Only Node itself refuses the file: the test runner loads modules its own
      // way and would read it anyway. Hence a real Node process.
      const { spawnSync } = await import('node:child_process');
      const dir = makeProject(`export default { versions: [${JSON.stringify(v1)}] };`);
      writeFileSync(path.join(dir, 'package.json'), '{ "type": "commonjs" }', 'utf8');

      const core = new URL('../src/index.js', import.meta.url).href;
      const script = `import { loadConfig } from ${JSON.stringify(core)};
try {
  await loadConfig(process.cwd());
  console.log(JSON.stringify({ loaded: true }));
} catch (error) {
  console.log(JSON.stringify({ name: error.name, hint: error.hint }));
}`;
      const { stdout } = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: dir,
        encoding: 'utf8',
      });

      const result = JSON.parse(stdout.trim().split('\n').at(-1) ?? '{}');
      expect(result.name).toBe('ConfigError');
      expect(result.hint).toContain('docpensieve.config.mjs');
    },
  );
});

describe('project images', () => {
  const site = 'https://example.com';

  it('accepts a logo, a favicon and a preview image', () => {
    const config = normalizeConfig({
      versions: [v1],
      siteUrl: site,
      logo: 'brand/logo.svg',
      favicon: 'brand/icon.png',
      socialImage: 'brand/social.jpg',
    });
    expect([config.logo, config.favicon, config.socialImage]).toEqual([
      'brand/logo.svg',
      'brand/icon.png',
      'brand/social.jpg',
    ]);
  });

  it('declares none by default', () => {
    const config = normalizeConfig({ versions: [v1] });
    expect([config.logo, config.favicon, config.socialImage]).toEqual(['', '', '']);
  });

  it('refuses a favicon that browser tabs do not show', () => {
    expect(() => normalizeConfig({ versions: [v1], favicon: 'brand/icon.jpg' })).toThrow(
      /favicon must be/,
    );
  });

  it('refuses a vector preview, which social networks do not read', () => {
    expect(() =>
      normalizeConfig({ versions: [v1], siteUrl: site, socialImage: 'brand/social.svg' }),
    ).toThrow(/socialImage must be/);
  });

  it('refuses a preview image without siteUrl', () => {
    // Social networks only read an absolute address: a relative one would be
    // written in every page, and read by none of them.
    expect(() => normalizeConfig({ versions: [v1], socialImage: 'brand/social.png' })).toThrow(
      /needs siteUrl/,
    );
  });

  it('refuses an image that is not a path', () => {
    expect(() => normalizeConfig({ versions: [v1], logo: true })).toThrow(ConfigError);
  });
});

describe('sitemap and feed', () => {
  it('writes the sitemap by default, the feed on request', () => {
    const config = normalizeConfig({ versions: [v1] });
    expect([config.sitemap, config.feed]).toEqual([true, false]);
  });

  it('refuses them asked for without siteUrl', () => {
    // Both list absolute addresses: without siteUrl, they could only be wrong.
    expect(() => normalizeConfig({ versions: [v1], sitemap: true })).toThrow(
      /sitemap needs siteUrl/,
    );
    expect(() => normalizeConfig({ versions: [v1], feed: true })).toThrow(/feed needs siteUrl/);
    const config = normalizeConfig({ versions: [v1], siteUrl: 'https://example.com', feed: true });
    expect(config.feed).toBe(true);
  });

  it('refuses a value that is neither true nor false', () => {
    expect(() => normalizeConfig({ versions: [v1], feed: 'yes' })).toThrow(/true or false/);
  });
});

describe('search', () => {
  it('is on by default, and takes true or false', () => {
    expect(normalizeConfig({ versions: [v1] }).search).toBe(true);
    expect(normalizeConfig({ versions: [v1], search: false }).search).toBe(false);
    expect(() => normalizeConfig({ versions: [v1], search: 'yes' })).toThrow(/true or false/);
  });
});

describe('colour scheme and version images', () => {
  it('accepts a scheme that follows the system, or one kept fixed', () => {
    for (const darkMode of ['class', 'dark', 'light']) {
      expect(
        normalizeConfig({ versions: [v1], theme: { framework: 'custom', darkMode } }).theme
          .darkMode,
      ).toBe(darkMode);
    }
  });

  it('refuses a scheme it does not know', () => {
    // Declared and read nowhere, darkMode accepted anything, and did nothing.
    expect(() =>
      normalizeConfig({ versions: [v1], theme: { framework: 'custom', darkMode: 'night' } }),
    ).toThrow(/Unknown darkMode/);
  });

  it('accepts a logo and a favicon of the version, checked like the project ones', () => {
    const config = normalizeConfig({
      versions: [{ ...v1, logo: 'brand/beta.svg', favicon: 'brand/beta.png' }],
    });
    expect(config.versions[0].logo).toBe('brand/beta.svg');
    expect(() => normalizeConfig({ versions: [{ ...v1, favicon: 'brand/beta.jpg' }] })).toThrow(
      /favicon of version "v1.0"/,
    );
  });
});

describe('the light / dark switch', () => {
  it('is on by default, and takes true or false', () => {
    expect(normalizeConfig({ versions: [v1] }).theme.toggle).toBe(true);
    expect(
      normalizeConfig({ versions: [v1], theme: { framework: 'custom', toggle: true } }).theme
        .toggle,
    ).toBe(true);
    expect(() =>
      normalizeConfig({ versions: [v1], theme: { framework: 'custom', toggle: 'yes' } }),
    ).toThrow(/theme.toggle must be true or false/);
  });
});

describe('header links', () => {
  const beta = { slug: 'beta', name: '2.0', folder: 'docs/v2.0', prerelease: true };

  it('is empty by default, and takes links with a label and a target', () => {
    expect(normalizeConfig({ versions: [v1] }).headerLinks).toEqual([]);
    const links = [
      { label: 'Examples', href: '/examples/', version: 'beta' },
      { label: 'Repository', href: 'https://example.com/repo' },
    ];
    expect(normalizeConfig({ versions: [v1, beta], headerLinks: links }).headerLinks).toEqual(
      links,
    );
  });

  it('refuses a link without a label', () => {
    let failure;
    try {
      normalizeConfig({ versions: [v1], headerLinks: [{ href: '/examples/' }] });
    } catch (error) {
      failure = /** @type {ConfigError} */ (error);
    }
    expect(failure).toBeInstanceOf(ConfigError);
    expect(failure?.hint).toContain('label');
  });

  it('refuses a relative target, which would change meaning from page to page', () => {
    let failure;
    try {
      normalizeConfig({ versions: [v1], headerLinks: [{ label: 'Blog', href: 'blog/' }] });
    } catch (error) {
      failure = /** @type {ConfigError} */ (error);
    }
    expect(failure).toBeInstanceOf(ConfigError);
    expect(failure?.message).toContain('"Blog"');
    expect(failure?.hint).toContain("'/examples/'");
  });

  it('takes an entry that opens a panel of links', () => {
    const links = [
      {
        label: 'Product',
        columns: [{ title: 'Guide', items: [{ label: 'Install', href: '/guide/install/' }] }],
      },
    ];
    expect(normalizeConfig({ versions: [v1], headerLinks: links }).headerLinks).toEqual(links);
  });

  it('refuses an entry that both leads somewhere and opens a panel', () => {
    let failure;
    try {
      normalizeConfig({
        versions: [v1],
        headerLinks: [
          {
            label: 'Product',
            href: '/product/',
            columns: [{ items: [{ label: 'Install', href: '/guide/install/' }] }],
          },
        ],
      });
    } catch (error) {
      failure = /** @type {ConfigError} */ (error);
    }
    expect(failure).toBeInstanceOf(ConfigError);
    expect(failure?.hint).toContain('drop one of the two');
  });

  it('refuses an empty column, and a link of a column without a target', () => {
    expect(() =>
      normalizeConfig({
        versions: [v1],
        headerLinks: [{ label: 'Product', columns: [{ items: [] }] }],
      }),
    ).toThrow(ConfigError);

    let failure;
    try {
      normalizeConfig({
        versions: [v1],
        headerLinks: [
          { label: 'Product', columns: [{ items: [{ label: 'Install', href: 'guide/' }] }] },
        ],
      });
    } catch (error) {
      failure = /** @type {ConfigError} */ (error);
    }
    expect(failure?.message).toContain('"Install" of "Product"');
  });

  it('refuses a version nobody declared', () => {
    let failure;
    try {
      normalizeConfig({
        versions: [v1],
        headerLinks: [{ label: 'Examples', href: '/examples/', version: 'beat' }],
      });
    } catch (error) {
      failure = /** @type {ConfigError} */ (error);
    }
    expect(failure).toBeInstanceOf(ConfigError);
    expect(failure?.message).toContain('"beat"');
    expect(failure?.hint).toContain('v1.0');
  });
});

describe('dangerous values', () => {
  it('refuses a version slug that is not a safe path segment', () => {
    // The slug becomes an output folder: "../../elsewhere" wrote outside the
    // output folder, ".." overwrote the root redirect.
    for (const slug of ['../../evil', '..', 'a/b', 'C:/x', 'Été', 'v1 ']) {
      expect(() => normalizeConfig({ versions: [{ ...v1, slug }] }), slug).toThrow(ConfigError);
    }
  });

  it('accepts ordinary slugs', () => {
    for (const slug of ['v1.0', 'v0.2-beta', 'next']) {
      expect(normalizeConfig({ versions: [{ ...v1, slug }] }).versions[0].slug).toBe(slug);
    }
  });

  it('refuses a siteUrl that is not a web address', () => {
    // Accepted here, it blew up further on as a raw TypeError, stack
    // included; with an exotic scheme, it built a nonsensical prefix.
    for (const siteUrl of ['example.com', 'javascript:alert(1)']) {
      expect(() => normalizeConfig({ siteUrl, versions: [v1] }), siteUrl).toThrow(ConfigError);
    }
  });

  it('does not modify the configuration it receives', () => {
    const user = { versions: [{ ...v1 }] };
    normalizeConfig(user);
    expect(user.versions[0]).not.toHaveProperty('current');
  });

  it('accepts a frozen configuration', () => {
    const frozen = Object.freeze({ versions: Object.freeze([Object.freeze({ ...v1 })]) });
    expect(() => normalizeConfig(frozen)).not.toThrow();
  });
});
