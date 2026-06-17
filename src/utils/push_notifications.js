import api from './axios'

/**
 * Pide permiso de notificaciones al usuario y, si lo otorga, suscribe el
 * Service Worker actual a Web Push, guardando la suscripción en el backend.
 *
 * @returns {Promise<boolean>} true si quedó suscripto correctamente.
 */
export async function enable_push_notifications() {
  // Sin soporte de Service Worker o PushManager (navegador viejo / contexto inseguro) no se puede continuar.
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  // Solicita el permiso nativo de notificaciones; si el usuario no lo otorga, abortamos.
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return false
  }

  // Service Worker ya registrado y activo (lo registra vite-plugin-pwa).
  const registration = await navigator.serviceWorker.ready

  // Clave pública VAPID que el backend usa para firmar las notificaciones de este servidor.
  const { data } = await api.get('/push/vapid-public-key')

  // Suscribe el navegador al push service y obtiene el endpoint + claves del device.
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: url_base64_to_uint8array(data.public_key),
  })

  // Persiste la suscripción (endpoint + keys) asociada al admin autenticado.
  await api.post('/push/subscribe', subscription.toJSON())
  return true
}

/**
 * Revoca la suscripción push del device actual, tanto en el navegador como en el backend.
 *
 * @returns {Promise<void>}
 */
export async function disable_push_notifications() {
  if (!('serviceWorker' in navigator)) {
    return
  }
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    return
  }
  // Primero borra del backend (para no perder el endpoint) y luego desuscribe en el navegador.
  await api.post('/push/unsubscribe', { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}

/**
 * Indica el estado actual del permiso de notificaciones del navegador.
 *
 * @returns {'unsupported'|'granted'|'denied'|'default'} unsupported si el navegador no soporta Web Push.
 */
export function push_permission_status() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

/**
 * Convierte la public key VAPID (base64 URL-safe) al formato Uint8Array que pide pushManager.subscribe.
 *
 * @param {string} base64_string
 * @returns {Uint8Array}
 */
function url_base64_to_uint8array(base64_string) {
  const padding = '='.repeat((4 - (base64_string.length % 4)) % 4)
  const base64 = (base64_string + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw_data = window.atob(base64)
  const output_array = new Uint8Array(raw_data.length)
  for (let i = 0; i < raw_data.length; i++) {
    output_array[i] = raw_data.charCodeAt(i)
  }
  return output_array
}
