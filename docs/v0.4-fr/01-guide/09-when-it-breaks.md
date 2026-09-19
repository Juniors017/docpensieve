---
title: Quand ça casse
description: Les pannes que cet outil produit vraiment, leur cause et leur remède — classées par le symptôme que vous voyez.
tags: [guide, dépannage]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Quand ça casse

Toute erreur attendue porte un message **et une piste** disant ce qui est
attendu à la place, et la commande sort en code 1 sans pile d'appels. Les
pannes ci-dessous sont celles qui ne disent rien, ou qui le disent là où vous
ne regardiez pas : le site se génère, la suite est verte, et quelque chose ne
va pas quand même.

Chaque titre est le symptôme tel que vous le décririez.

## `init` ne m'a rien demandé et a créé un site que je n'ai pas choisi

Le dialogue a besoin d'un vrai terminal. Lancé depuis un script, une chaîne
d'intégration ou derrière un tube, `init` prend les options données sur la
ligne de commande et les valeurs par défaut pour le reste — il l'annonce avant
de commencer, sauf si `--yes` dit que c'était voulu.

Passez explicitement ce qui compte :

```bash
npx docpensieve init mon-site --name "Acme docs" --theme custom --site-url https://acme.example.com
```

## `npx` lance une version plus ancienne que celle que je viens de publier

Une version fraîchement publiée met quelques minutes à atteindre tous les
miroirs du registre, et `npx` garde ce qu'il a déjà. Pendant ces minutes,
l'installation peut même échouer franchement avec `ETARGET`, parce que les
paquets s'épinglent les uns aux autres à la version exacte et que l'un des cinq
n'est pas encore là.

```bash
npx --prefer-online docpensieve@latest init mon-site
```

Attendez plutôt que de republier : un numéro de version brûlé ne se récupère
pas, et rien n'est cassé dans celle qui se propage.

## Le site marche sur ma machine et tous les liens sont morts en ligne

Le site est servi depuis un sous-dossier et `baseUrl` n'a pas été renseigné.
En local, `serve` et `dev` répondent à la racine : rien ne se voit.

```js
siteUrl: 'https://acme.example.com/docs',
baseUrl: '/docs/',
```

`baseUrl` préfixe tous les liens internes. Sans lui, un lien écrit
`/guide/installation/` pointe un niveau au-dessus du site.

## `check` dit qu'un lien « ignores the deployment prefix »

Le fichier existe, mais le lien a été écrit sans le préfixe — il ne mènera
nulle part une fois en ligne, et le suivre en local le cache.

```
  index.html
    /guide/installation/
    → ignores the deployment prefix "/docs/"
```

Écrivez le lien comme le fait cette documentation — relatif à la page
(`../components/card/`) ou depuis la racine de la version
(`/components/card/`, que la génération réécrit) — plutôt que de taper le
chemin déployé à la main.

## Ma page n'apparaît nulle part

Trois causes, dans l'ordre où il vaut la peine de les vérifier :

- **`draft: true`** dans son frontmatter la garde hors de la sortie, exprès.
- **Le fichier est hors d'un dossier de version.** Seul ce qui vit sous un
  `folder` déclaré dans `versions` est lu.
- **L'extension.** `.md` et `.mdx` sont lus ; rien d'autre.

La génération ne dit rien dans ces trois cas, parce qu'aucun n'est une erreur :
un dossier que vous n'avez pas déclaré n'est simplement pas de la
documentation.

## Une couleur posée dans `tokens` ne change rien

`theme.tokens` règle la palette **claire**. Un site portant
`theme.darkMode: 'dark'` est toujours sombre : il ne montre donc jamais ces
valeurs — les sombres viennent de la feuille du thème.

Redéfinissez-les dans le dossier `theme/`, pour les deux façons d'être sombre :

```css
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --dp-accent: #a78bfa;
  }
}

:root.dark {
  --dp-accent: #a78bfa;
}
```

## Node avertit à chaque génération, ou refuse la configuration

Un fichier de configuration en `.js` n'est lu comme module que si le
`package.json` le plus proche déclare `"type": "module"` — et celui qu'écrit
`npm init -y` dit le contraire, ce qui fait refuser le fichier par Node.

Nommez-le `docpensieve.config.mjs`. L'extension tranche, quoi que dise le
`package.json`.

La génération s'arrête aussi quand les **deux** fichiers sont présents :

```
Two configuration files in /chemin/du/projet: docpensieve.config.mjs and docpensieve.config.js.
```

Gardez-en un. Deviner lequel vous vouliez publierait tôt ou tard un site
construit sur les mauvais réglages.

## Un composant arrête la génération, ou ne rend rien

Les composants qui ont besoin d'un parent le vérifient : une `Column` hors
d'un `Columns`, un `MenuLink` hors d'un `Menu` arrêtent la génération plutôt
que de rendre un élément sans effet. C'est voulu — une balise qui ne fait rien
en silence survit à une relecture, une erreur non.

`globalComponents: false` retire les composants livrés de toutes les pages. Une
page qui en emploie encore un arrête alors la génération, en le nommant :

```
Error Unknown component "Cards" in docs/v1.0/99-docpensieve/01-guide/index.mdx.
No global component is registered for this compilation.
```

Soit vous les réactivez, soit vous retirez la documentation installée et les
composants qu'elle emploie — `--minimal` à l'`init` l'écarte d'emblée.

Une page `.md` qui emploie un composant fonctionne, mais son extension ne dit
plus ce que fait la page. Renommez-la `.mdx` ; les deux compilent pareil.

## Une classe utilitaire n'a aucun effet dans une page

Sous le thème `tailwind`, la feuille est compilée d'après les classes trouvées
dans les pages **rendues**. Une classe dont le nom ne survit pas à l'écriture
en HTML n'est jamais émise, et rien ne le signale — un `&` devient `&amp;`,
donc `[&_.x]:underline` ne produit aucune règle.

Passez plutôt par une variable du composant :

```mdx
<Skill name="Couverture" level={97} color="#10b981" />
```

## Rien de tout cela ne correspond

Lancez les deux commandes qui regardent des choses différentes, dans cet
ordre :

```bash
npx docpensieve build
npx docpensieve check
```

La génération compile les pages et s'arrête sur ce qu'elle ne peut pas faire.
`check` relit le site produit et suit ses liens — une page renommée compile
parfaitement et laisse morts tous les liens qui la visaient.

Une panne inattendue — sans piste — sort avec sa pile d'appels, et mérite d'être
signalée avec la version qu'affiche `npx docpensieve --version`.

Chaque message vient d'une commande, et la [référence du CLI](../../reference/cli/)
dit ce que fait chacune, avec les codes de sortie que lit une chaîne
d'intégration.
