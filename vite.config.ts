import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // Listen on all local IPs so phones can test
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        hangmu: resolve(__dirname, 'hang-mu/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        gummy3d: resolve(__dirname, 'experiments/gummy-3d/index.html'),
      },
    },
  },
});
