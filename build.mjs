import * as esbuild from "esbuild";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const watch = process.argv.includes("--watch");
const target = process.argv.find(
  (a) => a === "--firefox" || a === "--chromium" || a === "--chrome"
);
const buildChromium = !target || target === "--chromium" || target === "--chrome";
const buildFirefox = !target || target === "--firefox";

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
if (buildFirefox) prepareDistDir("dist/firefox", "src/manifest.firefox.json");

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
  if (buildFirefox) {
    await buildTarget("dist/firefox");
    console.log("✓ Firefox build complete → dist/firefox/");
  }
}

if (watch) {
  // Watch mode: rebuild on changes for all active targets
  const targets = [];
  if (buildChromium) targets.push("dist/chromium");
  if (buildFirefox) targets.push("dist/firefox");

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
