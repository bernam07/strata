import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api/bricklink': {
        target: 'https://api.bricklink.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bricklink/, ''),
      },
      '/api/brickeconomy': {
        target: 'https://www.brickeconomy.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/brickeconomy/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router') ||
            id.includes('\\react\\') ||
            id.includes('\\react-dom\\') ||
            id.includes('\\react-router')
          ) {
            return 'vendor-react';
          }
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }
          if (
            id.includes('@tanstack') ||
            id.includes('decimal.js') ||
            id.includes('@capacitor')
          ) {
            return 'vendor-query';
          }
          return undefined;
        },
      },
    },
  },
});
