import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

const sourcemap = process.env.NODE_ENV === 'production' ? 'hidden' : true;

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string };

const mainDefines = {
  __APP_VERSION__: JSON.stringify(pkg.version),
  __SENTRY_DSN_MAIN__: JSON.stringify(process.env.SENTRY_DSN_MAIN ?? ''),
};

export default defineConfig({
  main: {
    define: mainDefines,
    build: {
      outDir: 'dist-electron/main',
      sourcemap,
      lib: {
        entry: resolve(__dirname, 'electron/main.ts'),
      },
      rollupOptions: {
        external: ['electron-updater'],
        output: {
          format: 'es',
          entryFileNames: 'index.js',
        },
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist-electron/preload',
      sourcemap,
      lib: {
        entry: resolve(__dirname, 'electron/preload.ts'),
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs',
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname),
    publicDir: resolve(__dirname, 'public'),
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    },
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    server: {
      port: 5173,
    },
  },
});
