/**
 * Pruebas del registro de búsquedas del centro de recursos (misión busquedas-centro-recursos, contrato C-BUSQ-1):
 * `busquedas.js` con un reloj falso (nada espera de verdad) y `enviar_busqueda` de `api.js` con un `fetch` falso.
 * Se corren con `node --test tests/recursos` junto con las demás.
 */
import { test, describe, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { es_consulta_registrable, crear_registro_de_busquedas, crear_id_de_busqueda, ESPERA_POR_DEFECTO_MS } from '../../src/recursos/busquedas.js'

const RAIZ = fileURLToPath(new URL('../../', import.meta.url))

/**
 * Reloj de mentira: guarda lo que se programa y lo dispara cuando el test avanza el tiempo.
 *
 * @returns {{ programar: Function, cancelar: Function, avanzar: Function, pendientes: Function }}
 */
function reloj_falso() {
  let ahora = 0
  let proximo = 1
  /** @type {Map<number, { cuando: number, funcion: Function }>} */
  const tareas = new Map()
  return {
    programar(funcion, ms) {
      const manija = proximo++
      tareas.set(manija, { cuando: ahora + ms, funcion: funcion })
      return manija
    },
    cancelar(manija) {
      tareas.delete(manija)
    },
    /** Avanza el reloj `ms` milisegundos y corre lo que vence, en orden. */
    avanzar(ms) {
      ahora += ms
      const vencidas = Array.from(tareas.entries())
        .filter(([, t]) => t.cuando <= ahora)
        .sort((a, b) => a[1].cuando - b[1].cuando)
      for (const [manija, t] of vencidas) {
        tareas.delete(manija)
        t.funcion()
      }
    },
    pendientes() {
      return tareas.size
    },
  }
}

/**
 * Arma un registro con reloj falso, ids deterministas y un envío que anota lo que sale.
 *
 * @param {Object} [extra] Opciones que pisan las de la prueba (por ejemplo `enviar`).
 * @returns {{ registro: Object, reloj: Object, enviados: Array<Object> }}
 */
function armar(extra) {
  const reloj = reloj_falso()
  const enviados = []
  let n = 0
  const registro = crear_registro_de_busquedas(
    Object.assign(
      {
        enviar: (payload) => {
          enviados.push(payload)
        },
        espera_ms: 1500,
        crear_id: () => 'busqueda' + String(++n).padStart(4, '0'),
        programar: reloj.programar,
        cancelar: reloj.cancelar,
      },
      extra || {}
    )
  )
  return { registro, reloj, enviados }
}

/** Lo que informa el buscador para una consulta. */
function info(consulta, extra) {
  return Object.assign({ consulta: consulta, resultados: 4, primero: 'T2.1', completo: true }, extra || {})
}

describe('es_consulta_registrable: la misma regla que el servidor', function () {
  for (const texto of ['escanear factura', 'cheque', 'Cómo cargo un PROVEEDOR', 't5.15', 'iva 21', 'lista 2', 'ab', '  factura  ']) {
    test('sí se registra: «' + texto + '»', function () {
      assert.equal(es_consulta_registrable(texto), true)
    })
  }

  const NO = {
    'un mail': 'a@b.com',
    'un celular': '3444622139',
    'un teléfono con espacios (11 dígitos)': '11 5555 1234',
    'un CUIT con guiones': '20-12345678-9',
    'una web con www.': 'www.x.com',
    'un link': 'https://recursos.comerciocity.com/algo',
    'un link sin www': 'http://x.com',
    'una sola letra': 'x',
    'un emoji': '😀',
    'vacía': '',
    'solo espacios': '   ',
    'solo signos': '¿?',
    'cuatro dígitos corridos más tres sueltos (7 en total)': '1234 56 7',
    'cinco dígitos corridos': 'factura 12345',
  }
  for (const nombre of Object.keys(NO)) {
    test('no se registra: ' + nombre, function () {
      assert.equal(es_consulta_registrable(NO[nombre]), false)
    })
  }

  test('seis dígitos sueltos y separados sí (no llegan a 7 ni a 5 corridos)', function () {
    assert.equal(es_consulta_registrable('1 2 3 4 5 6 factura'), true)
  })

  test('los acentos y las mayúsculas no cambian la regla', function () {
    assert.equal(es_consulta_registrable('ÁÉ'), true)
    assert.equal(es_consulta_registrable('WWW.X.COM'), false)
    assert.equal(es_consulta_registrable('HTTP://X'), false)
  })

  test('no revienta con algo que no es texto', function () {
    assert.equal(es_consulta_registrable(null), false)
    assert.equal(es_consulta_registrable(undefined), false)
    assert.equal(es_consulta_registrable(12), true, 'un número se trata como el texto «12»')
  })
})

describe('crear_id_de_busqueda', function () {
  test('devuelve 24 letras y números, distintos cada vez', function () {
    const a = crear_id_de_busqueda()
    const b = crear_id_de_busqueda()
    assert.match(a, /^[A-Za-z0-9]{24}$/)
    assert.notEqual(a, b)
  })

  test('sin crypto igual devuelve un id válido para el servidor (8 a 40 letras, números, _ o -)', function () {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true })
    try {
      assert.match(crear_id_de_busqueda(), /^[A-Za-z0-9_-]{8,40}$/)
    } finally {
      Object.defineProperty(globalThis, 'crypto', original)
    }
  })
})

describe('crear_registro_de_busquedas', function () {
  test('la espera por defecto es de un segundo y medio', function () {
    assert.equal(ESPERA_POR_DEFECTO_MS, 1500)
  })

  test('manda UNA vez, cuando pasa la espera sin cambios, con los nombres exactos del contrato', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('escanear factura'))
    reloj.avanzar(1499)
    assert.equal(enviados.length, 0, 'todavía no pasó la espera')
    reloj.avanzar(1)
    assert.equal(enviados.length, 1)
    assert.deepEqual(enviados[0], {
      evento: 'busqueda0001',
      consulta: 'escanear factura',
      resultados: 4,
      primero: 'T2.1',
      completo: true,
    })
    assert.deepEqual(Object.keys(enviados[0]).sort(), ['completo', 'consulta', 'evento', 'primero', 'resultados'], 'sin abrio ni posicion si no hubo clic')
    reloj.avanzar(60000)
    assert.equal(enviados.length, 1, 'no se vuelve a mandar')
  })

  test('con la misma consulta no se reinicia el reloj y se manda lo último que informó el buscador', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('factura', { resultados: 2, primero: 'T1.1', completo: false }))
    reloj.avanzar(1000)
    registro.buscado(info('  factura ', { resultados: 7, primero: 'T9.9', completo: true }))
    reloj.avanzar(500)
    assert.equal(enviados.length, 1, 'salió a los 1500 ms del primer aviso, no del segundo')
    assert.equal(enviados[0].resultados, 7)
    assert.equal(enviados[0].primero, 'T9.9')
    assert.equal(enviados[0].completo, true)
    assert.equal(enviados[0].consulta, 'factura', 'la consulta sale sin los espacios de los costados')
  })

  test('con la misma consulta después de mandada no se reenvía', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('factura'))
    reloj.avanzar(1500)
    registro.buscado(info('factura', { resultados: 9 }))
    reloj.avanzar(5000)
    assert.equal(enviados.length, 1)
    assert.equal(reloj.pendientes(), 0)
  })

  test('una consulta distinta descarta la que estaba a medio escribir y arranca otra búsqueda con otro id', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('fac'))
    reloj.avanzar(1000)
    registro.buscado(info('factura', { resultados: 3 }))
    assert.equal(reloj.pendientes(), 1, 'queda un solo reloj: el de la consulta nueva')
    reloj.avanzar(1499)
    assert.equal(enviados.length, 0, 'el reloj arrancó de nuevo')
    reloj.avanzar(1)
    assert.equal(enviados.length, 1)
    assert.equal(enviados[0].consulta, 'factura')
    assert.equal(enviados[0].evento, 'busqueda0002')
  })

  test('después de mandar una búsqueda, escribir otra manda una segunda con otro evento', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('factura'))
    reloj.avanzar(1500)
    registro.buscado(info('cheque'))
    reloj.avanzar(1500)
    assert.equal(enviados.length, 2)
    assert.deepEqual(
      enviados.map((e) => e.consulta),
      ['factura', 'cheque']
    )
    assert.notEqual(enviados[0].evento, enviados[1].evento)
  })

  test('una consulta vacía o que no se registra cancela lo pendiente y no manda nada', function () {
    for (const rara of ['', '   ', 'a@b.com', '3444622139', 'x']) {
      const { registro, reloj, enviados } = armar()
      registro.buscado(info('factura'))
      registro.buscado(info(rara))
      assert.equal(reloj.pendientes(), 0, 'sin reloj para «' + rara + '»')
      reloj.avanzar(10000)
      assert.deepEqual(enviados, [], 'no salió nada para «' + rara + '»')
      registro.abrio('T2.1', 1)
      assert.deepEqual(enviados, [], 'tampoco un clic: no hay búsqueda actual')
    }
  })

  test('cancelar() descarta lo pendiente y deja sin búsqueda actual', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('factura'))
    registro.cancelar()
    reloj.avanzar(10000)
    assert.deepEqual(enviados, [])
    registro.abrio('T2.1', 1)
    assert.deepEqual(enviados, [])
    registro.cancelar()
  })

  test('el clic manda enseguida el payload completo con abrio y posicion, y apaga el reloj', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('escanear factura', { resultados: 12, primero: 'T4.8' }))
    reloj.avanzar(300)
    registro.abrio('T4.9', 2)
    assert.equal(enviados.length, 1)
    assert.deepEqual(enviados[0], {
      evento: 'busqueda0001',
      consulta: 'escanear factura',
      resultados: 12,
      primero: 'T4.8',
      completo: true,
      abrio: 'T4.9',
      posicion: 2,
    })
    assert.equal(reloj.pendientes(), 0)
    reloj.avanzar(10000)
    assert.equal(enviados.length, 1, 'el reloj apagado no manda el evento sin clic')
  })

  test('el clic después de que salió el evento sin clic manda otra vez, con el MISMO evento', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('factura'))
    reloj.avanzar(1500)
    registro.abrio('T2.1', 1)
    assert.equal(enviados.length, 2)
    assert.equal(enviados[0].abrio, undefined)
    assert.equal(enviados[1].abrio, 'T2.1')
    assert.equal(enviados[1].posicion, 1)
    assert.equal(enviados[0].evento, enviados[1].evento)
  })

  test('solo cuenta el primer clic de cada búsqueda', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('factura'))
    registro.abrio('T2.1', 1)
    registro.abrio('T3.3', 5)
    reloj.avanzar(10000)
    assert.equal(enviados.length, 1)
    assert.equal(enviados[0].abrio, 'T2.1')
  })

  test('una búsqueda nueva vuelve a contar su primer clic', function () {
    const { registro, enviados } = armar()
    registro.buscado(info('factura'))
    registro.abrio('T2.1', 1)
    registro.buscado(info('cheque'))
    registro.abrio('T5.5', 3)
    assert.equal(enviados.length, 2)
    assert.equal(enviados[1].abrio, 'T5.5')
    assert.equal(enviados[1].consulta, 'cheque')
    assert.notEqual(enviados[0].evento, enviados[1].evento)
  })

  test('un clic sin búsqueda en curso no hace nada', function () {
    const { registro, reloj, enviados } = armar()
    registro.abrio('T2.1', 1)
    reloj.avanzar(10000)
    assert.deepEqual(enviados, [])
  })

  test('primero es null si no hay resultados; la consulta se recorta a 500; el código, a 20', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('zzzz', { resultados: 0, primero: 'T1.1', completo: false }))
    reloj.avanzar(1500)
    assert.equal(enviados[0].resultados, 0)
    assert.equal(enviados[0].primero, null)
    assert.equal(enviados[0].completo, false)

    const larga = 'factura '.repeat(100)
    registro.buscado(info(larga))
    reloj.avanzar(1500)
    assert.equal(enviados[1].consulta.length, 500)

    registro.buscado(info('cheque', { primero: 'T' + '9'.repeat(40) }))
    reloj.avanzar(1500)
    assert.equal(enviados[2].primero.length, 20)
  })

  test('la posición inválida no se manda, pero el clic sí', function () {
    const { registro, enviados } = armar()
    registro.buscado(info('factura'))
    registro.abrio('T2.1', 0)
    assert.equal(enviados[0].abrio, 'T2.1')
    assert.equal('posicion' in enviados[0], false)
  })

  test('completo siempre sale como booleano', function () {
    const { registro, reloj, enviados } = armar()
    registro.buscado(info('factura', { completo: 1 }))
    reloj.avanzar(1500)
    assert.strictEqual(enviados[0].completo, true)
  })

  test('si el envío lanza o devuelve una promesa rechazada, no sube hasta el buscador', async function () {
    const lanza = armar({
      enviar: () => {
        throw new Error('boom')
      },
    })
    lanza.registro.buscado(info('factura'))
    assert.doesNotThrow(() => lanza.reloj.avanzar(1500))
    assert.doesNotThrow(() => lanza.registro.abrio('T2.1', 1))

    let sin_atrapar = 0
    const handler = () => sin_atrapar++
    process.on('unhandledRejection', handler)
    try {
      const rechaza = armar({ enviar: () => Promise.reject(new Error('404')) })
      rechaza.registro.buscado(info('factura'))
      rechaza.reloj.avanzar(1500)
      await new Promise((resolver) => setImmediate(resolver))
      await new Promise((resolver) => setImmediate(resolver))
    } finally {
      process.off('unhandledRejection', handler)
    }
    assert.equal(sin_atrapar, 0)
  })

  test('sin opciones de reloj usa setTimeout y clearTimeout del entorno', async function () {
    const mandados = []
    const registro = crear_registro_de_busquedas({ enviar: (p) => mandados.push(p), espera_ms: 5 })
    registro.buscado(info('factura'))
    await new Promise((resolver) => setTimeout(resolver, 40))
    assert.equal(mandados.length, 1)
    assert.match(mandados[0].evento, /^[A-Za-z0-9]{24}$/)

    registro.buscado(info('cheque'))
    registro.cancelar()
    await new Promise((resolver) => setTimeout(resolver, 40))
    assert.equal(mandados.length, 1, 'lo cancelado no sale')
  })
})

describe('enviar_busqueda: nunca lanza y se apaga solo ante una API vieja', function () {
  let servidor = null
  let api = null
  let fetch_original
  /** Pedidos que llegaron al "servidor". */
  let pedidos = []
  /** Cómo contesta el "servidor": un status, o 'red' para que el fetch rechace. */
  let respuesta = 200

  before(async function () {
    const { createServer } = await import('vite')
    servidor = await createServer({
      configFile: false,
      root: RAIZ,
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'error',
      optimizeDeps: { noDiscovery: true, include: [] },
    })
    api = await servidor.ssrLoadModule('/src/recursos/api.js')
  })

  after(async function () {
    if (servidor) {
      await servidor.close()
    }
  })

  beforeEach(function () {
    fetch_original = globalThis.fetch
    pedidos = []
    respuesta = 200
    api.reactivar_registro_de_busquedas()
    globalThis.fetch = async function (url, opciones) {
      pedidos.push({ url: String(url), opciones: opciones })
      if (respuesta === 'red') {
        throw new TypeError('Failed to fetch')
      }
      const cuerpo = respuesta === 200 ? JSON.stringify({ registrado: true }) : JSON.stringify({ error: 'x' })
      return { ok: respuesta >= 200 && respuesta < 300, status: respuesta, text: async () => cuerpo }
    }
  })

  afterEach(function () {
    globalThis.fetch = fetch_original
  })

  const PAYLOAD = { evento: 'busqueda0001', consulta: 'factura', resultados: 3, primero: 'T2.1', completo: true }

  test('hace POST a recursos/busquedas con el JSON y keepalive', async function () {
    const ok = await api.enviar_busqueda(PAYLOAD)
    assert.equal(ok, true)
    assert.equal(pedidos.length, 1)
    assert.match(pedidos[0].url, /\/recursos\/busquedas$/)
    assert.equal(pedidos[0].opciones.method, 'POST')
    assert.equal(pedidos[0].opciones.keepalive, true)
    assert.equal(pedidos[0].opciones.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(pedidos[0].opciones.body), PAYLOAD)
  })

  test('un 404 (API vieja) apaga el registro: las siguientes no salen', async function () {
    respuesta = 404
    assert.equal(await api.enviar_busqueda(PAYLOAD), false)
    assert.equal(api.registro_de_busquedas_esta_apagado(), true)
    respuesta = 200
    assert.equal(await api.enviar_busqueda(PAYLOAD), false)
    assert.equal(pedidos.length, 1, 'no volvió a pegarle a la API')
  })

  test('un 405 también apaga', async function () {
    respuesta = 405
    await api.enviar_busqueda(PAYLOAD)
    assert.equal(api.registro_de_busquedas_esta_apagado(), true)
  })

  test('un rechazo de red (sin conexión, CORS) apaga y no lanza', async function () {
    respuesta = 'red'
    const resultado = await api.enviar_busqueda(PAYLOAD)
    assert.equal(resultado, false)
    assert.equal(api.registro_de_busquedas_esta_apagado(), true)
    respuesta = 200
    await api.enviar_busqueda(PAYLOAD)
    assert.equal(pedidos.length, 1)
  })

  for (const status of [422, 429, 500, 503]) {
    test('un ' + status + ' se ignora pero NO apaga: la próxima sale', async function () {
      respuesta = status
      assert.equal(await api.enviar_busqueda(PAYLOAD), false)
      assert.equal(api.registro_de_busquedas_esta_apagado(), false)
      respuesta = 200
      assert.equal(await api.enviar_busqueda(PAYLOAD), true)
      assert.equal(pedidos.length, 2)
    })
  }

  test('si fetch ni existe, no lanza', async function () {
    globalThis.fetch = undefined
    assert.equal(await api.enviar_busqueda(PAYLOAD), false)
  })

  test('reactivar_registro_de_busquedas vuelve a dejar salir', async function () {
    respuesta = 404
    await api.enviar_busqueda(PAYLOAD)
    api.reactivar_registro_de_busquedas()
    respuesta = 200
    assert.equal(await api.enviar_busqueda(PAYLOAD), true)
  })
})
