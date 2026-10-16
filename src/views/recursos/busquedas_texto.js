/**
 * Texto que el botón «Copiar para Claude» de la solapa «Búsquedas» del Centro de recursos deja en el portapapeles
 * (misión busquedas-centro-recursos). Sin imports ni Vue: es una función pura, así se prueba en Node.
 */

/**
 * Número entero de un dato que puede venir como string o faltar.
 *
 * @param {*} valor
 * @returns {number}
 */
function entero(valor) {
  /** Valor como número. */
  const n = Math.floor(Number(valor))
  return isNaN(n) ? 0 : n
}

/**
 * Fecha «AAAA-MM-DD» (con o sin hora) como «dd/mm/aaaa». Si no tiene esa forma la devuelve tal cual.
 *
 * @param {*} fecha
 * @returns {string}
 */
function fecha_larga(fecha) {
  /** Partes de la fecha. */
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha == null ? '' : fecha))
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(fecha == null ? '' : fecha)
}

/**
 * «1 vez» / «7 veces».
 *
 * @param {number} n
 * @returns {string}
 */
function veces_texto(n) {
  return n + (n === 1 ? ' vez' : ' veces')
}

/**
 * Lo que devolvió el buscador para una consulta: el código y el título del primer resultado, o «nada». Si en
 * algunas de las veces no devolvió nada, lo aclara.
 *
 * @param {Object} fila Una fila de `sin_encontrar` o de `sin_clic`.
 * @returns {string}
 */
function devolvio_texto(fila) {
  /** Veces que se buscó, y cuántas dieron 0 resultados. */
  const veces = entero(fila.veces)
  const vacias = entero(fila.sin_resultados)
  if (!fila.primero_codigo) {
    return 'devolvió nada'
  }
  /** Primer resultado, con el título si el video todavía existe. */
  const primero = fila.primero_codigo + (fila.primero_titulo ? ' «' + fila.primero_titulo + '»' : '')
  /** Aclaración cuando algunas veces no devolvió nada. */
  const aclaracion = vacias > 0 && vacias < veces ? ' (' + vacias + ' de las ' + veces + ' veces no devolvió nada)' : ''
  return 'devolvió ' + primero + aclaracion
}

/**
 * Una línea por consulta: `- "consulta" · N veces · devolvió T4.8 «título»` (o `devolvió nada`).
 *
 * @param {Array<Object>} filas
 * @returns {Array<string>} Las líneas; con la lista vacía, una sola que lo dice.
 */
function lineas_de(filas) {
  if (!filas.length) {
    return ['(ninguna en este período)']
  }
  return filas.map(function (fila) {
    return '- "' + String(fila.consulta == null ? '' : fila.consulta) + '" · ' + veces_texto(entero(fila.veces)) + ' · ' + devolvio_texto(fila)
  })
}

/**
 * Arma el texto para pegarle a Claude: de qué se trata, el período, los totales y las dos listas.
 *
 * @param {{
 *   totales?: Object,
 *   sin_encontrar?: Array<Object>,
 *   sin_clic?: Array<Object>,
 *   desde?: string,
 *   hasta?: string
 * }} datos Respuesta de `GET admin/recursos/busquedas` (contrato C-BUSQ-2).
 * @param {string} [desde] Inicio del período (`AAAA-MM-DD`); si falta, el que vino en `datos`.
 * @param {string} [hasta] Fin del período (`AAAA-MM-DD`); si falta, el que vino en `datos`.
 * @returns {string}
 */
export function texto_para_claude(datos, desde, hasta) {
  /** Respuesta, aunque venga vacía. */
  const d = datos || {}
  /** Totales, con ceros donde falte algo. */
  const t = d.totales || {}
  /** Listas, aunque falten. */
  const sin_encontrar = Array.isArray(d.sin_encontrar) ? d.sin_encontrar : []
  const sin_clic = Array.isArray(d.sin_clic) ? d.sin_clic : []

  return [
    'Objetivo: afinar `src/recursos/sinonimos.js` del buscador del centro de recursos de ComercioCity (recursos.comerciocity.com) con búsquedas reales de los clientes, en vez de con sets inventados.',
    '',
    'Cómo leerlo: las consultas están normalizadas (minúsculas, sin acentos). «Devolvió» es el primer resultado que mostró el buscador (código y título del video). Los videos se identifican por código (por ejemplo T4.8).',
    '',
    'Período: del ' + fecha_larga(desde || d.desde) + ' al ' + fecha_larga(hasta || d.hasta),
    '',
    'Totales del período:',
    '- Búsquedas registradas: ' + entero(t.busquedas),
    '- Sin ningún resultado: ' + entero(t.sin_resultados),
    '- Con resultados, pero ninguno tenía todo lo que buscaban: ' + entero(t.incompletas),
    '- Con resultados, pero nadie abrió ninguno: ' + entero(t.sin_clic),
    '- Con un video abierto: ' + entero(t.con_clic),
    '',
    'No encontraron nada, o encontraron algo que no calza (' + sin_encontrar.length + ' consultas, las más repetidas primero):',
  ]
    .concat(lineas_de(sin_encontrar))
    .concat(['', 'Nadie abrió ningún resultado (' + sin_clic.length + ' consultas, las más repetidas primero):'])
    .concat(lineas_de(sin_clic))
    .concat([
      '',
      'Qué te pido: para cada consulta de la primera lista, decime qué palabra o expresión habría que sumar a `sinonimos.js` para que encuentre el video correcto (o si lo que falta es un video, o ajustar el título o el «para qué» de uno que ya existe). Para la segunda lista, decime si el primer resultado era el correcto y, si no, qué cambiaría en la relevancia. No inventes sinónimos que no se apoyen en estas búsquedas.',
    ])
    .join('\n')
}
