import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/ui/index.ts'),
      name: 'CypressApiDbUI',
      formats: ['iife'],
      fileName: () => 'ui.js',
    },
    outDir: 'dist/ui',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: 'ui.[ext]',
        extend: true,
        exports: 'named',
      },
    },
    // No minificar para debugging
    minify: false,
  },
});
