/**
 * Utilidades del módulo de Pipelines (CRM) que comparten el tablero, la ficha, el modal de mover,
 * la agenda, la configuración y la pestaña del cliente/lead. Misión pipelines-crm, 27/9/2026.
 *
 * Nada de acá decide una regla de negocio: qué es obligatorio, qué etapa acepta qué, cuándo algo
 * está vencido… eso lo decide el back y viaja en la respuesta (`required`, `agenda_bucket`, 422).
 * Acá solo se formatea, se ordena para mostrar y se arma lo que se manda.
 */
import {
  datetime_local_to_api,
  format_date,
  format_datetime,
  date_input_to_api,
} from '@/utils/pipeline_dates'

/**
 * Tipos de campo que representan una fecha: son los únicos que pueden ser "agenda" (completan la
 * próxima acción). Es la misma lista que valida el back al guardar la etapa.
 */
export const DATE_FIELD_TYPES = ['date', 'datetime']

/**
 * Colores sugeridos para una etapa (paleta de Bootstrap). Son solo atajos del selector: el color
 * es libre (`#rrggbb`).
 */
export const STAGE_COLOR_PRESETS = [
  '#adb5bd',
  '#0dcaf0',
  '#0d6efd',
  '#6f42c1',
  '#d63384',
  '#fd7e14',
  '#ffc107',
  '#20c997',
  '#198754',
  '#dc3545',
]

/**
 * Iniciales para el avatar del responsable: primera letra de las dos primeras palabras.
 *
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(function (w) {
    return w !== ''
  })
  if (!words.length) {
    return '?'
  }
  let result = words[0].charAt(0)
  if (words.length > 1) {
    result = result + words[1].charAt(0)
  }
  return result.toUpperCase()
}

/**
 * Link de WhatsApp: `https://wa.me/<solo dígitos>`. Solo ABRE WhatsApp: el sistema no manda nada.
 *
 * @param {string|null|undefined} phone
 * @returns {string} Vacío si el teléfono no tiene dígitos.
 */
export function whatsapp_url(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits ? 'https://wa.me/' + digits : ''
}

/**
 * Link `tel:` para llamar desde el teléfono.
 *
 * @param {string|null|undefined} phone
 * @returns {string}
 */
export function tel_url(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '')
  return clean ? 'tel:' + clean : ''
}

/**
 * Etiqueta del tipo de sujeto.
 *
 * @param {string} type `client` | `lead`
 * @returns {string}
 */
export function subject_type_label(type) {
  if (type === 'client') {
    return 'Cliente'
  }
  if (type === 'lead') {
    return 'Lead'
  }
  return ''
}

/**
 * Nombre visible del sujeto de una oportunidad (el back ya resuelve cuál usar).
 *
 * @param {Object} opportunity
 * @returns {string}
 */
export function subject_name(opportunity) {
  const subject = (opportunity && opportunity.subject) || {}
  if (subject.name) {
    return subject.name
  }
  return '(sin nombre)'
}

/**
 * Orden de las columnas del tablero: primero las etapas abiertas y al final las cerradas
 * (ganada/perdida), cada grupo por `sort_order`. El plan pide las cerradas al final siempre, así
 * que la configuración usa este mismo orden para que las dos pantallas coincidan.
 *
 * @param {Array<Object>} stages
 * @returns {Array<Object>}
 */
export function sort_stages_for_board(stages) {
  const list = Array.isArray(stages) ? stages.slice() : []
  return list.sort(function (a, b) {
    const a_closed = a.type === 'open' ? 0 : 1
    const b_closed = b.type === 'open' ? 0 : 1
    if (a_closed !== b_closed) {
      return a_closed - b_closed
    }
    const by_order = Number(a.sort_order || 0) - Number(b.sort_order || 0)
    if (by_order !== 0) {
      return by_order
    }
    return Number(a.id) - Number(b.id)
  })
}

/**
 * Primera etapa abierta del pipeline (la que el back usa por defecto al dar de alta).
 *
 * @param {Object|null} pipeline
 * @returns {Object|null}
 */
export function first_open_stage(pipeline) {
  const stages = sort_stages_for_board((pipeline && pipeline.stages) || [])
  return stages.find(function (s) {
    return s.type === 'open'
  }) || null
}

/**
 * Primer mensaje de error de validación de una clave (`fields.canal`, `lost_reason`, …).
 *
 * @param {Object} errors Objeto `errors` de un 422 de Laravel.
 * @param {string} key
 * @returns {string}
 */
export function first_error(errors, key) {
  if (!errors || !key) {
    return ''
  }
  const value = errors[key]
  if (Array.isArray(value)) {
    return value.length ? String(value[0]) : ''
  }
  return value ? String(value) : ''
}

/**
 * Objeto `errors` de un 422, o `{}` para cualquier otro error.
 *
 * @param {Object} error Error de axios.
 * @returns {Object}
 */
export function validation_errors(error) {
  const response = error && error.response
  if (!response || response.status !== 422 || !response.data) {
    return {}
  }
  const errors = response.data.errors
  return errors && typeof errors === 'object' ? errors : {}
}

/**
 * Toast global del admin (lo pinta App.vue).
 *
 * @param {string} message
 * @param {string} [variant] success | danger | warning | info
 * @returns {void}
 */
export function show_toast(message, variant) {
  window.dispatchEvent(new CustomEvent('admin-spa-toast', {
    detail: { message: String(message), variant: variant || 'success' },
  }))
}

/**
 * Valor de un campo cargado al mover, tal como se lee en el historial (la foto que guardó el back).
 *
 * @param {string} type Tipo del campo.
 * @param {*} value
 * @returns {string}
 */
export function format_field_value(type, value) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  if (type === 'boolean') {
    const truthy = value === true || value === 1 || value === '1' || value === 'true'
    return truthy ? 'Sí' : 'No'
  }
  if (type === 'date') {
    return format_date(value) || String(value)
  }
  if (type === 'datetime') {
    return format_datetime(value) || String(value)
  }
  return String(value)
}

/**
 * Convierte lo que tiene un input del modal de mover en lo que espera la API para ese tipo.
 * Devuelve `undefined` cuando el campo quedó sin responder: esa clave no se manda y, si era
 * obligatoria, es el back el que contesta el 422 (la SPA no decide qué es obligatorio).
 *
 * @param {Object} field Definición del campo (`key`, `type`, …).
 * @param {*} raw Valor del input.
 * @returns {*}
 */
export function serialize_field_value(field, raw) {
  const type = field && field.type
  if (type === 'boolean') {
    return raw === true || raw === false ? raw : undefined
  }
  if (raw === null || raw === undefined) {
    return undefined
  }
  if (typeof raw === 'string' && raw.trim() === '') {
    return undefined
  }
  if (type === 'datetime') {
    // Del `YYYY-MM-DDTHH:mm` del input a `Y-m-d H:i`. Si el navegador mandó algo raro, se manda
    // tal cual y el back responde con el error del formato.
    return datetime_local_to_api(raw) || raw
  }
  if (type === 'date') {
    return date_input_to_api(raw) || raw
  }
  return raw
}

/** Contador para las claves locales de las filas del editor de campos. */
let row_uid_seq = 0

/**
 * Fila editable nueva del editor de campos de una etapa.
 *
 * @returns {Object}
 */
export function new_field_row() {
  row_uid_seq = row_uid_seq + 1
  return {
    uid: 'nuevo-' + row_uid_seq,
    key: '',
    label: '',
    type: 'text',
    required: false,
    agenda: false,
    options_text: '',
  }
}

/**
 * Filas editables a partir de la definición de campos que devolvió la API.
 *
 * @param {Array<Object>} fields
 * @returns {Array<Object>}
 */
export function field_rows_from_definition(fields) {
  const list = Array.isArray(fields) ? fields : []
  return list.map(function (field) {
    row_uid_seq = row_uid_seq + 1
    return {
      uid: 'campo-' + row_uid_seq,
      key: field.key || '',
      label: field.label || '',
      type: field.type || 'text',
      required: !!field.required,
      agenda: !!field.agenda,
      options_text: Array.isArray(field.options) ? field.options.join('\n') : '',
    }
  })
}

/**
 * Definición de campos que se manda al guardar una etapa, a partir de las filas del editor.
 *
 * - `key` viaja solo si el campo ya la tenía: así el back la conserva (el historial y la agenda se
 *   apoyan en ella) y a los nuevos se la genera desde la etiqueta.
 * - `options`: una por línea, solo para `select` (para el resto el back la normaliza a `[]`).
 * - `agenda` solo puede quedar prendido en campos de fecha: el tilde se esconde para el resto, así
 *   que acá no se manda un valor que el operador ya no ve. Si hay dos agenda, lo rechaza el back.
 *
 * @param {Array<Object>} rows
 * @returns {Array<Object>}
 */
export function field_definition_from_rows(rows) {
  const list = Array.isArray(rows) ? rows : []
  return list.map(function (row) {
    const is_select = row.type === 'select'
    const options = is_select
      ? String(row.options_text || '').split('\n').map(function (o) {
        return o.trim()
      }).filter(function (o) {
        return o !== ''
      })
      : []
    const payload = {
      label: row.label,
      type: row.type,
      required: !!row.required,
      agenda: DATE_FIELD_TYPES.indexOf(row.type) !== -1 ? !!row.agenda : false,
      options: options,
    }
    if (row.key) {
      payload.key = row.key
    }
    return payload
  })
}
