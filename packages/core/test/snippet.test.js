import path from 'node:path';

import { CompileError } from '@docpensieve/shared';
import { describe, expect, it } from 'vitest';

import { snippetLanguage, snippetLines, snippetPath } from '../src/snippet.js';

const ROOT = path.resolve('/project');
const PAGE = path.join(ROOT, 'docs', 'v1.0', '01-guide', 'page.md');

describe('the language of a snippet', () => {
  it('reads it from the extension', () => {
    expect(snippetLanguage('src/index.mjs')).toBe('javascript');
    expect(snippetLanguage('src/app.tsx')).toBe('tsx');
    expect(snippetLanguage('deploy.yml')).toBe('yaml');
  });

  it('passes an extension it does not know straight through', () => {
    // The highlighter knows far more languages than this table should repeat.
    expect(snippetLanguage('main.go')).toBe('go');
    expect(snippetLanguage('Main.JAVA')).toBe('java');
  });

  it('knows a file whose name is its type', () => {
    expect(snippetLanguage('Dockerfile')).toBe('docker');
  });

  it('falls back to plain text rather than failing', () => {
    // An extensionless file is not a reason to stop a build.
    expect(snippetLanguage('LICENSE')).toBe('text');
  });
});

describe('the file a snippet names', () => {
  it('reads a plain path from the root of the project', () => {
    // The same path means the same file from every page, which is what a
    // file of source code needs.
    expect(snippetPath('src/index.js', { rootDir: ROOT, filepath: PAGE })).toBe(
      path.join(ROOT, 'src', 'index.js'),
    );
  });

  it('reads a dotted path from the page, as a link does', () => {
    expect(snippetPath('./example.js', { rootDir: ROOT, filepath: PAGE })).toBe(
      path.join(ROOT, 'docs', 'v1.0', '01-guide', 'example.js'),
    );
    expect(snippetPath('../shared.js', { rootDir: ROOT, filepath: PAGE })).toBe(
      path.join(ROOT, 'docs', 'v1.0', 'shared.js'),
    );
  });

  it('refuses a file outside the project', () => {
    // A page is content, and content must not read the whole disk.
    try {
      snippetPath('../../../../etc/passwd', { rootDir: ROOT, filepath: PAGE });
      expect.unreachable('snippetPath should have thrown');
    } catch (error) {
      const failure = /** @type {CompileError} */ (error);
      expect(failure).toBeInstanceOf(CompileError);
      expect(failure.hint).toContain('a file of the project');
    }
  });

  it('refuses a dotted path when there is no page to start from', () => {
    try {
      snippetPath('./example.js', { rootDir: ROOT });
      expect.unreachable('snippetPath should have thrown');
    } catch (error) {
      const failure = /** @type {CompileError} */ (error);
      expect(failure).toBeInstanceOf(CompileError);
      expect(failure.hint).toContain('root of the project');
    }
  });

  it('refuses a snippet that names nothing', () => {
    expect(() => snippetPath('  ', { rootDir: ROOT })).toThrow(CompileError);
    // @ts-expect-error a snippet without a source is the case being checked
    expect(() => snippetPath(undefined, { rootDir: ROOT })).toThrow(CompileError);
  });
});

describe('the lines a snippet keeps', () => {
  const file = ['one', 'two', 'three', 'four', 'five'].join('\n');

  it('keeps the whole file when nothing is asked', () => {
    expect(snippetLines(file)).toBe(file);
    expect(snippetLines(file, { lines: '', region: '' })).toBe(file);
  });

  it('counts lines from one, as every editor does', () => {
    expect(snippetLines(file, { lines: '2-3' })).toBe('two\nthree');
    expect(snippetLines(file, { lines: '4' })).toBe('four');
    expect(snippetLines(file, { lines: '4-' })).toBe('four\nfive');
    expect(snippetLines(file, { lines: '-2' })).toBe('one\ntwo');
  });

  it('refuses a range that reads backwards, or none at all', () => {
    expect(() => snippetLines(file, { lines: '4-2' })).toThrow(CompileError);
    expect(() => snippetLines(file, { lines: 'top' })).toThrow(CompileError);
  });

  it('keeps a region, which follows the code when it moves', () => {
    // A range means line 12 of the file as it is today; a marker stays
    // attached to the lines it wraps, which is why it is the one to prefer.
    const source = [
      'function build() {',
      '  // #region guard',
      '  if (!input) throw new Error("no input");',
      '  return run(input);',
      '  // #endregion',
      '}',
    ].join('\n');

    expect(snippetLines(source, { region: 'guard' })).toBe(
      'if (!input) throw new Error("no input");\nreturn run(input);',
    );
  });

  it('removes the indentation the lines share', () => {
    // A region marked inside a function comes out indented by it: kept as is,
    // the block would read as if the code were nested in nothing.
    const source = ['    const a = 1;', '      const b = 2;', '', '    return a + b;'].join('\n');
    expect(snippetLines(source)).toBe('const a = 1;\n  const b = 2;\n\nreturn a + b;');
  });

  it('says which region is missing, and which is never closed', () => {
    const source = ['// #region open', 'const a = 1;'].join('\n');

    try {
      snippetLines(source, { region: 'absent', file: 'src/a.js' });
      expect.unreachable('snippetLines should have thrown');
    } catch (error) {
      const failure = /** @type {CompileError} */ (error);
      expect(failure.message).toContain('src/a.js');
      expect(failure.hint).toContain('#region absent');
    }

    expect(() => snippetLines(source, { region: 'open' })).toThrow(/never closed/);
  });

  it('takes a region name as a name, not as a pattern', () => {
    const source = ['// #region a.b', 'kept', '// #endregion'].join('\n');
    expect(snippetLines(source, { region: 'a.b' })).toBe('kept');
    expect(() => snippetLines(source, { region: 'axb' })).toThrow(CompileError);
  });
});
