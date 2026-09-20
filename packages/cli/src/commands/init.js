/**
 * `docpensieve init` command — sets up a documentation project.
 *
 * @module docpensieve/commands/init
 */

import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import {
  CONFIG_FILENAME,
  CONFIG_FILENAMES,
  DOCUMENTATION_URL,
  DocPensieveError,
  THEME_FOLDER,
  THEME_FRAMEWORKS,
  isLanguageCode,
  languageName,
} from '@docpensieve/shared';

/**
 * Description shown next to each framework.
 * @type {Record<string, string>}
 */
const FRAMEWORK_LABELS = {
  tailwind: 'Tailwind CSS — ships with the tool, nothing to install',
  custom: 'custom theme, light stylesheet, your own classes in theme/',
};

/** Answers used when there is no dialogue. */
const DEFAULTS = {
  name: 'My documentation',
  siteUrl: '',
  theme: 'tailwind',
  version: '1.0',
  translation: '',
};

/** Second language offered first, being the one whose wording ships too. */
const DEFAULT_TRANSLATION = 'fr';

/**
 * Folder of the installed DocPensieve documentation, inside the version folder.
 *
 * The prefix puts it last in the menu, after the project's own pages, and
 * vanishes from the URL: the section is served under `/docpensieve/`.
 */
const DOCS_FOLDER = '99-docpensieve';

/**
 * Stylesheet of the documentation's examples, shipped next to its pages.
 * Under the custom theme, it goes to the theme folder, not among the pages.
 */
const EXAMPLES_CSS = 'examples.css';

/**
 * Entries of DocPensieve's documentation that are not installed with the
 * pages: its home page and the icons only that page uses, the example site
 * and the author descriptions belong to DocPensieve's own site, and the
 * examples' stylesheet has a place of its own. Installed, the author file
 * would even be published as a plain file on every user's site.
 */
const NOT_INSTALLED = new Set([
  'index.md',
  'index.mdx',
  'icons',
  '06-examples',
  'authors.json',
  EXAMPLES_CSS,
]);

/** Starting point of the project's own stylesheet, under the custom theme. */
const CUSTOM_CSS = fileURLToPath(new URL('../templates/custom.css', import.meta.url));

/**
 * Asks a question, with a default value shown between brackets.
 *
 * @param {import('node:readline/promises').Interface} rl
 * @param {string} question
 * @param {string} fallback
 * @returns {Promise<string>}
 */
async function ask(rl, question, fallback) {
  const suffix = fallback ? ` [${fallback}]` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

/**
 * Asks for the CSS framework among those the configuration accepts.
 *
 * @param {import('node:readline/promises').Interface} rl
 * @returns {Promise<string>}
 */
async function askFramework(rl) {
  console.log('\nCSS framework:');
  THEME_FRAMEWORKS.forEach((framework, index) => {
    console.log(`  ${index + 1}. ${framework} — ${FRAMEWORK_LABELS[framework] ?? ''}`);
  });

  for (;;) {
    const answer = (await rl.question(`Your choice [1-${THEME_FRAMEWORKS.length}]: `)).trim();
    if (answer === '') return THEME_FRAMEWORKS[0];

    // Accept the number as well as the name: typing “tailwind” is more natural
    // than counting lines.
    const byName = THEME_FRAMEWORKS.find((framework) => framework === answer.toLowerCase());
    if (byName) return byName;

    const index = Number(answer);
    if (Number.isInteger(index) && index >= 1 && index <= THEME_FRAMEWORKS.length) {
      return THEME_FRAMEWORKS[index - 1];
    }
    console.log(`Answer not understood. Expected: a number, or ${THEME_FRAMEWORKS.join(', ')}.`);
  }
}

/**
 * Asks whether to install DocPensieve's documentation in the new site.
 *
 * @param {import('node:readline/promises').Interface} rl
 * @returns {Promise<boolean>}
 */
async function askDocumentation(rl) {
  for (;;) {
    const answer = (await rl.question("Install DocPensieve's documentation in the site? [Y/n]: "))
      .trim()
      .toLowerCase();
    if (answer === '' || answer === 'y' || answer === 'yes') return true;
    if (answer === 'n' || answer === 'no') return false;
    console.log('Answer not understood. Expected: y or n.');
  }
}

/**
 * Asks whether the site will carry a second language, and which one.
 *
 * Asked rather than left to the configuration: a translation changes the
 * shape of the project — a folder per language beside the pages — and that is
 * cheaper to set up at the start than to retrofit.
 *
 * @param {import('node:readline/promises').Interface} rl
 * @returns {Promise<string>} Language code, or `''` for a single language.
 */
async function askTranslation(rl) {
  for (;;) {
    const answer = (await rl.question('Will the site be in several languages? [y/N]: '))
      .trim()
      .toLowerCase();
    if (answer === '' || answer === 'n' || answer === 'no') return '';
    if (answer === 'y' || answer === 'yes') break;
    console.log('Answer not understood. Expected: y or n.');
  }

  for (;;) {
    const code = (await ask(rl, 'Code of the second language', DEFAULT_TRANSLATION)).trim();
    if (isLanguageCode(code)) return code;
    console.log(`"${code}" does not name a language. Expected a code: fr, de, pt-BR, zh-Hans.`);
  }
}

/**
 * Gathers the answers, through a dialogue or from the options.
 *
 * @param {{
 *   name?: string, theme?: string, siteUrl?: string, version?: string,
 *   translation?: string, yes?: boolean, minimal?: boolean,
 * }} options
 * @returns {Promise<{
 *   name: string, theme: string, siteUrl: string, version: string, docs: boolean,
 *   translation: string,
 * }>}
 */
async function collect(options) {
  const fromOptions = {
    name: options.name ?? DEFAULTS.name,
    siteUrl: options.siteUrl ?? DEFAULTS.siteUrl,
    theme: options.theme ?? DEFAULTS.theme,
    version: options.version ?? DEFAULTS.version,
    translation: options.translation ?? DEFAULTS.translation,
    docs: !options.minimal,
  };

  if (options.yes) return fromOptions;

  // Without a terminal — script, CI, pipe — the dialogue would never complete:
  // stick to the options and the defaults. But say so: some terminals run
  // programs without handing them one, and the questions used to vanish
  // without a word, the defaults going unnoticed.
  if (!process.stdin.isTTY) {
    console.log('No interactive terminal: no questions asked, the options and defaults apply.');
    console.log(
      'To choose, pass --name, --site-url, --theme, --version-name, --translation or --minimal; --yes silences this notice.',
    );
    return fromOptions;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const name = await ask(rl, 'Project name', fromOptions.name);
    const siteUrl = await ask(rl, 'Public URL of the site (optional)', fromOptions.siteUrl);
    const version = await ask(rl, 'First version', fromOptions.version);
    const translation = options.translation ?? (await askTranslation(rl));
    const theme = options.theme ?? (await askFramework(rl));
    const docs = options.minimal ? false : await askDocumentation(rl);
    return { name, siteUrl, version, theme, docs, translation };
  } finally {
    rl.close();
  }
}

/**
 * Quotes a string in the project's style.
 *
 * `JSON.stringify` would produce double quotes, against the grain of the rest
 * of the generated file — the one the user opens first.
 *
 * @param {string} value
 * @returns {string}
 */
const quote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * Writes a language code as a property name.
 *
 * `fr` stands on its own; `pt-BR` and `zh-Hans` carry a hyphen, which is a
 * minus sign to JavaScript — unquoted, the generated configuration would not
 * parse.
 *
 * @param {string} code
 * @returns {string}
 */
const key = (code) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(code) ? code : quote(code));

/**
 * Renders `docpensieve.config.mjs`.
 *
 * Every field the configuration accepts appears in it — set to its default,
 * or commented out with an example — so that the first file a user opens also
 * tells them everything they can change.
 *
 * @param {{
 *   name: string, theme: string, siteUrl: string, version: string,
 *   translation?: string,
 * }} answers
 * @returns {string} Contents of `docpensieve.config.mjs`.
 */
function renderConfig({ name, theme, siteUrl, version, translation = '' }) {
  const slug = versionSlug(version);
  // A type annotation rather than an `import`: `defineConfig` transforms
  // nothing, it is only there for autocompletion. Actually importing it would
  // make the configuration unreadable in a folder where the package is not
  // installed — that is, at the first `build` after an `npx`. A JSDoc
  // `import()` type disappears at run time.
  const lines = [
    "/** @type {import('@docpensieve/core').DocPensieveConfig} */",
    'export default {',
    '  // Name shown in the header, in the page titles and in the structured data.',
    `  projectName: ${quote(name)},`,
    '',
    '  // Public address of the site. It feeds the canonical links and the',
    '  // structured data, and its path gives the deployment prefix.',
    siteUrl ? `  siteUrl: ${quote(siteUrl)},` : "  // siteUrl: 'https://example.com/my-project',",
    "  // baseUrl: '/my-project/', // only to depart from the path of siteUrl",
    '',
    '  // Images, from the project root. logo: beside the name, in the header;',
    '  // favicon: the browser tab (.ico, .png or .svg); socialImage: the preview',
    '  // of a shared page, 1200 × 630 pixels as a rule — it needs siteUrl.',
    "  // logo: 'branding/logo.png',",
    "  // favicon: 'branding/favicon.png',",
    "  // socialImage: 'branding/social.png',",
    '',
    '  // Language of the pages, in <html lang>. The labels of the page shell',
    '  // stay in English.',
    "  lang: 'en',",
    '',
    '  // One entry per version, each one a folder of Markdown and MDX pages.',
    '  //   current     the version the site root leads to — at most one',
    '  //   prerelease  in preparation: a banner on every page, kept out of search',
    '  //   archived    no longer maintained: a banner, still indexed',
    '  //   translations  a folder per language, served under its code',
    '  versions: [',
    '    {',
    `      slug: ${quote(slug)}, // URL segment, and name of the version's branch`,
    `      name: ${quote(version)}, // label in the version switcher`,
    `      folder: ${quote(`docs/${slug}`)},`,
    '      current: true,',
    `      // Pages of this version in another language, served under /${translation || 'fr'}/.`,
    '      // Your own language stays where it is, and keeps its addresses.',
    // Written out, not left as an example, once the language is known: the
    // field is the whole of the feature, and the folder beside it already
    // holds a page.
    translation
      ? `      translations: { ${key(translation)}: ${quote(`docs/${slug}-${translation}`)} },`
      : `      // translations: { fr: ${quote(`docs/${slug}-fr`)} },`,
    '    },',
    '  ],',
    '',
    '  // Output folder of "docpensieve build".',
    "  outDir: 'dist',",
    '',
    '  theme: {',
    "    // 'tailwind' compiles the utilities your pages use; 'custom' is a plain",
    '    // stylesheet with no dependency.',
    `    framework: ${quote(theme)},`,
    "    // 'class' follows the reader's system; 'dark' or 'light' keeps one scheme.",
    "    darkMode: 'class',",
    '    // A light / dark button in the header, which remembers the choice: a few',
    '    // lines of inline script in every page. false removes it, and the pages',
    '    // then load no script.',
    '    toggle: true,',
    '',
    '    // Design tokens to override, for instance the accent colour:',
    "    // tokens: { '--dp-accent': '#008060', '--dp-radius': '0.75rem' },",
    '',
    '    // CSS appended to the stylesheet, outside any layer: it wins over the',
    '    // default rules.',
    "    // css: '.dp-article h2 { letter-spacing: -0.01em; }',",
    '',
    '    // Longer rules go in the theme/ folder: every .css file in it is',
    '    // appended after the theme, and "docpensieve dev" picks up changes.',
    ...(theme === 'tailwind'
      ? [
          '',
          '    // Entry stylesheet handed to Tailwind, to add a @theme block for',
          '    // instance.',
          `    // source: '@import "tailwindcss";',`,
        ]
      : []),
    '  },',
    '',
    "  // 'auto': the menu follows the folders and the 01-, 02- prefixes. To write",
    "  // it by hand, name a JSON file instead — 'sidebar.json' — read from each",
    '  // version folder.',
    "  sidebar: 'auto',",
    '',
    '  // Authors described in a JSON file of each version folder: a name, a',
    '  // biography, an avatar, a link. Left empty, a page still shows the',
    '  // names its frontmatter gives, without the rest.',
    "  authors: '',",
    '',
    '  // Links of the header, beside the version switcher — behind a menu button',
    "  // on a narrow screen. For instance [{ label: 'Blog', href: '/blog/' }].",
    '  headerLinks: [],',
    '',
    '  // Categories of the menu fold, opened on the branch of the page being',
    '  // read. Useful once the documentation is long.',
    '  foldedSidebar: false,',
    '',
    '  // Wording of the shell — the menu, the notices, the search field.',
    '  // English and French ship with the tool and follow `lang`; this field',
    "  // corrects a word or adds a language: { de: { search: 'Suchen' } }.",
    '  ui: {},',
    '',
    '  // Kinds of admonition, beside the six shipped — note, info, tip,',
    '  // attention, alert and danger. A kind is a label and a tone, which',
    "  // carries its colour: { review: { label: 'Review', tone: 'info' } }.",
    '  admonitions: {},',
    '',
    '  // The shipped components — Card, Columns, Tooltip… — usable in any .mdx',
    '  // page without an import. false removes them, to use your own names.',
    '  globalComponents: true,',
    '',
    '  // Back-to-top button on every page.',
    '  scrollToTop: true,',
    '',
    '  // The header stays at the top of the screen. false lets it scroll away',
    '  // with the page, and gives its height back to the text.',
    '  stickyHeader: true,',
    '',
    '  // Structured data (JSON-LD) generated from the frontmatter of each page.',
    '  jsonld: { enabled: true },',
    '',
    '  // sitemap.xml of the published versions, for search engines — written',
    '  // once siteUrl is set. robots.txt joins it when the site is served at',
    '  // the root of its domain.',
    // Commented out until siteUrl is known: written explicitly, it asks for a
    // sitemap that cannot be built yet, and the configuration refuses it.
    siteUrl ? '  sitemap: true,' : '  // sitemap: true,',
    '',
    '  // RSS feed of the pages that carry a date, at the root of the site. It',
    '  // needs siteUrl.',
    '  feed: false,',
    '',
    '  // A search field in the header, and a search page built with the site.',
    '  // Content pages load no script: the search page alone does.',
    '  search: true,',
    '};',
    '',
    '// Every field is described in the reference of the DocPensieve documentation:',
    `// the DocPensieve section of your site, or ${DOCUMENTATION_URL}`,
    '',
  ];

  return lines.join('\n');
}

/**
 * Slug of a version, as it names both the folder and the branch.
 *
 * A “v” is added when the user left it out: “1.0” and “v1.0” must give the
 * same project.
 *
 * @param {string} version
 * @returns {string}
 */
function versionSlug(version) {
  const trimmed = String(version).trim();
  return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`;
}

/**
 * Home page of the project, in the language of the site.
 *
 * @param {{ name: string, docs: boolean, slug: string, translation: string }} answers
 * @returns {string}
 */
const renderIndex = ({ name, docs, slug, translation }) => `---
title: Introduction
description: Documentation of ${name}.
date: ${new Date().toISOString().slice(0, 10)}

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# ${name}

Welcome to the documentation.

## Getting started

Pages live in \`docs/\`. The \`01-\` prefix of a file orders the menu
without appearing in the URL.

See the [installation guide](/guide/installation/).
${
  translation
    ? `
## In ${languageName(translation)}

The same pages live in \`docs/${slug}-${translation}/\`, and the language switcher
in the header moves between them.

A page with no twin there does not exist in that language: it stays out of the
menu and out of the sitemap, and the switcher names the language without
offering it. The installation page is in that case — write
\`docs/${slug}-${translation}/01-guide/01-installation.md\` and it appears.
${docs ? '\nThe [languages guide](/docpensieve/guide/languages/) covers the rest.\n' : ''}`
    : ''
}${
  docs
    ? `
## Learning DocPensieve

The [DocPensieve](/docpensieve/) section of the menu is the documentation of the
tool that builds this site, installed along with it. Delete its folder,
\`${DOCS_FOLDER}\`, when you no longer need it.
`
    : ''
}`;

/**
 * Home page of the second language.
 *
 * French is written out, the tool shipping its wording too. Any other
 * language gets the page in English, saying in its first line that it is
 * there to be translated: a copy passing for a translation is the one failure
 * this feature invites — the reader gets English under an address that
 * promised their language, and nothing reports it.
 *
 * Only the home page is written. Its twin, the installation page, is left
 * untranslated on purpose: it is what shows that an untranslated page does
 * not exist in that language, which no sentence explains as well as the menu
 * that lacks it.
 *
 * @param {{ name: string, slug: string, translation: string }} answers
 * @returns {string}
 */
function renderTranslatedIndex({ name, slug, translation }) {
  const french = translation.toLowerCase().split('-')[0] === 'fr';
  const head = `---
title: Introduction
description: ${french ? `Documentation de ${name}.` : `Documentation of ${name}.`}
date: ${new Date().toISOString().slice(0, 10)}

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# ${name}
`;

  if (french) {
    return `${head}
Bienvenue dans la documentation.

## Une page et sa jumelle

Cette page est la version française de \`docs/${slug}/index.md\`. Le sélecteur
de langue, dans l'en-tête, passe de l'une à l'autre.

La page d'installation, elle, n'est pas traduite : elle **n'existe pas** en
français. Elle ne figure ni dans le menu ni dans le plan du site, et le
sélecteur la nomme sans la proposer. Écrivez
\`docs/${slug}-${translation}/01-guide/01-installation.md\` pour la voir apparaître.
`;
  }

  return `${head}
**Replace this page with your translation.** It is the ${languageName(translation)}
twin of \`docs/${slug}/index.md\`, written in English so that the site builds:
left as it is, a reader who picks ${languageName(translation, translation)} gets English.

## One page, two languages

The language switcher in the header moves between this page and its twin.

The installation page has no twin here, so it does not exist in this language:
it stays out of the menu and out of the sitemap, and the switcher names the
language without offering it. Write
\`docs/${slug}-${translation}/01-guide/01-installation.md\` and it appears.
`;
}

/** @returns {string} Sample page, showing ordering and highlighting. */
const renderGuide = () => `---
title: Installation
description: Install and run the project.

jsonld:
  type: TechArticle
---

# Installation

## Requirements

Node.js 22 or later.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`
`;

/**
 * @param {string} slug Version slug, to name the folder to delete.
 * @returns {string} Entry page of the installed documentation section.
 */
const renderDocsIndex = (slug) => `---
title: DocPensieve
description: Documentation of the tool this site is built with, installed along with it.
---

# DocPensieve

This section is the documentation of DocPensieve, the tool this site is built
with. \`docpensieve init\` installed it, and it matches the version you use.

- [Guide](./guide/) — from installation to deployment, in order.
- [Components](./components/) — the components usable in any page.
- [Reference](./reference/) — commands, configuration, frontmatter and theme.
- [Architecture](./architecture/) — how a page becomes HTML.

When you no longer need it, delete the \`docs/${slug}/${DOCS_FOLDER}\` folder:
nothing else depends on it.
`;

/**
 * Folder holding DocPensieve's documentation, ready to be installed.
 *
 * The published package carries it in `starter/`, copied at packing time from
 * the documentation of its own version. In this repository, outside packing,
 * the same pages are read straight from `docs/`.
 *
 * @returns {string | null} The folder, or `null` when neither exists.
 */
function documentationSource() {
  const packed = fileURLToPath(new URL('../../starter/', import.meta.url));
  if (existsSync(packed)) return packed;

  const { version } = createRequire(import.meta.url)('../../package.json');
  const [major, minor] = String(version).split('.');
  const repository = fileURLToPath(
    new URL(`../../../../docs/v${major}.${minor}/`, import.meta.url),
  );
  return existsSync(repository) ? repository : null;
}

/**
 * Copies DocPensieve's documentation into the new project, in its own folder.
 *
 * @param {string} source Folder of the documentation to install.
 * @param {string} target Folder of the section, in the version folder.
 * @param {string} slug Version slug.
 */
async function installDocumentation(source, target, slug) {
  await mkdir(target, { recursive: true });
  for (const entry of readdirSync(source)) {
    if (NOT_INSTALLED.has(entry)) continue;
    cpSync(path.join(source, entry), path.join(target, entry), { recursive: true });
  }
  await writeFile(path.join(target, 'index.md'), renderDocsIndex(slug), 'utf8');
}

/**
 * Sets up a documentation project.
 *
 * @param {string} [dir] Target folder, created if needed.
 * @param {{
 *   name?: string, theme?: string, siteUrl?: string, version?: string,
 *   translation?: string, yes?: boolean, force?: boolean, minimal?: boolean,
 * }} [options] `minimal` leaves DocPensieve's documentation out of the site;
 *   `translation` is the code of a second language, `fr` for instance.
 * @returns {Promise<{
 *   dir: string, theme: string, docs: boolean, translation: string,
 * }>}
 * @throws {DocPensieveError} Unknown framework, unknown language, project
 *   already initialised, or documentation to install missing.
 */
export async function init(dir = '.', options = {}) {
  const target = path.resolve(dir);
  const configPath = path.join(target, CONFIG_FILENAME);
  const existing = CONFIG_FILENAMES.filter((name) => existsSync(path.join(target, name)));

  if (existing.length > 0 && !options.force) {
    throw new DocPensieveError(`${existing[0]} already exists in ${target}.`, {
      hint: 'Use --force to overwrite it, or pick another folder.',
    });
  }

  // Before the dialogue: answering three questions only to be told afterwards
  // that the theme does not exist would be annoying. After it, the check would
  // be pointless — the dialogue only offers valid values.
  if (options.theme && !THEME_FRAMEWORKS.includes(options.theme)) {
    throw new DocPensieveError(`Unknown framework: "${options.theme}".`, {
      hint: `Accepted values: ${THEME_FRAMEWORKS.join(', ')}.`,
    });
  }

  // Checked here for the same reason as the framework: a code refused after
  // five questions would be five questions wasted.
  if (options.translation && !isLanguageCode(options.translation)) {
    throw new DocPensieveError(`"${options.translation}" does not name a language.`, {
      hint: 'Write the code, not the name: "fr" for French, "pt-BR", "zh-Hans". It becomes the lang of the document and a segment of the address.',
    });
  }

  const answers = await collect(options);

  // Located before anything is written: a project left half set up would be
  // worse than a clear error.
  const documentation = answers.docs ? documentationSource() : null;
  if (answers.docs && !documentation) {
    throw new DocPensieveError('The DocPensieve documentation to install cannot be found.', {
      hint: 'Reinstall docpensieve, or run init with --minimal to go without it.',
    });
  }
  // Under the custom theme, its examples also need their stylesheet: without
  // it, every one of them would render unstyled, and nothing would say why.
  if (
    documentation &&
    answers.theme === 'custom' &&
    !existsSync(path.join(documentation, EXAMPLES_CSS))
  ) {
    throw new DocPensieveError("The stylesheet of the documentation's examples is missing.", {
      hint: 'Reinstall docpensieve, or run init with --minimal to go without the documentation.',
    });
  }

  const slug = versionSlug(answers.version);
  const docsDir = path.join(target, 'docs', slug);

  // Overwritten, a project keeps a single configuration file: the one written
  // here. An older spelling left behind would make the next build refuse both.
  for (const name of existing) rmSync(path.join(target, name), { force: true });

  await mkdir(path.join(docsDir, '01-guide'), { recursive: true });
  await writeFile(configPath, renderConfig(answers), 'utf8');
  await writeFile(
    path.join(docsDir, 'index.md'),
    renderIndex({ name: answers.name, docs: answers.docs, slug, translation: answers.translation }),
    'utf8',
  );
  await writeFile(path.join(docsDir, '01-guide', '01-installation.md'), renderGuide(), 'utf8');
  if (answers.translation) {
    const folder = path.join(target, 'docs', `${slug}-${answers.translation}`);
    await mkdir(folder, { recursive: true });
    await writeFile(
      path.join(folder, 'index.md'),
      renderTranslatedIndex({ name: answers.name, slug, translation: answers.translation }),
      'utf8',
    );
  }
  if (documentation) {
    await installDocumentation(documentation, path.join(docsDir, DOCS_FOLDER), slug);
  }
  const stylesheets =
    answers.theme === 'custom' ? await writeStylesheets(target, documentation) : [];
  await ignoreOutput(target);

  console.log(`\nProject initialised in ${target}`);
  console.log(`  ${CONFIG_FILENAME}`);
  console.log(`  docs/${slug}/index.md`);
  console.log(`  docs/${slug}/01-guide/01-installation.md`);
  if (answers.translation) {
    const state =
      answers.translation.toLowerCase().split('-')[0] === 'fr'
        ? `in ${languageName(answers.translation)}`
        : 'to translate';
    console.log(`  docs/${slug}-${answers.translation}/index.md  the home page, ${state}`);
  }
  if (documentation) {
    console.log(`  docs/${slug}/${DOCS_FOLDER}/  DocPensieve's documentation, to delete when done`);
  }
  for (const line of stylesheets) console.log(`  ${line}`);
  console.log(`\nTheme: ${answers.theme} — ${FRAMEWORK_LABELS[answers.theme]}`);
  if (answers.translation) {
    console.log(
      `Second language: ${languageName(answers.translation)} (${answers.translation}) — served under /${answers.translation}/`,
    );
  }
  console.log('\nNext:  npx docpensieve dev');

  return {
    dir: target,
    theme: answers.theme,
    docs: answers.docs,
    translation: answers.translation,
  };
}

/**
 * Gives the custom theme its stylesheets, in the project's theme folder.
 *
 * The custom theme loads no utility framework: the classes a page uses are
 * defined by the project. `custom.css` is where they go — never overwritten,
 * even with `--force`, since it holds the project's own rules. The installed
 * documentation brings the classes of its examples in a file of its own, to
 * delete along with it.
 *
 * @param {string} target Project folder.
 * @param {string | null} documentation Source of the installed documentation.
 * @returns {Promise<string[]>} One line per file, for the summary.
 */
async function writeStylesheets(target, documentation) {
  const folder = path.join(target, THEME_FOLDER);
  await mkdir(folder, { recursive: true });

  const own = path.join(folder, 'custom.css');
  if (!existsSync(own)) cpSync(CUSTOM_CSS, own);
  const lines = [`${THEME_FOLDER}/custom.css  your own styles`];

  if (documentation) {
    cpSync(path.join(documentation, EXAMPLES_CSS), path.join(folder, `${DOCS_FOLDER}.css`));
    lines.push(`${THEME_FOLDER}/${DOCS_FOLDER}.css  classes of its examples, to delete with it`);
  }
  return lines;
}

/**
 * Adds the output folder to .gitignore, without overwriting what is there.
 *
 * @param {string} target
 */
async function ignoreOutput(target) {
  const file = path.join(target, '.gitignore');
  let current = '';
  try {
    current = await readFile(file, 'utf8');
  } catch {
    // No .gitignore: create it.
  }

  if (/^dist\/?$/m.test(current)) return;
  const separator = current && !current.endsWith('\n') ? '\n' : '';
  await writeFile(file, `${current}${separator}dist/\nnode_modules/\n`, 'utf8');
}
