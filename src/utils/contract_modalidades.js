/**
 * Modalidad del contrato y sistemas contratados (misión precios-dos-modalidades, 13/10/2026).
 *
 * ComercioCity vende en dos modalidades —Licencia (entrada alta, mensualidad de por vida que solo
 * se ajusta por IPC) y Suscripción (entrada baja, plazo mínimo, mensualidad que después sigue la
 * lista)— y el PDF del contrato lleva la letra chica de la elegida. Lo usan las dos pestañas
 * Contrato: la del lead (`components/lead/contract/Index.vue`) y la del cliente
 * (`components/client/ContratoTab.vue`), que guardan las mismas tres columnas:
 * `contract_modalidad`, `contract_sistemas` y `contract_permanencia_meses`.
 *
 * 🔴 Las keys y las etiquetas de SISTEMAS son las de `CotizadorSettings::SISTEMAS` en admin-api,
 * que es la fuente de los nombres comerciales: el PDF imprime la etiqueta de allá, no la de acá.
 * Si cambia un nombre o se suma un sistema, se cambia en los dos lados.
 *
 * 🔴 Sin modalidad (null) el contrato sale con el texto de siempre. Por eso ninguna pestaña elige
 * una modalidad por defecto: un lead viejo con contrato no puede cambiar su PDF por abrirlo.
 */

/** Las dos modalidades, en el orden en que se ofrecen. */
export const MODALIDADES = [
  { key: 'licencia', label: 'Licencia' },
  { key: 'suscripcion', label: 'Suscripción' },
]

/** Sistemas contratables: mismas keys y etiquetas que `CotizadorSettings::SISTEMAS`. */
export const SISTEMAS = [
  { key: 'gestion', label: 'ComercioCity Gestión' },
  { key: 'ecommerce', label: 'ComercioCity E-Commerce' },
  { key: 'agentes', label: 'ComercioCity Agentes' },
]

/** Línea de ayuda corta debajo del selector, por modalidad. */
export const AYUDA_MODALIDAD = {
  licencia: 'Mensualidad de por vida: solo se ajusta por IPC.',
  suscripcion: 'Plazo mínimo y actualización por IPC cada 3 meses.',
}

/** Aviso cuando no hay modalidad elegida. */
export const AVISO_SIN_MODALIDAD = 'Sin modalidad el contrato sale con el texto anterior, sin la letra chica de Licencia o Suscripción.'

/** Plazo mínimo de la Suscripción por defecto, en meses (el mismo default que usa el PDF). */
export const PERMANENCIA_MESES_DEFAULT = 12

/**
 * ¿El valor está vacío para un input del formulario? (null, undefined o string vacío).
 * @param {any} valor
 * @returns {boolean}
 */
function esta_vacio(valor) {
  return valor === null || valor === undefined || valor === ''
}

/**
 * Ajusta los campos que dependen de la modalidad cuando QUIEN VENDE la cambia en el formulario.
 *
 * - A Suscripción: los meses de IPC pasan a 3 si estaban vacíos o en 6 (el default de Licencia),
 *   y el plazo mínimo a 12 si estaba vacío.
 * - A Licencia: los meses de IPC pasan a 6 si estaban vacíos o en 3 (el default de Suscripción).
 *
 * Nada más se toca: un valor que alguien cargó a mano (9 meses, 24 de plazo) se respeta.
 *
 * 🔴 Se llama SOLO ante un cambio hecho en el formulario, nunca al abrir un contrato: un contrato
 * guardado tiene que volver a abrirse exactamente como quedó.
 *
 * @param {Object} contrato Objeto con los campos `contract_*` (el record del lead o el form del cliente); se muta.
 * @param {string|null} modalidad La modalidad nueva.
 * @returns {void}
 */
export function aplicar_defaults_de_modalidad(contrato, modalidad) {
  if (!contrato) {
    return
  }
  if (modalidad === 'suscripcion') {
    if (esta_vacio(contrato.contract_meses_actualizacion) || Number(contrato.contract_meses_actualizacion) === 6) {
      contrato.contract_meses_actualizacion = 3
    }
    if (esta_vacio(contrato.contract_permanencia_meses)) {
      contrato.contract_permanencia_meses = PERMANENCIA_MESES_DEFAULT
    }
    return
  }
  if (modalidad === 'licencia') {
    if (esta_vacio(contrato.contract_meses_actualizacion) || Number(contrato.contract_meses_actualizacion) === 3) {
      contrato.contract_meses_actualizacion = 6
    }
  }
}

/**
 * Las keys de sistema de una cotización hecha con el cotizador del lead
 * (`contract_cotizacion_items`: `[{key, label, precio_usd, precio_ars}]`), en el orden del
 * catálogo y sin repetidos. Sirve para precargar los sistemas contratados de un lead que ya se
 * cotizó. Lo que no sea un array de items con una key conocida se ignora.
 *
 * @param {any} items
 * @returns {Array<string>}
 */
export function sistemas_desde_cotizacion(items) {
  if (!Array.isArray(items)) {
    return []
  }
  const keys_cotizadas = items
    .filter(function (item) {
      return item && typeof item.key === 'string'
    })
    .map(function (item) {
      return item.key
    })
  return SISTEMAS
    .map(function (sistema) {
      return sistema.key
    })
    .filter(function (key) {
      return keys_cotizadas.indexOf(key) !== -1
    })
}

/**
 * Valor guardado de `contract_modalidad` normalizado para el selector: la key si es una de las
 * dos, null en cualquier otro caso (que es lo mismo que el PDF hace con un valor desconocido).
 *
 * @param {any} valor
 * @returns {string|null}
 */
export function normalizar_modalidad(valor) {
  const valida = MODALIDADES.some(function (modalidad) {
    return modalidad.key === valor
  })
  return valida ? valor : null
}
