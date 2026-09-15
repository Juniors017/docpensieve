/**
 * DocPensieve configuration.
 *
 * `defineConfig` transforms nothing: it only provides autocompletion and type
 * checking in the editor.
 */
import { readFileSync } from 'node:fs';

import { defineConfig } from '@docpensieve/core';

// The label of the current version is the version published on npm: a
// documentation version covers a whole 0.x series, but readers compare what
// they installed with what they read. `npm run version:all` bumps it along
// with the packages.
const { version: published } = JSON.parse(
  readFileSync(new URL('./packages/cli/package.json', import.meta.url), 'utf8'),
);

export default defineConfig({
  projectName: 'DocPensieve',
  siteUrl: 'https://juniors017.github.io/docpensieve',

  // The project's images, from the root: beside the name in the header, in
  // the browser tab, and as the preview of a shared page. The full logo,
  // branding/logo.jpg, is too tall and too detailed for the first two: they
  // take the bowl alone, cut square.
  logo: 'branding/mark.png',
  favicon: 'branding/favicon.png',
  socialImage: 'branding/social.jpg',

  // One entry per version. `folder` points to the Markdown/MDX sources; the
  // compiled output then goes to an orphan branch with the same slug.
  //
  // Two tracks: 0.1 is the current one and only receives fixes, 0.2 is the
  // one being written. The beta's slug is already its final slug — only the
  // label will change at release, so no link will break.
  //
  // The numbers follow those of the packages: in 0.x, a breaking change needs
  // no ceremony, which suits an API that is still moving.
  versions: [
    { slug: 'v0.2', name: '0.2 (beta)', folder: 'docs/v0.2', prerelease: true },
    { slug: 'v0.1', name: published, folder: 'docs/v0.1', current: true },
  ],

  outDir: 'dist',

  theme: {
    framework: 'tailwind',
    // Always dark, on the ground of the logo: the palette is in theme/site.css.
    darkMode: 'dark',

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

  globalComponents: true,

  jsonld: { enabled: true },
});
