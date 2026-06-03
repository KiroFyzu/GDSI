import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Root folder untuk source
  root: '.',

  // Public assets (copied as-is ke dist/)
  publicDir: 'public',

  // Build output
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Multi-page app: setiap HTML jadi entry point
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'pages/index.html'),
        form: resolve(__dirname, 'pages/form.html'),
        qtt: resolve(__dirname, 'pages/qtt.html'),
        rules: resolve(__dirname, 'pages/gdsi_rules.html'),
        tnc: resolve(__dirname, 'pages/gdsi_tnc.html'),
      },
    },
  },

  // Env prefix (Vite default: VITE_)
  // Tapi kita pake VITE_ biar konsisten
  envPrefix: 'VITE_',

  // Dev server
  server: {
    port: 3000,
    open: true,
  },
});
