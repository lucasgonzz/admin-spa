/**
 * Pruebas de `BarraCarpetas.vue` con el componente MONTADO en un DOM simulado (no hay navegador ni jsdom en el
 * proyecto). Se corren con `node --test tests/recursos` junto con las del buscador.
 *
 * Qué se simula y por qué:
 * - El componente se carga con Vite (`ssrLoadModule`, que compila el `.vue` y resuelve sus imports) y se le cambia
 *   el `render` por el del cliente, compilado con `@vue/compiler-sfc`: así corre el mismo template que en el
 *   navegador, con `createRenderer` de Vue sobre unos nodos de mentira.
 * - Los eventos tienen DOS modos. Con uno `real` los oyentes de un mismo evento corren de a uno y entre cada
 *   oyente se vacía la cola de microtareas, que es lo que hace el navegador con el teclado de verdad (la pila
 *   queda vacía al terminar cada oyente). Con uno `sintetico` (`dispatchEvent` desde un script) corren todos
 *   seguidos y recién después las microtareas. Con el segundo orden "andaba"; con el primero, no: el observador de
 *   `consulta` corre entre el oyente de `v-model` y el de `@input`.
 * - La lista tiene un "layout" mínimo: cada carpeta, video y resultado mide un alto fijo, `scrollTop` se acota a
 *   lo que mide el contenido (como hace el navegador cuando el contenido se achica) y `scrollIntoView` mueve lo
 *   justo.
 */
import { test, describe, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as Vue from 'vue'
import { parse, compileTemplate } from '@vue/compiler-sfc'

const RAIZ = fileURLToPath(new URL('../../', import.meta.url))
const RUTA_DEL_COMPONENTE = 'src/recursos/components/BarraCarpetas.vue'

/** Alto de lo que se dibuja en la lista y alto de la ventana de la lista. */
const ALTO_CARPETA = 44
const ALTO_VIDEO = 40
const ALTO_RESULTADO = 80
const ALTO_VENTANA = 300

/** `document` de mentira: el `v-model` de Vue 3.5 mira `el.getRootNode().activeElement` y comprueba que sea un `Document`. */
class DocumentoFalso {
  constructor() {
    this.activeElement = null
  }
}
const documento = new DocumentoFalso()

/** Nodo del DOM de mentira. */
class Nodo {
  constructor(tipo, etiqueta) {
    this.tipo = tipo
    this.etiqueta = etiqueta
    this.hijos = []
    this.padre = null
    this.texto = ''
    this.clases = ''
    this.atributos = {}
    this.escuchas = {}
    this.invocadores = {}
    this.value = ''
    this.composing = false
    this.enfocado = 0
    this._scroll = 0
  }

  addEventListener(tipo, f) {
    ;(this.escuchas[tipo] = this.escuchas[tipo] || []).push(f)
  }

  removeEventListener(tipo, f) {
    this.escuchas[tipo] = (this.escuchas[tipo] || []).filter(function (g) {
      return g !== f
    })
  }

  /** Vue 3.5 mira `el.getRootNode().activeElement` para saber si el campo tiene el foco. */
  getRootNode() {
    return documento
  }

  focus() {
    this.enfocado++
    documento.activeElement = this
  }

  tiene_clases(lista) {
    const mias = this.clases.split(/\s+/)
    return lista.every(function (c) {
      return mias.indexOf(c) !== -1
    })
  }

  descendientes() {
    const salida = []
    this.hijos.forEach(function (h) {
      salida.push(h)
      if (h.tipo === 'el') {
        salida.push.apply(salida, h.descendientes())
      }
    })
    return salida
  }

  querySelectorAll(selector) {
    const clases = selector.split('.').filter(Boolean)
    return this.descendientes().filter(function (n) {
      return n.tipo === 'el' && n.tiene_clases(clases)
    })
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null
  }

  /** Texto de todo lo que hay adentro. */
  get textContent() {
    if (this.tipo === 'texto') {
      return this.texto
    }
    return this.hijos
      .map(function (h) {
        return h.tipo === 'comentario' ? '' : h.textContent
      })
      .join('')
  }

  /** El nodo de la lista que tiene scroll, o null. */
  get lista() {
    let n = this
    while (n) {
      if (n.tipo === 'el' && n.tiene_clases(['lista-carpetas'])) {
        return n
      }
      n = n.padre
    }
    return null
  }

  /** Alto de este nodo como fila: una carpeta, un video, un resultado, o nada. */
  get alto_de_fila() {
    if (this.tipo !== 'el') {
      return 0
    }
    if (this.tiene_clases(['vid', 'res'])) {
      return ALTO_RESULTADO
    }
    if (this.tiene_clases(['vid'])) {
      return ALTO_VIDEO
    }
    if (this.tiene_clases(['cab'])) {
      return ALTO_CARPETA
    }
    return 0
  }

  get scrollHeight() {
    return this.descendientes().reduce(function (suma, n) {
      return suma + n.alto_de_fila
    }, 0)
  }

  get scrollTop() {
    return this._scroll
  }

  set scrollTop(v) {
    this._scroll = this.tiene_clases(['lista-carpetas']) ? Math.max(0, Math.min(v, this.scrollHeight - ALTO_VENTANA)) : v
  }

  /** Distancia desde el borde de arriba de la lista hasta este nodo. */
  get offsetTop() {
    const lista = this.lista
    let arriba = 0
    const yo = this
    for (const n of lista.descendientes()) {
      if (n === yo) {
        return arriba
      }
      arriba += n.alto_de_fila
    }
    return arriba
  }

  scrollIntoView() {
    const lista = this.lista
    if (!lista) {
      return
    }
    const arriba = this.offsetTop
    const abajo = arriba + this.alto_de_fila
    if (arriba < lista.scrollTop) {
      lista.scrollTop = arriba
    } else if (abajo > lista.scrollTop + ALTO_VENTANA) {
      lista.scrollTop = abajo - ALTO_VENTANA
    }
  }
}

/** Acota el scroll de la lista que contiene a `nodo` (el navegador lo hace al volver a calcular el layout). */
function reacomodar(nodo) {
  const lista = nodo ? nodo.lista : null
  if (lista) {
    lista.scrollTop = lista.scrollTop
  }
}

/** Operaciones de nodos y de propiedades para `createRenderer`. */
const OPERACIONES = {
  createElement: (etiqueta) => new Nodo('el', etiqueta),
  createText: (texto) => Object.assign(new Nodo('texto'), { texto: texto }),
  createComment: (texto) => Object.assign(new Nodo('comentario'), { texto: texto }),
  setText: (nodo, texto) => {
    nodo.texto = texto
  },
  setElementText: (el, texto) => {
    el.hijos.forEach((h) => (h.padre = null))
    el.hijos = texto ? [Object.assign(new Nodo('texto'), { texto: texto, padre: el })] : []
    reacomodar(el)
  },
  insert: (hijo, padre, ancla) => {
    if (hijo.padre) {
      hijo.padre.hijos.splice(hijo.padre.hijos.indexOf(hijo), 1)
    }
    hijo.padre = padre
    if (ancla) {
      padre.hijos.splice(padre.hijos.indexOf(ancla), 0, hijo)
    } else {
      padre.hijos.push(hijo)
    }
    reacomodar(padre)
  },
  remove: (hijo) => {
    const padre = hijo.padre
    if (padre) {
      padre.hijos.splice(padre.hijos.indexOf(hijo), 1)
      hijo.padre = null
      reacomodar(padre)
    }
  },
  parentNode: (nodo) => nodo.padre,
  nextSibling: (nodo) => (nodo.padre ? nodo.padre.hijos[nodo.padre.hijos.indexOf(nodo) + 1] || null : null),
  patchProp: (el, clave, previo, nuevo) => {
    if (/^on[A-Z]/.test(clave)) {
      const evento = clave.slice(2).toLowerCase()
      let invocador = el.invocadores[clave]
      if (!invocador) {
        invocador = el.invocadores[clave] = function (ev) {
          const f = invocador.valor
          if (Array.isArray(f)) {
            f.forEach((g) => g(ev))
          } else if (f) {
            f(ev)
          }
        }
        el.addEventListener(evento, invocador)
      }
      invocador.valor = nuevo
      return
    }
    if (clave === 'class') {
      el.clases = nuevo || ''
      reacomodar(el)
      return
    }
    el.atributos[clave] = nuevo
  },
}

/** Deja correr las microtareas (la cola de Vue y los `$nextTick`). */
async function microtareas() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve()
  }
}

/**
 * Dispara un evento sobre un nodo.
 *
 * @param {Nodo} nodo
 * @param {string} tipo Nombre del evento (`input`, `keydown`, `click`).
 * @param {Object} datos Propiedades del evento.
 * @param {'real'|'sintetico'} modo `real` vacía las microtareas entre un oyente y el siguiente.
 * @returns {Promise<void>}
 */
async function disparar(nodo, tipo, datos, modo) {
  const ev = Object.assign({ target: nodo, preventDefault() {}, stopPropagation() {} }, datos)
  const oyentes = (nodo.escuchas[tipo] || []).slice()
  for (const f of oyentes) {
    f(ev)
    if (modo === 'real') {
      await microtareas()
    }
  }
  await microtareas()
}

/** Escribe `texto` en el buscador como lo hace el teclado: cambia el valor y dispara `input`. */
async function escribir(entrada, texto, modo) {
  entrada.value = texto
  await disparar(entrada, 'input', {}, modo)
}

/** Render del cliente ya compilado. */
let render_compilado = null

/** Convierte el template del `.vue` en una función de render del cliente (se compila una sola vez). */
function render_del_cliente() {
  if (render_compilado) {
    return render_compilado
  }
  const fuente = readFileSync(RAIZ + RUTA_DEL_COMPONENTE, 'utf8')
  const { descriptor } = parse(fuente, { filename: RUTA_DEL_COMPONENTE })
  const compilado = compileTemplate({ source: descriptor.template.content, filename: RUTA_DEL_COMPONENTE, id: 'barra-carpetas' })
  assert.deepEqual(compilado.errors, [])
  /** Los nombres que el template importa de "vue" ("openBlock as _openBlock"). */
  const importados = /import\s*\{([^}]*)\}\s*from\s*"vue"/.exec(compilado.code)[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+as\s+/, ': '))
  const cuerpo = compilado.code.replace(/import\s*\{[^}]*\}\s*from\s*"vue"/, '').replace('export function render', 'function render')
  return new Function('Vue', 'const { ' + importados.join(', ') + ' } = Vue\n' + cuerpo + '\nreturn render')(Vue)
}

let servidor = null
let estado_de_la_pagina = null
let componente = null
let cargar_catalogo_pagina = null
let cuerpos = { catalogo: {}, indice: {} }
/** Pedidos de catálogo que llegaron al "servidor", y si el catálogo tiene que fallar. */
let pedidos_de_catalogo = 0
let catalogo_caido = false
/** Búsquedas que la página le mandó al "servidor" (cuerpos de `POST recursos/busquedas`), y con qué status contesta. */
let busquedas_enviadas = []
let status_de_busquedas = 200
/** Módulos de la página cargados con el mismo Vite que el componente (comparten estado con él). */
let modulo_api = null
let modulo_buscador = null

/** Catálogo de la página con `carpetas` carpetas de `por_carpeta` videos, más lo que agreguen `extra`. */
function catalogo_largo(carpetas, por_carpeta) {
  const videos = []
  const lista_de_carpetas = []
  for (let c = 0; c < carpetas; c++) {
    lista_de_carpetas.push({ nro: c, nombre: 'Carpeta ' + c })
    for (let i = 0; i < por_carpeta; i++) {
      videos.push({
        codigo: 'T' + c + '.' + i,
        titulo: 'Tema de la carpeta ' + c + ' número ' + i,
        carpeta: c,
        seccion: null,
        orden: c * 100 + i,
        para_que: '',
        cuando_no: '',
        duracion: 60,
        url: 'x',
      })
    }
  }
  return { carpetas: lista_de_carpetas, videos: videos }
}

/** Catálogo con "alfa" en dos videos, "uno" en uno de ellos y "beta" en 120 más. */
function catalogo_de_avisos() {
  const base = { carpeta: 0, seccion: null, para_que: '', cuando_no: '', duracion: 60, url: 'x' }
  const videos = [
    Object.assign({ codigo: 'A0', titulo: 'Alfa uno extra', orden: 0 }, base),
    Object.assign({ codigo: 'A1', titulo: 'Alfa dos', orden: 1 }, base),
  ]
  for (let i = 0; i < 120; i++) {
    videos.push(Object.assign({ codigo: 'B' + i, titulo: 'Beta ' + i, orden: 2 + i }, base))
  }
  return { carpetas: [{ nro: 0, nombre: 'Única' }], videos: videos }
}

/**
 * Monta el componente sobre un catálogo y devuelve lo necesario para manejarlo.
 *
 * @param {{ carpetas: Array, videos: Array }} catalogo
 * @returns {Promise<{ raiz: Nodo, entrada: Nodo, lista: Nodo, desmontar: Function }>}
 */
async function montar(catalogo) {
  cuerpos.catalogo = catalogo
  await cargar_catalogo_pagina()
  // Las carpetas abiertas, para que haya mucho que recorrer en la lista.
  catalogo.carpetas.forEach(function (c) {
    estado_de_la_pagina.abiertas[c.nro] = true
  })
  estado_de_la_pagina.actual = null
  const app = Vue.createRenderer(OPERACIONES).createApp(
    Object.assign({}, componente, {
      ssrRender: undefined,
      setup: undefined,
      render: render_del_cliente(),
      components: { IconoEstado: { props: ['fraccion', 'hecho'], render: () => null } },
    }),
    { oculta: false }
  )
  const raiz = new Nodo('el', 'div')
  app.mount(raiz)
  await microtareas()
  return {
    raiz: raiz,
    entrada: raiz.descendientes().filter((n) => n.etiqueta === 'input')[0],
    lista: raiz.querySelector('lista-carpetas'),
    desmontar: function () {
      app.unmount()
    },
  }
}

/** Texto de lo primero que tiene esa clase, o null si no hay. */
function texto_de(raiz, clase) {
  const nodo = raiz.querySelector(clase)
  return nodo ? nodo.textContent.trim() : null
}

describe('BarraCarpetas montada en un DOM simulado', function () {
  before(async function () {
    documento.activeElement = null
    globalThis.document = documento
    globalThis.Document = DocumentoFalso
    globalThis.ShadowRoot = class ShadowRootFalso {}
    // El catálogo y el índice que "devuelve el servidor": lo que haya en `cuerpos`.
    globalThis.fetch = async function (url, opciones) {
      if (String(url).endsWith('recursos/busquedas')) {
        busquedas_enviadas.push(JSON.parse(opciones.body))
        return { ok: status_de_busquedas < 300, status: status_de_busquedas, text: async () => '{"registrado":true}' }
      }
      const es_indice = String(url).endsWith('recursos/buscar-indice')
      if (!es_indice && String(url).endsWith('recursos/catalogo')) {
        pedidos_de_catalogo++
        if (catalogo_caido) {
          throw new Error('sin red')
        }
      }
      const cuerpo = es_indice ? cuerpos.indice : cuerpos.catalogo
      const texto = JSON.stringify(cuerpo)
      return { ok: true, status: 200, text: async () => texto }
    }
    const { createServer } = await import('vite')
    const vue = (await import('@vitejs/plugin-vue')).default
    servidor = await createServer({
      configFile: false,
      root: RAIZ,
      plugins: [vue()],
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'error',
      optimizeDeps: { noDiscovery: true, include: [] },
    })
    componente = (await servidor.ssrLoadModule('/' + RUTA_DEL_COMPONENTE)).default
    const estado = await servidor.ssrLoadModule('/src/recursos/estado.js')
    estado_de_la_pagina = estado.estado
    cargar_catalogo_pagina = estado.cargar_catalogo
    modulo_api = await servidor.ssrLoadModule('/src/recursos/api.js')
    modulo_buscador = await servidor.ssrLoadModule('/src/recursos/buscador.js')
  })

  after(async function () {
    if (servidor) {
      await servidor.close()
    }
    delete globalThis.document
    delete globalThis.Document
    delete globalThis.ShadowRoot
  })

  describe('BarraCarpetas montada: la lista de carpetas vuelve a donde estaba', function () {
    const NOMBRES = { real: 'reales', sintetico: 'sintéticos' }
    for (const modo of ['real', 'sintetico']) {
      test('al escribir y borrar, el scroll de las carpetas vuelve a donde estaba (eventos ' + NOMBRES[modo] + ')', async function () {
        const m = await montar(catalogo_largo(8, 10))
        // T3.4 está en la fila 1536 a 1576: queda dentro de la ventana 1500 a 1800.
        estado_de_la_pagina.actual = 'T3.4'
        await microtareas()
        m.lista.scrollTop = 1500
        assert.equal(m.lista.scrollTop, 1500)
        await escribir(m.entrada, 'tem', modo)
        await escribir(m.entrada, 'tema', modo)
        assert.equal(m.lista.scrollTop, 0, 'la lista de resultados empieza arriba')
        assert.ok(m.lista.querySelector('vid.res'), 'se están viendo resultados')
        await escribir(m.entrada, '', modo)
        assert.ok(m.lista.querySelector('cab'), 'volvieron las carpetas')
        // El video abierto estaba a la vista: la lista vuelve a donde estaba y no se alinea a un borde.
        assert.equal(m.lista.scrollTop, 1500)
        m.desmontar()
      })

      test('con el video abierto fuera de la vista, queda a la vista al volver (eventos ' + NOMBRES[modo] + ')', async function () {
        const m = await montar(catalogo_largo(8, 10))
        m.lista.scrollTop = 200
        await escribir(m.entrada, 'tema', modo)
        // Mientras se busca se abre un video de la última carpeta (no está en la ventana 200 a 500).
        estado_de_la_pagina.actual = 'T7.9'
        await microtareas()
        await escribir(m.entrada, '', modo)
        const abierto = m.lista.querySelector('vid.sel')
        assert.ok(abierto, 'el video abierto está dibujado')
        assert.ok(abierto.offsetTop >= m.lista.scrollTop && abierto.offsetTop + ALTO_VIDEO <= m.lista.scrollTop + ALTO_VENTANA, 'queda a la vista')
        m.desmontar()
      })
    }

    test('borrar sin haber escrito antes (Escape sobre un texto pegado) no deja la lista fuera de lugar', async function () {
      const m = await montar(catalogo_largo(8, 10))
      await escribir(m.entrada, 'tema', 'real')
      await escribir(m.entrada, '', 'real')
      assert.equal(m.lista.scrollTop, 0)
      m.desmontar()
    })

    for (const modo of ['real', 'sintetico']) {
      test('un espacio suelto no es una búsqueda: la lista de carpetas no se mueve (eventos ' + NOMBRES[modo] + ')', async function () {
        const m = await montar(catalogo_largo(8, 10))
        // T3.4 está a la vista en la ventana 1500 a 1800; si el espacio moviera la lista, se alinearía a un borde (1276).
        estado_de_la_pagina.actual = 'T3.4'
        await microtareas()
        m.lista.scrollTop = 1500
        await escribir(m.entrada, ' ', modo)
        assert.ok(m.lista.querySelector('cab'), 'siguen las carpetas')
        assert.equal(m.lista.scrollTop, 1500)
        await escribir(m.entrada, '  ', modo)
        assert.equal(m.lista.scrollTop, 1500)
        // Después de los espacios se busca de verdad, se borra todo y la lista vuelve a donde estaba.
        await escribir(m.entrada, ' tema', modo)
        assert.ok(m.lista.querySelector('vid.res'), 'se están viendo resultados')
        assert.equal(m.lista.scrollTop, 0)
        await escribir(m.entrada, '', modo)
        assert.equal(m.lista.scrollTop, 1500)
        m.desmontar()
      })
    }
  })

  describe('BarraCarpetas montada: el aviso', function () {
    test('con un solo resultado habla en singular y con varios, en plural', async function () {
      const m = await montar(catalogo_de_avisos())
      await escribir(m.entrada, 'uno beta', 'real')
      assert.equal(m.lista.querySelectorAll('vid.res').length, 1)
      assert.equal(texto_de(m.raiz, 'busq-aviso'), 'Este es el video que más se parece a lo que buscás.')
      assert.equal(texto_de(m.raiz, 'busq-estado'), '1 video que se parece.')
      await escribir(m.entrada, 'alfa beta', 'real')
      assert.equal(m.lista.querySelectorAll('vid.res').length, 2)
      assert.equal(texto_de(m.raiz, 'busq-aviso'), 'Estos son los videos que más se parecen a lo que buscás.')
      m.desmontar()
    })

    test('no se enciende mientras se escribe la última palabra (de una o dos letras): la lista no salta', async function () {
      const m = await montar(catalogo_de_avisos())
      await escribir(m.entrada, 'alfa beta', 'real')
      assert.ok(texto_de(m.raiz, 'busq-aviso'))
      for (const parcial of ['alfa b', 'alfa be']) {
        await escribir(m.entrada, parcial, 'real')
        assert.equal(texto_de(m.raiz, 'busq-aviso'), null, parcial)
      }
      // Con un espacio después la palabra está terminada: el aviso vuelve (la palabra "be" no existe en ningún video).
      await escribir(m.entrada, 'alfa be ', 'real')
      assert.ok(texto_de(m.raiz, 'busq-aviso'))
      // La línea de estado, que no cambia el alto de la lista, sigue diciendo la verdad mientras se escribe.
      await escribir(m.entrada, 'alfa b', 'real')
      assert.match(texto_de(m.raiz, 'busq-estado'), /se parecen?\./)
      m.desmontar()
    })
  })

  describe('BarraCarpetas montada: el foco y el teclado', function () {
    /** El botón "Volver a las carpetas" de la lista vacía. */
    function boton_volver(m) {
      return m.raiz.descendientes().filter((n) => n.etiqueta === 'button' && n.textContent === 'Volver a las carpetas')[0]
    }

    test('"Volver a las carpetas" con el mouse o con el dedo no abre el teclado en pantalla; con el teclado, sí', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await escribir(m.entrada, 'zzzzqx', 'real')
      assert.ok(boton_volver(m))
      const antes = m.entrada.enfocado
      await disparar(boton_volver(m), 'click', { detail: 1 }, 'real')
      assert.equal(m.entrada.value, '', 'se borró lo escrito')
      assert.equal(m.entrada.enfocado, antes, 'un clic no enfoca el buscador')
      assert.ok(m.lista.querySelector('cab'), 'volvieron las carpetas')
      await escribir(m.entrada, 'zzzzqx', 'real')
      await disparar(boton_volver(m), 'click', { detail: 0 }, 'real')
      assert.equal(m.entrada.enfocado, antes + 1, 'Enter o espacio sobre el botón dejan el foco en el buscador')
      m.desmontar()
    })

    test('Escape borra la búsqueda y deja el foco en el buscador, pero no en medio de una composición (IME)', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await escribir(m.entrada, 'tema', 'real')
      // Escape durante una composición: Safari manda isComposing en false y keyCode 229.
      await disparar(m.entrada, 'keydown', { key: 'Escape', isComposing: true, keyCode: 229 }, 'real')
      await disparar(m.entrada, 'keydown', { key: 'Escape', isComposing: false, keyCode: 229 }, 'real')
      assert.ok(m.lista.querySelector('vid.res'), 'la búsqueda sigue')
      await disparar(m.entrada, 'keydown', { key: 'Escape', isComposing: false, keyCode: 27 }, 'real')
      assert.ok(m.lista.querySelector('cab'), 'Escape normal vuelve a las carpetas')
      m.desmontar()
    })

    test('Enter durante una composición no abre el primer resultado', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await escribir(m.entrada, 'tema', 'real')
      estado_de_la_pagina.actual = null
      await disparar(m.entrada, 'keydown', { key: 'Enter', isComposing: false, keyCode: 229 }, 'real')
      assert.equal(estado_de_la_pagina.actual, null)
      m.desmontar()
    })

    test('"Mostrar más": con el teclado o al desaparecer el botón el foco pasa al primer resultado nuevo, y se avisa cuántos se sumaron', async function () {
      const m = await montar(catalogo_largo(10, 10))
      await escribir(m.entrada, 'tema', 'real')
      const boton = () => m.raiz.descendientes().filter((n) => n.etiqueta === 'button' && /^Mostrar \d+ más$/.test(n.textContent.trim()))[0]
      const filas = () => m.lista.querySelectorAll('vid.res')
      assert.equal(filas().length, 30)
      // Con el mouse y el botón todavía ahí: no se mueve el foco, pero se avisa cuántos se sumaron.
      await disparar(boton(), 'click', { detail: 1 }, 'real')
      assert.equal(filas().length, 60)
      assert.equal(filas()[30].enfocado, 0)
      assert.match(texto_de(m.raiz, 'busq-estado'), /Se sumaron 30 resultados\.$/)
      // Con el teclado: el foco va al primer resultado de la tanda nueva.
      await disparar(boton(), 'click', { detail: 0 }, 'real')
      assert.equal(filas().length, 90)
      assert.equal(filas()[60].enfocado, 1)
      // Esa fue la penúltima. La última tanda, con el mouse: el botón desaparece y el foco no puede quedar en el aire.
      assert.ok(boton())
      await disparar(boton(), 'click', { detail: 1 }, 'real')
      assert.equal(filas().length, 100)
      assert.equal(boton(), undefined)
      assert.equal(filas()[90].enfocado, 1)
      assert.match(texto_de(m.raiz, 'busq-estado'), /Se sumaron 10 resultados\.$/)
      m.desmontar()
    })

    test('una búsqueda nueva empieza otra vez con la primera tanda y sin el aviso de lo que se sumó', async function () {
      const m = await montar(catalogo_largo(10, 10))
      await escribir(m.entrada, 'tema', 'real')
      const filas = () => m.lista.querySelectorAll('vid.res')
      const boton = () => m.raiz.descendientes().filter((n) => n.etiqueta === 'button' && /^Mostrar \d+ más$/.test(n.textContent.trim()))[0]
      await disparar(boton(), 'click', { detail: 1 }, 'real')
      assert.equal(filas().length, 60)
      assert.match(texto_de(m.raiz, 'busq-estado'), /Se sumaron 30 resultados\.$/)
      // "tem" trae los mismos 100 videos: sin el reinicio se seguirían viendo 60.
      await escribir(m.entrada, 'tem', 'real')
      assert.equal(filas().length, 30)
      assert.equal(texto_de(m.raiz, 'busq-estado'), '100 videos encontrados.')
      assert.ok(boton(), 'el botón vuelve a ofrecer el resto')
      m.desmontar()
    })
  })

  describe('BarraCarpetas montada: el catálogo no llegó', function () {
    test('"Reintentar" vuelve a pedir el catálogo y, cuando llega, aparecen los resultados', async function () {
      const m = await montar(catalogo_largo(2, 3))
      // El catálogo se cayó: sin buscador, con el error de carga puesto.
      estado_de_la_pagina.buscador = null
      estado_de_la_pagina.error_carga = true
      estado_de_la_pagina.cargando = false
      await escribir(m.entrada, 'tema', 'real')
      assert.match(texto_de(m.raiz, 'vacio'), /No pudimos cargar los videos\. Probá de nuevo\./)
      const reintentar = m.raiz.descendientes().filter((n) => n.etiqueta === 'button' && n.textContent === 'Reintentar')[0]
      assert.ok(reintentar, 'hay un botón Reintentar')
      const antes = pedidos_de_catalogo
      await disparar(reintentar, 'click', { detail: 1 }, 'real')
      await microtareas()
      assert.equal(pedidos_de_catalogo, antes + 1, 'volvió a pedir el catálogo')
      assert.equal(estado_de_la_pagina.error_carga, false)
      assert.ok(m.lista.querySelector('vid.res'), 'aparecen los resultados')
      m.desmontar()
    })

    test('si el catálogo sigue caído, Reintentar vuelve a mostrar el error y no se queda en "Cargando…"', async function () {
      const m = await montar(catalogo_largo(2, 3))
      estado_de_la_pagina.buscador = null
      estado_de_la_pagina.error_carga = true
      estado_de_la_pagina.cargando = false
      await escribir(m.entrada, 'tema', 'real')
      catalogo_caido = true
      try {
        const reintentar = m.raiz.descendientes().filter((n) => n.etiqueta === 'button' && n.textContent === 'Reintentar')[0]
        await disparar(reintentar, 'click', { detail: 1 }, 'real')
        await microtareas()
        assert.equal(estado_de_la_pagina.error_carga, true)
        assert.match(texto_de(m.raiz, 'vacio'), /No pudimos cargar los videos\./)
        assert.doesNotMatch(texto_de(m.raiz, 'vacio'), /Cargando/)
      } finally {
        catalogo_caido = false
      }
      m.desmontar()
    })
  })

  describe('BarraCarpetas montada: el registro de búsquedas (misión busquedas-centro-recursos)', function () {
    /** Cuánto espera la página sin cambios antes de registrar la búsqueda. */
    const ESPERA = 1500
    let reloj = null

    /** Cambia `setTimeout` por un reloj que solo avanza cuando el test lo pide (solo para la espera del registro). */
    function instalar_reloj() {
      const real = { poner: globalThis.setTimeout, sacar: globalThis.clearTimeout }
      const tareas = new Map()
      let n = 0
      globalThis.setTimeout = function (funcion, ms, ...resto) {
        if (ms === ESPERA) {
          const id = 'falso' + ++n
          tareas.set(id, funcion)
          return id
        }
        return real.poner(funcion, ms, ...resto)
      }
      globalThis.clearTimeout = function (id) {
        if (typeof id === 'string' && id.startsWith('falso')) {
          tareas.delete(id)
          return
        }
        return real.sacar(id)
      }
      return {
        pendientes: () => tareas.size,
        /** Pasa la espera: corre todo lo que estaba esperando. */
        async pasar_la_espera() {
          for (const [id, funcion] of Array.from(tareas)) {
            tareas.delete(id)
            funcion()
          }
          await microtareas()
        },
        restaurar() {
          globalThis.setTimeout = real.poner
          globalThis.clearTimeout = real.sacar
        },
      }
    }

    /** Espera a que termine de cargar el índice de transcripciones (el registro no cuenta resultados provisorios). */
    async function esperar_el_indice() {
      for (let i = 0; i < 50 && estado_de_la_pagina.indice_cargando; i++) {
        await microtareas()
      }
    }

    /** Escribe y espera a que el índice esté cargado. */
    async function escribir_y_esperar(m, texto) {
      await escribir(m.entrada, texto, 'real')
      await esperar_el_indice()
      await microtareas()
    }

    /** Lo que el buscador devuelve ahora para `texto`. */
    function lo_que_encuentra(texto) {
      return modulo_buscador.buscar(estado_de_la_pagina.buscador, texto)
    }

    beforeEach(function () {
      busquedas_enviadas = []
      status_de_busquedas = 200
      modulo_api.reactivar_registro_de_busquedas()
      reloj = instalar_reloj()
    })

    afterEach(function () {
      reloj.restaurar()
      estado_de_la_pagina.usuario = null
      modulo_api.reactivar_registro_de_busquedas()
    })

    test('escribir una consulta y esperar manda UN evento con resultados, primero y completo', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'tem')
      await escribir_y_esperar(m, 'tema')
      assert.equal(reloj.pendientes(), 1, 'una sola búsqueda esperando, no una por tecla')
      await reloj.pasar_la_espera()
      const esperado = lo_que_encuentra('tema')
      assert.equal(busquedas_enviadas.length, 1)
      const e = busquedas_enviadas[0]
      assert.match(e.evento, /^[A-Za-z0-9]{8,40}$/)
      assert.equal(e.consulta, 'tema')
      assert.equal(e.resultados, 6)
      assert.equal(e.resultados, m.lista.querySelectorAll('vid.res').length, 'lo mismo que ve la persona')
      assert.equal(e.primero, esperado.resultados[0].codigo)
      assert.equal(e.completo, esperado.completo)
      assert.equal('abrio' in e, false)
      await reloj.pasar_la_espera()
      assert.equal(busquedas_enviadas.length, 1, 'no se repite')
      m.desmontar()
    })

    test('una consulta sin resultados se registra con resultados 0 y primero null', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'zzzzqx')
      await reloj.pasar_la_espera()
      assert.equal(busquedas_enviadas.length, 1)
      assert.equal(busquedas_enviadas[0].resultados, 0)
      assert.equal(busquedas_enviadas[0].primero, null)
      assert.equal(typeof busquedas_enviadas[0].completo, 'boolean')
      m.desmontar()
    })

    test('un clic en un resultado manda el evento con abrio y posicion', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'tema')
      const esperado = lo_que_encuentra('tema')
      await disparar(m.lista.querySelectorAll('vid.res')[2], 'click', { detail: 1 }, 'real')
      assert.equal(busquedas_enviadas.length, 1, 'salió sin esperar')
      assert.equal(busquedas_enviadas[0].abrio, esperado.resultados[2].codigo)
      assert.equal(busquedas_enviadas[0].posicion, 3)
      assert.equal(busquedas_enviadas[0].consulta, 'tema')
      assert.equal(busquedas_enviadas[0].resultados, 6)
      assert.equal(reloj.pendientes(), 0)
      // Otro clic en la misma búsqueda no suma.
      await disparar(m.lista.querySelectorAll('vid.res')[0], 'click', { detail: 1 }, 'real')
      assert.equal(busquedas_enviadas.length, 1)
      m.desmontar()
    })

    test('el clic después de que salió el evento sin clic manda otro con el MISMO evento', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'tema')
      await reloj.pasar_la_espera()
      await disparar(m.lista.querySelectorAll('vid.res')[0], 'click', { detail: 1 }, 'real')
      assert.equal(busquedas_enviadas.length, 2)
      assert.equal(busquedas_enviadas[0].evento, busquedas_enviadas[1].evento)
      assert.equal(busquedas_enviadas[1].abrio, lo_que_encuentra('tema').resultados[0].codigo)
      assert.equal(busquedas_enviadas[1].posicion, 1)
      m.desmontar()
    })

    test('Enter abre el primer resultado y lo registra como posicion 1', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'tema')
      await disparar(m.entrada, 'keydown', { key: 'Enter', isComposing: false, keyCode: 13 }, 'real')
      assert.equal(busquedas_enviadas.length, 1)
      assert.equal(busquedas_enviadas[0].abrio, lo_que_encuentra('tema').resultados[0].codigo)
      assert.equal(busquedas_enviadas[0].posicion, 1)
      assert.equal(estado_de_la_pagina.actual, busquedas_enviadas[0].abrio, 'el video se abrió igual')
      m.desmontar()
    })

    test('un resultado más abajo de "Mostrar más" lleva su posición real en la lista', async function () {
      const m = await montar(catalogo_largo(10, 10))
      await escribir_y_esperar(m, 'tema')
      const boton = m.raiz.descendientes().filter((n) => n.etiqueta === 'button' && /^Mostrar \d+ más$/.test(n.textContent.trim()))[0]
      await disparar(boton, 'click', { detail: 1 }, 'real')
      await disparar(m.lista.querySelectorAll('vid.res')[44], 'click', { detail: 1 }, 'real')
      assert.equal(busquedas_enviadas.length, 1)
      assert.equal(busquedas_enviadas[0].posicion, 45)
      assert.equal(busquedas_enviadas[0].resultados, 100)
      m.desmontar()
    })

    test('un clic en un video de las carpetas (sin buscar) no registra nada', async function () {
      const m = await montar(catalogo_largo(2, 3))
      const video = m.lista.querySelectorAll('vid')[0]
      assert.ok(video, 'hay videos en las carpetas')
      await disparar(video, 'click', { detail: 1 }, 'real')
      await reloj.pasar_la_espera()
      assert.deepEqual(busquedas_enviadas, [])
      m.desmontar()
    })

    test('sin nada escrito no emite nada; escribir y borrar antes de la espera tampoco', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await reloj.pasar_la_espera()
      assert.deepEqual(busquedas_enviadas, [])
      await escribir_y_esperar(m, 'tema')
      assert.equal(reloj.pendientes(), 1)
      await escribir_y_esperar(m, '')
      assert.equal(reloj.pendientes(), 0, 'borrar descarta lo pendiente')
      await reloj.pasar_la_espera()
      assert.deepEqual(busquedas_enviadas, [])
      await escribir_y_esperar(m, '   ')
      await reloj.pasar_la_espera()
      assert.deepEqual(busquedas_enviadas, [])
      m.desmontar()
    })

    test('Escape descarta la búsqueda pendiente', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'tema')
      await disparar(m.entrada, 'keydown', { key: 'Escape', isComposing: false, keyCode: 27 }, 'real')
      await reloj.pasar_la_espera()
      assert.deepEqual(busquedas_enviadas, [])
      m.desmontar()
    })

    test('al desmontar el componente se descarta lo pendiente', async function () {
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'tema')
      assert.equal(reloj.pendientes(), 1)
      m.desmontar()
      assert.equal(reloj.pendientes(), 0)
      await reloj.pasar_la_espera()
      assert.deepEqual(busquedas_enviadas, [])
    })

    test('una consulta con datos personales no se registra (ni sale el clic)', async function () {
      const m = await montar(catalogo_largo(2, 3))
      for (const texto of ['tema 3444622139', 'tema a@b.com', 'tema 11 5555 1234']) {
        await escribir_y_esperar(m, texto)
        assert.equal(reloj.pendientes(), 0, texto)
        await reloj.pasar_la_espera()
        const fila = m.lista.querySelectorAll('vid.res')[0]
        if (fila) {
          await disparar(fila, 'click', { detail: 1 }, 'real')
        }
      }
      assert.deepEqual(busquedas_enviadas, [])
      m.desmontar()
    })

    test('con una sesión de soporte (solo lectura) no registra nada', async function () {
      estado_de_la_pagina.usuario = { id: 1, nombre: 'Soporte', solo_lectura: true }
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'tema')
      assert.equal(reloj.pendientes(), 0)
      await reloj.pasar_la_espera()
      await disparar(m.lista.querySelectorAll('vid.res')[0], 'click', { detail: 1 }, 'real')
      assert.deepEqual(busquedas_enviadas, [])
      assert.ok(m.lista.querySelector('vid.res'), 'el buscador anda igual')
      m.desmontar()
    })

    test('con un cliente común (sesión que no es de soporte) sí registra', async function () {
      estado_de_la_pagina.usuario = { id: 2, nombre: 'Dueño', solo_lectura: false }
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'tema')
      await reloj.pasar_la_espera()
      assert.equal(busquedas_enviadas.length, 1)
      m.desmontar()
    })

    test('mientras el índice de transcripciones carga no registra, y al llegar registra lo definitivo', async function () {
      const m = await montar(catalogo_largo(2, 3))
      estado_de_la_pagina.indice_cargando = true
      await escribir(m.entrada, 'tema', 'real')
      assert.equal(reloj.pendientes(), 0, 'los resultados son provisorios')
      estado_de_la_pagina.indice_cargando = false
      await microtareas()
      assert.equal(reloj.pendientes(), 1)
      await reloj.pasar_la_espera()
      assert.equal(busquedas_enviadas.length, 1)
      m.desmontar()
    })

    test('con el índice de transcripciones caído (sin llegar) no registra: los resultados serían solo por título', async function () {
      const m = await montar(catalogo_largo(2, 3))
      estado_de_la_pagina.indice = null
      estado_de_la_pagina.indice_cargando = false
      estado_de_la_pagina.indice_fallo = Date.now()
      await escribir(m.entrada, 'tema', 'real')
      await microtareas()
      assert.equal(reloj.pendientes(), 0)
      await reloj.pasar_la_espera()
      assert.equal(busquedas_enviadas.length, 0)
      estado_de_la_pagina.indice_fallo = 0
      m.desmontar()
    })

    test('si el servidor contesta 404 (API vieja) el buscador sigue mostrando resultados y se apaga solo', async function () {
      status_de_busquedas = 404
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'tema')
      await reloj.pasar_la_espera()
      await microtareas()
      assert.equal(busquedas_enviadas.length, 1, 'lo intentó una vez')
      assert.equal(modulo_api.registro_de_busquedas_esta_apagado(), true)
      assert.equal(m.lista.querySelectorAll('vid.res').length, 6, 'el buscador sigue mostrando los resultados')
      assert.equal(texto_de(m.raiz, 'busq-estado'), '6 videos encontrados.')
      // Otra búsqueda en la misma visita ya no sale.
      await escribir_y_esperar(m, 'carpeta')
      await reloj.pasar_la_espera()
      await disparar(m.lista.querySelectorAll('vid.res')[0], 'click', { detail: 1 }, 'real')
      await microtareas()
      assert.equal(busquedas_enviadas.length, 1, 'no volvió a pegarle a la API')
      assert.ok(m.lista.querySelector('vid.res'))
      m.desmontar()
    })

    test('si el envío revienta (sin red) el buscador sigue andando', async function () {
      const fetch_de_la_prueba = globalThis.fetch
      globalThis.fetch = async function (url, opciones) {
        if (String(url).endsWith('recursos/busquedas')) {
          throw new TypeError('Failed to fetch')
        }
        return fetch_de_la_prueba(url, opciones)
      }
      try {
        const m = await montar(catalogo_largo(2, 3))
        await escribir_y_esperar(m, 'tema')
        await reloj.pasar_la_espera()
        await disparar(m.lista.querySelectorAll('vid.res')[1], 'click', { detail: 1 }, 'real')
        await microtareas()
        assert.equal(estado_de_la_pagina.actual, lo_que_encuentra('tema').resultados[1].codigo)
        assert.equal(m.lista.querySelectorAll('vid.res').length, 6)
        m.desmontar()
      } finally {
        globalThis.fetch = fetch_de_la_prueba
      }
    })

    test('un 500 no apaga el registro: la búsqueda siguiente sale', async function () {
      status_de_busquedas = 500
      const m = await montar(catalogo_largo(2, 3))
      await escribir_y_esperar(m, 'tema')
      await reloj.pasar_la_espera()
      await microtareas()
      assert.equal(modulo_api.registro_de_busquedas_esta_apagado(), false)
      status_de_busquedas = 200
      await escribir_y_esperar(m, 'carpeta')
      await reloj.pasar_la_espera()
      assert.equal(busquedas_enviadas.length, 2)
      assert.equal(busquedas_enviadas[1].consulta, 'carpeta')
      m.desmontar()
    })
  })
})
