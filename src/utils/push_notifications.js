import api from './axios'

/**
 * Pasos del registro push, en orden. El error lleva el paso adentro para que la UI
 * pueda decir DÓNDE falló: un "probá de nuevo" genérico fue lo que hizo que el bug
 * del endpoint truncado viviera semanas sin que nadie supiera qué estaba roto.
 */
export const PUSH_STEPS = {
  UNSUPPORTED: 'unsupported',
  PERMISSION: 'permission',
  SUBSCRIPTION: 'subscription',
  BACKEND: 'backend',
}

/**
 * Error de registro push con el paso en el que se cortó.
 */
export class PushRegistrationError extends Error {
  /**
   * @param {string} step  Uno de PUSH_STEPS.
   * @param {string} message  Mensaje legible para el usuario.
   * @param {Error} [cause]  Error original, para el log de consola.
   */
  constructor(step, message, cause) {
    super(message)
    this.name = 'PushRegistrationError'
    this.step = step
    this.cause = cause
  }
}

/**
 * true si el navegador soporta Web Push (Service Worker + PushManager + Notification).
 *
 * @returns {boolean}
 */
export function push_is_supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Pide permiso de notificaciones al usuario y, si lo otorga, suscribe el
 * Service Worker actual a Web Push, guardando la suscripción en el backend.
 *
 * Lanza PushRegistrationError con el paso que falló en vez de devolver false a secas:
 * quien llama necesita distinguir "el usuario dijo que no" de "el servidor no lo guardó".
 *
 * @returns {Promise<boolean>} true si quedó suscripto correctamente.
 */
export async function enable_push_notifications() {
  // Sin soporte de Service Worker o PushManager (navegador viejo / contexto inseguro) no se puede continuar.
  if (!push_is_supported()) {
    throw new PushRegistrationError(
      PUSH_STEPS.UNSUPPORTED,
      'Este navegador no soporta notificaciones push.'
    )
  }

  // Solicita el permiso nativo de notificaciones; si el usuario no lo otorga, abortamos.
  let permission
  try {
    permission = await Notification.requestPermission()
  } catch (e) {
    throw new PushRegistrationError(
      PUSH_STEPS.PERMISSION,
      'No se pudo pedir el permiso de notificaciones al navegador.',
      e
    )
  }
  if (permission !== 'granted') {
    throw new PushRegistrationError(
      PUSH_STEPS.PERMISSION,
      'No diste el permiso de notificaciones en el navegador.'
    )
  }

  // Suscribe el navegador al push service y obtiene el endpoint + claves del device.
  let subscription
  try {
    subscription = await subscribe_in_browser()
  } catch (e) {
    throw new PushRegistrationError(
      PUSH_STEPS.SUBSCRIPTION,
      'El navegador no pudo crear la suscripción push para este dispositivo.',
      e
    )
  }

  // Persiste la suscripción (endpoint + keys) asociada al admin autenticado.
  try {
    await api.post('/push/subscribe', subscription.toJSON())
  } catch (e) {
    throw new PushRegistrationError(
      PUSH_STEPS.BACKEND,
      'El servidor no pudo guardar la suscripción de este dispositivo.',
      e
    )
  }

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
 * OJO: esto es el PERMISO, no el registro. Un permiso concedido no significa que el
 * device esté registrado en el backend — usar push_registration_status() para eso.
 *
 * @returns {'unsupported'|'granted'|'denied'|'default'} unsupported si el navegador no soporta Web Push.
 */
export function push_permission_status() {
  if (!push_is_supported()) {
    return 'unsupported'
  }
  return Notification.permission
}

/**
 * Estado REAL de las notificaciones en este device, combinando las tres cosas que
 * tienen que darse a la vez: permiso del navegador, suscripción viva en el navegador,
 * y fila correspondiente en el backend para el admin autenticado.
 *
 * Antes la UI mostraba "Activadas en este dispositivo" mirando solo el permiso. Cuando
 * el guardado en el backend fallaba, el permiso ya estaba concedido y la interfaz
 * afirmaba lo contrario de la realidad: el usuario veía el badge verde y no recibía nada.
 *
 * @returns {Promise<{permission: string, has_browser_subscription: boolean, registered: boolean, state: string}>}
 *   state: 'unsupported' | 'denied' | 'default' | 'registered' | 'not_registered'
 */
export async function push_registration_status() {
  const permission = push_permission_status()

  if (permission === 'unsupported') {
    return { permission, has_browser_subscription: false, registered: false, state: 'unsupported' }
  }
  if (permission !== 'granted') {
    // 'denied' o 'default': no hay nada que consultar, todavía no puede haber registro.
    return { permission, has_browser_subscription: false, registered: false, state: permission }
  }

  // Suscripción del navegador. iOS la invalida por su cuenta (reinstalación de la PWA,
  // limpieza del sitio), así que "permiso concedido" no implica que siga existiendo.
  let subscription = null
  try {
    const registration = await navigator.serviceWorker.ready
    subscription = await registration.pushManager.getSubscription()
  } catch (e) {
    subscription = null
  }

  if (!subscription) {
    return { permission, has_browser_subscription: false, registered: false, state: 'not_registered' }
  }

  // El hecho: ¿el backend tiene la fila de este endpoint para este admin?
  let registered = false
  try {
    const { data } = await api.post('/push/subscription-status', { endpoint: subscription.endpoint })
    registered = !!(data && data.registered)
  } catch (e) {
    // Sin respuesta del backend no se puede afirmar que esté registrado. Ante la duda,
    // mostrar el estado de atención: un falso "no registrado" hace que el usuario
    // reintente (inocuo, es idempotente); un falso "registrado" lo deja sin avisos.
    registered = false
  }

  return {
    permission,
    has_browser_subscription: true,
    registered,
    state: registered ? 'registered' : 'not_registered',
  }
}

/**
 * Mantenimiento silencioso del registro push, para correr una vez por arranque de la app.
 *
 * iOS invalida suscripciones por su cuenta y el usuario no tiene ningún motivo para volver
 * a la pantalla de Cuenta a rearmarlas: se quedaría sin notificaciones sin enterarse. Con
 * el permiso ya concedido, re-suscribir no le pide nada ni le muestra nada.
 *
 * No hace nada si no hay soporte o si el permiso no está concedido — nunca dispara el
 * diálogo de permiso, que es una acción del usuario y no del arranque.
 *
 * @returns {Promise<boolean>} true si el device quedó registrado en el backend.
 */
export async function ensure_push_registration() {
  if (!push_is_supported() || Notification.permission !== 'granted') {
    return false
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  // Sin suscripción en el navegador (caducó o se limpió el sitio): volver a crearla.
  // El permiso ya está concedido, así que subscribe() no abre ningún diálogo.
  if (!subscription) {
    subscription = await subscribe_in_browser(registration)
  }

  // POST idempotente por endpoint_hash: crea la fila si no está y refresca last_used_at si está.
  await api.post('/push/subscribe', subscription.toJSON())
  return true
}

/**
 * Crea la suscripción del navegador contra el push service, con la clave VAPID del backend.
 *
 * @param {ServiceWorkerRegistration} [registration] Registro ya resuelto, para no volver a esperarlo.
 * @returns {Promise<PushSubscription>}
 */
async function subscribe_in_browser(registration) {
  // Service Worker ya registrado y activo (lo registra vite-plugin-pwa).
  const sw_registration = registration || (await navigator.serviceWorker.ready)

  // Clave pública VAPID que el backend usa para firmar las notificaciones de este servidor.
  const { data } = await api.get('/push/vapid-public-key')

  return sw_registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: url_base64_to_uint8array(data.public_key),
  })
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
