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
  DocPensieveError,
  THEME_FOLDER,
  THEME_FRAMEWORKS,
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
const DEFAULTS = { name: 'My documentation', siteUrl: '', theme: 'tailwind', version: '1.0' };

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
 * pages: its home page and the icons only that page uses belong to
 * DocPensieve's own site, and the examples' stylesheet has a place of its own.
 */
const NOT_INSTALLED = new Set(['index.md', 'index.mdx', 'icons', EXAMPLES_CSS]);

/** Starting point of the project's own stylesheet, under the custom theme. */
const CUSTOM_CSS = fileURLToPath(new URL('../templates/custom.css', import.meta.url));

/** Where the generated configuration sends readers for every field. */
const DOCUMENTATION_URL = 'https://juniors017.github.io/docpensieve/';

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
 * Gathers the answers, through a dialogue or from the options.
 *
 * @param {{
 *   name?: string, theme?: string, siteUrl?: string, version?: string,
 *   yes?: boolean, minimal?: boolean,
 * }} options
 * @returns {Promise<{
 *   name: string, theme: string, siteUrl: string, version: string, docs: boolean,
 * }>}
 */
async function collect(options) {
  const fromOptions = {
    name: options.name ?? DEFAULTS.name,
    siteUrl: options.siteUrl ?? DEFAULTS.siteUrl,
    theme: options.theme ?? DEFAULTS.theme,
    version: options.version ?? DEFAULTS.version,
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
      'To choose, pass --name, --site-url, --theme, --version-name or --minimal; --yes silences this notice.',
    );
    return fromOptions;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const name = await ask(rl, 'Project name', fromOptions.name);
    const siteUrl = await ask(rl, 'Public URL of the site (optional)', fromOptions.siteUrl);
    const version = await ask(rl, 'First version', fromOptions.version);
    const theme = options.theme ?? (await askFramework(rl));
    const docs = options.minimal ? false : await askDocumentation(rl);
    return { name, siteUrl, version, theme, docs };
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
 * Renders `docpensieve.config.mjs`.
 *
 * Every field the configuration accepts appears in it — set to its default,
 * or commented out with an example — so that the first file a user opens also
 * tells them everything they can change.
 *
 * @param {{ name: string, theme: string, siteUrl: string, version: string }} answers
 * @returns {string} Contents of `docpensieve.config.mjs`.
 */
function renderConfig({ name, theme, siteUrl, version }) {
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
    '  // Language of the pages, in <html lang>. The labels of the page shell',
    '  // stay in English.',
    "  lang: 'en',",
    '',
    '  // One entry per version, each one a folder of Markdown and MDX pages.',
    '  //   current     the version the site root leads to — at most one',
    '  //   prerelease  in preparation: a banner on every page, kept out of search',
    '  //   archived    no longer maintained: a banner, still indexed',
    '  versions: [',
    '    {',
    `      slug: ${quote(slug)}, // URL segment, and name of the version's branch`,
    `      name: ${quote(version)}, // label in the version switcher`,
    `      folder: ${quote(`docs/${slug}`)},`,
    '      current: true,',
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
    "    darkMode: 'class',",
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
    "  // 'auto': the menu follows the folders and the 01-, 02- prefixes.",
    "  sidebar: 'auto',",
    '',
    '  // The shipped components — Card, Columns, Tooltip… — usable in any .mdx',
    '  // page without an import. false removes them, to use your own names.',
    '  globalComponents: true,',
    '',
    '  // Back-to-top button on every page.',
    '  scrollToTop: true,',
    '',
    '  // Structured data (JSON-LD) generated from the frontmatter of each page.',
    '  jsonld: { enabled: true },',
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
 * @param {string} name Project name, for the title of the home page.
 * @param {boolean} docs Whether DocPensieve's documentation is installed.
 * @returns {string}
 */
const renderIndex = (name, docs) => `---
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
  docs
    ? `
## Learning DocPensieve

The [DocPensieve](/docpensieve/) section of the menu is the documentation of the
tool that builds this site, installed along with it. Delete its folder,
\`${DOCS_FOLDER}\`, when you no longer need it.
`
    : ''
}`;

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
 *   yes?: boolean, force?: boolean, minimal?: boolean,
 * }} [options] `minimal` leaves DocPensieve's documentation out of the site.
 * @returns {Promise<{ dir: string, theme: string, docs: boolean }>}
 * @throws {DocPensieveError} Unknown framework, project already initialised,
 *   or documentation to install missing.
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
  await writeFile(path.join(docsDir, 'index.md'), renderIndex(answers.name, answers.docs), 'utf8');
  await writeFile(path.join(docsDir, '01-guide', '01-installation.md'), renderGuide(), 'utf8');
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
  if (documentation) {
    console.log(`  docs/${slug}/${DOCS_FOLDER}/  DocPensieve's documentation, to delete when done`);
  }
  for (const line of stylesheets) console.log(`  ${line}`);
  console.log(`\nTheme: ${answers.theme} — ${FRAMEWORK_LABELS[answers.theme]}`);
  console.log('\nNext:  npx docpensieve dev');

  return { dir: target, theme: answers.theme, docs: answers.docs };
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
