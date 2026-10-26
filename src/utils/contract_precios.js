/** Importes acordados para nuevos contratos; se copian para que cada contrato sea editable. */
export function precios_por_defecto() {
  return {
    gestion: { licencia: 800, mensualidad: 100000 },
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
    c.contract_descuento_conjunto != null ||
    (c.contract_currency != null && c.contract_currency !== '' && c.contract_currency !== 'USD') ||
    (c.contract_mensualidad_moneda != null && c.contract_mensualidad_moneda !== '' && c.contract_mensualidad_moneda !== 'ARS') ||
    (c.contract_meses_actualizacion != null && Number(c.contract_meses_actualizacion) !== 6) ||
    Number(c.contract_usuarios_extra) > 0 || Number(c.contract_perfiles_ecommerce) > 0
}

export function iniciar_precios_por_sistema(c) {
  c.contract_precios_sistemas = precios_por_defecto()
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
