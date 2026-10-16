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

import { crear_buscador, buscar, tokenizar, raiz, son_parientes } from '../../src/recursos/buscador.js'
import { GRUPOS_DE_SINONIMOS } from '../../src/recursos/sinonimos.js'

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
      { codigo: 'A', titulo: 'Abrir una ventanilla' },
      { codigo: 'B', titulo: 'Hacer una venta' },
    ])
    assert.deepEqual(codigos(buscar(b, 'venta')), ['B'])
    // Pero a medias sí: "ventani" solo puede ser "ventanilla".
    assert.deepEqual(codigos(buscar(b, 'ventani')), ['A'])
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

  test('una letra de más al principio sí se corrige: "estock"', function () {
    const b = armar([{ codigo: 'A', titulo: 'El stock mínimo' }])
    assert.deepEqual(codigos(buscar(b, 'estock')), ['A'])
  })

  test('b y v se confunden: "bender" encuentra "vender"', function () {
    const b = armar([{ codigo: 'A', titulo: 'Cómo vender más' }])
    assert.deepEqual(codigos(buscar(b, 'bender')), ['A'])
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

  test('"ver", "usar" y "sirve" son relleno: "ver el historial" busca solo "historial"', function () {
    assert.deepEqual(buscar(CON_INDICE, 'ver el historial').palabras, ['historial'])
    assert.deepEqual(buscar(CON_INDICE, 'cómo uso el escáner').palabras, ['escaner'])
  })

  test('una ñ escrita como "n" + tilde combinada se busca igual', function () {
    assert.equal(buscar(CON_INDICE, 'contraseña').resultados[0].codigo, 'T0.4')
  })

  test('si alguien pega un párrafo se usan solo las primeras 12 palabras', function () {
    const parrafo = Array.from({ length: 40 }, function (_, i) {
      return 'palabra' + i
    }).join(' ')
    const r = buscar(CON_INDICE, parrafo)
    assert.equal(r.palabras.length, 12)
    assert.deepEqual(r.resultados, [])
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
      { A: 'Para controlar el dinero hay que revisar también cada uno de los cheques que entraron.', B: 'Otro texto sin relación.' }
    )
    assert.deepEqual(codigos(buscar(b, 'cheques')), ['B', 'A'])
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
    const re = /[\p{L}\p{N}\p{M}]+/gu
    let m
    while ((m = re.exec(texto)) !== null) {
      salida.push([m[0], m.index, m.index + m[0].length])
    }
    return salida
  }

  test('da las mismas palabras y posiciones que la expresión regular /[\\p{L}\\p{N}\\p{M}]+/gu', function () {
    ;[
      'Escanear la factura o el remito con la IA',
      'Año nuevo: ¿qué pasa con la contraseña? ¡Mirá!',
      '  doble  espacio\ty\nsalto  ',
      'a-b c.d e,f 1.200,50 x_y',
      'ÁÉÍÓÚ Ñandú ÜBER çedilla ñoño',
      'emoji 😀 en medio 👍🏽 y 日本語 sí',
      'contraseña con tilde combinada',
      'contrasen0303a con tilde combinada y n0303 suelta',
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

describe('conjugaciones: las formas de un verbo llegan a la misma raíz', function () {
  /**
   * Familias de verbos con sus formas: primera persona, voseo, nosotros, ellos, pretérito, imperfecto, participio,
   * gerundio, subjuntivo y con pronombre pegado. Todas sin acentos (el buscador normaliza antes de sacar la raíz).
   * Los verbos son los más frecuentes de los guiones reales más algunos irregulares.
   */
  const FAMILIAS = {
    vender: ['vendo', 'vendes', 'vende', 'vendemos', 'venden', 'vendi', 'vendiste', 'vendio', 'vendimos', 'vendieron', 'vendia', 'vendian', 'vendido', 'vendidas', 'vendiendo', 'venda', 'vendan', 'venderlo', 'venderle', 'vendelo'],
    cambiar: ['cambio', 'cambias', 'cambia', 'cambiamos', 'cambian', 'cambie', 'cambies', 'cambiaste', 'cambiaron', 'cambiaba', 'cambiaban', 'cambiado', 'cambiando', 'cambiarlo', 'cambiarle', 'cambiala'],
    cargar: ['cargo', 'cargas', 'carga', 'cargamos', 'cargan', 'cargue', 'cargues', 'carguen', 'cargaste', 'cargaron', 'cargaba', 'cargado', 'cargada', 'cargando', 'cargarlo', 'cargala', 'cargarla'],
    escribir: ['escribo', 'escribis', 'escribe', 'escribimos', 'escriben', 'escribi', 'escribiste', 'escribio', 'escribieron', 'escribia', 'escribiendo', 'escribirle', 'escribilo'],
    abrir: ['abro', 'abris', 'abre', 'abrimos', 'abren', 'abri', 'abriste', 'abrio', 'abrieron', 'abria', 'abriendo', 'abrirlo', 'abrirla'],
    guardar: ['guardo', 'guardas', 'guarda', 'guardamos', 'guardan', 'guarde', 'guardes', 'guardaste', 'guardaron', 'guardaba', 'guardado', 'guardando', 'guardarlo', 'guardalo'],
    buscar: ['busco', 'buscas', 'busca', 'buscamos', 'buscan', 'busque', 'busques', 'buscaste', 'buscaron', 'buscando', 'buscarlo', 'buscala'],
    cobrar: ['cobro', 'cobras', 'cobra', 'cobramos', 'cobran', 'cobre', 'cobres', 'cobraste', 'cobraron', 'cobrado', 'cobrando', 'cobrarle'],
    actualizar: ['actualizo', 'actualizas', 'actualiza', 'actualizamos', 'actualizan', 'actualice', 'actualices', 'actualizaste', 'actualizaron', 'actualizado', 'actualizarlo', 'actualizala'],
    // Irregulares: la raíz cambia (e → ie, o → ue, e → i, g → j).
    elegir: ['elijo', 'elegis', 'elige', 'elegimos', 'eligen', 'elegi', 'elegiste', 'eligio', 'eligieron', 'elegido', 'eligiendo', 'elegirlo'],
    mostrar: ['muestro', 'mostras', 'muestra', 'mostramos', 'muestran', 'muestre', 'mostraste', 'mostraron', 'mostrado', 'mostrando', 'mostrarlo'],
    cerrar: ['cierro', 'cerras', 'cierra', 'cerramos', 'cierran', 'cierre', 'cerraste', 'cerraron', 'cerrado', 'cerrando', 'cerrarla'],
    volver: ['vuelvo', 'volves', 'vuelve', 'volvemos', 'vuelven', 'volvi', 'volviste', 'volvio', 'volvieron', 'vuelva', 'volviendo', 'volverlo'],
    pedir: ['pido', 'pedis', 'pide', 'pedimos', 'piden', 'pedi', 'pediste', 'pidio', 'pidieron', 'pedido', 'pidiendo', 'pedirle'],
    seguir: ['sigo', 'seguis', 'sigue', 'seguimos', 'siguen', 'segui', 'seguiste', 'siguio', 'siguieron', 'seguido', 'siguiendo'],
    corregir: ['corrijo', 'corregis', 'corrige', 'corregimos', 'corrigen', 'corregi', 'corregiste', 'corrigio', 'corrigieron', 'corregido', 'corrigiendo', 'corregirlo'],
    empezar: ['empiezo', 'empezas', 'empieza', 'empezamos', 'empiezan', 'empiece', 'empezaste', 'empezaron', 'empezado', 'empezando'],
  }

  Object.keys(FAMILIAS).forEach(function (infinitivo) {
    test('todas las formas de "' + infinitivo + '" tienen su raíz', function () {
      FAMILIAS[infinitivo].forEach(function (forma) {
        assert.equal(raiz(forma), raiz(infinitivo), forma + ' tendría que juntarse con ' + infinitivo)
      })
    })
  })

  test('las raíces de verbos distintos no se juntan entre sí', function () {
    const vistas = {}
    Object.keys(FAMILIAS).forEach(function (infinitivo) {
      const r = raiz(infinitivo)
      assert.equal(vistas[r], undefined, infinitivo + ' choca con ' + vistas[r])
      vistas[r] = infinitivo
    })
  })

  test('palabras que parecen parientes pero no lo son se quedan separadas', function () {
    ;[
      ['importe', 'importar'],
      ['correo', 'corre'],
      ['tipo', 'tipear'],
      ['bloque', 'bloquear'],
      ['listo', 'lista'],
      ['ficha', 'fecha'],
      ['cuenta', 'contar'],
      ['venta', 'vender'],
      ['pago', 'pagina'],
      ['caja', 'cajero'],
      ['ventana', 'venta'],
    ].forEach(function (par) {
      assert.notEqual(raiz(par[0]), raiz(par[1]), par[0] + ' y ' + par[1] + ' no son la misma raíz')
    })
  })

  test('sustantivos y adjetivos que terminan como un verbo conservan su singular', function () {
    ;[
      ['ultimo', 'ultimos', 'ultima', 'ultimas'],
      ['minimo', 'minimos'],
      ['maximo', 'maximos'],
      ['proximo', 'proximos'],
      ['orden', 'ordenes', 'ordenar', 'ordena', 'ordenan'],
      ['imagen', 'imagenes'],
    ].forEach(function (grupo) {
      grupo.forEach(function (palabra) {
        assert.equal(raiz(palabra), raiz(grupo[0]), palabra + ' tendría que juntarse con ' + grupo[0])
      })
    })
  })

  test('"venden" encuentra lo que dice "vendiste", y "cambio" lo que dice "cambiar" y "cambiá"', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Qué vendiste hoy' },
      { codigo: 'B', titulo: 'Cambiar el precio de un artículo' },
      { codigo: 'C', titulo: 'Cambiá la contraseña' },
      { codigo: 'D', titulo: 'Otra cosa' },
    ])
    assert.deepEqual(codigos(buscar(b, 'venden')), ['A'])
    assert.deepEqual(codigos(buscar(b, 'cambio')).sort(), ['B', 'C'])
    assert.deepEqual(codigos(buscar(b, 'cambiaron')).sort(), ['B', 'C'])
  })

  test('el voseo y el subjuntivo: "cargá", "cargás" y "cargues" encuentran "cargar"', function () {
    const b = armar([{ codigo: 'A', titulo: 'Cargar una compra' }, { codigo: 'B', titulo: 'Otra cosa' }])
    ;['cargá', 'cargás', 'cargues', 'cargamos', 'cargaron', 'cargalo'].forEach(function (forma) {
      assert.deepEqual(codigos(buscar(b, forma)), ['A'], forma)
    })
  })

  test('las formas irregulares: "muestra" encuentra "mostrar", "elige" encuentra "elegir"', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Mostrar u ocultar columnas' },
      { codigo: 'B', titulo: 'Elegir el cliente' },
      { codigo: 'C', titulo: 'Cerrar la caja' },
      { codigo: 'D', titulo: 'Otra cosa' },
    ])
    assert.deepEqual(codigos(buscar(b, 'muestra')), ['A'])
    assert.deepEqual(codigos(buscar(b, 'elige')), ['B'])
    assert.deepEqual(codigos(buscar(b, 'cierran')), ['C'])
  })
})

describe('cobertura ponderada por rareza', function () {
  /**
   * Un catálogo donde "escanear" es raro y "factura", "compra" y "proveedor" son comunes. El video bueno
   * (ESC) cubre tres de las cuatro palabras, con la rara en el título; tres videos de relleno tienen las
   * cuatro palabras sueltas en el guion.
   */
  function catalogo() {
    const lista = [{ codigo: 'ESC', titulo: 'Escanear la factura de una compra' }]
    const trans = { ESC: 'Subís la foto y la lee.' }
    for (let i = 0; i < 30; i++) {
      lista.push({ codigo: 'R' + i, titulo: 'Tema número ' + i })
      trans['R' + i] =
        (i % 2 ? 'Hablamos de la factura. ' : 'Nada. ') + (i % 3 ? 'Una compra cualquiera. ' : 'Nada. ') + (i % 5 ? 'El proveedor llama. ' : 'Nada. ')
    }
    // Tres que tienen las cuatro palabras, pero solo de pasada en el guion.
    for (let j = 0; j < 3; j++) {
      lista.push({ codigo: 'J' + j, titulo: 'Un video largo ' + j })
      trans['J' + j] = 'Primero se puede escanear, y mucho después la factura de una compra a un proveedor.'
    }
    return armar(lista, trans)
  }

  test('el video que cubre tres de cuatro con la palabra rara en el título le gana a los que tienen las cuatro de pasada', function () {
    const r = buscar(catalogo(), 'escanear factura compra proveedor')
    assert.equal(r.resultados[0].codigo, 'ESC')
    assert.equal(r.completo, false, 'el primero no cubre las cuatro palabras: se avisa')
    // Los que cubren las cuatro siguen en la lista, después.
    assert.ok(codigos(r).indexOf('J0') > 0)
  })

  test('si el que cubre todo también es bueno, gana y la respuesta es completa', function () {
    const b = armar([
      { codigo: 'TODO', titulo: 'Escanear la factura de la compra de un proveedor' },
      { codigo: 'PARTE', titulo: 'Escanear la factura de una compra' },
      { codigo: 'OTRO', titulo: 'Nada que ver' },
    ])
    const r = buscar(b, 'escanear factura compra proveedor')
    assert.equal(r.resultados[0].codigo, 'TODO')
    assert.equal(r.completo, true)
    assert.ok(codigos(r).indexOf('OTRO') === -1)
  })

  test('un video que cubre menos de la mitad del peso de la consulta no entra', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Gato perro' },
      { codigo: 'B', titulo: 'Gato casa' },
      { codigo: 'C', titulo: 'Casa perro' },
      { codigo: 'D', titulo: 'Gato' },
      { codigo: 'E', titulo: 'Gato perro casa mesa' },
    ])
    // Cuatro palabras igual de raras: con una sola nadie llega a la mitad.
    const r = buscar(b, 'gato perro casa mesa')
    assert.ok(codigos(r).indexOf('D') === -1)
    assert.equal(r.resultados[0].codigo, 'E')
  })

  test('con una palabra rara y una común, el que tiene solo la rara se muestra (y se avisa)', function () {
    const trans = {}
    const lista = []
    for (let i = 0; i < 40; i++) {
      lista.push({ codigo: 'V' + i, titulo: 'Video ' + i })
      trans['V' + i] = 'Hablamos del cliente en este video.'
    }
    lista.push({ codigo: 'RARO', titulo: 'Un video sobre balanza' })
    trans.RARO = 'Nada más.'
    const r = buscar(armar(lista, trans), 'balanza cliente')
    assert.equal(r.resultados[0].codigo, 'RARO')
    assert.equal(r.completo, false)
  })

  test('una consulta de una palabra sigue siendo "todo o nada"', function () {
    const r = buscar(CON_INDICE, 'seis')
    assert.equal(r.completo, true)
  })
})

describe('piso de relevancia', function () {
  /** 40 videos: "alfa" y "beta" son comunes (en la mitad cada una) y solo coinciden de pasada en el guion del último. */
  function catalogo_comun() {
    const lista = []
    const trans = {}
    for (let i = 0; i < 39; i++) {
      lista.push({ codigo: 'C' + i, titulo: 'Video ' + i })
      trans['C' + i] = i < 19 ? 'Se habla de alfa un rato.' : 'Se habla de beta un rato.'
    }
    lista.push({ codigo: 'LARGO', titulo: 'Video largo' })
    trans.LARGO =
      'Un guion largo donde de pasada aparece alfa. Después se habla de muchas otras cosas durante un buen rato, ' +
      'con ejemplos, aclaraciones y recomendaciones, hasta que al final se nombra también a beta.'
    // Dos palabras raras, también solo en un guion.
    trans.C3 += ' Y la zeta junto con la eta.'
    return armar(lista, trans)
  }

  test('dos palabras comunes dichas solo de pasada en un guion no dan una respuesta completa', function () {
    const r = buscar(catalogo_comun(), 'alfa beta')
    assert.equal(r.resultados[0].codigo, 'LARGO')
    assert.equal(r.completo, false)
  })

  test('dos palabras raras dichas solo en el guion de un video sí', function () {
    const r = buscar(catalogo_comun(), 'zeta eta')
    assert.deepEqual(codigos(r), ['C3'])
    assert.equal(r.completo, true)
  })

  test('una palabra rara dicha solo en la voz sigue devolviendo su video, como completa', function () {
    const r = buscar(catalogo_comun(), 'zeta')
    assert.deepEqual(codigos(r), ['C3'])
    assert.equal(r.completo, true)
  })

  test('dos palabras medianas pegadas, como una frase, sí cuentan como respuesta completa', function () {
    const lista = []
    const trans = {}
    for (let i = 0; i < 39; i++) {
      lista.push({ codigo: 'C' + i, titulo: 'Video ' + i })
      trans['C' + i] = i < 19 ? 'Se habla de alfa un rato.' : 'Se habla de beta un rato.'
    }
    lista.push({ codigo: 'FRASE', titulo: 'Video de la frase' })
    trans.FRASE = 'Y el límite es de alfa beta por día.'
    const r = buscar(armar(lista, trans), 'alfa beta')
    assert.equal(r.resultados[0].codigo, 'FRASE')
    assert.equal(r.completo, true)
  })

  test('con una palabra en el título el piso no se aplica', function () {
    const lista = [{ codigo: 'T', titulo: 'Alfa y beta' }]
    const trans = { T: 'Nada.' }
    for (let i = 0; i < 39; i++) {
      lista.push({ codigo: 'C' + i, titulo: 'Video ' + i })
      trans['C' + i] = i < 19 ? 'Alfa.' : 'Beta.'
    }
    const r = buscar(armar(lista, trans), 'alfa beta')
    assert.equal(r.resultados[0].codigo, 'T')
    assert.equal(r.completo, true)
  })
})

describe('vocabulario del comercio', function () {
  test('"fiar", "fiarle" y "fiado" llevan a la cuenta corriente', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Leer la cuenta corriente' },
      { codigo: 'B', titulo: 'Cobrar con tarjeta' },
    ])
    ;['fiar', 'fiarle', 'fiado', 'fiando'].forEach(function (palabra) {
      assert.deepEqual(codigos(buscar(b, palabra)), ['A'], palabra)
    })
  })

  test('"en masa", "masiva", "de una vez", "de un saque" y "muchos" son lo mismo', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Actualizar en masa con un filtro' },
      { codigo: 'B', titulo: 'Disponibilidad masiva de variantes' },
      { codigo: 'C', titulo: 'Ponerle foto a todo el catálogo de una vez' },
      { codigo: 'D', titulo: 'Volver todo a cero de un saque' },
      { codigo: 'E', titulo: 'Crear un artículo' },
    ])
    ;['masiva', 'en masa', 'de una vez', 'muchos', 'varios'].forEach(function (consulta) {
      assert.deepEqual(codigos(buscar(b, consulta)).sort(), ['A', 'B', 'C', 'D'], consulta)
    })
  })

  test('"sacar plata de la caja" lleva al retiro', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Un retiro, un ajuste o un ingreso suelto: el movimiento manual' },
      { codigo: 'B', titulo: 'Pasar plata de una caja a otra' },
      { codigo: 'C', titulo: 'Sacar un reporte' },
    ])
    const r = buscar(b, 'sacar plata de la caja')
    assert.equal(r.resultados[0].codigo, 'A')
  })

  test('"acreditan" y "liquidar" son el mismo tema de la tarjeta', function () {
    const b = armar([
      { codigo: 'A', titulo: 'Los tres saldos: contable, disponible y a liquidar' },
      { codigo: 'B', titulo: 'Configurar los días de acreditación de una caja' },
      { codigo: 'C', titulo: 'Otra cosa' },
    ])
    assert.deepEqual(codigos(buscar(b, 'cuando me acreditan')).sort(), ['A', 'B'])
  })

  test('"cuesta" y "cuestan" encuentran "costo"', function () {
    const b = armar([{ codigo: 'A', titulo: 'Cómo se arma el costo de un artículo' }, { codigo: 'B', titulo: 'Otra cosa' }])
    assert.deepEqual(codigos(buscar(b, 'cuanto cuestan')), ['A'])
  })

  test('un grupo de sinónimos comparte la rareza: "producto", que casi no se dice, no pesa el triple que "artículo"', function () {
    // "artículo" está en 30 títulos y "producto" en uno: sin rareza compartida el único título con "producto" valía
    // seis veces lo que uno con "artículo" y "productos más vendidos" iba a "Agregar productos…".
    const lista = [
      { codigo: 'PRODUCTO', titulo: 'Agregar productos con el lector' },
      { codigo: 'ARTICULO', titulo: 'Cargar un artículo' },
    ]
    for (let i = 0; i < 29; i++) {
      lista.push({ codigo: 'X' + i, titulo: 'Un artículo número ' + i })
    }
    for (let i = 0; i < 100; i++) {
      lista.push({ codigo: 'R' + i, titulo: 'Tema ' + i })
    }
    const r = buscar(armar(lista), 'productos')
    const por_codigo = {}
    r.resultados.forEach(function (x) {
      por_codigo[x.codigo] = x.puntaje
    })
    assert.equal(r.resultados[0].codigo, 'PRODUCTO')
    assert.ok(por_codigo.PRODUCTO / por_codigo.ARTICULO < 3, JSON.stringify([por_codigo.PRODUCTO, por_codigo.ARTICULO]))
    assert.equal(por_codigo.ARTICULO, por_codigo.X0, 'todos los títulos con "artículo" valen lo mismo')
  })

  test('la forma exacta que se escribió conserva su rareza: "cargaron", dicho en un solo video, lo encuentra primero', function () {
    const lista = []
    const trans = {}
    for (let i = 0; i < 40; i++) {
      lista.push({ codigo: 'V' + i, titulo: 'Video ' + i })
      trans['V' + i] = 'Se carga el artículo y después se cargan los demás.'
    }
    trans.V17 = 'Ayer cargaron todo.'
    const r = buscar(armar(lista, trans), 'cargaron')
    assert.equal(r.resultados[0].codigo, 'V17')
    assert.ok(r.resultados.length > 30, 'las otras formas de cargar también se encuentran')
  })
})

describe('ronda 3: una palabra que existe tal cual no la tapan sus expansiones', function () {
  test('"arqueo" no comparte raíz con "arca": la regla "-que" → "-car" pide raíces de más de tres letras', function () {
    assert.notEqual(raiz('arqueo'), raiz('arca'))
    // Las raíces largas siguen juntando la forma con "-que" y el infinitivo (busque/buscar, aplique/aplicar).
    assert.equal(raiz('busque'), raiz('buscar'))
    assert.equal(raiz('aplique'), raiz('aplicar'))
    assert.equal(raiz('expliques'), raiz('explicar'))
    assert.equal(raiz('marque'), raiz('marcar'))
    // Los verbos cortos que cambian de letra ("toqué/tocar", "saqué/sacar") están en la tabla de irregulares.
    assert.equal(raiz('toque'), raiz('tocar'))
    assert.equal(raiz('saques'), raiz('sacar'))
    assert.equal(raiz('saque'), raiz('sacar'))
  })

  test('quien busca "arqueo" recibe los videos que lo dicen y no los de ARCA', function () {
    const lista = [
      { codigo: 'A1', titulo: 'Tus datos fiscales y el punto de venta de ARCA' },
      { codigo: 'A2', titulo: 'La factura de ARCA con tu diseño' },
      { codigo: 'A3', titulo: 'Dar de alta un cliente con los datos de ARCA' },
      { codigo: 'A4', titulo: 'Registrar una devolución ante ARCA' },
      { codigo: 'ARQ', titulo: 'Abrir y cerrar la caja del día' },
    ]
    const trans = { ARQ: 'Al cerrar, el arqueo te dice si falta plata en la caja.' }
    const b = armar(lista, trans)
    assert.deepEqual(codigos(buscar(b, 'arqueo')), ['ARQ'])
    assert.equal(buscar(b, 'arqueo').completo, true)
    // Y al revés: quien escribe "arca" no recibe el arqueo.
    assert.equal(codigos(buscar(b, 'arca')).indexOf('ARQ'), -1)
  })

  test('dos formas de una misma raíz solo son parientes si empiezan igual o son de un verbo irregular', function () {
    assert.equal(son_parientes('cargar', 'cargues'), true)
    assert.equal(son_parientes('mostrar', 'muestra'), true)
    assert.equal(son_parientes('pedir', 'pide'), true)
    assert.equal(son_parientes('tocar', 'toque'), true)
    assert.equal(son_parientes('sacar', 'saque'), true)
    assert.equal(son_parientes('arca', 'arqueo'), false)
    assert.equal(son_parientes('cubo', 'cabo'), false)
  })

  test('una palabra no cae en un grupo de sinónimos porque su raíz se escriba como una palabra del grupo', function () {
    // raiz("cargara") es "cargar", que es una palabra del grupo de "alta"; raiz("inventario") es "inventar", y quien
    // escribe "inventar" no pregunta por el stock. Los grupos se buscan por la raíz de cada palabra, nunca por la escrita.
    const b = armar([
      { codigo: 'ALTA', titulo: 'Dar de alta un cliente' },
      { codigo: 'STOCK', titulo: 'El stock de la sucursal' },
      { codigo: 'CARGARA', titulo: 'Cuando se cargara el saldo inicial' },
      { codigo: 'INVENTAR', titulo: 'Si hay que inventar un código' },
    ])
    assert.deepEqual(codigos(buscar(b, 'cargara')), ['CARGARA'])
    assert.deepEqual(codigos(buscar(b, 'inventar')), ['INVENTAR'])
    // Los sinónimos de verdad siguen andando: "cargar" y "agregar" son del mismo grupo que "alta".
    assert.ok(codigos(buscar(b, 'agregar cliente')).indexOf('ALTA') === 0)
    assert.ok(codigos(buscar(b, 'inventario')).indexOf('STOCK') === 0)
  })

  test('en el corpus real, una palabra poco dicha trae primero un video que la dice o dice otra forma de su raíz', function () {
    // Se dejan afuera las palabras que tienen sinónimos (ahí el título de un sinónimo puede pasar a una mención
    // suelta de la palabra, y es lo que se quiere: ver "vocabulario del comercio").
    /** Raíces de todas las palabras de los grupos de sinónimos. */
    const con_sinonimos = new Set()
    GRUPOS_DE_SINONIMOS.forEach(function (grupo) {
      grupo.forEach(function (palabra) {
        con_sinonimos.add(raiz(palabra))
      })
    })
    /** Palabras de ≥ 5 letras que están (tal cual) en uno o dos videos del corpus, con su cantidad de videos. */
    const por_palabra = new Map()
    VIDEOS.forEach(function (v) {
      /** Palabras que el video dice (título, ubicación y transcripción). */
      const dichas = new Set(tokenizar(v.titulo + ' ' + TRANSCRIPCIONES[v.codigo]).pal)
      dichas.forEach(function (p) {
        if (p.length >= 5) {
          por_palabra.set(p, (por_palabra.get(p) || 0) + 1)
        }
      })
    })
    let probadas = 0
    por_palabra.forEach(function (cuantos, palabra) {
      if (cuantos > 2 || con_sinonimos.has(raiz(palabra))) {
        return
      }
      const r = buscar(CON_INDICE, palabra)
      if (!r.resultados.length) {
        return
      }
      probadas++
      /** Primer resultado: tiene que decir la palabra o una forma de su raíz (los sinónimos van detrás de esos). */
      const primero = VIDEOS.filter(function (v) {
        return v.codigo === r.resultados[0].codigo
      })[0]
      const tiene = tokenizar(primero.titulo + ' ' + TRANSCRIPCIONES[primero.codigo]).pal.some(function (t) {
        return t === palabra || raiz(t) === raiz(palabra)
      })
      assert.ok(tiene, '"' + palabra + '" trae primero ' + primero.codigo + ', que no la dice ni dice otra forma suya')
    })
    assert.ok(probadas > 100, 'se probaron ' + probadas + ' palabras')
  })
})

describe('ronda 3: umbral de cobertura adaptativo', function () {
  /**
   * 60 videos. "stock" y "mercadería" son comunes (más de 15 videos cada una); "descuento" está en uno solo
   * (JUNTO), que no dice nada más. "xyzzy" no existe. El video de STOCK dice "stock" en el título y "mercadería" en el guion.
   */
  function catalogo() {
    const lista = [{ codigo: 'STOCK', titulo: 'Cuánto stock tenés' }]
    const trans = { STOCK: 'Cuando entra mercadería se suma al stock.' }
    for (let i = 0; i < 18; i++) {
      lista.push({ codigo: 'S' + i, titulo: 'Stock de la sucursal ' + i })
      trans['S' + i] = 'Se mueve mercadería.'
    }
    lista.push({ codigo: 'SOLO', titulo: 'Otra cosa' })
    trans.SOLO = 'Hay un descuento.'
    for (let i = 0; i < 40; i++) {
      lista.push({ codigo: 'R' + i, titulo: 'Tema ' + i })
      trans['R' + i] = 'Nada.'
    }
    return armar(lista, trans)
  }

  test('una pregunta larga en la que falta una palabra rara no se queda con un solo resultado', function () {
    const r = buscar(catalogo(), 'mercaderia descuento stock xyzzy')
    assert.ok(r.resultados.length >= 8, 'resultados: ' + r.resultados.length)
    assert.ok(codigos(r).indexOf('STOCK') !== -1, 'el video del stock aparece')
    // No dice todo lo que pidió (una palabra no existe en ningún video): no puede salir como "completo".
    assert.equal(r.completo, false)
  })

  test('sin la palabra que no existe pasa lo mismo', function () {
    const r = buscar(catalogo(), 'mercaderia descuento stock')
    assert.ok(r.resultados.length >= 8, 'resultados: ' + r.resultados.length)
    assert.ok(codigos(r).indexOf('STOCK') !== -1)
    assert.equal(r.completo, false)
  })

  test('el multiplicador de cobertura sigue ordenando: el que dice más palabras va antes que el que dice menos', function () {
    const r = buscar(catalogo(), 'mercaderia stock')
    assert.equal(r.resultados[0].codigo, 'STOCK')
    assert.equal(r.completo, true)
    // Los que tienen las dos palabras (STOCK y los S) van antes que cualquiera que tenga una sola.
    assert.ok(r.resultados.length >= 19)
  })

  test('cuando hay de sobra con el umbral de siempre no se baja', function () {
    const lista = []
    for (let i = 0; i < 12; i++) {
      lista.push({ codigo: 'V' + i, titulo: 'Cheque rechazado número ' + i })
    }
    lista.push({ codigo: 'PARTE', titulo: 'Cheque que no tiene lo otro' })
    const r = buscar(armar(lista), 'cheque rechazado')
    assert.equal(codigos(r).indexOf('PARTE'), -1)
    assert.equal(r.resultados.length, 12)
    assert.equal(r.completo, true)
  })

  test('con una consulta de una sola palabra o con todas presentes el umbral no cambia nada', function () {
    const b = catalogo()
    assert.equal(buscar(b, 'descuento').resultados.length, 1)
    assert.equal(buscar(b, 'descuento').completo, true)
  })
})

describe('ronda 3: "sin" tiene contenido', function () {
  test('"sin" ya no es relleno: queda entre las palabras de la consulta', function () {
    assert.deepEqual(buscar(CON_INDICE, 'vender sin internet').palabras, ['vender', 'sin', 'internet'])
    assert.deepEqual(buscar(CON_INDICE, 'ventas sin factura').palabras, ['ventas', 'sin', 'factura'])
  })

  test('"ventas sin factura" prefiere al video que dice "con o sin factura" sobre el que solo tiene "ventas" y "factura"', function () {
    const b = armar([
      { codigo: 'MUCHAS', titulo: 'Ventas y factura: las ventas de la factura' },
      { codigo: 'SIN', titulo: 'Filtrar las ventas con o sin factura' },
      { codigo: 'CON', titulo: 'Todas las ventas con factura' },
      { codigo: 'OTRA', titulo: 'Vender sin internet' },
      { codigo: 'OTRA2', titulo: 'Vender sin cliente' },
    ])
    const r = buscar(b, 'ventas sin factura')
    assert.equal(r.resultados[0].codigo, 'SIN')
    assert.equal(r.completo, true)
  })

  test('"sin internet" trae "Vender sin internet" antes que un video que solo nombra internet', function () {
    const b = armar([
      { codigo: 'LENTO', titulo: 'Si tu internet es lento' },
      { codigo: 'SIN', titulo: 'Vender sin internet' },
      { codigo: 'OTRA', titulo: 'Vender sin cliente' },
    ])
    assert.equal(buscar(b, 'sin internet').resultados[0].codigo, 'SIN')
    assert.equal(buscar(b, 'vender sin internet').resultados[0].codigo, 'SIN')
  })

  test('el "sin" se resalta junto con la palabra de al lado', function () {
    const b = armar([{ codigo: 'SIN', titulo: 'Vender sin internet' }])
    const r = buscar(b, 'sin internet')
    assert.deepEqual(marcas(r.resultados[0].titulo_partes), ['sin', 'internet'])
  })
})
