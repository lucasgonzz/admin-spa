/**
 * Service Worker propio de admin-spa (estrategia injectManifest de vite-plugin-pwa).
 *
 * Mantiene el precache de Workbox (autoUpdate sigue funcionando) y agrega el manejo
 * de Web Push: muestra la notificación nativa al recibir un evento `push` y abre la
 * URL de deep-link al hacer click en ella.
 */
import { precacheAndRoute } from 'workbox-precaching'

// Precachea los assets generados por el build (inyectados por vite-plugin-pwa en __WB_MANIFEST).
precacheAndRoute(self.__WB_MANIFEST)

/**
 * Recibe un push del backend (AdminPushNotificationService) y muestra la notificación nativa.
 * El payload es el JSON que arma el servicio: { title, body, url? }.
 */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'ComercioCity Admin'
  const options = {
    body: data.body || '',
    icon: '/icons/pwa-192.png',
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

/**
 * Al tocar la notificación: la cierra y abre la URL de deep-link asociada.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
  event.waitUntil(self.clients.openWindow(url))
})
