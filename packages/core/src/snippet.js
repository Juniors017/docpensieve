/**
 * Reading a snippet: which file, which language, which lines of it.
 *
 * An example written by hand goes stale the day the code changes, and nothing
 * reports it — the page keeps showing something that once compiled. A snippet
 * names a real file of the project instead, read at generation: it cannot
 * drift, because there is no copy.
 *
 * No disk access here, as in `sidebar.js` and `authors.js`: the compiler
 * reads the file, this module says which one and what to keep of it. That is
 * what makes these rules testable without a tree of fixtures.
 *
 * @module @docpensieve/core/snippet
 */

import path from 'node:path';

import { CompileError } from '@docpensieve/shared';

/**
 * Languages an extension announces, where the extension is not the name Shiki
 * knows. Anything absent is passed on as it is written: Shiki knows far more
 * languages than this table needs to repeat.
 *
 * @type {Record<string, string>}
 */
export const SNIPPET_LANGUAGES = Object.freeze({
  cjs: 'javascript',
  mjs: 'javascript',
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  mts: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  mdx: 'mdx',
  hbs: 'handlebars',
  htm: 'html',
  ps1: 'powershell',
  kt: 'kotlin',
  Dockerfile: 'docker',
});

/**
 * Language of a file, from its name.
 *
 * @param {string} file Path or name of the file.
 * @returns {string} A language for the highlighter, or `'text'` when the name
 *   says nothing — an extensionless file is not a reason to fail.
 */
export function snippetLanguage(file) {
  const base = path.basename(file);
  const extension = path.extname(base).slice(1);

  // A name with no extension can still be a known file: Dockerfile, Makefile.
  if (extension === '') return SNIPPET_LANGUAGES[base] ?? 'text';
  return SNIPPET_LANGUAGES[extension] ?? extension.toLowerCase();
}

/**
 * The file a snippet names, as an absolute path.
 *
 * Two ways to write it, and they read differently on purpose: `./` and `../`
 * start from the page, as a link does, while anything else starts from the
 * root of the project — `src/index.js` means the same thing from every page,
 * which is what a file of source code needs.
 *
 * @param {string} source What the page wrote.
 * @param {{ filepath?: string, rootDir?: string }} context Page being
 *   compiled, and root of the project.
 * @returns {string} Absolute path of the file to read.
 * @throws {CompileError} Empty source, a relative path with no page to start
 *   from, or a file outside the project.
 */
export function snippetPath(source, { filepath, rootDir } = {}) {
  const written = String(source ?? '').trim();
  if (written === '') {
    throw new CompileError('A snippet names no file.', {
      hint: 'Write source="src/index.js", from the root of the project, or source="./example.js", from the page.',
    });
  }

  const root = path.resolve(rootDir ?? process.cwd());
  const relativeToPage = written.startsWith('./') || written.startsWith('../');

  if (relativeToPage && !filepath) {
    throw new CompileError(`The snippet "${written}" starts from the page, and there is none.`, {
      hint: 'Name the file from the root of the project instead: source="src/index.js".',
    });
  }

  const resolved = relativeToPage
    ? path.resolve(path.dirname(filepath ?? ''), written)
    : path.resolve(root, written);

  // A page is content, and content should not be able to read the whole disk.
  // The check is on the resolved path, so that "../../.." is caught wherever
  // it was written.
  const inside = path.relative(root, resolved);
  if (inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new CompileError(`The snippet "${written}" leads outside the project.`, {
      hint: 'A snippet reads a file of the project. Move the file into it, or copy the lines into the page.',
    });
  }

  return resolved;
}

/**
 * The lines a snippet keeps, of the whole file.
 *
 * A range is quick to write and ages badly: it means line 12 of the file as
 * it is today. A region is a marker left in the source itself — the comment
 * convention editors already fold on — and it follows the code when it moves,
 * which is the whole point of naming a file rather than copying it.
 *
 * @param {string} text Content of the file.
 * @param {{ lines?: string, region?: string, file?: string }} [what] `lines`
 *   is `12`, `12-40`, `12-` or `-40`; `region` is the name marked in the file.
 * @returns {string} The lines kept, their common indentation removed.
 * @throws {CompileError} A range that reads backwards, or a region no marker
 *   opens or closes.
 */
export function snippetLines(text, what = {}) {
  const all = String(text).split('\n');
  const { lines, region, file = 'the file' } = what;

  let kept = all;
  if (region !== undefined && String(region).trim() !== '') {
    kept = regionOf(all, String(region).trim(), file);
  } else if (lines !== undefined && String(lines).trim() !== '') {
    kept = rangeOf(all, String(lines).trim(), file);
  }

  return dedent(kept).join('\n').replace(/\s+$/, '');
}

/**
 * @param {string[]} all
 * @param {string} range
 * @param {string} file
 * @returns {string[]}
 */
function rangeOf(all, range, file) {
  const match = /^(\d*)\s*-?\s*(\d*)$/.exec(range);
  const hasDash = range.includes('-');
  if (!match || (match[1] === '' && match[2] === '')) {
    throw new CompileError(`"${range}" is not a range of lines, in ${file}.`, {
      hint: 'Write lines="12", lines="12-40", lines="12-" or lines="-40".',
    });
  }

  const from = match[1] === '' ? 1 : Number(match[1]);
  const to = match[2] === '' ? (hasDash ? all.length : from) : Number(match[2]);

  if (to < from) {
    throw new CompileError(`The range "${range}" reads backwards, in ${file}.`, {
      hint: 'The first number is the first line kept, the second the last one.',
    });
  }

  // Lines are counted from one, as every editor and every error message does.
  return all.slice(from - 1, to);
}

/**
 * @param {string[]} all
 * @param {string} name
 * @param {string} file
 * @returns {string[]}
 */
function regionOf(all, name, file) {
  // The marker is looked for in a comment of any language: what matters is
  // the word and the name, not the syntax around them.
  const opens = new RegExp(`#region\\s+${escapeForSearch(name)}\\s*$`);
  const closes = /#endregion\b/;

  const start = all.findIndex((line) => opens.test(line));
  if (start === -1) {
    throw new CompileError(`No region "${name}" in ${file}.`, {
      hint: `Mark it in the file itself: a comment holding "#region ${name}", and another holding "#endregion".`,
    });
  }

  const end = all.findIndex((line, index) => index > start && closes.test(line));
  if (end === -1) {
    throw new CompileError(`The region "${name}" of ${file} is never closed.`, {
      hint: 'Add a comment holding "#endregion" after the lines to show.',
    });
  }

  return all.slice(start + 1, end);
}

/**
 * @param {string} value
 * @returns {string} The value, safe to put in a pattern.
 */
function escapeForSearch(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Removes the indentation the lines share.
 *
 * A region marked inside a function comes out indented by its function: kept
 * as it is, the block reads as if the code were nested in nothing.
 *
 * @param {string[]} lines
 * @returns {string[]}
 */
function dedent(lines) {
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => /^[ \t]*/.exec(line)?.[0].length ?? 0);
  const common = indents.length > 0 ? Math.min(...indents) : 0;

  return common === 0 ? lines : lines.map((line) => line.slice(common));
}
