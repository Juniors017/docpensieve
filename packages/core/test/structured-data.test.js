import { StructuredDataError } from '@docpensieve/shared';
import { describe, expect, it } from 'vitest';

import { StructuredDataBuilder, normalizeConfig } from '../src/index.js';

const config = normalizeConfig({
  projectName: 'DocPensieve',
  siteUrl: 'https://docs.example.com',
  versions: [{ slug: 'v1.0', name: '1.0', folder: 'docs/v1.0' }],
});

/**
 * Builds a graph.
 * @param {Record<string, any>} frontmatter
 * @param {string} [url]
 * @param {Record<string, any>} [overrides] Replacement config.
 */
function graph(frontmatter, url = '/guide/installation/', overrides = config) {
  const result = new StructuredDataBuilder(frontmatter, url, overrides).build();
  // `build` returns null when there is nothing to publish. The tests calling
  // this helper expect a graph: failing here names the problem, instead of
  // letting it cascade a few lines further down.
  if (result === null) throw new Error('Expected a graph, none produced.');
  return result;
}

/**
 * @param {Record<string, any>} result
 * @param {string} type
 * @returns {Record<string, any> | undefined}
 */
const node = (result, type) =>
  result['@graph'].find((/** @type {Record<string, any>} */ entry) => entry['@type'] === type);

/**
 * Same thing, for the tests that assume the node is there.
 *
 * Failing here names what is missing, where reading a property of an absent
 * node would only say “undefined”.
 *
 * @param {Record<string, any>} result
 * @param {string} type
 * @returns {Record<string, any>}
 */
function requiredNode(result, type) {
  const found = node(result, type);
  if (found === undefined) throw new Error(`Expected a "${type}" node, absent from the graph.`);
  return found;
}

describe('graph structure', () => {
  it('produces a @context and a @graph', () => {
    const result = graph({ title: 'Page' });
    expect(result['@context']).toBe('https://schema.org');
    expect(Array.isArray(result['@graph'])).toBe(true);
  });

  it('returns null when structured data is turned off', () => {
    // Without going through `graph`, which refuses exactly this case: it is
    // the one checked here.
    const off = normalizeConfig({ ...config, jsonld: { enabled: false } });
    expect(new StructuredDataBuilder({ title: 'Page' }, '/p/', off).build()).toBeNull();
  });
});

describe('Organization', () => {
  it('takes the project name and URL', () => {
    const org = requiredNode(graph({ title: 'Page' }), 'Organization');
    expect(org).toMatchObject({
      '@id': 'https://docs.example.com/#organization',
      name: 'DocPensieve',
      url: 'https://docs.example.com',
    });
  });

  it('is referenced as the publisher of the article', () => {
    const result = graph({ title: 'Page' });
    expect(requiredNode(result, 'Article').publisher).toEqual({
      '@id': requiredNode(result, 'Organization')['@id'],
    });
  });
});

describe('Article', () => {
  it('uses Article by default', () => {
    expect(requiredNode(graph({ title: 'Page' }), 'Article')).toBeDefined();
  });

  it('accepts TechArticle and BlogPosting', () => {
    expect(
      requiredNode(graph({ title: 'P', jsonld: { type: 'TechArticle' } }), 'TechArticle'),
    ).toBeDefined();
    expect(
      requiredNode(graph({ title: 'P', jsonld: { type: 'BlogPosting' } }), 'BlogPosting'),
    ).toBeDefined();
  });

  it('refuses an unknown type and lists the accepted values', () => {
    try {
      graph({ title: 'P', jsonld: { type: 'Artcle' } });
      expect.unreachable('build should have thrown');
    } catch (error) {
      const failure = /** @type {StructuredDataError} */ (error);
      expect(failure).toBeInstanceOf(StructuredDataError);
      expect(failure.message).toContain('Artcle');
      expect(failure.hint).toContain('TechArticle');
    }
  });

  it('points to the page through mainEntityOfPage', () => {
    const article = requiredNode(graph({ title: 'Page' }), 'Article');
    expect(article['@id']).toBe('https://docs.example.com/guide/installation/#article');
    expect(article.mainEntityOfPage['@id']).toBe('https://docs.example.com/guide/installation/');
  });

  it('omits description, authors, keywords and image when missing', () => {
    const article = requiredNode(graph({ title: 'Page' }), 'Article');
    expect(article).not.toHaveProperty('description');
    expect(article).not.toHaveProperty('author');
    expect(article).not.toHaveProperty('keywords');
    expect(article).not.toHaveProperty('image');
  });

  it('carries the tags over as keywords', () => {
    const article = requiredNode(graph({ title: 'P', tags: ['guide', 'installation'] }), 'Article');
    expect(article.keywords).toEqual(['guide', 'installation']);
  });

  it('makes the preview image absolute', () => {
    const article = requiredNode(graph({ title: 'P', preview: '/img/a.png' }), 'Article');
    expect(article.image).toBe('https://docs.example.com/img/a.png');
  });

  it('leaves an already absolute image untouched', () => {
    const article = requiredNode(
      graph({ title: 'P', preview: 'https://cdn.example.com/a.png' }),
      'Article',
    );
    expect(article.image).toBe('https://cdn.example.com/a.png');
  });
});

describe('dates', () => {
  it('accepts a Date object, as YAML produces', () => {
    const article = requiredNode(graph({ title: 'P', date: new Date('2026-01-15') }), 'Article');
    expect(article.datePublished).toBe('2026-01-15');
  });

  it('accepts a date as a string', () => {
    const article = requiredNode(graph({ title: 'P', date: '2026-01-15' }), 'Article');
    expect(article.datePublished).toBe('2026-01-15');
  });

  it('falls back to the publication date without a modification date', () => {
    const article = requiredNode(graph({ title: 'P', date: '2026-01-15' }), 'Article');
    expect(article.dateModified).toBe('2026-01-15');
  });

  it('prefers the modification date when given', () => {
    const article = requiredNode(
      graph({ title: 'P', date: '2026-01-15', modified: '2026-02-20' }),
      'Article',
    );
    expect(article.datePublished).toBe('2026-01-15');
    expect(article.dateModified).toBe('2026-02-20');
  });

  it('ignores an unreadable date rather than produce an invalid field', () => {
    const article = requiredNode(graph({ title: 'P', date: 'last week' }), 'Article');
    expect(article).not.toHaveProperty('datePublished');
  });
});

describe('authors', () => {
  it('turns a list into Person nodes', () => {
    const article = requiredNode(
      graph({ title: 'P', authors: ['Alice Martin', 'Bob Smith'] }),
      'Article',
    );
    expect(article.author).toEqual([
      { '@type': 'Person', name: 'Alice Martin' },
      { '@type': 'Person', name: 'Bob Smith' },
    ]);
  });

  it('accepts a single author written without an array', () => {
    const article = requiredNode(graph({ title: 'P', authors: 'Alice Martin' }), 'Article');
    expect(article.author).toEqual([{ '@type': 'Person', name: 'Alice Martin' }]);
  });

  it('ignores empty entries', () => {
    const article = requiredNode(graph({ title: 'P', authors: ['', '  '] }), 'Article');
    expect(article).not.toHaveProperty('author');
  });
});

describe('BreadcrumbList', () => {
  it('produces none on the home page', () => {
    // A single crumb teaches nobody anything.
    expect(node(graph({ title: 'Home' }, '/'), 'BreadcrumbList')).toBeUndefined();
  });

  it('derives the crumbs from the path', () => {
    const crumbs = requiredNode(graph({ title: 'Installation' }), 'BreadcrumbList');
    expect(
      crumbs.itemListElement.map((/** @type {Record<string, any>} */ item) => [
        item.position,
        item.name,
      ]),
    ).toEqual([
      [1, 'Home'],
      [2, 'Guide'],
      [3, 'Installation'],
    ]);
  });

  it('uses the real titles given rather than the humanised slug', () => {
    // Since slugify dropped the accents, "cafe-guide" would come back as
    // "Cafe guide": the generator can supply the exact title.
    const builder = new StructuredDataBuilder({ title: 'Step 1' }, '/cafe-guide/step/', config, {
      breadcrumbTitles: { 'cafe-guide': 'Café Guide' },
    });
    const built = builder.build();
    if (built === null) throw new Error('Expected a graph, none produced.');
    const crumbs = requiredNode(built, 'BreadcrumbList');
    expect(crumbs.itemListElement[1].name).toBe('Café Guide');
  });

  it('humanises the segment when no title is known', () => {
    const crumbs = requiredNode(graph({ title: 'Page' }, '/setting-up/page/'), 'BreadcrumbList');
    expect(crumbs.itemListElement[1].name).toBe('Setting up');
  });

  it('gives absolute, cumulative URLs', () => {
    const crumbs = requiredNode(graph({ title: 'Installation' }), 'BreadcrumbList');
    expect(
      crumbs.itemListElement.map((/** @type {Record<string, any>} */ item) => item.item),
    ).toEqual([
      'https://docs.example.com/',
      'https://docs.example.com/guide/',
      'https://docs.example.com/guide/installation/',
    ]);
  });

  it('turns off through the frontmatter', () => {
    const result = graph({ title: 'P', jsonld: { breadcrumbs: false } });
    expect(node(result, 'BreadcrumbList')).toBeUndefined();
  });
});

describe('FAQPage', () => {
  const faq = [
    { question: 'Which Node version?', answer: '22 or later.' },
    { question: 'Windows?', answer: 'Yes.' },
  ];

  it('produces one Question per entry', () => {
    const page = requiredNode(graph({ title: 'P', jsonld: { faq } }), 'FAQPage');
    expect(page.mainEntity).toHaveLength(2);
    expect(page.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: 'Which Node version?',
      acceptedAnswer: { '@type': 'Answer', text: '22 or later.' },
    });
  });

  it('gives every question a stable anchor', () => {
    const page = requiredNode(graph({ title: 'P', jsonld: { faq } }), 'FAQPage');
    expect(page.mainEntity[0]['@id']).toContain('#faq-1-which-node-version');
  });

  it('tells apart two questions that only punctuation separates', () => {
    // Same slug, hence the same identifier without the rank: a JSON-LD
    // processor would have merged both nodes, and the second question vanished.
    const neighbours = [
      { question: 'Why?', answer: 'a' },
      { question: 'Why?!', answer: 'b' },
    ];
    const page = requiredNode(graph({ title: 'P', jsonld: { faq: neighbours } }), 'FAQPage');
    const ids = page.mainEntity.map((/** @type {Record<string, any>} */ q) => q['@id']);
    expect(new Set(ids).size).toBe(2);
  });

  it('emits nothing without a FAQ', () => {
    expect(node(graph({ title: 'P' }), 'FAQPage')).toBeUndefined();
    expect(node(graph({ title: 'P', jsonld: { faq: [] } }), 'FAQPage')).toBeUndefined();
  });

  it('locates an incomplete entry', () => {
    try {
      graph({ title: 'P', jsonld: { faq: [{ question: 'Alone' }] } });
      expect.unreachable('build should have thrown');
    } catch (error) {
      const failure = /** @type {StructuredDataError} */ (error);
      expect(failure).toBeInstanceOf(StructuredDataError);
      expect(failure.message).toContain('position 1');
      expect(failure.hint).toContain('answer');
    }
  });
});

describe('without a configured siteUrl', () => {
  const local = normalizeConfig({
    projectName: 'Local',
    versions: [{ slug: 'v1.0', name: '1.0', folder: 'docs/v1.0' }],
  });

  it('keeps relative URLs rather than blocking generation', () => {
    const article = requiredNode(graph({ title: 'P' }, '/guide/installation/', local), 'Article');
    expect(article['@id']).toBe('/guide/installation/#article');
  });
});

describe('toScriptTag', () => {
  it('wraps the graph in an ld+json tag', () => {
    const tag = new StructuredDataBuilder({ title: 'P' }, '/p/', config).toScriptTag();
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.endsWith('</script>')).toBe(true);
  });

  it('escapes angle brackets so as not to close the tag', () => {
    const tag = new StructuredDataBuilder(
      { title: 'Title with </script><img> inside' },
      '/p/',
      config,
    ).toScriptTag();

    // A single </script> must remain: the one closing the tag.
    expect(tag.match(/<\/script>/g)).toHaveLength(1);
    expect(tag).toContain('\\u003c/script');

    const json = tag.slice(tag.indexOf('>') + 1, tag.lastIndexOf('</script>'));
    expect(JSON.parse(json)['@graph'][1].headline).toBe('Title with </script><img> inside');
  });

  it('returns an empty string when structured data is turned off', () => {
    const off = normalizeConfig({ ...config, jsonld: { enabled: false } });
    expect(new StructuredDataBuilder({ title: 'P' }, '/p/', off).toScriptTag()).toBe('');
  });
});
