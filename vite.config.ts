import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  resolve: {
    alias: {
      $lib: resolve(import.meta.dirname, 'src/lib'),
    },
  },
  plugins: [
    svelte({
      compilerOptions: {
        css: 'injected',
      },
    }),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts', 'src/**/*.svelte'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['cypress'],
      output: {
        assetFileNames: 'index.[ext]',
      },
    },
    minify: false,
  },
});
