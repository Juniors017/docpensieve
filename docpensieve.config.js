/**
 * DocPensieve configuration.
 *
 * `defineConfig` transforms nothing: it only provides autocompletion and type
 * checking in the editor.
 */
import { readFileSync } from 'node:fs';

import { defineConfig } from '@docpensieve/core';

// The version main carries labels the version being written: readers compare
// what they installed with what they read. `npm run version:all` bumps it
// along with the packages.
const { version: published } = JSON.parse(
  readFileSync(new URL('./packages/cli/package.json', import.meta.url), 'utf8'),
);

export default defineConfig({
  projectName: 'DocPensieve',
  // Served at the root of its own domain: links carry no prefix, and
  // robots.txt is written, since that is where crawlers read it.
  siteUrl: 'https://docpensieve.com',

  // The project's images, from the root: beside the name in the header, in
  // the browser tab, and as the preview of a shared page. The full logo,
  // branding/logo.jpg, is too detailed at the size of a header or a tab: they
  // take the bowl alone, cut square. A version may carry its own instead.
  logo: 'branding/mark.png',
  favicon: 'branding/favicon.png',
  socialImage: 'branding/social.jpg',

  // One entry per version. `folder` points to the Markdown/MDX sources; the
  // compiled output then goes to an orphan branch with the same slug.
  //
  // Three tracks: the 0.3 is being written, the 0.2 is the current one, and
  // the 0.1 is archived and only receives fixes.
  //
  // The slugs name the channel, not the number: a link to /versions/latest/
  // always leads to the documentation that counts, and /versions/beta/ to the
  // one being prepared. A number in the URL could only ever be a truncated
  // one — "v0.1" while the label reads 0.1.5 — and would move at every
  // release. A version takes a numbered slug when it is archived: its content
  // freezes, so its address can freeze with it.
  //
  // The numbers follow those of the packages: in 0.x, a breaking change needs
  // no ceremony, which suits an API that is still moving.
  versions: [
    {
      slug: 'beta',
      name: published,
      folder: 'docs/v0.3',
      prerelease: true,
      // The beta is told apart at a glance: its bowl is on fire.
      logo: 'branding/mark-beta.png',
      favicon: 'branding/favicon-beta.png',
    },
    // Frozen at the 0.2 published on npm: main carries the 0.3 now.
    { slug: 'latest', name: '0.2.0', folder: 'docs/v0.2', current: true },
    // Archived: its content is frozen, so its address freezes with it — a
    // numbered slug. A fix released from release/0.1 updates this label by
    // hand.
    { slug: 'v0.1', name: '0.1.5', folder: 'docs/v0.1', archived: true },
  ],

  outDir: 'dist',

  theme: {
    framework: 'tailwind',
    // Always dark, on the ground of the logo: the palette is in theme/site.css.
    darkMode: 'dark',
    // A light / dark button, dark by default: the one script of the pages.
    toggle: true,

    // Styling specific to this site: the entrance hall and its two buttons.
    // Written here rather than as utilities in the page, for a practical
    // reason: a long string of classes in MDX ends up broken over several
    // lines by the formatter, and a text alone on its line becomes a
    // paragraph. Short classes fit on one line and keep their meaning.
    css: [
      '.dp-hero { text-align: center; padding: 2rem 0 0.5rem; }',
      '.dp-hero h1 { margin-bottom: 0.4rem; }',
      '.dp-hero > p { max-width: 38rem; margin-inline: auto; font-size: 1.15rem; color: var(--dp-text-soft); }',
      '.dp-actions { margin-top: 1.75rem; }',
      '.dp-actions > p { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; margin: 0; }',
      '.dp-actions a { display: inline-flex; align-items: center; padding: 0.6rem 1.25rem; border: 1px solid var(--dp-border); border-radius: var(--dp-radius); color: var(--dp-text); font-weight: 500; text-decoration: none; }',
      '.dp-actions a:first-child { background: var(--dp-accent); border-color: var(--dp-accent); color: var(--dp-bg); }',
      '.dp-actions a:hover { border-color: var(--dp-accent); }',
    ].join('\n'),
  },

  // 'auto': the sidebar is derived from the file tree and the 01-, 02-
  // prefixes. It is the only value available today.
  sidebar: 'auto',

  // Authors described in docs/v0.3/authors.json. The older versions have no
  // such file and show the names alone: the file is optional per version.
  authors: 'authors.json',

  // The examples exist in the beta only, while readers land on latest: the
  // link names its version, so that every version leads there. On the release
  // of the 0.3, the examples move to latest along with it.
  headerLinks: [{ label: 'Examples', href: '/examples/', version: 'beta' }],

  globalComponents: true,

  jsonld: { enabled: true },
});
