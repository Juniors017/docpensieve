/**
 * Admonition: a block set apart from the text, which says how to read it — a
 * tip, a caution, a danger.
 *
 * Six kinds ship with the tool, and a project declares its own in its
 * configuration rather than waiting for the list to grow. A kind is a label
 * and a **tone**: the tone carries the colour, taken from the theme's tokens,
 * so a project adds a kind without touching a stylesheet, and the block
 * follows the palette of whichever theme is active (ADR-007).
 *
 * @module @docpensieve/components/admonition
 */

import { createElement as h } from 'react';

import { ADMONITION_TONES, DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';
import { LogoIcon } from './logo-icon.js';

/**
 * The kinds the tool ships with, each a label and a tone.
 *
 * `alert` and `danger` share a tone and differ in their label and their icon:
 * one calls for attention now, the other warns of what a wrong move costs.
 */
export const ADMONITION_KINDS = Object.freeze({
  note: { label: 'Note', tone: 'note' },
  info: { label: 'Info', tone: 'info' },
  tip: { label: 'Tip', tone: 'tip' },
  attention: { label: 'Attention', tone: 'attention' },
  alert: { label: 'Alert', tone: 'danger' },
  danger: { label: 'Danger', tone: 'danger' },
});

/**
 * Icons, drawn rather than written as characters: an emoji changes shape from
 * one system to the next, and carries a meaning screen readers announce.
 *
 * Each is a path on a 24 × 24 grid, stroked in the current colour — never
 * filled from CSS, which would turn an outline into a solid shape.
 *
 * @type {Record<string, string>}
 */
const PATHS = Object.freeze({
  note: 'M4 5h16M4 12h16M4 19h10',
  info: 'M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  tip: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .9 1.6h5.2c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z',
  attention:
    'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  alert: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  danger: 'M12 8v5M12 16h.01M8.6 2.6h6.8L21.4 8.6v6.8L15.4 21.4H8.6L2.6 15.4V8.6z',
});

/**
 * Kinds the project declares, set once for the whole compilation.
 *
 * Module state rather than a prop: an author writes `type="…"` and nothing
 * else, and `core` cannot hand this down without knowing this package
 * (ADR-002). The same reasoning as the theme's class table.
 *
 * @type {Record<string, { label: string, tone: string, icon?: string }>}
 */
let projectKinds = {};

/**
 * Declares the kinds of the project, beside the ones shipped.
 *
 * @param {Record<string, { label: string, tone: string, icon?: string }>} [kinds]
 */
export function setAdmonitionKinds(kinds = {}) {
  projectKinds = kinds;
}

/** @returns {Record<string, { label: string, tone: string, icon?: string }>} Every kind available. */
export function getAdmonitionKinds() {
  return { ...ADMONITION_KINDS, ...projectKinds };
}

/**
 * Block set apart from the text.
 *
 * @param {{
 *   className?: string, style?: object, children?: any,
 *   type?: string, title?: string,
 * }} props `type` names the kind; `title` replaces its label for this block
 *   alone.
 * @throws {DocPensieveError} When the kind is unknown.
 */
export function Admonition({ className, style, children, type = 'note', title, ...rest }) {
  const table = getAdmonitionKinds();
  const kind = table[type];

  // A kind nobody declared would render a block with no colour and no label —
  // exactly the silent nothing this project refuses.
  if (!kind) {
    throw new DocPensieveError(`Unknown admonition type: "${type}".`, {
      hint: `Known types: ${Object.keys(table).sort().join(', ')}. Declare your own in the admonitions field of the configuration.`,
    });
  }

  const tone = ADMONITION_TONES.includes(kind.tone) ? kind.tone : 'note';

  return h(
    'aside',
    {
      className: classNames(cls('admonition', tone), className),
      style,
      // Set apart from the flow of the text, and announced as such.
      role: 'note',
      ...rest,
    },
    h(
      'p',
      { className: cls('admonitionTitle') },
      // A kind may bring a mark of its own — a logo, inlined from the version
      // folder. Without one, the drawing of its tone stands.
      kind.icon
        ? h(LogoIcon, { className: cls('admonitionIcon'), src: kind.icon })
        : h(
            'svg',
            {
              className: cls('admonitionIcon'),
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 2,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              // The title beside it already names the kind: announcing the
              // icon too would say it twice.
              'aria-hidden': 'true',
              focusable: 'false',
            },
            h('path', { d: PATHS[type] ?? PATHS[tone] ?? PATHS.note }),
          ),
      title ?? kind.label,
    ),
    h('div', { className: cls('admonitionBody') }, children),
  );
}
