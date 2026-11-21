/**
 * Lógica pura de la pantalla Cuenta → «Precios vigentes» (misión embudo-whatsapp-precios, E1).
 *
 * La fuente única de precios vive en admin-api (`admin_settings.precios_vigentes`) y el contrato JSON
 * es el de §2.6 del plan. Este archivo NO calcula precios: sólo hace lo que el contrato permite a las
 * puntas (la mitad de la implementación y el abono con descuento, con redondeo a 2 decimales), valida
 * lo que el operador tipea antes de guardar (el backend igual responde 422) y da formato de lectura.
 *
 * Es JavaScript sin imports a propósito: `pruebas/precios-vigentes.cjs` lo lee tal cual y lo ejecuta en
 * Node, así que no puede depender de Vue ni de axios.
 */

/** Techo de cualquier monto en pesos que acepta el backend. */
export const MAX_MONTO = 99999999

/** Techo de meses de descuento de bienvenida que acepta el backend. */
export const MAX_MESES_DESCUENTO = 24

/**
 * Redondea a 2 decimales (el redondeo del contrato para la mitad y el abono con descuento).
 *
 * @param {number} valor Número a redondear.
 * @returns {number} Número con a lo sumo 2 decimales.
 */
function round_to_cents(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * Calcula el anticipo de una implementación: `precio * anticipo_porcentaje / 100`.
 *
 * @param {number} price Precio de la implementación, en pesos.
 * @param {number} percentage Porcentaje que se paga para arrancar (hoy 50).
 * @returns {number} Anticipo en pesos, con a lo sumo 2 decimales.
 */
export function calculate_down_payment(price, percentage) {
  return round_to_cents((Number(price) * Number(percentage)) / 100)
}

/**
 * Calcula el abono con el descuento de bienvenida: `abono * (100 - porcentaje) / 100`.
 *
 * @param {number} fee Abono mensual de lista, en pesos.
 * @param {number} percentage Porcentaje de descuento de los primeros meses (hoy 50).
 * @returns {number} Abono con descuento, con a lo sumo 2 decimales.
 */
export function calculate_discounted_fee(fee, percentage) {
  return round_to_cents((Number(fee) * (100 - Number(percentage))) / 100)
}

/**
 * Indica si un campo numérico quedó vacío o no es un número finito.
 *
 * Con `v-model.number`, borrar el contenido de un input deja `''`, que no se puede guardar.
 *
 * @param {*} valor Valor del campo.
 * @returns {boolean} true si falta el número.
 */
export function is_missing_number(valor) {
  if (valor === '' || valor === null || valor === undefined) {
    return true
  }
  return typeof valor !== 'number' || !isFinite(valor)
}

/**
 * Indica si un número tiene a lo sumo `decimals` decimales.
 *
 * @param {number} valor Número a revisar.
 * @param {number} decimals Cantidad máxima de decimales permitida.
 * @returns {boolean} true si no excede los decimales.
 */
function has_at_most_decimals(valor, decimals) {
  const factor = Math.pow(10, decimals)
  return Math.abs(Math.round(valor * factor) - valor * factor) < 1e-6
}

/**
 * Valida un campo numérico con rango y decimales. Devuelve el mensaje de error o '' si está bien.
 *
 * @param {*} valor Valor del campo.
 * @param {number} minimo Mínimo permitido (inclusive).
 * @param {number} maximo Máximo permitido (inclusive).
 * @param {number} decimals Decimales permitidos (0 = entero).
 * @returns {string} Mensaje legible o '' si el valor es válido.
 */
export function validate_number_field(valor, minimo, maximo, decimals) {
  if (is_missing_number(valor)) {
    return 'Completá este campo con un número.'
  }
  if (valor < minimo || valor > maximo) {
    return 'Tiene que estar entre ' + format_plain_number(minimo) + ' y ' + format_plain_number(maximo) + '.'
  }
  if (!has_at_most_decimals(valor, decimals)) {
    return decimals === 0 ? 'Tiene que ser un número entero.' : 'Admite hasta ' + decimals + ' decimales.'
  }
  return ''
}

/**
 * Valida el encadenado de rangos de los planes de gestión.
 *
 * Reglas (las mismas que aplica el backend con 422):
 * - el primer plan arranca en 0;
 * - cada plan arranca exactamente donde terminó el anterior más 1 (sin huecos ni superposiciones);
 * - el «hasta» de cada plan es mayor o igual a su «desde»;
 * - el último plan es ilimitado (`hasta = null`) y los demás tienen tope.
 *
 * @param {Array<{clave: string, desde: *, hasta: *}>} planes Planes en orden de menor a mayor.
 * @returns {Array<{clave: string, campo: string, mensaje: string}>} Errores; vacío si todo está bien.
 */
export function validate_plan_ranges(planes) {
  /** Errores acumulados, uno por problema encontrado. */
  const errores = []
  const lista = Array.isArray(planes) ? planes : []

  lista.forEach(function (plan, indice) {
    const es_ultimo = indice === lista.length - 1

    if (is_missing_number(plan.desde)) {
      errores.push({ clave: plan.clave, campo: 'desde', mensaje: 'Completá desde cuántas operaciones rige el plan.' })
    } else if (indice === 0 && plan.desde !== 0) {
      errores.push({ clave: plan.clave, campo: 'desde', mensaje: 'El primer plan tiene que arrancar en 0 operaciones.' })
    } else if (indice > 0) {
      const anterior = lista[indice - 1]
      if (!is_missing_number(anterior.hasta) && plan.desde !== anterior.hasta + 1) {
        errores.push({
          clave: plan.clave,
          campo: 'desde',
          mensaje: 'Tiene que arrancar en ' + (anterior.hasta + 1) + ', justo después de donde termina ' + (anterior.nombre || anterior.clave) + '.',
        })
      }
    }

    if (es_ultimo) {
      if (plan.hasta !== null) {
        errores.push({ clave: plan.clave, campo: 'hasta', mensaje: 'El último plan es ilimitado: el «hasta» tiene que quedar vacío.' })
      }
    } else if (is_missing_number(plan.hasta)) {
      errores.push({ clave: plan.clave, campo: 'hasta', mensaje: 'Completá hasta cuántas operaciones llega el plan.' })
    } else if (!is_missing_number(plan.desde) && plan.hasta < plan.desde) {
      errores.push({ clave: plan.clave, campo: 'hasta', mensaje: 'No puede ser menor que el «desde» del mismo plan.' })
    }
  })

  return errores
}

/**
 * Formatea un número con separador de miles «.» y decimal «,» (convención es-AR), sin depender de
 * `Intl`, cuyos datos de idioma cambian según el navegador o el Node que lo corra.
 *
 * @param {number} valor Número a formatear.
 * @param {number} min_decimals Decimales mínimos a mostrar.
 * @param {number} max_decimals Decimales máximos a mostrar (se recortan los ceros sobrantes).
 * @returns {string} Texto con el número formateado.
 */
function format_number_es_ar(valor, min_decimals, max_decimals) {
  const negativo = Number(valor) < 0
  const partes = Math.abs(Number(valor)).toFixed(max_decimals).split('.')
  /** Parte entera con puntos de miles. */
  const entera = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  /** Parte decimal sin ceros de relleno, respetando el mínimo pedido. */
  let decimales = partes.length > 1 ? partes[1] : ''
  while (decimales.length > min_decimals && decimales.charAt(decimales.length - 1) === '0') {
    decimales = decimales.slice(0, -1)
  }
  return (negativo ? '-' : '') + entera + (decimales.length > 0 ? ',' + decimales : '')
}

/**
 * Formatea un número «a secas» (para mensajes de error de rango).
 *
 * @param {number} valor Número a formatear.
 * @returns {string} Número con separador de miles.
 */
export function format_plain_number(valor) {
  return format_number_es_ar(valor, 0, 2)
}

/**
 * Formatea un importe en pesos: «$628.400» si es entero, «$89,56» si trae centavos.
 *
 * @param {number} valor Importe en pesos.
 * @returns {string} Texto «$…».
 */
export function format_pesos(valor) {
  const es_entero = Math.abs(Number(valor) - Math.round(Number(valor))) < 1e-9
  return '$' + (es_entero ? format_number_es_ar(Math.round(Number(valor)), 0, 0) : format_number_es_ar(valor, 2, 2))
}

/**
 * Formatea un importe en dólares de las tarifas de Meta: «USD 0,0618», sin ceros de relleno.
 *
 * @param {number} valor Importe en dólares (hasta 4 decimales).
 * @returns {string} Texto «USD …».
 */
export function format_usd(valor) {
  return 'USD ' + format_number_es_ar(valor, 0, 4)
}

/**
 * Formatea la fecha de «Actualizado el …» en es-AR (día/mes/año hora:minutos).
 *
 * @param {string|null|undefined} iso Fecha ISO 8601 que manda la API.
 * @returns {string} Texto legible o '' si no hay fecha válida.
 */
export function format_updated_at(iso) {
  if (!iso) {
    return ''
  }
  const fecha = new Date(iso)
  if (isNaN(fecha.getTime())) {
    return ''
  }
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Copia profunda de un objeto de precios (el estado editable no debe compartir referencias con el
 * guardado, o «hay cambios» daría siempre falso).
 *
 * @param {Object} precios Contrato de precios.
 * @returns {Object} Copia independiente.
 */
export function clone_precios(precios) {
  return JSON.parse(JSON.stringify(precios))
}

/**
 * Arma el cuerpo del PUT: el contrato completo sin los campos que sólo manda el servidor
 * (`actualizado_en` y `actualizado_por`).
 *
 * @param {Object} precios Contrato de precios editado.
 * @returns {Object} Cuerpo listo para enviar.
 */
export function build_save_payload(precios) {
  const cuerpo = clone_precios(precios)
  delete cuerpo.actualizado_en
  delete cuerpo.actualizado_por
  return cuerpo
}

/**
 * Valida todo el contrato antes de guardar. Devuelve un mapa «ruta del campo → mensaje» con la misma
 * notación de puntos que usa Laravel en `errors` (ej. `gestion.planes.1.desde`), así el servidor y la
 * pantalla marcan el mismo campo.
 *
 * @param {Object} precios Contrato de precios editado.
 * @returns {Object<string, string>} Errores por ruta; objeto vacío si se puede guardar.
 */
export function validate_precios(precios) {
  /** Errores acumulados por ruta de campo. */
  const errores = {}

  /**
   * Valida un campo y, si falla, lo anota en `errores`.
   *
   * @param {string} ruta Ruta del campo.
   * @param {*} valor Valor actual.
   * @param {number} minimo Mínimo inclusive.
   * @param {number} maximo Máximo inclusive.
   * @param {number} decimals Decimales permitidos.
   * @returns {void}
   */
  function check(ruta, valor, minimo, maximo, decimals) {
    const mensaje = validate_number_field(valor, minimo, maximo, decimals)
    if (mensaje !== '') {
      errores[ruta] = mensaje
    }
  }

  const gestion = precios.gestion || {}
  const planes = gestion.planes || []

  planes.forEach(function (plan, indice) {
    const base = 'gestion.planes.' + indice
    check(base + '.abono', plan.abono, 0, MAX_MONTO, 2)
    check(base + '.usuarios', plan.usuarios, 1, MAX_MONTO, 0)
    if (plan.excedente !== null) {
      check(base + '.excedente', plan.excedente, 0, MAX_MONTO, 2)
    }
  })

  /* Los rangos se validan en conjunto: un «desde» depende del «hasta» del plan anterior. */
  validate_plan_ranges(planes).forEach(function (error) {
    planes.forEach(function (plan, indice) {
      if (plan.clave === error.clave) {
        errores['gestion.planes.' + indice + '.' + error.campo] = error.mensaje
      }
    })
  })

  check('gestion.usuario_extra', gestion.usuario_extra, 0, MAX_MONTO, 2)
  const descuento = gestion.descuento_bienvenida || {}
  check('gestion.descuento_bienvenida.porcentaje', descuento.porcentaje, 0, 100, 2)
  check('gestion.descuento_bienvenida.meses', descuento.meses, 0, MAX_MESES_DESCUENTO, 0)

  check('tienda.mensualidad', (precios.tienda || {}).mensualidad, 0, MAX_MONTO, 2)

  const agentes = precios.agentes || {}
  check('agentes.lite.mensualidad', (agentes.lite || {}).mensualidad, 0, MAX_MONTO, 2)
  check('agentes.full.mensualidad', (agentes.full || {}).mensualidad, 0, MAX_MONTO, 2)

  const implementaciones = precios.implementaciones || {}
  check('implementaciones.anticipo_porcentaje', implementaciones.anticipo_porcentaje, 0, 100, 2)
  ;(implementaciones.items || []).forEach(function (item, indice) {
    check('implementaciones.items.' + indice + '.precio', item.precio, 0, MAX_MONTO, 2)
  })

  const costos_meta = precios.costos_meta || {}
  check('costos_meta.mensajes_libres_gratis_por_mes', costos_meta.mensajes_libres_gratis_por_mes, 0, MAX_MONTO, 0)
  ;(costos_meta.tarifas || []).forEach(function (tarifa, indice) {
    check('costos_meta.tarifas.' + indice + '.usd', tarifa.usd, 0, MAX_MONTO, 4)
    check('costos_meta.tarifas.' + indice + '.ars', tarifa.ars, 0, MAX_MONTO, 2)
  })

  return errores
}
