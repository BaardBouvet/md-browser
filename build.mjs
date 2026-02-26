import * as esbuild from "esbuild";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const watch = process.argv.includes("--watch");
const target = process.argv.find((a) => a === "--chromium" || a === "--chrome");
const buildChromium = !target || target === "--chromium" || target === "--chrome";

// ---------------------------------------------------------------------------
// 1. Generate simple PNG icons (solid rounded-rect style)
// ---------------------------------------------------------------------------

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

function createIconPNG(size) {
  // Blue-ish colour (#4A7FDB)
  const r = 74, g = 127, b = 219;
  const fr = 255, fg = 255, fb = 255; // foreground glyph (M)
  const bgR = 0, bgG = 0, bgB = 0, bgA = 0; // transparent background

  const radius = Math.max(Math.floor(size * 0.22), 2);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA

  const rowLen = size * 4 + 1; // +1 for filter byte
  const raw = Buffer.alloc(rowLen * size);

  const glyphTop = Math.floor(size * 0.22);
  const glyphBottom = Math.floor(size * 0.78);
  const glyphInset = Math.floor(size * 0.24);
  const stroke = Math.max(1, Math.floor(size * 0.1));

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

  function isGlyphPixel(x, y) {
    if (y < glyphTop || y > glyphBottom) return false;

    const leftX = glyphInset;
    const rightX = size - 1 - glyphInset;
    const centerX = Math.floor((leftX + rightX) / 2);
    const innerTopY = glyphTop + Math.floor((glyphBottom - glyphTop) * 0.48);

    const maxDist = stroke / 2;

    const leftStem = pointToSegmentDistance(x, y, leftX, glyphBottom, leftX, glyphTop) <= maxDist;
    const rightStem =
      pointToSegmentDistance(x, y, rightX, glyphBottom, rightX, glyphTop) <= maxDist;
    const leftDiagonal =
      pointToSegmentDistance(x, y, leftX, glyphTop, centerX, innerTopY) <= maxDist;
    const rightDiagonal =
      pointToSegmentDistance(x, y, rightX, glyphTop, centerX, innerTopY) <= maxDist;

    return leftStem || rightStem || leftDiagonal || rightDiagonal;
  }

  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const off = y * rowLen + 1 + x * 4;

      // Rounded-corner distance check
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
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist > radius) {
            inside = false;
            break;
          }
        }
      }

      if (inside) {
        if (isGlyphPixel(x, y)) {
          raw[off] = fr;
          raw[off + 1] = fg;
          raw[off + 2] = fb;
        } else {
          raw[off] = r;
          raw[off + 1] = g;
          raw[off + 2] = b;
        }
        raw[off + 3] = 255;
      } else {
        raw[off] = bgR;
        raw[off + 1] = bgG;
        raw[off + 2] = bgB;
        raw[off + 3] = bgA;
      }
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 2. Prepare dist directories
// ---------------------------------------------------------------------------

function prepareDistDir(distDir, manifestSrc) {
  mkdirSync(`${distDir}/icons`, { recursive: true });
  mkdirSync(`${distDir}/popup`, { recursive: true });

  for (const size of [16, 48, 128]) {
    writeFileSync(`${distDir}/icons/icon${size}.png`, createIconPNG(size));
  }

  cpSync(manifestSrc, `${distDir}/manifest.json`);
  cpSync("src/popup/popup.html", `${distDir}/popup/popup.html`);
  cpSync("src/popup/popup.css", `${distDir}/popup/popup.css`);
}

if (buildChromium) prepareDistDir("dist/chromium", "src/manifest.json");

// ---------------------------------------------------------------------------
// 3. Bundle TypeScript
// ---------------------------------------------------------------------------

/** @type {import('esbuild').BuildOptions} */
const commonOptions = {
  bundle: true,
  sourcemap: false,
  target: "es2022",
  logLevel: "info",
};

async function buildTarget(distDir) {
  // Background service worker
  await esbuild.build({
    ...commonOptions,
    entryPoints: ["src/background.ts"],
    outfile: `${distDir}/background.js`,
    format: "iife",
  });

  // Content script (bundles markdown-it; CSS imported as text)
  await esbuild.build({
    ...commonOptions,
    entryPoints: ["src/content.ts"],
    outfile: `${distDir}/content.js`,
    format: "iife",
    loader: { ".css": "text" },
  });

  // Popup script
  await esbuild.build({
    ...commonOptions,
    entryPoints: ["src/popup/popup.ts"],
    outfile: `${distDir}/popup/popup.js`,
    format: "iife",
  });
}

async function build() {
  if (buildChromium) {
    await buildTarget("dist/chromium");
    console.log("✓ Chromium (Chrome/Edge) build complete → dist/chromium/");
  }
}

if (watch) {
  // Watch mode: rebuild on changes for active target
  const targets = [];
  if (buildChromium) targets.push("dist/chromium");

  const contexts = [];
  for (const distDir of targets) {
    contexts.push(
      esbuild.context({
        ...commonOptions,
        entryPoints: ["src/background.ts"],
        outfile: `${distDir}/background.js`,
        format: "iife",
      }),
      esbuild.context({
        ...commonOptions,
        entryPoints: ["src/content.ts"],
        outfile: `${distDir}/content.js`,
        format: "iife",
        loader: { ".css": "text" },
      }),
      esbuild.context({
        ...commonOptions,
        entryPoints: ["src/popup/popup.ts"],
        outfile: `${distDir}/popup/popup.js`,
        format: "iife",
      })
    );
  }
  const resolved = await Promise.all(contexts);
  await Promise.all(resolved.map((c) => c.watch()));
  console.log(`👀 Watching for changes... (${targets.join(", ")})`);
} else {
  await build();
}
