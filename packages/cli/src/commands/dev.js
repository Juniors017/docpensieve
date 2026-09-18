/**
 * `docpensieve dev` command — build, watch and reload.
 *
 * @module docpensieve/commands/dev
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  componentsCss,
  createRegistry,
  setSiteContext,
  setAdmonitionKinds,
} from '@docpensieve/components';
import { SiteGenerator, loadConfig } from '@docpensieve/core';
import { CONFIG_FILENAME, DocPensieveError, THEME_FOLDER } from '@docpensieve/shared';
import chokidar from 'chokidar';

import { RELOAD_PATH, createStaticServer, listen } from '../server.js';
import { createTheme } from '../theme.js';

/** Default port of `dev`, distinct from that of `serve`. */
const DEFAULT_PORT = 3000;

/** Delay for grouping file events, in milliseconds. */
const DEBOUNCE = 120;

/** How often a missing theme folder is looked for, in ms. */
const THEME_POLL = 1000;

/**
 * Reload script injected on the fly, never written to disk.
 *
 * The injection happens when serving the page, not when generating it: the
 * output of `build` stays free of any JavaScript, as the project requires.
 */
const RELOAD_SCRIPT =
  `<script>new EventSource(${JSON.stringify(RELOAD_PATH)})` +
  `.addEventListener("message",()=>location.reload())</script>`;

/**
 * @param {{ port?: number, cwd?: string }} [options]
 * @returns {Promise<{
 *   server: import('node:http').Server,
 *   watcher: import('chokidar').FSWatcher,
 *   port: number,
 *   url: string,
 *   close: () => Promise<void>,
 * }>}
 */
export async function dev(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd);
  const outDir = path.resolve(cwd, config.outDir);

  const rebuild = async () => {
    const started = Date.now();
    // The configuration is read again every time: changing it must show
    // without restarting the command.
    const current = await loadConfig(cwd);
    // Read again with the rest: a kind added to the configuration must show
    // without restarting the command.
    setAdmonitionKinds(current.admonitions);
    const generator = new SiteGenerator(current, {
      // `globalComponents: false` removes the shipped components: a project
      // that defines its own thus avoids a name collision. The option was
      // declared and documented, but nobody read it.
      components: current.globalComponents === false ? {} : createRegistry(),
      onPage: setSiteContext,
      theme: createTheme(current, await componentsCss()),
    });
    const result = await generator.buildAll();
    console.log(`${result.pages} page(s) in ${Date.now() - started} ms`);
  };

  await rebuild();

  /** @type {() => void} */
  let notify = () => {};
  const server = createStaticServer({
    root: outDir,
    basePath: config.baseUrl,
    inject: RELOAD_SCRIPT,
    onReload: (send) => {
      notify = send;
    },
  });

  const port = await listen(server, options.port ?? DEFAULT_PORT);
  const url = `http://localhost:${port}${config.baseUrl}`;
  console.log(`served at ${url}`);

  // The project's own stylesheets, re-read by every rebuild.
  const themeFolder = path.resolve(cwd, THEME_FOLDER);
  const watched = [
    config.configFile ?? path.resolve(cwd, CONFIG_FILENAME),
    ...config.versions.map((version) => path.resolve(cwd, version.folder)),
    ...(existsSync(themeFolder) ? [themeFolder] : []),
  ];
  const watcher = chokidar.watch(watched, { ignoreInitial: true });

  // Until chokidar has finished its inventory, `ignoreInitial` swallows the
  // events: a change made in the second after startup went unnoticed. Control
  // is only handed back once watching is active.
  await new Promise((resolve) => watcher.once('ready', () => resolve(undefined)));

  /** @type {NodeJS.Timeout | undefined} */
  let pending;
  /** @param {string} changed */
  const schedule = (changed) => {
    // An editor emits several events per save: group them.
    clearTimeout(pending);
    pending = setTimeout(async () => {
      console.log(`\n${path.relative(cwd, changed)} changed`);
      try {
        await rebuild();
        notify();
      } catch (error) {
        // A content error must not kill the watch: print it and wait for the
        // fix.
        if (error instanceof DocPensieveError) {
          console.error(error.message);
          if (error.hint) console.error(error.hint);
        } else {
          console.error(error);
        }
      }
    }, DEBOUNCE);
  };
  watcher.on('all', (_event, changed) => schedule(changed));

  // Handed a path that does not exist, chokidar loses the events of all the
  // others. A missing theme folder is therefore looked for every second, and
  // watched from the moment it appears — its creation itself triggers no
  // event, hence the rebuild asked for here.
  const lookForTheme = existsSync(themeFolder)
    ? undefined
    : setInterval(() => {
        if (!existsSync(themeFolder)) return;
        clearInterval(lookForTheme);
        watcher.add(themeFolder);
        schedule(themeFolder);
      }, THEME_POLL);
  lookForTheme?.unref();

  console.log('watching — Ctrl+C to stop');

  return {
    server,
    watcher,
    port,
    url,
    close: async () => {
      clearTimeout(pending);
      clearInterval(lookForTheme);
      await watcher.close();
      // Without this, close() waits for keep-alive connections to expire —
      // the reload stream keeps one open permanently.
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
