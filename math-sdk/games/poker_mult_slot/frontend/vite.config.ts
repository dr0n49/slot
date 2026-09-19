import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
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
