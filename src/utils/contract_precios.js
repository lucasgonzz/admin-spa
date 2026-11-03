/**
 * Planes de Gestión por OPERACIONES mensuales (ventas + compras + gastos), política del 3/11/2026
 * (programa «Prueba gratuita de 7 días»): misma tabla que `ContractPreciosService::PLANES_GESTION` de
 * la API y que el manual de precios. `desde`/`limite` son las operaciones por mes que cubre el plan;
 * `abono` va en ARS, es el precio final (no se le suma IVA) y es null cuando el plan es a medida
 * (importe libre, se carga a mano). `usuarios` son los incluidos; `excedente`, lo que cuesta cada
 * operación por encima del límite.
 */
export const PLANES_GESTION = [
  { clave: 'inicial', nombre: 'Inicial', desde: 0, limite: 100, abono: 55900, usuarios: 1, excedente: 760 },
  { clave: 'intermedio', nombre: 'Intermedio', desde: 101, limite: 250, abono: 85400, usuarios: 2, excedente: 570 },
  { clave: 'plus', nombre: 'Plus', desde: 251, limite: 500, abono: 199400, usuarios: 2, excedente: 190 },
  { clave: 'empresa', nombre: 'Empresa', desde: 501, limite: 3000, abono: 263000, usuarios: 3, excedente: 76 },
  { clave: 'a_medida', nombre: 'A medida', desde: 3001, limite: null, abono: null, usuarios: 3, excedente: null },
]

/**
 * Los planes de la política anterior (26/10/2026, por VENTAS mensuales). Un contrato que los eligió
 * los conserva: el select los muestra como opción deshabilitada para que no se pierdan al guardar,
 * pero ya no se eligen para un contrato nuevo. El `inicial` histórico comparte la clave con el
 * vigente; se reconoce por su abono de $34.200.
 */
export const PLANES_HISTORICOS = [
  { clave: 'inicial', nombre: 'Inicial', limite: 300, abono: 34200 },
  { clave: 'estandar', nombre: 'Estándar', limite: 1500, abono: 71500 },
  { clave: 'pro', nombre: 'Pro', limite: 7000, abono: 105600 },
]

/**
 * Un contrato nuevo no trae plan elegido («Sin plan»): el abono de Gestión arranca en el del plan
 * Inicial y el operador elige el plan (que lo precarga) o carga el importe acordado.
 */
const ABONO_GESTION_POR_DEFECTO = 55900

/**
 * Importes acordados para nuevos contratos; se copian para que cada contrato sea editable.
 *
 * Desde el 3/11/2026 Gestión NO tiene licencia (el sistema de gestión y la implementación son
 * gratis); Tienda y Agentes conservan la suya, USD 800 cada una (la mitad si se contrata durante la
 * prueba gratuita: se edita a mano). Hasta esa fecha precargaba USD 800 / 500 / 500.
 */
export function precios_por_defecto() {
  return {
    gestion: { licencia: 0, mensualidad: ABONO_GESTION_POR_DEFECTO },
    ecommerce: { licencia: 800, mensualidad: 20000 },
    agentes: { licencia: 800, mensualidad: 30000 },
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
  /* Sin descuento por contratar los tres (era USD 300 cuando el conjunto valía USD 1.500 contra
     USD 1.800 de lista; con Gestión sin licencia ya no hay conjunto que descontar). Editable. */
  c.contract_descuento_conjunto = 0
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

/**
 * El plan histórico (por ventas) que tiene guardado el contrato, o null si su plan es uno de los
 * vigentes (o no tiene). `inicial` es histórico solo si el abono pactado de Gestión es el de $34.200.
 */
export function plan_historico_del_contrato(c) {
  const clave = c?.contract_plan_gestion
  const historico = PLANES_HISTORICOS.find(p => p.clave === clave)
  if (!historico) return null
  const vigente = PLANES_GESTION.find(p => p.clave === clave)
  if (!vigente) return historico
  const abono = Number(c.contract_precios_sistemas?.gestion?.mensualidad)
  return Math.abs(abono - historico.abono) < 0.01 ? historico : null
}

/** «Inicial — hasta 100 operaciones por mes», «Plus — de 251 a 500…», «A medida — más de 3.000…». */
export function nombre_del_plan(plan) {
  const miles = n => n.toLocaleString('es-AR')
  if (plan.limite == null) {
    const ultimo = PLANES_GESTION.filter(p => p.limite != null).pop()
    return plan.nombre + ' — más de ' + miles(ultimo.limite) + ' operaciones por mes'
  }
  if (!plan.desde) return plan.nombre + ' — hasta ' + miles(plan.limite) + ' operaciones por mes'
  return plan.nombre + ' — de ' + miles(plan.desde) + ' a ' + miles(plan.limite) + ' operaciones por mes'
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
