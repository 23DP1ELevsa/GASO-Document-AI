import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Vite also serves LAN UI previews; never forward their AI requests to loopback.
const apiProxy = () => ({
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    bypass(req, res) {
      const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
      const host = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host || '')
      if (!local || !host) {
        res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify({ error: { code: 'access_denied' } }))
        return false
      }
    },
  },
})

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
        background_color: '#f6fafc',
        theme_color: '#f6fafc',
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
        // Interface precache; public OCR assets are cached only on demand.
        globPatterns: ['index.html', 'assets/*.{js,css,woff2,ttf}', 'icons/*.png', 'icon.svg'],
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/$/, /\/index\.html$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.includes('/ocr/v7-fast-4-1-0/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'gaso-ocr-v7-fast-4-1-0',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 16 },
            },
          },
        ],
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173, strictPort: true, proxy: apiProxy() },
  preview: { port: 4173, strictPort: true, proxy: apiProxy() },
}))
