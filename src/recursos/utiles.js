/**
 * Funciones chicas de formato que usan varios componentes del centro de recursos. Son las del
 * prototipo aprobado (`_video/centro-prototipo/plantilla.html`), pasadas a módulo.
 */

/**
 * Línea que reemplaza al avance, los votos, la caja de preguntas y la encuesta cuando no hay
 * sesión (texto del plan, §5.1).
 */
export const LINEA_INVITADO = 'Entrá desde tu sistema (menú → Centro de recursos) para guardar tu avance y hacer preguntas.'

/**
 * Segundos a `m:ss` (ej. 75 → "1:15").
 *
 * @param {number} segundos
 * @returns {string}
 */
export function mmss(segundos) {
  /** Segundos redondeados y nunca negativos. */
  const s = Math.max(0, Math.round(Number(segundos) || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

/**
 * Número visible de un video a partir de su código (ej. "T1.29" → "1.29"), como en las migas
 * del prototipo.
 *
 * @param {string} codigo
 * @returns {string}
 */
export function numero_de(codigo) {
  return String(codigo || '').replace(/^[A-Za-z]+/, '')
}

/**
 * Corta un texto largo con "…" (para los botones "Siguiente: …").
 *
 * @param {string} texto
 * @param {number} maximo Largo a partir del cual se corta.
 * @returns {string}
 */
export function recortar(texto, maximo) {
  /** Texto de entrada como string. */
  const t = String(texto || '')
  return t.length > maximo ? t.slice(0, maximo - 2) + '…' : t
}

/**
 * Pasa una fecha del backend a milisegundos. Acepta ISO 8601 (lo que serializa Laravel) y el
 * formato `AAAA-MM-DD HH:MM:SS` por si algún endpoint la arma a mano.
 *
 * @param {string|number|null} fecha
 * @returns {number|null}
 */
export function a_milisegundos(fecha) {
  if (fecha == null || fecha === '') {
    return null
  }
  if (typeof fecha === 'number') {
    return fecha
  }
  /** Intento directo. */
  let ms = Date.parse(fecha)
  if (isNaN(ms)) {
    ms = Date.parse(String(fecha).replace(' ', 'T'))
  }
  return isNaN(ms) ? null : ms
}

/**
 * "recién", "hace 5 min", "hace 3 h", "ayer", "hace 4 días" — igual que el prototipo.
 *
 * @param {string|number|null} fecha
 * @returns {string}
 */
export function cuando(fecha) {
  /** Fecha en milisegundos. */
  const ms = a_milisegundos(fecha)
  if (ms == null) {
    return ''
  }
  /** Segundos transcurridos. */
  const d = (Date.now() - ms) / 1000
  if (d < 60) {
    return 'recién'
  }
  if (d < 3600) {
    return 'hace ' + Math.floor(d / 60) + ' min'
  }
  if (d < 86400) {
    return 'hace ' + Math.floor(d / 3600) + ' h'
  }
  /** Días enteros. */
  const n = Math.floor(d / 86400)
  return n === 1 ? 'ayer' : 'hace ' + n + ' días'
}

/**
 * Texto en minúsculas y sin acentos, para buscar ("imágen" encuentra "imagen").
 *
 * @param {string} texto
 * @returns {string}
 */
export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Primera letra de un nombre, para el avatar.
 *
 * @param {string} nombre
 * @returns {string}
 */
export function inicial(nombre) {
  /** Nombre sin espacios al principio. */
  const n = String(nombre || '').trim()
  return n ? n[0].toUpperCase() : '?'
}
