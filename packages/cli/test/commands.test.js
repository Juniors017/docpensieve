import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SiteGenerator } from '@docpensieve/core';
import { DocPensieveError } from '@docpensieve/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { build, check, dev, serve, verifyLinks, verifyMarkup } from '../src/index.js';
import { RELOAD_PATH } from '../src/server.js';

/** @type {string[]} */
const dirs = [];
/** @type {(() => Promise<void>)[]} */
const teardown = [];

afterEach(async () => {
  for (const stop of teardown.splice(0)) await stop();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/**
 * Sets up a complete project, configuration included.
 *
 * @param {Record<string, string>} pages Paths relative to `docs/v1.0`.
 * @param {Record<string, any>} [config] Additional configuration fields.
 */
function project(pages, config = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'docpensieve-cmd-'));
  dirs.push(cwd);

  for (const [relative, contents] of Object.entries(pages)) {
    const full = path.join(cwd, 'docs', 'v1.0', relative);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents, 'utf8');
  }

  // An object literal rather than defineConfig: a temporary folder does not
  // resolve @docpensieve/core.
  writeFileSync(
    path.join(cwd, 'docpensieve.config.js'),
    `export default ${JSON.stringify({
      projectName: 'My docs',
      outDir: 'dist',
      versions: [{ slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true }],
      ...config,
    })};`,
    'utf8',
  );

  return cwd;
}

/** @param {string} title @param {string} [body] */
const page = (title, body = 'Content.') => `---\ntitle: ${title}\n---\n\n${body}\n`;

/**
 * Waits for a condition to come true, without sleeping longer than needed.
 * @param {() => unknown | Promise<unknown>} predicate
 * @param {{ timeout?: number, interval?: number }} [options]
 */
async function until(predicate, { timeout = 15_000, interval = 50 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('condition not met within the delay');
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// Generous timeout on everything that generates: the first build of a process
// loads the Shiki grammars (~4 s), and coverage instrumentation adds its share.
// The cost is paid once, not per page.
const BUILD_TIMEOUT = 40_000;

describe('build', () => {
  it(
    'generates the site in the configured folder',
    async () => {
      const cwd = project({ 'index.md': page('Home') });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await build(undefined, { cwd });

      const html = readFileSync(path.join(cwd, 'dist', 'versions', 'v1.0', 'index.html'), 'utf8');
      expect(html).toContain('<title>Home · My docs</title>');
    },
    BUILD_TIMEOUT,
  );

  it('generates a single version when it is named', async () => {
    const cwd = project({ 'index.md': page('Home') });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await build('v1.0', { cwd });

    expect(
      readFileSync(path.join(cwd, 'dist', 'versions', 'v1.0', 'index.html'), 'utf8'),
    ).toContain('Home');
  });

  it('reports an unknown version', async () => {
    const cwd = project({ 'index.md': page('Home') });
    await expect(build('v9.9', { cwd })).rejects.toThrow(/Unknown version/);
  });
});

describe('the theme folder', () => {
  it(
    'appends its stylesheets after the components, in name order',
    async () => {
      const cwd = project({ 'index.md': page('Home') }, { theme: { framework: 'custom' } });
      mkdirSync(path.join(cwd, 'theme'));
      writeFileSync(path.join(cwd, 'theme', 'b.css'), '.second-sheet { color: red; }', 'utf8');
      writeFileSync(path.join(cwd, 'theme', 'a.css'), '.first-sheet { color: blue; }', 'utf8');
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await build(undefined, { cwd });

      const css = readFileSync(
        path.join(cwd, 'dist', 'versions', 'v1.0', 'assets', 'docpensieve.css'),
        'utf8',
      );
      const [components, first, second] = ['.dp-card', '.first-sheet', '.second-sheet'].map(
        (selector) => css.indexOf(selector),
      );
      expect(components).toBeGreaterThan(-1);
      expect(first).toBeGreaterThan(components);
      expect(second).toBeGreaterThan(first);
    },
    BUILD_TIMEOUT,
  );

  it(
    'is picked up by dev, even when created after it started',
    async () => {
      const cwd = project({ 'index.md': page('Home') }, { theme: { framework: 'custom' } });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const session = await dev({ cwd, port: 0 });
      teardown.push(session.close);

      mkdirSync(path.join(cwd, 'theme'));
      writeFileSync(path.join(cwd, 'theme', 'custom.css'), '.added-later { color: red; }', 'utf8');

      const url = `http://localhost:${session.port}/versions/v1.0/assets/docpensieve.css`;
      const css = await until(async () => {
        const text = await (await fetch(url)).text();
        return text.includes('.added-later') ? text : null;
      });
      expect(css).toContain('.added-later');
    },
    BUILD_TIMEOUT,
  );
});

describe('serve', () => {
  it('refuses to serve a missing folder', async () => {
    const cwd = project({ 'index.md': page('Home') });

    try {
      await serve({ cwd, port: 0 });
      expect.unreachable('serve should have thrown');
    } catch (error) {
      const failure = /** @type {DocPensieveError} */ (error);
      expect(failure).toBeInstanceOf(DocPensieveError);
      expect(failure.hint).toContain('build');
    }
  });

  it(
    'serves the generated site under its baseUrl',
    async () => {
      const cwd = project({ 'index.md': page('Home') }, { baseUrl: '/docs' });
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await build(undefined, { cwd });

      const { server, port } = await serve({ cwd, port: 0 });
      teardown.push(async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      });

      const response = await fetch(`http://localhost:${port}/docs/versions/v1.0/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('Home');
    },
    BUILD_TIMEOUT,
  );

  it('serves the folder it is told, from the current project, and says when it is exposed', async () => {
    const cwd = project({ 'index.md': page('Home') });
    mkdirSync(path.join(cwd, 'elsewhere'));
    writeFileSync(path.join(cwd, 'elsewhere', 'index.html'), '<p>Elsewhere</p>', 'utf8');
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);

    const { server, port } = await serve({ port: 0, host: '0.0.0.0', dir: 'elsewhere' });
    teardown.push(async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    });

    // Bound to IPv4 only: named by its address rather than "localhost", which
    // may resolve to IPv6 first.
    expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toContain('Elsewhere');
    expect(logs.mock.calls.flat().join('\n')).toContain('anyone on this network');
  });
});

describe('dev', () => {
  it(
    'generates then serves, and rebuilds on change',
    async () => {
      const cwd = project({ 'index.md': page('Before') });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const session = await dev({ cwd, port: 0 });
      teardown.push(session.close);

      const url = `http://localhost:${session.port}/versions/v1.0/`;
      expect(await (await fetch(url)).text()).toContain('Before');

      writeFileSync(path.join(cwd, 'docs', 'v1.0', 'index.md'), page('After'), 'utf8');

      const html = await until(async () => {
        const text = await (await fetch(url)).text();
        return text.includes('After') ? text : null;
      });
      expect(html).toContain('After');
    },
    BUILD_TIMEOUT,
  );

  it(
    'injects the reload script without touching the generated file',
    async () => {
      const cwd = project({ 'index.md': page('Home') });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const session = await dev({ cwd, port: 0 });
      teardown.push(session.close);

      const served = await (await fetch(`http://localhost:${session.port}/versions/v1.0/`)).text();
      expect(served).toContain('EventSource');

      // The injection happens when serving: the build output must stay free
      // of JavaScript.
      const written = readFileSync(
        path.join(cwd, 'dist', 'versions', 'v1.0', 'index.html'),
        'utf8',
      );
      expect(written).not.toContain('EventSource');
    },
    BUILD_TIMEOUT,
  );

  it(
    'survives a content error and recovers on the fix',
    async () => {
      const cwd = project({ 'index.md': page('Home') });
      const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

      const session = await dev({ cwd, port: 0 });
      teardown.push(session.close);

      const source = path.join(cwd, 'docs', 'v1.0', 'index.md');
      writeFileSync(source, `---\ntitle: Broken\n---\n\n<Bad attr={ >\n`, 'utf8');
      await until(() => errors.mock.calls.length > 0);

      // The watch must hold: a typo does not kill the server.
      logs.mockClear();
      writeFileSync(source, page('Fixed'), 'utf8');

      const html = await until(async () => {
        const text = await (await fetch(`http://localhost:${session.port}/versions/v1.0/`)).text();
        return text.includes('Fixed') ? text : null;
      });
      expect(html).toContain('Fixed');
    },
    BUILD_TIMEOUT,
  );

  it(
    'tells the open pages to reload once a rebuild is written',
    async () => {
      // The stream itself is tested with the server; this is the wiring. Were
      // dev to stop calling it after a rebuild, the pages would go stale while
      // every other test stayed green.
      const cwd = project({ 'index.md': page('Home') });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const session = await dev({ cwd, port: 0 });
      teardown.push(session.close);

      const stream = await fetch(`http://localhost:${session.port}${RELOAD_PATH}`);
      const reader = /** @type {ReadableStream<Uint8Array>} */ (stream.body).getReader();
      writeFileSync(path.join(cwd, 'docs', 'v1.0', 'index.md'), page('Changed'), 'utf8');

      let received = '';
      while (!received.includes('data:')) {
        const { value, done } = await reader.read();
        if (done) break;
        received += new TextDecoder().decode(value);
      }
      expect(received).toContain('data: reload');
      await reader.cancel();
    },
    BUILD_TIMEOUT,
  );

  it(
    'prints an unexpected failure whole, and a known one without a hint it lacks',
    async () => {
      const cwd = project({ 'index.md': page('Home') });
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

      const session = await dev({ cwd, port: 0 });
      teardown.push(session.close);
      const source = path.join(cwd, 'docs', 'v1.0', 'index.md');

      // What the tool did not expect keeps its stack: it is a bug to report,
      // not a message for the author of the pages.
      const failure = new Error('disk full');
      const buildAll = vi.spyOn(SiteGenerator.prototype, 'buildAll').mockRejectedValueOnce(failure);
      writeFileSync(source, page('One'), 'utf8');
      await until(() => errors.mock.calls.some(([first]) => first === failure));

      buildAll.mockRejectedValueOnce(new DocPensieveError('Known, nothing to add.'));
      writeFileSync(source, page('Two'), 'utf8');
      await until(() => errors.mock.calls.some(([first]) => first === 'Known, nothing to add.'));
      // No hint: nothing printed under the message, not even "undefined".
      expect(errors.mock.calls.flat()).not.toContain(undefined);
    },
    BUILD_TIMEOUT,
  );

  it(
    'watches a theme folder that exists from the start',
    async () => {
      const cwd = project({ 'index.md': page('Home') }, { theme: { framework: 'custom' } });
      mkdirSync(path.join(cwd, 'theme'));
      writeFileSync(path.join(cwd, 'theme', 'site.css'), '.first-rule { color: red; }', 'utf8');
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const session = await dev({ cwd, port: 0 });
      teardown.push(session.close);

      writeFileSync(path.join(cwd, 'theme', 'site.css'), '.second-rule { color: red; }', 'utf8');
      const url = `http://localhost:${session.port}/versions/v1.0/assets/docpensieve.css`;
      const css = await until(async () => {
        const text = await (await fetch(url)).text();
        return text.includes('.second-rule') ? text : null;
      });
      expect(css).not.toContain('.first-rule');
    },
    BUILD_TIMEOUT,
  );

  it(
    'says so when it listens beyond this machine',
    async () => {
      const cwd = project({ 'index.md': page('Home') });
      const logs = vi.spyOn(console, 'log').mockImplementation(() => {});

      const session = await dev({ cwd, port: 0, host: '0.0.0.0' });
      teardown.push(session.close);

      expect(logs.mock.calls.flat().join('\n')).toContain('anyone on this network');
    },
    BUILD_TIMEOUT,
  );

  it('reads the project of the current folder, and honours globalComponents as build does', async () => {
    const cwd = project(
      { 'index.mdx': `${page('Home')}\n<Card>\n  <CardBody>x</CardBody>\n</Card>\n` },
      { globalComponents: false },
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);

    // Without the shipped components, Card is a name nobody defined: the
    // first build stops, before anything listens.
    await expect(dev({ port: 0 })).rejects.toThrow(/Card/);
  });
});

describe('globalComponents', () => {
  it('removes the shipped components when the configuration asks for it', async () => {
    // The option was declared, written by init and documented, but nobody
    // read it: setting it to false changed nothing.
    const cwd = project(
      {
        'index.mdx': `${page('Home')}
<Card>
  <CardBody>x</CardBody>
</Card>
`,
      },
      { globalComponents: false },
    );
    await expect(build(undefined, { cwd })).rejects.toThrow();
  });

  it('keeps them by default', async () => {
    const cwd = project({
      'index.mdx': `${page('Home')}
<Card>
  <CardBody>x</CardBody>
</Card>
`,
    });
    await build(undefined, { cwd });
    expect(
      readFileSync(path.join(cwd, 'dist', 'versions', 'v1.0', 'index.html'), 'utf8'),
    ).toContain('dp-card');
  });
});

describe('check', () => {
  /**
   * Writes an already generated site, without going through generation.
   *
   * @param {Record<string, string>} files Paths relative to `dist`.
   * @param {Record<string, any>} [config]
   * @returns {string} The project folder.
   */
  function builtSite(files, config = {}) {
    const cwd = project({ 'index.md': '# x' }, config);
    for (const [relative, contents] of Object.entries(files)) {
      const full = path.join(cwd, 'dist', relative);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, contents, 'utf8');
    }
    return cwd;
  }

  it('reports nothing when everything leads somewhere', async () => {
    const cwd = builtSite({
      'index.html': '<a href="/guide/">see</a>',
      'guide/index.html': 'ok',
    });
    const { faults, pages } = await check({ cwd });
    expect(faults).toEqual([]);
    expect(pages).toBe(2);
  });

  it('spots a target that leads to no file', async () => {
    const cwd = builtSite({ 'index.html': '<a href="/missing/">see</a>' });
    await expect(check({ cwd })).rejects.toThrow(DocPensieveError);
  });

  it('spots a target that ignores the deployment prefix', async () => {
    // It is the symptom of a URL that escaped resolution: the file exists, but
    // the link will lead nowhere once online.
    const cwd = builtSite(
      { 'index.html': '<a href="/guide/">see</a>', 'guide/index.html': 'ok' },
      { siteUrl: 'https://example.com/docs' },
    );
    const { faults } = await verifyLinks(path.join(cwd, 'dist'), '/docs/');
    expect(faults).toHaveLength(1);
    expect(faults[0].reason).toContain('prefix');
  });

  it('does not mistake a compound attribute for a target', async () => {
    // `data-src` ends with `src`: without care, the target would be collected
    // and reported dead, although the browser will never fetch it.
    const cwd = builtSite({ 'index.html': '<a data-src="/nowhere/" href="/">x</a>' });
    const { faults } = await check({ cwd });
    expect(faults).toEqual([]);
  });

  it('leaves alone what is none of its business', async () => {
    const cwd = builtSite({
      'index.html':
        '<a href="https://example.com">a</a><a href="#s">b</a>' +
        '<a href="mailto:q@e.com">c</a><meta content="width=device-width" />',
    });
    const { faults } = await check({ cwd });
    expect(faults).toEqual([]);
  });

  it('accepts both spellings of a page', async () => {
    // Depending on the host, /guide and /guide/ designate the same file.
    const cwd = builtSite({
      'index.html': '<a href="/guide">without</a><a href="/guide/">with</a>',
      'guide/index.html': 'ok',
    });
    const { faults } = await check({ cwd });
    expect(faults).toEqual([]);
  });

  it('reports a recurring target only once', async () => {
    // The menu and the breadcrumb repeat the same links on every page.
    const cwd = builtSite({
      'index.html': '<a href="/missing/">a</a><a href="/missing/">b</a>',
    });
    const { faults } = await verifyLinks(path.join(cwd, 'dist'), '/');
    expect(faults).toHaveLength(1);
  });

  it('refuses to check a folder that does not exist', async () => {
    const cwd = project({ 'index.md': '# x' });
    await expect(check({ cwd })).rejects.toThrow(DocPensieveError);
  });
});

describe('check — markup', () => {
  /**
   * Writes a single HTML page into an already generated site.
   *
   * @param {string} html
   * @returns {string} The folder to check.
   */
  function onePage(html) {
    const cwd = project({ 'index.md': '# x' });
    const dist = path.join(cwd, 'dist');
    mkdirSync(dist, { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), html, 'utf8');
    return dist;
  }

  it('spots a paragraph nested in a paragraph', async () => {
    // The browser closes the first one by itself: the wrapper disappears, and
    // the intended layout with it, without a word.
    const { faults } = await verifyMarkup(onePage('<p class="flex"><p>Button</p></p>'));
    expect(faults).toHaveLength(1);
    expect(faults[0].reason).toContain('nested');
  });

  it('spots a paragraph inside an element that only accepts text', async () => {
    const { faults } = await verifyMarkup(onePage('<span><p>x</p></span>'));
    expect(faults).toHaveLength(1);
    expect(faults[0].reason).toContain('span');
  });

  it('reports nothing on valid markup', async () => {
    const { faults } = await verifyMarkup(
      onePage('<div><p>a</p><p>b</p></div><div><p>c <em>d</em></p></div>'),
    );
    expect(faults).toEqual([]);
  });

  it('is not fooled by void elements', async () => {
    // `<img>` and `<br>` do not close: stacking them would shift the stack and
    // show nestings everywhere.
    const { faults } = await verifyMarkup(
      onePage('<div><img src="/a.png" alt=""><p>a</p><br><p>b</p></div>'),
    );
    expect(faults).toEqual([]);
  });

  it('ignores the inside of a script', async () => {
    // The JSON-LD of a page can hold any text.
    const { faults } = await verifyMarkup(
      onePage('<p>a</p><script type="application/ld+json">{"x":"<p>not markup"}</script>'),
    );
    expect(faults).toEqual([]);
  });

  it('reports only once per page', async () => {
    const { faults } = await verifyMarkup(onePage('<p><p>a</p></p><p><p>b</p></p>'));
    expect(faults).toHaveLength(1);
  });

  it('fails the command just like a dead link', async () => {
    const cwd = project({ 'index.md': '# x' });
    const dist = path.join(cwd, 'dist');
    mkdirSync(dist, { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), '<span><p>x</p></span>', 'utf8');
    await expect(check({ cwd })).rejects.toThrow(DocPensieveError);
  });
});

describe('check — block elements', () => {
  /** @param {string} html */
  const site = (html) => {
    const dist = mkdtempSync(path.join(tmpdir(), 'docpensieve-block-'));
    dirs.push(dist);
    writeFileSync(path.join(dist, 'index.html'), html, 'utf8');
    return dist;
  };

  it('spots a heading shut inside a paragraph', async () => {
    // The browser closes the paragraph by itself: the heading escapes it, and
    // the text that followed ends up bare.
    const { faults } = await verifyMarkup(site('<p><h3>Title</h3> text</p>'));
    expect(faults).toHaveLength(1);
    expect(faults[0].reason).toContain('block');
  });

  it('leaves alone a block outside a paragraph', async () => {
    const { faults } = await verifyMarkup(site('<div><h3>Title</h3><p>text</p></div>'));
    expect(faults).toEqual([]);
  });
});
