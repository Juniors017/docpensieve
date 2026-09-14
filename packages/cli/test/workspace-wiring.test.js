/**
 * Checks the Phase 0 acceptance criterion: every package resolves its
 * neighbours by their npm name, not by a relative path. This test breaks if a
 * workspace link or an `exports` field is badly declared.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as cli from 'docpensieve';
import * as components from '@docpensieve/components';
import * as core from '@docpensieve/core';
import * as shared from '@docpensieve/shared';
import * as theme from '@docpensieve/theme';

import { createTheme } from '../src/theme.js';

/** Repository root, resolved from this file rather than from the cwd. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The five packages published together, at the same version. */
const PACKAGES = ['shared', 'core', 'theme', 'components', 'cli'];

/**
 * Reads the manifest of a package of the repository.
 *
 * @param {string} [name] Folder name under `packages`, or the root when omitted.
 * @returns {Record<string, any>}
 */
function manifest(name) {
  const file = name
    ? path.join(ROOT, 'packages', name, 'package.json')
    : path.join(ROOT, 'package.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}

describe('monorepo wiring', () => {
  it('exposes the public API of every package', () => {
    expect(Object.keys(shared)).toEqual(expect.arrayContaining(['slugify', 'DocPensieveError']));
    expect(Object.keys(core)).toEqual(expect.arrayContaining(['loadConfig', 'SiteGenerator']));
    expect(Object.keys(theme)).toEqual(
      expect.arrayContaining(['ThemeEngine', 'BaseThemeProvider']),
    );
    expect(Object.keys(components)).toEqual(expect.arrayContaining(['createRegistry']));
    expect(Object.keys(cli)).toEqual(expect.arrayContaining(['build', 'dev', 'serve']));
  });

  it('shares a single instance of the error classes across packages', () => {
    // If npm duplicated @docpensieve/shared, instanceof would fail here
    // although both classes would carry the same name: a classic monorepo trap.
    const error = new shared.NotImplementedError('Test', '0');
    expect(error).toBeInstanceOf(shared.DocPensieveError);
  });

  it('can mount every framework the configuration announces', () => {
    // This test replaces the one that watched for the last NotImplementedError
    // of the repository: there is none left. It now guards the agreement
    // between the values the configuration accepts and the providers actually
    // wired.
    for (const framework of shared.THEME_FRAMEWORKS) {
      const engine = createTheme({ theme: { framework } });
      expect(engine.classes.nav, framework).toBeTruthy();
    }
  });

  it('refuses an unknown framework', () => {
    expect(() => createTheme({ theme: { framework: 'bootstrap' } })).toThrow();
  });
});

describe('what goes to npm', () => {
  it('tells every package the Node version it requires', () => {
    // The root is private: its `engines` field never leaves the repository.
    // Without each package's own, npm warns no one installing on a Node that
    // is too old — the failure comes later, and elsewhere.
    const expected = manifest().engines.node;
    for (const name of PACKAGES) {
      expect(manifest(name).engines?.node, name).toBe(expected);
    }
  });

  it('publishes the binary under the name the user types', () => {
    // `npx docpensieve` looks for a package **named** docpensieve. Under a
    // scoped name, the start command the documentation gives would resolve
    // nothing — and the failure would happen to the user, at the very first
    // step.
    const cliManifest = manifest('cli');
    expect(cliManifest.name).toBe('docpensieve');
    expect(Object.keys(cliManifest.bin ?? {})).toContain('docpensieve');
  });

  it('keeps the root out of npm', () => {
    // It carries the monorepo's name, not the published package's.
    const root = manifest();
    expect(root.private).toBe(true);
    expect(root.name).not.toBe('docpensieve');
  });

  it('keeps the five packages at the same version', () => {
    const versions = new Set(PACKAGES.map((name) => manifest(name).version));
    expect(versions.size).toBe(1);
  });

  it('pins every internal dependency at that same version', () => {
    // With a caret, npm kept the internal packages a previous release had
    // installed: moving the command-line package from 0.1.0 to 0.1.1 — which
    // npx does on its own — left the four others at 0.1.0, and every command
    // then failed on a missing export. An exact pin makes them follow.
    const names = new Set(PACKAGES.map((name) => manifest(name).name));
    for (const name of PACKAGES) {
      const { version, dependencies = {} } = manifest(name);
      for (const [dependency, range] of Object.entries(dependencies)) {
        if (names.has(dependency)) expect(range, `${name}: ${dependency}`).toBe(version);
      }
    }
  });
});
