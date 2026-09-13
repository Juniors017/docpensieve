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
    expect(config.theme).toEqual({ framework: 'tailwind', darkMode: 'class' });
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

  it('reports that a sidebar described by a file is not written', async () => {
    // The option was documented and read nowhere: a path was silently
    // accepted, and the sidebar stayed automatic without a word.
    const { NotImplementedError } = await import('@docpensieve/shared');
    expect(() => normalizeConfig({ versions: [v1], sidebar: 'sidebar.js' })).toThrow(
      NotImplementedError,
    );
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
    await expect(loadConfig(dir)).rejects.toThrow(/No docpensieve\.config\.js/);
  });

  it('reports a config that does not compile', async () => {
    const dir = makeProject('export default { versions: [ ;');
    await expect(loadConfig(dir)).rejects.toThrow(ConfigError);
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
