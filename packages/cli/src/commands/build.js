/**
 * `docpensieve build` command.
 *
 * @module docpensieve/commands/build
 */

import path from 'node:path';

import {
  componentsCss,
  createRegistry,
  setSiteContext,
  setAdmonitionKinds,
} from '@docpensieve/components';
import { SiteGenerator, loadConfig, resolveVersion } from '@docpensieve/core';

import { createTheme } from '../theme.js';

/**
 * @param {string | undefined} versionSlug Version to generate, or all of them when omitted.
 * @param {{ out?: string, cwd?: string }} [options]
 * @returns {Promise<void>}
 */
export async function build(versionSlug, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd);
  const outDir = path.resolve(cwd, options.out ?? config.outDir);

  // The kinds a project declares, beside the ones shipped.
  setAdmonitionKinds(config.admonitions);

  const generator = new SiteGenerator(config, {
    // `globalComponents: false` removes the shipped components: a project that
    // defines its own thus avoids a name collision. The option was declared
    // and documented, but nobody read it.
    components: config.globalComponents === false ? {} : createRegistry(),
    onPage: setSiteContext,
    theme: createTheme(config, await componentsCss()),
  });

  if (versionSlug) {
    const version = resolveVersion(config, versionSlug);
    console.log(`Generating version ${version.name} (${version.slug})…`);
    const result = await generator.buildVersion(
      version.slug,
      path.join(outDir, 'versions', version.slug),
    );
    console.log(`${result.pages} page(s) written to ${result.outDir}`);
    return;
  }

  console.log(`Generating ${config.versions.length} version(s)…`);
  const result = await generator.buildAll();
  console.log(`${result.pages} page(s) across ${result.versions} version(s) in ${result.outDir}`);
}
