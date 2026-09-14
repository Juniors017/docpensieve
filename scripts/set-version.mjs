#!/usr/bin/env node
/**
 * Sets the version of the five packages, and of the root, in one go.
 *
 * The packages are published together and pin one another at that exact
 * version. With a caret, npm kept the internal packages a previous release had
 * installed: moving the command-line package from 0.1.0 to 0.1.1 left the four
 * others at 0.1.0, and every command failed on a missing export. `npm version`
 * rewrites the versions but not the pins — hence this script, which also
 * refreshes the lockfile.
 *
 * Usage:
 *   npm run version:all -- <version>
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];

if (!version || !/^[0-9]+[.][0-9]+[.][0-9]+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: npm run version:all -- <version>, e.g. 0.2.0');
  process.exit(1);
}

/** @param {string} file */
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));

const packages = readdirSync(path.join(ROOT, 'packages'))
  .map((name) => path.join(ROOT, 'packages', name, 'package.json'))
  .filter((file) => existsSync(file));
const names = new Set(packages.map((file) => read(file).name));

for (const file of [path.join(ROOT, 'package.json'), ...packages]) {
  const manifest = read(file);
  manifest.version = version;
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      if (names.has(name)) manifest[field][name] = version;
    }
  }
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

// The lockfile records the versions and the pins alike.
execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
console.log(`Version ${version} set on the root and the ${names.size} packages.`);
