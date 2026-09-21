/**
 * A file the Snippet page reads, rather than quoting.
 *
 * It is installed along with the documentation, so the examples on that page
 * work in your project exactly as they do on this site. Change a line here
 * and the page changes with it — which is the whole point of the component.
 */

/** Words a slug drops, so that titles do not all begin alike. */
const SKIPPED = new Set(['a', 'an', 'the', 'of', 'to']);

/**
 * Turns the title of a page into the last segment of its address.
 *
 * @param {string} title Title, as the frontmatter gives it.
 * @returns {string} A slug: lower case, accents dropped, words joined by a dash.
 */
export function slugOf(title) {
  // #region guard
  if (typeof title !== 'string' || title.trim() === '') {
    throw new TypeError('slugOf needs a title');
  }
  // #endregion

  return title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !SKIPPED.has(word))
    .join('-');
}
