/**
 * Lógica pura de la pantalla Cuenta → «Precios vigentes» (misión embudo-whatsapp-precios, E1).
 *
 * La fuente única de precios vive en admin-api (`admin_settings.precios_vigentes`) y el contrato JSON
 * es el de §2.6 del plan. Este archivo NO calcula precios: sólo hace lo que el contrato permite a las
 * puntas (la mitad de la implementación y el abono con descuento, con redondeo a 2 decimales), y desde el
 * ajuste «oferta simple» (21/11/2026) una VISTA PREVIA de la mensualidad de cada paquete de Agentes y de
 * los tres juntos, con la misma fórmula que la API y redondeo a pesos enteros. Lo que vale es lo que
 * devuelve la API al guardar: la vista previa sólo sirve mientras se edita. Valida
 * lo que el operador tipea antes de guardar (el backend igual responde 422) y da formato de lectura.
 *
 * Es JavaScript sin imports a propósito: `pruebas/precios-vigentes.cjs` lo lee tal cual y lo ejecuta en
 * Node, así que no puede depender de Vue ni de axios.
 */

/*
 * Topes de cada campo: son una COPIA de los que aplica admin-api en
 * `PreciosVigentesSettings::validar()` (misma fuente de verdad: si allá cambia uno, se cambia acá).
 */

/** Techo de cualquier monto en pesos (y de la tarifa en USD) que acepta el backend. */
export const MAX_MONTO = 99999999

/** Techo de meses de descuento de bienvenida que acepta el backend. */
export const MAX_MESES_DESCUENTO = 24

/** Techo de usuarios incluidos en un plan (el mínimo es 1). */
export const MAX_USUARIOS = 1000

/** Techo de las operaciones de un rango de plan y de los mensajes libres gratis por mes. */
export const MAX_OPERACIONES = 100000000

/** Techo de los textos largos de Agentes (`incluye`, `uso_de_tokens`). */
export const MAX_TEXTO_LARGO = 300

/** Techo de la referencia de la cotización («Dólar blue, venta»). */
export const MAX_TEXTO_REFERENCIA = 60

/** Techo del nombre de un paquete de Agentes. */
export const MAX_TEXTO_NOMBRE = 40

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
 * Redondea a pesos enteros (el redondeo del contrato para la mensualidad de un paquete y para el precio
 * de los tres juntos). La tolerancia de 1e-9 evita que un 0,5 expresado en punto flotante caiga para abajo.
 *
 * @param {number} valor Importe en pesos.
 * @returns {number} Importe entero.
 */
function round_to_pesos(valor) {
  return Math.round(Number(valor) + 1e-9)
}

/**
 * Calcula la mensualidad de un paquete de Agentes: `ganancia + tokens_usd * cotización`, a pesos enteros.
 * Es la misma fórmula que aplica la API; acá sólo se usa como vista previa mientras se edita.
 *
 * @param {number} profit Ganancia fija por paquete, en pesos.
 * @param {number} tokens_usd Tokens del paquete, en USD.
 * @param {number} usd_rate Cotización del dólar (blue, venta), en pesos.
 * @returns {number} Mensualidad en pesos enteros.
 */
export function calculate_package_fee(profit, tokens_usd, usd_rate) {
  return round_to_pesos(Number(profit) + Number(tokens_usd) * Number(usd_rate))
}

/**
 * Suma el precio de lista de los tres productos (`implementaciones.items`).
 *
 * @param {Array<{precio: number}>} items Los tres productos de implementación.
 * @returns {number} Suma de los precios, sin descuento.
 */
export function calculate_three_together_list_price(items) {
  let total = 0
  ;(items || []).forEach(function (item) {
    total += Number(item.precio)
  })
  return round_to_cents(total)
}

/**
 * Calcula el precio de los tres juntos: `precio_lista * (100 - descuento) / 100`, a pesos enteros.
 *
 * @param {number} list_price Precio de lista (suma de los tres productos).
 * @param {number} percentage Porcentaje de descuento (hoy 30).
 * @returns {number} Precio con descuento en pesos enteros.
 */
export function calculate_three_together_price(list_price, percentage) {
  return round_to_pesos((Number(list_price) * (100 - Number(percentage))) / 100)
}

/**
 * Vista previa de la mensualidad de cada paquete de Agentes con lo que se está editando.
 *
 * @param {Object} agentes Bloque `agentes` del contrato.
 * @returns {Array<{clave: string, mensualidad: (number|null)}>} Un elemento por paquete; la mensualidad es
 *   null si falta la cotización, la ganancia o los tokens (no se inventa un número).
 */
export function preview_agent_packages(agentes) {
  const bloque = agentes || {}
  const cotizacion = (bloque.cotizacion_usd || {}).valor
  return (bloque.paquetes || []).map(function (paquete) {
    const incompleto = is_missing_number(cotizacion) || is_missing_number(bloque.ganancia_por_paquete) || is_missing_number(paquete.tokens_usd)
    return {
      clave: paquete.clave,
      mensualidad: incompleto ? null : calculate_package_fee(bloque.ganancia_por_paquete, paquete.tokens_usd, cotizacion),
    }
  })
}

/**
 * Vista previa del precio de lista y del precio con descuento de los tres juntos.
 *
 * @param {Object} implementaciones Bloque `implementaciones` del contrato.
 * @returns {{precio_lista: (number|null), precio: (number|null)}} null en lo que no se puede calcular
 *   porque falta algún precio o el porcentaje.
 */
export function preview_three_together(implementaciones) {
  const bloque = implementaciones || {}
  const items = bloque.items || []
  const porcentaje = (bloque.tres_juntos || {}).descuento_porcentaje
  const precios_completos = items.length > 0 && items.every(function (item) {
    return !is_missing_number(item.precio)
  })
  if (!precios_completos) {
    return { precio_lista: null, precio: null }
  }
  const lista = calculate_three_together_list_price(items)
  return {
    precio_lista: lista,
    precio: is_missing_number(porcentaje) ? null : calculate_three_together_price(lista, porcentaje),
  }
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
  /* Misma tolerancia que el servidor: abs(n * factor - round(n * factor)) > 0.0001 es inválido. */
  return Math.abs(valor * factor - Math.round(valor * factor)) <= 0.0001
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
 * Valida un texto libre: no vacío (sin contar espacios) y de hasta `maximo` caracteres.
 *
 * @param {*} valor Valor del campo.
 * @param {number} maximo Largo máximo permitido.
 * @returns {string} Mensaje legible o '' si el texto es válido.
 */
export function validate_text_field(valor, maximo) {
  if (typeof valor !== 'string' || valor.trim().length === 0) {
    return 'Completá este campo.'
  }
  if (valor.trim().length > maximo) {
    return 'Admite hasta ' + format_plain_number(maximo) + ' caracteres.'
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
 * Indica si un texto es una fecha real en formato `AAAA-MM-DD` (lo mismo que valida el servidor con
 * `DateTime::createFromFormat('Y-m-d')` y comparando el resultado con el texto original).
 *
 * @param {*} valor Texto a revisar (lo que entrega un `<input type="date">`).
 * @returns {boolean} true si es una fecha existente con ese formato exacto.
 */
export function is_valid_iso_date(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false
  }
  const partes = valor.split('-')
  const anio = Number(partes[0])
  const mes = Number(partes[1])
  const dia = Number(partes[2])
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

/**
 * Valida todo el contrato antes de guardar. Devuelve un mapa «ruta del campo → mensaje» con las MISMAS
 * claves que arma el servidor en el `errors` de un 422: notación de puntos donde cada elemento de una
 * lista se nombra con su `clave`, no con su posición (ej. `gestion.planes.intermedio.desde`,
 * `implementaciones.items.gestion.precio`, `costos_meta.tarifas.marketing.usd`). Así la validación local
 * y la del servidor marcan el mismo campo, y los topes son los de `PreciosVigentesSettings::validar()`.
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
    const base = 'gestion.planes.' + plan.clave
    const es_ultimo = indice === planes.length - 1
    check(base + '.abono', plan.abono, 0, MAX_MONTO, 2)
    check(base + '.usuarios', plan.usuarios, 1, MAX_USUARIOS, 0)
    check(base + '.desde', plan.desde, 0, MAX_OPERACIONES, 0)
    /* El «hasta» del último plan es null (ilimitado) y lo revisa validate_plan_ranges. */
    if (plan.hasta !== null) {
      check(base + '.hasta', plan.hasta, 0, MAX_OPERACIONES, 0)
    }
    /* El excedente sólo puede faltar en el último plan (Empresa); en los demás es obligatorio. */
    if (plan.excedente !== null) {
      check(base + '.excedente', plan.excedente, 0, MAX_MONTO, 2)
    } else if (!es_ultimo) {
      errores[base + '.excedente'] = 'Completá el precio de la operación excedente.'
    }
  })

  /* Los rangos se validan en conjunto: un «desde» depende del «hasta» del plan anterior. */
  validate_plan_ranges(planes).forEach(function (error) {
    errores['gestion.planes.' + error.clave + '.' + error.campo] = error.mensaje
  })

  check('gestion.usuario_extra', gestion.usuario_extra, 0, MAX_MONTO, 2)
  const descuento = gestion.descuento_bienvenida || {}
  check('gestion.descuento_bienvenida.porcentaje', descuento.porcentaje, 0, 100, 2)
  check('gestion.descuento_bienvenida.meses', descuento.meses, 0, MAX_MESES_DESCUENTO, 0)

  check('tienda.mensualidad', (precios.tienda || {}).mensualidad, 0, MAX_MONTO, 2)

  /**
   * Valida un texto libre y, si falla, lo anota en `errores`.
   *
   * @param {string} ruta Ruta del campo.
   * @param {*} valor Valor actual.
   * @param {number} maximo Largo máximo.
   * @returns {void}
   */
  function check_text(ruta, valor, maximo) {
    const mensaje = validate_text_field(valor, maximo)
    if (mensaje !== '') {
      errores[ruta] = mensaje
    }
  }

  /* Agentes (oferta simple): un solo producto con tres paquetes de tokens. La mensualidad es calculada
     (sólo lectura), así que no se valida acá. */
  const agentes = precios.agentes || {}
  const cotizacion = agentes.cotizacion_usd || {}
  check_text('agentes.incluye', agentes.incluye, MAX_TEXTO_LARGO)
  check_text('agentes.uso_de_tokens', agentes.uso_de_tokens, MAX_TEXTO_LARGO)
  /* La cotización es > 0: con 2 decimales, 0,01 es el mínimo. */
  check('agentes.cotizacion_usd.valor', cotizacion.valor, 0.01, MAX_MONTO, 2)
  check_text('agentes.cotizacion_usd.referencia', cotizacion.referencia, MAX_TEXTO_REFERENCIA)
  if (!is_valid_iso_date(cotizacion.fecha)) {
    errores['agentes.cotizacion_usd.fecha'] = 'Elegí una fecha válida (día/mes/año).'
  }
  check('agentes.ganancia_por_paquete', agentes.ganancia_por_paquete, 0, MAX_MONTO, 2)
  check('agentes.aviso_consumo_porcentaje', agentes.aviso_consumo_porcentaje, 1, 100, 0)
  ;(agentes.paquetes || []).forEach(function (paquete) {
    check_text('agentes.paquetes.' + paquete.clave + '.nombre', paquete.nombre, MAX_TEXTO_NOMBRE)
    /* Tokens > 0 con hasta 4 decimales: 0,0001 es el mínimo. */
    check('agentes.paquetes.' + paquete.clave + '.tokens_usd', paquete.tokens_usd, 0.0001, MAX_MONTO, 4)
  })

  const implementaciones = precios.implementaciones || {}
  check('implementaciones.anticipo_porcentaje', implementaciones.anticipo_porcentaje, 0, 100, 2)
  check('implementaciones.tres_juntos.descuento_porcentaje', (implementaciones.tres_juntos || {}).descuento_porcentaje, 0, 100, 2)
  ;(implementaciones.items || []).forEach(function (item) {
    check('implementaciones.items.' + item.clave + '.precio', item.precio, 0, MAX_MONTO, 2)
  })

  const costos_meta = precios.costos_meta || {}
  if (!is_valid_iso_date(costos_meta.vigente_desde)) {
    errores['costos_meta.vigente_desde'] = 'Elegí una fecha válida (día/mes/año).'
  }
  check('costos_meta.mensajes_libres_gratis_por_mes', costos_meta.mensajes_libres_gratis_por_mes, 0, MAX_OPERACIONES, 0)
  ;(costos_meta.tarifas || []).forEach(function (tarifa) {
    check('costos_meta.tarifas.' + tarifa.clave + '.usd', tarifa.usd, 0, MAX_MONTO, 4)
    check('costos_meta.tarifas.' + tarifa.clave + '.ars', tarifa.ars, 0, MAX_MONTO, 2)
  })

  return errores
}

/**
 * Lista las rutas de error que tienen un campo visible en la pantalla para un contrato dado: las que
 * puede marcar la validación local y las que el servidor puede devolver sobre algo que se edita.
 * Quedan afuera, a propósito, lo que la pantalla no edita (los `nombre` de planes, ítems y tarifas,
 * la mensualidad de cada paquete y los precios de los tres juntos, que son calculados, y
 * `implementaciones.reembolsable`) y los errores de estructura
 * (`contrato.…`): esos van al resumen general.
 *
 * @param {Object} precios Contrato de precios que se está editando.
 * @returns {string[]} Rutas con campo visible.
 */
export function list_field_error_keys(precios) {
  /** Rutas acumuladas. */
  const rutas = [
    'gestion.usuario_extra',
    'gestion.descuento_bienvenida.porcentaje',
    'gestion.descuento_bienvenida.meses',
    'tienda.mensualidad',
    'agentes.incluye',
    'agentes.uso_de_tokens',
    'agentes.cotizacion_usd.valor',
    'agentes.cotizacion_usd.referencia',
    'agentes.cotizacion_usd.fecha',
    'agentes.ganancia_por_paquete',
    'agentes.aviso_consumo_porcentaje',
    'implementaciones.anticipo_porcentaje',
    'implementaciones.tres_juntos.descuento_porcentaje',
    'costos_meta.vigente_desde',
    'costos_meta.mensajes_libres_gratis_por_mes',
  ]

  ;((precios.gestion || {}).planes || []).forEach(function (plan) {
    ;['desde', 'hasta', 'usuarios', 'abono', 'excedente'].forEach(function (campo) {
      rutas.push('gestion.planes.' + plan.clave + '.' + campo)
    })
  })
  ;((precios.agentes || {}).paquetes || []).forEach(function (paquete) {
    rutas.push('agentes.paquetes.' + paquete.clave + '.nombre')
    rutas.push('agentes.paquetes.' + paquete.clave + '.tokens_usd')
  })
  ;((precios.implementaciones || {}).items || []).forEach(function (item) {
    rutas.push('implementaciones.items.' + item.clave + '.precio')
  })
  ;((precios.costos_meta || {}).tarifas || []).forEach(function (tarifa) {
    rutas.push('costos_meta.tarifas.' + tarifa.clave + '.usd')
    rutas.push('costos_meta.tarifas.' + tarifa.clave + '.ars')
  })

  return rutas
}

/**
 * Resuelve el objeto `errors` de un 422 del servidor: lo que tiene un campo visible va a `por_campo`
 * (la clave es la misma que usan los componentes, porque el servidor y la pantalla comparten la
 * notación por `clave`) y el resto va a `generales`, para mostrarlo en el resumen de la pantalla en
 * vez de perderlo.
 *
 * @param {Object<string, string[]|string>|undefined} errors Campo `errors` de la respuesta de Laravel.
 * @param {Object} precios Contrato de precios que se está editando.
 * @returns {{por_campo: Object<string, string>, generales: string[]}} Errores por campo y mensajes sueltos.
 */
export function resolve_server_errors(errors, precios) {
  /** Rutas que tienen un campo donde mostrarse. */
  const visibles = list_field_error_keys(precios || {})
  /** Resultado. */
  const resuelto = { por_campo: {}, generales: [] }

  Object.keys(errors || {}).forEach(function (ruta) {
    const mensajes = errors[ruta]
    const mensaje = Array.isArray(mensajes) ? mensajes[0] : String(mensajes)
    if (visibles.indexOf(ruta) !== -1) {
      resuelto.por_campo[ruta] = mensaje
    } else {
      resuelto.generales.push(mensaje)
    }
  })

  return resuelto
}
