import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

// Separate audition build. The normal production entry never imports the slice.
export default mergeConfig(base, defineConfig({
  build: {
    outDir: "dist-slice",
    rollupOptions: { input: "renderer-slice.html" },
    manifest: true,
  },
}));
