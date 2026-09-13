/**
 * DocPensieve configuration.
 *
 * `defineConfig` transforms nothing: it only provides autocompletion and type
 * checking in the editor.
 */
import { defineConfig } from '@docpensieve/core';

export default defineConfig({
  projectName: 'DocPensieve',
  siteUrl: 'https://juniors017.github.io/docpensieve',

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
    { slug: 'v0.1', name: '0.1', folder: 'docs/v0.1', current: true },
  ],

  outDir: 'dist',

  theme: {
    framework: 'tailwind',
    darkMode: 'class',

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
