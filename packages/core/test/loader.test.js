import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { LoaderError } from '@docpensieve/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { DocLoader } from '../src/index.js';

/** @type {string[]} */
const created = [];

/**
 * Creates a throwaway file tree.
 * @param {Record<string, string>} files Relative path to contents.
 * @returns {string} Absolute root of the created folder.
 */
function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'docpensieve-loader-'));
  created.push(root);
  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(root, relative);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents, 'utf8');
  }
  return root;
}

/**
 * Shorthand for a file with a frontmatter.
 * @param {string} title
 * @param {string} [extra] Additional YAML lines.
 */
const page = (title, extra = '') =>
  `---\ntitle: ${title}\n${extra ? `${extra}\n` : ''}---\n\nContent of ${title}.\n`;

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('DocLoader.load', () => {
  it('produces a complete document', async () => {
    const root = fixture({ 'intro.md': page('Introduction') });
    const [doc] = await new DocLoader().load(root);

    expect(doc.slug).toBe('intro');
    expect(doc.url).toBe('/intro/');
    expect(doc.path).toBe(path.join(root, 'intro.md'));
    expect(doc.frontmatter.title).toBe('Introduction');
    expect(doc.content.trim()).toBe('Content of Introduction.');
    expect(doc.order).toBe(Infinity);
  });

  it('walks sub-folders', async () => {
    const root = fixture({
      'index.md': page('Home'),
      'guide/01-install.md': page('Installation'),
      'guide/advanced/notes.mdx': page('Notes'),
    });

    const slugs = (await new DocLoader().load(root)).map((doc) => doc.slug);
    expect(slugs).toEqual(['', 'guide/install', 'guide/advanced/notes']);
  });

  it('returns a URL without a version prefix', async () => {
    // The loader does not know the version: the generator prefixes.
    const root = fixture({ 'guide/install.md': page('Installation') });
    const [doc] = await new DocLoader().load(root);
    expect(doc.url).toBe('/guide/install/');
  });

  it('returns an empty list for a folder without documentation', async () => {
    const root = fixture({ 'readme.txt': 'not a page' });
    await expect(new DocLoader().load(root)).resolves.toEqual([]);
  });

  it('accepts a missing frontmatter', async () => {
    const root = fixture({ 'bare.md': '# Title only\n' });
    const [doc] = await new DocLoader().load(root);
    expect(doc.frontmatter).toEqual({});
    expect(doc.content).toContain('# Title only');
  });
});

describe('reading order', () => {
  it('puts the index first, then prefixes, then alphabetical', async () => {
    const root = fixture({
      'zebra.md': page('Zebra'),
      '02-second.md': page('Second'),
      'alpha.md': page('Alpha'),
      '01-first.md': page('First'),
      'index.md': page('Home'),
    });

    const slugs = (await new DocLoader().load(root)).map((doc) => doc.slug);
    expect(slugs).toEqual(['', 'first', 'second', 'alpha', 'zebra']);
  });

  it('sorts two unprefixed files alphabetically', async () => {
    // orderOf returns Infinity: a subtraction would give NaN and let the file
    // system order through.
    const root = fixture({ 'b.md': page('B'), 'a.md': page('A'), 'c.md': page('C') });
    const slugs = (await new DocLoader().load(root)).map((doc) => doc.slug);
    expect(slugs).toEqual(['a', 'b', 'c']);
  });

  it('orders folders and files by the same prefix', async () => {
    const root = fixture({
      '02-after.md': page('After'),
      '01-before/page.md': page('Page'),
    });
    const slugs = (await new DocLoader().load(root)).map((doc) => doc.slug);
    expect(slugs).toEqual(['before/page', 'after']);
  });

  it('exposes the weight in the order field', async () => {
    const root = fixture({ '03-late.md': page('Late'), 'none.md': page('None') });
    const docs = await new DocLoader().load(root);
    expect(docs.map((doc) => doc.order)).toEqual([3, Infinity]);
  });

  it('handles accents in file names', async () => {
    const root = fixture({ 'café guide/01-première étape.md': page('Première étape') });
    const [doc] = await new DocLoader().load(root);
    expect(doc.slug).toBe('cafe-guide/premiere-etape');
  });
});

describe('filtering', () => {
  it('excludes drafts by default', async () => {
    const root = fixture({
      'published.md': page('Published'),
      'draft.md': page('Draft', 'draft: true'),
    });
    const slugs = (await new DocLoader().load(root)).map((doc) => doc.slug);
    expect(slugs).toEqual(['published']);
  });

  it('keeps drafts on request', async () => {
    const root = fixture({
      'published.md': page('Published'),
      'draft.md': page('Draft', 'draft: true'),
    });
    const docs = await new DocLoader({ includeDrafts: true }).load(root);
    expect(docs.map((doc) => doc.slug).sort()).toEqual(['draft', 'published']);
  });

  it('does not mistake draft: false for a draft', async () => {
    const root = fixture({ 'page.md': page('Page', 'draft: false') });
    await expect(new DocLoader().load(root)).resolves.toHaveLength(1);
  });

  it('ignores files whose extension is not handled', async () => {
    const root = fixture({
      'page.md': page('Page'),
      'image.png': 'binary',
      'notes.txt': 'text',
    });
    const slugs = (await new DocLoader().load(root)).map((doc) => doc.slug);
    expect(slugs).toEqual(['page']);
  });

  it('honours a custom list of extensions', async () => {
    const root = fixture({ 'a.md': page('A'), 'b.mdx': page('B') });
    const docs = await new DocLoader({ extensions: ['.mdx'] }).load(root);
    expect(docs.map((doc) => doc.slug)).toEqual(['b']);
  });

  it('never goes down into node_modules, dist or coverage', async () => {
    // Without this safety net, a "folder" mistakenly pointing at the project
    // root would load thousands of dependency files.
    const root = fixture({
      'page.md': page('Page'),
      'node_modules/package/readme.md': page('Dependency'),
      'dist/v1.0/output.md': page('Output'),
      'coverage/report.md': page('Report'),
    });
    const slugs = (await new DocLoader().load(root)).map((doc) => doc.slug);
    expect(slugs).toEqual(['page']);
  });

  it('ignores hidden files and folders', async () => {
    const root = fixture({
      'page.md': page('Page'),
      '.cache/internal.md': page('Internal'),
      '.draft.md': page('Hidden'),
    });
    const slugs = (await new DocLoader().load(root)).map((doc) => doc.slug);
    expect(slugs).toEqual(['page']);
  });
});

describe('errors', () => {
  it('reports a missing folder and points to the config', async () => {
    const missing = path.join(tmpdir(), 'docpensieve-missing-42');
    await expect(new DocLoader().load(missing)).rejects.toThrow(LoaderError);

    try {
      await new DocLoader().load(missing);
      expect.unreachable('load should have thrown');
    } catch (error) {
      const failure = /** @type {Error & { hint?: string }} */ (error);
      expect(failure.message).toMatch(/not found/);
      expect(failure.hint).toMatch(/docpensieve\.config\.js/);
    }
  });

  it('refuses a path that points to a file', async () => {
    const root = fixture({ 'page.md': page('Page') });
    await expect(new DocLoader().load(path.join(root, 'page.md'))).rejects.toThrow(
      /is not a folder/,
    );
  });

  it('names the file whose frontmatter is invalid', async () => {
    const root = fixture({ 'broken.md': '---\ntitle: [1, 2\n---\n\nContent.\n' });

    try {
      await new DocLoader().load(root);
      expect.unreachable('load should have thrown');
    } catch (error) {
      const failure = /** @type {LoaderError} */ (error);
      expect(failure).toBeInstanceOf(LoaderError);
      expect(failure.message).toMatch(/broken\.md/);
      expect(failure.hint).toBeTruthy();
    }
  });

  it('refuses two files that produce the same slug', async () => {
    const root = fixture({
      'guide.md': page('Guide'),
      'guide/index.md': page('Guide index'),
    });

    try {
      await new DocLoader().load(root);
      expect.unreachable('load should have thrown');
    } catch (error) {
      const failure = /** @type {LoaderError} */ (error);
      expect(failure).toBeInstanceOf(LoaderError);
      expect(failure.message).toMatch(/same slug/);
      // The hint must name both culprits, otherwise it is useless.
      expect(failure.hint).toMatch(/guide\.md/);
      expect(failure.hint).toMatch(/index\.md/);
    }
  });

  it('declares no collision when the duplicate is an excluded draft', async () => {
    const root = fixture({
      'guide.md': page('Guide'),
      'guide/index.md': page('Guide index', 'draft: true'),
    });
    await expect(new DocLoader().load(root)).resolves.toHaveLength(1);
  });
});
