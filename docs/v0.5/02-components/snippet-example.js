/**
 * A file the Snippet page reads, rather than quoting.
 *
 * It is installed along with the documentation, so the examples on that page
 * work in your project exactly as they do on this site.
 */

export const GREETINGS = { en: 'Hello', fr: 'Bonjour' };

export function greet(name, lang = 'en') {
  // #region guard
  if (!name) {
    throw new Error('greet needs a name');
  }
  // #endregion

  return `${GREETINGS[lang] ?? GREETINGS.en}, ${name}!`;
}
