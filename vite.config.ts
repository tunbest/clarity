import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'node:path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './', // assets relatifs : compatible avec un build statique ouvert depuis un dossier local
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          redirect: resolve(__dirname, 'redirect.html'),
        },
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
