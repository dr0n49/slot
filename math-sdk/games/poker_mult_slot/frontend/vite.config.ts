import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Boot-speed: `npm run preview` serves the precompressed sidecars
 * (scripts/compress-release.mjs) the way a production static host would —
 * request /file → /file.br (or .gz) with Content-Encoding and the ORIGINAL
 * file's Content-Type. Vite's built-in on-the-fly compression only covers
 * text types, which left the Godot engine (~39.5 MB) and the game pack
 * (~12 MB) shipping raw through preview. Plugin hook, because
 * configurePreviewServer is not a plain config-file option.
 */
function previewPrecompressed(): Plugin {
  return {
    name: "muerta-preview-precompressed",
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" || !req.url) return next();
        const accept = String(req.headers["accept-encoding"] ?? "");
        const urlPath = decodeURIComponent(req.url.split("?")[0]);
        const base = path.join(process.cwd(), "dist", urlPath);
        for (const [ext, enc] of [
          [".br", "br"],
          [".gz", "gzip"],
        ] as const) {
          if (!accept.includes(enc)) continue;
          // Only when the raw file exists too — never serve sidecars for 404s.
          if (!existsSync(base)) break;
          const sidecar = base + ext;
          if (!existsSync(sidecar)) continue;
          // Weak etag over the sidecar bytes + 304 handling: the boot preload
          // in index.html stores the response; the engine's own fetch inside
          // the iframe then revalidates for free instead of re-downloading
          // 19 MB (Cache-Control: no-cache requires a validator).
          const st = statSync(sidecar);
          const etag = `W/"${st.size}-${st.mtimeMs}"`;
          const inm = String(req.headers["if-none-match"] ?? "");
          res.setHeader("ETag", etag);
          // Short memory-cache window: the iframe's warm fetch (head_include)
          // and the engine loader's own fetch of the same URL dedupe against
          // the cached response instead of re-downloading ~19 MB after the
          // (main-thread-blocking) wasm compile. no-cache made Chrome skip
          // reuse entirely here — measured, not assumed.
          res.setHeader("Cache-Control", "public, max-age=300");
          res.setHeader("Vary", "Accept-Encoding");
          if (inm && inm === etag) {
            res.statusCode = 304;
            res.end();
            return;
          }
          const mime =
            {
              ".js": "text/javascript",
              ".css": "text/css",
              ".wasm": "application/wasm",
              ".html": "text/html",
              ".png": "image/png",
              ".wav": "audio/wav",
              ".json": "application/json",
              ".webp": "image/webp",
              ".svg": "image/svg+xml",
              ".woff2": "font/woff2",
            }[path.extname(base).toLowerCase()] ?? "application/octet-stream";
          res.setHeader("Content-Encoding", enc);
          res.setHeader("Content-Type", mime);
          res.end(readFileSync(sidecar));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), previewPrecompressed()],
  server: {
    host: "127.0.0.1",
    port: 5182,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
// Muerta Poker: touched so the dev server restarts and rescans public/ assets.
