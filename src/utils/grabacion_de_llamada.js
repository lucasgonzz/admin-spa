/**
 * Lógica pura de la grabación de la llamada de Juan (misión leads-referidos-compromisos, etapa E3).
 *
 * Juan graba la llamada con el celular y sube el archivo en «Registrar llamada». El archivo puede pesar decenas de megas y el límite
 * de subida del servidor no está medido, así que se sube en partes de 4 MB: `POST lead/{id}/llamadas/{llamada}/grabacion` (qué archivo
 * viene), `…/grabacion/partes` (una parte por pedido, con reintento) y `…/grabacion/completar` (une y manda a transcribir). La API
 * (`LeadLlamadaGrabacionService`) vuelve a validar todo: acá se replican sus reglas SÓLO para avisar en la pantalla antes de subir.
 *
 * Es JavaScript sin imports a propósito: `pruebas/leads-referidos-compromisos-e3.cjs` lo lee tal cual y lo ejecuta en Node, así que
 * no puede depender de Vue ni de axios (misma convención que `utils/registrar_llamada.js`).
 */

/**
 * Extensiones de audio que acepta la API (las mismas de `LeadLlamadaGrabacionService::EXTENSIONES`).
 *
 * @type {Array<string>}
 */
export const EXTENSIONES = ['m4a', 'mp3', 'mp4', 'aac', 'ogg', 'opus', 'oga', 'wav', 'webm', 'flac', 'amr', '3gp']

/** Tamaño de cada parte de la subida: 4 MB. */
export const PARTE_BYTES = 4194304

/** Tamaño máximo del archivo: 200 MB (el tope de la API; puede ser menor si el servidor lo cambia y entonces responde 422). */
export const MAXIMO_BYTES = 209715200

/** Cuántas veces se intenta subir cada parte antes de rendirse (una mala señal del celular no tira la subida entera). */
export const INTENTOS_POR_PARTE = 3

/**
 * Las extensiones aceptadas, escritas para un mensaje («m4a, mp3, mp4…»).
 *
 * @returns {string}
 */
function extensiones_en_palabras() {
  return EXTENSIONES.join(', ')
}

/**
 * Extensión de un nombre de archivo, en minúsculas y sin el punto. Es lo que viene después del ÚLTIMO punto: `llamada.m4a.exe` es un
 * `exe`, no un `m4a`. Sin punto no hay extensión.
 *
 * @param {string} nombre Nombre del archivo.
 * @returns {string}
 */
export function extension_de(nombre) {
  const texto = String(nombre || '').trim()
  const punto = texto.lastIndexOf('.')
  if (punto === -1 || punto === texto.length - 1) {
    return ''
  }
  return texto.slice(punto + 1).toLowerCase()
}

/**
 * Pasa una cantidad de bytes a megabytes para mostrar («10,5 MB»).
 *
 * @param {number} bytes
 * @returns {string}
 */
export function tamano_en_palabras(bytes) {
  const megas = Number(bytes || 0) / 1048576
  if (megas < 0.1) {
    return '0,1 MB'
  }
  return (Math.round(megas * 10) / 10).toString().replace('.', ',') + ' MB'
}

/**
 * Valida el archivo elegido ANTES de subirlo: tiene que ser de audio (por su extensión), no estar vacío y no pasar los 200 MB.
 *
 * @param {string} nombre Nombre del archivo.
 * @param {number} bytes  Tamaño en bytes.
 * @returns {{ ok: boolean, mensaje: string }} `mensaje` está en castellano y es '' cuando `ok` es true.
 */
export function validar_archivo(nombre, bytes) {
  if (String(nombre || '').trim() === '') {
    return { ok: false, mensaje: 'El archivo no tiene nombre. Elegí otra grabación.' }
  }
  if (EXTENSIONES.indexOf(extension_de(nombre)) === -1) {
    return { ok: false, mensaje: 'El archivo tiene que ser un audio (' + extensiones_en_palabras() + ').' }
  }
  if (!(Number(bytes) > 0)) {
    return { ok: false, mensaje: 'El archivo está vacío. Elegí otra grabación.' }
  }
  if (Number(bytes) > MAXIMO_BYTES) {
    return { ok: false, mensaje: 'El archivo pesa ' + tamano_en_palabras(bytes) + ' y el máximo son 200 MB.' }
  }
  return { ok: true, mensaje: '' }
}

/**
 * Parte un archivo de `bytes` bytes en partes de 4 MB (la última, lo que sobre).
 *
 * @param {number} bytes Tamaño del archivo.
 * @returns {Array<{ indice: number, desde: number, hasta: number, bytes: number }>} `hasta` es exclusivo (se usa con `File.slice(desde, hasta)`).
 */
export function partir_en_partes(bytes) {
  const partes = []
  const total = Number(bytes) > 0 ? Number(bytes) : 0
  for (let desde = 0; desde < total; desde += PARTE_BYTES) {
    const hasta = Math.min(desde + PARTE_BYTES, total)
    partes.push({ indice: partes.length, desde: desde, hasta: hasta, bytes: hasta - desde })
  }
  return partes
}

/**
 * Etiqueta, en castellano, de cada estado de la grabación.
 *
 * @param {string} status `subiendo`, `pendiente`, `transcribiendo`, `lista` o `error`.
 * @returns {string} '' si el estado no se conoce.
 */
export function etiqueta_de_estado(status) {
  const etiquetas = {
    subiendo: 'Subiendo el audio',
    pendiente: 'En cola para transcribir',
    transcribiendo: 'Transcribiendo',
    lista: 'Transcripta',
    error: 'No se pudo transcribir',
  }
  return Object.prototype.hasOwnProperty.call(etiquetas, status) ? etiquetas[status] : ''
}

/**
 * Cada cuántos milisegundos conviene volver a mirar el estado de una grabación que todavía no terminó.
 *
 * @param {string} status Estado de la grabación.
 * @returns {number} 0 si ya no hay nada que esperar.
 */
export function espera_para_volver_a_mirar(status) {
  return status === 'pendiente' || status === 'transcribiendo' ? 15000 : 0
}
