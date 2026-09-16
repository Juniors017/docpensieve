/**
 * Grids of clickable cards, built from the pages of the version.
 *
 * A folder is a series: its `index` page introduces it, the pages beside that
 * index are its instalments. `<Cards />` turns that structure into cards
 * rather than a list written by hand — a hand-written index goes stale at the
 * first page renamed, and nothing says so.
 *
 * The component reads the page list from the site context, which the
 * generator sets before every page (ADR-006): the compiler plugins work on the
 * Markdown tree, and know nothing of what a component needs.
 *
 * @module @docpensieve/components/cards
 */

import { createElement as h } from 'react';

import { Card, CardBody, CardFooter, CardHeader, CardImage } from './card.js';
import { classNames, cls } from './classes.js';
import { getSiteContext } from './site.js';

/**
 * @typedef {object} PageEntry
 * @property {string} url    Final address of the page.
 * @property {string} slug   Path of the page within the version.
 * @property {string} title
 * @property {string} [description]
 * @property {string} [preview] Image, already resolved by the generator.
 * @property {{ iso: string, label: string }} [modified]
 */

/**
 * Slug of the folder holding a page, `''` at the root.
 *
 * @param {string} slug
 * @returns {string}
 */
const folderOf = (slug) => (slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : '');

/**
 * Direct children of a folder, told apart: a child that is itself a folder is
 * a series, the others are pages.
 *
 * @param {PageEntry[]} pages
 * @param {string} base Folder to look into, `''` for the root.
 * @returns {{ series: PageEntry[], pages: PageEntry[] }}
 */
function childrenOf(pages, base) {
  const prefix = base === '' ? '' : `${base}/`;

  // A folder exists as soon as a page lives under it. Its own index page
  // carries the folder's slug, which is what a series card links to.
  const folders = new Set(pages.map((page) => folderOf(page.slug)).filter(Boolean));

  /** @type {PageEntry[]} */
  const series = [];
  /** @type {PageEntry[]} */
  const leaves = [];

  for (const page of pages) {
    if (page.slug === base || !page.slug.startsWith(prefix)) continue;
    const rest = page.slug.slice(prefix.length);
    // Only one level down: a grid shows a folder, not its whole depth.
    if (rest === '' || rest.includes('/')) continue;

    if (folders.has(page.slug)) series.push(page);
    else leaves.push(page);
  }

  return { series, pages: leaves };
}

/**
 * Number of pages a series holds, its own index page excluded.
 *
 * @param {PageEntry[]} pages
 * @param {string} slug Slug of the series.
 * @returns {number}
 */
const countOf = (pages, slug) =>
  pages.filter((page) => page.slug.startsWith(`${slug}/`) && page.slug !== slug).length;

/**
 * One card: the whole surface is the link, never the title alone.
 *
 * @param {{ page: PageEntry, count?: number }} props
 */
function PageCard({ page, count }) {
  const footer = [
    count !== undefined && count > 0 ? `${count} ${count === 1 ? 'page' : 'pages'}` : '',
    page.modified ? `Updated ${page.modified.label}` : '',
  ].filter(Boolean);

  return h(
    Card,
    { className: cls('cardsItem'), href: page.url, elevated: true },
    page.preview ? h(CardImage, { src: page.preview, alt: '' }) : null,
    h(CardHeader, null, page.title),
    page.description ? h(CardBody, null, page.description) : null,
    footer.length > 0
      ? h(
          CardFooter,
          null,
          footer.map((text, index) =>
            h('span', { key: text, className: index === 0 ? undefined : cls('cardsMeta') }, text),
          ),
        )
      : null,
  );
}

/**
 * Grid of cards for the children of a folder.
 *
 * @param {{
 *   className?: string, style?: object,
 *   of?: 'all' | 'series' | 'pages', from?: string,
 * }} props `of` narrows the grid to the sub-folders (`'series'`) or to the
 *   pages beside the index (`'pages'`); `from` reads another folder, named by
 *   its slug, instead of the one holding the page.
 * @throws {Error} When the page list is missing, or `from` names nothing.
 */
export function Cards({ className, style, of = 'all', from }) {
  const context = getSiteContext();
  const pages = /** @type {PageEntry[] | undefined} */ (context.pages);

  if (!pages) {
    throw new Error(
      'Cards needs the list of pages, which the generator sets before rendering a page.',
    );
  }

  const current = context.slug ?? '';
  // The index page of a folder lists that folder; a page beside it lists the
  // folder holding them both. Without this, a series page would show its
  // neighbours instead of its own instalments.
  const opensFolder = current === '' || pages.some((page) => page.slug.startsWith(`${current}/`));
  const base = from ?? (opensFolder ? current : folderOf(current));

  if (from !== undefined && from !== '' && !pages.some((page) => page.slug.startsWith(from))) {
    throw new Error(`Cards found no page under "${from}": check the folder name.`);
  }

  const children = childrenOf(pages, base);
  const shown = [
    ...(of === 'pages' ? [] : children.series),
    ...(of === 'series' ? [] : children.pages),
  ].filter((page) => page.url !== context.url);

  return h(
    'div',
    { className: classNames(cls('cards'), className), style },
    shown.map((page) =>
      h(PageCard, {
        key: page.url,
        page,
        count: children.series.includes(page) ? countOf(pages, page.slug) : undefined,
      }),
    ),
  );
}
