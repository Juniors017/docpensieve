#!/usr/bin/env node
/**
 * Pushes every generated version to its orphan branch.
 *
 * The repository follows the model decided at the start: `main` carries the
 * sources, and every compiled version lives on an orphan branch of the same
 * name, with its own history. These branches are an archive — what GitHub
 * Pages serves is the complete site, deployed as an artifact.
 *
 * Usage:
 *   node scripts/publish-versions.mjs [--dry-run] [--remote <url>]
 *
 * Without `--remote`, the origin of the current repository is used.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// `indexOf` returns -1 when the option is absent: reading args[-1 + 1] would
// take the first argument that comes along for a URL.
const remoteIndex = args.indexOf('--remote');
const remoteArg = remoteIndex === -1 ? undefined : args[remoteIndex + 1];

/**
 * Runs a git command in a given folder.
 *
 * @param {string[]} params
 * @param {{ cwd: string, tolerant?: boolean }} options `tolerant` returns
 *   `null` instead of throwing — useful for a `fetch` of a branch that does
 *   not exist yet.
 * @returns {string | null} Standard output, trimmed.
 */
function git(params, { cwd, tolerant = false }) {
  try {
    return execFileSync('git', params, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (cause) {
    if (tolerant) return null;
    throw cause;
  }
}

/**
 * Empties a folder of everything but its `.git`.
 *
 * @param {string} dir
 */
function emptyExceptGit(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === '.git') continue;
    rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

const root = process.cwd();
const manifest = path.join(root, 'dist', 'versions.json');

if (!existsSync(manifest)) {
  console.error(`No ${manifest}. Run "npm run build" first.`);
  process.exit(1);
}

const remote = remoteArg ?? git(['remote', 'get-url', 'origin'], { cwd: root, tolerant: true });
if (!remote && !dryRun) {
  console.error('No origin configured. Pass --remote <url>, or --dry-run for a trial run.');
  process.exit(1);
}

const { versions } = JSON.parse(readFileSync(manifest, 'utf8'));
const source = git(['rev-parse', '--short', 'HEAD'], { cwd: root, tolerant: true }) ?? 'unknown';

let pushed = 0;
let unchanged = 0;

for (const { slug } of versions) {
  const contents = path.join(root, 'dist', 'versions', slug);
  if (!existsSync(contents)) {
    console.error(`  ${slug}: missing from dist/, skipped`);
    continue;
  }

  const work = mkdtempSync(path.join(tmpdir(), `docpensieve-${slug}-`));
  try {
    git(['init', '-b', slug], { cwd: work });
    git(['config', 'user.name', 'docpensieve'], { cwd: work });
    git(['config', 'user.email', 'docpensieve@users.noreply.github.com'], { cwd: work });

    if (remote) {
      git(['remote', 'add', 'origin', remote], { cwd: work });

      // The branch may already exist: start again from its tip to keep its
      // history rather than overwrite it on every build.
      const found = git(['fetch', 'origin', slug], { cwd: work, tolerant: true }) !== null;
      if (found) {
        git(['checkout', '-B', slug, 'FETCH_HEAD'], { cwd: work });
        emptyExceptGit(work);
      }
    }

    cpSync(contents, work, { recursive: true });
    git(['add', '-A'], { cwd: work });

    // Nothing to commit means the version has not moved: the common case when
    // only another version changed.
    const pending = git(['status', '--porcelain'], { cwd: work });
    if (!pending) {
      console.log(`  ${slug}: unchanged`);
      unchanged += 1;
      continue;
    }

    git(['commit', '-m', `build: ${slug} from ${source}`], { cwd: work });

    if (dryRun) {
      console.log(`  ${slug}: ready (dry run, nothing pushed)`);
    } else {
      git(['push', 'origin', slug], { cwd: work });
      console.log(`  ${slug}: pushed`);
      pushed += 1;
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

console.log(`\n${pushed} branch(es) pushed, ${unchanged} unchanged.`);
