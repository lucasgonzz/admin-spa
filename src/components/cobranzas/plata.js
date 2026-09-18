/**
 * Formato de montos del módulo Cobranzas (misión modulo-cobranzas, 18/9/2026).
 *
 * Mismo criterio visual que `format_numero` de la pestaña Mensualidad y que la Blade de la
 * factura: separador de miles del español rioplatense y sin decimales, porque en la planilla de
 * Lucas los centavos no existen. Vive aparte para que las dos vistas, el badge y las pestañas
 * escriban la plata igual sin copiarse la función.
 */

/**
 * Número con separador de miles y sin decimales: `1234567.8` → `1.234.568`.
 *
 * @param {number|string|null|undefined} valor
 * @returns {string}
 */
export function format_numero(valor) {
  return Number(valor || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

/**
 * Monto en pesos con el signo adelante: `$1.234.568`. Es la forma de la mensualidad, que siempre
 * es en pesos.
 *
 * @param {number|string|null|undefined} valor
 * @returns {string}
 */
export function format_plata(valor) {
  return '$' + format_numero(valor)
}

/**
 * Monto con la moneda adelante: `USD 1.200`, `ARS 500.000`. Es la forma de las licencias, donde
 * conviven las dos monedas y un número pelado no dice nada.
 *
 * @param {number|string|null|undefined} valor
 * @param {string|null|undefined} moneda código de tres letras; si falta se asume USD
 * @returns {string}
 */
export function format_monto_con_moneda(valor, moneda) {
  return String(moneda || 'USD').toUpperCase() + ' ' + format_numero(valor)
}

/**
 * Resume un mapa `{USD: 1200, ARS: 500000}` en una sola línea: `USD 1.200 · ARS 500.000`.
 * Las monedas en cero se omiten: "ARS 0" al lado de "USD 1.200" es ruido, no información.
 *
 * @param {Object<string, number>|null|undefined} por_moneda
 * @returns {string} '—' si no hay nada distinto de cero
 */
export function format_por_moneda(por_moneda) {
  if (!por_moneda || typeof por_moneda !== 'object') {
    return '—'
  }
  const partes = []
  Object.keys(por_moneda).forEach(function (moneda) {
    if (Number(por_moneda[moneda] || 0) !== 0) {
      partes.push(format_monto_con_moneda(por_moneda[moneda], moneda))
    }
  })
  return partes.length ? partes.join(' · ') : '—'
}
