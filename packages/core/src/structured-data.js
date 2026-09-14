/**
 * Builds the JSON-LD from the frontmatter.
 *
 * @module @docpensieve/core/structured-data
 */

import { JSONLD_TYPES, StructuredDataError, humanizeSlug, slugify } from '@docpensieve/shared';

/** Article type used when the frontmatter names none. */
const DEFAULT_TYPE = 'Article';

/** Name of the first crumb of the breadcrumb. */
const HOME_LABEL = 'Home';

/** Matches a URL that is already absolute (with a scheme) or protocol-relative. */
const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Normalises a frontmatter date into a short ISO date.
 *
 * YAML turns `date: 2026-01-15` into a `Date` object, but a quoted date stays
 * a string: both forms must come out the same.
 *
 * @param {unknown} value
 * @returns {string | undefined} `'2026-01-15'`, or `undefined` when unusable.
 */
function toISODate(value) {
  if (value === undefined || value === null || value === '') return undefined;

  /*
   * A number is not a date: `new Date('42')` nevertheless returns
   * 31 December 2041, and `new Date('0')` the year 2000. YAML turns an
   * unquoted `date: 42` into a number, and the page ended up dated in the
   * next century without anything saying so.
   */
  if (typeof value === 'number' || typeof value === 'boolean') return undefined;
  if (!(value instanceof Date) && typeof value !== 'string') return undefined;

  /*
   * A bare date is read in UTC, not in the machine's time zone. Otherwise
   * `2026-01-15 00:30` is read as local time then truncated to UTC: the
   * published date moves back one day east of Greenwich, and the same source
   * gives two different outputs depending on where it is built.
   */
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  }

  const text = value.trim();
  // A calendar date, with or without a time: keep only the day, read in UTC.
  const dateOnly = /^\d{4}-\d{2}-\d{2}([ T].*)?$/.test(text);
  const date = dateOnly ? new Date(`${text.slice(0, 10)}T00:00:00Z`) : new Date(text);

  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString().slice(0, 10);
}

/**
 * Brings a value down to a list of non-empty strings.
 *
 * @param {unknown} value Single string, array, or nothing.
 * @returns {string[]}
 */
function toList(value) {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return list.map((entry) => String(entry).trim()).filter(Boolean);
}

/**
 * Lists the authors as `Person` nodes.
 *
 * @param {unknown} authors Single string or array of names.
 * @returns {{ '@type': string, name: string }[]}
 */
function toPersons(authors) {
  const list = Array.isArray(authors) ? authors : authors ? [authors] : [];
  return list
    .map((name) => String(name).trim())
    .filter(Boolean)
    .map((name) => ({ '@type': 'Person', name }));
}

/** Assembles a schema.org graph for a page. */
export class StructuredDataBuilder {
  /**
   * @param {Record<string, any>} frontmatter Page frontmatter.
   * @param {string} url Page URL on the site (`'/guide/install/'`).
   * @param {Record<string, any>} config Normalised project config.
   * @param {{ breadcrumbTitles?: Record<string, string>, basePath?: string, dirUrl?: string, logo?: string }} [options]
   *   `breadcrumbTitles` maps a folder slug to its real title, so that the
   *   breadcrumb shows “Café Guide” rather than “Cafe guide”. `basePath` is
   *   the site root from which crumbs are counted: the generator sets
   *   `/versions/v1.0/`, otherwise the breadcrumb would show “Versions” and
   *   “V1.0”, which are neither pages nor titles. `dirUrl` is the source
   *   file's folder as a URL: the base of the frontmatter's relative targets.
   */
  constructor(frontmatter, url, config, options = {}) {
    this.frontmatter = frontmatter ?? {};
    this.url = url;
    this.config = config ?? {};
    this.options = options;
    this.breadcrumbTitles = options.breadcrumbTitles ?? {};
    this.basePath = options.basePath ?? '/';
    this.dirUrl = options.dirUrl;
    // URL of the project's logo, once the generator has copied it.
    this.logo = options.logo;
  }

  /**
   * Builds the page's schema.org graph.
   *
   * @returns {Record<string, any> | null} Object ready to serialise, or
   *   `null` when structured data is turned off in the configuration.
   * @throws {StructuredDataError} Unknown article type, or malformed FAQ.
   */
  build() {
    if (this.config.jsonld?.enabled === false) return null;

    const graph = [this.#organization(), this.#article()];

    const breadcrumbs = this.#breadcrumbs();
    if (breadcrumbs) graph.push(breadcrumbs);

    const faq = this.#faq();
    if (faq) graph.push(faq);

    return { '@context': 'https://schema.org', '@graph': graph };
  }

  /**
   * Serialises the graph into a tag ready for the `<head>`.
   *
   * @returns {string} `<script>` tag, or an empty string when disabled.
   */
  toScriptTag() {
    const graph = this.build();
    if (!graph) return '';

    // A "</script>" or a "<!--" inside a title would close the tag. Escaping
    // "<" is enough and stays valid JSON.
    const json = JSON.stringify(graph).replaceAll('<', '\\u003c');
    return `<script type="application/ld+json">${json}</script>`;
  }

  /**
   * Makes a site URL absolute.
   *
   * Without a configured `siteUrl`, URLs stay relative: the graph is then less
   * useful to search engines, but generation is not blocked for all that.
   *
   * @param {string} target
   * @returns {string}
   */
  #absolute(target) {
    if (!this.config.siteUrl || ABSOLUTE_URL.test(target)) return target;
    return new URL(target, this.config.siteUrl).href;
  }

  /**
   * Resolves a target written by the author, following the link rules
   * (ADR-006).
   *
   * A relative target starts from the page's folder, an absolute one from the
   * version root. Resolved against the site root, a “preview: ./thumb.png”
   * pointed to an image that does not exist.
   *
   * @param {string} target
   * @returns {string}
   */
  #target(target) {
    if (ABSOLUTE_URL.test(target)) return target;
    const root = this.basePath.endsWith('/') ? this.basePath.slice(0, -1) : this.basePath;
    if (target.startsWith('/')) {
      return this.basePath === '/' || target.startsWith(this.basePath) ? target : root + target;
    }
    const resolved = new URL(target, `https://docpensieve.invalid${this.dirUrl ?? this.url}`);
    return resolved.pathname + resolved.search + resolved.hash;
  }

  /** @returns {string} Stable identifier of the organisation in the graph. */
  #organizationId() {
    /*
     * The deployment prefix is part of the identity. Without it, two sites
     * hosted on the same origin — two projects of the same pages account —
     * would claim the same identifier under different names, and an engine
     * reconciling by identifier would merge them.
     */
    return `${this.#absolute(this.config.baseUrl)}#organization`;
  }

  /** @returns {Record<string, any>} `Organization` node. */
  #organization() {
    /** @type {Record<string, any>} */
    const node = {
      '@type': 'Organization',
      '@id': this.#organizationId(),
      name: this.config.projectName,
    };
    if (this.config.siteUrl) node.url = this.config.siteUrl;
    if (this.logo) node.logo = this.#absolute(this.logo);
    return node;
  }

  /**
   * @returns {Record<string, any>} `Article`, `TechArticle` or `BlogPosting` node.
   * @throws {StructuredDataError} When `jsonld.type` is not recognised.
   */
  #article() {
    const type = this.frontmatter.jsonld?.type ?? DEFAULT_TYPE;
    if (!JSONLD_TYPES.includes(type)) {
      throw new StructuredDataError(`Unknown JSON-LD type: "${type}".`, {
        hint: `Accepted values for jsonld.type in the frontmatter: ${JSONLD_TYPES.join(', ')}.`,
      });
    }

    const pageUrl = this.#absolute(this.url);
    /** @type {Record<string, any>} */
    const node = {
      '@type': type,
      '@id': `${pageUrl}#article`,
      headline: this.frontmatter.title ?? this.config.projectName,
      mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
      publisher: { '@id': this.#organizationId() },
    };

    if (this.frontmatter.description) node.description = this.frontmatter.description;

    const published = toISODate(this.frontmatter.date);
    if (published) node.datePublished = published;

    // Without an explicit modification date, the publication date stands: an
    // article never edited was indeed “modified” on the day it came out.
    const modified = toISODate(this.frontmatter.modified) ?? published;
    // A modification earlier than the publication describes an impossibility:
    // publishing it would assert it.
    if (published && modified && modified < published) {
      throw new StructuredDataError(
        `Modification date earlier than publication: ${modified} before ${published}.`,
        { hint: 'Fix "modified" or "date" in the page frontmatter.' },
      );
    }
    if (modified) node.dateModified = modified;

    const authors = toPersons(this.frontmatter.authors);
    if (authors.length > 0) node.author = authors;

    // A single tag is written without brackets, like a single author.
    // Accepting only the array lost the value without a word.
    const tags = toList(this.frontmatter.tags);
    if (tags.length > 0) node.keywords = tags;

    if (this.frontmatter.preview) {
      node.image = this.#absolute(this.#target(String(this.frontmatter.preview)));
    }

    return node;
  }

  /**
   * Derives the breadcrumb from the URL path.
   *
   * @returns {Record<string, any> | null} `null` on the home page, where a
   *   single crumb would tell nothing, or when the frontmatter turns them off.
   */
  #breadcrumbs() {
    if (this.frontmatter.jsonld?.breadcrumbs === false) return null;

    const relative = this.url.startsWith(this.basePath)
      ? this.url.slice(this.basePath.length)
      : this.url;
    const segments = relative.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const items = [{ name: HOME_LABEL, url: this.#absolute(this.basePath) }];

    let currentPath = this.basePath.replace(/\/$/, '');
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      items.push({
        name: isLast
          ? (this.frontmatter.title ?? humanizeSlug(segment))
          : (this.breadcrumbTitles[segments.slice(0, index + 1).join('/')] ??
            humanizeSlug(segment)),
        url: this.#absolute(`${currentPath}/`),
      });
    });

    return {
      '@type': 'BreadcrumbList',
      '@id': `${this.#absolute(this.url)}#breadcrumb`,
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    };
  }

  /**
   * @returns {Record<string, any> | null} `FAQPage` node, or `null` without FAQ.
   * @throws {StructuredDataError} When an entry lacks a question or an answer.
   */
  #faq() {
    const entries = this.frontmatter.jsonld?.faq;
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const questions = entries.map((entry, index) => {
      if (!entry?.question || !entry?.answer) {
        throw new StructuredDataError(
          `Incomplete FAQ entry at position ${index + 1} (page ${this.url}).`,
          { hint: 'Every jsonld.faq entry must carry "question" and "answer".' },
        );
      }
      return {
        '@type': 'Question',
        // The rank is always a suffix: two questions that only punctuation
        // tells apart give the same slug, and two nodes with the same
        // identifier are one to a JSON-LD processor — the second disappears.
        '@id': `${this.#absolute(this.url)}#faq-${index + 1}-${slugify(entry.question)}`.replace(
          /-$/,
          '',
        ),
        name: String(entry.question),
        acceptedAnswer: { '@type': 'Answer', text: String(entry.answer) },
      };
    });

    return {
      '@type': 'FAQPage',
      '@id': `${this.#absolute(this.url)}#faq`,
      mainEntity: questions,
    };
  }
}
