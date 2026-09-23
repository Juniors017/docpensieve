/**
 * Banner at the head of a page.
 *
 * A landing page opens on three things: what this is, what it does, and where
 * to start. Written by hand that is a `div`, a class of the project's own and
 * a dozen rules in its configuration — which every site then writes again.
 *
 * It is **not a card**: no border, no panel. What a banner is made of is
 * space, a title large enough to be the first thing read, and one way in that
 * stands out from the rest. A frame is available for the page that wants one,
 * and it is not the default.
 *
 * Its classes are `dp-banner*`, after what the element is rather than after
 * the component. A site that already dresses a banner of its own under some
 * name keeps it untouched: adopting the component stays a decision, not
 * something an upgrade does to a page — which is exactly what happened here
 * when these rules were first written as `dp-hero`.
 *
 * @module @docpensieve/components/hero
 */

import { createElement as h } from 'react';

import { ADMONITION_TONES, DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';

/** How the words sit when the banner is a single column. */
export const HERO_ALIGNMENTS = Object.freeze(['center', 'start']);

/** How much room it takes. `full` is the height of the screen. */
export const HERO_SIZES = Object.freeze(['small', 'medium', 'large', 'full']);

/**
 * Tones a banner can take.
 *
 * The same ones an admonition carries: a theme defines a colour per tone, not
 * a colour per component, so a project that gives `attention` its own colour
 * gives it to both at once.
 */
export const HERO_TONES = ADMONITION_TONES;

/**
 * Head of a page: a name, a sentence, and the way in.
 *
 * A `HeroVisual` among its children turns it into two columns — the words on
 * one side, the picture on the other — which is what a landing page does when
 * it has something to show. Nothing to declare: having a visual is what makes
 * it a split.
 *
 * @example
 * <Hero size="large">
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
 *   className?: string, style?: object, children?: any,
 *   align?: string, size?: string, tone?: string, frame?: boolean,
 * }} props `align` is `center` (the default) or `start`; `size` is `small`,
 *   `medium`, `large` or `full`; `tone` names the colour it is lit with;
 *   `frame` draws the panel a banner does not have by default.
 * @throws {DocPensieveError} With an alignment, a size or a tone that does
 *   not exist.
 */
export function Hero({
  className,
  style,
  children,
  align = 'center',
  size = 'medium',
  tone = 'note',
  frame = false,
}) {
  check('alignment', align, HERO_ALIGNMENTS);
  check('size', size, HERO_SIZES);
  check('tone', tone, HERO_TONES);

  return h(
    'section',
    {
      className: classNames(
        // `center`, `medium` and `note` are what the base class already says:
        // writing them as variants too would be three classes that change
        // nothing, and a reader of the markup would look for what they do.
        cls(
          'banner',
          align !== 'center' && align,
          size !== 'medium' && size,
          tone !== 'note' && tone,
          frame && 'framed',
        ),
        className,
      ),
      style,
    },
    children,
  );
}

/**
 * Refuses a value the component does not know, and says which it does.
 *
 * @param {string} what Name of the property, for the message.
 * @param {string} value
 * @param {readonly string[]} accepted
 * @throws {DocPensieveError}
 */
function check(what, value, accepted) {
  if (accepted.includes(value)) return;
  throw new DocPensieveError(`Unknown hero ${what}: "${value}".`, {
    hint: `Accepted values: ${accepted.join(', ')}.`,
  });
}

/**
 * The words of a banner, when it also has something to show.
 *
 * Only needed in a split: on its own, a banner's children are its words
 * already.
 *
 * @param {{ className?: string, style?: object, children?: any }} props
 */
export function HeroText({ className, style, children }) {
  return h('div', { className: classNames(cls('bannerText'), className), style }, children);
}

/**
 * The picture, the screenshot or the diagram beside the words.
 *
 * Its presence is what makes a banner a split: a landing page with something
 * to show shows it, and one without stays a single column.
 *
 * @param {{ className?: string, style?: object, children?: any }} props
 */
export function HeroVisual({ className, style, children }) {
  return h('div', { className: classNames(cls('bannerVisual'), className), style }, children);
}

/**
 * Row of ways in, under the sentence of a banner.
 *
 * Its children are links, which Markdown writes as links: the row is what
 * turns them into something to press, and the first one into the one meant.
 * One primary action and one alternative is the shape that reads: a row of
 * five is a row of none.
 *
 * @example
 * <HeroActions>[Get started](/guide/) [See the components](/components/)</HeroActions>
 *
 * @param {{ className?: string, style?: object, children?: any }} props
 */
export function HeroActions({ className, style, children }) {
  return h('div', { className: classNames(cls('bannerActions'), className), style }, children);
}
