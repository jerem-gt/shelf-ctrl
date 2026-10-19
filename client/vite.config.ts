import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/covers/, /^\/photos/],
      },
      manifest: {
        name: 'ShelfCtrl',
        short_name: 'ShelfCtrl',
        description: 'Collection de BD, DVD et Blu-ray : prêts, ventes, état',
        lang: 'fr',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        // À faire : ajouter les icônes PNG 192x192 et 512x512 (requises pour l'installation sur Android)
        icons: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': import.meta.dirname + '/src',
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/covers': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/photos': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Dépendances stables isolées : le navigateur les garde en cache entre deux déploiements.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/react-router/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('/@tanstack/')) return 'query-vendor';
          if (id.includes('/i18next') || id.includes('/react-i18next/')) return 'i18n-vendor';
        },
      },
    },
  },
});
