/** @type {import('@docpensieve/core').DocPensieveConfig} */
export default {
  projectName: 'Acme docs',
  siteUrl: 'https://docs.example.com',
  versions: [{ slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true }],
  theme: { framework: 'tailwind', darkMode: 'class' },

  // The menu is written by hand, in docs/v1.0/sidebar.json.
  sidebar: 'sidebar.json',

  // The pages that carry a date — the news — make an RSS feed.
  feed: true,
};
