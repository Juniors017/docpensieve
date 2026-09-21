/// <reference lib="dom" />
/**
 * Copying a block of code, in the reader's browser.
 *
 * The first behaviour to ride the client file a version may carry (ADR-021).
 * It is added to the page rather than needed by it: without this script the
 * code is still there, still selectable, and the page reads exactly the same
 * — the button is what is missing, and it is never drawn until the script
 * that makes it work has run.
 *
 * Plain DOM, no runtime: a button on a block of text does not need a
 * framework, and the relaxed rule says progressive enhancement first.
 */

/**
 * Wording of the button, by language. Read from the document rather than
 * built in: a French page must not grow an English button.
 *
 * @type {Record<string, { copy: string, copied: string }>}
 */
const WORDS = {
  en: { copy: 'Copy', copied: 'Copied' },
  fr: { copy: 'Copier', copied: 'Copié' },
};

/**
 * The wording a page asks for.
 *
 * @param {string} lang Language of the document.
 * @returns {{ copy: string, copied: string }}
 */
export function wordsFor(lang) {
  const code = String(lang || 'en').toLowerCase();
  return WORDS[code] ?? WORDS[code.split('-')[0]] ?? WORDS.en;
}

/**
 * The text a block of code holds.
 *
 * Taken from the element rather than from the highlighted markup: the
 * highlighter wraps every token in a span, and reading those would copy the
 * colours along with the code.
 *
 * @param {{ innerText?: string, textContent?: string | null }} block
 * @returns {string}
 */
export function codeOf(block) {
  return String(block.innerText ?? block.textContent ?? '').replace(/\s+$/, '');
}

/**
 * Gives every block of code a button that copies it.
 *
 * @param {Document} doc
 */
export function addCopyButtons(doc) {
  const words = wordsFor(doc.documentElement.lang);

  for (const pre of doc.querySelectorAll('pre')) {
    const code = pre.querySelector('code') ?? pre;
    // A block already fitted is left alone: the page may be rebuilt under a
    // reader who never reloaded it.
    if (pre.querySelector('.dp-copy')) continue;

    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'dp-copy';
    button.textContent = words.copy;
    // The label repeats what the button does, for a reader who meets it
    // without the block above.
    button.setAttribute('aria-label', words.copy);

    button.addEventListener('click', () => {
      const text = codeOf(/** @type {any} */ (code));
      const done = () => {
        button.textContent = words.copied;
        button.classList.add('dp-copy--done');
        setTimeout(() => {
          button.textContent = words.copy;
          button.classList.remove('dp-copy--done');
        }, 1600);
      };

      // Without the clipboard — an insecure origin, a refusal — the code is
      // selected instead, so that the reader is one keystroke from having it
      // rather than left with a button that does nothing.
      navigator.clipboard?.writeText(text).then(done, () => selectOnly(doc, code));
    });

    pre.classList.add('dp-has-copy');
    pre.appendChild(button);
  }
}

/**
 * Selects a block, as a fallback for a refused clipboard.
 *
 * @param {Document} doc
 * @param {Element} node
 */
function selectOnly(doc, node) {
  const range = doc.createRange();
  range.selectNodeContents(node);
  const selection = doc.defaultView?.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

// The page wiring runs only where there is a document, so that the functions
// above stay testable outside a browser — as the search script does.
if (typeof document !== 'undefined') addCopyButtons(document);
