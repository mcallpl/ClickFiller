import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ClickFiller/',
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
