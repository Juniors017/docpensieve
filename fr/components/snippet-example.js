/**
 * Un fichier que la page Snippet lit, au lieu de le recopier.
 *
 * Il est installé avec la documentation : les exemples de cette page
 * fonctionnent donc dans votre projet comme ils fonctionnent sur ce site.
 * Changez une ligne ici et la page change avec — c'est tout l'intérêt du
 * composant.
 */

/** Mots qu'un slug laisse tomber, pour que les titres ne commencent pas tous pareil. */
const SKIPPED = new Set(['le', 'la', 'les', 'de', 'des', 'du']);

/**
 * Transforme le titre d'une page en dernier segment de son adresse.
 *
 * @param {string} title Titre, tel que le frontmatter le donne.
 * @returns {string} Un slug : minuscules, accents retirés, mots joints par un tiret.
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
