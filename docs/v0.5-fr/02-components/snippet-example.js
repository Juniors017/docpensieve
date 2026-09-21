/**
 * Un fichier que la page Snippet lit, au lieu de le recopier.
 *
 * Il est installé avec la documentation : les exemples de cette page
 * fonctionnent donc dans votre projet comme ils fonctionnent sur ce site.
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
