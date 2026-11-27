/*
  Pruebas de aceptación de la misión push-mensajes-por-aprobar (admin-spa).

  Se corre con `node pruebas/push-mensajes-por-aprobar.cjs`. Sin dependencias ni corredor,
  igual que `pruebas/registro-push.cjs`: cada módulo se carga del ARCHIVO REAL de `src/`
  --se le sacan los `import`/`export` y se evalúa con el entorno del navegador simulado--
  para que la prueba no sea una copia que se desincroniza.

  Qué cubre (ver .mision/PLAN.md §2.9, §6 y §13):
  - CA14: el Service Worker (`src/sw.js`) pasa `tag` y `renotify: true` a showNotification
    sólo cuando el payload trae un `tag` string no vacío; sin tag, las opciones quedan
    idénticas a las de hoy (renotify sin tag tira TypeError en el navegador y la notificación
    no se muestra, por eso nunca uno sin el otro). El click abre la url completa con
    `?message_id=`.
  - CA15 (lógica): `src/utils/conversation_focus.js` --`message_id_from_query` y
    `focus_message_row`-- que la conversación de leads usa para centrar y resaltar el mensaje
    pendiente de aprobación.

  Termina con exit code distinto de 0 si algo falla.
*/
const fs = require('fs')
const path = require('path')

const RAIZ_SRC = path.join(__dirname, '..', 'src')
const FUENTE_SW = path.join(RAIZ_SRC, 'sw.js')
const FUENTE_FOCO = path.join(RAIZ_SRC, 'utils', 'conversation_focus.js')

// Contadores globales de comprobaciones.
let ok = 0
let mal = 0

/**
 * Registra el resultado de una comprobación e imprime OK / FALLA.
 *
 * @param {string} nombre Qué se comprueba.
 * @param {boolean} condicion Resultado.
 * @param {string} [detalle] Información extra que se imprime cuando falla.
 */
function comprobar(nombre, condicion, detalle) {
  if (condicion) {
    ok++
    console.log('  OK     ' + nombre)
  } else {
    mal++
    console.log('  FALLA  ' + nombre + (detalle ? '  -> ' + detalle : ''))
  }
}

/**
 * Lee un módulo fuente y le saca `import ...` y `export ` para poder evaluarlo con Function.
 *
 * @param {string} ruta Archivo real de src/.
 * @returns {string} Código evaluable.
 */
function leer_sin_modulos(ruta) {
  return fs
    .readFileSync(ruta, 'utf8')
    .split('\n')
    .filter(function (linea) {
      return !linea.startsWith('import ')
    })
    .join('\n')
    .replace(/^export /gm, '')
}

/* ------------------------------------------------------------------ */
/* Service Worker (CA14)                                               */
/* ------------------------------------------------------------------ */

/**
 * Carga src/sw.js real con `self` simulado y devuelve los listeners que registra.
 *
 * `self` expone addEventListener (guarda los handlers), registration.showNotification
 * (anota cada llamada) y clients.openWindow (anota cada url). `precacheAndRoute` es un stub.
 *
 * @returns {object} { listeners, notificaciones, ventanas_abiertas }
 */
function cargar_sw() {
  const listeners = {}
  const notificaciones = []
  const ventanas_abiertas = []

  const self_falso = {
    __WB_MANIFEST: [],
    addEventListener: function (tipo, handler) {
      listeners[tipo] = handler
    },
    skipWaiting: function () {},
    registration: {
      showNotification: function (titulo, opciones) {
        notificaciones.push({ titulo: titulo, opciones: opciones })
        return Promise.resolve()
      },
    },
    clients: {
      openWindow: function (url) {
        ventanas_abiertas.push(url)
        return Promise.resolve()
      },
    },
  }

  const fabrica = new Function('self', 'precacheAndRoute', leer_sin_modulos(FUENTE_SW))
  fabrica(self_falso, function () {})
  return { listeners: listeners, notificaciones: notificaciones, ventanas_abiertas: ventanas_abiertas }
}

/**
 * Dispara el evento `push` del SW con un payload y devuelve la notificación mostrada.
 *
 * @param {object} payload JSON que mandaría el backend.
 * @returns {object|null} { titulo, opciones } o null si no se mostró nada.
 */
function disparar_push(payload) {
  const sw = cargar_sw()
  let espera = null
  sw.listeners.push({
    data: { json: function () { return payload } },
    waitUntil: function (promesa) { espera = promesa },
  })
  return { sw: sw, espera: espera, notificacion: sw.notificaciones[0] || null }
}

/** CA14: payload con tag, sin tag y click. */
function probar_sw() {
  console.log('\nCA14. Service Worker: tag + renotify en el push')

  /* Payload con tag: el aviso de un lead reemplaza al anterior del mismo lead en el teléfono
     (tag) y vuelve a sonar (renotify). */
  {
    const r = disparar_push({
      title: 'Mensaje por aprobar',
      body: 'Juan: hola',
      url: '/leads/7/conversacion?message_id=12',
      tag: 'aprobacion-lead-7',
    })
    const o = r.notificacion ? r.notificacion.opciones : {}
    comprobar('se muestra la notificación', !!r.notificacion)
    comprobar('options.tag igual al del payload', o.tag === 'aprobacion-lead-7', JSON.stringify(o.tag))
    comprobar('options.renotify === true', o.renotify === true, JSON.stringify(o.renotify))
    comprobar('conserva body, icon y data.url',
      o.body === 'Juan: hola' && o.icon === '/icons/pwa-192.png' &&
        !!o.data && o.data.url === '/leads/7/conversacion?message_id=12',
      JSON.stringify(o))
  }

  /* Payload sin tag: opciones EXACTAMENTE como hoy. Un renotify sin tag es TypeError. */
  {
    const r = disparar_push({ title: 'Aviso', body: 'texto', url: '/leads?lead_id=3' })
    const o = r.notificacion ? r.notificacion.opciones : {}
    comprobar('sin tag: se muestra la notificación', !!r.notificacion)
    comprobar('sin tag: no hay clave tag', !('tag' in o), JSON.stringify(Object.keys(o)))
    comprobar('sin tag: no hay clave renotify', !('renotify' in o), JSON.stringify(Object.keys(o)))
    comprobar('sin tag: opciones idénticas a las de hoy',
      JSON.stringify(o) === JSON.stringify({
        body: 'texto',
        icon: '/icons/pwa-192.png',
        data: { url: '/leads?lead_id=3' },
      }),
      JSON.stringify(o))
  }

  /* Tag inválido (vacío o no string) se trata como sin tag: nunca renotify suelto. */
  {
    const vacio = disparar_push({ title: 'a', body: 'b', tag: '' })
    const numero = disparar_push({ title: 'a', body: 'b', tag: 5 })
    const ov = vacio.notificacion ? vacio.notificacion.opciones : { tag: 'x' }
    const on = numero.notificacion ? numero.notificacion.opciones : { tag: 'x' }
    comprobar('tag vacío: sin tag ni renotify', !('tag' in ov) && !('renotify' in ov), JSON.stringify(ov))
    comprobar('tag no string: sin tag ni renotify', !('tag' in on) && !('renotify' in on), JSON.stringify(on))
  }

  /* Click: cierra la notificación y abre la url completa, query incluido. */
  {
    const sw = cargar_sw()
    let cerrada = false
    let espera = null
    sw.listeners.notificationclick({
      notification: {
        close: function () { cerrada = true },
        data: { url: '/leads/7/conversacion?message_id=12' },
      },
      waitUntil: function (promesa) { espera = promesa },
    })
    comprobar('click: cierra la notificación', cerrada === true)
    comprobar('click: openWindow con la url completa incluido ?message_id=',
      sw.ventanas_abiertas.length === 1 && sw.ventanas_abiertas[0] === '/leads/7/conversacion?message_id=12',
      JSON.stringify(sw.ventanas_abiertas))
  }
}

/* ------------------------------------------------------------------ */
/* conversation_focus.js (CA15, lógica)                                */
/* ------------------------------------------------------------------ */

/**
 * Carga src/utils/conversation_focus.js real con `setTimeout` simulado (timers falsos).
 * Si el archivo no existe devuelve null: el test falla por eso, no por un error propio.
 *
 * @returns {object|null} { message_id_from_query, focus_message_row, timers } o null.
 */
function cargar_foco() {
  if (!fs.existsSync(FUENTE_FOCO)) {
    return null
  }
  // Timers falsos: se anotan (callback, ms) y se ejecutan a mano con `avanzar`.
  const timers = []
  const set_timeout_falso = function (callback, ms) {
    timers.push({ callback: callback, ms: ms })
    return timers.length
  }
  const codigo = leer_sin_modulos(FUENTE_FOCO) +
    '\nreturn { message_id_from_query, focus_message_row };'
  const modulo = new Function('setTimeout', codigo)(set_timeout_falso)
  modulo.timers = timers
  return modulo
}

/**
 * Elemento DOM simulado con classList y scrollIntoView que anotan lo que reciben.
 *
 * @returns {object}
 */
function elemento_falso() {
  const clases = new Set()
  return {
    clases: clases,
    scroll_llamadas: [],
    scrollIntoView: function (opciones) { this.scroll_llamadas.push(opciones) },
    classList: {
      add: function (c) { clases.add(c) },
      remove: function (c) { clases.delete(c) },
      contains: function (c) { return clases.has(c) },
    },
  }
}

/**
 * Raíz DOM simulada que sólo conoce los elementos de `por_selector`.
 *
 * @param {object} por_selector Mapa selector -> elemento.
 * @returns {object}
 */
function raiz_falsa(por_selector) {
  return {
    selectores_pedidos: [],
    querySelector: function (selector) {
      this.selectores_pedidos.push(selector)
      return por_selector[selector] || null
    },
    querySelectorAll: function (selector) {
      this.selectores_pedidos.push(selector)
      return por_selector[selector] ? [por_selector[selector]] : []
    },
  }
}

/** CA15 (lógica): message_id_from_query y focus_message_row. */
function probar_foco() {
  console.log('\nCA15. conversation_focus.js: message_id_from_query y focus_message_row')

  const foco = cargar_foco()
  comprobar('existe src/utils/conversation_focus.js', foco !== null,
    'no existe ' + FUENTE_FOCO)
  if (foco === null) {
    return
  }
  comprobar('exporta message_id_from_query y focus_message_row',
    typeof foco.message_id_from_query === 'function' && typeof foco.focus_message_row === 'function')

  /* message_id_from_query: entero positivo o null. Lee el query de la ruta ({message_id: ...}). */
  console.log('\n  message_id_from_query')
  const desde = function (valor) { return foco.message_id_from_query({ message_id: valor }) }
  comprobar("acepta '12' -> 12", desde('12') === 12, String(desde('12')))
  comprobar('acepta 12 -> 12', desde(12) === 12, String(desde(12)))
  comprobar("rechaza 'abc' -> null", desde('abc') === null)
  comprobar("rechaza '0' -> null", desde('0') === null)
  comprobar("rechaza '-3' -> null", desde('-3') === null)
  comprobar("rechaza '1.5' -> null", desde('1.5') === null)
  comprobar("rechaza ['12'] (array) -> null", desde(['12']) === null)
  comprobar('rechaza undefined -> null', desde(undefined) === null)
  comprobar('query sin message_id -> null', foco.message_id_from_query({}) === null)
  comprobar('query undefined -> null', foco.message_id_from_query(undefined) === null)

  /* focus_message_row: encuentra la fila, centra, resalta y quita el resalte a los 1600 ms. */
  console.log('\n  focus_message_row')
  {
    const fila = elemento_falso()
    const raiz = raiz_falsa({ '[data-message-id="12"]': fila })
    const timers_antes = foco.timers.length
    const resultado = foco.focus_message_row(raiz, 12, 'wa-message--focus-flash')
    const nuevos = foco.timers.slice(timers_antes)

    comprobar('devuelve true si encuentra la fila', resultado === true, String(resultado))
    comprobar('busca [data-message-id="12"]',
      raiz.selectores_pedidos.indexOf('[data-message-id="12"]') !== -1,
      JSON.stringify(raiz.selectores_pedidos))
    comprobar("scrollIntoView({ block: 'center' }) una vez",
      fila.scroll_llamadas.length === 1 && fila.scroll_llamadas[0] &&
        fila.scroll_llamadas[0].block === 'center',
      JSON.stringify(fila.scroll_llamadas))
    comprobar('agrega la clase de resalte', fila.clases.has('wa-message--focus-flash'))
    comprobar('programa un timer de 1600 ms', nuevos.length === 1 && nuevos[0].ms === 1600,
      JSON.stringify(nuevos.map(function (t) { return t.ms })))
    comprobar('antes de los 1600 ms la clase sigue puesta', fila.clases.has('wa-message--focus-flash'))
    if (nuevos.length) {
      nuevos[0].callback()
    }
    comprobar('a los 1600 ms quita la clase', !fila.clases.has('wa-message--focus-flash'))
  }

  /* Acepta el id como string (viene del query) y lo busca igual. */
  {
    const fila = elemento_falso()
    const raiz = raiz_falsa({ '[data-message-id="45"]': fila })
    const resultado = foco.focus_message_row(raiz, '45', 'flash')
    comprobar("message_id como string '45' también encuentra la fila", resultado === true)
  }

  /* No encontrado: false, sin tirar ni tocar nada. */
  {
    const raiz = raiz_falsa({})
    const timers_antes = foco.timers.length
    let resultado = null
    let tiro = null
    try {
      resultado = foco.focus_message_row(raiz, 99, 'wa-message--focus-flash')
    } catch (e) {
      tiro = e
    }
    comprobar('no encontrado: no tira', tiro === null, tiro && String(tiro))
    comprobar('no encontrado: devuelve false', resultado === false, String(resultado))
    comprobar('no encontrado: no programa timers', foco.timers.length === timers_antes)
  }
}

/* ------------------------------------------------------------------ */
/* Corrida                                                             */
/* ------------------------------------------------------------------ */

try {
  probar_sw()
} catch (e) {
  comprobar('probar_sw terminó sin excepción', false, e && e.stack ? e.stack.split('\n')[0] : String(e))
}
try {
  probar_foco()
} catch (e) {
  comprobar('probar_foco terminó sin excepción', false, e && e.stack ? e.stack.split('\n')[0] : String(e))
}

console.log('\n' + (mal === 0 ? 'TODO VERDE' : 'HAY ' + mal + ' EN ROJO') +
  ' — ' + ok + ' comprobaciones ok, ' + mal + ' mal\n')
process.exit(mal === 0 ? 0 : 1)
