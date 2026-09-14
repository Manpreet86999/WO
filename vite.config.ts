import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
  ],

  root: path.resolve(__dirname, 'src/client'),

  publicDir: path.resolve(__dirname, 'src/client/public'),

  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:10000',
        changeOrigin: true,
      },
    },
  },
});