/**
 * Banner at the head of a page.
 *
 * A landing page opens on a name, a sentence and a way in. Written by hand
 * that is a `div` and a pile of utility classes, which say nothing to the
 * custom theme: the home page of this very site carried a `dp-hero` class no
 * rule ever styled, and nothing reported it — the page looked right only
 * because of the utilities around it.
 *
 * @module @docpensieve/components/hero
 */

import { createElement as h } from 'react';

import { DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';

/** How the banner sits, and what the templates are asked for. */
export const HERO_ALIGNMENTS = Object.freeze(['center', 'start']);

/**
 * Head of a page: a name, a sentence, and the way in.
 *
 * @example
 * <Hero>
 *
 * # DocPensieve
 *
 * Markdown in, static HTML out.
 *
 * <HeroActions>[Get started](/guide/)</HeroActions>
 *
 * </Hero>
 *
 * @param {{
 *   className?: string, style?: object, children?: any, align?: string,
 * }} props `align` is `center` (the default) or `start`.
 * @throws {DocPensieveError} With an alignment that does not exist.
 */
export function Hero({ className, style, children, align = 'center' }) {
  if (!HERO_ALIGNMENTS.includes(align)) {
    throw new DocPensieveError(`Unknown hero alignment: "${align}".`, {
      hint: `Accepted values: ${HERO_ALIGNMENTS.join(', ')}.`,
    });
  }

  return h(
    'section',
    {
      className: classNames(cls('hero', align !== 'center' && align), className),
      style,
    },
    children,
  );
}

/**
 * Row of ways in, under the sentence of a banner.
 *
 * Its children are links, which Markdown writes as links: the row is what
 * turns them into something to press, and the first one into the one meant.
 *
 * @example
 * <HeroActions>[Get started](/guide/) [See the components](/components/)</HeroActions>
 *
 * @param {{ className?: string, style?: object, children?: any }} props
 */
export function HeroActions({ className, style, children }) {
  return h('div', { className: classNames(cls('heroActions'), className), style }, children);
}
