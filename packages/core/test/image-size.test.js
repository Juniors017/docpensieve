import { describe, expect, it } from 'vitest';

import { imageSize } from '../src/image-size.js';

/**
 * The size of an image, read from its first bytes.
 *
 * Every page gets the dimensions of its images, so that the text does not jump
 * when they arrive. A file this module misreads would be written with wrong
 * dimensions — distorted, silently — so what matters as much as reading a
 * good file is refusing a damaged one: `null` writes the image as it was
 * before, without dimensions, which is never wrong.
 */

/** A WebP container around one chunk, padded to what the reader needs. */
function webp(/** @type {string} */ chunk, /** @type {(bytes: Buffer) => void} */ fill) {
  const bytes = Buffer.alloc(40);
  bytes.write('RIFF', 0, 'ascii');
  bytes.write('WEBP', 8, 'ascii');
  bytes.write(chunk, 12, 'ascii');
  fill(bytes);
  return bytes;
}

describe('the formats it reads', () => {
  it('reads a GIF from its logical screen', () => {
    const bytes = Buffer.alloc(10);
    bytes.write('GIF89a', 0, 'ascii');
    bytes.writeUInt16LE(320, 6);
    bytes.writeUInt16LE(200, 8);
    expect(imageSize(bytes, '.gif')).toEqual({ width: 320, height: 200 });
  });

  it('reads the three kinds of WebP', () => {
    // Lossy: fourteen bits of width and height after the start code.
    const lossy = webp('VP8 ', (bytes) => {
      bytes.writeUInt16LE(640, 26);
      bytes.writeUInt16LE(480, 28);
    });
    expect(imageSize(lossy, '.webp')).toEqual({ width: 640, height: 480 });

    // Lossless: both sizes packed in one word, each stored minus one.
    const lossless = webp('VP8L', (bytes) => {
      bytes.writeUInt32LE((800 - 1) | ((600 - 1) << 14), 21);
    });
    expect(imageSize(lossless, '.webp')).toEqual({ width: 800, height: 600 });

    // Extended: twenty-four bits each, minus one.
    const extended = webp('VP8X', (bytes) => {
      bytes.writeUIntLE(1200 - 1, 24, 3);
      bytes.writeUIntLE(630 - 1, 27, 3);
    });
    expect(imageSize(extended, '.webp')).toEqual({ width: 1200, height: 630 });
  });

  it('reads the extension whatever its case', () => {
    const bytes = Buffer.alloc(10);
    bytes.write('GIF89a', 0, 'ascii');
    bytes.writeUInt16LE(1, 6);
    bytes.writeUInt16LE(2, 8);
    expect(imageSize(bytes, '.GIF')).toEqual({ width: 1, height: 2 });
  });
});

describe('what it refuses rather than misread', () => {
  it('a file whose content is not the format its name says', () => {
    const text = Buffer.from('not an image at all, only text that is long enough');
    for (const extension of ['.png', '.gif', '.jpg', '.webp']) {
      expect(imageSize(text, extension)).toBeNull();
    }
  });

  it('a file cut too short to hold its size', () => {
    expect(imageSize(Buffer.from('GIF'), '.gif')).toBeNull();
    expect(imageSize(Buffer.from([0xff, 0xd8]), '.jpg')).toBeNull();
    expect(imageSize(Buffer.from('RIFF'), '.webp')).toBeNull();
  });

  it('a JPEG whose segments do not follow one another', () => {
    // After the start marker, every segment must open with 0xFF: a stray byte
    // means the walk has lost its place, and a size read there would be noise.
    const lost = Buffer.from([0xff, 0xd8, 0x00, 0x11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(imageSize(lost, '.jpg')).toBeNull();
  });

  it('a JPEG that ends before its frame header', () => {
    // One application segment, then nothing: no frame, so no size.
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0, 0, 0, 0]);
    expect(imageSize(bytes, '.jpg')).toBeNull();
  });

  it('a RIFF file that is not a WebP, or a WebP chunk it does not know', () => {
    const wave = Buffer.alloc(40);
    wave.write('RIFF', 0, 'ascii');
    wave.write('WAVE', 8, 'ascii');
    expect(imageSize(wave, '.webp')).toBeNull();

    expect(
      imageSize(
        webp('ALPH', () => {}),
        '.webp',
      ),
    ).toBeNull();
  });

  it('an SVG with no svg element, or with nothing to size it by', () => {
    expect(imageSize(Buffer.from('<html></html>'), '.svg')).toBeNull();
    // Percentages say nothing about the drawing, and there is no viewBox.
    expect(imageSize(Buffer.from('<svg width="100%" height="50%"></svg>'), '.svg')).toBeNull();
  });

  it('a format it has no reader for', () => {
    expect(imageSize(Buffer.alloc(64), '.avif')).toBeNull();
  });
});
