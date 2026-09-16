/**
 * Registry of global components.
 *
 * The components registered here are passed to @mdx-js/mdx as the
 * `components` table: they become usable in any `.mdx` without an import.
 *
 * @module @docpensieve/components/registry
 */

import { Card, CardBody, CardFooter, CardHeader, CardImage } from './card.js';
import { Cards } from './cards.js';
import { Column, Columns } from './columns.js';
import { ForTheme } from './for-theme.js';
import { LogoIcon } from './logo-icon.js';
import { ScrollToTop } from './scroll-to-top.js';
import { Skill } from './skill.js';
import { FallbackAfter, FallbackBefore, TimeTimer } from './time-timer.js';
import { Tooltip } from './tooltip.js';
import { Tree, TreeItem } from './tree.js';

/**
 * Components shipped with DocPensieve.
 * @type {Record<string, Function>}
 */
export const builtinComponents = {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardImage,
  Cards,
  Columns,
  Column,
  TimeTimer,
  FallbackBefore,
  FallbackAfter,
  Tooltip,
  Tree,
  TreeItem,
  ScrollToTop,
  Skill,
  LogoIcon,
  ForTheme,
};

/**
 * Builds the component table passed to the MDX compiler.
 *
 * @param {Record<string, Function>} [userComponents] Project components, which
 *   override the built-in components of the same name.
 * @returns {Record<string, Function>} Table ready for @mdx-js/mdx.
 */
export function createRegistry(userComponents = {}) {
  return { ...builtinComponents, ...userComponents };
}

/**
 * Lists the available component names — useful for a readable error message
 * when an `.mdx` references an unknown component.
 *
 * @param {Record<string, Function>} registry
 * @returns {string[]} Names sorted alphabetically.
 */
export function listComponentNames(registry) {
  return Object.keys(registry).sort();
}
