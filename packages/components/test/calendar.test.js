import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DocPensieveError } from '@docpensieve/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { Calendar, Event, firstWeekday, monthGrid, readDay } from '../src/calendar.js';
import { setSiteContext } from '../src/site.js';

const render = (/** @type {any} */ element) => renderToStaticMarkup(element);

afterEach(() => setSiteContext({}));

describe('the days a calendar counts', () => {
  it('agrees with the calendar of the world, two centuries wide', () => {
    // Zeller's congruence rather than Date: a date that was never a moment
    // cannot be moved by a time zone. A month starting on the wrong day is
    // the failure nobody would report — it just looks like a calendar.
    let checked = 0;
    for (let year = 1900; year <= 2100; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const expected = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
        expect(firstWeekday(year, month)).toBe(expected);
        checked += 1;
      }
    }
    expect(checked).toBe(2412);
  });

  it('knows which Februaries have twenty-nine days', () => {
    const days = (/** @type {number} */ year) =>
      monthGrid(year, 2)
        .flat()
        .filter((day) => day !== null).length;

    expect(days(2024)).toBe(29);
    expect(days(2023)).toBe(28);
    // The century rule: 1900 is not a leap year, 2000 is.
    expect(days(1900)).toBe(28);
    expect(days(2000)).toBe(29);
  });

  it('fills whole weeks, so that a grid is a grid', () => {
    for (const [year, month] of [
      [2026, 10],
      [2024, 2],
      [2027, 8],
    ]) {
      const weeks = monthGrid(year, month);
      for (const week of weeks) expect(week).toHaveLength(7);
    }
  });

  it('reads a day, and refuses what is not one', () => {
    expect(readDay('2026-10-14')).toEqual({ year: 2026, month: 10, day: 14 });
    expect(readDay('2026-10')).toEqual({ year: 2026, month: 10, day: 1 });
    // A day that does not exist is not a day: 31 September is a typo.
    expect(readDay('2026-09-31')).toBeNull();
    expect(readDay('2026-13-01')).toBeNull();
    expect(readDay('14/10/2026')).toBeNull();
    expect(readDay('')).toBeNull();
  });
});

describe('Calendar', () => {
  const october = h(Event, { date: '2026-10-14', label: 'Release 0.5' });

  it('draws the day an event falls on, and marks it', () => {
    const html = render(h(Calendar, null, october));

    expect(html).toContain('data-date="2026-10-14"');
    expect(html).toContain('dp-calendar-day--busy');
    expect(html).toContain('Release 0.5');
  });

  it('draws every month between the first event and the last', () => {
    // An empty month between two others is a gap a reader should see, not one
    // the calendar should quietly close.
    const html = render(
      h(Calendar, null, october, h(Event, { date: '2026-12-02', label: 'Workshop' })),
    );

    expect(html).toContain('data-calendar="2026-10 2026-11 2026-12"');
    expect(html.match(/data-month=/g)).toHaveLength(3);
  });

  it('resolves the target of an event, which the compiler never sees', () => {
    // A URL written in a prop escapes the compiler plugins: the component
    // that emits it is the one that has to resolve it.
    setSiteContext({ url: '/guide/', basePath: '/versions/v1.0/' });
    const html = render(
      h(Calendar, null, h(Event, { date: '2026-10-14', label: 'Release', href: '/whats-new/' })),
    );

    expect(html).toContain('href="/versions/v1.0/whats-new/"');
  });

  it('writes its months in the language of the page', () => {
    setSiteContext({ url: '/', basePath: '/', lang: 'fr' });
    const french = render(h(Calendar, null, october));
    expect(french).toContain('octobre');
    expect(french).toContain('aria-label="Calendrier"');

    setSiteContext({ url: '/', basePath: '/', lang: 'en' });
    expect(render(h(Calendar, null, october))).toContain('October');
  });

  it('writes its controls hidden, so they never show without their script', () => {
    // The arrows do nothing until the client script has run: drawn early,
    // they would be a button that answers nothing.
    const html = render(h(Calendar, null, october));
    expect(html).toContain('class="dp-calendar-controls" hidden=""');
  });

  it('shows every month to a reader with no script at all', () => {
    // Nothing is hidden in the markup but the controls: the page is readable
    // before, and after, anything is loaded.
    const html = render(
      h(Calendar, null, october, h(Event, { date: '2026-11-02', label: 'Workshop' })),
    );

    expect(html.match(/data-month="[0-9-]+" *(hidden)?/g)?.join('')).not.toContain('hidden');
  });
});

describe('what a calendar refuses', () => {
  it('an empty one, which would show nothing', () => {
    try {
      render(h(Calendar, null));
      expect.unreachable('Calendar should have thrown');
    } catch (error) {
      const failure = /** @type {DocPensieveError} */ (error);
      expect(failure).toBeInstanceOf(DocPensieveError);
      expect(failure.hint).toContain('<Event');
    }
  });

  it('a date that is not a day', () => {
    for (const date of ['2026-10', '14/10/2026', '2026-09-31']) {
      expect(() => render(h(Calendar, null, h(Event, { date, label: 'x' })))).toThrow(
        DocPensieveError,
      );
    }
  });

  it('an event with nothing to say', () => {
    expect(() => render(h(Calendar, null, h(Event, { date: '2026-10-14' })))).toThrow(/no label/);
  });

  it('an entry that is not an event', () => {
    expect(() => render(h(Calendar, null, h('span', null, 'Release')))).toThrow(DocPensieveError);
  });

  it('an event standing outside a calendar', () => {
    // On its own it would render nothing at all: no month to be drawn in.
    try {
      render(h(Event, { date: '2026-10-14', label: 'Release' }));
      expect.unreachable('Event should have thrown');
    } catch (error) {
      const failure = /** @type {DocPensieveError} */ (error);
      expect(failure.message).toContain('Release');
      expect(failure.hint).toContain('<Calendar>');
    }
  });
});
