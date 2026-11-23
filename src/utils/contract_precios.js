/**
 * FALLBACK de los planes de Gestión (misión embudo-whatsapp-precios, E4): los vigentes se leen de la fuente
 * única de precios (`GET admin/settings/precios-vigentes`, ver `cargar_precios_vigentes`); estas constantes se
 * usan sólo si ese pedido falla, y para mostrar con su rango de siempre un plan que la fuente ya no ofrece
 * (`plus`, `a_medida`) en un contrato guardado.
 *
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


/* ==================================================================================================
 * Fuente única de precios (E4): estado del módulo y lectura
 * ================================================================================================== */

/** Política de precios de las fotos de plan (la misma que arma la API). */
const POLITICA_DE_LA_FOTO = '2026-11-21'

/** La fuente de precios ya validada, o null si todavía no se pidió o el pedido falló (entonces rige el fallback). */
let precios_vigentes = null

/** El pedido en curso, para que dos contratos abiertos a la vez no pidan la fuente dos veces. */
let pedido_en_curso = null

/** ¿Es un número finito? (un string o un null no valen para un precio) */
function es_numero(valor) {
  return typeof valor === 'number' && isFinite(valor)
}

/**
 * ¿La respuesta es un contrato v2 usable por el editor? Mira sólo lo que el editor necesita: planes de
 * gestión con rango y abono, mensualidad de tienda, paquetes de agentes, precio de cada implementación y
 * el porcentaje de los tres juntos. Una forma vieja o rota se descarta (rige el fallback).
 */
function fuente_es_usable(f) {
  if (!f || typeof f !== 'object') return false
  const planes = f.gestion && f.gestion.planes
  if (!Array.isArray(planes) || !planes.length) return false
  const planes_ok = planes.filter(p => p && typeof p.clave === 'string' && typeof p.nombre === 'string' &&
    es_numero(p.abono) && es_numero(p.desde) && (p.hasta === null || es_numero(p.hasta))).length === planes.length
  if (!planes_ok) return false
  if (!f.tienda || !es_numero(f.tienda.mensualidad)) return false
  const paquetes = f.agentes && f.agentes.paquetes
  if (!Array.isArray(paquetes) || !paquetes.length) return false
  if (paquetes.filter(p => p && typeof p.clave === 'string' && es_numero(p.mensualidad)).length !== paquetes.length) return false
  const impl = f.implementaciones
  if (!impl || !Array.isArray(impl.items) || !impl.tres_juntos || !es_numero(impl.tres_juntos.precio_lista) || !es_numero(impl.tres_juntos.precio)) return false
  return ['gestion', 'tienda', 'agentes'].every(clave => {
    const item = impl.items.find(i => i && i.clave === clave)
    return !!item && es_numero(item.precio)
  })
}

/**
 * Guarda la fuente si es usable.
 * @returns {boolean} true si quedó cargada, false si se descartó.
 */
export function fijar_precios_vigentes(f) {
  if (!fuente_es_usable(f)) return false
  precios_vigentes = f
  return true
}

/** ¿Hay una fuente cargada? (si no, el editor usa el fallback de siempre) */
export function precios_vigentes_cargados() {
  return precios_vigentes !== null
}

/** Tiempo máximo que se espera la fuente al abrir un contrato antes de usar el fallback (10 s). */
export const TIMEOUT_FUENTE_MS = 10000

/**
 * Pide la fuente: UNA VEZ POR APERTURA de un contrato (no por sesión), para que el editor muestre siempre los
 * rangos y precios de hoy. Dos aperturas simultáneas comparten el mismo pedido. `pedir` es una función que
 * devuelve la promesa del GET (axios: la respuesta trae `res.data`); así este archivo no importa nada y se puede
 * probar en Node. Si el pedido falla, se cuelga más de `timeout_ms` o la respuesta no sirve NO se rechaza: la
 * fuente cargada se descarta y rige el fallback de siempre (el próximo contrato que se abra lo vuelve a intentar).
 * @returns {Promise<Object|null>} La fuente, o null si rige el fallback.
 */
export function cargar_precios_vigentes(pedir, timeout_ms = TIMEOUT_FUENTE_MS) {
  if (pedido_en_curso !== null) return pedido_en_curso
  pedido_en_curso = new Promise(resolve => {
    let cerrado = false
    let temporizador = null
    /* Cierra el pedido una sola vez: lo que llegue después (un GET tardío) se ignora. */
    const cerrar = datos => {
      if (cerrado) return
      cerrado = true
      clearTimeout(temporizador)
      if (!fijar_precios_vigentes(datos)) precios_vigentes = null
      pedido_en_curso = null
      resolve(precios_vigentes)
    }
    temporizador = setTimeout(() => cerrar(null), timeout_ms)
    Promise.resolve().then(pedir).then(res => cerrar(res && res.data), () => cerrar(null))
  })
  return pedido_en_curso
}

/**
 * Los planes que se ofrecen hoy, con la forma de `PLANES_GESTION` (`limite` = `hasta` de la fuente; null =
 * sin tope). Con la fuente cargada son los suyos; sin ella, el fallback.
 */
function planes_vigentes_actuales() {
  if (precios_vigentes === null) return PLANES_GESTION
  return precios_vigentes.gestion.planes.map(p => ({
    clave: p.clave, nombre: p.nombre, desde: p.desde, limite: p.hasta, abono: p.abono, usuarios: p.usuarios, excedente: p.excedente,
  }))
}

/** El precio de implementación de un sistema en la fuente (`gestion`, `tienda`, `agentes`). */
function precio_de_implementacion(clave) {
  return precios_vigentes.implementaciones.items.find(i => i.clave === clave).precio
}

/** Paquetes de tokens de Agentes de la fuente (vacío sin fuente). */
function paquetes_de_agentes() {
  return precios_vigentes === null ? [] : precios_vigentes.agentes.paquetes
}

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
  if (precios_vigentes !== null) {
    /* Precios nuevos en pesos (decisión de Lucas, 23/11/2026): licencia de implementación de la fuente en los
       tres sistemas, abono de gestión del primer plan (Inicial), tienda de la fuente y agentes del primer
       paquete (Inicial). Todo sigue editable a mano. */
    return {
      gestion: { licencia: precio_de_implementacion('gestion'), mensualidad: precios_vigentes.gestion.planes[0].abono },
      ecommerce: { licencia: precio_de_implementacion('tienda'), mensualidad: precios_vigentes.tienda.mensualidad },
      agentes: { licencia: precio_de_implementacion('agentes'), mensualidad: precios_vigentes.agentes.paquetes[0].mensualidad },
    }
  }
  return {
    gestion: { licencia: 0, mensualidad: ABONO_GESTION_POR_DEFECTO },
    ecommerce: { licencia: 800, mensualidad: 20000 },
    agentes: { licencia: 800, mensualidad: 30000 },
  }
}

/**
 * Descuento conjunto de un contrato nuevo: `tres_juntos.precio_lista − tres_juntos.precio` de la fuente, o sea la
 * fórmula única de la API (en pesos enteros), sin recalcularla acá. Se guarda siempre, pero `resumen_precios`
 * sólo lo resta con los tres sistemas. Sin fuente, 0 como hasta ahora.
 */
function descuento_conjunto_por_defecto() {
  if (precios_vigentes === null) return 0
  const tres = precios_vigentes.implementaciones.tres_juntos
  return tres.precio_lista - tres.precio
}

/**
 * La vista previa de la foto del plan que la API va a sacar al guardar (misma forma). Sólo sirve para que el
 * editor muestre el rango que va a decir el PDF: la API ignora lo que llegue y arma la suya desde la fuente.
 */
function foto_de_plan(plan) {
  return {
    clave: plan.clave, nombre: plan.nombre, desde: plan.desde, hasta: plan.limite, usuarios: plan.usuarios,
    excedente: plan.excedente, abono_lista: plan.abono, politica: POLITICA_DE_LA_FOTO,
  }
}

/**
 * Las condiciones que el contrato tiene cargadas (las mismas que cuentan como «guardadas»), por clave. Lo que
 * valga lo que trae un contrato vacío (USD, ARS, 6 meses, 0 usuarios extra) no cuenta.
 * @param {Object} c
 * @param {boolean} sin_sistemas No contar los sistemas tildados (el editor los completa solo con la cotización).
 */
function condiciones_cargadas(c, sin_sistemas) {
  const cargadas = {}
  const claves_de_valor = ['contract_client_name', 'contract_client_razon_social', 'contract_client_cuit',
    'contract_precio_licencia', 'contract_mensualidad_base', 'contract_modalidad', 'contract_fecha_emision',
    'contract_fecha_primer_pago_unico', 'contract_fecha_primer_pago_mensual', 'contract_permanencia_meses']
  claves_de_valor.forEach(k => { if (c[k] !== null && c[k] !== undefined && c[k] !== '') cargadas[k] = c[k] })
  const claves_de_lista = ['contract_financiacion', 'contract_clausulas_particulares']
  if (!sin_sistemas) claves_de_lista.push('contract_sistemas')
  claves_de_lista.forEach(k => { if (Array.isArray(c[k]) && c[k].length > 0) cargadas[k] = c[k] })
  if (c.contract_mes_gratis === true) cargadas.contract_mes_gratis = true
  if (c.contract_plan_gestion != null && c.contract_plan_gestion !== '') cargadas.contract_plan_gestion = c.contract_plan_gestion
  if (c.contract_pago_anual === true) cargadas.contract_pago_anual = true
  if (c.contract_descuento_conjunto != null) cargadas.contract_descuento_conjunto = c.contract_descuento_conjunto
  if (c.contract_currency != null && c.contract_currency !== '' && c.contract_currency !== 'USD') cargadas.contract_currency = c.contract_currency
  if (c.contract_mensualidad_moneda != null && c.contract_mensualidad_moneda !== '' && c.contract_mensualidad_moneda !== 'ARS') cargadas.contract_mensualidad_moneda = c.contract_mensualidad_moneda
  if (c.contract_meses_actualizacion != null && Number(c.contract_meses_actualizacion) !== 6) cargadas.contract_meses_actualizacion = c.contract_meses_actualizacion
  if (Number(c.contract_usuarios_extra) > 0) cargadas.contract_usuarios_extra = c.contract_usuarios_extra
  if (Number(c.contract_perfiles_ecommerce) > 0) cargadas.contract_perfiles_ecommerce = c.contract_perfiles_ecommerce
  return cargadas
}

export function tiene_condiciones_guardadas(c) {
  return Object.keys(condiciones_cargadas(c, false)).length > 0
}

/**
 * Una «firma» de las condiciones cargadas del contrato (sin los sistemas, que el editor completa solo). Se toma
 * al abrir el contrato y se compara cuando llega la fuente: si cambió, el operador ya tocó algo y no se precarga.
 */
export function firma_de_condiciones(c) {
  return JSON.stringify(condiciones_cargadas(c, true))
}

/**
 * Precarga tardía (cuando llega la fuente, después de abrir el contrato): sólo si el contrato SIGUE siendo nuevo,
 * o sea sin desglose y con las mismas condiciones que tenía al abrirlo. Si el operador ya cargó algo, o el
 * contrato ya estaba guardado, no se toca nada.
 * @returns {boolean} true si lo precargó.
 */
export function precargar_si_sigue_nuevo(c, firma) {
  if (c.contract_precios_sistemas || firma_de_condiciones(c) !== firma) return false
  iniciar_precios_por_sistema(c)
  return true
}

export function iniciar_precios_por_sistema(c) {
  c.contract_precios_sistemas = precios_por_defecto()
  /* Con la fuente, el contrato nuevo arranca con el plan Inicial elegido (la API le saca la foto al guardar y la
     cobranza usa sus cortes); «Sin plan» sigue disponible a mano. Sin fuente, sin plan como siempre. */
  const plan_inicial = precios_vigentes !== null ? planes_vigentes_actuales()[0] : null
  c.contract_plan_gestion = plan_inicial ? plan_inicial.clave : null
  c.contract_plan_gestion_foto = plan_inicial ? foto_de_plan(plan_inicial) : null
  /* Sin descuento por contratar los tres (era USD 300 cuando el conjunto valía USD 1.500 contra
     USD 1.800 de lista; con Gestión sin licencia ya no hay conjunto que descontar). Editable. */
  c.contract_descuento_conjunto = descuento_conjunto_por_defecto()
  c.contract_mes_gratis = false
  c.contract_meses_actualizacion = 6
  c.contract_modalidad = 'licencia'
  /* Con la fuente cargada el contrato nuevo es en pesos; sin ella, USD como siempre. */
  c.contract_currency = precios_vigentes !== null ? 'ARS' : 'USD'
  c.contract_mensualidad_moneda = 'ARS'
  c.contract_perfiles_ecommerce = 0
  c.contract_precio_perfil_ecommerce = ''
  if (!Array.isArray(c.contract_sistemas) || !c.contract_sistemas.length) c.contract_sistemas = ['gestion']
  actualizar_totales(c)
}

/**
 * Precarga los precios SÓLO si el contrato es nuevo (sin desglose ni condiciones guardadas). Un contrato ya
 * guardado no se recalcula nunca al abrirlo, aunque la fuente de precios haya cambiado.
 * @returns {boolean} true si lo precargó.
 */
export function precargar_precios_si_es_nuevo(c) {
  if (c.contract_precios_sistemas || tiene_condiciones_guardadas(c)) return false
  iniciar_precios_por_sistema(c)
  return true
}

/**
 * Elige el plan de Gestión del contrato. Un plan con abono precarga la mensualidad de Gestión
 * (sigue siendo editable); a medida y la opción vacía (importe acordado) no tocan el importe.
 */
export function elegir_plan_gestion(c, clave) {
  if (clave === '' || clave == null) {
    c.contract_plan_gestion = null
    c.contract_plan_gestion_foto = null
    return
  }
  /* Sólo se elige un plan que hoy se ofrece: Plus u otros que la fuente ya no tiene quedan como opción deshabilitada. */
  const plan = planes_vigentes_actuales().find(p => p.clave === clave)
  if (!plan) return
  c.contract_plan_gestion = plan.clave
  /* Vista previa de la foto que sacará la API (sólo con la fuente cargada; con el fallback no hay foto). */
  c.contract_plan_gestion_foto = precios_vigentes !== null ? foto_de_plan(plan) : null
  if (plan.abono != null && c.contract_precios_sistemas?.gestion) {
    c.contract_precios_sistemas.gestion.mensualidad = plan.abono
    actualizar_totales(c)
  }
}

/**
 * Las opciones del select de plan de Gestión: los planes que se ofrecen hoy (con su rango), más, deshabilitadas,
 * el plan histórico por ventas que el contrato conserva y el plan que la fuente ya no ofrece (`plus`,
 * `a_medida`) si el contrato lo tiene guardado. Así guardar no pierde el plan.
 * @returns {Array<{clave: string, texto: string, disabled: boolean}>}
 */
export function opciones_de_plan(c) {
  const vigentes = planes_vigentes_actuales()
  const historico = plan_historico_del_contrato(c)
  const opciones = []
  if (historico) {
    opciones.push({
      clave: historico.clave,
      texto: historico.nombre + ' — hasta ' + historico.limite.toLocaleString('es-AR') + ' ventas por mes (política anterior)',
      disabled: true,
    })
  }
  const guardado = c && c.contract_plan_gestion
  const foto = c && c.contract_plan_gestion_foto
  vigentes.forEach(plan => {
    let texto = nombre_del_plan(plan)
    if (guardado === plan.clave && !historico) {
      /* El plan guardado dice lo que dice el PDF: con foto, el rango de la foto; sin foto (contrato firmado antes
         de E4), el de la política del 3/11/2026. Las demás opciones salen de la fuente. */
      if (foto && foto.clave === guardado && foto.nombre != null && foto.desde != null) {
        texto = nombre_del_plan({ clave: foto.clave, nombre: foto.nombre, desde: foto.desde, limite: foto.hasta })
      } else {
        const de_la_politica = PLANES_GESTION.find(p => p.clave === guardado)
        if (de_la_politica) texto = nombre_del_plan(de_la_politica)
      }
    }
    opciones.push({ clave: plan.clave, texto, disabled: !!(historico && historico.clave === plan.clave) })
  })
  if (guardado && !historico && !vigentes.some(p => p.clave === guardado)) {
    const anterior = PLANES_GESTION.find(p => p.clave === guardado)
    if (anterior) opciones.push({ clave: anterior.clave, texto: nombre_del_plan(anterior) + ' (política anterior)', disabled: true })
  }
  return opciones
}

/**
 * Los paquetes de tokens de Agentes para el selector (Inicial / Pro / Max). Vacío sin fuente: el selector no se muestra.
 * @returns {Array<{clave: string, nombre: string, mensualidad: number}>}
 */
export function opciones_de_paquete_agentes() {
  const opciones = []
  paquetes_de_agentes().forEach(p => opciones.push({ clave: p.clave, nombre: p.nombre, mensualidad: p.mensualidad }))
  return opciones
}

/** El paquete cuyo importe es el de Agentes del contrato, o '' si el importe se cargó a mano. */
export function paquete_agentes_del_contrato(c) {
  const importe = Number(c?.contract_precios_sistemas?.agentes?.mensualidad)
  const paquete = paquetes_de_agentes().find(p => p.mensualidad === importe)
  return paquete ? paquete.clave : ''
}

/** Elige un paquete de Agentes: sólo completa la mensualidad (editable); no se guarda el nombre del paquete. */
export function elegir_paquete_agentes(c, clave) {
  const paquete = paquetes_de_agentes().find(p => p.clave === clave)
  if (!paquete || !c?.contract_precios_sistemas?.agentes) return
  c.contract_precios_sistemas.agentes.mensualidad = paquete.mensualidad
  actualizar_totales(c)
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
    /* Sin tope: `a_medida` (política 3/11) se lee «más de 3.000»; Empresa de la fuente es ilimitado. */
    if (plan.clave !== 'a_medida') return plan.nombre + ' — operaciones ilimitadas'
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
