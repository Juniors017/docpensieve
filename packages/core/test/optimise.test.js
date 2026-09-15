import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { Compiler } from '../src/index.js';
import { imageSize } from '../src/image-size.js';
import { minifyCss } from '../src/minify-css.js';

/** @type {string[]} */
const created = [];

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * The first bytes of a PNG: its signature, then the IHDR chunk.
 * @param {number} width @param {number} height
 */
const pngHeader = (width, height) => {
  const bytes = Buffer.alloc(24);
  bytes.writeUInt32BE(0x89504e47, 0);
  bytes.writeUInt32BE(0x0d0a1a0a, 4);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
};

describe('minifyCss', () => {
  it('drops comments and the whitespace nothing reads', () => {
    const css =
      '/* Tokens */\n:root {\n  --dp-bg: #fff;\n  color: red;\n}\n\n.a :hover {\n  margin: 0 auto;\n}\n';
    expect(minifyCss(css)).toBe(':root{--dp-bg: #fff;color: red}.a :hover{margin: 0 auto}');
  });

  it('never touches a string', () => {
    const css = '.q::before {\n  content: "/*  not a comment  */";\n}';
    expect(minifyCss(css)).toBe('.q::before{content: "/*  not a comment  */"}');
  });

  it('keeps the space that separates two selectors or two values', () => {
    expect(minifyCss('@media (min-width: 40rem) {\n  .a .b { font: 1rem / 1.5 serif; }\n}')).toBe(
      '@media (min-width: 40rem){.a .b{font: 1rem / 1.5 serif}}',
    );
  });
});

describe('imageSize', () => {
  it('reads a PNG', () => {
    expect(imageSize(pngHeader(640, 480), '.png')).toEqual({ width: 640, height: 480 });
  });

  it('reads a GIF', () => {
    const bytes = Buffer.alloc(10);
    bytes.write('GIF89a', 0, 'ascii');
    bytes.writeUInt16LE(32, 6);
    bytes.writeUInt16LE(16, 8);
    expect(imageSize(bytes, '.gif')).toEqual({ width: 32, height: 16 });
  });

  it('reads a JPEG, past the segments before its frame', () => {
    const bytes = Buffer.alloc(40);
    bytes.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], 0);
    bytes.set([0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x30, 0x00, 0x40], 20);
    expect(imageSize(bytes, '.jpg')).toEqual({ width: 64, height: 48 });
  });

  it('reads an extended WebP', () => {
    const bytes = Buffer.alloc(30);
    bytes.write('RIFF', 0, 'ascii');
    bytes.write('WEBPVP8X', 8, 'ascii');
    bytes.writeUIntLE(199, 24, 3);
    bytes.writeUIntLE(99, 27, 3);
    expect(imageSize(bytes, '.webp')).toEqual({ width: 200, height: 100 });
  });

  it('reads an SVG, from its size or its viewBox', () => {
    const sized = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40">');
    expect(imageSize(sized, '.svg')).toEqual({ width: 120, height: 40 });
    const boxed = Buffer.from('<svg viewBox="0 0 24 12" width="100%">');
    expect(imageSize(boxed, '.svg')).toEqual({ width: 24, height: 12 });
  });

  it('gives up on an unknown or damaged file', () => {
    expect(imageSize(Buffer.from('not an image'), '.png')).toBeNull();
    expect(imageSize(Buffer.alloc(8), '.bmp')).toBeNull();
  });
});

describe('the images of a page', () => {
  it('get their dimensions, and all but the first load lazily', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'docpensieve-img-'));
    created.push(dir);
    writeFileSync(path.join(dir, 'diagram.png'), pngHeader(10, 20));

    const { html, preloads } = await new Compiler({ highlight: false }).compile(
      '![First](./diagram.png)\n\n![Second](./diagram.png)\n\n![Elsewhere](https://example.com/x.png)\n',
      {
        filepath: path.join(dir, 'page.md'),
        url: '/page/',
        dirUrl: '/',
        basePath: '/',
        sourceDir: dir,
      },
    );

    const [, first, second, remote] = html.split('<img');
    expect(first).toContain('width="10"');
    expect(first).toContain('height="20"');
    // The first image is often in view: it keeps its normal loading.
    expect(first).not.toContain('loading=');
    expect(second).toContain('loading="lazy"');
    expect(second).toContain('width="10"');
    // A remote image has no file to read, and loads lazily all the same.
    expect(remote).not.toContain('width=');
    expect(remote).toContain('loading="lazy"');
    // React only preloads the image that is not lazy.
    expect(preloads).toHaveLength(1);
  });
});
