# Nouveautés de la 0.5

> Ce qu'apporte la 0.5, et ce qu'elle change pour un projet en 0.4.

Cette version est **en préparation**. Ses bêtas sortent sous l'étiquette npm
`beta`, tandis que la version installée par défaut reste la 0.4, documentée
dans les pages `latest` de ce site :

```bash
npx docpensieve@beta init mon-site
```

Chaque nouveauté est annoncée ici à mesure qu'elle atterrit, avec un lien vers
le guide et vers la référence : cette page annonce, elle n'est jamais le seul
endroit où quelque chose est écrit.

## Déjà là

### Le serveur de développement reste sur votre machine

`dev` et `serve` n'écoutent plus que cette machine. Ils écoutaient toutes les
interfaces : quiconque était sur le même réseau pouvait lire le site en cours
d'écriture, brouillons compris. `--host 0.0.0.0` l'ouvre volontairement — pour
le regarder depuis un téléphone — et la commande le dit au démarrage.

[Les commandes](/versions/beta/fr/reference/cli/)

### Un bandeau, et un calendrier

`Hero` tient la tête d'une page — un nom, une phrase, une rangée d'entrées —
pour que ce soit un composant plutôt qu'un div et un tas de classes.

`Calendar` dessine les mois où tombent vos événements, chacun sur son jour.
Tous les mois sont dans la page : un lecteur sans script les reçoit empilés et
lisibles, et le fichier client les replie en un seul avec deux flèches.

[Hero](/versions/beta/fr/components/hero/) · [Calendar](/versions/beta/fr/components/calendar/)

### Un bouton qui copie un bloc de code

`copyCode: true` pose un bouton de copie sur chaque bloc de code. C'est la
première chose qu'une page DocPensieve demande à un lecteur de charger : elle
reste donc éteinte tant que vous ne la demandez pas — et alors le comportement
est écrit une fois par version, partagé par toutes les pages et toutes les
langues, et chargé par les seules pages qui contiennent du code. Deux
kilooctets environ, compressés ; aucun framework, aucune hydratation.

C'est la règle du zéro script qui cède la place à une règle qui se mesure :
une page ne charge que ce qu'elle emploie.
[Le champ](/versions/beta/fr/reference/configuration/)

### Un bloc de code qui désigne un fichier

`Snippet` montre un vrai fichier de votre projet, lu à la génération de la
page. Un exemple écrit à la main est une copie, et une copie cesse d'être
vraie le jour où le code change, sans que rien ne le signale. Un intervalle de
lignes ou un repère `#region` en garde une partie ; `collapsed` replie un long
fichier dans un `details`, toujours sans script.

```mdx
<Snippet source="src/index.js" region="guard" />
```

L'idée vient de Christophe Avonture.

[Le composant](/versions/beta/fr/components/snippet/)

### init demande la langue

`init` demande désormais si le site sera en plusieurs langues, et met la
réponse en place : le dossier à côté de vos pages, `translations` écrit dans
la configuration, et une page d'accueil dans cette langue pour démarrer. La
seconde page d'exemple est laissée sans traduction exprès, pour que le menu
montre ce que devient une page non traduite — rien, dans cette langue.

```bash
npx docpensieve init mon-site --translation fr
```

Le code est un code BCP 47 : `fr`, `pt-BR`, `zh-Hans`. Le français et
l'anglais sont livrés avec leurs mots pour la coquille ; toute autre langue
garde l'anglais tant que le champ `ui` ne lui donne pas les siens.

[Les langues](/versions/beta/fr/guide/languages/) · [Les options d'init](/versions/beta/fr/reference/cli/)

### Des pages qu'un programme sait lire

`llms: true` écrit `llms.txt` à la racine du site — le projet, puis un lien
vers chaque page de la version courante — et une copie Markdown à côté de
chaque page, `index.html.md`, que son en-tête nomme. Un assistant interrogé sur
votre projet lit le texte que vous avez écrit, au lieu de l'extraire du HTML.
Désactivé par défaut, et il ne demande pas de `siteUrl`.

[Le champ](/versions/beta/fr/reference/configuration/)

## Pour un projet en 0.4

Rien à changer : une configuration 0.4 se génère telle quelle, et un site déjà
en deux langues n'est pas touché — la question ne façonne qu'un **nouveau**
projet.
[Migrer de latest vers la bêta](/versions/beta/fr/guide/migrate-to-beta/) liste ce qui change
tout seul, et ce qu'il vaut la peine d'activer.
