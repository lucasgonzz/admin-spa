/*
  Prueba del registro de notificaciones push de src/utils/push_notifications.js.

  Se corre con `node pruebas/registro-push.cjs`. Sin dependencias: `admin-spa` no tiene corredor
  de tests y meter uno entero para esto era desproporcionado.

  Qué cubre y por qué: el bug que originó esto es que "Reintentar registro" fallaba SIEMPRE en el
  iPhone de Lucas, con un cartel que le decía que instalara la PWA cuando ya la tenía instalada.
  La causa es que pushManager.subscribe() tira InvalidStateError cuando el device ya tiene una
  suscripción creada con otra clave VAPID, y el código de antes nunca miraba si había una. Cada
  reintento repetía el mismo error. Eso no se ve leyendo el código: hay que ejercer el flujo.

  El módulo se carga del ARCHIVO REAL --se le sacan los `import`/`export` y se evalúa con las
  dependencias del navegador simuladas-- para que la prueba no sea una copia que se desincroniza.
*/
const fs = require('fs')
const path = require('path')

const FUENTE = path.join(__dirname, '..', 'src', 'utils', 'push_notifications.js')

/**
 * Carga el módulo real con `api`, `window`, `navigator` y `Notification` simulados.
 *
 * @param {object} entorno
 * @returns {object} las funciones del módulo
 */
function cargar_modulo(entorno) {
  let codigo = fs.readFileSync(FUENTE, 'utf8')
  codigo = codigo
    .split('\n')
    .filter(function (linea) {
      return !linea.startsWith('import ')
    })
    .join('\n')
    .replace(/^export /gm, '')

  const devolver =
    '\nreturn { PUSH_STEPS, PushRegistrationError, push_is_supported, running_as_installed_app,' +
    ' enable_push_notifications, disable_push_notifications, push_permission_status,' +
    ' push_registration_status, ensure_push_registration, misma_clave, url_base64_to_uint8array };'

  const fabrica = new Function('api', 'window', 'navigator', 'Notification', codigo + devolver)
  return fabrica(entorno.api, entorno.window, entorno.navigator, entorno.Notification)
}

/* ------------------------------------------------------------------ */
/* Simulaciones                                                        */
/* ------------------------------------------------------------------ */

const CLAVE_A = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
const CLAVE_B = 'BAyxvQK2eTgWfCa1i1PxdQZFsAeIWm3xCLxlJoJ8x9GmS4YgOe0AGVvOOtjqCBGa9lOF9zBk5XhkuJ0Fd1KfE7w'

function base64_a_bytes(texto) {
  const relleno = '='.repeat((4 - (texto.length % 4)) % 4)
  const base64 = (texto + relleno).replace(/-/g, '+').replace(/_/g, '/')
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

/** PushSubscription simulada. */
function suscripcion_falsa(endpoint, clave_texto, registro) {
  return {
    endpoint: endpoint,
    options: clave_texto === null ? {} : { applicationServerKey: base64_a_bytes(clave_texto).buffer },
    toJSON: function () {
      return { endpoint: endpoint, keys: { p256dh: 'p256dh-' + endpoint, auth: 'auth-' + endpoint } }
    },
    unsubscribe: function () {
      registro.bajas.push(endpoint)
      return Promise.resolve(true)
    },
  }
}

/**
 * Arma un entorno completo de navegador simulado.
 *
 * @param {object} opciones
 *   clave_del_servidor  qué devuelve GET /push/vapid-public-key (null = campo vacío)
 *   vapid_falla         true para que ese GET rechace
 *   permiso             'granted' | 'denied' | 'default'
 *   suscripcion_previa  null, o { endpoint, clave } ya existente en el device
 *   subscribe_tira      Error a tirar desde subscribe()
 *   backend_falla       true para que POST /push/subscribe rechace
 *   instalada           'ios' | 'display-mode' | false
 */
function armar_entorno(opciones) {
  const registro = {
    subscribe_llamadas: [],
    bajas: [],
    posts: [],
    gets: [],
    permiso_pedido: 0,
  }

  let actual = opciones.suscripcion_previa
    ? suscripcion_falsa(opciones.suscripcion_previa.endpoint, opciones.suscripcion_previa.clave, registro)
    : null
  if (actual && opciones.sin_options) {
    actual.options = undefined
  }

  const push_manager = {
    getSubscription: function () {
      return Promise.resolve(actual)
    },
    subscribe: function (config) {
      registro.subscribe_llamadas.push(config)
      if (opciones.subscribe_tira) {
        const solo_la_primera = opciones.subscribe_tira_solo_la_primera
        if (!solo_la_primera || registro.subscribe_llamadas.length === 1) {
          return Promise.reject(opciones.subscribe_tira)
        }
      }
      const nueva = suscripcion_falsa('https://push.apple.com/nuevo-' + registro.subscribe_llamadas.length, null, registro)
      /* Un navegador que no expone `options` es el caso peligroso: la suscripción nueva tampoco
         lo expone, así que el arranque siguiente vuelve a no poder saber con qué clave se creó. */
      nueva.options = opciones.sin_options
        ? undefined
        : { applicationServerKey: config.applicationServerKey.buffer }
      actual = nueva
      return Promise.resolve(nueva)
    },
  }

  const api = {
    get: function (ruta) {
      registro.gets.push(ruta)
      if (opciones.vapid_falla) {
        return Promise.reject(new Error('Network Error'))
      }
      const clave = Object.prototype.hasOwnProperty.call(opciones, 'clave_del_servidor')
        ? opciones.clave_del_servidor
        : CLAVE_A
      if (opciones.clave_lenta) {
        /* Queda pendiente hasta que la prueba la suelte a mano. */
        return new Promise(function (resolver) {
          registro.soltar_clave = function () { resolver({ data: { public_key: clave } }) }
        })
      }
      return Promise.resolve({ data: { public_key: clave } })
    },
    post: function (ruta, cuerpo) {
      registro.posts.push({ ruta: ruta, cuerpo: cuerpo })
      if (opciones.backend_falla && ruta === '/push/subscribe') {
        return Promise.reject(new Error('500'))
      }
      if (ruta === '/push/subscription-status') {
        return Promise.resolve({ data: { registered: !!opciones.registrado_en_backend } })
      }
      return Promise.resolve({ data: { ok: true } })
    },
  }

  const navegador = {
    serviceWorker: { ready: Promise.resolve({ pushManager: push_manager }) },
    standalone: opciones.instalada === 'ios' ? true : undefined,
  }

  const ventana = {
    PushManager: function () {},
    Notification: function () {},
    atob: function (texto) {
      return Buffer.from(texto, 'base64').toString('binary')
    },
    navigator: navegador,
    matchMedia: function (consulta) {
      /* `instalada` puede pedir un modo puntual: 'display-mode' (standalone), 'minimal-ui' o
         'fullscreen'. Así se ejercen los tres del loop, no solo el primero. */
      const modo = opciones.instalada === 'display-mode' ? 'standalone' : opciones.instalada
      const coincide = !!modo && consulta.indexOf('(display-mode: ' + modo + ')') !== -1
      return { matches: coincide }
    },
  }

  const notificacion = {
    permission: opciones.permiso || 'granted',
    requestPermission: function () {
      registro.permiso_pedido += 1
      return Promise.resolve(opciones.permiso || 'granted')
    },
  }

  return {
    registro: registro,
    push_manager: push_manager,
    soltar_clave: function () {
      if (registro.soltar_clave) { registro.soltar_clave() }
    },
    modulo: cargar_modulo({ api: api, window: ventana, navigator: navegador, Notification: notificacion }),
  }
}

/* ------------------------------------------------------------------ */
/* Corredor                                                            */
/* ------------------------------------------------------------------ */

let ok = 0
let mal = 0

function comprobar(nombre, condicion, detalle) {
  if (condicion) {
    ok++
    console.log('  ok   ' + nombre)
  } else {
    mal++
    console.log('  MAL  ' + nombre + (detalle ? ' -- ' + detalle : ''))
  }
}

async function atrapar(promesa) {
  try {
    const valor = await promesa
    return { ok: true, valor: valor }
  } catch (e) {
    return { ok: false, error: e }
  }
}

async function correr() {
  console.log('\n1. el caso de Lucas: ya hay una suscripción con OTRA clave VAPID')
  {
    /*
      Es el pozo del que "Reintentar registro" no salía nunca: subscribe() con una clave distinta
      de la de la suscripción viva tira InvalidStateError, y lo tira todas las veces.
    */
    const e = armar_entorno({ suscripcion_previa: { endpoint: 'https://push.apple.com/viejo', clave: CLAVE_B } })
    const r = await atrapar(e.modulo.enable_push_notifications())

    comprobar('el registro sale bien', r.ok === true, r.ok ? '' : String(r.error && r.error.message))
    comprobar('se dio de baja la suscripción vieja', e.registro.bajas.length === 1,
      JSON.stringify(e.registro.bajas))
    comprobar('se pidió una suscripción nueva', e.registro.subscribe_llamadas.length === 1)
    comprobar('se guardó en el backend',
      e.registro.posts.filter(function (p) { return p.ruta === '/push/subscribe' }).length === 1)
  }

  console.log('\n2. ya hay una suscripción con la MISMA clave: se reusa, no se molesta al push service')
  {
    const e = armar_entorno({ suscripcion_previa: { endpoint: 'https://push.apple.com/vive', clave: CLAVE_A } })
    const r = await atrapar(e.modulo.enable_push_notifications())

    comprobar('el registro sale bien', r.ok === true)
    comprobar('NO se dio de baja nada', e.registro.bajas.length === 0)
    comprobar('NO se pidió una suscripción nueva', e.registro.subscribe_llamadas.length === 0)
    const post = e.registro.posts.filter(function (p) { return p.ruta === '/push/subscribe' })[0]
    comprobar('se guardó la suscripción que ya existía',
      !!post && post.cuerpo.endpoint === 'https://push.apple.com/vive',
      post ? post.cuerpo.endpoint : 'no hubo post')
  }

  console.log('\n3. device sin suscripción previa: camino normal')
  {
    const e = armar_entorno({ suscripcion_previa: null })
    const r = await atrapar(e.modulo.enable_push_notifications())
    comprobar('el registro sale bien', r.ok === true)
    comprobar('se pidió una suscripción', e.registro.subscribe_llamadas.length === 1)
    comprobar('con userVisibleOnly', e.registro.subscribe_llamadas[0].userVisibleOnly === true)
  }

  console.log('\n4. el servidor no tiene la clave VAPID cargada')
  {
    const e = armar_entorno({ clave_del_servidor: null })
    const r = await atrapar(e.modulo.enable_push_notifications())

    comprobar('falla', r.ok === false)
    comprobar('el paso es VAPID, no SUBSCRIPTION', r.error && r.error.step === 'vapid',
      r.error ? r.error.step : 'sin error')
    comprobar('el mensaje nombra la clave del servidor',
      !!r.error && r.error.message.toLowerCase().indexOf('vapid') !== -1, r.error && r.error.message)
    comprobar('NUNCA se le pidió nada al push service', e.registro.subscribe_llamadas.length === 0)
  }

  console.log('\n5. se cae el pedido de la clave VAPID')
  {
    const e = armar_entorno({ vapid_falla: true })
    const r = await atrapar(e.modulo.enable_push_notifications())
    comprobar('falla con paso VAPID', r.ok === false && r.error.step === 'vapid',
      r.error ? r.error.step : '')
    comprobar('el detalle técnico llega cargado', !!r.error && !!r.error.detail, r.error && r.error.detail)
  }

  console.log('\n6. el usuario no da el permiso')
  {
    const e = armar_entorno({ permiso: 'denied' })
    const r = await atrapar(e.modulo.enable_push_notifications())
    comprobar('falla con paso PERMISSION', r.ok === false && r.error.step === 'permission',
      r.error ? r.error.step : '')
    comprobar('no se le pidió nada al push service', e.registro.subscribe_llamadas.length === 0)
  }

  console.log('\n7. el navegador rechaza la suscripción')
  {
    const tirado = new Error('A subscription with a different applicationServerKey already exists')
    tirado.name = 'InvalidStateError'
    const e = armar_entorno({ subscribe_tira: tirado })
    const r = await atrapar(e.modulo.enable_push_notifications())

    comprobar('falla con paso SUBSCRIPTION', r.ok === false && r.error.step === 'subscription',
      r.error ? r.error.step : '')
    comprobar('el detalle lleva el nombre del error del navegador',
      !!r.error && r.error.detail.indexOf('InvalidStateError') === 0, r.error && r.error.detail)
  }

  console.log('\n8. el backend no guarda la suscripción')
  {
    const e = armar_entorno({ backend_falla: true })
    const r = await atrapar(e.modulo.enable_push_notifications())
    comprobar('falla con paso BACKEND', r.ok === false && r.error.step === 'backend',
      r.error ? r.error.step : '')
  }

  console.log('\n9. running_as_installed_app: la comprobación que antes no existía')
  {
    comprobar('iOS con navigator.standalone: true',
      armar_entorno({ instalada: 'ios' }).modulo.running_as_installed_app() === true)
    comprobar('display-mode standalone: true',
      armar_entorno({ instalada: 'display-mode' }).modulo.running_as_installed_app() === true)
    comprobar('display-mode minimal-ui: true',
      armar_entorno({ instalada: 'minimal-ui' }).modulo.running_as_installed_app() === true)
    comprobar('display-mode fullscreen: true',
      armar_entorno({ instalada: 'fullscreen' }).modulo.running_as_installed_app() === true)
    comprobar('en el navegador comun: false',
      armar_entorno({ instalada: false }).modulo.running_as_installed_app() === false)
  }

  console.log('\n10. el mantenimiento del arranque tambien reemplaza la suscripción vieja')
  {
    /*
      Antes ensure_push_registration() solo suscribía si NO había suscripción, así que una vieja
      con otra clave sobrevivía para siempre y el usuario se quedaba sin notificaciones sin aviso.
    */
    const e = armar_entorno({ suscripcion_previa: { endpoint: 'https://push.apple.com/viejo', clave: CLAVE_B } })
    const r = await atrapar(e.modulo.ensure_push_registration())
    comprobar('devuelve true', r.ok === true && r.valor === true)
    comprobar('dio de baja la vieja', e.registro.bajas.length === 1)
    comprobar('creó una nueva', e.registro.subscribe_llamadas.length === 1)
    comprobar('NO le pidió el permiso al usuario', e.registro.permiso_pedido === 0)
  }

  console.log('\n11. el permiso se pide SIN esperar la red (activación del gesto en iOS)')
  {
    /*
      Candado de regresión del ORDEN de las llamadas, no de la activación transitoria.

      Esta prueba comprueba que requestPermission() se llame antes de que la clave VAPID llegue: si
      alguien vuelve a poner un `await` delante, se pone en rojo. Lo que NO puede comprobar es la
      activación del gesto en sí -- eso lo decide WebKit en el aparato y no hay forma de simularlo.
      El riesgo real solo lo cierra una prueba en el iPhone.
    */
    const e = armar_entorno({ clave_lenta: true })
    const promesa = e.modulo.enable_push_notifications()

    /* Un tick de microtareas: alcanza para que corra todo lo que NO espera la red. */
    await Promise.resolve()
    await Promise.resolve()
    comprobar('se pidió el permiso antes de que llegara la clave', e.registro.permiso_pedido === 1,
      'permiso_pedido=' + e.registro.permiso_pedido)

    e.soltar_clave()
    const r = await atrapar(promesa)
    comprobar('y después el registro termina bien', r.ok === true,
      r.ok ? '' : String(r.error && r.error.message))
  }

  console.log('\n12. navegador que NO expone options: no se destruye nada por las dudas')
  {
    /*
      El bloqueante que encontró la verificación. Si "no se puede saber con qué clave se creó" se
      trata igual que "es otra clave", el mantenimiento del arranque destruye y recrea la
      suscripción en CADA boot: filas muertas acumulándose en el backend y una ventana sin
      notificaciones cada vez.
    */
    const e = armar_entorno({
      sin_options: true,
      suscripcion_previa: { endpoint: 'https://push.apple.com/viejo', clave: CLAVE_A },
    })
    const r = await atrapar(e.modulo.enable_push_notifications())

    comprobar('el registro sale bien', r.ok === true, r.ok ? '' : String(r.error && r.error.message))
    comprobar('NO se dio de baja la suscripción existente', e.registro.bajas.length === 0,
      JSON.stringify(e.registro.bajas))
    comprobar('se intentó suscribir directamente', e.registro.subscribe_llamadas.length === 1)
  }

  console.log('\n13. cinco arranques seguidos con ese mismo navegador: sin churn')
  {
    const e = armar_entorno({
      sin_options: true,
      suscripcion_previa: { endpoint: 'https://push.apple.com/viejo', clave: CLAVE_A },
    })
    for (let i = 0; i < 5; i++) {
      await atrapar(e.modulo.ensure_push_registration())
    }
    comprobar('cero suscripciones destruidas en cinco arranques', e.registro.bajas.length === 0,
      e.registro.bajas.length + ' bajas')
    comprobar('cinco subscribe (uno por arranque), no diez',
      e.registro.subscribe_llamadas.length === 5, e.registro.subscribe_llamadas.length + ' llamadas')
  }

  console.log('\n14. si el navegador confirma el conflicto de clave, RECIÉN ahí se reemplaza')
  {
    const conflicto = new Error('A subscription with a different applicationServerKey already exists')
    conflicto.name = 'InvalidStateError'
    const e = armar_entorno({
      sin_options: true,
      suscripcion_previa: { endpoint: 'https://push.apple.com/viejo', clave: CLAVE_B },
      subscribe_tira: conflicto,
      subscribe_tira_solo_la_primera: true,
    })
    const r = await atrapar(e.modulo.enable_push_notifications())

    comprobar('el registro termina bien', r.ok === true, r.ok ? '' : String(r.error && r.error.message))
    comprobar('se intentó primero sin tocar nada, y se reintentó después',
      e.registro.subscribe_llamadas.length === 2, e.registro.subscribe_llamadas.length + ' llamadas')
    comprobar('se dio de baja la vieja recién en el segundo intento', e.registro.bajas.length === 1)
    comprobar('se le avisó al backend de la baja',
      e.registro.posts.filter(function (p) { return p.ruta === '/push/unsubscribe' }).length === 1)
  }

  console.log('\n15. si subscribe falla después de dar de baja, el backend no queda con basura')
  {
    const caido = new Error('Push service unavailable')
    caido.name = 'AbortError'
    const e = armar_entorno({
      suscripcion_previa: { endpoint: 'https://push.apple.com/viejo', clave: CLAVE_B },
      subscribe_tira: caido,
    })
    const r = await atrapar(e.modulo.enable_push_notifications())

    comprobar('falla con paso SUBSCRIPTION', r.ok === false && r.error.step === 'subscription',
      r.error ? r.error.step : '')
    comprobar('la fila vieja del backend se borró y no quedó huérfana',
      e.registro.posts.filter(function (p) { return p.ruta === '/push/unsubscribe' }).length === 1,
      JSON.stringify(e.registro.posts.map(function (p) { return p.ruta })))
    comprobar('el detalle técnico llega al usuario',
      !!r.error && r.error.detail.indexOf('AbortError') === 0, r.error && r.error.detail)
  }

  console.log('\n16. un error que NO es conflicto de clave no dispara el reemplazo')
  {
    /*
      Candado de una decisión deliberada: es_conflicto_de_clave() es estricto a propósito. Aflojarlo
      con textos sueltos ("already exists", "different key") haría que un error de otra familia
      diera falso positivo y se diera de baja una suscripción que funcionaba -- justo lo que este
      rediseño existe para evitar. Un falso negativo solo muestra el error; un falso positivo rompe.
    */
    const otro = new Error('Push service quota already exists for this origin')
    otro.name = 'QuotaExceededError'
    const e = armar_entorno({
      sin_options: true,
      suscripcion_previa: { endpoint: 'https://push.apple.com/vive', clave: CLAVE_A },
      subscribe_tira: otro,
    })
    const r = await atrapar(e.modulo.enable_push_notifications())

    comprobar('falla y muestra el error', r.ok === false && r.error.step === 'subscription',
      r.error ? r.error.step : '')
    comprobar('NO se dio de baja la suscripción que servía', e.registro.bajas.length === 0,
      JSON.stringify(e.registro.bajas))
    comprobar('NO se reintentó a ciegas', e.registro.subscribe_llamadas.length === 1,
      e.registro.subscribe_llamadas.length + ' llamadas')
    comprobar('el detalle nombra el error real',
      !!r.error && r.error.detail.indexOf('QuotaExceededError') === 0, r.error && r.error.detail)
  }

  console.log('\n17. misma_clave distingue "otra clave" de "no se puede saber"')
  {
    const e = armar_entorno({})
    const clave_a = e.modulo.url_base64_to_uint8array(CLAVE_A)
    const s_a = { options: { applicationServerKey: base64_a_bytes(CLAVE_A).buffer } }
    const s_b = { options: { applicationServerKey: base64_a_bytes(CLAVE_B).buffer } }
    const s_sin = { options: {} }

    comprobar('misma clave: true', e.modulo.misma_clave(s_a, clave_a) === true)
    comprobar('otra clave: false', e.modulo.misma_clave(s_b, clave_a) === false)
    comprobar('options sin applicationServerKey: null, no false',
      e.modulo.misma_clave(s_sin, clave_a) === null)
    comprobar('sin options del todo: null, no false',
      e.modulo.misma_clave({}, clave_a) === null)
  }

  console.log('\n' + (mal === 0 ? 'TODO VERDE' : 'HAY ' + mal + ' EN ROJO') +
    ' — ' + ok + ' comprobaciones ok, ' + mal + ' mal\n')
  process.exit(mal === 0 ? 0 : 1)
}

correr()
