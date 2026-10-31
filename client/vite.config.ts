import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Textes du manifeste par langue : le français est le manifeste par défaut (`manifest.webmanifest`). */
const MANIFEST_TEXTS = {
  fr: { lang: 'fr', description: 'Collection de BD, DVD et Blu-ray : prêts, ventes, état' },
  en: { lang: 'en', description: 'Comics, DVD and Blu-ray collection: loans, sales, condition' },
};

/**
 * Manifeste anglais (`manifest.en.webmanifest`) : copie du manifeste généré par vite-plugin-pwa,
 * textes remplacés. Le client pointe `<link rel="manifest">` dessus quand l'interface est en anglais.
 */
function englishManifest(): Plugin {
  return {
    name: 'english-manifest',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const french = bundle['manifest.webmanifest'];
      if (french?.type !== 'asset') {
        this.error('manifest.webmanifest absent du build');
      }
      const generated = JSON.parse(String(french.source)) as Record<string, unknown>;
      const manifest = { ...generated, ...MANIFEST_TEXTS.en };
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.en.webmanifest',
        source: JSON.stringify(manifest),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/covers/, /^\/photos/],
      },
      manifest: {
        name: 'ShelfCtrl',
        short_name: 'ShelfCtrl',
        ...MANIFEST_TEXTS.fr,
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        // Tirées de favicon.svg ; la variante maskable a un fond plein bord et un dessin réduit à
        // 80 % pour rester dans la zone visible quelle que soit la forme découpée par Android.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
    englishManifest(),
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
