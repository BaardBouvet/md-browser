import * as esbuild from "esbuild";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const watch = process.argv.includes("--watch");

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
  const bgR = 0, bgG = 0, bgB = 0, bgA = 0; // transparent background

  const radius = Math.max(Math.floor(size * 0.22), 2);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA

  const rowLen = size * 4 + 1; // +1 for filter byte
  const raw = Buffer.alloc(rowLen * size);

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
        raw[off] = r;
        raw[off + 1] = g;
        raw[off + 2] = b;
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
// 2. Prepare dist directory
// ---------------------------------------------------------------------------

mkdirSync("dist/icons", { recursive: true });
mkdirSync("dist/popup", { recursive: true });

// Generate icons
for (const size of [16, 48, 128]) {
  writeFileSync(`dist/icons/icon${size}.png`, createIconPNG(size));
}

// Copy static files
cpSync("src/manifest.json", "dist/manifest.json");
cpSync("src/popup/popup.html", "dist/popup/popup.html");
cpSync("src/popup/popup.css", "dist/popup/popup.css");

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

async function build() {
  // Background service worker
  await esbuild.build({
    ...commonOptions,
    entryPoints: ["src/background.ts"],
    outfile: "dist/background.js",
    format: "iife",
  });

  // Content script (bundles markdown-it; CSS imported as text)
  await esbuild.build({
    ...commonOptions,
    entryPoints: ["src/content.ts"],
    outfile: "dist/content.js",
    format: "iife",
    loader: { ".css": "text" },
  });

  // Popup script
  await esbuild.build({
    ...commonOptions,
    entryPoints: ["src/popup/popup.ts"],
    outfile: "dist/popup/popup.js",
    format: "iife",
  });

  console.log("✓ Build complete → dist/");
}

if (watch) {
  // Watch mode: rebuild on changes
  const contexts = await Promise.all([
    esbuild.context({
      ...commonOptions,
      entryPoints: ["src/background.ts"],
      outfile: "dist/background.js",
      format: "iife",
    }),
    esbuild.context({
      ...commonOptions,
      entryPoints: ["src/content.ts"],
      outfile: "dist/content.js",
      format: "iife",
      loader: { ".css": "text" },
    }),
    esbuild.context({
      ...commonOptions,
      entryPoints: ["src/popup/popup.ts"],
      outfile: "dist/popup/popup.js",
      format: "iife",
    }),
  ]);
  await Promise.all(contexts.map((c) => c.watch()));
  console.log("👀 Watching for changes...");
} else {
  await build();
}
