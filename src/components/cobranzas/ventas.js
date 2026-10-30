/**
 * Utilidades de las ventas y las comisiones del módulo Cobranzas (misión ventas-y-comisiones,
 * 28/10/2026).
 *
 * Las "licencias" pasaron a ser **ventas**: lo que se le vende a un cliente (el sistema, el
 * e-commerce, los agentes, un desarrollo a medida u otra cosa), cada una con sus cuotas y con la
 * comisión del vendedor. Esto lo usan cuatro pantallas (la pestaña Ventas del cliente, Cobranzas ›
 * Ventas, Cobranzas › Comisiones y Mis comisiones), así que lo que leen del JSON de la API y las
 * cuentas que hacen en el navegador viven acá una sola vez.
 *
 * Criterio general: la API es la que manda (el cálculo de la comisión liberada, el precio
 * sugerido y el porcentaje por defecto son del backend). Lo que se calcula acá es solo para
 * MOSTRAR antes de guardar (la vista previa del formulario de alta) o para SUMAR lo que ya vino
 * calculado (los totales de arriba de cada pantalla). Por eso cada lector tiene defaults: si una
 * clave no viene, la pantalla muestra un guion o un cero en vez de romperse.
 */

/**
 * Porcentaje de comisión por defecto (mismo valor que `Venta::COMISION_PORCENTAJE_DEFAULT`).
 * Es el de casi todas las ventas: e-commerce, agentes, desarrollo, otro, y el sistema vendido de
 * contado o financiado.
 */
export const COMISION_PORCENTAJE_DEFAULT = 15

/**
 * Porcentaje de comisión cuando se vende el sistema en modalidad Suscripción (mismo valor que
 * `Venta::COMISION_PORCENTAJE_SUSCRIPCION`): decisión de Lucas del 28/10/2026, solo si la venta
 * incluye `gestion` y el contrato del cliente (o de su lead) está en `suscripcion`.
 */
export const COMISION_PORCENTAJE_SUSCRIPCION = 30

/**
 * Etiquetas de los productos por si la respuesta no trae el mapa `productos` (la API siempre lo
 * manda; esto es la red para que un badge nunca muestre una clave pelada como `gestion`).
 */
export const PRODUCTOS_ETIQUETAS_DEFAULT = {
  gestion: 'Sistema de gestión',
  ecommerce: 'E-commerce',
  agentes: 'Agentes de IA',
  desarrollo: 'Desarrollo a medida',
  otro: 'Otro',
}

/**
 * Los tres "sistemas" que tienen precio de lista. Desarrollo a medida y Otro no lo tienen: su
 * importe es libre.
 */
export const PRODUCTOS_CON_PRECIO = ['gestion', 'ecommerce', 'agentes']

/**
 * Los productos de importe libre: si alguno está tildado, no se precarga el total y la
 * descripción pasa a ser obligatoria (lo valida el front; la API la acepta vacía).
 */
export const PRODUCTOS_LIBRES = ['desarrollo', 'otro']

/**
 * Número seguro: `null`, `undefined`, `''` o texto ilegible valen 0.
 *
 * @param {*} valor
 * @returns {number}
 */
export function numero(valor) {
  const n = Number(valor)
  return isNaN(n) ? 0 : n
}

/**
 * Redondeo a centavos, para que las sumas de cuotas no arrastren `0.30000000000000004`.
 *
 * @param {number} valor
 * @returns {number}
 */
export function redondear(valor) {
  return Math.round(numero(valor) * 100) / 100
}

/**
 * Suma `valor` a `destino[moneda]`, creando la clave si no existe. Es la forma de acumular los
 * totales "por moneda" de las pantallas (USD y ARS nunca se mezclan).
 *
 * @param {Object<string, number>} destino
 * @param {string|null|undefined} moneda
 * @param {*} valor
 * @returns {void}
 */
export function sumar_en_moneda(destino, moneda, valor) {
  const clave = String(moneda || 'USD').toUpperCase()
  destino[clave] = redondear(numero(destino[clave]) + numero(valor))
}

/**
 * Nombre visible de un cliente, venga como venga: la fila de `cobranzas/ventas` trae `nombre`,
 * el modelo de `/client` trae `company_name`/`name`, y un ítem de comisiones puede traer el
 * cliente anidado en `client`.
 *
 * @param {Object|null|undefined} cliente
 * @returns {string}
 */
export function nombre_de_cliente(cliente) {
  if (!cliente) {
    return '—'
  }
  const nombre = cliente.nombre || cliente.company_name || cliente.name || cliente.business_name
  if (nombre) {
    return String(nombre)
  }
  const id = cliente.client_id || cliente.id
  return id ? 'Cliente #' + id : '—'
}

/**
 * Etiquetas de los productos de una venta, en el orden en que vinieron. Usa
 * `venta.productos_etiquetas` si la API lo manda (como arreglo paralelo a `productos` o como mapa
 * clave → etiqueta) y si no, el mapa `productos` de la respuesta, y si no, los defaults de arriba.
 *
 * @param {Object} venta
 * @param {Object<string, string>} [mapa] el `productos` de la respuesta (`{clave: etiqueta}`)
 * @returns {Array<{clave: string, etiqueta: string}>}
 */
export function productos_de_venta(venta, mapa) {
  const claves = venta && Array.isArray(venta.productos) ? venta.productos : []
  const etiquetas = venta ? venta.productos_etiquetas : null
  const resultado = []
  claves.forEach(function (clave, indice) {
    let etiqueta = null
    if (Array.isArray(etiquetas) && etiquetas[indice]) {
      etiqueta = etiquetas[indice]
    } else if (etiquetas && typeof etiquetas === 'object' && etiquetas[clave]) {
      etiqueta = etiquetas[clave]
    } else if (mapa && mapa[clave]) {
      etiqueta = mapa[clave]
    } else {
      etiqueta = PRODUCTOS_ETIQUETAS_DEFAULT[clave] || clave
    }
    resultado.push({ clave: clave, etiqueta: etiqueta })
  })
  return resultado
}

/**
 * Clase de color del badge de cada producto: un color fijo por producto para que en la tabla se
 * reconozcan de un vistazo (el sistema en azul, el e-commerce en verde, etc.).
 *
 * @param {string} clave
 * @returns {string}
 */
export function clase_badge_producto(clave) {
  const clases = {
    gestion: 'text-bg-primary',
    ecommerce: 'text-bg-success',
    agentes: 'text-bg-info',
    desarrollo: 'text-bg-warning',
    otro: 'text-bg-secondary',
  }
  return clases[clave] || 'text-bg-light border'
}

/**
 * Parte de «cobro dudoso» (stand-by) del resumen de una venta (misión cobro-dudoso-y-pagos-ventas,
 * 30/10/2026).
 *
 * Un cliente marcado de dudoso cobro tiene su deuda en un balde aparte: no cuenta como plata a
 * cobrar, pero tampoco se da por perdida. La API lo manda en `resumen.en_espera` (la parte del
 * pendiente que está en stand-by) y `resumen.por_cobrar` (el pendiente que sí se espera cobrar).
 * `pendiente` conserva su significado: es la deuda total, en stand-by o no.
 *
 * Compatibilidad con una API vieja que no manda esas claves: `en_espera` vale 0 y `por_cobrar`
 * cae a `pendiente` (todo lo que se debe se sigue viendo como plata a cobrar).
 *
 * @param {Object} resumen el `venta.resumen` de la API (puede venir vacío)
 * @param {number} pendiente el pendiente total ya calculado
 * @returns {{en_espera: number, por_cobrar: number}}
 */
function parte_en_espera(resumen, pendiente) {
  const en_espera = resumen.en_espera !== undefined && resumen.en_espera !== null ? numero(resumen.en_espera) : 0
  const por_cobrar = resumen.por_cobrar !== undefined && resumen.por_cobrar !== null
    ? numero(resumen.por_cobrar)
    : redondear(pendiente - en_espera)
  return { en_espera: en_espera, por_cobrar: por_cobrar }
}

/**
 * true si la venta (o la fila de cliente) viene marcada como de dudoso cobro. Una API vieja no
 * manda la clave y se lee como false (el cliente paga).
 *
 * @param {Object|null|undefined} venta_o_cliente
 * @returns {boolean}
 */
export function es_cobro_dudoso(venta_o_cliente) {
  return !!(venta_o_cliente && venta_o_cliente.cobro_dudoso)
}

/**
 * Resumen de cobro de una venta: `{total, cobrado, pendiente, en_espera, por_cobrar}` en la
 * moneda de la venta. Lee `venta.resumen`; si no viene (o le falta alguna cifra), lo arma con las
 * cuotas, con el mismo criterio que el backend: una cuota `pagada` sin `monto_pagado` cuenta
 * completa. `en_espera` y `por_cobrar` solo los calcula la API (ver `parte_en_espera`).
 *
 * @param {Object} venta
 * @returns {{total: number, cobrado: number, pendiente: number, en_espera: number, por_cobrar: number}}
 */
export function resumen_de_venta(venta) {
  const resumen = (venta && venta.resumen) || {}
  if (resumen.total !== undefined && resumen.cobrado !== undefined && resumen.pendiente !== undefined) {
    const pendiente_api = numero(resumen.pendiente)
    return Object.assign({
      total: numero(resumen.total),
      cobrado: numero(resumen.cobrado),
      pendiente: pendiente_api,
    }, parte_en_espera(resumen, pendiente_api))
  }
  /* Plan B: sumar las cuotas. `monto_cobrado` lo manda `cuota_para_json`; si tampoco está, se
     deriva del estado y de `monto_pagado`. */
  let total = 0
  let cobrado = 0
  const cuotas = venta && Array.isArray(venta.cuotas) ? venta.cuotas : []
  cuotas.forEach(function (cuota) {
    total += numero(cuota.monto)
    if (cuota.monto_cobrado !== undefined && cuota.monto_cobrado !== null) {
      cobrado += numero(cuota.monto_cobrado)
    } else if (cuota.estado === 'pagada' && (cuota.monto_pagado === null || cuota.monto_pagado === undefined)) {
      cobrado += numero(cuota.monto)
    } else {
      cobrado += numero(cuota.monto_pagado)
    }
  })
  if (!cuotas.length) {
    total = numero(venta ? venta.monto_total : 0)
  }
  const pendiente = total - cobrado
  const pendiente_redondeado = redondear(pendiente > 0 ? pendiente : 0)
  return Object.assign({
    total: redondear(total),
    cobrado: redondear(cobrado),
    pendiente: pendiente_redondeado,
  }, parte_en_espera(resumen, pendiente_redondeado))
}

/**
 * La comisión de una venta con todas sus cifras, con defaults en cero. Es el `comision` que arma
 * `VentaService::comision_de()`:
 * `{vendedor_admin_id, vendedor_nombre, porcentaje, total, liberada, pagada, a_pagar, por_liberar, moneda}`.
 *
 * @param {Object} venta
 * @returns {Object}
 */
export function comision_de_venta(venta) {
  const comision = (venta && venta.comision) || {}
  return {
    vendedor_admin_id: comision.vendedor_admin_id !== undefined ? comision.vendedor_admin_id : (venta ? venta.vendedor_admin_id : null),
    vendedor_nombre: comision.vendedor_nombre || '',
    porcentaje: comision.porcentaje !== undefined && comision.porcentaje !== null
      ? numero(comision.porcentaje)
      : (venta && venta.comision_porcentaje !== null && venta.comision_porcentaje !== undefined ? numero(venta.comision_porcentaje) : null),
    total: comision.total !== undefined ? numero(comision.total) : numero(venta ? venta.comision_monto : 0),
    liberada: numero(comision.liberada),
    pagada: numero(comision.pagada),
    a_pagar: numero(comision.a_pagar),
    por_liberar: numero(comision.por_liberar),
    moneda: comision.moneda || (venta ? venta.moneda : null) || 'USD',
  }
}

/**
 * Nombre del vendedor de una venta: el que manda la comisión y, si no, el que se encuentra en la
 * lista de vendedores por id.
 *
 * @param {Object} venta
 * @param {Array<{id: number, name: string}>} [vendedores]
 * @returns {string} vacío si la venta no tiene vendedor
 */
export function nombre_de_vendedor(venta, vendedores) {
  const comision = comision_de_venta(venta)
  if (comision.vendedor_nombre) {
    return comision.vendedor_nombre
  }
  const id = comision.vendedor_admin_id
  if (!id) {
    return ''
  }
  let nombre = ''
  ;(vendedores || []).forEach(function (vendedor) {
    if (!nombre && Number(vendedor.id) === Number(id)) {
      nombre = vendedor.name || ''
    }
  })
  return nombre || 'Admin #' + id
}

/**
 * Precio sugerido para una combinación de productos, con la política del 26/10/2026
 * (`manual_sistema/general/precios-y-contratacion.md`): los tres sistemas juntos tienen precio
 * de paquete; si no, se suman los precios de lista; de contado se descuenta el porcentaje de
 * contado. Con Desarrollo a medida u Otro no hay precio sugerido (importe libre).
 *
 * Es el espejo de `VentaService::precio_sugerido()`, solo para precargar el formulario: si no
 * se manda `monto_total`, el backend lo calcula igual.
 *
 * @param {string[]} productos claves tildadas
 * @param {boolean} contado
 * @param {Object} precios el `precios` de `GET client/{id}/ventas`:
 *   `{gestion, ecommerce, agentes, los_tres, contado_descuento}`
 * @returns {number|null} null = importe libre (o nada tildado)
 */
export function precio_sugerido(productos, contado, precios) {
  const lista = Array.isArray(productos) ? productos : []
  if (!lista.length) {
    return null
  }
  const hay_libre = lista.some(function (clave) {
    return PRODUCTOS_LIBRES.indexOf(clave) !== -1
  })
  if (hay_libre) {
    return null
  }
  const p = precios || {}
  const estan_los_tres = PRODUCTOS_CON_PRECIO.every(function (clave) {
    return lista.indexOf(clave) !== -1
  })
  let total = 0
  if (estan_los_tres && p.los_tres !== undefined && p.los_tres !== null) {
    total = numero(p.los_tres)
  } else {
    lista.forEach(function (clave) {
      total += numero(p[clave])
    })
  }
  if (contado) {
    total = total * (1 - numero(p.contado_descuento) / 100)
  }
  return redondear(total)
}

/**
 * Porcentaje de comisión sugerido para los productos tildados: 30 si se vende el sistema
 * (`gestion`) a un cliente en Suscripción, 15 en todos los demás casos. Espejo de
 * `VentaService::porcentaje_por_defecto()`.
 *
 * @param {string[]} productos
 * @param {boolean} es_suscripcion
 * @returns {number}
 */
export function porcentaje_sugerido(productos, es_suscripcion) {
  const tiene_gestion = Array.isArray(productos) && productos.indexOf('gestion') !== -1
  return tiene_gestion && es_suscripcion ? COMISION_PORCENTAJE_SUSCRIPCION : COMISION_PORCENTAJE_DEFAULT
}

/**
 * Suma `meses` meses a una fecha `YYYY-MM-DD`, recortando el día si el mes de destino es más
 * corto (31/1 + 1 mes = 28/2 o 29/2), igual que hace Carbon con `addMonthsNoOverflow`.
 *
 * @param {string} fecha `YYYY-MM-DD`
 * @param {number} meses
 * @returns {string} la fecha resultante, o la de entrada si no se pudo leer
 */
export function sumar_meses_a_fecha(fecha, meses) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha || ''))
  if (!coincidencia) {
    return fecha
  }
  const anio_base = Number(coincidencia[1])
  const mes_base = Number(coincidencia[2]) - 1
  const dia = Number(coincidencia[3])
  /* Índice absoluto de meses para que el acarreo de años salga solo. */
  const indice = anio_base * 12 + mes_base + Number(meses || 0)
  const anio = Math.floor(indice / 12)
  const mes = indice % 12
  /* Día 0 del mes siguiente = último día de este mes. */
  const ultimo_dia = new Date(anio, mes + 1, 0).getDate()
  const dia_final = dia > ultimo_dia ? ultimo_dia : dia
  return anio + '-' + String(mes + 1).padStart(2, '0') + '-' + String(dia_final).padStart(2, '0')
}

/**
 * Vista previa de las cuotas de una venta nueva: `cantidad` cuotas iguales, mensuales desde
 * `primer_vencimiento`, y la última absorbe el redondeo para que la suma dé exacto el total.
 * Es el mismo reparto que hace `VentaService::crear()` cuando no se le mandan `cuotas`.
 *
 * @param {number} total
 * @param {number} cantidad
 * @param {string} primer_vencimiento `YYYY-MM-DD`
 * @returns {Array<{numero: number, monto: number, vencimiento: string}>}
 */
export function repartir_en_cuotas(total, cantidad, primer_vencimiento) {
  const n = Math.max(1, Math.floor(numero(cantidad) || 1))
  const monto_total = redondear(total)
  /* La cuota "normal" se trunca a centavos, igual que `VentaService::repartir()`
     (`floor(total * 100 / n) / 100`); la diferencia la absorbe la última, que así nunca queda
     por debajo de las otras. */
  const cuota_base = Math.floor((monto_total * 100) / n) / 100
  const cuotas = []
  let acumulado = 0
  for (let i = 0; i < n; i++) {
    const es_ultima = i === n - 1
    const monto = es_ultima ? redondear(monto_total - acumulado) : cuota_base
    acumulado = redondear(acumulado + monto)
    cuotas.push({
      numero: i + 1,
      monto: monto,
      vencimiento: primer_vencimiento ? sumar_meses_a_fecha(primer_vencimiento, i) : '',
    })
  }
  return cuotas
}
