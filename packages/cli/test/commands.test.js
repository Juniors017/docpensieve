import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { DocPensieveError } from '@docpensieve/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { build, check, dev, serve, verifyLinks, verifyMarkup } from '../src/index.js';

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
