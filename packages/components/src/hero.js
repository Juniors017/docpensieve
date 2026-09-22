/**
 * Banner at the head of a page.
 *
 * A landing page opens on three things: what this is, what it does, and where
 * to start. Written by hand that is a `div` and a pile of utility classes,
 * which say nothing to a theme that has no utilities: the home page of this
 * very site carried a `dp-hero` class no rule ever styled, and nothing
 * reported it — the page looked right only because of the utilities around it.
 *
 * @module @docpensieve/components/hero
 */

import { createElement as h } from 'react';

import { ADMONITION_TONES, DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';

/** How the banner sits within its page. */
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
 *   align?: string, size?: string, tone?: string,
 * }} props `align` is `center` (the default) or `start`; `size` is `small`,
 *   `medium`, `large` or `full`; `tone` names the colour the banner is lit
 *   with.
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
          'hero',
          align !== 'center' && align,
          size !== 'medium' && size,
          tone !== 'note' && tone,
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
