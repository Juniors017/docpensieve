#!/usr/bin/env node
/**
 * Writes the API reference of the five packages, from their JSDoc.
 *
 * Every export of a package's index is looked up in its source module, and
 * the JSDoc just above its declaration becomes its entry: description,
 * parameters, return value, errors. Written by hand, such a page goes stale at
 * the first renamed parameter; generated, it only needs running again — and a
 * test fails when it was not.
 *
 * Usage:
 *   npm run api:docs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where each page is written: the reference of the version being prepared. */
export const API_PAGES = {
  en: path.join(ROOT, 'docs', 'v0.5', '03-reference', '05-api.md'),
  fr: path.join(ROOT, 'docs', 'v0.5-fr', '03-reference', '05-api.md'),
};

/** The English page, still named on its own by the rest of the repository. */
export const API_PAGE = API_PAGES.en;

/**
 * The prose this script writes, by language.
 *
 * Only that prose is translated. What comes from the sources — descriptions,
 * parameter texts, error types — stays as the JSDoc has it, and the JSDoc of
 * this project is English by rule. A French reader therefore gets a French
 * page around English signatures, which is what a signature is.
 *
 * @type {Record<string, {
 *   description: string, tags: string, intro: string[],
 *   parameter: string, type: string, returns: string, throws: string,
 *   documentedIn: (file: string) => string, roles: Record<string, string>,
 * }>}
 */
const WORDING = {
  en: {
    description: 'Every export of the five packages, from their JSDoc.',
    tags: 'tags: [reference, api]',
    intro: [
      'The five packages are published together, at the same version. Most',
      'projects only need the `docpensieve` command; the packages below are for',
      'what goes further — a script that builds a site, a theme of your own.',
      '',
      'Each entry comes from the JSDoc of the source, which the type checker',
      'verifies: it cannot drift from the code without the build noticing.',
      '',
      'To use the tool rather than call it, start at',
      '[Installation](../guide/installation/); the fields of a configuration are',
      'in [Configuration](./configuration/).',
    ],
    parameter: 'Parameter',
    type: 'Type',
    returns: 'Returns',
    throws: 'Throws',
    documentedIn: (file) => `Documented in \`${file}\`.`,
    roles: {},
  },
  fr: {
    description: 'Tous les exports des cinq paquets, depuis leurs JSDoc.',
    tags: 'tags: [référence, api]',
    intro: [
      'Les cinq paquets se publient ensemble, à la même version. La plupart des',
      "projets n'ont besoin que de la commande `docpensieve` ; les paquets",
      'ci-dessous servent à ce qui va plus loin — un script qui génère un site,',
      'un thème à vous.',
      '',
      'Chaque entrée vient des JSDoc des sources, que le vérificateur de types',
      'contrôle : elle ne peut pas dériver du code sans que la génération le',
      'voie. **Les signatures et leurs descriptions restent en anglais**, comme',
      "le code d'où elles sortent.",
      '',
      "Pour employer l'outil plutôt que l'appeler, commencez par",
      "[Installation](../guide/installation/) ; les champs d'une configuration",
      'sont dans [Configuration](./configuration/).',
    ],
    parameter: 'Paramètre',
    type: 'Type',
    returns: 'Renvoie',
    throws: 'Lève',
    documentedIn: (file) => `Documenté dans \`${file}\`.`,
    roles: {
      '@docpensieve/shared': 'Constantes, erreurs et slugs, partagés par tous les paquets.',
      '@docpensieve/core':
        'Configuration, chargement, compilation, données structurées et génération.',
      '@docpensieve/theme': 'Les providers de thème et le moteur qui les compose.',
      '@docpensieve/components': 'Les composants disponibles dans chaque page.',
      docpensieve: 'Les commandes, appelables depuis un script comme depuis le terminal.',
    },
  },
};

/** The packages, in the order of their dependency graph. */
const PACKAGES = [
  {
    folder: 'shared',
    name: '@docpensieve/shared',
    role: 'Constants, errors and slugs, shared by every package.',
  },
  {
    folder: 'core',
    name: '@docpensieve/core',
    role: 'Configuration, loading, compilation, structured data and generation.',
  },
  {
    folder: 'theme',
    name: '@docpensieve/theme',
    role: 'The theme providers and the engine that composes them.',
  },
  {
    folder: 'components',
    name: '@docpensieve/components',
    role: 'The components available in every page.',
  },
  {
    folder: 'cli',
    name: 'docpensieve',
    role: 'The commands, callable from a script as well as from the terminal.',
  },
];

/**
 * @typedef {object} Entry
 * @property {string} name
 * @property {'function' | 'class' | 'const'} kind
 * @property {string} description
 * @property {{ name: string, type: string, text: string }[]} params
 * @property {{ type: string, text: string } | null} returns
 * @property {{ type: string, text: string }[]} throws
 */

/**
 * The names a module file exports, each with the JSDoc above it.
 *
 * @param {string} file
 * @returns {Map<string, Entry>}
 */
function declarations(file) {
  const source = readFileSync(file, 'utf8');
  /** @type {Map<string, Entry>} */
  const found = new Map();
  const pattern =
    /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\s*export\s+(?:async\s+)?(function|class|const)\s+([A-Za-z_$][\w$]*)/g;
  for (const [, comment, kind, name] of source.matchAll(pattern)) {
    found.set(name, { name, kind: /** @type {Entry['kind']} */ (kind), ...parseJsdoc(comment) });
  }
  return found;
}

/**
 * @param {string} comment A JSDoc block, delimiters included.
 * @returns {Omit<Entry, 'name' | 'kind'>}
 */
function parseJsdoc(comment) {
  const lines = comment
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''));

  /** @type {string[]} */
  const description = [];
  /** @type {string[][]} */
  const tags = [];
  for (const line of lines) {
    if (line.startsWith('@')) tags.push([line]);
    else if (tags.length > 0) tags[tags.length - 1].push(line);
    else description.push(line);
  }

  /** @type {Entry['params']} */
  const params = [];
  /** @type {Entry['returns']} */
  let returns = null;
  /** @type {Entry['throws']} */
  const throws = [];

  for (const tag of tags) {
    const text = tag.join(' ').replace(/\s+/g, ' ').trim();
    const typed = /^@(\w+)\s+\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}\s*(.*)$/.exec(text);
    if (!typed) continue;
    const [, name, type, rest] = typed;
    if (name === 'param') {
      const [, param = '', explanation = ''] = /^(\[[^\]]*\]|\S+)\s*(.*)$/.exec(rest) ?? [];
      // Nested properties (`options.cwd`) are described by their parent.
      if (param.includes('.')) continue;
      params.push({ name: param, type, text: explanation });
    } else if (name === 'returns' || name === 'return') {
      returns = { type, text: rest };
    } else if (name === 'throws') {
      throws.push({ type, text: rest });
    }
  }

  return { description: paragraphs(description), params, returns, throws };
}

/**
 * Joins the lines of a JSDoc description into Markdown paragraphs, keeping
 * lists and code blocks as they were written.
 *
 * @param {string[]} lines
 * @returns {string}
 */
function paragraphs(lines) {
  return lines
    .join('\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Makes a table cell of a text: on one line, pipes escaped.
 *
 * @param {string} text
 * @returns {string}
 */
const cell = (text) => text.replace(/\s+/g, ' ').replaceAll('|', '\\|').trim();

/**
 * The names a package's index exports, with the module each comes from.
 *
 * @param {string} folder
 * @returns {{ name: string, file: string }[]}
 */
function exportsOf(folder) {
  const src = path.join(ROOT, 'packages', folder, 'src');
  const index = readFileSync(path.join(src, 'index.js'), 'utf8');
  /** @type {{ name: string, file: string }[]} */
  const names = [];

  for (const [, list, from] of index.matchAll(/export\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const file = path.join(src, from);
    for (const item of list.split(',')) {
      const name = item
        .trim()
        .split(/\s+as\s+/)
        .pop();
      if (name) names.push({ name, file });
    }
  }
  for (const [, from] of index.matchAll(/export\s*\*\s*from\s*'([^']+)'/g)) {
    const file = path.join(src, from);
    for (const name of declarations(file).keys()) names.push({ name, file });
  }
  return names;
}

/**
 * Makes JSDoc prose safe for MDX, which reads every page: outside code, a
 * brace would open an expression and a `<` a component. Code — between
 * backticks or in a fenced block — is left exactly as written.
 *
 * @param {string} text
 * @returns {string}
 */
function prose(text) {
  let fenced = false;
  return text
    .split('\n')
    .map((line) => {
      if (line.trimStart().startsWith('```')) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      return line
        .split('`')
        .map((part, index) =>
          index % 2 === 1
            ? part
            : part.replace(/[{}]/g, (brace) => `\\${brace}`).replaceAll('<', '&lt;'),
        )
        .join('`');
    })
    .join('\n');
}

/**
 * @param {Entry} entry
 * @param {(typeof WORDING)[string]} words Wording of the page's language.
 * @returns {string}
 */
function renderEntry(entry, words) {
  const signature =
    entry.kind === 'function'
      ? `${entry.name}(${entry.params.map((param) => param.name).join(', ')})`
      : entry.kind === 'class'
        ? `class ${entry.name}`
        : entry.name;

  const parts = [`### \`${entry.name}\``, '', `\`${signature}\``];
  if (entry.description) parts.push('', prose(entry.description));

  if (entry.params.length > 0) {
    parts.push('', `| ${words.parameter} | ${words.type} | |`, '| --- | --- | --- |');
    for (const param of entry.params) {
      parts.push(
        `| \`${cell(param.name)}\` | \`${cell(param.type)}\` | ${cell(prose(param.text))} |`,
      );
    }
  }
  if (entry.returns) {
    const text = entry.returns.text ? ` — ${cell(prose(entry.returns.text))}` : '';
    parts.push('', `**${words.returns}** \`${cell(entry.returns.type)}\`${text}`);
  }
  for (const error of entry.throws) {
    const text = error.text ? ` — ${cell(prose(error.text))}` : '';
    parts.push('', `**${words.throws}** \`${cell(error.type)}\`${text}`);
  }
  return parts.join('\n');
}

/**
 * Renders the whole page.
 *
 * @returns {string}
 */
export function renderApiReference(lang = 'en') {
  const words = WORDING[lang] ?? WORDING.en;
  const sections = [
    '---',
    'title: API',
    `description: ${words.description}`,
    words.tags,
    '---',
    '',
    '# API',
    '',
    // MDX reads every page: an HTML comment would stop the build.
    '{/* Generated by scripts/api-reference.mjs from the JSDoc of the sources: run npm run api:docs rather than editing this page. */}',
    '',
    // This page is long and easy to land in from a search: a reader after the
    // tool rather than its API left it with nowhere to go.
    ...words.intro,
  ];

  for (const pkg of PACKAGES) {
    sections.push('', `## \`${pkg.name}\``, '', words.roles[pkg.name] ?? pkg.role);
    /** @type {Map<string, Map<string, Entry>>} */
    const cache = new Map();
    const seen = new Set();
    for (const { name, file } of exportsOf(pkg.folder)) {
      if (seen.has(name)) continue;
      seen.add(name);
      if (!cache.has(file)) cache.set(file, declarations(file));
      const entry = cache.get(file)?.get(name);
      sections.push(
        '',
        entry
          ? renderEntry(entry, words)
          : `### \`${name}\`\n\n${words.documentedIn(path.relative(ROOT, file).split(path.sep).join('/'))}`,
      );
    }
  }

  return `${sections.join('\n')}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [lang, file] of Object.entries(API_PAGES)) {
    writeFileSync(file, renderApiReference(lang), 'utf8');
    console.log(`API reference (${lang}) written to ${path.relative(ROOT, file)}`);
  }
}
