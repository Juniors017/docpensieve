/**
 * `docpensieve init` command — sets up a documentation project.
 *
 * @module docpensieve/commands/init
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import { CONFIG_FILENAME, DocPensieveError, THEME_FRAMEWORKS } from '@docpensieve/shared';

/**
 * Description shown next to each framework.
 * @type {Record<string, string>}
 */
const FRAMEWORK_LABELS = {
  tailwind: 'Tailwind CSS — ships with the tool, nothing to install',
  custom: 'custom theme, light stylesheet, no utilities',
};

/** Answers used when there is no dialogue. */
const DEFAULTS = { name: 'My documentation', siteUrl: '', theme: 'tailwind', version: '1.0' };

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
 * Gathers the answers, through a dialogue or from the options.
 *
 * @param {{ name?: string, theme?: string, siteUrl?: string, version?: string, yes?: boolean }} options
 * @returns {Promise<{ name: string, theme: string, siteUrl: string, version: string }>}
 */
async function collect(options) {
  const fromOptions = {
    name: options.name ?? DEFAULTS.name,
    siteUrl: options.siteUrl ?? DEFAULTS.siteUrl,
    theme: options.theme ?? DEFAULTS.theme,
    version: options.version ?? DEFAULTS.version,
  };

  // Without a terminal — script, CI, pipe — the dialogue would never complete:
  // stick to the options and the defaults.
  if (options.yes || !process.stdin.isTTY) return fromOptions;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const name = await ask(rl, 'Project name', fromOptions.name);
    const siteUrl = await ask(rl, 'Public URL of the site (optional)', fromOptions.siteUrl);
    const version = await ask(rl, 'First version', fromOptions.version);
    const theme = options.theme ?? (await askFramework(rl));
    return { name, siteUrl, version, theme };
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
 * @param {{ name: string, theme: string, siteUrl: string, version: string }} answers
 * @returns {string} Contents of `docpensieve.config.js`.
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
    `  projectName: ${quote(name)},`,
  ];

  if (siteUrl) {
    lines.push(
      `  siteUrl: ${quote(siteUrl)},`,
      '  // baseUrl is derived from the path of siteUrl. Set it to force it.',
    );
  }

  lines.push(
    '',
    '  // One entry per version. The compiled output then goes to an orphan',
    '  // branch with the same slug.',
    '  versions: [',
    `    {`,
    `      slug: ${quote(slug)},`,
    `      name: ${quote(version)},`,
    `      folder: ${quote(`docs/${slug}`)},`,
    `      current: true,`,
    `    },`,
    '  ],',
    '',
    "  outDir: 'dist',",
    '',
    '  theme: {',
    `    framework: ${quote(theme)},`,
    "    darkMode: 'class',",
    "    // Override the palette: tokens: { '--dp-accent': '#008060' },",
    '  },',
    '',
    "  // 'auto': the sidebar follows the file tree and the 01-, 02- prefixes.",
    "  sidebar: 'auto',",
    '',
    '  globalComponents: true,',
    '  jsonld: { enabled: true },',
    '};',
    '',
  );

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
 * @returns {string}
 */
const renderIndex = (name) => `---
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
`;

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
 * Sets up a documentation project.
 *
 * @param {string} [dir] Target folder, created if needed.
 * @param {{
 *   name?: string, theme?: string, siteUrl?: string, version?: string,
 *   yes?: boolean, force?: boolean,
 * }} [options]
 * @returns {Promise<{ dir: string, theme: string }>}
 * @throws {DocPensieveError} Unknown framework, or project already initialised.
 */
export async function init(dir = '.', options = {}) {
  const target = path.resolve(dir);
  const configPath = path.join(target, CONFIG_FILENAME);

  if (existsSync(configPath) && !options.force) {
    throw new DocPensieveError(`${CONFIG_FILENAME} already exists in ${target}.`, {
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

  const slug = versionSlug(answers.version);
  const docsDir = path.join(target, 'docs', slug);

  await mkdir(path.join(docsDir, 'guide'), { recursive: true });
  await writeFile(configPath, renderConfig(answers), 'utf8');
  await writeFile(path.join(docsDir, 'index.md'), renderIndex(answers.name), 'utf8');
  await writeFile(path.join(docsDir, 'guide', '01-installation.md'), renderGuide(), 'utf8');
  await ignoreOutput(target);

  console.log(`\nProject initialised in ${target}`);
  console.log(`  ${CONFIG_FILENAME}`);
  console.log(`  docs/${slug}/index.md`);
  console.log(`  docs/${slug}/guide/01-installation.md`);
  console.log(`\nTheme: ${answers.theme} — ${FRAMEWORK_LABELS[answers.theme]}`);
  console.log('\nNext:  npx docpensieve dev');

  return { dir: target, theme: answers.theme };
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
