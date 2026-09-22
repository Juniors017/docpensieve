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
