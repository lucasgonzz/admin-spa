/**
 * Formateo de fechas de la API en hora de Argentina (misión embudo-juan-pipeline, E2, ronda 3).
 *
 * Por qué existe: `format_datetime` de `utils/pipeline_dates.js` sólo acepta `YYYY-MM-DD HH:mm:ss` estricto (así
 * manda la API las fechas del CRM), pero las fechas de la ficha del cliente llegan en ISO con zona:
 *   - `GET client` (casts datetime de Laravel 8):  `2026-11-23T15:00:00.000000Z`
 *   - rutas de la ficha (`toIso8601String`):       `2026-11-23T12:00:00-03:00`
 * y con ese formateador las cinco fechas del bloque «Implementación contratada» salían siempre «—».
 * `pipeline_dates.js` lo usan otros módulos y no se toca: este es un formateador aparte.
 *
 * Es JavaScript sin imports a propósito (como `utils/solo_leads.js`): `pruebas/implementacion-contratada-fechas.cjs`
 * lo lee tal cual y lo ejecuta en Node. Y no usa `Intl` ni `moment`: Argentina está en UTC-3 todo el año (no tiene
 * horario de verano desde 2009), así que alcanza con restar tres horas, sin depender de los datos de zona horaria del
 * navegador.
 */

/** Desfase de Argentina respecto de UTC, en minutos (UTC-3, sin horario de verano). */
const DESFASE_ARGENTINA_MINUTOS = -180

/**
 * Formato que se acepta: `YYYY-MM-DD`, o con hora (`T` o espacio, con o sin segundos y con o sin fracción) y, opcional,
 * la zona (`Z`, `+hh:mm`, `-hh:mm` o `+hhmm`).
 *
 * Grupos: 1 año, 2 mes, 3 día, 4 hora, 5 minuto, 6 segundo, 7 zona.
 */
const FORMATO_DE_FECHA = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/

/**
 * Rellena con ceros a la izquierda hasta dos dígitos.
 *
 * @param {number} numero Número a mostrar.
 * @returns {string}
 */
function dos_digitos(numero) {
  return (numero < 10 ? '0' : '') + numero
}

/**
 * Pasa una zona (`Z`, `-03:00`, `+0100`) a minutos respecto de UTC.
 *
 * @param {string} zona Zona tal como viene en el texto.
 * @returns {number} Minutos; 0 para `Z`.
 */
function minutos_de_la_zona(zona) {
  if (zona === 'Z') {
    return 0
  }
  const signo = zona.charAt(0) === '-' ? -1 : 1
  const digitos = zona.slice(1).replace(':', '')
  return signo * (Number(digitos.slice(0, 2)) * 60 + Number(digitos.slice(2, 4)))
}

/**
 * Formatea una fecha de la API como `DD/MM/YYYY HH:mm` en hora de Argentina.
 *
 * - Con zona (`Z`, `-03:00`…): el instante se convierte a la hora argentina.
 * - Sin zona y con hora (`2026-11-23 12:00:00`): ya está en hora local, se muestra tal cual.
 * - Sólo fecha: `DD/MM/YYYY`.
 *
 * @param {string|null|undefined} valor Fecha de la API.
 * @returns {string} Vacío si no hay fecha o no se puede leer: quien la muestra pone «—».
 */
export function formatear_fecha_argentina(valor) {
  if (valor === null || valor === undefined) {
    return ''
  }
  const partes = FORMATO_DE_FECHA.exec(String(valor).trim())
  if (!partes) {
    return ''
  }
  const anio = Number(partes[1])
  const mes = Number(partes[2])
  const dia = Number(partes[3])
  const tiene_hora = partes[4] !== undefined
  const hora = tiene_hora ? Number(partes[4]) : 0
  const minuto = tiene_hora ? Number(partes[5]) : 0
  const segundo = partes[6] !== undefined ? Number(partes[6]) : 0

  /* Fecha imposible (mes 13, día 45, hora 99…): se comprueba contra el calendario, que no la "corrige" en silencio. */
  const instante_local = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto, segundo))
  const es_real = instante_local.getUTCFullYear() === anio && instante_local.getUTCMonth() === mes - 1 &&
    instante_local.getUTCDate() === dia && hora < 24 && minuto < 60 && segundo < 60
  if (!es_real) {
    return ''
  }

  /* Hora argentina = lo escrito menos el desfase de su zona, más el de Argentina. Sin zona se toma como argentina. */
  let argentina = instante_local
  if (partes[7] !== undefined) {
    const utc = instante_local.getTime() - minutos_de_la_zona(partes[7]) * 60000
    argentina = new Date(utc + DESFASE_ARGENTINA_MINUTOS * 60000)
  }

  const fecha = dos_digitos(argentina.getUTCDate()) + '/' + dos_digitos(argentina.getUTCMonth() + 1) + '/' + argentina.getUTCFullYear()
  if (!tiene_hora) {
    return fecha
  }
  return fecha + ' ' + dos_digitos(argentina.getUTCHours()) + ':' + dos_digitos(argentina.getUTCMinutes())
}
