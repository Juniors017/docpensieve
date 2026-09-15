/**
 * Dimensions of an image, read from the first bytes of its file.
 *
 * The build writes them on every image of a page: the browser then keeps the
 * room before the image arrives, instead of shifting the text when it does.
 * Only the header of each format is read — no decoding, no dependency.
 *
 * @module @docpensieve/core/image-size
 */

/**
 * @typedef {{ width: number, height: number }} ImageSize
 */

/**
 * @param {Buffer} bytes
 * @returns {ImageSize | null}
 */
function png(bytes) {
  // Signature, then the IHDR chunk: width and height, big-endian.
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * @param {Buffer} bytes
 * @returns {ImageSize | null}
 */
function gif(bytes) {
  if (bytes.length < 10 || bytes.toString('ascii', 0, 3) !== 'GIF') return null;
  return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
}

/**
 * @param {Buffer} bytes
 * @returns {ImageSize | null}
 */
function jpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  // Walk the segments up to the frame header (SOF), which holds the size.
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  return null;
}

/**
 * @param {Buffer} bytes
 * @returns {ImageSize | null}
 */
function webp(bytes) {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (bytes.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  return null;
}

/**
 * @param {Buffer} bytes
 * @returns {ImageSize | null}
 */
function svg(bytes) {
  const text = bytes.toString('utf8', 0, Math.min(bytes.length, 4096));
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return null;
  /** @param {string} name */
  const attribute = (name) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag)?.[1];

  // Width and height in pixels, or failing that the proportions of the viewBox.
  const width = Number.parseFloat(attribute('width') ?? '');
  const height = Number.parseFloat(attribute('height') ?? '');
  const inPixels = (/** @type {string | undefined} */ value) =>
    !value || /^[\d.]+(px)?$/.test(value.trim());
  if (width > 0 && height > 0 && inPixels(attribute('width')) && inPixels(attribute('height'))) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const box = (attribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box.length === 4 && box[2] > 0 && box[3] > 0) {
    return { width: Math.round(box[2]), height: Math.round(box[3]) };
  }
  return null;
}

/**
 * Reads the dimensions of an image from its content.
 *
 * @param {Buffer} bytes Content of the file — its first kilobytes are enough.
 * @param {string} extension Extension of the file, dot included.
 * @returns {ImageSize | null} `null` for an unknown or damaged format: the
 *   image is then written without dimensions, as before.
 */
export function imageSize(bytes, extension) {
  switch (extension.toLowerCase()) {
    case '.png':
      return png(bytes);
    case '.jpg':
    case '.jpeg':
      return jpeg(bytes);
    case '.gif':
      return gif(bytes);
    case '.webp':
      return webp(bytes);
    case '.svg':
      return svg(bytes);
    default:
      return null;
  }
}
