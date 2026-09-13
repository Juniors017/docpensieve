/**
 * Collapsible tree.
 *
 * No JavaScript: expanding is the native behaviour of `<details>`, which
 * works from the keyboard and stays printable.
 *
 * The structure is a nested list, not a `role="tree"`. That role promises a
 * screen reader arrow-key navigation that nothing here would implement:
 * announcing it would lie about what the page can do.
 *
 * @module @docpensieve/components/tree
 */

import { createContext, createElement as h, useContext } from 'react';

import { DocPensieveError } from '@docpensieve/shared';

import { classNames, cls } from './classes.js';

/**
 * Marks the inside of a tree.
 *
 * A lone entry would produce an `<li>` outside any list: invalid HTML that no
 * browser reports and nobody notices.
 */
const InTree = createContext(false);

/**
 * Root of a tree.
 *
 * @param {{ className?: string, style?: object, children?: any }} props
 */
export function Tree({ className, style, children }) {
  return h(
    InTree.Provider,
    { value: true },
    h('ul', { className: classNames(cls('tree'), className), style }, children),
  );
}

/**
 * Entry of a tree.
 *
 * With children, it is a collapsible branch; without, a leaf. The difference
 * is read from the writing, with no prop to set.
 *
 * @param {{
 *   className?: string, style?: object, children?: any,
 *   label?: any, open?: boolean,
 * }} props `open` expands the branch as soon as the page opens.
 * @throws {DocPensieveError} Outside a `Tree`, or without a label.
 */
export function TreeItem({ className, style, children, label, open = false }) {
  const inTree = useContext(InTree);

  if (!inTree) {
    throw new DocPensieveError('A <TreeItem> was written outside a <Tree>.', {
      hint: 'Wrap the entries: <Tree><TreeItem label="…" /></Tree>.',
    });
  }

  if (label === undefined || label === null || label === '') {
    throw new DocPensieveError('A <TreeItem> without a label.', {
      hint: 'Give it a label: <TreeItem label="src" />.',
    });
  }

  const leaf = children === undefined || children === null || children === false;

  if (leaf) {
    return h(
      'li',
      { className: classNames(cls('treeItem', 'leaf'), className), style },
      h('span', { className: cls('treeLabel') }, label),
    );
  }

  return h(
    'li',
    { className: classNames(cls('treeItem', 'branch'), className), style },
    h(
      'details',
      { className: cls('treeDetails'), open },
      h('summary', { className: cls('treeLabel') }, label),
      h('ul', { className: cls('tree') }, children),
    ),
  );
}
