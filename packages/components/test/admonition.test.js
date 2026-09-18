import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DocPensieveError } from '@docpensieve/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { ADMONITION_KINDS, Admonition, setAdmonitionKinds } from '../src/admonition.js';
import { setSiteContext } from '../src/site.js';

const render = (/** @type {any} */ element) => renderToStaticMarkup(element);

/** @type {string[]} */
const created = [];

/** A version folder holding one icon, as a project would have. */
function versionWithIcon() {
  const dir = mkdtempSync(path.join(tmpdir(), 'docpensieve-adm-'));
  created.push(dir);
  mkdirSync(path.join(dir, 'icons'));
  writeFileSync(
    path.join(dir, 'icons', 'house.svg'),
    '<svg viewBox="0 0 24 24"><path d="M3 12 12 3l9 9" /></svg>',
    'utf8',
  );
  return dir;
}

afterEach(() => {
  setAdmonitionKinds({});
  setSiteContext({});
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('Admonition', () => {
  it('ships the six kinds, each with its label', () => {
    expect(Object.keys(ADMONITION_KINDS)).toEqual([
      'note',
      'info',
      'tip',
      'attention',
      'alert',
      'danger',
    ]);

    for (const [type, kind] of Object.entries(ADMONITION_KINDS)) {
      const html = render(h(Admonition, { type }, 'Body'));
      expect(html).toContain(`>${kind.label}</p>`);
      expect(html).toContain(`dp-admonition--${kind.tone}`);
    }
  });

  it('is a note by default, and set apart for a screen reader', () => {
    const html = render(h(Admonition, null, 'Body'));
    expect(html).toContain('<aside class="dp-admonition dp-admonition--note" role="note">');
    expect(html).toContain('Note');
  });

  it('takes a title of its own', () => {
    const html = render(h(Admonition, { type: 'danger', title: 'Do not do this' }, 'Body'));
    expect(html).toContain('Do not do this');
    expect(html).not.toContain('>Danger</p>');
  });

  it('hides its icon from screen readers', () => {
    // The title beside it already names the kind.
    expect(render(h(Admonition, { type: 'tip' }, 'Body'))).toContain('aria-hidden="true"');
  });

  it('takes the kinds the project declares', () => {
    setAdmonitionKinds({ review: { label: 'To review', tone: 'attention' } });
    const html = render(h(Admonition, { type: 'review' }, 'Body'));

    expect(html).toContain('To review');
    expect(html).toContain('dp-admonition--attention');
  });

  it('carries the mark of a kind that brings one', () => {
    // A kind of its own may have a logo; without one, the drawing of its tone
    // stands. The icon is inlined from the version folder, as elsewhere.
    setAdmonitionKinds({ house: { label: 'House', tone: 'info', icon: '/icons/house.svg' } });
    setSiteContext({ url: '/v/', basePath: '/v/', sourceDir: versionWithIcon() });

    const html = render(h(Admonition, { type: 'house' }, 'Body'));
    expect(html).toContain('House');
    // The file is inlined, in place of the drawing of the tone.
    expect(html).toContain('M3 12 12 3l9 9');
    expect(html).toContain('dp-admonition--info');
  });

  it('refuses a kind nobody declared, and says which exist', () => {
    // Rendered anyway, the block would have no colour and no label.
    let failure;
    try {
      render(h(Admonition, { type: 'wisdom' }, 'Body'));
    } catch (error) {
      failure = /** @type {DocPensieveError} */ (error);
    }
    expect(failure).toBeInstanceOf(DocPensieveError);
    expect(failure?.message).toContain('"wisdom"');
    expect(failure?.hint).toContain('danger');
    expect(failure?.hint).toContain('admonitions field');
  });

  it('keeps the classes and the styling given at use', () => {
    const html = render(h(Admonition, { type: 'info', className: 'wide' }, 'Body'));
    expect(html).toContain('class="dp-admonition dp-admonition--info wide"');
  });
});
