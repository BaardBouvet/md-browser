import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function createBlankRgba(width, height) {
  const rowLen = width * 4 + 1;
  return Buffer.alloc(rowLen * height);
}

function writePixel(raw, width, x, y, r, g, b, a) {
  const rowLen = width * 4 + 1;
  const off = y * rowLen + 1 + x * 4;
  raw[off] = r;
  raw[off + 1] = g;
  raw[off + 2] = b;
  raw[off + 3] = a;
}

function encodePng(width, height, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);

  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
  );
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function makeGlyphMask(size) {
  const glyphTop = Math.floor(size * 0.22);
  const glyphBottom = Math.floor(size * 0.78);
  const glyphInset = Math.floor(size * 0.24);
  const stroke = Math.max(1, Math.floor(size * 0.1));

  const leftX = glyphInset;
  const rightX = size - 1 - glyphInset;
  const centerX = Math.floor((leftX + rightX) / 2);
  const innerTopY = glyphTop + Math.floor((glyphBottom - glyphTop) * 0.48);
  const maxDist = stroke / 2;

  return (x, y) => {
    if (y < glyphTop || y > glyphBottom) return false;
    const leftStem = pointToSegmentDistance(x, y, leftX, glyphBottom, leftX, glyphTop) <= maxDist;
    const rightStem = pointToSegmentDistance(x, y, rightX, glyphBottom, rightX, glyphTop) <= maxDist;
    const leftDiagonal =
      pointToSegmentDistance(x, y, leftX, glyphTop, centerX, innerTopY) <= maxDist;
    const rightDiagonal =
      pointToSegmentDistance(x, y, rightX, glyphTop, centerX, innerTopY) <= maxDist;
    return leftStem || rightStem || leftDiagonal || rightDiagonal;
  };
}

function drawRoundedSquare(raw, width, height, x0, y0, size, radius, color) {
  const [r, g, b, a] = color;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = x0 + x;
      const gy = y0 + y;
      if (gx < 0 || gy < 0 || gx >= width || gy >= height) continue;

      let inside = true;
      const corners = [
        [radius, radius],
        [size - 1 - radius, radius],
        [radius, size - 1 - radius],
        [size - 1 - radius, size - 1 - radius],
      ];

      for (const [cx, cy] of corners) {
        const inCorner =
          (x < radius ? x < cx + 1 : x > size - 1 - radius) &&
          (y < radius ? y < cy + 1 : y > size - 1 - radius);
        if (inCorner) {
          const dist = Math.hypot(x - cx, y - cy);
          if (dist > radius) {
            inside = false;
            break;
          }
        }
      }

      if (inside) writePixel(raw, width, gx, gy, r, g, b, a);
    }
  }
}

function drawGlyphM(raw, width, x0, y0, size, color) {
  const [r, g, b, a] = color;
  const isGlyphPixel = makeGlyphMask(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isGlyphPixel(x, y)) continue;
      const gx = x0 + x;
      const gy = y0 + y;
      writePixel(raw, width, gx, gy, r, g, b, a);
    }
  }
}

function createSquareIconPng(size) {
  const raw = createBlankRgba(size, size);
  const radius = Math.max(Math.floor(size * 0.22), 2);
  for (let y = 0; y < size; y++) raw[y * (size * 4 + 1)] = 0;

  drawRoundedSquare(raw, size, size, 0, 0, size, radius, [74, 127, 219, 255]);
  drawGlyphM(raw, size, 0, 0, size, [255, 255, 255, 255]);

  return encodePng(size, size, raw);
}

function createSmallTilePng(width, height) {
  const raw = createBlankRgba(width, height);
  for (let y = 0; y < height; y++) raw[y * (width * 4 + 1)] = 0;

  // Background fill
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      writePixel(raw, width, x, y, 14, 22, 36, 255);
    }
  }

  const iconSize = Math.floor(Math.min(width, height) * 0.58);
  const x0 = Math.floor((width - iconSize) / 2);
  const y0 = Math.floor((height - iconSize) / 2);
  const radius = Math.max(Math.floor(iconSize * 0.22), 2);

  drawRoundedSquare(raw, width, height, x0, y0, iconSize, radius, [74, 127, 219, 255]);
  drawGlyphM(raw, width, x0, y0, iconSize, [255, 255, 255, 255]);

  return encodePng(width, height, raw);
}

mkdirSync("store-assets", { recursive: true });

writeFileSync("store-assets/extension-icon-300.png", createSquareIconPng(300));
writeFileSync("store-assets/logo-300.png", createSquareIconPng(300));
writeFileSync("store-assets/small-tile-440x280.png", createSmallTilePng(440, 280));

console.log("✓ Store assets generated in store-assets/");
