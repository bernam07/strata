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
      '/api/brickset': {
        target: 'https://brickset.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/brickset/, ''),
      },
      '/api/thewatchapi': {
        target: 'https://api.thewatchapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/thewatchapi/, ''),
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
