/**
 * Conditional display by date or duration.
 *
 * **Mind the meaning on a static site**: “right now” means the moment of the
 * **build**, not of reading. A page built in November will still show “the
 * offer starts soon” in January if the site has not been rebuilt in between.
 *
 * This is not a flaw: it is what a time-based component becomes without
 * client-side JavaScript. A scheduled build — a cron job in CI — is enough to
 * keep it right.
 *
 * @module @docpensieve/components/time-timer
 */

import { Children, Fragment, cloneElement, createElement as h, isValidElement } from 'react';

import { DocPensieveError } from '@docpensieve/shared';

/** Matches a duration: `30d`, `2h`, `45m`. */
const DURATION = /^(\d+)([dhm])$/;

/**
 * Content shown before the period.
 *
 * No wrapper: a `span` around the author's content would become invalid
 * markup as soon as they write a paragraph in it — which happens as soon as a
 * blank line separates their text. The content therefore keeps its nature,
 * inline or block.
 *
 * @param {{ children?: any, start?: string }} props
 */
export function FallbackBefore({ children }) {
  return h(Fragment, null, children);
}

/**
 * Content shown after the period.
 *
 * Without a wrapper, for the same reason as {@link FallbackBefore}.
 *
 * @param {{ children?: any, end?: string }} props
 */
export function FallbackAfter({ children }) {
  return h(Fragment, null, children);
}

/**
 * Parses a date in the `DD/MM[/YYYY] [HH:mm]` format.
 *
 * @param {string | undefined} text
 * @param {boolean} strict Read in UTC rather than in local time.
 * @param {Date} now Provides the default year when it is omitted.
 * @returns {Date | null}
 */
function parseDate(text, strict, now) {
  if (!text) return null;

  const [datePart, timePart] = String(text).trim().split(/\s+/);
  const [day, month, year] = datePart.split('/');
  const [hours = '0', minutes = '0'] = timePart ? timePart.split(':') : [];

  const targetYear = year ? Number(year) : strict ? now.getUTCFullYear() : now.getFullYear();

  // Named fields rather than a spread array: `new Date(...array)` has no
  // valid signature, the constructor expects distinct arguments.
  const m = Number(month) - 1;
  const d = Number(day);
  const hh = Number(hours);
  const mm = Number(minutes);

  const date = strict
    ? new Date(Date.UTC(targetYear, m, d, hh, mm))
    : new Date(targetYear, m, d, hh, mm);

  /*
   * The constructor rolls over rather than failing: month 13 becomes January
   * of the following year, 30 February becomes 1 March. A `NaN` therefore
   * almost never happens, and a typo passed for a valid date — shifting the
   * display without a word.
   *
   * So the resulting date is read back: if it does not say what was written,
   * what was written does not exist.
   */
  const readBack = strict
    ? [
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
      ]
    : [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()];

  const invalid =
    Number.isNaN(date.getTime()) ||
    [targetYear, m, d, hh, mm].some((value, index) => value !== readBack[index]);

  if (invalid) {
    throw new DocPensieveError(`Invalid date in TimeTimer: "${text}".`, {
      hint: 'Expected format: DD/MM/YYYY, optionally followed by HH:mm.',
    });
  }
  return date;
}

/**
 * Shifts a date by a duration.
 *
 * @param {Date} from
 * @param {string} duration
 * @param {boolean} strict
 * @returns {Date}
 */
function addDuration(from, duration, strict) {
  const match = String(duration).trim().match(DURATION);
  if (!match) {
    // Showing nothing after a mere console warning would let a typo make a
    // block vanish without a word — exactly what the project sets out to avoid.
    throw new DocPensieveError(`Invalid duration in TimeTimer: "${duration}".`, {
      hint: 'Accepted formats: 30d (days), 2h (hours), 45m (minutes).',
    });
  }

  const [, amount, unit] = match;
  const end = new Date(from);
  const n = Number(amount);

  if (unit === 'd') strict ? end.setUTCDate(end.getUTCDate() + n) : end.setDate(end.getDate() + n);
  else if (unit === 'h')
    strict ? end.setUTCHours(end.getUTCHours() + n) : end.setHours(end.getHours() + n);
  else strict ? end.setUTCMinutes(end.getUTCMinutes() + n) : end.setMinutes(end.getMinutes() + n);

  return end;
}

/**
 * Places the current moment relative to the period.
 *
 * @param {Date} now
 * @param {Date | null} start
 * @param {Date | null} end
 * @param {Date | null} beforeStart Lower bound of the “before” fallback.
 * @param {Date | null} afterEnd    Upper bound of the “after” fallback.
 * @returns {'during' | 'before' | 'after' | 'none'}
 */
function locate(now, start, end, beforeStart, afterEnd) {
  if (!start || !end) return 'none';
  if (now >= start && now <= end) return 'during';

  if (now < start) {
    if (beforeStart) return now >= beforeStart ? 'before' : 'none';
    return 'before';
  }
  if (afterEnd) return now <= afterEnd ? 'after' : 'none';
  return 'after';
}

/**
 * Shows its content during a period, with fallbacks before and after.
 *
 * @example
 * <TimeTimer date="25/12/2025">
 *   Merry Christmas
 *   <FallbackBefore>It is not Christmas yet</FallbackBefore>
 *   <FallbackAfter>Christmas is over</FallbackAfter>
 * </TimeTimer>
 *
 * @param {{
 *   date?: string, start?: string, duration?: string,
 *   strict?: boolean, children?: any, now?: Date,
 * }} props `now` only exists for tests: without it, the build moment stands.
 */
export function TimeTimer({ date, start, duration, strict = false, children, now }) {
  const current = now ?? new Date();

  let startDate = null;
  let endDate = null;

  if (date && !start) {
    startDate = parseDate(date, strict, current);
    // A date alone covers the whole day.
    if (startDate) endDate = addDuration(startDate, '1d', strict);
  } else if (start && duration) {
    startDate = parseDate(start, strict, current);
    if (startDate) endDate = addDuration(startDate, duration, strict);
  }

  const { before, after, main } = extractFallbacks(children);

  const state = locate(
    current,
    startDate,
    endDate,
    before?.props?.start ? parseDate(before.props.start, strict, current) : null,
    after?.props?.end ? parseDate(after.props.end, strict, current) : null,
  );

  if (state === 'before') return before ?? null;
  if (state === 'after') return after ?? null;
  if (state === 'during') return h(Fragment, null, ...main);
  return null;
}

/**
 * Separates the fallbacks from the main content, at any depth.
 *
 * MDX wraps a component's children in a `<p>` when no blank line separates
 * them — the most natural way to write, and the one of the usage examples. A
 * search limited to the first level would then find nothing, and the
 * component would show nothing at all, without saying so.
 *
 * @param {any} children
 * @returns {{ before: any, after: any, main: any[] }}
 */
function extractFallbacks(children) {
  let before = null;
  let after = null;

  /**
   * @param {any} nodes
   * @returns {any[]} The same nodes, fallbacks removed.
   */
  function walk(nodes) {
    return Children.toArray(nodes)
      .map((child) => {
        if (!isValidElement(child)) return child;

        if (child.type === FallbackBefore) {
          before ??= child;
          return null;
        }
        if (child.type === FallbackAfter) {
          after ??= child;
          return null;
        }

        // `props` is not typed on an arbitrary element: open it here rather
        // than impose a shape on everything an author can write.
        const props = /** @type {{ children?: any }} */ (child.props);
        if (props?.children === undefined) return child;
        const rest = walk(props.children);
        return cloneElement(child, { key: child.key }, ...rest);
      })
      .filter((child) => child !== null);
  }

  // The walk must come before building the object: in a literal, `before` and
  // `after` would be read before `walk` fills them, and would always be null.
  const main = walk(children);
  return { before, after, main };
}
