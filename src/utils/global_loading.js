/**
 * Helpers para el overlay global LogoLoading (auth.loading + auth.message).
 * Mismo contrato que empresa-spa: activar con mensaje descriptivo y limpiar al terminar.
 */

/** Etiquetas legibles por model_name de Vuex para mensajes automáticos. */
const GLOBAL_LOADING_LABELS = {
  lead: 'leads',
  client: 'clientes',
  version: 'versiones',
  update: 'actualizaciones',
  demo_update: 'actualizaciones demo',
  support_ticket: 'tickets de soporte',
  task: 'tareas',
  protocol_entry: 'protocolo de ventas',
  demo: 'demos',
  followup_rule: 'reglas de seguimiento',
  task_template: 'plantillas de tareas',
  followup_template: 'plantillas de seguimiento',
}

/**
 * Mensaje legible para LogoLoading según recurso Vuex y tipo de operación.
 *
 * @param {string} model_name nombre del módulo store (p. ej. lead, client)
 * @param {'load'|'filter'} operation carga inicial o filtrado
 * @returns {string}
 */
export function global_loading_message_for_model(model_name, operation) {
  const label = GLOBAL_LOADING_LABELS[model_name] || String(model_name || '').replace(/_/g, ' ')
  if (operation === 'filter') {
    return 'Filtrando ' + label + '…'
  }
  return 'Cargando ' + label + '…'
}

/**
 * Activa o desactiva auth.loading y auth.message desde un commit de módulo Vuex.
 * Usar { root: true } para llegar al store auth.
 *
 * @param {Function} commit committer Vuex del módulo
 * @param {boolean} active true mientras la operación está en curso
 * @param {string} [message] texto visible en LogoLoading; se limpia al desactivar
 * @returns {void}
 */
export function set_global_loading(commit, active, message) {
  if (active) {
    commit('auth/setLoading', true, { root: true })
    commit('auth/setMessage', message || 'Cargando…', { root: true })
    return
  }
  commit('auth/setLoading', false, { root: true })
  commit('auth/setMessage', '', { root: true })
}

/**
 * Misma lógica que set_global_loading pero desde la instancia del store (vistas).
 *
 * @param {import('vuex').Store} store instancia Vuex de la app
 * @param {boolean} active true mientras la operación está en curso
 * @param {string} [message] texto visible en LogoLoading
 * @returns {void}
 */
export function set_global_loading_store(store, active, message) {
  if (!store || typeof store.commit !== 'function') {
    return
  }
  if (active) {
    store.commit('auth/setLoading', true)
    store.commit('auth/setMessage', message || 'Cargando…')
    return
  }
  store.commit('auth/setLoading', false)
  store.commit('auth/setMessage', '')
}
