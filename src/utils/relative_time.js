import moment from 'moment'

/**
 * Devuelve un texto corto en español indicando hace cuánto ocurrió una fecha
 * (ej: "hace 5 min", "hace 3 h", "hace 2 días", "hace 1 mes").
 *
 * Se implementa a mano (sin activar el locale global 'es' de moment) para no
 * alterar el formateo de fechas del resto del sistema, que depende del locale
 * por defecto de moment.
 *
 * @param {string|Date|null|undefined} value  Fecha de origen (ISO string, Date, etc).
 * @returns {string}  Texto corto en español, o cadena vacía si no es parseable.
 */
export function time_ago(value) {
  // Sin valor: no hay nada que mostrar.
  if (!value) {
    return ''
  }

  const date = moment(value)

  // Fecha inválida (no parseable): devolver vacío en vez de "Invalid date".
  if (!date.isValid()) {
    return ''
  }

  // Diferencia en segundos respecto de ahora (siempre positiva, tratamos como pasado).
  const diff_seconds = Math.max(0, moment().diff(date, 'seconds'))

  // Menos de 1 minuto.
  if (diff_seconds < 60) {
    return 'hace instantes'
  }

  // Minutos.
  const diff_minutes = Math.floor(diff_seconds / 60)
  if (diff_minutes < 60) {
    return 'hace ' + diff_minutes + ' min'
  }

  // Horas.
  const diff_hours = Math.floor(diff_minutes / 60)
  if (diff_hours < 24) {
    return 'hace ' + diff_hours + ' h'
  }

  // Días.
  const diff_days = Math.floor(diff_hours / 24)
  if (diff_days < 30) {
    return 'hace ' + diff_days + (diff_days === 1 ? ' día' : ' días')
  }

  // Meses (aproximado a 30 días).
  const diff_months = Math.floor(diff_days / 30)
  if (diff_months < 12) {
    return 'hace ' + diff_months + (diff_months === 1 ? ' mes' : ' meses')
  }

  // Años.
  const diff_years = Math.floor(diff_months / 12)
  return 'hace ' + diff_years + (diff_years === 1 ? ' año' : ' años')
}
