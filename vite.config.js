import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  define: {
    'process.env.DEBUG': JSON.stringify(process.env.DEBUG || false),
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
