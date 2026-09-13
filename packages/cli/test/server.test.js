import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { DocPensieveError } from '@docpensieve/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { createStaticServer, listen, resolveRequestPath } from '../src/server.js';

/** @type {string[]} */
const dirs = [];
/** @type {import('node:http').Server[]} */
const servers = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    // close() alone waits for the client's keep-alive connections to expire:
    // three seconds per test, although the response has already arrived.
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** @param {Record<string, string>} files */
function siteDir(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'docpensieve-srv-'));
  dirs.push(root);
  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(root, relative);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents, 'utf8');
  }
  return root;
}

/**
 * Starts a server on an ephemeral port and returns its base URL.
 * @param {Parameters<typeof createStaticServer>[0]} options
 */
async function start(options) {
  const server = createStaticServer(options);
  servers.push(server);
  const port = await listen(server, 0);
  return `http://localhost:${port}`;
}

describe('resolveRequestPath', () => {
  const root = path.resolve('/site');

  it('serves a folder through its index page', () => {
    expect(resolveRequestPath('/', root)).toBe(path.join(root, 'index.html'));
    expect(resolveRequestPath('/guide/', root)).toBe(path.join(root, 'guide', 'index.html'));
  });

  it('treats a path without an extension as a folder', () => {
    expect(resolveRequestPath('/guide', root)).toBe(path.join(root, 'guide', 'index.html'));
  });

  it('serves a named file as is', () => {
    expect(resolveRequestPath('/assets/a.css', root)).toBe(path.join(root, 'assets', 'a.css'));
  });

  it('refuses any target outside the root', () => {
    // path.resolve absorbs the "..": without an after-the-fact check, these
    // requests would read arbitrary files of the machine.
    expect(resolveRequestPath('/../secret', root)).toBeNull();
    expect(resolveRequestPath('/a/../../../etc/passwd', root)).toBeNull();
    expect(resolveRequestPath('/%2e%2e/secret', root)).toBeNull();
    expect(resolveRequestPath('/..%2f..%2fsecret', root)).toBeNull();
  });

  it('refuses an invalid encoding', () => {
    expect(resolveRequestPath('/%ZZ', root)).toBeNull();
  });
});

describe('static server', () => {
  it('serves a page with its MIME type', async () => {
    const root = siteDir({ 'index.html': '<!doctype html><body>Hello</body>' });
    const base = await start({ root });

    const response = await fetch(`${base}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await response.text()).toContain('Hello');
  });

  it('serves deep pages', async () => {
    const root = siteDir({ 'guide/install/index.html': '<p>Installation</p>' });
    const base = await start({ root });

    expect(await (await fetch(`${base}/guide/install/`)).text()).toContain('Installation');
  });

  it('recognises the common types', async () => {
    const root = siteDir({ 'a.css': 'body{}', 'b.json': '{}', 'c.svg': '<svg/>' });
    const base = await start({ root });

    const type = async (/** @type {string} */ file) =>
      (await fetch(`${base}/${file}`)).headers.get('content-type');
    expect(await type('a.css')).toBe('text/css; charset=utf-8');
    expect(await type('b.json')).toBe('application/json; charset=utf-8');
    expect(await type('c.svg')).toBe('image/svg+xml');
  });

  it('answers 404 on a missing page', async () => {
    const root = siteDir({ 'index.html': 'x' });
    const base = await start({ root });

    expect((await fetch(`${base}/does-not-exist/`)).status).toBe(404);
  });

  it('answers 403 to an attempt to leave the served folder', async () => {
    const root = siteDir({ 'index.html': 'x' });
    const base = await start({ root });

    expect((await fetch(`${base}/..%2f..%2fpackage.json`)).status).toBe(403);
  });
});

describe('mounting under basePath', () => {
  it('serves the site under its prefix', async () => {
    const root = siteDir({ 'versions/v1.0/index.html': '<p>Version 1</p>' });
    const base = await start({ root, basePath: '/docs/' });

    const response = await fetch(`${base}/docs/versions/v1.0/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Version 1');
  });

  it('redirects from the root to the prefix', async () => {
    // It is the URL one types first: a 404 there would be confusing.
    const root = siteDir({ 'index.html': 'x' });
    const base = await start({ root, basePath: '/docs/' });

    const response = await fetch(`${base}/`, { redirect: 'manual' });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/docs/');
  });
});

describe('development injection', () => {
  it('inserts the fragment before the body closes', async () => {
    const root = siteDir({ 'index.html': '<!doctype html><body><p>Page</p></body></html>' });
    const base = await start({ root, inject: '<script>ok</script>' });

    const html = await (await fetch(`${base}/`)).text();
    expect(html).toContain('<p>Page</p><script>ok</script></body>');
  });

  it('leaves non-HTML files intact', async () => {
    const root = siteDir({ 'a.css': 'body{}' });
    const base = await start({ root, inject: '<script>ok</script>' });

    expect(await (await fetch(`${base}/a.css`)).text()).toBe('body{}');
  });

  it('exposes a reload stream when asked', async () => {
    const root = siteDir({ 'index.html': 'x' });
    // A starting value that fails: if the server never called `onReload`, the
    // test would say what is missing instead of going haywire.
    /** @type {() => void} */
    let notify = () => {
      throw new Error('onReload was never called.');
    };
    const base = await start({ root, onReload: (send) => (notify = send) });

    const response = await fetch(`${base}/__docpensieve/reload`);
    expect(response.headers.get('content-type')).toBe('text/event-stream');

    if (response.body === null)
      throw new Error('Expected a stream, got a response without a body.');
    const reader = response.body.getReader();
    await reader.read(); // the priming line
    notify();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain('reload');
    await reader.cancel();
  });
});

describe('listen', () => {
  it('returns the port actually assigned', async () => {
    const server = createStaticServer({ root: siteDir({ 'index.html': 'x' }) });
    servers.push(server);
    const port = await listen(server, 0);
    expect(port).toBeGreaterThan(0);
  });

  it('moves to the next port when the first one is busy', async () => {
    const root = siteDir({ 'index.html': 'x' });
    const first = createStaticServer({ root });
    servers.push(first);
    const busy = await listen(first, 0);

    const second = createStaticServer({ root });
    servers.push(second);
    expect(await listen(second, busy)).toBe(busy + 1);
  });

  it('gives up with advice when the range is full', async () => {
    const root = siteDir({ 'index.html': 'x' });
    const first = createStaticServer({ root });
    servers.push(first);
    const busy = await listen(first, 0);

    const second = createStaticServer({ root });
    servers.push(second);
    // A range of a single port, already taken: no way out.
    await expect(listen(second, busy, 1)).rejects.toThrow(DocPensieveError);
  });
});
