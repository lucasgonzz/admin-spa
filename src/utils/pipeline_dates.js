/**
 * Fechas del módulo de Pipelines (CRM) — misión pipelines-crm, 27/9/2026.
 *
 * El contrato con admin-api es de texto y en hora local de Buenos Aires, nunca ISO con `Z`:
 *   - la API devuelve `Y-m-d H:i:s` (una fecha sin hora viaja con `00:00:00`);
 *   - la SPA manda `Y-m-d` para una fecha y `Y-m-d H:i` para fecha y hora.
 *
 * 🔴 Todo lo que se lee o se manda pasa por acá, para que ningún componente convierta por su
 * cuenta. Un `new Date(texto).toISOString()` corre la hora tres horas (la trampa de
 * "toArray() serializa las fechas con Z", memoria del pool 21/9/2026). Por eso se parsea con
 * moment en modo ESTRICTO y sin zona: el texto se interpreta y se vuelve a escribir en la misma
 * hora local, sin pasar nunca por UTC.
 *
 * No se activa el locale 'es' de moment (mismo criterio que utils/relative_time.js: cambiaría el
 * formateo del resto del sistema). Los nombres de los días van escritos acá.
 */
import moment from 'moment'
import { time_ago } from '@/utils/relative_time'

/** Formatos que puede mandar la API, del más completo al más corto. */
const API_FORMATS = ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD']

/** Días de la semana abreviados, empezando en domingo (índice de `moment().day()`). */
const SHORT_WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/**
 * Interpreta un texto de fecha de la API (`Y-m-d H:i:s`, `Y-m-d H:i` o `Y-m-d`).
 *
 * @param {string|null|undefined} value
 * @returns {moment.Moment|null} null si viene vacío o no respeta ninguno de los formatos.
 */
export function parse_api_date(value) {
  if (value === null || value === undefined) {
    return null
  }
  const text = String(value).trim()
  if (text === '') {
    return null
  }
  const parsed = moment(text, API_FORMATS, true)
  return parsed.isValid() ? parsed : null
}

/**
 * true si la fecha tiene una hora distinta de las 00:00 (así la API representa "sin hora").
 *
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
export function has_time(value) {
  const parsed = parse_api_date(value)
  if (!parsed) {
    return false
  }
  return parsed.hours() !== 0 || parsed.minutes() !== 0
}

/**
 * `DD/MM/YYYY`.
 *
 * @param {string|null|undefined} value
 * @returns {string} Vacío si no hay fecha válida.
 */
export function format_date(value) {
  const parsed = parse_api_date(value)
  return parsed ? parsed.format('DD/MM/YYYY') : ''
}

/**
 * `HH:mm`, o vacío si no tiene hora (00:00) o no es válida.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function format_time(value) {
  if (!has_time(value)) {
    return ''
  }
  return parse_api_date(value).format('HH:mm')
}

/**
 * `DD/MM/YYYY HH:mm`, sin la hora cuando es 00:00.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function format_datetime(value) {
  const parsed = parse_api_date(value)
  if (!parsed) {
    return ''
  }
  const time = format_time(value)
  return parsed.format('DD/MM/YYYY') + (time ? ' ' + time : '')
}

/**
 * Forma corta para tarjetas y listas: `mié 30/9` o `mié 30/9 · 15:00`. Agrega el año solo si
 * no es el año en curso, para no gastar ancho en lo obvio.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function format_short(value) {
  const parsed = parse_api_date(value)
  if (!parsed) {
    return ''
  }
  let text = SHORT_WEEKDAYS[parsed.day()] + ' ' + parsed.format('D/M')
  if (parsed.year() !== moment().year()) {
    text = text + '/' + parsed.format('YY')
  }
  const time = format_time(value)
  return time ? text + ' · ' + time : text
}

/**
 * "hace 3 días", "hace 2 h"… a partir de un texto de la API.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function format_relative(value) {
  const parsed = parse_api_date(value)
  return parsed ? time_ago(parsed) : ''
}

/**
 * Valor de un `<input type="date">` (`YYYY-MM-DD`) listo para mandar: la API lo pide tal cual.
 *
 * @param {string|null|undefined} input_value
 * @returns {string|null} null si está vacío o no es una fecha válida.
 */
export function date_input_to_api(input_value) {
  const text = String(input_value || '').trim()
  if (text === '') {
    return null
  }
  const parsed = moment(text, 'YYYY-MM-DD', true)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
}

/**
 * Valor de un `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`) convertido a `Y-m-d H:i`:
 * la `T` pasa a espacio y los segundos, si el navegador los agregó, se descartan.
 *
 * @param {string|null|undefined} input_value
 * @returns {string|null} null si está vacío o no es válido.
 */
export function datetime_local_to_api(input_value) {
  const text = String(input_value || '').trim().replace('T', ' ')
  if (text === '') {
    return null
  }
  const parsed = moment(text, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss'], true)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : null
}

/**
 * Arma `next_action_at` a partir de un input de fecha y uno de hora (opcional):
 * `Y-m-d` si no hay hora, `Y-m-d H:i` si la hay. Sin fecha devuelve null (quitar la próxima acción).
 *
 * @param {string} date_value Valor de `<input type="date">`.
 * @param {string} time_value Valor de `<input type="time">` (puede venir vacío).
 * @returns {string|null}
 */
export function build_next_action_value(date_value, time_value) {
  const date = date_input_to_api(date_value)
  if (!date) {
    return null
  }
  const time = String(time_value || '').trim()
  if (time === '') {
    return date
  }
  const parsed_time = moment(time, ['HH:mm', 'HH:mm:ss'], true)
  if (!parsed_time.isValid()) {
    return date
  }
  return date + ' ' + parsed_time.format('HH:mm')
}

/**
 * Parte un texto de la API en los valores de un input de fecha y uno de hora, para editarlo.
 * La hora queda vacía si era 00:00 (la API no distingue "sin hora" de medianoche).
 *
 * @param {string|null|undefined} value
 * @returns {{ date: string, time: string }}
 */
export function split_for_inputs(value) {
  const parsed = parse_api_date(value)
  if (!parsed) {
    return { date: '', time: '' }
  }
  return { date: parsed.format('YYYY-MM-DD'), time: format_time(value) }
}

/**
 * Texto de la API convertido al valor de un `<input type="datetime-local">`.
 *
 * @param {string|null|undefined} value
 * @returns {string} `YYYY-MM-DDTHH:mm`, o vacío.
 */
export function api_to_datetime_local(value) {
  const parsed = parse_api_date(value)
  return parsed ? parsed.format('YYYY-MM-DD[T]HH:mm') : ''
}
