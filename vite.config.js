import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Saca del `recursos.html` compilado lo que VitePWA le inyecta a TODAS las entradas HTML: el
 * `<link rel="manifest">` del admin y, si algún día se prende `injectRegister`, el script que
 * registra el service worker.
 *
 * El centro de recursos (misión centro-de-recursos-clientes, 13/10/2026) vive en otro dominio
 * (`recursos.comerciocity.com`) y lo abren clientes, no el equipo: no se tiene que poder
 * "instalar" como la app del admin ni quedar controlado por su service worker. VitePWA no deja
 * apagarse por entrada, así que se limpia después de que inyecta: este plugin va DESPUÉS de
 * VitePWA en la lista y los dos tienen `enforce: 'post'` + `order: 'post'`, y entre plugins del
 * mismo grupo Vite respeta el orden de la lista.
 *
 * @returns {import('vite').Plugin}
 */
function sin_pwa_en_recursos() {
  return {
    name: 'centro-recursos:sin-pwa',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      /**
       * @param {string} html HTML ya transformado por los demás plugins.
       * @param {{ filename: string }} ctx Contexto de Vite; `filename` es la ruta del HTML de entrada.
       * @returns {string}
       */
      handler(html, ctx) {
        /** Ruta del HTML que se está transformando, con barras normales para comparar en Windows. */
        const archivo = String((ctx && ctx.filename) || '').replace(/\\/g, '/')
        if (!archivo.endsWith('/recursos.html')) {
          return html
        }
        return html
          .replace(/<link[^>]*rel="manifest"[^>]*>/g, '')
          .replace(/<script[^>]*id="vite-plugin-pwa:[^"]*"[^>]*>[\s\S]*?<\/script>/g, '')
      },
    },
  }
}

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
    sin_pwa_en_recursos(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      /**
       * Dos entradas: el admin (`index.html`) y la página pública del centro de recursos
       * (`recursos.html`, misión centro-de-recursos-clientes). La segunda NO importa el router,
       * el store, Bootstrap ni el login del admin: comparte con él solo el runtime de Vue.
       */
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        recursos: fileURLToPath(new URL('./recursos.html', import.meta.url)),
      },
    },
  },
  server: {
    host: 'localhost',
    port: 8002,
  },
})
