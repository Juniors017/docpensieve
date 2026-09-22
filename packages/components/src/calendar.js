/**
 * A month of dates, with what happens on them.
 *
 * Built at generation, like everything else: the grid, the day numbers and
 * the events are in the HTML. A reader without JavaScript gets every month
 * one after the other, which is a readable page — the client script only
 * folds them into one and adds the two arrows that move between them
 * (ADR-021).
 *
 * The events are written in the page. Nothing is read from the frontmatter of
 * other pages: a calendar says what its author put in it, and says it where
 * it is read.
 *
 * @module @docpensieve/components/calendar
 */

import { Children, createElement as h, isValidElement } from 'react';

import { DEFAULT_LANGUAGE, DocPensieveError, uiStrings } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';
import { getSiteContext, resolveUrl } from './site.js';

/** Length of a month, the year being known. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * @param {number} year
 * @param {number} month Month, from 1.
 * @returns {number}
 */
function daysIn(year, month) {
  if (month !== 2) return DAYS_IN_MONTH[month - 1];
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap ? 29 : 28;
}

/**
 * Reads a `YYYY-MM` or `YYYY-MM-DD`.
 *
 * Parsed rather than handed to `new Date()`: that reads a bare date as UTC and
 * a dated-and-timed one as local, so a calendar built in one time zone showed
 * an event a day early in another.
 *
 * @param {string} value
 * @returns {{ year: number, month: number, day: number } | null}
 */
export function readDay(value) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(value ?? '').trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] === undefined ? 1 : Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysIn(year, month)) return null;

  return { year, month, day };
}

/**
 * The weekday a month starts on, counted from Monday.
 *
 * Zeller's congruence rather than `Date`: no time zone can move a day that was
 * never a moment.
 *
 * @param {number} year
 * @param {number} month
 * @returns {number} 0 for Monday, 6 for Sunday.
 */
export function firstWeekday(year, month) {
  // January and February are counted as months 13 and 14 of the year before.
  const m = month < 3 ? month + 12 : month;
  const y = month < 3 ? year - 1 : year;
  const k = y % 100;
  const j = Math.floor(y / 100);
  const weekday =
    (1 + Math.floor((13 * (m + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) + 5 * j) % 7;
  // Zeller counts from Saturday; the grid starts on Monday.
  return (weekday + 5) % 7;
}

/**
 * The weeks of a month, each of seven cells.
 *
 * @param {number} year
 * @param {number} month
 * @returns {(number | null)[][]} `null` where the cell belongs to no day.
 */
export function monthGrid(year, month) {
  const total = daysIn(year, month);
  const lead = firstWeekday(year, month);

  /** @type {(number | null)[]} */
  const cells = [...Array.from({ length: lead }, () => null)];
  for (let day = 1; day <= total; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  /** @type {(number | null)[][]} */
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * The events a calendar was given, read off its children.
 *
 * @param {any} children
 * @returns {{ date: string, label: string, href: string }[]}
 * @throws {DocPensieveError} An entry that is not an event, or a date that is
 *   not one.
 */
function eventsOf(children) {
  /** @type {{ date: string, label: string, href: string }[]} */
  const events = [];

  for (const node of Children.toArray(children)) {
    // MDX puts a blank line between two tags, and that becomes a paragraph or
    // a string of whitespace: neither is an entry, and neither is a mistake.
    if (!isValidElement(node)) continue;
    if (node.type !== Event) {
      if (node.type === 'p') continue;
      throw new DocPensieveError('A calendar holds events, and this is not one.', {
        hint: 'Write <Event date="2026-10-14" label="Release" /> inside <Calendar>.',
      });
    }

    const props = /** @type {{ date?: string, label?: string, href?: string }} */ (node.props);
    const day = readDay(props.date ?? '');
    if (!day || String(props.date).length !== 10) {
      throw new DocPensieveError(`"${props.date ?? ''}" is not a day of a calendar.`, {
        hint: 'Write the day as 2026-10-14 — four digits, two, two.',
      });
    }
    if (!props.label) {
      throw new DocPensieveError(`The event of ${props.date} has no label.`, {
        hint: 'Give it one: <Event date="2026-10-14" label="Release 0.5" />.',
      });
    }

    events.push({ date: String(props.date), label: props.label, href: props.href ?? '' });
  }

  return events;
}

/**
 * One event of a calendar. Rendered by its calendar, never on its own.
 *
 * @param {{ date?: string, label?: string, href?: string }} props
 * @returns {any} Never: it is the calendar that draws its events, and this
 *   function exists to be recognised among a calendar children — and to say
 *   so when it stands anywhere else.
 * @throws {DocPensieveError} Always, outside a calendar.
 */
export function Event(props) {
  throw new DocPensieveError(
    `The event "${props.label ?? props.date ?? ''}" is outside a calendar.`,
    {
      hint: 'Put it inside <Calendar>: the calendar is what knows which month to draw it in.',
    },
  );
}

/**
 * A calendar of the days its events fall on.
 *
 * Every month from the first event to the last is drawn, so that an empty
 * month between two others is not silently skipped — a gap is something a
 * reader should see.
 *
 * @example
 * <Calendar>
 *   <Event date="2026-10-14" label="Release 0.5" href="/whats-new/" />
 * </Calendar>
 *
 * @param {{
 *   className?: string, style?: object, children?: any, label?: string,
 *   compact?: boolean,
 * }} props `label` names the calendar for screen readers. `compact` asks for
 *   the small model at every width; a narrow screen takes it anyway, since
 *   seven columns of full cells there give each day a few millimetres.
 * @throws {DocPensieveError} Without an event, or with a child that is not one.
 */
export function Calendar({ className, style, children, label, compact = false }) {
  const events = eventsOf(children);
  if (events.length === 0) {
    throw new DocPensieveError('A calendar with no event shows nothing.', {
      hint: 'Add <Event date="2026-10-14" label="Release" /> inside it.',
    });
  }

  const { lang = DEFAULT_LANGUAGE } = getSiteContext();
  const ui = uiStrings(lang);
  const months = monthsBetween(events);

  return h(
    'section',
    {
      className: classNames(cls('calendar', compact && 'compact'), className),
      style,
      'aria-label': label ?? ui.calendar,
      'data-calendar': months.map((month) => month.key).join(' '),
    },
    h(
      'div',
      { className: cls('calendarControls'), hidden: true },
      h('button', { type: 'button', className: cls('calendarStep'), 'data-step': '-1' }, '←'),
      h('span', { className: cls('calendarCurrent') }),
      h('button', { type: 'button', className: cls('calendarStep'), 'data-step': '1' }, '→'),
    ),
    months.map((month) => renderMonth(month, events, lang, ui)),
    // Both forms are written, and the stylesheet shows one — as the header
    // menu and the sidebar are written twice. It is what lets a narrow screen
    // take the small model without a script, and `display: none` keeps the
    // hidden one out of the reading order rather than read twice.
    renderList(events, lang, ui),
  );
}

/**
 * The events of a compact calendar, written out under its grid.
 *
 * @param {{ date: string, label: string, href: string }[]} events
 * @param {string} lang
 * @param {any} ui
 * @returns {any}
 */
function renderList(events, lang, ui) {
  const ordered = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return h(
    'ul',
    { className: cls('calendarList') },
    ordered.map((event, index) =>
      h(
        'li',
        { className: cls('calendarListItem'), key: index },
        h(
          'time',
          { className: cls('calendarListDate'), dateTime: event.date },
          dayLabel(event.date, ui.dateLocale ?? lang),
        ),
        event.href
          ? h('a', { href: resolveUrl(event.href) }, event.label)
          : h('span', null, event.label),
      ),
    ),
  );
}

/**
 * @param {string} date
 * @param {string} locale
 * @returns {string} `14 Oct`, in the language of the page.
 */
function dayLabel(date, locale) {
  const day = readDay(date);
  if (!day) return date;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(day.year, day.month - 1, day.day)));
  } catch {
    return date;
  }
}

/**
 * Every month from the first event to the last.
 *
 * @param {{ date: string }[]} events
 * @returns {{ key: string, year: number, month: number }[]}
 */
function monthsBetween(events) {
  const days = events.map((event) => /** @type {any} */ (readDay(event.date)));
  const first = days.reduce((a, b) => (a.year * 12 + a.month <= b.year * 12 + b.month ? a : b));
  const last = days.reduce((a, b) => (a.year * 12 + a.month >= b.year * 12 + b.month ? a : b));

  /** @type {{ key: string, year: number, month: number }[]} */
  const months = [];
  let year = first.year;
  let month = first.month;
  while (year * 12 + month <= last.year * 12 + last.month) {
    months.push({ key: `${year}-${String(month).padStart(2, '0')}`, year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/**
 * @param {{ key: string, year: number, month: number }} month
 * @param {{ date: string, label: string, href: string }[]} events
 * @param {string} lang
 * @param {any} ui
 * @returns {any}
 */
function renderMonth(month, events, lang, ui) {
  const weeks = monthGrid(month.year, month.month);
  const title = monthName(month.year, month.month, ui.dateLocale ?? lang);

  return h(
    'div',
    { className: cls('calendarMonth'), 'data-month': month.key, key: month.key },
    h('h3', { className: cls('calendarTitle') }, title),
    h(
      'table',
      { className: cls('calendarGrid') },
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          weekdayNames(ui.dateLocale ?? lang).map((name, index) =>
            h('th', { scope: 'col', key: index, abbr: name.full }, name.short),
          ),
        ),
      ),
      h(
        'tbody',
        null,
        weeks.map((week, index) =>
          h(
            'tr',
            { key: index },
            week.map((day, cell) => renderDay(month, day, cell, events)),
          ),
        ),
      ),
    ),
  );
}

/**
 * @param {{ key: string }} month
 * @param {number | null} day
 * @param {number} cell
 * @param {{ date: string, label: string, href: string }[]} events
 * @returns {any}
 */
function renderDay(month, day, cell, events) {
  if (day === null) return h('td', { className: cls('calendarEmpty'), key: cell });

  const date = `${month.key}-${String(day).padStart(2, '0')}`;
  const onThisDay = events.filter((event) => event.date === date);

  return h(
    'td',
    {
      key: cell,
      className: classNames(
        cls('calendarDay'),
        onThisDay.length > 0 ? cls('calendarDay', 'busy') : '',
      ),
      'data-date': date,
    },
    h('time', { className: cls('calendarNumber'), dateTime: date }, String(day)),
    // The mark of the small model: a dot, or how many things the day holds.
    // Hidden from a reader of the markup, since the list under the grid says
    // the same thing in words.
    onThisDay.length > 0
      ? h(
          'span',
          { className: cls('calendarMark'), 'aria-hidden': 'true' },
          onThisDay.length > 1 ? String(onThisDay.length) : '',
        )
      : null,
    onThisDay.length > 0
      ? h(
          'ul',
          { className: cls('calendarEvents') },
          onThisDay.map((event, index) =>
            h(
              'li',
              { className: cls('calendarEvent'), key: index },
              // A URL written in a prop escapes the compiler plugins: the component
              // that emits it is the one that has to resolve it (ADR-006).
              event.href ? h('a', { href: resolveUrl(event.href) }, event.label) : event.label,
            ),
          ),
        )
      : null,
  );
}

/**
 * @param {number} year
 * @param {number} month
 * @param {string} locale
 * @returns {string} `October 2026`, in the language of the page.
 */
function monthName(year, month, locale) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  } catch {
    return `${year}-${String(month).padStart(2, '0')}`;
  }
}

/**
 * The seven weekday names, from Monday, in the language of the page.
 *
 * @param {string} locale
 * @returns {{ short: string, full: string }[]}
 */
function weekdayNames(locale) {
  // 2024-01-01 was a Monday: seven days from it give the week in order,
  // whatever the language.
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(Date.UTC(2024, 0, 1 + index));
    const options = /** @type {const} */ ({ timeZone: 'UTC' });
    try {
      return {
        short: new Intl.DateTimeFormat(locale, { weekday: 'short', ...options }).format(day),
        full: new Intl.DateTimeFormat(locale, { weekday: 'long', ...options }).format(day),
      };
    } catch {
      const fallback = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index];
      return { short: fallback, full: fallback };
    }
  });
}
