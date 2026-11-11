import { defineConfig } from 'vite';

// Tailwind runs through PostCSS (postcss.config.js at the repo root points at web/tailwind.config.js).
export default defineConfig({
  root: 'web',
  build: { outDir: 'dist', emptyOutDir: true },
});
