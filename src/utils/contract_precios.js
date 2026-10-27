/**
 * Planes de Gestión por ventas mensuales (misma política que el manual de precios y la API).
 * `limite` son las ventas por mes que cubre el plan; `abono` va en ARS y es null cuando el plan es
 * a medida (importe libre, se carga a mano).
 */
export const PLANES_GESTION = [
  { clave: 'inicial', nombre: 'Inicial', limite: 300, abono: 34200 },
  { clave: 'estandar', nombre: 'Estándar', limite: 1500, abono: 71500 },
  { clave: 'pro', nombre: 'Pro', limite: 7000, abono: 105600 },
  { clave: 'a_medida', nombre: 'A medida', limite: null, abono: null },
]

/**
 * Un contrato nuevo no trae plan elegido («Sin plan»): el abono de Gestión arranca en el del
 * plan Estándar y el operador elige el plan (que lo precarga) o carga el importe acordado.
 */
const ABONO_GESTION_POR_DEFECTO = 71500

/** Importes acordados para nuevos contratos; se copian para que cada contrato sea editable. */
export function precios_por_defecto() {
  return {
    gestion: { licencia: 800, mensualidad: ABONO_GESTION_POR_DEFECTO },
    ecommerce: { licencia: 500, mensualidad: 20000 },
    agentes: { licencia: 500, mensualidad: 30000 },
  }
}

export function tiene_condiciones_guardadas(c) {
  return ['contract_client_name', 'contract_client_razon_social', 'contract_client_cuit',
    'contract_precio_licencia', 'contract_mensualidad_base', 'contract_modalidad', 'contract_fecha_emision',
    'contract_fecha_primer_pago_unico', 'contract_fecha_primer_pago_mensual', 'contract_permanencia_meses']
    .some(k => c[k] !== null && c[k] !== undefined && c[k] !== '') ||
    ['contract_financiacion', 'contract_clausulas_particulares', 'contract_sistemas'].some(k => Array.isArray(c[k]) && c[k].length > 0) ||
    c.contract_mes_gratis === true ||
    (c.contract_plan_gestion != null && c.contract_plan_gestion !== '') ||
    c.contract_pago_anual === true ||
    c.contract_descuento_conjunto != null ||
    (c.contract_currency != null && c.contract_currency !== '' && c.contract_currency !== 'USD') ||
    (c.contract_mensualidad_moneda != null && c.contract_mensualidad_moneda !== '' && c.contract_mensualidad_moneda !== 'ARS') ||
    (c.contract_meses_actualizacion != null && Number(c.contract_meses_actualizacion) !== 6) ||
    Number(c.contract_usuarios_extra) > 0 || Number(c.contract_perfiles_ecommerce) > 0
}

export function iniciar_precios_por_sistema(c) {
  c.contract_precios_sistemas = precios_por_defecto()
  c.contract_plan_gestion = null
  c.contract_descuento_conjunto = 300
  c.contract_mes_gratis = false
  c.contract_meses_actualizacion = 6
  c.contract_modalidad = 'licencia'
  c.contract_currency = 'USD'
  c.contract_mensualidad_moneda = 'ARS'
  c.contract_perfiles_ecommerce = 0
  c.contract_precio_perfil_ecommerce = ''
  if (!Array.isArray(c.contract_sistemas) || !c.contract_sistemas.length) c.contract_sistemas = ['gestion']
  actualizar_totales(c)
}

/**
 * Elige el plan de Gestión del contrato. Un plan con abono precarga la mensualidad de Gestión
 * (sigue siendo editable); a medida y la opción vacía (importe acordado) no tocan el importe.
 */
export function elegir_plan_gestion(c, clave) {
  const plan = PLANES_GESTION.find(p => p.clave === clave)
  c.contract_plan_gestion = plan ? plan.clave : null
  if (plan && plan.abono != null && c.contract_precios_sistemas?.gestion) {
    c.contract_precios_sistemas.gestion.mensualidad = plan.abono
    actualizar_totales(c)
  }
}

export function resumen_precios(c) {
  const elegidos = Array.isArray(c.contract_sistemas) ? c.contract_sistemas : []
  const precios = c.contract_precios_sistemas || {}
  let subtotal = 0
  let mensualidad = 0
  const keys = ['gestion', 'ecommerce', 'agentes'].filter(k => elegidos.includes(k))
  keys.forEach(k => {
    subtotal += Number(precios[k]?.licencia) || 0
    mensualidad += Number(precios[k]?.mensualidad) || 0
  })
  const descuento = keys.length === 3 ? Number(c.contract_descuento_conjunto ?? 300) || 0 : 0
  return { subtotal, descuento, total: subtotal - descuento, mensualidad, tres: keys.length === 3 }
}

export function actualizar_totales(c) {
  if (!c?.contract_precios_sistemas) return
  const resumen = resumen_precios(c)
  c.contract_precio_licencia = String(resumen.total)
  c.contract_mensualidad_base = String(resumen.mensualidad)
}

export function aplicar_defaults_anuales(c) {
  if (c.contract_pago_anual == null) c.contract_pago_anual = false
  if (c.contract_descuento_anual == null) c.contract_descuento_anual = 20
}

/** Mismos separadores argentinos que ClientContratoService::monto_desde_texto. */
export function monto_de_texto(valor) {
  if (typeof valor === 'number') return valor
  let limpio = String(valor ?? '').replace(/[^0-9.,]/g, '')
  const punto = limpio.lastIndexOf('.')
  const coma = limpio.lastIndexOf(',')
  if (punto >= 0 && coma >= 0) {
    const decimal = punto > coma ? '.' : ','
    const miles = decimal === '.' ? ',' : '.'
    return Number(limpio.split(miles).join('').replace(decimal, '.')) || 0
  }
  const separador = punto >= 0 ? '.' : coma >= 0 ? ',' : null
  if (!separador) return Number(limpio) || 0
  const partes = limpio.split(separador)
  if (partes.slice(1).every(p => p.length === 3)) limpio = partes.join('')
  return Number(limpio.replace(',', '.')) || 0
}

export function resumen_anual(c) {
  const base = c.contract_precios_sistemas ? resumen_precios(c).mensualidad : monto_de_texto(c.contract_mensualidad_base)
  const porcentaje = c.contract_descuento_anual == null ? 20 : Number(c.contract_descuento_anual)
  const bruto = Math.round(base * 12 * 100) / 100
  const descuento = Math.round(bruto * porcentaje) / 100
  const extras = Math.round(Number(c.contract_usuarios_extra || 0) * monto_de_texto(c.contract_precio_usuario_extra) * 100) / 100
  return { base, porcentaje, bruto, descuento, total: Math.round((bruto - descuento) * 100) / 100, extras }
}
