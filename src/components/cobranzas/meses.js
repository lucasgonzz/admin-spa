/**
 * Utilidades de meses y fechas del módulo Cobranzas (misión modulo-cobranzas, 18/9/2026).
 *
 * Todo el módulo habla de "períodos" en formato `YYYY-MM` (es lo que viaja en la API: `periodo`,
 * `meses`, `rango.desde`/`rango.hasta`). Acá vive la única implementación de cómo se etiquetan,
 * cómo se recorren y cómo se comparan, para que las dos vistas, el modal del cliente y las
 * pestañas no tengan cada una su copia de la misma cuenta.
 *
 * 🔴 Nada de acá usa `new Date('YYYY-MM-DD')`: esa forma se interpreta como UTC y en Argentina
 * (UTC-3) devuelve el día anterior al leerla en hora local. Las fechas se parten a mano.
 */

/** Etiquetas cortas de los meses, en español y en minúscula, como en la planilla de Lucas. */
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Nombres completos de los meses, para los títulos y los textos largos. */
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/**
 * Parte un período `YYYY-MM` (o una fecha `YYYY-MM-DD`, o un ISO con hora) en año y mes.
 *
 * @param {string|null|undefined} periodo
 * @returns {{anio: number, mes: number}|null} `mes` va de 1 a 12; null si el texto no tiene forma de período.
 */
export function partes_de_periodo(periodo) {
  const texto = String(periodo || '').slice(0, 7)
  const coincidencia = /^(\d{4})-(\d{2})$/.exec(texto)
  if (!coincidencia) {
    return null
  }
  const anio = Number(coincidencia[1])
  const mes = Number(coincidencia[2])
  if (mes < 1 || mes > 12) {
    return null
  }
  return { anio: anio, mes: mes }
}

/**
 * Arma un período `YYYY-MM` a partir de un año y un mes (1 a 12).
 *
 * @param {number} anio
 * @param {number} mes
 * @returns {string}
 */
export function periodo_de(anio, mes) {
  return anio + '-' + String(mes).padStart(2, '0')
}

/**
 * Etiqueta corta de un período: `sep 26`. Es la de la tira de meses y de los encabezados de
 * columna, donde entran doce o más meses en una fila.
 *
 * @param {string|null|undefined} periodo `YYYY-MM`
 * @returns {string} '—' si el período no se puede leer.
 */
export function etiqueta_corta(periodo) {
  const partes = partes_de_periodo(periodo)
  if (!partes) {
    return '—'
  }
  return MESES_CORTOS[partes.mes - 1] + ' ' + String(partes.anio).slice(2)
}

/**
 * Etiqueta larga de un período: `septiembre 2026`. Para títulos, confirmaciones y toasts.
 *
 * @param {string|null|undefined} periodo `YYYY-MM`
 * @returns {string} '—' si el período no se puede leer.
 */
export function etiqueta_larga(periodo) {
  const partes = partes_de_periodo(periodo)
  if (!partes) {
    return '—'
  }
  return MESES_LARGOS[partes.mes - 1] + ' ' + partes.anio
}

/**
 * Mes corriente en `YYYY-MM`, en hora local de la máquina del operador.
 *
 * @returns {string}
 */
export function mes_corriente() {
  const hoy = new Date()
  return periodo_de(hoy.getFullYear(), hoy.getMonth() + 1)
}

/**
 * Fecha de hoy en `YYYY-MM-DD`, en hora local (para los defaults de los inputs type="date").
 *
 * @returns {string}
 */
export function hoy_iso() {
  const hoy = new Date()
  return (
    hoy.getFullYear() +
    '-' +
    String(hoy.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(hoy.getDate()).padStart(2, '0')
  )
}

/**
 * Suma (o resta, con delta negativo) meses a un período.
 *
 * @param {string} periodo `YYYY-MM`
 * @param {number} delta cantidad de meses; negativo para ir hacia atrás
 * @returns {string} el período resultante, o el mismo de entrada si no se pudo leer
 */
export function sumar_meses(periodo, delta) {
  const partes = partes_de_periodo(periodo)
  if (!partes) {
    return periodo
  }
  /* Se trabaja con un índice absoluto de meses para que el acarreo de años salga solo. */
  const indice = partes.anio * 12 + (partes.mes - 1) + Number(delta || 0)
  const anio = Math.floor(indice / 12)
  const mes = (indice % 12) + 1
  return periodo_de(anio, mes)
}

/**
 * Lista de períodos consecutivos entre `desde` y `hasta`, ambos incluidos, en orden ascendente.
 *
 * @param {string} desde `YYYY-MM`
 * @param {string} hasta `YYYY-MM`
 * @returns {string[]} vacío si alguno de los dos no se puede leer o si `hasta` es anterior a `desde`
 */
export function lista_de_meses(desde, hasta) {
  const inicio = partes_de_periodo(desde)
  const fin = partes_de_periodo(hasta)
  if (!inicio || !fin) {
    return []
  }
  const meses = []
  let cursor = periodo_de(inicio.anio, inicio.mes)
  const tope = periodo_de(fin.anio, fin.mes)
  /* Red de seguridad, no un límite funcional: un rango corrupto no tiene que colgar el navegador.
     Veinte años de meses son más que cualquier historial real de cobranzas. */
  let vueltas = 0
  while (cursor <= tope && vueltas < 240) {
    meses.push(cursor)
    cursor = sumar_meses(cursor, 1)
    vueltas++
  }
  return meses
}

/**
 * Cantidad de meses calendario transcurridos desde una fecha hasta hoy. Marzo → septiembre son
 * seis meses aunque el día del mes no haya llegado: es la cuenta que hace Lucas cuando dice
 * "hace seis meses que no se actualiza".
 *
 * @param {string|null|undefined} fecha `YYYY-MM-DD` o ISO con hora
 * @returns {number|null} null si la fecha no se puede leer
 */
export function meses_desde(fecha) {
  const partes = partes_de_periodo(fecha)
  if (!partes) {
    return null
  }
  const hoy = new Date()
  return (hoy.getFullYear() - partes.anio) * 12 + (hoy.getMonth() + 1 - partes.mes)
}

/**
 * Texto "hace N meses" / "este mes" / "hace 1 mes" a partir de una fecha.
 *
 * @param {string|null|undefined} fecha `YYYY-MM-DD` o ISO
 * @returns {string} vacío si la fecha no se puede leer
 */
export function texto_hace_meses(fecha) {
  const meses = meses_desde(fecha)
  if (meses === null) {
    return ''
  }
  if (meses <= 0) {
    return 'este mes'
  }
  if (meses === 1) {
    return 'hace 1 mes'
  }
  return 'hace ' + meses + ' meses'
}

/**
 * Fecha `YYYY-MM-DD` (o ISO con hora) como `dd/mm/yyyy`, sin pasar por `new Date` para que un
 * `2026-03-12` no se convierta en 11/03 por el huso horario.
 *
 * @param {string|null|undefined} fecha
 * @returns {string} '—' si viene vacía o ilegible
 */
export function formatear_fecha(fecha) {
  const texto = String(fecha || '').slice(0, 10)
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  if (!coincidencia) {
    return fecha ? String(fecha) : '—'
  }
  return coincidencia[3] + '/' + coincidencia[2] + '/' + coincidencia[1]
}

/**
 * Primer día del mes de un período, en `YYYY-MM-DD`. Es como el backend guarda
 * `mensualidad_inicio` y como se arma un `vencimiento` a partir de un mes.
 *
 * @param {string|null|undefined} periodo `YYYY-MM`
 * @returns {string|null}
 */
export function primer_dia_de(periodo) {
  const partes = partes_de_periodo(periodo)
  if (!partes) {
    return null
  }
  return periodo_de(partes.anio, partes.mes) + '-01'
}
