import api from './axios'

/**
 * Pasos del registro push, en orden. El error lleva el paso adentro para que la UI
 * pueda decir DÓNDE falló: un "probá de nuevo" genérico fue lo que hizo que el bug
 * del endpoint truncado viviera semanas sin que nadie supiera qué estaba roto.
 */
export const PUSH_STEPS = {
  UNSUPPORTED: 'unsupported',
  VAPID: 'vapid',
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
    /*
      El detalle técnico viaja con el error, no solo a la consola.

      POR QUÉ: este bug se reporta desde un iPhone, donde no hay forma de abrir la consola. Sin el
      nombre y el mensaje del error del navegador acá adentro, la interfaz solo puede mostrar una
      frase escrita de antemano -- que es exactamente lo que hizo que durante semanas el cartel
      dijera "instalá la PWA" a alguien que ya la tenía instalada.
    */
    this.detail = describir_error(cause)
  }
}

/**
 * Arma una descripción corta y legible de un error del navegador.
 *
 * @param {*} error
 * @returns {string} vacío si no hay nada que describir.
 */
function describir_error(error) {
  if (!error) {
    return ''
  }
  const nombre = error.name || ''
  const mensaje = error.message || String(error)
  if (nombre && mensaje && nombre !== mensaje) {
    return nombre + ': ' + mensaje
  }
  return mensaje || nombre || String(error)
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
 * ¿La app está corriendo instalada (PWA en la pantalla de inicio / ventana propia)?
 *
 * En iOS lo dice `navigator.standalone`; el resto de los navegadores, el media query
 * `display-mode: standalone`. Se consultan los dos porque ninguno cubre a todos.
 *
 * Existe para que la interfaz DEJE de afirmar que hay que instalar la app sin haberlo comprobado:
 * ese cartel se le mostró a Lucas teniéndola instalada, y lo mandó a resolver algo que ya estaba
 * hecho mientras el problema real quedaba tapado.
 *
 * @returns {boolean}
 */
export function running_as_installed_app() {
  if (window.navigator && window.navigator.standalone === true) {
    return true
  }
  if (typeof window.matchMedia === 'function') {
    /* minimal-ui y fullscreen también son modos instalados, no solo standalone. */
    const modos = ['standalone', 'minimal-ui', 'fullscreen']
    for (let i = 0; i < modos.length; i++) {
      if (window.matchMedia('(display-mode: ' + modos[i] + ')').matches) {
        return true
      }
    }
  }
  return false
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

  /*
    🔴 El pedido de la clave VAPID se DISPARA acá pero NO se espera todavía. No lo conviertas en
    un `await`: rompe la activación del gesto.

    En iOS, Notification.requestPermission() solo se concede si se llama adentro del gesto del
    usuario. Cualquier `await` que se complete antes -- y un pedido de red es el peor caso --
    consume la activación transitoria, y el diálogo de permiso deja de aparecer. Eso rompería
    justamente el camino que hoy funciona: la primera activación, cuando el permiso todavía es
    'default'.

    Disparándolo sin esperar, el pedido viaja mientras el usuario decide el permiso, y para cuando
    hace falta la clave ya llegó. Se paga un precio chico y consciente: si el servidor no tiene la
    clave configurada, el permiso se pide igual antes de darse cuenta. Preferible a no poder
    activar nunca las notificaciones en un iPhone.
  */
  const promesa_clave = traer_clave_vapid()
  /* Sin esto, si el permiso falla primero, la promesa queda como rechazo sin manejar. */
  promesa_clave.catch(function () {})

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

  // Recién ahora se espera la clave: ya viajó en paralelo con el diálogo del permiso.
  const clave_vapid = await promesa_clave

  // Suscribe el navegador al push service y obtiene el endpoint + claves del device.
  let subscription
  try {
    subscription = await subscribe_in_browser(null, clave_vapid)
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
  const clave_vapid = await traer_clave_vapid()

  /*
    Pasa siempre por subscribe_in_browser(), incluso si getSubscription() devuelve algo.

    Antes esta función solo suscribía cuando NO había suscripción, así que una suscripción vieja
    creada con otra clave VAPID sobrevivía para siempre: el arranque la daba por buena, el backend
    nunca la reconocía, y el usuario se quedaba sin notificaciones sin que nada lo denunciara.
    subscribe_in_browser() ahora compara la clave y la reemplaza si hace falta.
  */
  const subscription = await subscribe_in_browser(registration, clave_vapid)

  // POST idempotente por endpoint_hash: crea la fila si no está y refresca last_used_at si está.
  await api.post('/push/subscribe', subscription.toJSON())
  return true
}

/**
 * Trae la clave pública VAPID del backend, ya validada.
 *
 * Va en su propio paso (PUSH_STEPS.VAPID) y no adentro del try de la suscripción: que se caiga la
 * red, que la sesión esté vencida o que el servidor no tenga la clave cargada son problemas del
 * servidor, y reportarlos como "el navegador no pudo crear la suscripción" manda a buscar el
 * problema al lado equivocado.
 *
 * @returns {Promise<string>}
 */
async function traer_clave_vapid() {
  let data
  try {
    const respuesta = await api.get('/push/vapid-public-key')
    data = respuesta.data
  } catch (e) {
    const error = new PushRegistrationError(
      PUSH_STEPS.VAPID,
      'No se pudo pedirle al servidor la clave de notificaciones.',
      e
    )
    /* El servidor no contestó: puede ser el servidor, pero también el teléfono sin red o en un
       WiFi cautivo. No se puede afirmar de quién es la culpa, así que no se afirma. */
    error.vapid_reason = 'sin_respuesta'
    throw error
  }

  const clave = data && data.public_key ? String(data.public_key).trim() : ''
  if (!clave) {
    /*
      El servidor contestó bien pero sin clave: VAPID_PUBLIC_KEY vacía en el .env. Sin este guard,
      url_base64_to_uint8array() revienta con un TypeError adentro del try de la suscripción y el
      usuario termina leyendo que su navegador no puede suscribirse -- cuando el navegador nunca
      llegó a intentarlo.
    */
    const error = new PushRegistrationError(
      PUSH_STEPS.VAPID,
      'El servidor no tiene configurada la clave de notificaciones push (VAPID).'
    )
    /* Acá sí se sabe: el servidor contestó 200 y vino sin clave. No es el teléfono. */
    error.vapid_reason = 'clave_vacia'
    throw error
  }
  return clave
}

/**
 * Crea la suscripción del navegador contra el push service, con la clave VAPID del backend.
 *
 * Regla de oro: **nunca se destruye una suscripción existente por las dudas.** Solo se da de baja
 * cuando se sabe que la clave es otra, o cuando el propio navegador dice que estorba.
 *
 * POR QUÉ (no lo simplifiques a un subscribe() a secas ni a un unsubscribe() preventivo):
 *
 * - pushManager.subscribe() tira InvalidStateError si el device ya tiene una suscripción con otra
 *   applicationServerKey, y lo tira SIEMPRE. Ese es el pozo del que "Reintentar registro" no salía
 *   nunca en el iPhone de Lucas: cada intento repetía el mismo error.
 * - Pero dar de baja la vieja ANTES de saber si hace falta es peor. Si después subscribe() falla
 *   (el push service caído, sin red), el device queda sin ninguna suscripción: se rompió algo que
 *   funcionaba. Y como esto también corre solo en cada arranque, un navegador que no exponga
 *   `options` haría que se destruya y recree la suscripción en cada boot, dejando una fila muerta
 *   por vez en el backend y una ventana sin notificaciones cada vez.
 *
 * @param {ServiceWorkerRegistration} [registration] Registro ya resuelto, para no volver a esperarlo.
 * @param {string} clave_vapid Clave pública VAPID ya validada.
 * @returns {Promise<PushSubscription>}
 */
async function subscribe_in_browser(registration, clave_vapid) {
  // Service Worker ya registrado y activo (lo registra vite-plugin-pwa).
  const sw_registration = registration || (await navigator.serviceWorker.ready)
  const clave = url_base64_to_uint8array(clave_vapid)
  const pedido = { userVisibleOnly: true, applicationServerKey: clave }

  const existente = await sw_registration.pushManager.getSubscription()
  if (existente) {
    const veredicto = misma_clave(existente, clave)

    if (veredicto === true) {
      /* Sirve tal cual: no se molesta al push service al pedo. */
      return existente
    }

    if (veredicto === null) {
      /*
        El navegador no expone con qué clave se creó, así que NO se sabe si sirve. Se intenta
        suscribir sin tocar nada: por especificación, si la clave coincide subscribe() devuelve la
        misma suscripción sin tirar. Solo si el navegador se queja por conflicto de clave se pasa a
        reemplazarla -- que es cuando ya está confirmado que estorba.
      */
      try {
        return await sw_registration.pushManager.subscribe(pedido)
      } catch (e) {
        if (!es_conflicto_de_clave(e)) {
          throw e
        }
      }
    }

    await dar_de_baja(existente)
  }

  return sw_registration.pushManager.subscribe(pedido)
}

/**
 * ¿Este error del navegador dice que ya hay una suscripción con otra clave?
 *
 * Se mira el nombre y, además, el texto: el nombre está en la especificación, pero cada navegador
 * redacta el mensaje a su manera y no todos usan el mismo `name`.
 *
 * @param {*} error
 * @returns {boolean}
 */
function es_conflicto_de_clave(error) {
  if (!error) {
    return false
  }
  /*
    Deliberadamente estricto: solo el nombre que fija la especificación, o un mensaje que nombre
    la propia applicationServerKey.

    La tentación es aflojarlo con textos como "already exists" o "different key" por si algún
    navegador redacta distinto. No se hace: dar un falso positivo acá significa dar de baja una
    suscripción que funcionaba, que es exactamente lo que esta función existe para evitar. Un falso
    negativo, en cambio, solo deja el error a la vista del usuario -- molesto, pero no destruye
    nada. Ante la duda, el error se muestra; no se rompe.
  */
  if (error.name === 'InvalidStateError') {
    return true
  }
  return /applicationServerKey/i.test(String(error.message || ''))
}

/**
 * Da de baja una suscripción que ya no sirve, avisándole primero al backend.
 *
 * El orden importa y es el mismo que usa disable_push_notifications(): se borra la fila del
 * servidor ANTES de desuscribir en el navegador, porque después de desuscribir el endpoint se
 * pierde y la fila queda huérfana apuntando a un destino muerto para siempre.
 *
 * Ninguno de los dos pasos frena el registro si falla: son limpieza, no el objetivo.
 *
 * @param {PushSubscription} subscription
 * @returns {Promise<void>}
 */
async function dar_de_baja(subscription) {
  try {
    await api.post('/push/unsubscribe', { endpoint: subscription.endpoint })
  } catch (e) {
    console.warn('[push] no se pudo borrar del servidor la suscripción vieja', e)
  }
  try {
    await subscription.unsubscribe()
  } catch (e) {
    /* Se registra el motivo: si después subscribe() entra en el bucle de InvalidStateError,
       este es justo el dato que explica por qué. */
    console.warn('[push] no se pudo dar de baja la suscripción vieja en el navegador', e)
  }
}

/**
 * ¿La suscripción existente fue creada con esta misma clave VAPID?
 *
 * Devuelve **tres** valores a propósito, no dos:
 *   true  -> es la misma clave
 *   false -> es otra clave
 *   null  -> el navegador no lo dice, no se puede saber
 *
 * El `null` no es un detalle: juntarlo con `false` fue el bug que encontró la verificación. Un
 * navegador que no exponga `options.applicationServerKey` haría que el mantenimiento del arranque
 * diera "clave distinta" en cada boot y destruyera la suscripción una y otra vez.
 *
 * @param {PushSubscription} subscription
 * @param {Uint8Array} clave
 * @returns {boolean|null}
 */
function misma_clave(subscription, clave) {
  const opciones = subscription.options
  if (!opciones || !opciones.applicationServerKey) {
    return null
  }
  const cruda = opciones.applicationServerKey
  /*
    Por especificación es un ArrayBuffer, pero si algún navegador devolviera otra cosa --un string
    base64, por ejemplo-- `new Uint8Array(string)` da longitud 0, la comparación diría "otra clave"
    y se destruiría una suscripción que servía. Ante un tipo que no se entiende, el valor honesto
    es "no se puede saber", igual que cuando no viene nada.
  */
  const es_buffer =
    (typeof ArrayBuffer !== 'undefined' && cruda instanceof ArrayBuffer) ||
    ArrayBuffer.isView(cruda)
  if (!es_buffer) {
    return null
  }
  const actual = new Uint8Array(ArrayBuffer.isView(cruda) ? cruda.buffer : cruda)
  if (actual.length !== clave.length) {
    return false
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== clave[i]) {
      return false
    }
  }
  return true
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
