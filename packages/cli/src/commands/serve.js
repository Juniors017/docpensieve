/**
 * `docpensieve serve` command — serves the output folder statically.
 *
 * @module docpensieve/commands/serve
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import { loadConfig } from '@docpensieve/core';
import { DocPensieveError } from '@docpensieve/shared';

import { createStaticServer, listen } from '../server.js';

/** Default port of `serve`, distinct from that of `dev`. */
const DEFAULT_PORT = 4000;

/**
 * @param {{ port?: number, dir?: string, cwd?: string }} [options]
 * @returns {Promise<{ server: import('node:http').Server, port: number, url: string }>}
 * @throws {DocPensieveError} When the folder to serve does not exist.
 */
export async function serve(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd);
  const root = path.resolve(cwd, options.dir ?? config.outDir);

  if (!existsSync(root)) {
    throw new DocPensieveError(`Nothing to serve: ${root} does not exist.`, {
      hint: 'Run "docpensieve build" before "serve".',
    });
  }

  // The site is mounted under the configuration's baseUrl: otherwise the links
  // of the generated pages would not resolve locally.
  const server = createStaticServer({ root, basePath: config.baseUrl });
  const port = await listen(server, options.port ?? DEFAULT_PORT);
  const url = `http://localhost:${port}${config.baseUrl}`;

  console.log(`${root}`);
  console.log(`served at ${url}`);

  return { server, port, url };
}
