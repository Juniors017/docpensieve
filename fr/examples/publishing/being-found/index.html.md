# Se faire trouver

> Une documentation que personne ne trouve est une documentation que personne ne lit — recherche, plan du site, assistants, liens partagés et poids.

<Skill name="Progression du module" level={66}>
  Leçon 2 sur 3.
</Skill>

Votre lecteur arrive rarement par la page d'accueil. Il arrive par un moteur de
recherche, par un lien qu'un collègue a collé, par le champ de votre propre
en-tête — ou par un assistant qui a lu vos pages pour lui. Quatre portes, et
cette leçon les ouvre toutes.

## La recherche dans le site

Chaque page porte un champ dans son en-tête. Il mène à `/search/`, une page que
la génération écrit avec le site : la liste de toutes les pages, qu'un petit
script filtre à mesure que le lecteur tape.

<Admonition type="note" title="La seule page qui porte un script">
  Rien d'autre sur votre site ne charge de JavaScript — hormis le bouton clair / sombre, si vous le
  gardez. Sans le script, la page de recherche reste la liste de toutes les pages, ce qui fait
  encore une table des matières utilisable.
</Admonition>

`search: false` retire le champ et la page. Cela se défend sur un site de dix
pages, où le menu montre déjà tout.

## Les deux fichiers que lisent les robots

```js
siteUrl: 'https://acme.example.com/docs',
```

Ce seul champ rend le reste possible — une adresse est ce dont un robot, un
réseau social et un lecteur de flux ont tous besoin.

| Fichier       | Écrit quand                                  | Ce qu'il porte                                             |
| ------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `sitemap.xml` | `siteUrl` est renseigné                      | Toutes les pages de toutes les versions, **sauf une bêta** |
| `robots.txt`  | le site se trouve à la racine de son domaine | Où se trouve le plan du site                               |
| `feed.xml`    | `feed: true`                                 | Les pages récentes, annoncées dans l'en-tête du document   |

Une version marquée `prerelease` reste hors du plan du site et demande à ne pas
être indexée. C'est ce qui évite qu'un lecteur cherchant votre outil atterrisse
sur la documentation d'une version que personne ne peut encore installer.

<Admonition type="attention" title="robots.txt exige la racine">
  Servi depuis un sous-dossier, un site ne peut pas parler pour tout le domaine — le fichier
  réclamerait des règles sur des adresses qui ne sont pas les vôtres. La génération ne l'écrit donc
  pas, ce qui est le bon choix et se prend facilement pour un bug.
</Admonition>

## Un lecteur qui est un programme

```js
llms: true,
```

Quelqu'un demande à un assistant comment mettre en place votre outil.
L'assistant va chercher vos pages, et ce qu'il reçoit, c'est du HTML : un
en-tête, un menu, un pied de page, et quelque part au milieu le texte qu'il
était venu chercher. `llms: true` lui tend le texte directement.

| Fichier         | Écrit où              | Ce qu'il porte                                                         |
| --------------- | --------------------- | ---------------------------------------------------------------------- |
| `llms.txt`      | à la racine du site   | Le projet, puis chaque page de la version courante                     |
| `index.html.md` | à côté de chaque page | La page telle que vous l'avez écrite, avec son titre et sa description |

Les descriptions font ici aussi le travail. Une page sans `description` n'est
qu'un lien nu dans `llms.txt`, et l'assistant doit l'ouvrir pour savoir de quoi
elle parle : le champ qui écrit la ligne sous votre résultat de recherche écrit
aussi celle-ci.

<Admonition type="note" title="Ce que la copie ne contient pas">
  Ce qu'un composant dessine à la génération — une grille de cartes, le fichier que lit un snippet —
  reste dans la copie sous la balise que vous avez écrite. Une phrase qui dit ce que contient la
  grille épargne un `<Cards />` nu au programme qui lit la copie.
</Admonition>

Il ne demande pas de `siteUrl`, et reste éteint tant que vous ne le demandez
pas : que des programmes lisent vos pages, c'est à vous d'en décider.

## À quoi ressemble un lien partagé

Un lien collé dans une conversation montre un titre, une description et une
image. Les trois viennent de ce que vous avez déjà écrit :

<Columns>
  <Column span={5}>
    <Card>
      <CardImage src="/versions/beta/fr/icons/logo.jpg" alt="L'aperçu d'une page partagée" />
      <CardHeader>L'aperçu</CardHeader>
      <CardBody>Titre et description depuis le frontmatter, image depuis `socialImage`.</CardBody>
    </Card>
  </Column>
  <Column span={7}>

La `description` d'une page n'est pas une décoration : c'est la phrase sous le
titre dans un résultat de recherche, et celle sous le lien dans une
conversation. Une page qui n'en a pas est annoncée par son seul titre.

`socialImage` se déclare une fois, dans la configuration, et a besoin de
`siteUrl` — une autre machine va la chercher, donc l'adresse doit être absolue.

  </Column>
</Columns>

## Dire ce qu'est une page

Les moteurs de recherche lisent les données structurées. La génération les
écrit depuis le frontmatter, et une page peut dire de quel genre elle relève :

```yaml
---
title: Installation
description: Une commande met le projet en place.
jsonld:
  type: TechArticle
  faq:
    - question: Quelle version de Node faut-il ?
      answer: La version 22 ou plus récente.
---
```

Les questions deviennent un vrai bloc de FAQ dans les données structurées —
celui qu'un moteur peut afficher replié sous votre résultat.

## Le poids, que personne ne remarque avant qu'il soit mauvais

<div style={{ display: 'flex', flexWrap: 'wrap' }}>
  <Skill name="Scripts sur une page" level={0} shape="circle" showValue={false} />
  <Skill name="Feuilles de style" level={10} shape="circle" showValue={false} color="#10b981" />
  <Skill name="Images mesurées" level={100} shape="circle" color="#10b981" />
</div>

Trois choses arrivent à la génération sans qu'on les demande :

- **Chaque image reçoit ses dimensions**, lues dans son fichier, pour que la
  page cesse de sauter pendant le chargement.
- **Toutes les images sauf la première se chargent en différé**, ce qui fait
  arriver le haut de la page en premier.
- **La feuille de style est minifiée**, et ne porte que les règles qu'emploient
  les pages.

Rien à configurer. Cela mérite d'être su parce que cela explique une surprise :
la première image d'une page n'est délibérément pas différée, et ce n'est pas
un oubli.

## Les étiquettes, et ce qu'elles ne sont pas

```yaml
tags: [cours, avancé, découvrabilité]
```

Elles s'affichent sous la page et passent dans les données structurées comme
mots-clés. **Il n'y a pas de page par étiquette** : elles étiquettent, elles ne
naviguent pas. Un lecteur qui cherche tout ce qui touche à un sujet emploie le
champ de recherche.

## Vérifiez par vous-même

<details>
<summary>Votre bêta figure dans le plan du site. Qu'avez-vous oublié ?</summary>

`prerelease: true` sur cette version. Sans lui, rien ne la distingue de celle
que les gens devraient lire.

</details>

<details>
<summary>Aucun `robots.txt` n'a été écrit alors que `siteUrl` est renseigné. Pourquoi ?</summary>

Le site est servi depuis un sous-dossier. Un `robots.txt` ne veut dire quelque
chose qu'à la racine d'un domaine : la génération s'abstient plutôt que
d'écrire un fichier qui parlerait pour des adresses qui ne sont pas les vôtres.

</details>

<details>
<summary>Un assistant cite votre page, mais pas le fichier que montre son snippet. Pourquoi ?</summary>

Il a lu la copie Markdown, qui porte la page telle que vous l'avez écrite : la
balise `Snippet`, pas le fichier que la génération y verse. Nommez le fichier
et dites ce qu'il fait dans le texte autour du snippet — le lecteur du HTML y
gagne aussi.

</details>

<Card href="/versions/beta/fr/guide/deployment/">
  <CardBody>
    Le guide de déploiement couvre le même terrain du côté de l'hébergeur — ce qu'il faut servir, et
    ce qu'il faut vérifier avant la mise en ligne.
  </CardBody>
</Card>
