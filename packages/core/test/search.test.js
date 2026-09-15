import { describe, expect, it } from 'vitest';

import { excerpt, normalize, rank, tokenize } from '../client/search.js';
import { htmlToText, searchPageContent } from '../src/search-index.js';

/** @param {string} title @param {string} text @param {string} [description] */
const entry = (title, text, description = '') => ({
  title,
  url: `/${title.toLowerCase()}/`,
  description,
  text,
});

describe('normalize and tokenize', () => {
  it('ignores case and accents', () => {
    expect(normalize('Été Déploiement')).toBe('ete deploiement');
    expect(tokenize('Été, été  Déploiement!')).toEqual(['ete', 'deploiement']);
  });
});

describe('rank', () => {
  const entries = [
    entry('Themes', 'Tailwind or custom, and the tokens of each theme.'),
    entry('Deployment', 'Publish the site. The theme does not matter here.'),
    entry('Versions', 'One branch per version.', 'Several versions of the theme docs.'),
  ];

  it('keeps the pages that hold every word', () => {
    expect(rank(entries, 'theme publish').map((found) => found.title)).toEqual(['Deployment']);
    expect(rank(entries, 'nowhere')).toEqual([]);
    expect(rank(entries, '   ')).toEqual([]);
  });

  it('puts a word in the title before one in the description, before one in the text', () => {
    expect(rank(entries, 'theme').map((found) => found.title)).toEqual([
      'Themes',
      'Versions',
      'Deployment',
    ]);
  });

  it('finds a word written without its accent', () => {
    const accented = [entry('Déploiement', 'Mettre le site en ligne.')];
    expect(rank(accented, 'deploiement')).toHaveLength(1);
  });
});

describe('excerpt', () => {
  it('cuts the text around the first word found, and marks it', () => {
    const text = `${'a '.repeat(60)}the Theme matters ${'b '.repeat(60)}`;
    const passage = excerpt(text, 'theme', 10);
    expect(passage?.match).toBe('Theme');
    expect(passage?.before.startsWith('…')).toBe(true);
    expect(passage?.after.endsWith('…')).toBe(true);
  });

  it('keeps the original accents of the match', () => {
    expect(excerpt('Le déploiement se fait en ligne.', 'deploiement')?.match).toBe('déploiement');
  });

  it('finds nothing when no word is there', () => {
    expect(excerpt('Some text.', 'absent')).toBeNull();
  });
});

describe('htmlToText', () => {
  it('keeps the text a reader sees', () => {
    const html =
      '<h2 id="a">Install &amp; run</h2><p>Type <code>npx&nbsp;docpensieve</code>.</p>' +
      '<svg><title>icon</title></svg><style>p{}</style><p>It&#x27;s done&#46;</p>';
    expect(htmlToText(html)).toBe("Install & run Type npx docpensieve . It's done.");
  });
});

describe('searchPageContent', () => {
  it('lists every page, so that the page is useful without its script', () => {
    const html = searchPageContent(
      [
        { title: 'Guide', url: '/guide/', description: 'In order.' },
        { title: 'A <b>', url: '/a/', description: '' },
      ],
      '/assets/search-index.json',
    );
    expect(html).toContain('data-index="/assets/search-index.json"');
    expect(html).toContain(
      '<li data-url="/guide/"><a href="/guide/">Guide</a><p>In order.</p></li>',
    );
    expect(html).toContain('A &lt;b&gt;');
    expect(html).toContain('2 pages.');
  });
});
