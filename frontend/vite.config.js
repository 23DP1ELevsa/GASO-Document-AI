import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    vue(),
    VitePWA({
      disable: mode === 'native',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: './',
        name: 'GASO Document AI',
        short_name: 'Document AI',
        description: 'Dokumentu digitalizācijas lietotnes pamats.',
        lang: 'lv',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f5f7fb',
        theme_color: '#f5f7fb',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Only the shipped interface is cached. No document or API runtime cache.
        globPatterns: ['index.html', 'assets/*.{js,css,woff2}', 'icons/*.png', 'icon.svg'],
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/$/, /\/index\.html$/],
        runtimeCaching: [],
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
}))
