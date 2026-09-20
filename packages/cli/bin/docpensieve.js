#!/usr/bin/env node
/**
 * Entry point of the DocPensieve CLI.
 *
 * This file only holds argument parsing and error presentation. All the logic
 * lives in `src/commands/`.
 */

import { createRequire } from 'node:module';

import { DOCUMENTATION_URL, DocPensieveError, NotImplementedError } from '@docpensieve/shared';
import { Command } from 'commander';
import chalk from 'chalk';

import { build, check, dev, init, serve } from '../src/index.js';

const { version } = createRequire(import.meta.url)('../package.json');

const program = new Command();

program
  .name('docpensieve')
  .description('Static documentation site generator')
  .version(version, '-v, --version')
  // Someone typing --help is usually stuck: the list of commands alone sends
  // them back where they started.
  .addHelpText('after', `\nDocumentation: ${DOCUMENTATION_URL}`);

program
  .command('init')
  .description('Sets up a documentation project')
  .argument('[dir]', 'target folder', '.')
  .option('-n, --name <name>', 'project name')
  .option('-t, --theme <framework>', 'tailwind | custom')
  .option('-u, --site-url <url>', 'public URL of the site')
  .option('--version-name <version>', 'first version, e.g. 1.0')
  .option('--translation <code>', 'code of a second language, e.g. fr')
  .option('-y, --yes', 'accept the defaults without a dialogue')
  .option('-f, --force', 'overwrite an existing configuration')
  .option('--minimal', "leave DocPensieve's documentation out of the new site")
  .action(async (dir, options) => {
    await init(dir, { ...options, version: options.versionName });
  });

program
  .command('build')
  .description('Generates the site (one version, or all of them when omitted)')
  .argument('[version]', 'version slug, e.g. v1.0')
  .option('-o, --out <dir>', 'output folder (default: the one in the config)')
  .action(async (versionSlug, options) => {
    await build(versionSlug, options);
  });

program
  .command('check')
  .description('Reads the produced site back and reports dead links and invalid markup')
  .option('-d, --dir <dir>', 'folder to check')
  .action(async (options) => {
    await check(options);
  });

program
  .command('dev')
  .description('Development server with reload')
  .option('-p, --port <number>', 'listening port', Number, 3000)
  .action(async (options) => {
    await dev(options);
  });

program
  .command('serve')
  .description('Serves the output folder statically')
  .option('-p, --port <number>', 'listening port', Number, 4000)
  .option('-d, --dir <dir>', 'folder to serve')
  .action(async (options) => {
    await serve(options);
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof NotImplementedError) {
    // A known roadmap milestone: not a crash, so stay sober.
    console.error(`${chalk.yellow('Not available yet')} ${error.message}`);
    if (error.hint) console.error(chalk.dim(error.hint));
    process.exitCode = 2;
  } else if (error instanceof DocPensieveError) {
    console.error(`${chalk.red('Error')} ${error.message}`);
    if (error.hint) console.error(chalk.dim(error.hint));
    process.exitCode = 1;
  } else {
    // Unexpected error: the stack is the useful information.
    console.error(chalk.red('Unexpected error:'));
    console.error(error);
    process.exitCode = 1;
  }
}
