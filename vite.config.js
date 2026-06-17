import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // Estrategia injectManifest: usamos nuestro propio Service Worker (src/sw.js) para poder
      // manejar los eventos `push` y `notificationclick` de Web Push, manteniendo el precache
      // de Workbox y el comportamiento autoUpdate intactos.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Admin ComercioCity',
        short_name: 'Admin',
        theme_color: '#0d6efd',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      // Con injectManifest los patrones de precache se configuran bajo la clave injectManifest.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: 'localhost',
    port: 8002,
  },
})
