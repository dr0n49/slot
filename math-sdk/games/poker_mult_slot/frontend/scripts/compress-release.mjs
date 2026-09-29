import { brotliCompressSync, gzipSync, constants as zlibConstants } from "node:zlib";
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Boot-speed helper (postbuild): generates precompressed sidecars (.br/.gz)
 * next to the big startup-path files in dist/, so any static host that supports
 * precompressed lookup (nginx brotli_static/gzip_static, CloudFront functions,
 * `vite preview` with the middleware in vite.config.ts) can serve them with
 * Content-Encoding instead of the raw bytes. The two giants are the Godot
 * engine (index.wasm, ~39.5 MB) and the game pack (index.pck, ~12 MB) — brotli
 * cuts the intro download to roughly a quarter of that.
 *
 * Idempotent: a sidecar is regenerated only when it is older than its source.
 */
const root = path.dirname(fileURLToPath(new URL(import.meta.url)));
const dist = path.resolve(root, "..", "dist");

const TARGETS = [
  "godot-slot/index.wasm",
  "godot-slot/index.pck",
  "godot-slot/index.js",
  "godot-slot/index.png",
  "godot-slot/index.icon.png",
  "godot-slot/index.apple-touch-icon.png",
  "assets/sounds/music_muerta.wav",
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const bundles = walk(path.join(dist, "assets")).filter((p) => /\.(js|css)$/.test(p));
const files = [...TARGETS.map((rel) => path.join(dist, rel)), ...bundles];

const QUALITY11 = { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } };
const CODECS = [
  [".br", (buf) => brotliCompressSync(buf, QUALITY11)],
  [".gz", (buf) => gzipSync(buf, { level: 8 })],
];

let made = 0;
for (const file of files) {
  if (!existsSync(file)) continue;
  const src = statSync(file);
  for (const [ext, fn] of CODECS) {
    const out = file + ext;
    if (existsSync(out) && statSync(out).mtimeMs >= src.mtimeMs) continue;
    const buf = fn(readFileSync(file));
    writeFileSync(out, buf);
    made += 1;
    console.log(`  ${path.relative(dist, out)} ${Math.round(buf.length / 1024)} KB (from ${(src.size / 1048576).toFixed(1)} MB)`);
  }
}
console.log(`compress-release: ${made} sidecar(s) written under dist/`);
