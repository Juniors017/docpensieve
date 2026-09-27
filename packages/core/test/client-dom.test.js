// @vitest-environment happy-dom
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Renamed: the calendar's own `Event` would shadow the DOM's constructor, and
// `new Event('input')` would build a calendar entry instead of an event.
import { Calendar, Event as CalendarEvent, setSiteContext } from '@docpensieve/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { foldCalendar } from '../client/calendar.js';
import { addCopyButtons } from '../client/copy.js';
import { init as searchPage } from '../client/search.js';

/**
 * The three scripts a reader's browser runs, against a real document.
 *
 * Their pure functions were tested; their wiring to the page was not, and a
 * coverage report that finally included them put the calendar at 15 %. The
 * wiring is where a script fails in front of a reader — an arrow that moves
 * nothing, a button that copies nothing — so it is tested on the markup the
 * build really writes.
 */

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the calendar, folded to one month', () => {
  /** A calendar as the build writes it, over three months. */
  function calendar() {
    setSiteContext({ url: '/', basePath: '/', lang: 'en' });
    document.body.innerHTML = renderToStaticMarkup(
      h(
        Calendar,
        null,
        h(CalendarEvent, { date: '2026-10-14', label: 'Release', key: 1 }),
        h(CalendarEvent, { date: '2026-12-02', label: 'Workshop', key: 2 }),
      ),
    );
    return /** @type {Element} */ (document.querySelector('.dp-calendar'));
  }

  const visible = () =>
    [...document.querySelectorAll('[data-month]')]
      .filter((month) => !month.hasAttribute('hidden'))
      .map((month) => month.getAttribute('data-month'));

  const arrow = (/** @type {string} */ step) =>
    /** @type {HTMLButtonElement} */ (document.querySelector(`[data-step="${step}"]`));

  it('opens on the month holding today, and reveals its arrows', () => {
    foldCalendar(calendar(), '2026-11-05');

    expect(visible()).toEqual(['2026-11']);
    expect(document.querySelector('.dp-calendar-controls')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('.dp-calendar-current')?.textContent).toContain('November');
  });

  it('moves a month at a time, and stops at either end', () => {
    foldCalendar(calendar(), '2026-10-01');
    expect(visible()).toEqual(['2026-10']);
    // At the first month there is nothing before: disabled, not removed, so
    // that what was under the pointer does not move.
    expect(arrow('-1').hasAttribute('disabled')).toBe(true);

    arrow('1').click();
    arrow('1').click();
    expect(visible()).toEqual(['2026-12']);
    expect(arrow('1').hasAttribute('disabled')).toBe(true);

    arrow('1').click();
    expect(visible()).toEqual(['2026-12']);

    arrow('-1').click();
    expect(visible()).toEqual(['2026-11']);
  });

  it('opens on the first month when today is not in the calendar', () => {
    foldCalendar(calendar(), '2031-01-01');
    expect(visible()).toEqual(['2026-10']);
  });

  it('outlines today', () => {
    foldCalendar(calendar(), '2026-10-14');
    expect(document.querySelector('[data-date="2026-10-14"]')?.classList).toContain(
      'dp-calendar-day--today',
    );
  });

  it('leaves a single month alone, without arrows that lead nowhere', () => {
    setSiteContext({ url: '/', basePath: '/', lang: 'en' });
    document.body.innerHTML = renderToStaticMarkup(
      h(Calendar, null, h(CalendarEvent, { date: '2026-10-14', label: 'Release' })),
    );
    foldCalendar(/** @type {Element} */ (document.querySelector('.dp-calendar')), '2026-10-14');

    expect(document.querySelector('.dp-calendar-controls')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('[data-date="2026-10-14"]')?.classList).toContain(
      'dp-calendar-day--today',
    );
  });
});

describe('the copy button', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = '<pre><code>npm run build\n</code></pre>';
    addCopyButtons(document);
  });

  const button = () => /** @type {HTMLButtonElement} */ (document.querySelector('.dp-copy'));

  it('copies the code, says so, then goes back to its word', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    button().click();
    await vi.waitFor(() => expect(button().textContent).toBe('Copied'));

    expect(writeText).toHaveBeenCalledWith('npm run build');
    expect(button().classList).toContain('dp-copy--done');

    vi.advanceTimersByTime(1600);
    expect(button().textContent).toBe('Copy');
    expect(button().classList).not.toContain('dp-copy--done');
  });

  it('selects the code when the clipboard refuses, rather than doing nothing', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    button().click();
    await vi.waitFor(() => expect(window.getSelection()?.toString()).toContain('npm run build'));
    expect(button().textContent).toBe('Copy');
  });
});

describe('the search page', () => {
  /** The search page as the build writes it: the full list, before any query. */
  function page(strings = '{"lang":"en"}') {
    document.body.innerHTML = `
      <form data-search-page data-index="/index.json" data-strings='${strings}'>
        <input name="q" />
      </form>
      <p data-search-status></p>
      <ul data-search-results>
        <li data-url="/install/">Install</li>
        <li data-url="/write/">Write</li>
      </ul>`;
  }

  const INDEX = [
    {
      title: 'Install',
      url: '/install/',
      description: '',
      text: 'Installing the tool takes one command.',
    },
    { title: 'Write', url: '/write/', description: '', text: 'Writing pages in Markdown.' },
  ];

  const status = () => document.querySelector('[data-search-status]')?.textContent;
  const shown = () =>
    [...document.querySelectorAll('li[data-url]')]
      .filter((item) => !(/** @type {HTMLElement} */ (item).hidden))
      .map((item) => item.getAttribute('data-url'));

  /** @param {string} query */
  const type = (query) => {
    const input = /** @type {HTMLInputElement} */ (document.querySelector('input[name="q"]'));
    input.value = query;
    input.dispatchEvent(new Event('input'));
  };

  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      /** @type {Response} */ ({ json: async () => INDEX }),
    );
  });

  it('lists every page before anything is typed', async () => {
    page();
    await searchPage();
    expect(shown()).toEqual(['/install/', '/write/']);
    expect(status()).toBe('2 pages.');
  });

  it('keeps the pages that match, with the passage that does', async () => {
    page();
    await searchPage();
    type('install');

    expect(shown()).toEqual(['/install/']);
    expect(document.querySelector('.dp-search-excerpt mark')?.textContent).toBe('Install');
    expect(status()).toBe('1 page for “install”.');
  });

  it('says so when nothing matches', async () => {
    page();
    await searchPage();
    type('zzz');
    expect(shown()).toEqual([]);
    expect(status()).toBe('No page matches “zzz”.');
  });

  it('counts in the language of the page', async () => {
    // French puts zero in the singular: "0 page", which a rule written as
    // `count === 1` gets wrong.
    page(
      '{"lang":"fr","pages":{"one":"page","other":"pages"},"noResultFor":"Aucune page pour « {query} ».","resultsFor":"{count} pour « {query} »."}',
    );
    await searchPage();
    type('install');
    expect(status()).toBe('1 page pour « install ».');
  });

  it('keeps the full list when the index cannot be loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    page();
    await searchPage();
    expect(status()).toContain('could not be loaded');
    expect(shown()).toEqual(['/install/', '/write/']);
  });

  it('puts the query in the address, so that a search can be shared', async () => {
    const replace = vi.spyOn(history, 'replaceState');
    page();
    await searchPage();
    const input = /** @type {HTMLInputElement} */ (document.querySelector('input[name="q"]'));
    input.value = 'write pages';
    document.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(replace).toHaveBeenCalledWith(null, '', '?q=write%20pages');
    expect(shown()).toEqual(['/write/']);
  });

  it('does nothing on a page that is not the search page', async () => {
    document.body.innerHTML = '<p>Not a search page.</p>';
    await expect(searchPage()).resolves.toBeUndefined();
  });
});
