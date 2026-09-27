/**
 * Formatos y etiquetas de la solapa "Imágenes" de la ficha del cliente (misión
 * imagenes-catalogo-completo, §12.3 del plan).
 *
 * Viven en un módulo aparte porque los usan los cinco componentes de la carpeta, y un número, un
 * costo o una fecha tienen que verse IGUAL en la tarjeta, en la tabla por día y en el registro.
 * Los criterios son los de `TokensTab.vue` (separador de miles argentino, `US$`, cuatro decimales
 * para lo muy chico, guion para lo que no se sabe) para que las dos solapas hablen el mismo idioma.
 *
 * Los ids que se traducen acá son los del contrato del `empresa-api` (§5.1 y §12.1 del plan): se
 * traducen, nunca se corrigen, y un id que no esté en el mapa se muestra tal cual llegó.
 */

/** Nombre con el que se muestra cada proveedor de búsqueda de imágenes. */
export const NOMBRES_DE_PROVEEDOR_DE_BUSQUEDA = {
  serper: 'Serper',
  google: 'Google',
}

/** Qué es cada tipo de consulta del registro, en castellano. */
export const ETIQUETAS_DE_TIPO = {
  busqueda: 'Búsqueda',
  validacion_ia: 'Validación con IA',
}

/** Con qué se buscó: el criterio que usó el motor para ese artículo. */
export const ETIQUETAS_DE_CRITERIO = {
  codigo_de_barras: 'por código de barras',
  nombre: 'por nombre',
}

/**
 * De dónde salió cada consulta del registro: el `origen` que graba el sistema del cliente en
 * `image_service_calls` (constantes `ORIGEN_*` de `ImageServiceCall` en empresa-api).
 *
 *   - `asignacion`: el motor de las asignaciones de imágenes (catálogo, selección o asistente).
 *   - `validacion_individual`: una validación con IA suelta, fuera de una asignación (la que usan
 *     el asistente por código de barras y el lote viejo).
 *   - `asistente_codigo_de_barras`: las búsquedas de Google que hace el asistente cuando busca un
 *     producto por su código de barras.
 */
export const ETIQUETAS_DE_ORIGEN_DE_CONSULTA = {
  asignacion: 'Asignación',
  validacion_individual: 'Validación suelta',
  asistente_codigo_de_barras: 'Asistente (por código de barras)',
}

/** Quién lanzó la asignación. */
export const ETIQUETAS_DE_ORIGEN_DE_ASIGNACION = {
  catalogo: 'Todo el catálogo',
  seleccion: 'Selección',
  asistente: 'Asistente',
}

/** En qué quedó la asignación. */
export const ETIQUETAS_DE_ESTADO_DE_ASIGNACION = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  terminada: 'Terminada',
  detenida: 'Detenida',
  fallida: 'Fallida',
}

/**
 * Traduce un id con uno de los mapas de arriba. Lo desconocido se muestra tal cual llegó: es más
 * honesto que esconderlo o inventarle un nombre, y el id sigue siendo legible.
 *
 * @param {Object<string, string>} mapa - Uno de los mapas de etiquetas.
 * @param {string|null} clave - Id tal como lo informó el cliente.
 * @returns {string}
 */
export function etiqueta(mapa, clave) {
  const texto = String(clave === null || clave === undefined ? '' : clave)
  return mapa[texto] || texto
}

/**
 * Número entero con separadores de miles.
 *
 * @param {number|null} valor
 * @returns {string}
 */
export function numero(valor) {
  return Number(valor || 0).toLocaleString('es-AR')
}

/**
 * Costo en dólares, listo para mostrar.
 *
 * 🔴 `null` NO se muestra como cero: se muestra como un guion. Cero significa "no costó nada" y
 * null significa "no sé cuánto costó"; mostrarlos igual es exactamente lo que el admin-api se cuida
 * de no hacer. Los importes muy chicos van con cuatro decimales: una búsqueda de Serper cuesta
 * US$ 0,001, y con dos decimales se vería como US$ 0,00 y parecería que no costó nada. Y lo que no
 * llega ni a cuatro decimales (una validación con pocos tokens) se muestra como "< US$ 0,0001": con
 * cuatro decimales redondearía a US$ 0,0000, que otra vez se lee como gratis.
 *
 * @param {number|null} valor
 * @returns {string}
 */
export function costo_visible(valor) {
  if (valor === null || valor === undefined) {
    return '—'
  }
  const importe = Number(valor)
  if (importe > 0 && importe < 0.0001) {
    return '< US$ 0,0001'
  }
  if (importe > 0 && importe < 0.01) {
    return 'US$ ' + importe.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  }
  return 'US$ ' + importe.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Día y mes de una fecha AAAA-MM-DD, sin pasar por `Date` (que la correría un día al oeste de
 * Greenwich, o sea en todo el país).
 *
 * @param {string} fecha
 * @returns {string}
 */
export function dia_y_mes(fecha) {
  const partes = String(fecha || '').slice(0, 10).split('-')
  if (partes.length !== 3) {
    return String(fecha || '')
  }
  return partes[2] + '/' + partes[1]
}

/**
 * Fecha AAAA-MM-DD en formato largo local (dd/mm/aaaa), también sin pasar por `Date`.
 *
 * @param {string} fecha
 * @returns {string}
 */
export function fecha_larga(fecha) {
  const partes = String(fecha || '').slice(0, 10).split('-')
  if (partes.length !== 3) {
    return String(fecha || '')
  }
  return partes[2] + '/' + partes[1] + '/' + partes[0]
}

/**
 * Un timestamp del backend convertido a `Date`, o null si no se puede leer.
 *
 * Acepta las dos formas que puede mandar Laravel: ISO con zona (`2026-09-27T18:04:05.000000Z`, la
 * serialización de `toArray()`) y la de la base (`2026-09-27 15:04:05`, hora local). Los
 * microsegundos se recortan a milisegundos porque Safari no parsea más de tres decimales y
 * devuelve "Invalid Date".
 *
 * @param {string} valor
 * @returns {Date|null}
 */
export function a_fecha(valor) {
  let texto = String(valor || '').trim()
  if (texto === '') {
    return null
  }
  texto = texto.replace(' ', 'T').replace(/\.(\d{3})\d+/, '.$1')
  const fecha = new Date(texto)
  return isNaN(fecha.getTime()) ? null : fecha
}

/**
 * Dos dígitos con cero adelante ("9" → "09").
 *
 * @param {number} valor
 * @returns {string}
 */
function dos_digitos(valor) {
  return String(valor).padStart(2, '0')
}

/*
 * 🔴 Las tres funciones de fecha y hora de abajo arman el texto A MANO y no con
 * `toLocaleString('es-AR', ...)`. Medido con el ICU de Node 24 el 27/9/2026: para `es-AR` devuelve
 * la hora en formato de 12 horas ("03:04:05 p. m.") y el mes sin el cero aunque se pida con dos
 * dígitos ("27/9"), y cada navegador trae su propia versión de esos datos. En un registro donde se
 * comparan consultas segundo a segundo, un formato que cambia según el navegador no sirve: se usa
 * siempre dd/mm y 24 horas, en la hora local de quien mira.
 */

/**
 * Fecha y hora con segundos, para el registro ("27/09 15:04:05"): en un catálogo grande hay varias
 * consultas por minuto, y sin los segundos no se puede saber cuál vino primero.
 *
 * @param {string} valor
 * @returns {string}
 */
export function fecha_hora_con_segundos(valor) {
  const fecha = a_fecha(valor)
  if (!fecha) {
    return String(valor || '—')
  }
  return (
    dos_digitos(fecha.getDate()) + '/' + dos_digitos(fecha.getMonth() + 1) + ' ' +
    dos_digitos(fecha.getHours()) + ':' + dos_digitos(fecha.getMinutes()) + ':' + dos_digitos(fecha.getSeconds())
  )
}

/**
 * Día, mes y hora sin segundos, para las asignaciones ("27/09 15:04"): se lanzan de a una y el
 * minuto alcanza.
 *
 * @param {string} valor
 * @returns {string}
 */
export function fecha_hora_corta(valor) {
  const fecha = a_fecha(valor)
  if (!fecha) {
    return String(valor || '—')
  }
  return (
    dos_digitos(fecha.getDate()) + '/' + dos_digitos(fecha.getMonth() + 1) + ' ' +
    dos_digitos(fecha.getHours()) + ':' + dos_digitos(fecha.getMinutes())
  )
}

/**
 * Fecha y hora completas, para el `title` (el texto que aparece al pasar el mouse):
 * "27/09/2026 15:04:05".
 *
 * @param {string} valor
 * @returns {string}
 */
export function fecha_hora_completa(valor) {
  const fecha = a_fecha(valor)
  if (!fecha) {
    return String(valor || '')
  }
  return (
    dos_digitos(fecha.getDate()) + '/' + dos_digitos(fecha.getMonth() + 1) + '/' + fecha.getFullYear() + ' ' +
    dos_digitos(fecha.getHours()) + ':' + dos_digitos(fecha.getMinutes()) + ':' + dos_digitos(fecha.getSeconds())
  )
}

/**
 * Duración de una consulta: milisegundos hasta un segundo, segundos con un decimal después.
 *
 * @param {number|null} ms
 * @returns {string}
 */
export function duracion_visible(ms) {
  if (ms === null || ms === undefined || ms === '') {
    return '—'
  }
  const valor = Number(ms)
  if (isNaN(valor)) {
    return '—'
  }
  if (valor < 1000) {
    return Math.round(valor) + ' ms'
  }
  return (valor / 1000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' s'
}
