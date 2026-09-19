/**
 * The byline of a page: who wrote it, and when it was written or last changed.
 *
 * The frontmatter names the authors; a JSON file of the version describes
 * them. The split matters: a name repeated on forty pages would carry its
 * biography forty times, and correcting it would mean forty edits.
 *
 * This module reads no file. The generator hands it the parsed description,
 * as it does for the menu: without that, the engine could not be tested
 * without a disk.
 *
 * @module @docpensieve/core/authors
 */

import { ConfigError, UI_STRINGS } from '@docpensieve/shared';

/** Locale of a date when the caller names none: the wording of the default language. */
const DEFAULT_DATE_LOCALE = UI_STRINGS.en.dateLocale;

/**
 * @typedef {object} Author
 * @property {string} key    Key used by the frontmatter.
 * @property {string} name   Name shown to the reader.
 * @property {string} [bio]  One or two sentences, shown under the name.
 * @property {string} [avatar] Image path, relative to the version's folder.
 * @property {string} [url]  Personal site or profile.
 */

/**
 * @typedef {object} Byline
 * @property {Author[]} authors
 * @property {{ iso: string, label: string } | null} created
 * @property {{ iso: string, label: string } | null} updated
 */

/** Fields an author may declare, so that a typo is caught rather than ignored. */
const AUTHOR_FIELDS = new Set(['name', 'bio', 'avatar', 'url']);

/**
 * Reads a date of the frontmatter, and gives it in both forms: the machine one
 * for `<time datetime>`, the readable one for the reader.
 *
 * A date is often written unquoted in YAML, which parses it as a Date; quoted,
 * it arrives as text. Both are accepted, anything unreadable is refused rather
 * than shown as `Invalid Date`.
 *
 * @param {unknown} value
 * @param {string} field Name of the field, for the error message.
 * @param {string} where Page the date comes from.
 * @param {string} [locale] Locale the label is written in. Default: `en-GB`.
 * @returns {{ iso: string, label: string } | null} `null` when absent.
 * @throws {ConfigError} When the value is not a date.
 */
export function readDate(value, field, where, locale = DEFAULT_DATE_LOCALE) {
  if (value === undefined || value === null || value === '') return null;

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new ConfigError(`Invalid ${field} in ${where}: "${String(value)}".`, {
      hint: `Write a date as ${field}: 2026-09-16, which is read the same way everywhere.`,
    });
  }

  return {
    iso: date.toISOString().slice(0, 10),
    // The locale comes from the page, never from the machine that built it:
    // a site is produced once and read everywhere. Day first, month spelled
    // out — "16 September 2026" is read the same way everywhere, where 09/16
    // and 16/09 are the same page read two ways.
    label: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date),
  };
}

/**
 * Turns the JSON description of a version into a table of authors.
 *
 * @param {unknown} description Parsed content of the file.
 * @param {{ source: string }} options `source` names the file in errors.
 * @returns {Map<string, Author>}
 * @throws {ConfigError} When the shape is wrong, naming the offending entry.
 */
export function buildAuthorTable(description, { source }) {
  if (description === null || typeof description !== 'object' || Array.isArray(description)) {
    throw new ConfigError(`${source} must describe authors as an object.`, {
      hint: 'Write { "ada": { "name": "Ada Lovelace", "bio": "…" } }, one entry per author.',
    });
  }

  /** @type {Map<string, Author>} */
  const table = new Map();

  for (const [key, value] of Object.entries(/** @type {Record<string, unknown>} */ (description))) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new ConfigError(`Author "${key}" of ${source} must be an object.`, {
        hint: `Write "${key}": { "name": "…" } — the name is the only required field.`,
      });
    }

    const entry = /** @type {Record<string, unknown>} */ (value);

    for (const field of Object.keys(entry)) {
      if (!AUTHOR_FIELDS.has(field)) {
        throw new ConfigError(`Author "${key}" of ${source} has an unknown field "${field}".`, {
          hint: `Known fields: ${[...AUTHOR_FIELDS].join(', ')}. A typo here would be silently ignored.`,
        });
      }
    }

    if (typeof entry.name !== 'string' || entry.name.trim() === '') {
      throw new ConfigError(`Author "${key}" of ${source} has no name.`, {
        hint: `Add "name": "…" — it is what the reader sees, the key is only how a page refers to it.`,
      });
    }

    for (const field of ['bio', 'avatar', 'url']) {
      const given = entry[field];
      if (given !== undefined && (typeof given !== 'string' || given.trim() === '')) {
        throw new ConfigError(`The ${field} of author "${key}" of ${source} must be text.`, {
          hint: `Either write "${field}": "…", or leave the field out.`,
        });
      }
    }

    /** @type {Author} */
    const author = { key, name: entry.name.trim() };
    if (typeof entry.bio === 'string') author.bio = entry.bio.trim();
    if (typeof entry.avatar === 'string') author.avatar = entry.avatar.trim();
    if (typeof entry.url === 'string') author.url = entry.url.trim();
    table.set(key, author);
  }

  return table;
}

/**
 * The authors of a page, in the order the frontmatter names them.
 *
 * A key the table does not describe is not an error: the name is shown as
 * written. It is what lets a project name its authors before describing them,
 * and what keeps pages written before the file working.
 *
 * @param {unknown} value `authors` from the frontmatter: one name or a list.
 * @param {Map<string, Author>} [table]
 * @returns {Author[]}
 */
export function resolvePageAuthors(value, table = new Map()) {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

  return list
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .map((key) => table.get(key) ?? { key, name: key });
}

/**
 * Assembles what the head of a page shows, or nothing when it has none of it.
 *
 * @param {Record<string, any>} frontmatter
 * @param {Map<string, Author>} [table]
 * @param {string} [where] Page named in a date error.
 * @param {string} [locale] Locale the dates are written in.
 * @returns {Byline | null}
 * @throws {ConfigError} When a date cannot be read.
 */
export function buildByline(frontmatter, table = new Map(), where = 'this page', locale) {
  const authors = resolvePageAuthors(frontmatter?.authors, table);
  const created = readDate(frontmatter?.date, 'date', where, locale);
  // The same field the sitemap reads for lastmod: one date, one meaning.
  const updated = readDate(frontmatter?.modified, 'modified', where, locale);

  if (authors.length === 0 && !created && !updated) return null;

  // An update on the day of writing says nothing: it is the same event.
  return { authors, created, updated: updated && updated.iso !== created?.iso ? updated : null };
}
