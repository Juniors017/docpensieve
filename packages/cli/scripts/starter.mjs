/**
 * Copies the documentation of this package's version into `starter/`, where
 * `docpensieve init` finds it once the package is installed.
 *
 * Run by "prepack", so the documentation shipped is always the one of the
 * version being packed, and with `--clean` by "postpack": left behind in the
 * repository, the copy would go stale and hide the real pages.
 */

import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../starter/', import.meta.url));
rmSync(target, { recursive: true, force: true });

if (!process.argv.includes('--clean')) {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const [major, minor] = String(version).split('.');
  const source = fileURLToPath(new URL(`../../../docs/v${major}.${minor}/`, import.meta.url));

  if (!existsSync(source)) {
    console.error(`No documentation for version ${major}.${minor}: ${source} is missing.`);
    process.exit(1);
  }

  cpSync(source, target, { recursive: true });
  console.log(`starter/ <- docs/v${major}.${minor}`);
}
