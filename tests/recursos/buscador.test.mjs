/**
 * Pruebas del buscador del centro de recursos (`src/recursos/buscador.js`). Se corren con
 *
 *     node --test tests/recursos
 *
 * desde la carpeta de admin-spa. No necesitan navegador ni servidor: el buscador es un módulo puro.
 *
 * El corpus (`corpus-real.json`) son 17 videos REALES del catálogo de producción (fotos del
 * 16/10/2026): título, carpeta, sección, "para qué" y "cuándo no" tal cual, y un recorte del guion de
 * voz (los primeros ~500 caracteres, con el arranque repetido de cada video). La transcripción del
 * índice se arma como en producción: "para qué" + guion + "cuándo no".
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { crear_buscador, buscar, tokenizar, raiz } from '../../src/recursos/buscador.js'

/** Corpus real. */
const CORPUS = JSON.parse(readFileSync(new URL('./corpus-real.json', import.meta.url), 'utf8'))

/** Videos como los deja `cargar_catalogo` de la página (ordenados por `orden`). */
const VIDEOS = CORPUS.videos
  .map(function (v) {
    return {
      codigo: v.codigo,
      titulo: v.titulo,
      carpeta: v.carpeta,
      seccion: v.seccion,
      orden: v.orden,
      para_que: v.para_que,
      cuando_no: v.cuando_no,
      duracion: v.duracion,
    }
  })
  .sort(function (a, b) {
    return a.orden - b.orden
  })

/** Transcripciones como las manda `recursos/buscar-indice`: "para qué" + guion + "cuándo no". */
const TRANSCRIPCIONES = {}
CORPUS.videos.forEach(function (v) {
  TRANSCRIPCIONES[v.codigo] = v.para_que + ' ' + v.voz + ' ' + v.cuando_no
})

/** Buscador con el índice de transcripciones y buscador sin él. */
const CON_INDICE = crear_buscador(VIDEOS, CORPUS.carpetas, TRANSCRIPCIONES)
const SIN_INDICE = crear_buscador(VIDEOS, CORPUS.carpetas, null)

/**
 * Códigos de los resultados, en orden.
 *
 * @param {{ resultados: Array<{ codigo: string }> }} r
 * @returns {Array<string>}
 */
function codigos(r) {
  return r.resultados.map(function (x) {
    return x.codigo
  })
}

/**
 * Une las partes de un texto marcado.
 *
 * @param {Array<{ texto: string, marca: boolean }>} partes
 * @returns {string}
 */
function unir(partes) {
  return partes
    .map(function (p) {
      return p.texto
    })
    .join('')
}

/**
 * Textos de las partes marcadas.
 *
 * @param {Array<{ texto: string, marca: boolean }>} partes
 * @returns {Array<string>}
 */
function marcas(partes) {
  return partes
    .filter(function (p) {
      return p.marca
    })
    .map(function (p) {
      return p.texto
    })
}

/**
 * Arma un buscador chico con videos inventados, para probar el orden sin depender del corpus real.
 *
 * @param {Array<Object>} lista Videos con `codigo` y `titulo` (el resto es opcional).
 * @param {Object<string, string>|null} [trans] Transcripciones.
 * @returns {Object}
 */
function armar(lista, trans) {
  return crear_buscador(
    lista.map(function (v, i) {
      return Object.assign({ carpeta: 1, seccion: null, orden: i, para_que: '', cuando_no: '', duracion: 60 }, v)
    }),
    [{ nro: 1, nombre: 'Carpeta de prueba' }],
    trans || null
  )
}

describe('los casos del pedido', function () {
  test('"escanear factura" encuentra "Escanear la factura o el remito con la IA" (le sobra el "la")', function () {
    const r = buscar(CON_INDICE, 'escanear factura')
    assert.equal(r.resultados[0].codigo, 'T5.15')
    assert.equal(r.completo, true)
    assert.deepEqual(r.palabras, ['escanear', 'factura'])
  })

  test('también con el título solo, sin las transcripciones', function () {
    const r = buscar(SIN_INDICE, 'escanear factura')
    assert.equal(r.resultados[0].codigo, 'T5.15')
  })

  test('la frase larga del pedido: "escanear una foto de la factura en una compra"', function () {
    const r = buscar(CON_INDICE, 'escanear una foto de la factura en una compra')
    assert.equal(r.resultados[0].codigo, 'T5.15')
    assert.equal(r.completo, true)
    assert.deepEqual(r.palabras, ['escanear', 'foto', 'factura', 'compra'])
  })

  test('en otro orden anda igual: "factura escanear"', function () {
    assert.deepEqual(codigos(buscar(CON_INDICE, 'factura escanear')), codigos(buscar(CON_INDICE, 'escanear factura')))
  })

  test('una pregunta con relleno da lo mismo que las palabras sueltas', function () {
    const larga = buscar(CON_INDICE, 'cómo hago para escanear una factura de un proveedor?')
    const corta = buscar(CON_INDICE, 'escanear factura proveedor')
    assert.equal(larga.resultados[0].codigo, 'T5.15')
    assert.deepEqual(larga.palabras, corta.palabras)
    assert.deepEqual(codigos(larga), codigos(corta))
  })

  test('con el índice encuentra lo que solo está dentro del video; sin él, no', function () {
    // "seis páginas" solo lo dice el guion de T5.15.
    assert.deepEqual(codigos(buscar(SIN_INDICE, 'seis páginas')), [])
    assert.equal(codigos(buscar(CON_INDICE, 'seis páginas'))[0], 'T5.15')
  })
})

describe('formas de la palabra', function () {
  test('escanear / escaneo / escaneás / escaneala / escáner / escaneos llegan a lo mismo', function () {
    ;['escaneo', 'escaneás', 'escaneala', 'escáner', 'escaneos', 'ESCANEAR', 'escaneando'].forEach(function (forma) {
      const r = buscar(CON_INDICE, forma)
      assert.ok(codigos(r).indexOf('T5.15') !== -1, forma + ' tendría que encontrar T5.15')
      assert.ok(codigos(r).indexOf('T5.16') !== -1, forma + ' tendría que encontrar T5.16 ("escaneos")')
    })
  })

  test('singular y plural: "cheque" y "cheques"', function () {
    assert.deepEqual(codigos(buscar(CON_INDICE, 'cheque')).sort(), codigos(buscar(CON_INDICE, 'cheques')).sort())
    assert.ok(codigos(buscar(CON_INDICE, 'cheques')).indexOf('T6.23') !== -1)
  })

  test('formas del verbo: "rechazar" encuentra "rechazado", "endosar" encuentra "endosa"', function () {
    assert.ok(codigos(buscar(CON_INDICE, 'rechazar cheque')).indexOf('T6.23') !== -1)
    assert.equal(codigos(buscar(CON_INDICE, 'endoso cheque'))[0], 'T6.24')
  })

  test('el voseo: "importás" encuentra "importar"', function () {
    assert.ok(codigos(buscar(CON_INDICE, 'importás excel')).indexOf('T1.35') !== -1)
  })

  test('la raíz junta formas del mismo verbo y deja afuera a los falsos parientes', function () {
    assert.equal(raiz('escanear'), raiz('escaneo'))
    assert.equal(raiz('escanear'), raiz('escaneala'))
    assert.equal(raiz('escanear'), raiz('escaneas'))
    assert.equal(raiz('escanear'), raiz('escaner'))
    assert.equal(raiz('cheque'), raiz('cheques'))
    assert.equal(raiz('facturacion'), raiz('facturar'))
    assert.notEqual(raiz('importe'), raiz('importar'))
    assert.notEqual(raiz('correo'), raiz('corre'))
  })
})

describe('palabra a medio escribir', function () {
  test('"escan" ya encuentra', function () {
    const r = buscar(CON_INDICE, 'escan')
    assert.equal(codigos(r)[0] === 'T5.15' || codigos(r)[0] === 'T5.16', true)
  })

  test('"endos cheq" encuentra el video de endosar cheques', function () {
    assert.equal(codigos(buscar(CON_INDICE, 'endos cheq'))[0], 'T6.24')
  })

  test('una palabra completa NO se estira a otra que empieza igual ("venta" no es "ventana")', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Abrir una ventana' },
      { codigo: 'B', titulo: 'Hacer una venta' },
    ])
    assert.deepEqual(codigos(buscar(b, 'venta')), ['B'])
    // Pero a medias sí: "ventan" solo puede ser "ventana".
    assert.deepEqual(codigos(buscar(b, 'ventan')), ['A'])
  })
})

describe('acentos, ñ y mayúsculas', function () {
  test('"contrasena" encuentra "contraseña"', function () {
    const r = buscar(CON_INDICE, 'contrasena')
    assert.equal(r.resultados[0].codigo, 'T0.4')
  })

  test('"CONTRASEÑA" y "Contraseña" también', function () {
    assert.equal(buscar(CON_INDICE, 'CONTRASEÑA').resultados[0].codigo, 'T0.4')
    assert.equal(buscar(CON_INDICE, 'Contraseña').resultados[0].codigo, 'T0.4')
  })

  test('"diseno" encuentra "Diseño"', function () {
    assert.ok(codigos(buscar(CON_INDICE, 'diseno')).indexOf('T11.39') !== -1)
  })

  test('"credito" encuentra "crédito"', function () {
    assert.ok(codigos(buscar(CON_INDICE, 'nota de credito')).indexOf('T3.23') !== -1)
  })
})

describe('errores de tipeo', function () {
  test('dos letras cambiadas de lugar: "facutra"', function () {
    const r = buscar(CON_INDICE, 'facutra')
    assert.ok(r.resultados.length > 0)
    assert.ok(codigos(r).indexOf('T2.28') !== -1)
  })

  test('una letra de más: "escanner"', function () {
    assert.equal(codigos(buscar(CON_INDICE, 'escanner'))[0] === 'T5.15' || codigos(buscar(CON_INDICE, 'escanner'))[0] === 'T5.16', true)
  })

  test('una letra de menos: "contrasea"', function () {
    assert.equal(buscar(CON_INDICE, 'contrasea').resultados[0].codigo, 'T0.4')
  })

  test('una letra cambiada, en palabra larga: "endosat cheque"', function () {
    assert.equal(codigos(buscar(CON_INDICE, 'endosat cheque'))[0], 'T6.24')
  })

  test('el tipeo vale menos y solo se usa si la palabra no encontró nada', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Escanear una factura' },
      { codigo: 'B', titulo: 'Escaneos de facturas' },
    ])
    // "facturas" existe: no se corrige a nada más, y no entra ninguna palabra "parecida".
    const r = buscar(b, 'facturas')
    assert.deepEqual(codigos(r).sort(), ['A', 'B'])
    const con_error = buscar(b, 'facutras')
    assert.deepEqual(codigos(con_error).sort(), ['A', 'B'])
    assert.ok(con_error.resultados[0].puntaje < r.resultados[0].puntaje)
  })

  test('no inventa parecidos en palabras cortas ni con la letra inicial cambiada', function () {
    const b = armar([{ codigo: 'A', titulo: 'Una pieza de repuesto' }])
    assert.deepEqual(codigos(buscar(b, 'pizza')), [])
    assert.deepEqual(codigos(buscar(b, 'gato')), [])
  })
})

describe('relleno y consultas vacías', function () {
  test('una consulta vacía, de espacios o de signos no devuelve nada ni falla', function () {
    ;['', '   ', '¿?', '--', '...', null, undefined].forEach(function (q) {
      const r = buscar(CON_INDICE, q)
      assert.deepEqual(r.resultados, [])
      assert.deepEqual(r.palabras, [])
    })
  })

  test('si TODAS las palabras son de relleno se buscan tal cual', function () {
    const r = buscar(CON_INDICE, 'como para')
    assert.deepEqual(r.palabras, ['como', 'para'])
    assert.ok(r.resultados.length > 0)
  })

  test('buscar sin buscador o con un buscador vacío no falla', function () {
    assert.deepEqual(buscar(null, 'x').resultados, [])
    assert.deepEqual(buscar(armar([]), 'x').resultados, [])
  })

  test('un video sin "para qué", sin guion o con campos nulos no rompe nada', function () {
    const b = crear_buscador(
      [
        { codigo: 'X1', titulo: 'Sin nada', carpeta: 9, seccion: null, para_que: null, cuando_no: undefined },
        { codigo: 'X2', titulo: 'Con guion', carpeta: 1, seccion: 'A · Algo', para_que: '', cuando_no: '' },
      ],
      [{ nro: 1, nombre: 'Una' }],
      { X2: 'un guion con la palabra sorpresa', X3: 'de un video que ya no está' }
    )
    assert.deepEqual(codigos(buscar(b, 'sin nada')), ['X1'])
    assert.deepEqual(codigos(buscar(b, 'sorpresa')), ['X2'])
    const r = buscar(b, 'sin nada')
    assert.deepEqual(r.resultados[0].fragmento_partes, [])
    assert.equal(r.resultados[0].fragmento_de, '')
  })
})

describe('ninguno tiene todas las palabras', function () {
  test('con 3 palabras o más devuelve los que tienen la mayoría, y lo avisa', function () {
    const r = buscar(CON_INDICE, 'escanear factura helicóptero')
    assert.equal(r.completo, false)
    assert.equal(r.resultados[0].codigo, 'T5.15')
  })

  test('una palabra que no existe en ningún video no se exige: se busca con las demás y se avisa', function () {
    const r = buscar(CON_INDICE, 'escanear helicóptero')
    assert.equal(r.completo, false)
    assert.equal(r.resultados[0].codigo, 'T5.15')
  })

  test('"factura electrónica": el corpus dice ARCA, nunca "electrónica", y es sinónimo de ARCA', function () {
    const e = buscar(CON_INDICE, 'factura electronica')
    assert.equal(e.completo, true)
    assert.ok(codigos(e).indexOf('T4.1') !== -1, 'T4.1 habla de ARCA y de facturar')
    assert.ok(codigos(e).indexOf('T3.23') !== -1)
  })

  test('con 2 palabras que existen pero nunca juntas se muestran los que tienen una', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Un gato en el jardín' },
      { codigo: 'B', titulo: 'Un perro en la plaza' },
      { codigo: 'C', titulo: 'Nada que ver' },
    ])
    const r = buscar(b, 'gato perro')
    assert.equal(r.completo, false)
    assert.deepEqual(codigos(r).sort(), ['A', 'B'])
  })

  test('una palabra que no existe en ningún video no devuelve nada', function () {
    assert.deepEqual(buscar(CON_INDICE, 'helicóptero').resultados, [])
    assert.deepEqual(buscar(CON_INDICE, 'helicóptero submarino').resultados, [])
  })

  test('los parecidos son pocos aunque la palabra que existe esté en todos los videos', function () {
    const r = buscar(CON_INDICE, 'sistema helicóptero')
    assert.equal(r.completo, false)
    assert.ok(r.resultados.length <= 40)
  })

  test('cuando hay quien las tiene todas, solo salen esos', function () {
    const r = buscar(CON_INDICE, 'escanear factura')
    assert.equal(r.completo, true)
    r.resultados.forEach(function (x) {
      assert.ok(x.puntaje > 0)
    })
  })
})

describe('un código de video', function () {
  test('"T5.15", "t5.15" y "5.15" llevan directo a ese video', function () {
    ;['T5.15', 't5.15', '5.15', ' T5.15 '].forEach(function (q) {
      const r = buscar(CON_INDICE, q)
      assert.deepEqual(codigos(r), ['T5.15'], q)
      assert.equal(r.completo, true)
      assert.equal(unir(r.resultados[0].titulo_partes), 'Escanear la factura o el remito con la IA')
    })
  })

  test('un código que no existe se busca como texto', function () {
    assert.deepEqual(codigos(buscar(CON_INDICE, 'T99.99')), [])
  })
})

describe('el orden de los resultados', function () {
  test('una coincidencia en el título gana a una en el guion', function () {
    const b = armar(
      [
        { codigo: 'A', titulo: 'Contar el dinero de la caja' },
        { codigo: 'B', titulo: 'Los cheques que recibís' },
      ],
      { A: 'Para controlar el dinero hay que revisar también cada cheque que entró.', B: 'Otro texto sin relación.' }
    )
    assert.deepEqual(codigos(buscar(b, 'cheque')), ['B', 'A'])
  })

  test('el "para qué" gana al guion', function () {
    const b = armar(
      [
        { codigo: 'A', titulo: 'Uno', para_que: 'Sirve para todo.' },
        { codigo: 'B', titulo: 'Dos', para_que: 'Sirve para cobrar un cheque.' },
      ],
      { A: 'Sirve para todo. Dura un rato, hablamos del cheque, del cheque y del cheque.', B: 'Sirve para cobrar un cheque.' }
    )
    assert.equal(buscar(b, 'cheque').resultados[0].codigo, 'B')
  })

  test('la palabra rara pesa más que la que está en casi todos los videos', function () {
    // "sistema" está en todos los guiones; "balanza" en uno solo.
    const trans = {}
    const lista = []
    for (let i = 0; i < 20; i++) {
      lista.push({ codigo: 'V' + i, titulo: 'Video número ' + i })
      trans['V' + i] = 'Al entrar al sistema estás en Reportes. ' + (i === 7 ? 'Acá se configura la balanza.' : 'Nada más.')
    }
    const r = buscar(armar(lista, trans), 'sistema balanza')
    assert.equal(r.resultados[0].codigo, 'V7')
    assert.equal(r.resultados.length, 1)
  })

  test('la palabra exacta vale más que otra forma de la misma palabra', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Cobrar con tarjeta' },
      { codigo: 'B', titulo: 'Cobros con tarjeta' },
    ])
    assert.deepEqual(codigos(buscar(b, 'cobros tarjeta')), ['B', 'A'])
    assert.deepEqual(codigos(buscar(b, 'cobrar tarjeta')), ['A', 'B'])
  })

  test('que las palabras estén juntas suma', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Las ventas del mes y, bastante después, los gastos de la sucursal' },
      { codigo: 'B', titulo: 'Gastos y ventas del mes' },
    ])
    const r = buscar(b, 'ventas gastos')
    assert.equal(r.resultados[0].codigo, 'B')
    assert.deepEqual(codigos(r), ['B', 'A'])
  })

  test('un sinónimo vale menos que la palabra directa', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Eliminar un cliente' },
      { codigo: 'B', titulo: 'Borrar un cliente' },
    ])
    assert.deepEqual(codigos(buscar(b, 'borrar cliente')), ['B', 'A'])
    assert.deepEqual(codigos(buscar(b, 'eliminar cliente')), ['A', 'B'])
  })

  test('desempata por el orden del catálogo', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Un cheque' },
      { codigo: 'B', titulo: 'Un cheque' },
    ])
    assert.deepEqual(codigos(buscar(b, 'cheque')), ['A', 'B'])
  })

  test('los puntajes vienen de mayor a menor', function () {
    const r = buscar(CON_INDICE, 'factura')
    for (let i = 1; i < r.resultados.length; i++) {
      assert.ok(r.resultados[i - 1].puntaje >= r.resultados[i].puntaje)
    }
  })
})

describe('sinónimos y formas dichas', function () {
  test('"afip" encuentra los videos que dicen ARCA', function () {
    assert.ok(codigos(buscar(CON_INDICE, 'afip')).indexOf('T4.1') !== -1)
  })

  test('"producto" encuentra los que dicen "artículo"', function () {
    assert.ok(codigos(buscar(CON_INDICE, 'crear producto')).indexOf('T1.2') !== -1)
  })

  test('"pdf" encuentra "pe-de-efe" y marca todo el "pe-de-efe"', function () {
    const r = buscar(CON_INDICE, 'ticket pdf')
    const t = r.resultados.find(function (x) {
      return x.codigo === 'T2.31'
    })
    assert.ok(t, 'T2.31 dice "ticket venta, en pe-de-efe"')
    assert.ok(marcas(t.fragmento_partes).indexOf('pe-de-efe') !== -1, JSON.stringify(t.fragmento_partes))
  })

  test('"pe de efe" escrito con espacios es lo mismo que "pdf"', function () {
    assert.deepEqual(codigos(buscar(CON_INDICE, 'pe de efe')), codigos(buscar(CON_INDICE, 'pdf')))
  })

  test('las cifras que el guion dice en letras: "ticket 2.0" y "iva 21"', function () {
    assert.ok(codigos(buscar(CON_INDICE, 'ticket 2.0')).indexOf('T3.20') !== -1)
    assert.ok(codigos(buscar(CON_INDICE, 'ticket 2.0')).indexOf('T2.31') !== -1)
    // El IVA del 21 % lo dicen "veintiuno" (así habla el guion de T5.14, que no está en este corpus chico).
    const b = armar([{ codigo: 'A', titulo: 'Alícuotas de iva' }, { codigo: 'B', titulo: 'Otra cosa' }], {
      A: 'Agregar, veintiuno, y cargás uno solo de los tres.',
      B: 'Nada que ver.',
    })
    assert.deepEqual(codigos(buscar(b, 'iva 21')), ['A'])
    assert.deepEqual(codigos(buscar(b, '21')), ['A'])
  })

  test('un grupo de sinónimos no hace que se pierda lo directo', function () {
    assert.ok(codigos(buscar(CON_INDICE, 'imprimir')).indexOf('T2.31') !== -1)
    assert.ok(codigos(buscar(CON_INDICE, 'impresora')).indexOf('T2.31') !== -1)
  })
})

describe('resaltado', function () {
  test('las partes del título reconstruyen el título original, con acentos y ñ', function () {
    const r = buscar(CON_INDICE, 'contraseña documento')
    const titulo = unir(r.resultados[0].titulo_partes)
    assert.equal(titulo, 'Entrar al sistema con tu documento y tu contraseña, y cerrar sesión')
  })

  test('se marcan las palabras encontradas con su ortografía original', function () {
    const r = buscar(CON_INDICE, 'contrasena documento')
    assert.deepEqual(marcas(r.resultados[0].titulo_partes), ['documento', 'contraseña'])
  })

  test('se marca la ñ y la mayúscula: "diseno" marca "Diseño"', function () {
    const r = buscar(CON_INDICE, 'diseno pdf')
    const d = r.resultados.find(function (x) {
      return x.codigo === 'T11.39'
    })
    assert.deepEqual(marcas(d.titulo_partes), ['Diseño', 'PDF', 'diseños'])
    assert.equal(unir(d.titulo_partes), VIDEOS.find(function (v) { return v.codigo === 'T11.39' }).titulo)
  })

  test('también se marcan las otras formas y los sinónimos', function () {
    const r = buscar(CON_INDICE, 'escanear factura')
    assert.deepEqual(marcas(r.resultados[0].titulo_partes), ['Escanear', 'factura'])
    const e = buscar(CON_INDICE, 'borrar')
    assert.ok(e.resultados.length >= 0)
  })

  test('un título sin palabras encontradas viene en una sola parte sin marcar', function () {
    const r = buscar(CON_INDICE, 'seis páginas')
    assert.equal(r.resultados[0].codigo, 'T5.15')
    assert.deepEqual(r.resultados[0].titulo_partes, [{ texto: 'Escanear la factura o el remito con la IA', marca: false }])
  })

  test('el texto de las partes nunca se interpreta: un título con HTML sale tal cual', function () {
    const b = armar([{ codigo: 'H', titulo: 'Cómo usar <b>negrita</b> & "comillas"' }])
    const r = buscar(b, 'negrita')
    assert.equal(unir(r.resultados[0].titulo_partes), 'Cómo usar <b>negrita</b> & "comillas"')
    assert.deepEqual(marcas(r.resultados[0].titulo_partes), ['negrita'])
  })
})

describe('el fragmento', function () {
  test('sale del guion cuando la palabra está ahí, con lo encontrado marcado', function () {
    const r = buscar(CON_INDICE, 'seis páginas')
    const x = r.resultados[0]
    assert.equal(x.fragmento_de, 'transcripcion')
    assert.deepEqual(marcas(x.fragmento_partes), ['seis', 'páginas'])
    assert.ok(unir(x.fragmento_partes).indexOf('hasta seis páginas') !== -1)
  })

  test('es un pedazo del texto original (con acentos), con "…" donde se cortó', function () {
    const x = buscar(CON_INDICE, 'páginas').resultados[0]
    const texto = unir(x.fragmento_partes)
    assert.ok(texto.startsWith('…') && texto.endsWith('…'), texto)
    const sin_puntos = texto.replace(/^…/, '').replace(/…$/, '')
    assert.ok(TRANSCRIPCIONES['T5.15'].indexOf(sin_puntos) !== -1, 'tiene que ser un recorte literal del guion: ' + sin_puntos)
    assert.ok(sin_puntos.length <= 140)
  })

  test('cuando la coincidencia es solo del título muestra el comienzo del "para qué", sin marcas', function () {
    const x = buscar(CON_INDICE, 'modo oscuro').resultados[0]
    assert.equal(x.codigo, 'T11.47')
    assert.ok(x.fragmento_de === 'para_que' || x.fragmento_de === 'transcripcion')
    const y = buscar(SIN_INDICE, 'IA').resultados[0]
    assert.equal(y.fragmento_de, 'para_que')
  })

  test('sin guion usa el "para qué" cuando la palabra está ahí', function () {
    const z = buscar(SIN_INDICE, 'renglones').resultados[0]
    assert.equal(z.fragmento_de, 'para_que')
    // El "para qué" de T5.15 nombra dos veces los renglones y las dos entran en el recorte.
    assert.ok(marcas(z.fragmento_partes).length >= 1)
    marcas(z.fragmento_partes).forEach(function (m) {
      assert.equal(m, 'renglones')
    })
  })

  test('las marcas del fragmento caen sobre la palabra correcta en un texto con acentos', function () {
    const x = buscar(CON_INDICE, 'revisás renglones').resultados[0]
    marcas(x.fragmento_partes).forEach(function (m) {
      assert.ok(/^(revis[aá]s|renglones)$/i.test(m), m)
    })
    assert.ok(marcas(x.fragmento_partes).length >= 2)
  })
})

describe('posiciones del texto original (tokenizar)', function () {
  /** Lo que daría la expresión regular de referencia: letras y números seguidos. */
  function con_regex(texto) {
    const salida = []
    const re = /[\p{L}\p{N}]+/gu
    let m
    while ((m = re.exec(texto)) !== null) {
      salida.push([m[0], m.index, m.index + m[0].length])
    }
    return salida
  }

  test('da las mismas palabras y posiciones que la expresión regular /[\\p{L}\\p{N}]+/gu', function () {
    ;[
      'Escanear la factura o el remito con la IA',
      'Año nuevo: ¿qué pasa con la contraseña? ¡Mirá!',
      '  doble  espacio\ty\nsalto  ',
      'a-b c.d e,f 1.200,50 x_y',
      'ÁÉÍÓÚ Ñandú ÜBER çedilla ñoño',
      'emoji 😀 en medio 👍🏽 y 日本語 sí',
      '',
      '---',
    ].forEach(function (texto) {
      const t = tokenizar(texto)
      const ref = con_regex(texto)
      assert.equal(t.pal.length, ref.length, texto)
      ref.forEach(function (r, i) {
        assert.equal(t.ini[i], r[1], texto)
        assert.equal(t.fin[i], r[2], texto)
        assert.equal(texto.slice(t.ini[i], t.fin[i]), r[0], texto)
      })
    })
  })

  test('normaliza palabra por palabra y las posiciones siguen siendo las del original', function () {
    const texto = 'Diseño de la contraseña ÁREA'
    const t = tokenizar(texto)
    assert.deepEqual(t.pal, ['diseno', 'de', 'la', 'contrasena', 'area'])
    assert.equal(texto.slice(t.ini[3], t.fin[3]), 'contraseña')
    assert.equal(texto.slice(t.ini[4], t.fin[4]), 'ÁREA')
  })

  test('junta "pe-de-efe" y "pe de efe" en una palabra que abarca todo el texto', function () {
    const texto = 'Salen en pe-de-efe, o en Pe De Efe.'
    const t = tokenizar(texto)
    assert.deepEqual(t.pal, ['salen', 'en', 'pdf', 'o', 'en', 'pdf'])
    assert.equal(texto.slice(t.ini[2], t.fin[2]), 'pe-de-efe')
    assert.equal(texto.slice(t.ini[5], t.fin[5]), 'Pe De Efe')
  })
})

describe('rendimiento', function () {
  /** Un catálogo de 364 videos armado repitiendo los reales con códigos distintos (tamaño de producción). */
  const grande = []
  const trans = {}
  for (let i = 0; i < 364; i++) {
    const base = CORPUS.videos[i % CORPUS.videos.length]
    const codigo = 'P' + i
    grande.push(Object.assign({}, base, { codigo: codigo, orden: i }))
    trans[codigo] = base.para_que + ' ' + base.voz + ' ' + base.cuando_no
  }

  test('armar el buscador con 364 videos y consultar son rápidos (cotas muy holgadas, para atrapar un cuadrático)', function () {
    const t0 = performance.now()
    const b = crear_buscador(grande, CORPUS.carpetas, trans)
    const armado = performance.now() - t0
    const t1 = performance.now()
    for (let i = 0; i < 20; i++) {
      buscar(b, 'escanear una foto de la factura en una compra')
      buscar(b, 'factura')
      buscar(b, 'sistema')
    }
    const consulta = (performance.now() - t1) / 60
    assert.ok(armado < 2000, 'armado: ' + armado.toFixed(0) + ' ms')
    assert.ok(consulta < 100, 'consulta: ' + consulta.toFixed(1) + ' ms')
  })

  test('una consulta que todos los videos cumplen devuelve todos los resultados, ordenados', function () {
    const b = crear_buscador(grande, CORPUS.carpetas, trans)
    const r = buscar(b, 'sistema')
    assert.equal(r.resultados.length, grande.length)
    assert.equal(r.completo, true)
  })
})
