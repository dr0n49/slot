/**
 * Release package for Stake Engine: builds the frontend, drops the bundled demo books
 * (Stake plays real rounds through the RGS) and the Spine exports the game never loads,
 * and zips dist/ into ../release/.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const out = join(root, "..", "release");
const version = JSON.parse(execSync("npm pkg get version", { cwd: root }).toString()).replace?.(/"/g, "") ?? "0.0.0";

// The heavy PNGs the code loads by name ship as WebP (scripts/webp.py): refresh any whose PNG changed.
execSync("/usr/bin/python3 scripts/webp.py public", { cwd: root, stdio: "inherit" });
execSync("npx tsc --noEmit && npx vite build", { cwd: root, stdio: "inherit" });
rmSync(join(dist, "demo"), { recursive: true, force: true });

// public/spine keeps earlier rig exports: the spine tools derive new versions from them (frame-v25 from frame-v24,
// screens-v11 from screens-v10). The package only needs the rigs in runtime.ts RIGS and the pages their atlases name.
const rigs = readFileSync(join(root, "src/spine/runtime.ts"), "utf8");
const keep = new Set();
for (const [, path] of rigs.matchAll(/"\.\/(spine\/[^"]+\.(?:json|atlas))"/g)) {
  keep.add(path);
  if (!path.endsWith(".atlas")) continue;
  const dir = path.slice(0, path.lastIndexOf("/") + 1);
  for (const line of readFileSync(join(dist, path), "utf8").split("\n")) if (/^\S+\.(png|webp|jpg)$/.test(line.trim())) keep.add(dir + line.trim());
}
let pruned = 0;
const prune = (rel) => {
  const abs = join(dist, rel);
  if (statSync(abs).isDirectory()) {
    for (const f of readdirSync(abs)) prune(`${rel}/${f}`);
    if (!readdirSync(abs).length) rmSync(abs, { recursive: true });
  } else if (!keep.has(rel)) { pruned += statSync(abs).size; rmSync(abs); }
};
prune("spine");
console.log(`spine: kept ${keep.size} files, dropped ${(pruned / 1e6).toFixed(1)} MB of unused exports`);

// public/ also keeps art the game moved on from (older frames, the PNG titles the webp round screens replaced, the
// first win cards): ~11 MB the package carried for nothing. Dropped by name, and only if the built code never names it.
const STALE = [/^art\/frame_v(6|7|8|24)\.png$/, /^art\/ui\/(title_|banner_plaque|card_|digit_|ribbon_)[^/]*\.png$/,
  /^art\/modes\/mode_[a-z_]+_v[45]\.webp$/, // the buy cards before the v6 series

  /^art\/ui\/win_tree_v3\.png$/, /^character\/char\.png$/,
  /^art\/screens\/v5\/emblems\/[a-z_]+\.webp$/, // the per-tier emblems the heroine replaced on the win screens (1.0.33)
  /^art\/(frame|chest_open|chest_closed|portrait)\.png$/, // the first board frame and chest art, never loaded since
];
const code = readdirSync(join(dist, "assets")).filter((f) => /\.(js|css)$/.test(f))
  .map((f) => readFileSync(join(dist, "assets", f), "utf8")).join("\n") + readFileSync(join(dist, "index.html"), "utf8");
const walk = (rel) => statSync(join(dist, rel)).isDirectory() ? readdirSync(join(dist, rel)).flatMap((f) => walk(`${rel}/${f}`)) : [rel];
let stale = 0;
for (const rel of ["art", "character"].flatMap(walk)) {
  if (!STALE.some((re) => re.test(rel))) continue;
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  if (code.includes(name)) throw new Error(`release: ${rel} is listed as stale but the code loads it`);
  stale += statSync(join(dist, rel)).size;
  rmSync(join(dist, rel));
}
console.log(`art: dropped ${(stale / 1e6).toFixed(1)} MB of stale art`);

// A PNG the code now loads as WebP (scripts/webp.py public) stays in public/ only as the tools' source.
let twins = 0;
for (const rel of ["art", "character", "symbols"].flatMap(walk)) {
  if (!rel.endsWith(".png") || !existsSync(join(dist, rel.slice(0, -4) + ".webp"))) continue;
  if (code.includes(rel.slice(rel.lastIndexOf("/") + 1))) continue; // still named somewhere: keep it
  twins += statSync(join(dist, rel)).size;
  rmSync(join(dist, rel));
}
console.log(`webp: dropped ${(twins / 1e6).toFixed(1)} MB of PNGs shipped as WebP`);
// Spine atlas pages and the burst sheet become WebP in the package only (the exports keep writing PNG).
execSync("/usr/bin/python3 scripts/webp.py dist", { cwd: root, stdio: "inherit" });

const size = (p) => (statSync(p).isDirectory() ? readdirSync(p).reduce((s, f) => s + size(join(p, f)), 0) : statSync(p).size);
mkdirSync(out, { recursive: true });
const zip = join(out, `paradise_bloom_frontend_${version}.zip`);
if (existsSync(zip)) rmSync(zip);
execSync(`zip -qr "${zip}" . -x "*.DS_Store"`, { cwd: dist }); // Finder's folder files are not part of the game
console.log(`dist ${(size(dist) / 1e6).toFixed(1)} MB → ${zip} (${(statSync(zip).size / 1e6).toFixed(1)} MB)`);
