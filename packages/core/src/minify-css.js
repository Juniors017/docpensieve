/**
 * Minification of the produced stylesheet.
 *
 * Deliberately cautious: comments go, and so does the whitespace that nothing
 * reads — indentation, line breaks, the space around `{`, `}` and `;`. Every
 * other space stays one space, since some carry meaning (`.a :hover` is not
 * `.a:hover`), and the content of a string is never touched. That keeps most
 * of the gain of a real minifier without its risk of changing what a rule
 * means.
 *
 * @module @docpensieve/core/minify-css
 */

/** Characters around which no space is ever needed. */
const TIGHT = new Set(['{', '}', ';']);

/**
 * @param {string} css
 * @returns {string} The same rules, lighter.
 */
export function minifyCss(css) {
  let out = '';
  let space = false;
  let i = 0;

  while (i < css.length) {
    const char = css[i];

    // A string is copied as is, escapes included.
    if (char === '"' || char === "'") {
      let end = i + 1;
      while (end < css.length && css[end] !== char) end += css[end] === '\\' ? 2 : 1;
      if (space && out && !TIGHT.has(out[out.length - 1])) out += ' ';
      space = false;
      out += css.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    // A comment weighs its length and says nothing to the browser.
    if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 2;
      space = true;
      continue;
    }

    if (char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f') {
      space = true;
      i += 1;
      continue;
    }

    if (TIGHT.has(char)) {
      // The last declaration of a block needs no semicolon.
      if (char === '}' && out.endsWith(';')) out = out.slice(0, -1);
      out += char;
      space = false;
      i += 1;
      continue;
    }

    if (space && out && !TIGHT.has(out[out.length - 1])) out += ' ';
    space = false;
    out += char;
    i += 1;
  }

  return out;
}
