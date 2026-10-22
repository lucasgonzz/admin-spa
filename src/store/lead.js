import __base_store, { set_global_filter_loading } from '@/common-vue/store/__base_store'
import api from '@/utils/axios'
import { route_string } from '@/utils/route_string'
import { run_once } from '@/common-vue/helpers/request_cache_helper'

/**
 * Pide los totales de mensajes sin leer y los vuelca al store.
 *
 * Va por `run_once` con la clave del GET: dos llamadores en el mismo tick comparten la misma
 * request, y como la clave arranca con `GET `, cualquier escritura sobre esa ruta la invalida
 * sola desde el interceptor del helper.
 *
 * Sin ventana de frescura a propósito: lo único que se deduplica es lo simultáneo. Con `force`
 * ni eso, porque el que llama ya sabe que el número cambió (ver `fetch_unread_badges`).
 *
 * @param {Object} context Contexto del módulo Vuex.
 * @param {boolean} [force] Pedir de nuevo aunque haya un GET en vuelo.
 * @returns {Promise<number>} Total de no leídos vigente en el store.
 */
function pedir_unread_badges(context, force) {
  const commit = context.commit
  return run_once(
    'GET /lead/unread-badges',
    function (sigue_vigente) {
      return api.get('/lead/unread-badges').then((res) => {
        /* Si un `force` salió después que este GET y ya volvió, este trae el número de ANTES del
           evento: commitearlo sería atrasar el badge a mano. */
        if (!sigue_vigente()) {
          return context.state.unread_total
        }
        if (res.data && res.data.unread_total != null) {
          commit('set_unread_total', res.data.unread_total)
        }
        if (res.data && res.data.unread_by_status != null) {
          commit('set_unread_by_status', res.data.unread_by_status)
        }
        return context.state.unread_total
      })
    },
    { force: force === true }
  )
}

/**
 * Fusiona mensajes del hilo conservando adjuntos si el payload nuevo no los trae.
 *
 * @param {Array<Object>} previous
 * @param {Array<Object>} incoming
 * @returns {Array<Object>}
 */
function merge_lead_messages_preserving_attachments(previous, incoming) {
  const by_id = {}
  let i = 0
  for (i = 0; i < previous.length; i = i + 1) {
    by_id[previous[i].id] = previous[i]
  }
  const merged = []
  for (i = 0; i < incoming.length; i = i + 1) {
    const msg = incoming[i]
    const old = by_id[msg.id]
    if (!old) {
      merged.push(msg)
      continue
    }
    const row = Object.assign({}, old, msg)
    if (
      old.attachments &&
      old.attachments.length &&
      (!msg.attachments || !msg.attachments.length)
    ) {
      row.attachments = old.attachments
    }
    merged.push(row)
  }
  return merged
}

/**
 * Fusiona mensajes del hilo abierto sin perder el historial completo cuando llega un payload liviano.
 *
 * @param {Array<Object>|null|undefined} previous
 * @param {Array<Object>|null|undefined} incoming
 * @returns {Array<Object>|null|undefined}
 */
function merge_conversation_messages(previous, incoming) {
  if (!incoming || !incoming.length) {
    return previous
  }
  if (!previous || !previous.length) {
    return incoming
  }
  /** Índice por id para conservar todo el hilo previo y actualizar filas puntuales. */
  const by_id = {}
  let i = 0
  for (i = 0; i < previous.length; i = i + 1) {
    by_id[previous[i].id] = previous[i]
  }
  for (i = 0; i < incoming.length; i = i + 1) {
    /** Mensaje entrante (notificación o actualización puntual). */
    const msg = incoming[i]
    const old = by_id[msg.id]
    if (!old) {
      by_id[msg.id] = msg
      continue
    }
    const row = Object.assign({}, old, msg)
    if (
      old.attachments &&
      old.attachments.length &&
      (!msg.attachments || !msg.attachments.length)
    ) {
      row.attachments = old.attachments
    }
    by_id[msg.id] = row
  }
  /** Lista ordenada cronológicamente por id. */
  const merged = []
  const keys = Object.keys(by_id)
  keys.sort(function (a, b) {
    return parseInt(a, 10) - parseInt(b, 10)
  })
  for (i = 0; i < keys.length; i = i + 1) {
    merged.push(by_id[keys[i]])
  }
  return merged
}

/**
 * Cuerpo del POST/PUT de un mensaje programado. Es el mismo en el alta y en la edición,
 * así que vive acá y no duplicado en los dos actions.
 *
 * `template_*` viaja siempre (null cuando el modo es texto libre) para que editar un
 * programado de plantilla y pasarlo a texto libre limpie los campos viejos en backend,
 * en vez de dejarlos colgados por ausencia de la clave.
 *
 * @param {Object} payload payload del action (ver schedule_message)
 * @returns {Object} cuerpo listo para el endpoint
 */
function build_scheduled_message_body(payload) {
  return {
    scheduled_send_at:      payload.scheduled_send_at,
    mode:                   payload.mode,
    content:                payload.content,
    template_name:          payload.template_name != null ? payload.template_name : null,
    template_language:      payload.template_language != null ? payload.template_language : null,
    template_variables:     payload.template_variables != null ? payload.template_variables : null,
    cancel_if_lead_replies: Boolean(payload.cancel_if_lead_replies),
  }
}

/**
 * Si el admin está viendo la conversación WhatsApp de ese lead, fuerza contadores de no leídos a 0
 * en el payload local hasta que el POST mark-whatsapp-messages-read confirme en backend.
 *
 * @param {Object} state Estado del módulo lead.
 * @param {Object|null|undefined} model Lead entrante desde API o Pusher.
 * @returns {Object|null|undefined}
 */
function apply_viewing_unread_override(state, model) {
  if (!model || model.id == null) {
    return model
  }
  if (state.lead_conversation_visible_id == null) {
    return model
  }
  if (String(state.lead_conversation_visible_id) !== String(model.id)) {
    return model
  }
  return Object.assign({}, model, {
    /* Badge gris (per-admin) de la columna "Sin leer": se limpia al abrir la conversación.
       pending_verification_count y failed_send_count NO se tocan acá: son globales y bajan
       cuando el mensaje se verifica o el error se resuelve, no por mirar la conversación. */
    unread_count: 0,
    unread_messages_count: 0,
  })
}

/**
 * Slugs de estado que el operador tiene filtrados ahora, leídos del store (no del componente:
 * este mismo upsert lo dispara el socket, que no tiene acceso a Leads.vue).
 *
 * Cubre los dos formatos que produce la barra de navegación: `igual_que` string (un estado
 * puntual, o el botón "Solo calificados") y `igual_que` array (un grupo entero — ver
 * on_select_status_group y el whereIn de SearchController).
 *
 * @param {Object} state Estado del módulo lead.
 * @returns {Array<string>|null} null = no hay filtro de estado (no hay que decidir nada).
 */
function active_status_filter_slugs(state) {
  const filters = state.filters || []
  let i = 0
  for (i = 0; i < filters.length; i = i + 1) {
    if (filters[i] && filters[i].key === 'status') {
      const value = filters[i].igual_que
      if (value == null || value === '') {
        return null
      }
      if (Array.isArray(value)) {
        return value.length ? value.map(String) : null
      }
      return [String(value)]
    }
  }
  return null
}

/**
 * true si el lead entrante corresponde al filtro de estado activo.
 *
 * 🔴 Devuelve true en dos casos "no sé": sin filtro de estado, y payload sin `status`. El
 * segundo importa: los eventos de Pusher mandan payloads mínimos, y sacar una fila de la
 * pantalla porque al JSON le faltaba una clave es peor que dejar una fila de más.
 *
 * @param {Object} state Estado del módulo lead.
 * @param {Object} model Lead entrante.
 * @returns {boolean}
 */
function lead_matches_active_status(state, model) {
  const allowed = active_status_filter_slugs(state)
  if (!allowed) {
    return true
  }
  if (!model || model.status == null || model.status === '') {
    return true
  }
  return allowed.indexOf(String(model.status)) !== -1
}

/**
 * Cantidad de páginas para un total y un tamaño de página dados (mínimo 1).
 *
 * @param {number} total
 * @param {number} per_page
 * @returns {number}
 */
function total_pages_for(total, per_page) {
  const per = per_page || 25
  return Math.max(1, Math.ceil((total || 0) / per))
}

/**
 * true si la fila entra en el «N sin responder» de su tarjeta (el filtro `solo_sin_responder`).
 *
 * Usa `row.sin_responder`, que calcula el servidor con el mismo scope que cuenta la tarjeta. Si la
 * fila no lo trae (admin-api anterior al 22/10/2026) cae a lo que se puede deducir del semáforo:
 * amarillo, o rojo por error de envío. Es una aproximación —no ve el caso «rojo por confirmación
 * pendiente con un mensaje del lead sin responder»— y solo existe para que una API vieja no deje el
 * botón mostrando todos los chats.
 *
 * @param {Object} row Fila de GET /lead/chats.
 * @returns {boolean}
 */
function fila_cuenta_sin_responder(row) {
  if (!row) {
    return false
  }
  if (typeof row.sin_responder === 'boolean') {
    return row.sin_responder
  }
  return row.atencion === 'amarillo' || row.atencion_motivo === 'error_envio'
}

/**
 * Ordena las filas de chat con EL MISMO criterio que el servidor, como WhatsApp (22/10/2026):
 * fijados primero (el fijado más reciente arriba) y después por último mensaje descendente. El rojo
 * y el amarillo se pintan pero NO reordenan (hasta el 21/10 los chats con atención flotaban arriba).
 *
 * Existe para que un refresco puntual de UNA fila (Pusher, fijar, marcar leído) la acomode donde
 * corresponde en vez de dejarla donde estaba hasta la próxima carga completa. No inventa un orden
 * propio: si el del servidor cambia, este cambia con él.
 *
 * @param {Array<Object>} rows
 * @returns {Array<Object>} copia ordenada
 */
function ordenar_chats(rows) {
  const copia = (rows || []).slice()
  copia.sort(function (a, b) {
    const a_pin = a.pinned_at ? 1 : 0
    const b_pin = b.pinned_at ? 1 : 0
    if (a_pin !== b_pin) {
      return b_pin - a_pin
    }
    if (a_pin && b_pin && a.pinned_at !== b.pinned_at) {
      return String(b.pinned_at).localeCompare(String(a.pinned_at))
    }
    const a_last = a.last_message_at ? String(a.last_message_at) : ''
    const b_last = b.last_message_at ? String(b.last_message_at) : ''
    if (a_last !== b_last) {
      return b_last.localeCompare(a_last)
    }
    return (b.id || 0) - (a.id || 0)
  })
  return copia
}

/**
 * Slugs de estado filtrados en la lista de chats, o null si no hay filtro.
 *
 * @param {Object} filtros `state.chats_filtros`
 * @returns {Array<string>|null}
 */
function chats_status_slugs(filtros) {
  const status = filtros ? filtros.status : null
  if (status == null || status === '') {
    return null
  }
  if (Array.isArray(status)) {
    return status.length ? status.map(String) : null
  }
  return String(status).split(',').map(function (s) { return s.trim() }).filter(Boolean)
}

/**
 * Slugs de estado filtrados, con los valores AGRUPADOS de las tarjetas ya expandidos.
 *
 * El servidor entiende tanto un slug como el `value` de una tarjeta agrupada (`demo`, `otros`),
 * así que el filtro puede llegar de las dos formas. Para decidir acá si una fila corresponde hay
 * que compararla contra slugs reales: con el valor agrupado sin expandir, cada fila refrescada
 * por Pusher se iría de la lista por no matchear (hallazgo del chequeo, 17/10/2026). La
 * expansión sale de `state.status_cards`, que trae `slugs` por tarjeta agrupada; un valor que no
 * es de ninguna tarjeta se deja como está.
 *
 * @param {Object} state Estado del módulo lead.
 * @returns {Array<string>|null} null = sin filtro de estado.
 */
function chats_status_slugs_expandidos(state) {
  const valores = chats_status_slugs(state.chats_filtros)
  if (!valores) {
    return null
  }
  const cards = state.status_cards || []
  const expandidos = []
  valores.forEach(function (valor) {
    let card = null
    cards.forEach(function (c) {
      if (c && String(c.value) === valor && Array.isArray(c.slugs) && c.slugs.length) {
        card = c
      }
    })
    if (card) {
      card.slugs.forEach(function (s) { expandidos.push(String(s)) })
    } else {
      expandidos.push(valor)
    }
  })
  return expandidos
}

/**
 * true si la fila corresponde a los filtros de estado y de atención que hay puestos. El texto
 * buscado (`q`) no se evalúa acá: no se puede reproducir del lado del cliente qué devolvería
 * `LIKE %q%` sobre tres columnas, así que con `q` cargado una fila nueva no se inserta (ver
 * `upsert_chat_row`) y una existente no se saca por ese motivo.
 *
 * @param {Object} state Estado del módulo lead (filtros y tarjetas, para expandir los grupos).
 * @param {Object} row
 * @returns {boolean}
 */
function chat_row_matches_filtros(state, row) {
  if (!row) {
    return false
  }
  const slugs = chats_status_slugs_expandidos(state)
  if (slugs && slugs.indexOf(String(row.status)) === -1) {
    return false
  }
  const filtros = state.chats_filtros
  if (filtros && filtros.solo_atencion && !row.atencion) {
    return false
  }
  /* «Solo sin responder» (22/10/2026): al marcar un chat como leído la fila deja de contar y tiene
     que salir de la lista en el acto, igual que baja el número del botón. */
  if (filtros && filtros.solo_sin_responder && !fila_cuenta_sin_responder(row)) {
    return false
  }
  return true
}

/**
 * Secuencia de los GET /lead/chats que salieron. Cuando el operador tipea rápido en el buscador
 * pueden quedar dos en vuelo, y gana el que llegó último, no el que VOLVIÓ último: una respuesta
 * vieja que llegue después pisaría la lista con los resultados de la búsqueda anterior.
 */
let chats_request_seq = 0

export default __base_store({
  state: {
    model_name: 'lead',
    use_per_page: true,
    /* 25 por página, con paginador debajo de la grilla. Antes era 500, que además era ficción:
       index_json clampea per_page a 200. */
    per_page: 25,
    /* Pisa el 100 del base store para que la búsqueda filtrada pagine igual que el listado base
       (se puede pisar porque base_state() hace Object.assign({}, base, extra)). */
    filter_per_page: 25,
    /** Lead abierto en la pestaña de conversación (para refrescar listas coherentes). */
    lead_en_conversacion: null,
    /**
     * Id del lead cuya conversación WhatsApp está visible ahora (modal pestaña o vista fullscreen).
     * null si el operador no está mirando el hilo de ese lead.
     */
    lead_conversation_visible_id: null,
    /** Indica llamada en curso a Claude al agregar mensaje del lead. */
    loading_ai: false,
    /** Id del lead cuya sugerencia IA se está generando (automática o manual). */
    ai_generating_lead_id: null,
    /** Último error de IA (mensaje legible para la UI). */
    ai_error: null,
    /** Total global de mensajes del lead sin leer (badge menú Leads). */
    unread_total: 0,
    /**
     * Mensajes sin leer por slug de estado del lead (badges barra de navegación de Leads).
     * @type {Record<string, number>}
     */
    unread_by_status: {},
    /**
     * Tarjetas de estado arriba de la grilla (GET /lead/status-cards).
     * @type {Array<{ value: string, text: string, color: string, group: string|null, total: number, sin_responder: number }>}
     */
    status_cards: [],
    /** true mientras el GET de tarjetas de estado está en vuelo. */
    loading_status_cards: false,
    /** Id de lead con GET conversación en curso (evita duplicados). */
    _conversation_fetch_in_flight: null,
    /** Id del lead cuyo mark-whatsapp-messages-read está en vuelo (null si ninguno). */
    _mark_read_in_flight: null,
    /**
     * Criterio de ordenamiento activo: 'last_message' | 'created_at' | 'atencion'.
     * Por defecto último mensaje. 'atencion' prioriza leads que necesitan que alguien
     * haga algo (mensajes por confirmar o con error de envío) por encima de los fijados.
     */
    sort_by: 'last_message',
    /** Posición vertical de scroll guardada al salir hacia la conversación WhatsApp (restaurar al volver). */
    scroll_y: 0,
    /**
     * Versión de recarga manual desde el menú lateral cuando Leads usa keep-alive.
     * Se incrementa al hacer clic en "Leads" estando ya en esa vista, para que
     * el hook activated() detecte que debe recargar la lista y resetear filtros.
     */
    leads_reload_version: 0,
    /**
     * Deep link "solo sin responder" (misión inicio-y-entrada-por-rol, 13/10/2026): acota el
     * listado base a los leads que requieren revisión, que es lo que cuenta la tarjeta de inicio.
     * Aplica SOLO al listado base (`_get_models`), no a la búsqueda filtrada.
     */
    solo_sin_responder: false,
    /**
     * Lista de chats estilo WhatsApp (misión flujo-lead-landing-closer, 17/10/2026). Filas tal
     * cual las devuelve GET /lead/chats (plan §4.1): el texto del último mensaje, el semáforo
     * `atencion` y el badge del estado ya vienen resueltos del servidor. Reemplaza a la grilla de
     * `models`/`filtered` en la vista de Leads; esos dos siguen existiendo porque los usan la
     * conversación, el closer y el modal.
     * @type {Array<Object>}
     */
    chats: [],
    /** Paginación de GET /lead/chats. `per_page` es lo que se pide; el servidor clampea a 200. */
    chats_meta: { current_page: 1, last_page: 1, per_page: 50, total: 0 },
    /**
     * Filtros vivos de la lista: texto del buscador, estado (slug, o slugs separados por coma
     * para las tarjetas agrupadas) y "solo atención" (rojo o amarillo).
     */
    chats_filtros: { q: '', status: null, solo_atencion: false, solo_sin_responder: false },
    /** true mientras hay un GET /lead/chats en vuelo (primera página o "cargar más"). */
    loading_chats: false,
    /**
     * null | 'api_vieja' | 'error'. `api_vieja` es el 404 de un admin-api que todavía no tiene
     * la ruta: el SPA y la API no llegan juntos a producción y la lista tiene que decirlo sin
     * romper el resto de la vista.
     */
    chats_error: null,
  },
  mutations: {
    /**
     * @param {Object} state
     * @param {number|null} lead_id
     */
    set_conversation_fetch_in_flight(state, lead_id) {
      state._conversation_fetch_in_flight = lead_id
    },
    /**
     * Registra qué lead tiene un POST mark-whatsapp-messages-read en curso (evita llamadas paralelas).
     *
     * @param {Object} state
     * @param {number|string|null} lead_id
     */
    set_mark_read_in_flight(state, lead_id) {
      state._mark_read_in_flight = lead_id != null ? String(lead_id) : null
    },
    /**
     * @param {Object} state
     * @param {Object|null} value modelo lead o null
     */
    set_lead_en_conversacion(state, value) {
      state.lead_en_conversacion = value ? apply_viewing_unread_override(state, value) : value
    },
    /**
     * Registra qué lead tiene la conversación WhatsApp visible (para suprimir badges de no leídos).
     *
     * @param {Object} state
     * @param {number|string|null} lead_id
     */
    set_lead_conversation_visible_id(state, lead_id) {
      if (lead_id == null || lead_id === '') {
        state.lead_conversation_visible_id = null
        return
      }
      state.lead_conversation_visible_id = lead_id
    },
    /**
     * @param {Object} state
     * @param {boolean} value
     */
    set_loading_ai(state, value) {
      state.loading_ai = Boolean(value)
    },
    /**
     * @param {Object} state
     * @param {number|string|null} lead_id
     */
    set_ai_generating_lead_id(state, lead_id) {
      if (lead_id == null || lead_id === '') {
        state.ai_generating_lead_id = null
        return
      }
      state.ai_generating_lead_id = lead_id
    },
    /**
     * @param {Object} state
     * @param {string|null} value
     */
    set_ai_error(state, value) {
      state.ai_error = value
    },
    /**
     * Fusiona el lead en conversación si coincide el id (tras POST mensaje / aprobar / rechazar).
     * @param {Object} state
     * @param {Object} model lead devuelto por la API
     */
    update_lead_en_conversacion(state, model) {
      if (!model || !model.id) {
        return
      }
      const normalized = apply_viewing_unread_override(state, model)
      if (state.lead_en_conversacion && state.lead_en_conversacion.id == normalized.id) {
        /** Mensajes previos del hilo completo en la pestaña Conversación. */
        const previous_messages = state.lead_en_conversacion.messages
        state.lead_en_conversacion = Object.assign({}, state.lead_en_conversacion, normalized)
        if (normalized.messages_scope === 'full' && normalized.messages && normalized.messages.length) {
          state.lead_en_conversacion.messages = normalized.messages
        } else {
          state.lead_en_conversacion.messages = merge_conversation_messages(
            previous_messages,
            normalized.messages
          )
        }
      }
    },
    /**
     * @param {Object} state
     * @param {number} value
     */
    set_unread_total(state, value) {
      const n = parseInt(value, 10)
      state.unread_total = isNaN(n) ? 0 : n
    },
    /**
     * Totales de mensajes sin leer agrupados por estado del lead (slug => cantidad).
     *
     * @param {Object} state
     * @param {Record<string, number>|null|undefined} value
     */
    set_unread_by_status(state, value) {
      if (!value || typeof value !== 'object') {
        state.unread_by_status = {}
        return
      }
      state.unread_by_status = value
    },
    /**
     * Tarjetas de estado tal cual las devuelve GET /lead/status-cards. El SPA no las ordena
     * ni las inventa: si el payload no es un array, se guarda vacío.
     *
     * @param {Object} state
     * @param {Array|null|undefined} value
     */
    set_status_cards(state, value) {
      state.status_cards = Array.isArray(value) ? value : []
    },
    /**
     * @param {Object} state
     * @param {boolean} value
     */
    set_loading_status_cards(state, value) {
      state.loading_status_cards = Boolean(value)
    },
    /**
     * @param {Object} state
     * @param {'last_message'|'created_at'|'atencion'} value
     */
    set_sort_by(state, value) {
      /** Lista de criterios de orden aceptados por el backend. */
      var valid_sort_by_values = ['last_message', 'created_at', 'atencion']
      state.sort_by = valid_sort_by_values.indexOf(value) !== -1 ? value : 'last_message'
    },
    /**
     * Prende o apaga el acotado a "solo sin responder" del listado base.
     *
     * @param {Object} state
     * @param {boolean} value
     */
    set_solo_sin_responder(state, value) {
      state.solo_sin_responder = Boolean(value)
    },
    /**
     * Guarda o limpia la posición de scroll de la bandeja de leads.
     *
     * @param {Object} state
     * @param {number} value píxeles desde el tope de la ventana (0 para limpiar)
     */
    set_scroll_y(state, value) {
      state.scroll_y = value || 0
    },
    /**
     * Reemplaza la lista de chats (primera página de una carga nueva).
     *
     * @param {Object} state
     * @param {Array<Object>} rows
     */
    set_chats(state, rows) {
      state.chats = Array.isArray(rows) ? rows : []
    },
    /**
     * Agrega una página más al final ("Cargar más"), sin duplicar una fila que ya esté: entre
     * una página y la siguiente la lista pudo moverse (un lead que subió al tope aparece de
     * nuevo en la página 2).
     *
     * @param {Object} state
     * @param {Array<Object>} rows
     */
    append_chats(state, rows) {
      const ids = {}
      state.chats.forEach(function (r) { ids[r.id] = true })
      const nuevas = (rows || []).filter(function (r) { return r && !ids[r.id] })
      state.chats = state.chats.concat(nuevas)
    },
    /**
     * @param {Object} state
     * @param {{ current_page: number, last_page: number, per_page: number, total: number }} meta
     */
    set_chats_meta(state, meta) {
      state.chats_meta = Object.assign({}, state.chats_meta, meta || {})
    },
    /**
     * Pisa solo las claves que vienen; lo demás queda como estaba.
     *
     * @param {Object} state
     * @param {{ q?: string, status?: string|Array|null, solo_atencion?: boolean }} filtros
     */
    set_chats_filtros(state, filtros) {
      state.chats_filtros = Object.assign({}, state.chats_filtros, filtros || {})
    },
    /**
     * @param {Object} state
     * @param {boolean} value
     */
    set_loading_chats(state, value) {
      state.loading_chats = Boolean(value)
    },
    /**
     * @param {Object} state
     * @param {null|'api_vieja'|'error'} value
     */
    set_chats_error(state, value) {
      state.chats_error = value || null
    },
    /**
     * Actualiza una fila de chat en el lugar y reordena con el criterio del servidor. Si la fila
     * no estaba, entra solo cuando corresponde a los filtros puestos y no hay texto buscado (ver
     * `chat_row_matches_filtros`); si estaba y dejó de corresponder, sale. Al entrar o salir se
     * ajusta `chats_meta.total` (+1 / −1) para que «N chats» y el «(X de Y)» de «Cargar más» no
     * queden desfasados hasta la próxima carga; es una cuenta local que el próximo GET corrige.
     *
     * @param {Object} state
     * @param {Object} row Fila de GET /lead/chats/{id}.
     */
    upsert_chat_row(state, row) {
      if (!row || row.id == null) {
        return
      }
      const idx = state.chats.findIndex(function (r) { return String(r.id) === String(row.id) })
      const matchea = chat_row_matches_filtros(state, row)
      const lista = state.chats.slice()
      const total = parseInt(state.chats_meta.total, 10) || 0
      if (idx !== -1) {
        if (!matchea) {
          lista.splice(idx, 1)
          state.chats = lista
          state.chats_meta = Object.assign({}, state.chats_meta, { total: Math.max(0, total - 1) })
          return
        }
        lista.splice(idx, 1, Object.assign({}, lista[idx], row))
        state.chats = ordenar_chats(lista)
        return
      }
      if (!matchea || (state.chats_filtros.q || '').trim() !== '') {
        return
      }
      lista.push(row)
      state.chats = ordenar_chats(lista)
      state.chats_meta = Object.assign({}, state.chats_meta, { total: total + 1 })
    },
    /**
     * Incrementa la versión de recarga de leads para que el hook activated() de Leads.vue
     * detecte que el usuario clickeó Leads en el menú mientras ya estaba en esa vista.
     * Con keep-alive, el componente no se destruye ni remonta, por lo que este contador
     * reemplaza el mecanismo de key que usa el resto de las vistas.
     *
     * @param {Object} state
     */
    bump_leads_reload_version(state) {
      state.leads_reload_version = (state.leads_reload_version || 0) + 1
    },
    /**
     * Agrega un mensaje al hilo abierto si no existe (evento Pusher).
     *
     * @param {Object} state
     * @param {{ lead_id: number, message: Object }} payload
     */
    append_message_to_open_conversation(state, payload) {
      if (!payload || !payload.message || !payload.lead_id) {
        return
      }
      const conv = state.lead_en_conversacion
      if (!conv || conv.id != payload.lead_id) {
        return
      }
      const messages = conv.messages ? conv.messages.slice() : []
      let exists = false
      let i = 0
      for (i = 0; i < messages.length; i = i + 1) {
        if (messages[i].id == payload.message.id) {
          exists = true
          const previous = messages[i]
          const incoming = payload.message
          const merged = Object.assign({}, previous, incoming)
          if (
            previous.attachments &&
            previous.attachments.length &&
            (!incoming.attachments || !incoming.attachments.length)
          ) {
            merged.attachments = previous.attachments
          }
          messages[i] = merged
          break
        }
      }
      if (!exists) {
        messages.push(payload.message)
        messages.sort(function (a, b) {
          return (a.id || 0) - (b.id || 0)
        })
      }
      state.lead_en_conversacion = Object.assign({}, conv, { messages: messages })
    },
  },
  actions: {
    /**
     * Listado paginado incluyendo criterio sort_by para la bandeja de leads.
     *
     * @param {Object} context
     * @returns {Promise<void>}
     */
    _get_models(context) {
      const commit = context.commit
      const state = context.state
      commit('set_loading', true)
      const path = '/lead'
      let q = state.use_per_page
        ? '?page=' + state.page + '&per_page=' + state.per_page + '&sort_by=' + state.sort_by
        : '?sort_by=' + state.sort_by
      /* Deep link "solo sin responder" desde el panel de inicio. Va solo acá y NO en
         `run_filter`: ese camino pasa por el SearchController común, que es otra ruta y otro
         contrato. Una API vieja ignora el parámetro y devuelve el listado sin acotar — de más,
         no de menos. */
      if (state.solo_sin_responder) {
        q = q + '&sin_responder=1'
      }
      return api
        .get(path + q)
        .then(function (res) {
          const body = res.data
          const pack = body.models
          if (pack && pack.data) {
            commit('set_models', pack.data)
            commit('set_total_pages', pack.last_page || 1)
            commit('set_total_results', pack.total != null ? pack.total : pack.data.length)
          } else {
            commit('set_models', pack || [])
            commit('set_total_results', (pack && pack.length) || 0)
          }
          commit('set_loading', false)
        })
        .catch(function () {
          commit('set_loading', false)
        })
    },
    /**
     * Cambia el criterio de orden y recarga el listado base (sin filtros de columna).
     *
     * @param {Object} context
     * @param {'last_message'|'created_at'|'atencion'} sort_by
     * @returns {Promise<void>}
     */
    change_sort_by(context, sort_by) {
      context.commit('set_sort_by', sort_by)
      /** Si hay filtros activos, recargar búsqueda con el nuevo orden. */
      if (context.state.is_filtered) {
        /* 🔴 El set_filter_page(1) va SÍ o SÍ antes del run_filter: el orden nuevo devuelve la
           primera página, y sin esto `filter_page` queda en la que estaba. Antes del paginador
           no se notaba; ahora dejaría el control marcando la página 3 sobre las filas 1 a 25.
           Es el mismo reseteo que ya hacen todos los demás caminos que cambian filtros. */
        context.commit('set_filter_page', 1)
        return context.dispatch('run_filter', { page: 1 })
      }
      return context.dispatch('get_models')
    },
    /**
     * Búsqueda filtrada de leads: incluye sort_by para respetar el orden de la bandeja.
     *
     * @param {Object} context
     * @param {Object} [payload]
     * @returns {Promise<void>}
     */
    run_filter(context, payload) {
      const commit = context.commit
      const state = context.state
      const page = payload && payload.page != null ? payload.page : state.filter_page
      const per = state.filter_per_page || 50
      const url =
        '/search/' + route_string(state.model_name) + '/null/1?page=' + page
      commit('set_loading_filtered', true)
      set_global_filter_loading(commit, true, 'Filtrando leads…')
      return api
        .post(url, {
          filters: state.filters,
          papelera: false,
          per_page: per,
          sort_by: state.sort_by,
        })
        .then(function (res) {
          const body = res.data
          const rows = body.data || []
          commit('set_is_filtered', true)
          commit('set_filtered', rows)
          commit('set_total_filter_pages', body.last_page || 1)
          commit('set_total_filter_results', body.total != null ? body.total : rows.length)
          commit('set_loading_filtered', false)
          set_global_filter_loading(commit, false)
        })
        .catch(function () {
          commit('set_loading_filtered', false)
          set_global_filter_loading(commit, false)
        })
    },
    /**
     * Fusiona fila en listados preservando `messages` si el payload de Pusher no los trae.
     *
     * Dos reglas además del merge:
     *
     * 1. **Página.** Una fila nueva sube al tope solo si el operador está parado en la página 1.
     *    Con 25 por página, meterle una fila al tope de la página 4 le mostraría un lead que no
     *    corresponde a ese tramo del listado.
     * 2. **Filtro de estado (solo en `state.filtered`).** Si hay un estado filtrado, un lead que
     *    no matchea no entra, y uno visible que dejó de matchear sale. 🔴 Esto NO se le aplica a
     *    `state.models`: ese es el listado base, sin filtrar — ResourceView solo lo muestra cuando
     *    `is_filtered` es false, así que filtrarlo lo rompería en silencio.
     *
     * 🔴 **Al insertar una fila NO se toca el total.** Es asimétrico a propósito y no es un
     * descuido. Que un lead no esté en el array visible no significa que sea nuevo: con 25 por
     * página, la enorme mayoría de los leads del servidor están fuera del tramo cargado, así que
     * un `+1` por cada mensaje de WhatsApp de un lead ya existente inflaría el total sin techo —
     * una mañana con la vista abierta y el paginador termina ofreciendo páginas que no existen y
     * que devuelven la grilla vacía. Como el listado no tiene forma de distinguir "lead nuevo" de
     * "lead que ya estaba pero no cargado", la única cuenta correcta es no tocar el total y dejar
     * que lo diga el servidor en el próximo fetch.
     *
     * En cambio al SACAR una fila sí se resta 1, porque ahí sí lo sabemos: la fila estaba visible
     * dentro del listado filtrado, o sea que el total del servidor la incluía, y dejó de
     * corresponder al filtro. Esa resta es una aproximación local (puede derivar si dos eventos
     * pisan al mismo lead) y se corrige sola en el próximo refetch: cambiar de página, de filtro,
     * de orden, o volver a la vista.
     *
     * @param {Object} context
     * @param {Object} model
     * @returns {void}
     */
    upsert_model_in_lists(context, model) {
      if (!model || !model.id) {
        return
      }
      const state = context.state
      const commit = context.commit
      const row_model = apply_viewing_unread_override(state, model)

      const merge_lead_row = function (existing, incoming) {
        const merged = Object.assign({}, existing || {}, incoming)
        if (incoming && incoming.messages && incoming.messages.length) {
          merged.messages = incoming.messages
        } else if (existing && existing.messages && existing.messages.length) {
          merged.messages = existing.messages
        }
        return merged
      }

      /* --- Listado base: sin filtro de estado, solo la regla de página. --- */
      const in_idx = state.models.findIndex(function (m) {
        return m.id == row_model.id
      })
      const arr = state.models.slice()
      if (in_idx !== -1) {
        arr.splice(in_idx, 1, merge_lead_row(arr[in_idx], row_model))
        commit('set_models', arr)
      } else if (state.page == 1) {
        const per_page = state.per_page || 25
        arr.unshift(row_model)
        if (arr.length > per_page) {
          arr.pop()
        }
        commit('set_models', arr)
      }

      /* --- Listado filtrado: acá sí manda el filtro de estado activo. --- */
      if (state.is_filtered) {
        const matchea = lead_matches_active_status(state, row_model)
        const filter_per_page = state.filter_per_page || 25
        const f_idx = state.filtered.findIndex(function (m) {
          return m.id == row_model.id
        })
        const filtered_arr = state.filtered.slice()

        if (f_idx !== -1 && matchea) {
          /* Está y sigue correspondiendo: se actualiza donde está, no sube al tope. */
          filtered_arr.splice(f_idx, 1, merge_lead_row(filtered_arr[f_idx], row_model))
          commit('set_filtered', filtered_arr)
        } else if (f_idx !== -1) {
          /* Está pero dejó de corresponder al estado filtrado: sale de la lista. */
          filtered_arr.splice(f_idx, 1)
          const total_menos = Math.max(0, (state.total_filter_results || 0) - 1)
          commit('set_filtered', filtered_arr)
          commit('set_selected', state.selected.filter(function (m) {
            return m.id != row_model.id
          }))
          commit('set_total_filter_results', total_menos)
          commit('set_total_filter_pages', total_pages_for(total_menos, filter_per_page))
        } else if (matchea && state.filter_page == 1) {
          /* No está, corresponde, y el operador ve la primera página: entra al tope. */
          filtered_arr.unshift(row_model)
          if (filtered_arr.length > filter_per_page) {
            filtered_arr.pop()
          }
          commit('set_filtered', filtered_arr)
        }
        /* No está y no corresponde al estado filtrado: no se hace nada (requisito 4). */
      }
    },
    /**
     * Ejecuta envío de mail de presentación para un lead.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    send_presentation_mail(context, lead_id) {
      return api.post('/lead/' + lead_id + '/send-presentation-mail').then((res) => {
        return res.data.model
      })
    },
    /**
     * Ejecuta envío de mail de seguimiento para un lead.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    send_followup_mail(context, lead_id) {
      return api.post('/lead/' + lead_id + '/send-followup-mail').then((res) => {
        return res.data.model
      })
    },
    /**
     * Dispara el setup de demo en el sistema destino.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    run_demo_setup(context, lead_id) {
      return api.post('/lead/' + lead_id + '/run-demo-setup').then((res) => {
        return res.data.model
      })
    },
    /**
     * Guarda las nueve respuestas del formulario de configuración de la demo editadas a mano
     * desde el modal del lead (misión del 27/8/2026). El backend marca
     * `demo_form_editado_admin_at`, que es lo que hace que el demo setup use estas respuestas y
     * no los defaults del catálogo, y devuelve el lead completo ya actualizado.
     *
     * PUT y no POST: es una actualización idempotente del mismo recurso.
     *
     * @param {Object} context contexto del módulo Vuex.
     * @param {{ lead_id: number, respuestas: Object }} payload id del lead y las nueve respuestas.
     * @returns {Promise<Object>} modelo de lead actualizado devuelto por el backend.
     */
    update_demo_form(context, payload) {
      return api.put('/lead/' + payload.lead_id + '/demo-form', payload.respuestas).then((res) => {
        return res.data.model
      })
    },
    /**
     * Promueve un lead a cliente de producción.
     * @param {Object} context contexto del módulo Vuex.
     * @param {{ lead_id: number, api_url: string }} payload datos de promoción.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    promote_lead(context, payload) {
      return api.post('/lead/' + payload.lead_id + '/promote', { api_url: payload.api_url }).then((res) => {
        return res.data.model
      })
    },
    /**
     * Solicita a la API un subdominio sugerido para el nombre de empresa dado.
     * Llama a POST /client/suggest-subdomain y retorna el string sugerido.
     *
     * @param {Object} context contexto del módulo Vuex.
     * @param {string} company_name nombre de empresa del lead.
     * @returns {Promise<string>} subdominio sugerido por Claude.
     */
    suggest_subdomain(context, company_name) {
      return api.post('/client/suggest-subdomain', { company_name }).then(function (res) {
        return res.data.subdomain || ''
      })
    },
    /**
     * Promueve el lead a Client de producción en admin-api y genera las tareas automáticas.
     * Acepta { lead_id, suggested_subdomain } o solo un número (backward compat).
     * No ejecuta el setup remoto del empresa-api; ese paso continúa siendo `run_user_setup`.
     *
     * @param {Object} context contexto del módulo Vuex.
     * @param {{ lead_id: number, suggested_subdomain?: string }|number} payload identificador del lead con subdominio opcional.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    promote_to_client(context, payload) {
      /* Soporte para payload como número (backward compat) y como objeto con subdomain. */
      var lead_id            = typeof payload === 'object' ? payload.lead_id : payload
      var suggested_subdomain = typeof payload === 'object' ? (payload.suggested_subdomain || '') : ''
      return api.post('/lead/' + lead_id + '/promote-to-client', { suggested_subdomain }).then(function (res) {
        return res.data.model
      })
    },

    /**
     * Dispara el setup del sistema real para un lead promovido.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    run_user_setup(context, lead_id) {
      return api.post('/lead/' + lead_id + '/run-user-setup').then((res) => {
        return res.data.model
      })
    },
    /**
     * Envía el "Mail 1 - DEMO" al prospecto con sus credenciales y horario de demo.
     * El backend valida que todos los campos obligatorios estén completos.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    send_demo_mail(context, lead_id) {
      return api.post('/lead/' + lead_id + '/send-demo-mail').then((res) => {
        return res.data.model
      })
    },
    /**
     * Envía el recordatorio pre-demo manualmente sin esperar el scheduler automático.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    send_demo_reminder(context, lead_id) {
      return api.post('/lead/' + lead_id + '/send-demo-reminder').then(function (res) {
        return res.data.model
      })
    },
    /**
     * Genera el check de ingreso a la demo manualmente sin esperar el scheduler automático.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    check_demo_ingress(context, lead_id) {
      return api.post('/lead/' + lead_id + '/check-demo-ingress').then(function (res) {
        return res.data.model
      })
    },
    /**
     * Genera el check de fin de demo manualmente sin esperar el scheduler automático.
     * Crea un mensaje sugerido preguntando si el lead pudo terminar la demo.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    check_demo_fin(context, lead_id) {
      return api.post('/lead/' + lead_id + '/check-demo-fin').then(function (res) {
        return res.data.model
      })
    },
    /**
     * Reemite el token de ingreso directo a la demo del lead (grupo 233, prompt 05/06).
     * Invalida el token anterior y genera uno nuevo; el backend devuelve el lead ya
     * actualizado con el nuevo `demo_ingreso_token` y su nueva expiración.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo de lead actualizado devuelto por el backend.
     */
    reemitir_demo_token(context, lead_id) {
      const commit = context.commit
      return api.post('/lead/' + lead_id + '/demo-token/reemitir').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        context.dispatch('upsert_model_in_lists', model)
        return model
      })
    },
    /**
     * Revoca el token de ingreso directo a la demo del lead (grupo 233, prompt 05/06).
     * Corta el acceso de inmediato, incluso si el lead está en ese momento dentro de la demo.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo de lead actualizado devuelto por el backend.
     */
    revocar_demo_token(context, lead_id) {
      const commit = context.commit
      return api.post('/lead/' + lead_id + '/demo-token/revocar').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        context.dispatch('upsert_model_in_lists', model)
        return model
      })
    },
    /**
     * Cambia la dinámica de demo asignada a este lead puntual ('actual' | 'nueva'), grupo 293
     * prompt 04. Distinto del setting global `experiencia_default` (que solo afecta a leads
     * nuevos): esta acción es la que permite pilotear la dinámica nueva con leads elegidos a
     * mano. El backend devuelve el lead ya actualizado y deja el mensaje de sistema en el hilo.
     * @param {Object} context contexto del módulo Vuex.
     * @param {{ lead_id: number, demo_experiencia: string }} payload id del lead y dinámica elegida.
     * @returns {Promise<Object>} modelo de lead actualizado devuelto por el backend.
     */
    set_demo_experiencia(context, payload) {
      const commit = context.commit
      return api.post('/lead/' + payload.lead_id + '/demo-experiencia', {
        demo_experiencia: payload.demo_experiencia,
      }).then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        context.dispatch('upsert_model_in_lists', model)
        return model
      })
    },
    /**
     * Fuerza la creación del evento de calendario del closer (con Meet) manualmente,
     * sin duplicar si ya existe. Usada por las etapas 12 y 13 del pipeline (mismo backend,
     * dos botones/checks visuales distintos: evento creado y link de Meet seteado).
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    force_calendar_event(context, lead_id) {
      return api.post('/lead/' + lead_id + '/force-calendar-event').then((res) => {
        return res.data.model
      })
    },
    /**
     * Fuerza el seguimiento que corresponde al lead ahora mismo (testing manual),
     * sin esperar horas_espera ni estar bloqueado por sugerencia pendiente.
     *
     * @param {Object} context
     * @param {number} lead_id
     * @returns {Promise<{model: Object, outcome: Object}>}
     */
    force_followup(context, lead_id) {
      const commit = context.commit
      return api.post('/lead/' + lead_id + '/force-followup').then(function (res) {
        commit('update_lead_en_conversacion', res.data.model)
        return res.data
      })
    },
    /**
     * Genera el resumen del lead con Claude manualmente sin esperar el scheduler automático.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    generate_demo_summary(context, lead_id) {
      return api.post('/lead/' + lead_id + '/generate-demo-summary').then(function (res) {
        return res.data.model
      })
    },
    /**
     * Marca que el closer realizó la llamada post-demo al lead.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    mark_closer_called(context, lead_id) {
      return api.post('/lead/' + lead_id + '/mark-closer-called').then(function (res) {
        return res.data.model
      })
    },
    /**
     * Actualiza uno o más flags de automatización del ciclo de demo del lead: el switch
     * maestro (`automatizaciones_demo_activas`) y los toggles por operación (recordatorio,
     * check de ingreso, check de fin, resumen del closer). El endpoint acepta cambios
     * parciales; cualquier flag ausente del payload conserva su valor actual en backend.
     * @param {Object} context contexto del módulo Vuex.
     * @param {{ lead_id: number, changes: Object }} payload id del lead y flags a actualizar (clave: nombre del flag, valor: boolean).
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    update_lead_automations(context, payload) {
      return api.patch('/lead/' + payload.lead_id + '/automations', payload.changes).then(function (res) {
        return res.data.model
      })
    },
    /**
     * Envía un mensaje directo al lead por WhatsApp sin pasar por Claude.
     *
     * @param {Object} context
     * @param {{ lead_id: number, content: string }} payload
     * @returns {Promise<Object>} modelo lead actualizado
     */
    send_direct_message(context, payload) {
      const commit = context.commit
      return api
        .post('/lead/' + payload.lead_id + '/send-direct-message', { content: payload.content })
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Envía manualmente una plantilla Meta al lead (útil cuando la ventana de 24hs está cerrada).
     *
     * @param {Object} context
     * @param {{ lead_id: number, template_name: string, language_code: string, variables: string[], content: string }} payload
     * @returns {Promise<Object>} modelo lead actualizado
     */
    send_template(context, payload) {
      /* Extraer commit del contexto para actualizar el estado local tras el envío. */
      const commit = context.commit
      return api
        .post('/lead/' + payload.lead_id + '/send-template', {
          template_name:  payload.template_name,
          language_code:  payload.language_code,
          variables:      payload.variables,
          content:        payload.content,
        })
        .then((res) => {
          /* Actualizar el lead en conversación con el modelo devuelto por el backend. */
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Programa el envío de un mensaje de WhatsApp al lead para una fecha futura.
     * El backend responde con el lead completo, así que se commitea igual que
     * `send_template` / `send_direct_message` y la conversación se refresca sola.
     *
     * @param {Object} context
     * @param {{ lead_id: number, scheduled_send_at: string, mode: string, content: string, template_name?: string, template_language?: string, template_variables?: string[], cancel_if_lead_replies: boolean }} payload
     * @returns {Promise<Object>} modelo lead actualizado
     */
    schedule_message(context, payload) {
      const commit = context.commit
      return api
        .post('/lead/' + payload.lead_id + '/scheduled-messages', build_scheduled_message_body(payload))
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Edita un mensaje programado que todavía no salió (texto, plantilla, fecha o el check
     * de cancelación). Mismo cuerpo que `schedule_message`.
     *
     * @param {Object} context
     * @param {{ lead_id: number, scheduled_id: number, scheduled_send_at: string, mode: string, content: string, template_name?: string, template_language?: string, template_variables?: string[], cancel_if_lead_replies: boolean }} payload
     * @returns {Promise<Object>} modelo lead actualizado
     */
    update_scheduled_message(context, payload) {
      const commit = context.commit
      return api
        .put(
          '/lead/' + payload.lead_id + '/scheduled-messages/' + payload.scheduled_id,
          build_scheduled_message_body(payload)
        )
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Cancela un mensaje programado antes de que salga. El lead que vuelve ya no lo trae
     * en `scheduled_messages`, así que la burbuja desaparece sola de la conversación.
     *
     * @param {Object} context
     * @param {{ lead_id: number, scheduled_id: number }} payload
     * @returns {Promise<Object>} modelo lead actualizado
     */
    cancel_scheduled_message(context, payload) {
      const commit = context.commit
      return api
        .delete('/lead/' + payload.lead_id + '/scheduled-messages/' + payload.scheduled_id)
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Simula un mensaje entrante del lead (testing) sin pasar por WhatsApp.
     * Dispara en el backend el mismo flujo que el webhook real (sugerencia IA con debounce).
     *
     * @param {Object} context
     * @param {{ lead_id: number, content: string }} payload
     * @returns {Promise<Object>} modelo lead actualizado
     */
    simulate_inbound_message(context, payload) {
      const commit = context.commit
      return api
        .post('/lead/' + payload.lead_id + '/simulate-inbound', { content: payload.content })
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Pide sugerencia a Claude sin esperar el debounce automático (mensajes del lead ya cargados en el hilo).
     *
     * @param {Object} context
     * @param {number} lead_id
     * @returns {Promise<Object>} modelo lead actualizado
     */
    request_ai_suggestion(context, lead_id) {
      const commit = context.commit
      commit('set_ai_generating_lead_id', lead_id)
      commit('set_ai_error', null)
      return api
        .post('/lead/' + lead_id + '/request-ai-suggestion')
        .then((res) => {
          const model = res.data.model
          commit('set_ai_generating_lead_id', null)
          commit('update_lead_en_conversacion', model)
          context.dispatch('upsert_model_in_lists', model)
          return model
        })
        .catch((err) => {
          commit('set_ai_generating_lead_id', null)
          const msg =
            err && err.response && err.response.data && err.response.data.message
              ? String(err.response.data.message)
              : 'Error al generar sugerencia'
          commit('set_ai_error', msg)
          return Promise.reject(err)
        })
    },
    /**
     * Botón "Ofrecer/agendar demo" del sidebar: fuerza la intención del turno hacia la demo
     * (ver LeadController::offer_demo_json). Comparte el mismo lock de IA en curso
     * (ai_generating_lead_id) que request_ai_suggestion, a propósito: las dos operaciones piden
     * a Claude que genere un mensaje para el mismo lead y no tiene sentido correrlas en paralelo.
     *
     * A diferencia de request_ai_suggestion, devuelve el objeto completo de la respuesta (no solo
     * el modelo): habia_sugerencia_pendiente le indica al componente si tiene que avisar que había
     * una sugerencia sin aprobar antes de esta — el backend no bloquea por eso, solo informa.
     *
     * @param {Object} context
     * @param {number} lead_id
     * @returns {Promise<{model: Object, habia_sugerencia_pendiente: boolean}>}
     */
    offer_demo(context, lead_id) {
      const commit = context.commit
      commit('set_ai_generating_lead_id', lead_id)
      commit('set_ai_error', null)
      return api
        .post('/lead/' + lead_id + '/offer-demo')
        .then((res) => {
          const model = res.data.model
          commit('set_ai_generating_lead_id', null)
          commit('update_lead_en_conversacion', model)
          context.dispatch('upsert_model_in_lists', model)
          return {
            model: model,
            habia_sugerencia_pendiente: !!res.data.habia_sugerencia_pendiente,
          }
        })
        .catch((err) => {
          commit('set_ai_generating_lead_id', null)
          const msg =
            err && err.response && err.response.data && err.response.data.message
              ? String(err.response.data.message)
              : 'Error al ofrecer/agendar la demo'
          commit('set_ai_error', msg)
          return Promise.reject(err)
        })
    },
    /**
     * Cancela el debounce automático antes de pedir sugerencia IA a Claude.
     *
     * @param {Object} context
     * @param {number} lead_id
     * @returns {Promise<Object>} modelo lead actualizado
     */
    cancel_scheduled_ai_suggestion(context, lead_id) {
      const commit = context.commit
      return api.post('/lead/' + lead_id + '/cancel-scheduled-ai-suggestion').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        return model
      })
    },
    /**
     * Activa o desactiva la respuesta automática de Claude para el lead abierto en conversación.
     *
     * @param {Object} context
     * @param {number} lead_id id del lead
     * @returns {Promise<Object>} modelo lead actualizado
     */
    toggle_claude_auto_reply(context, lead_id) {
      const commit = context.commit
      return api.post('/lead/' + lead_id + '/toggle-claude-auto-reply').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        context.dispatch('upsert_model_in_lists', model)
        return model
      })
    },
    /**
     * Prende o apaga la verificación de mensajes del lead abierto. Cuando está activa, todo
     * mensaje que arme Claude para este lead queda esperando aprobación humana antes de salir.
     *
     * @param {Object} context
     * @param {number} lead_id id del lead
     * @returns {Promise<Object>} modelo lead actualizado
     */
    toggle_requiere_verificacion_mensajes(context, lead_id) {
      const commit = context.commit
      return api.post('/lead/' + lead_id + '/toggle-requiere-verificacion-mensajes').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        context.dispatch('upsert_model_in_lists', model)
        return model
      })
    },
    /**
     * Activa o desactiva el flag de intervención humana requerida para el lead abierto.
     *
     * @param {Object} context
     * @param {number} lead_id id del lead
     * @returns {Promise<Object>} modelo lead actualizado
     */
    toggle_requiere_intervencion_humana(context, lead_id) {
      const commit = context.commit
      return api.post('/lead/' + lead_id + '/toggle-requiere-intervencion-humana').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        context.dispatch('upsert_model_in_lists', model)
        return model
      })
    },
    /**
     * Envía por WhatsApp un mensaje sugerido por IA (sin editar).
     * @param {Object} context
     * @param {number} message_id id de lead_messages
     * @returns {Promise<Object>} modelo lead
     */
    approve_message(context, message_id) {
      const commit = context.commit
      return api.put('/lead-message/' + message_id + '/approve').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        return model
      })
    },
    /**
     * Envía por WhatsApp un mensaje sugerido guardando el texto editado por el setter.
     * @param {Object} context
     * @param {{ message_id: number, edited_content: string }} payload id y texto final
     * @returns {Promise<Object>} modelo lead
     */
    approve_message_with_edit(context, payload) {
      const commit = context.commit
      return api
        .put('/lead-message/' + payload.message_id + '/approve-with-edit', {
          edited_content: payload.edited_content,
        })
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Envía por WhatsApp un mensaje sugerido aplicando el paquete de acciones editado por el
     * admin en el panel de verificación (prompt 323): permite tocar estado sugerido, agendar/
     * cancelar demo, mails y campos de contacto antes de aprobar. Espeja approve_message_with_edit
     * pero pega contra el endpoint que acepta `final_actions` (prompt 320).
     * @param {Object} context
     * @param {{ message_id: number, edited_content?: string, final_actions?: Object }} payload
     * @returns {Promise<Object>} modelo lead
     */
    approve_message_with_actions(context, payload) {
      const commit = context.commit
      return api
        .put('/lead-message/' + payload.message_id + '/approve-with-actions', {
          edited_content: payload.edited_content || '',
          final_actions: payload.final_actions || {},
        })
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Trae demos disponibles y slots libres por fecha para armar el panel de agendamiento
     * (selector de demo/fecha/hora) del panel de verificación (prompt 321).
     * @param {Object} context
     * @param {number} lead_id id del lead
     * @returns {Promise<{demos: Array<{demo_id:number,label:string}>, slots: Object}>}
     */
    fetch_panel_availability(context, lead_id) {
      return api.get('/lead/' + lead_id + '/panel-availability').then((res) => {
        return {
          demos: (res.data && res.data.demos) || [],
          slots: (res.data && res.data.slots) || {},
        }
      })
    },
    /**
     * Alterna la marca "el lead ya no recibe mensajes" (numero bloqueado o dado de baja).
     *
     * Saca al lead del rojo de la grilla: ese color esta reservado para los errores de entrega
     * que se pueden reintentar. Es un toggle, porque un numero puede volver a andar.
     *
     * @param {Object} context
     * @param {number} lead_id id del lead
     * @returns {Promise<Object>} modelo lead actualizado
     */
    toggle_no_recibe_mensajes(context, lead_id) {
      const commit = context.commit
      return api.put('/lead/' + lead_id + '/toggle-no-recibe-mensajes').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        context.dispatch('upsert_model_in_lists', model)
        return model
      })
    },
    /**
     * Rechaza un mensaje sugerido por IA.
     * @param {Object} context
     * @param {number} message_id id de lead_messages
     * @returns {Promise<Object>} modelo lead
     */
    reject_message(context, message_id) {
      const commit = context.commit
      return api.put('/lead-message/' + message_id + '/reject').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        return model
      })
    },
    /**
     * Cancela el envío automático de una sugerencia y la marca como no enviada.
     *
     * @param {Object} context
     * @param {number} message_id id de lead_messages
     * @returns {Promise<Object>} modelo lead
     */
    cancel_auto_send_message(context, message_id) {
      const commit = context.commit
      return api.put('/lead-message/' + message_id + '/cancel-auto-send').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        return model
      })
    },
    /**
     * Alterna si el mensaje se incluye o excluye del historial enviado a Claude.
     * Los mensajes excluidos siguen siendo visibles en la UI pero no interfieren
     * con las sugerencias de la IA.
     *
     * @param {Object} context
     * @param {number} message_id id de lead_messages
     * @returns {Promise<Object>} modelo lead
     */
    toggle_message_deleted_from_context(context, message_id) {
      const commit = context.commit
      return api.put('/lead-message/' + message_id + '/toggle-deleted-from-context').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        return model
      })
    },
    /**
     * Reacciona con un emoji desde el panel sobre un mensaje del hilo, y la reacción
     * viaja al WhatsApp del lead. Un emoji vacío ('') es cómo se quita la reacción:
     * es el mismo endpoint, no hay una acción aparte para el quitado.
     *
     * Recibe un objeto y no dos argumentos porque una acción de Vuex toma un solo
     * payload (mismo criterio que approve_message_with_edit).
     *
     * @param {Object} context
     * @param {Object} payload { message_id: number, emoji: string }
     * @returns {Promise<Object>} modelo lead
     */
    react_to_message(context, payload) {
      const commit = context.commit
      return api
        .put('/lead-message/' + payload.message_id + '/reaction', { emoji: payload.emoji })
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Marca como vista la alerta de seguimiento automático en la tabla de leads.
     * @param {Object} context
     * @param {number} lead_id id del lead
     * @returns {Promise<Object>} modelo lead actualizado
     */
    mark_followup_suggestion_seen(context, lead_id) {
      const commit = context.commit
      return api.post('/lead/' + lead_id + '/mark-followup-suggestion-seen').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        // Refresca la fila en la tabla para que el badge amarillo de seguimiento desaparezca al instante.
        context.dispatch('upsert_model_in_lists', model)
        return model
      })
    },
    /**
     * GET totales de mensajes del lead sin leer (badge nav Leads).
     *
     * Este pide SIEMPRE, y con `force`: lo llaman el socket de leads y el `mark_..._read`, o sea
     * los dos que ya saben que el número acaba de cambiar. Engancharse a un GET en vuelo no
     * alcanzaría, porque ese GET pudo salir antes del evento y volver con el número viejo.
     *
     * @param {Object} context
     * @returns {Promise<number>}
     */
    fetch_unread_badges(context) {
      return pedir_unread_badges(context, true)
    },
    /**
     * Igual que `fetch_unread_badges`, pero se engancha al GET que ya esté en vuelo en vez de
     * abrir uno propio.
     *
     * Para qué: el Nav vive bajo un `v-if` en App.vue, así que se DESMONTA al entrar a la
     * conversación de un lead y al volver repite sus cuatro badges — justo cuando /leads también
     * pide el suyo. Los dos pedidos salen en el mismo tick y traen lo mismo.
     *
     * 🔴 Y ahí se termina la optimización: NO hay ventana de frescura. Mientras el Nav está
     * desmontado sus sockets están caídos, así que el GET del remonte es la única forma de
     * enterarse de lo que entró en el medio. Con una ventana de medio minuto, una ida y vuelta a
     * una conversación más rápida que eso dejaba el badge sin contar los mensajes nuevos, y sin
     * nadie que lo avisara después.
     *
     * @param {Object} context
     * @returns {Promise<number>}
     */
    ensure_unread_badges_fresh(context) {
      return pedir_unread_badges(context)
    },
    /**
     * GET /lead/status-cards: conteos globales por estado para las tarjetas de arriba de la grilla.
     *
     * Nunca rechaza. Si el GET falla se dejan en pantalla las tarjetas anteriores en vez de
     * vaciarlas: números viejos por unos segundos son mejores que una grilla que parpadea a cero
     * cada vez que se corta la red.
     *
     * @param {Object} context
     * @returns {Promise<Array>} tarjetas vigentes en el store
     */
    fetch_status_cards(context) {
      const commit = context.commit
      commit('set_loading_status_cards', true)
      return api
        .get('/lead/status-cards')
        .then(function (res) {
          if (res.data && Array.isArray(res.data.cards)) {
            commit('set_status_cards', res.data.cards)
          }
          commit('set_loading_status_cards', false)
          return context.state.status_cards
        })
        .catch(function () {
          commit('set_loading_status_cards', false)
          return context.state.status_cards
        })
    },
    /**
     * Marca leídos los mensajes entrantes del lead y refresca modelo.
     *
     * @param {Object} context
     * @param {number} lead_id
     * @returns {Promise<Object>}
     */
    mark_whatsapp_messages_read(context, lead_id) {
      const commit = context.commit
      const dispatch = context.dispatch
      const state = context.state

      // Evitar llamadas paralelas para el mismo lead (o cualquier lead si ya hay una en vuelo)
      if (state._mark_read_in_flight != null) {
        return Promise.resolve(state.lead_en_conversacion)
      }

      commit('set_mark_read_in_flight', lead_id)

      return api
        .post('/lead/' + lead_id + '/mark-whatsapp-messages-read')
        .then(function (res) {
          const model = res.data.model
          commit('set_mark_read_in_flight', null)
          commit('update_lead_en_conversacion', model)
          // Refresca la fila en la tabla con el unread_count actualizado.
          dispatch('upsert_model_in_lists', model)
          return dispatch('fetch_unread_badges').then(function () {
            return model
          })
        })
        .catch(function (err) {
          commit('set_mark_read_in_flight', null)
          return Promise.reject(err)
        })
    },
    /**
     * Lead completo con todos los mensajes (modal / conversación).
     *
     * @param {Object} context
     * @param {number|string} lead_id
     * @returns {Promise<Object>}
     */
    fetch_full_model(context, lead_id) {
      const commit = context.commit
      const state = context.state
      if (state._conversation_fetch_in_flight && state._conversation_fetch_in_flight == lead_id) {
        return Promise.resolve(state.lead_en_conversacion)
      }
      commit('set_conversation_fetch_in_flight', lead_id)
      return api
        .get('/lead/' + lead_id)
        .then(function (res) {
          /** Modelo con hilo completo y messages_scope = full. */
          const model = res.data && res.data.model ? res.data.model : null
          if (model) {
            commit('set_lead_en_conversacion', model)
          }
          commit('set_conversation_fetch_in_flight', null)
          return model
        })
        .catch(function (err) {
          commit('set_conversation_fetch_in_flight', null)
          return Promise.reject(err)
        })
    },
    /**
     * Carga lead completo con mensajes (conversación abierta tras evento sin message).
     *
     * @param {Object} context
     * @param {number|string} lead_id
     * @returns {Promise<Object>}
     */
    fetch_lead_for_conversation(context, lead_id) {
      return context.dispatch('fetch_full_model', lead_id)
    },
    /**
     * GET /lead/chats con los filtros vivos del store (plan §4.1, 17/10/2026).
     *
     * `page` 1 reemplaza la lista; con `append` la página se agrega al final ("Cargar más").
     * El 404 va silenciado en el interceptor (`silent_error_statuses`) y se traduce a
     * `chats_error = 'api_vieja'`: es el admin-api de antes de esta misión, no un error del
     * operador. Cualquier otro error sí avisa con el toast de siempre y deja `chats_error = 'error'`.
     *
     * Nunca rechaza: la vista decide qué mostrar mirando `chats_error`.
     *
     * @param {Object} context
     * @param {{ page?: number, append?: boolean }} [payload]
     * @returns {Promise<Array<Object>>} filas que llegaron (vacío si hubo error o la respuesta quedó vieja)
     */
    fetch_chats(context, payload) {
      const commit = context.commit
      const state = context.state
      const page = payload && payload.page ? payload.page : 1
      const append = Boolean(payload && payload.append)
      const filtros = state.chats_filtros || {}
      const params = { page: page, per_page: state.chats_meta.per_page || 50 }
      if ((filtros.q || '').trim() !== '') {
        params.q = filtros.q.trim()
      }
      const slugs = chats_status_slugs(filtros)
      if (slugs) {
        params.status = slugs.join(',')
      }
      if (filtros.solo_atencion) {
        params.solo_atencion = 1
      }
      if (filtros.solo_sin_responder) {
        params.sin_responder = 1
      }
      chats_request_seq = chats_request_seq + 1
      const mi_seq = chats_request_seq
      commit('set_loading_chats', true)
      return api
        .get('/lead/chats', { params: params, silent_error_statuses: [404] })
        .then(function (res) {
          if (mi_seq !== chats_request_seq) {
            return []
          }
          const body = res.data || {}
          let rows = Array.isArray(body.data) ? body.data : []
          const meta = body.meta || {}
          /* Con un admin-api anterior al 22/10/2026 el servidor ignora `sin_responder=1` y manda todos
             los chats: se descartan acá los que no cuentan (ver fila_cuenta_sin_responder). Con el
             servidor nuevo no descarta nada: ya vienen filtrados. */
          if (filtros.solo_sin_responder) {
            rows = rows.filter(fila_cuenta_sin_responder)
          }
          if (append) {
            commit('append_chats', rows)
          } else {
            commit('set_chats', rows)
          }
          commit('set_chats_meta', {
            current_page: meta.current_page != null ? meta.current_page : page,
            last_page: meta.last_page != null ? meta.last_page : page,
            per_page: meta.per_page != null ? meta.per_page : params.per_page,
            total: meta.total != null ? meta.total : rows.length,
          })
          commit('set_chats_error', null)
          commit('set_loading_chats', false)
          return rows
        })
        .catch(function (err) {
          if (mi_seq !== chats_request_seq) {
            return []
          }
          const status = err && err.response ? err.response.status : null
          commit('set_chats_error', status === 404 ? 'api_vieja' : 'error')
          commit('set_loading_chats', false)
          return []
        })
    },
    /**
     * GET /lead/chats/{id}: refresca UNA fila (Pusher, fijar, marcar leído, marcar respondido).
     * El 404 va en silencio: puede ser la API vieja o un lead que ya no existe, y en los dos casos
     * no hay nada que decirle al operador desde acá.
     *
     * @param {Object} context
     * @param {number|string} lead_id
     * @returns {Promise<Object|null>} la fila, o null si no se pudo
     */
    fetch_chat_row(context, lead_id) {
      if (lead_id == null || lead_id === '') {
        return Promise.resolve(null)
      }
      return api
        .get('/lead/chats/' + lead_id, { silent_error_statuses: [404] })
        .then(function (res) {
          const row = res.data && res.data.data ? res.data.data : null
          if (row && row.id != null) {
            context.commit('upsert_chat_row', row)
          }
          return row
        })
        .catch(function () {
          return null
        })
    },
    /**
     * POST /lead/{id}/marcar-respondido: "No necesita respuesta" (decisión D6, 17/10/2026). Marca
     * atendido hasta `message_id` (o hasta el último mensaje del lead si no viene) y con
     * `deshacer` limpia la marca. El servidor devuelve la fila de chat, no el lead: se vuelca a la
     * lista, y a la conversación abierta se le pasa solo `atendido_hasta_message_id` (sin
     * `messages`, así la mutación toma la rama de fusión y no toca el hilo).
     *
     * @param {Object} context
     * @param {{ lead_id: number, message_id?: number, deshacer?: boolean }} payload
     * @returns {Promise<Object>} fila de chat actualizada
     */
    marcar_respondido(context, payload) {
      const body = {}
      if (payload.message_id != null) {
        body.message_id = payload.message_id
      }
      if (payload.deshacer) {
        body.deshacer = true
      }
      return api.post('/lead/' + payload.lead_id + '/marcar-respondido', body).then(function (res) {
        const row = res.data && res.data.data ? res.data.data : null
        if (row && row.id != null) {
          context.commit('upsert_chat_row', row)
          context.commit('update_lead_en_conversacion', {
            id: row.id,
            atendido_hasta_message_id: row.atendido_hasta_message_id,
          })
        }
        /* Dejó de contar en "sin responder": la tarjeta de su estado baja uno. */
        context.dispatch('fetch_status_cards')
        return row
      })
    },
    /**
     * Fijar / desfijar desde el menú contextual de la lista. El endpoint devuelve el lead (forma
     * de GET /lead/{id}), que sirve para las listas viejas; la fila de chat se vuelve a pedir
     * porque tiene otra forma y la ordena el servidor.
     *
     * @param {Object} context
     * @param {number|string} lead_id
     * @returns {Promise<Object|null>}
     */
    toggle_chat_pinned(context, lead_id) {
      return api.post('/lead/' + lead_id + '/toggle-pinned').then(function (res) {
        if (res.data && res.data.model) {
          context.dispatch('upsert_model_in_lists', res.data.model)
        }
        return context.dispatch('fetch_chat_row', lead_id)
      })
    },
    /**
     * Marcar como no leído / leído a mano (marca per-admin, estilo WhatsApp) desde el menú
     * contextual de la lista. Mismo esquema que `toggle_chat_pinned`.
     *
     * @param {Object} context
     * @param {number|string} lead_id
     * @returns {Promise<Object|null>}
     */
    toggle_chat_manual_unread(context, lead_id) {
      return api.post('/lead/' + lead_id + '/toggle-manual-unread').then(function (res) {
        if (res.data && res.data.model) {
          context.dispatch('upsert_model_in_lists', res.data.model)
        }
        return context.dispatch('fetch_chat_row', lead_id)
      })
    },
  },
})
