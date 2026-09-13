/**
 * Static HTTP server shared by the `serve` and `dev` commands.
 *
 * @module docpensieve/server
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

import { DocPensieveError } from '@docpensieve/shared';

/**
 * MIME types of the files a documentation site produces.
 * @type {Record<string, string>}
 */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/** Path reserved for the reload stream of the development server. */
export const RELOAD_PATH = '/__docpensieve/reload';

/**
 * Resolves a request URL into a file path, without leaving the root.
 *
 * @param {string} pathname Request path, `basePath` already removed.
 * @param {string} root Served folder.
 * @returns {string | null} Absolute path, or `null` when the target escapes `root`.
 */
export function resolveRequestPath(pathname, root) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Invalid escape sequence: the request designates nothing.
    return null;
  }

  // A folder is served by its index page, like on any static host. A path
  // without an extension is treated the same way.
  const relative = decoded.replace(/^\/+/, '');
  const candidate =
    decoded.endsWith('/') || path.extname(relative) === ''
      ? path.join(relative, 'index.html')
      : relative;

  const resolved = path.resolve(root, candidate);

  // path.resolve absorbs the "..": check afterwards that the target is indeed
  // under the root, otherwise a "/../../etc/passwd" request would get out.
  const relativeToRoot = path.relative(root, resolved);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) return null;

  return resolved;
}

/**
 * Creates a static file server.
 *
 * @param {{
 *   root: string,
 *   basePath?: string,
 *   inject?: string | null,
 *   onReload?: (send: () => void) => void,
 * }} options
 *   `basePath` is the prefix under which the site is mounted: it must reflect
 *   the configuration's `baseUrl`, otherwise the links of the pages do not
 *   resolve locally. `inject` is an HTML fragment inserted before `</body>` —
 *   the development server uses it for its reload script, which leaves the
 *   generated output intact.
 * @returns {import('node:http').Server}
 */
export function createStaticServer({ root, basePath = '/', inject = null, onReload }) {
  /** @type {Set<import('node:http').ServerResponse>} */
  const listeners = new Set();

  if (onReload) {
    onReload(() => {
      for (const client of listeners) client.write('data: reload\n\n');
    });
  }

  return createServer(async (request, response) => {
    // `request.url` is optional in Node's signature: a malformed request must
    // not make `new URL` throw.
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (onReload && url.pathname === RELOAD_PATH) {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      response.write('\n');
      listeners.add(response);
      request.on('close', () => listeners.delete(response));
      return;
    }

    // The site is mounted under basePath: outside that prefix, redirect there
    // rather than answer 404 on the root, which is the URL one types first.
    if (basePath !== '/' && !url.pathname.startsWith(basePath)) {
      response.writeHead(302, { location: basePath });
      response.end();
      return;
    }

    const pathname = basePath === '/' ? url.pathname : url.pathname.slice(basePath.length - 1);
    const filepath = resolveRequestPath(pathname, root);

    if (!filepath) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('403 — path outside the served folder.');
      return;
    }

    let stats;
    try {
      stats = await stat(filepath);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`404 — ${url.pathname}`);
      return;
    }

    const type = MIME_TYPES[path.extname(filepath).toLowerCase()] ?? 'application/octet-stream';
    const headers = { 'content-type': type, 'cache-control': 'no-cache' };

    if (inject && type.startsWith('text/html')) {
      const { readFile } = await import('node:fs/promises');
      const html = await readFile(filepath, 'utf8');
      const body = html.includes('</body>')
        ? html.replace('</body>', `${inject}</body>`)
        : html + inject;
      response.writeHead(200, { ...headers, 'content-length': Buffer.byteLength(body) });
      response.end(body);
      return;
    }

    response.writeHead(200, { ...headers, 'content-length': stats.size });
    createReadStream(filepath).pipe(response);
  });
}

/**
 * Starts listening, looking for a free port if needed.
 *
 * @param {import('node:http').Server} server
 * @param {number} port Desired port.
 * @param {number} [attempts] Number of ports tried from `port` on.
 * @returns {Promise<number>} The port actually used.
 * @throws {DocPensieveError} When no port is free in the range.
 */
export function listen(server, port, attempts = 10) {
  return new Promise((resolve, reject) => {
    let current = port;

    /** @param {NodeJS.ErrnoException} error */
    const onError = (error) => {
      // A busy port is the common case when restarting a dev server: trying
      // the next one beats forcing --port.
      if (error.code === 'EADDRINUSE' && current < port + attempts - 1) {
        current += 1;
        server.listen(current);
        return;
      }
      server.off('error', onError);
      reject(
        new DocPensieveError(`Could not listen on port ${port}.`, {
          cause: error,
          hint: `No free port between ${port} and ${port + attempts - 1}. Use --port.`,
        }),
      );
    };

    server.on('error', onError);
    server.once('listening', () => {
      server.off('error', onError);
      // The effective port, not the requested one: with 0, the system assigns
      // a free one and the caller needs to know which. `address()` returns
      // `null` or a string for a pipe, a case that does not concern us.
      const address = server.address();
      resolve(typeof address === 'object' && address !== null ? address.port : current);
    });
    server.listen(current);
  });
}
