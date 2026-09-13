/**
 * Level gauge, as a bar or a circle.
 *
 * No JavaScript: the fill is done in CSS, and animates as it enters the
 * viewport where `animation-timeline` exists. Elsewhere, the gauge is simply
 * full — the value stays readable, which is what matters.
 *
 * @module @docpensieve/components/skill
 */

import { Fragment, createElement as h } from 'react';

import { DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';

/** Shapes accepted by the gauge. */
export const SKILL_SHAPES = Object.freeze(['bar', 'circle']);

/**
 * Radius giving the circle a circumference of a hundred units.
 *
 * Chosen for that reason: the level then goes as is into `stroke-dasharray`,
 * with no multiplication or rounding. `100 / (2 * Math.PI)`.
 */
const RADIUS = 15.915_494;

/**
 * Bar gauge.
 *
 * @param {{ level: number, name: any, showValue: boolean, icon?: any, accessibleName: string }} props
 * @returns {any}
 */
function Bar({ level, name, showValue, icon, accessibleName }) {
  // Fragment rather than a div: one more wrapper would bring nothing and
  // would stand between the gauge and its parts.
  return h(
    Fragment,
    null,
    h(
      'div',
      { className: cls('skillHead') },
      h(
        'span',
        { className: cls('skillName') },
        icon ? h('span', { className: cls('skillIcon') }, icon) : null,
        name,
      ),
      showValue ? h('span', { className: cls('skillValue') }, `${level}%`) : null,
    ),
    h(
      'div',
      { className: cls('skillTrack'), ...measure(level, accessibleName) },
      h('div', {
        className: cls('skillFill'),
        // The value goes through a variable: the entry animation uses it as
        // its end point, and the base rule as the width.
        style: { '--dp-skill-level': `${level}%` },
      }),
    ),
  );
}

/**
 * Circle gauge.
 *
 * The SVG is decorative: the wrapper carries the role and the value, so what
 * is announced does not depend on what is drawn.
 *
 * @param {{ level: number, name: any, showValue: boolean, icon?: any, accessibleName: string }} props
 * @returns {any}
 */
function Circle({ level, name, showValue, icon, accessibleName }) {
  return h(
    Fragment,
    null,
    h(
      'div',
      { className: cls('skillDial'), ...measure(level, accessibleName) },
      h(
        'svg',
        { viewBox: '0 0 36 36', 'aria-hidden': 'true', focusable: 'false' },
        h('circle', { className: cls('skillDialTrack'), cx: 18, cy: 18, r: RADIUS }),
        h('circle', {
          className: cls('skillDialFill'),
          cx: 18,
          cy: 18,
          r: RADIUS,
          // With a circumference of a hundred, the level is directly the
          // drawn share. The entry animation starts from zero and ends here.
          style: { '--dp-skill-level': String(level) },
        }),
      ),
      showValue ? h('span', { className: cls('skillDialValue') }, `${level}%`) : null,
    ),
    h(
      'div',
      { className: cls('skillName') },
      icon ? h('span', { className: cls('skillIcon') }, icon) : null,
      name,
    ),
  );
}

/**
 * Attributes describing the measure.
 *
 * `meter` describes exactly this: a value within a known range. The role
 * carries it, so hiding it on screen does not remove it from what a screen
 * reader announces.
 *
 * @param {number} level
 * @param {string} name Name announced by a screen reader.
 * @returns {Record<string, unknown>}
 */
function measure(level, name) {
  return {
    role: 'meter',
    'aria-valuenow': level,
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'aria-label': name,
  };
}

/**
 * Named gauge, from 0 to 100.
 *
 * @example
 * <Skill name="Accessibility" level={80} />
 * <Skill name="Accessibility" level={80} shape="circle" />
 *
 * @param {{
 *   className?: string, style?: object, children?: any,
 *   name?: any, level?: number, showValue?: boolean, shape?: string,
 *   icon?: any, color?: string, label?: string,
 * }} props `children` stands as a comment under the gauge. `showValue` hides
 *   the numeric percentage without touching what the gauge announces.
 *   `shape` picks between the bar and the circle. `icon` goes before the
 *   name — a `LogoIcon` fits there. `color` tints the fill: any CSS colour,
 *   the accent colour by default. `label` names the gauge for screen readers
 *   when `name` is not text.
 * @throws {DocPensieveError} Without a name, outside 0–100, or with an
 *   unknown shape.
 */
export function Skill({
  className,
  style,
  children,
  name,
  level,
  showValue = true,
  shape = 'bar',
  icon,
  color,
  label,
}) {
  if (name === undefined || name === null || name === '') {
    throw new DocPensieveError('A <Skill> without a name.', {
      hint: 'Give it a name: <Skill name="CSS" level={80} />.',
    });
  }

  if (typeof level !== 'number' || Number.isNaN(level) || level < 0 || level > 100) {
    throw new DocPensieveError(`Invalid level for "${name}": "${level}".`, {
      hint: 'level expects a number from 0 to 100.',
    });
  }

  if (!SKILL_SHAPES.includes(shape)) {
    throw new DocPensieveError(`Unknown gauge shape: "${shape}".`, {
      hint: `Accepted values: ${SKILL_SHAPES.join(', ')}.`,
    });
  }

  // The name a screen reader announces: `name` if it is text, otherwise
  // `label`. With neither, the gauge announced itself as “45%” without saying
  // of what — the only case where this component kept quiet instead of
  // throwing.
  const accessibleName = typeof name === 'string' ? name : label;
  if (typeof accessibleName !== 'string' || accessibleName === '') {
    throw new DocPensieveError('A <Skill> whose name is not text must carry label.', {
      hint: 'Add label="…": it is the name a screen reader will read.',
    });
  }

  const Shape = shape === 'circle' ? Circle : Bar;

  return h(
    'div',
    {
      className: classNames(cls('skill', shape === 'circle' && 'circle'), className),
      // The tint goes through a variable: bar and circle read it in the same
      // place, and a project can set it higher up for a whole group.
      style: color ? { '--dp-skill-color': color, ...style } : style,
    },
    h(Shape, { level, name, showValue, icon, accessibleName }),
    children ? h('div', { className: cls('skillNote') }, children) : null,
  );
}
