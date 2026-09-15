/** @type {import('@docpensieve/core').DocPensieveConfig} */
export default {
  projectName: 'Nimbus handbook',
  versions: [{ slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true }],

  // No utility framework, and always dark: the classes the pages use are in
  // theme/custom.css.
  theme: { framework: 'custom', darkMode: 'dark' },
};
