# Migrer de latest vers la bêta

> Faire passer un projet de la version courante, la 0.4, à la bêta 0.5 — ce qui change tout seul, et ce qu'il faut vérifier.

Un projet sur la version courante — la 0.4 — se génère avec la bêta 0.5 tel
quel : tous les champs que la 0.5 ajoute sont facultatifs.

## Mettre à jour

```bash
npm install docpensieve@beta
```

Par `npx` seul, `npx docpensieve@beta` lance la bêta. Le retour en arrière est
`npm install docpensieve@latest`.

Relisez votre site une fois après la mise à jour — c'est le contrôle le moins
cher qui soit :

```bash
npx docpensieve build
npx docpensieve check
```

## Ce qui change tout seul

- **`dev` et `serve` n'écoutent plus que cette machine.** Ils écoutaient toutes
  les interfaces : quiconque était sur le même réseau pouvait lire le site en
  cours d'écriture. Pour le regarder depuis un téléphone sur le même wifi,
  dites-le : `npx docpensieve dev --host 0.0.0.0`.
- **Les blocs de code ont leur propre fond.** Un bloc dans un langage que le
  coloriseur ignore restait sur le fond nu de la page ; il ressemble désormais
  à tous les autres.
- **Une erreur garde son indice.** Une erreur levée par l'outil pendant la
  compilation d'une page ne ressort plus en plainte de syntaxe générique.

## Ce qu'il vaut la peine d'activer

- [Snippet](/versions/beta/fr/components/snippet/), pour montrer un vrai fichier plutôt
  qu'une copie.
- [Hero](/versions/beta/fr/components/hero/) et [Calendar](/versions/beta/fr/components/calendar/).
- `copyCode`, un bouton de copie sur chaque bloc de code — éteint par défaut,
  puisque c'est ce qui fait charger un script à une page. Voir
  [la référence](/versions/beta/fr/reference/configuration/).
- `snippetIcons`, si votre projet installe un jeu d'icônes.
- `llms`, pour `llms.txt` et une copie Markdown de chaque page.

## Ce qu'il faut vérifier ensuite

- **Votre propre CSS**, si le dossier de thème habille ce que la bêta touche.
- **`npx docpensieve check`**, qui relit le site produit et signale les liens
  morts et le balisage invalide.
