import api from '@/utils/axios'
import { log_debug } from '@/utils/logger'

/**
 * Store del recurso DemoMedia: pantalla de multimedia editable de la demo
 * (grupo 300 · pagina-inmersiva-demo, prompt 06 -- contexto/demo_experiencia.md §3.18).
 *
 * No sigue el patrón __base_store (listado paginado + filtros CRUD): esta pantalla se arma con
 * un único GET que trae toda la vista de una (slots del catálogo sincronizado desde GitHub +
 * URLs ya cargadas en `demo_media`), y guarda cada URL con un PUT independiente por slot. Mismo
 * criterio de "recurso singular con acciones propias" que ya usa ai_system_prompt.js.
 */
const state = {
  /**
   * Slots del catálogo, normalizados por el backend (id, titulo, grupo, tipo, condicion, marco),
   * en el orden de exhibición que arma DemoCatalogoService::slots(). Nunca se reordena en el
   * front: el orden real (secciones -> videos sueltos -> scroll) viene resuelto del backend.
   */
  slots: [],
  /** Mapa slot_id -> url de las piezas que ya tienen multimedia cargada. */
  urls: {},
  /** true mientras está en curso la carga inicial (GET /demo-media). */
  loading: false,
  /** Mensaje de error de la carga inicial; vacío si no hubo error. */
  load_error: '',
}

const mutations = {
  set_slots(s, v) {
    s.slots = v || []
  },
  set_urls(s, v) {
    s.urls = v || {}
  },
  set_loading(s, v) {
    s.loading = v
  },
  set_load_error(s, v) {
    s.load_error = v || ''
  },
  /**
   * Actualiza el mapa de urls tras guardar un slot puntual: agrega/reemplaza la url si vino con
   * contenido, o la quita del mapa si vino vacía -- mismo criterio "vacío = sin cargar" que usa
   * el backend (DemoMediaController::update_json borra la fila cuando `url` es "").
   */
  set_slot_url(s, { slot_id, url }) {
    const next = { ...s.urls }
    if (url) {
      next[slot_id] = url
    } else {
      delete next[slot_id]
    }
    s.urls = next
  },
}

const actions = {
  /**
   * Carga slots + urls con un único GET /demo-media (pinta toda la pantalla de una).
   *
   * @param {{ commit: Function }} context
   * @returns {Promise<Object>} payload crudo `{ slots, urls }` devuelto por el backend.
   */
  load_media({ commit }) {
    commit('set_loading', true)
    commit('set_load_error', '')
    return api
      .get('/demo-media')
      .then((res) => {
        commit('set_slots', res.data.slots)
        commit('set_urls', res.data.urls)
        commit('set_loading', false)
        return res.data
      })
      .catch((err) => {
        commit('set_loading', false)
        commit('set_load_error', 'No se pudo cargar la configuración de multimedia. Probá de nuevo.')
        log_debug(err)
        throw err
      })
  },

  /**
   * Guarda (o borra, si `url` viene vacía) la url de un slot puntual vía PUT /demo-media.
   * Actualiza el mapa local `urls` con la respuesta real del servidor (no de forma optimista),
   * para que el indicador "cargado/sin cargar" refleje siempre lo efectivamente persistido.
   *
   * @param {{ commit: Function }} context
   * @param {{ slot_id: string, url: string }} payload
   * @returns {Promise<{ slot_id: string, url: string|null }>}
   */
  save_slot_url({ commit }, { slot_id, url }) {
    return api
      .put('/demo-media', { slot_id, url })
      .then((res) => {
        commit('set_slot_url', { slot_id: res.data.slot_id, url: res.data.url })
        return res.data
      })
      .catch((err) => {
        log_debug(err)
        throw err
      })
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
}
