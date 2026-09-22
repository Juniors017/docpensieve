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

/// <reference lib="dom" />
/**
 * Moving between the months of a calendar, in the reader's browser.
 *
 * Every month is in the page already, one after the other: that is a readable
 * calendar on its own, and it is what a reader without this script gets. The
 * script folds them into one and reveals the two arrows that move between
 * them — the controls are written hidden, so they never appear without the
 * code that makes them work.
 *
 * Plain DOM, no runtime: showing one of several elements does not need a
 * framework (ADR-021).
 */

/** Class the tool puts on the day that is today. */
const TODAY = 'dp-calendar-day--today';

/**
 * Today, as the calendar writes its days.
 *
 * Local rather than UTC: a reader in Auckland whose evening is still yesterday
 * in London should see their own day marked.
 *
 * @param {Date} [now]
 * @returns {string} `2026-10-14`.
 */
export function todayKey(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The month a calendar should open on.
 *
 * The one holding today when it is there — a calendar is usually read to
 * answer "what now" — and the first otherwise.
 *
 * @param {string[]} months Months of the calendar, in order.
 * @param {string} today
 * @returns {string}
 */
export function openingMonth(months, today) {
  const current = today.slice(0, 7);
  return months.includes(current) ? current : months[0];
}

/**
 * Folds a calendar to one month and wires its arrows.
 *
 * @param {Element} calendar
 * @param {string} today
 */
export function foldCalendar(calendar, today) {
  const months = Array.from(calendar.querySelectorAll('[data-month]'));
  // One month is already one month: folding it would only add two arrows
  // that lead nowhere.
  if (months.length < 2) {
    markToday(calendar, today);
    return;
  }

  const keys = months.map((month) => month.getAttribute('data-month') ?? '');
  const controls = calendar.querySelector('.dp-calendar-controls');
  const current = calendar.querySelector('.dp-calendar-current');
  let index = keys.indexOf(openingMonth(keys, today));

  const show = () => {
    months.forEach((month, at) => {
      if (at === index) month.removeAttribute('hidden');
      else month.setAttribute('hidden', '');
    });
    if (current) {
      const title = months[index].querySelector('.dp-calendar-title');
      current.textContent = title ? (title.textContent ?? '') : keys[index];
    }
    for (const button of calendar.querySelectorAll('.dp-calendar-step')) {
      const step = Number(button.getAttribute('data-step') ?? 0);
      const beyond = index + step < 0 || index + step >= months.length;
      // Disabled rather than removed: a control that disappears moves what is
      // under it, and the reader loses the place they were pointing at.
      if (beyond) button.setAttribute('disabled', '');
      else button.removeAttribute('disabled');
    }
  };

  for (const button of calendar.querySelectorAll('.dp-calendar-step')) {
    button.addEventListener('click', () => {
      const step = Number(button.getAttribute('data-step') ?? 0);
      const next = index + step;
      if (next < 0 || next >= months.length) return;
      index = next;
      show();
    });
  }

  if (controls) controls.removeAttribute('hidden');
  show();
  markToday(calendar, today);
}

/**
 * @param {Element} calendar
 * @param {string} today
 */
function markToday(calendar, today) {
  const cell = calendar.querySelector(`[data-date="${today}"]`);
  if (cell) cell.classList.add(TODAY);
}

// The page wiring runs only where there is a document, so that the functions
// above stay testable outside a browser — as the search script does.
if (typeof document !== 'undefined') {
  const today = todayKey();
  for (const calendar of document.querySelectorAll('.dp-calendar')) foldCalendar(calendar, today);
}
