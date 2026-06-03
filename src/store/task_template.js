/**
 * Módulo Vuex para plantillas de tareas automáticas del panel administrativo.
 * Gestiona el CRUD de TaskTemplate y las acciones de reordenamiento por flechas
 * y toggle de estado activa/inactiva.
 */
import __base_store from '@/common-vue/store/__base_store'
import api from '@/utils/axios'

export default __base_store({
  state() {
    return {
      /** Nombre del recurso REST para la base del store. */
      model_name: 'task_template',
      /**
       * Segmento HTTP en admin-api (kebab-case). Sin esto, get_models pediría /task_template y falla.
       */
      api_resource_path: 'task-template',
      /** Cargar todas las plantillas sin paginación. */
      use_per_page: false,
      /** Lista de admins para el selector de asignación en el ABM. */
      admins: [],
      /** Indica si la lista de admins está cargándose. */
      admins_loading: false,
    }
  },

  mutations: {
    /**
     * Reemplaza la lista de admins del selector.
     *
     * @param {Object} state
     * @param {Array}  value
     */
    set_admins(state, value) {
      state.admins = value || []
    },
    /**
     * Activa o desactiva el indicador de carga de admins.
     *
     * @param {Object}  state
     * @param {boolean} value
     */
    set_admins_loading(state, value) {
      state.admins_loading = !!value
    },
  },

  actions: {
    /**
     * Carga admins desde GET /admin para el select «Asignado a».
     *
     * @returns {Promise<Array>}
     */
    fetch_admins({ commit, state }) {
      if (state.admins.length > 0) {
        return Promise.resolve(state.admins)
      }
      commit('set_admins_loading', true)
      return api
        .get('/admin')
        .then(function (res) {
          commit('set_admins', res.data.admins || [])
          commit('set_admins_loading', false)
          return state.admins
        })
        .catch(function () {
          commit('set_admins_loading', false)
          return []
        })
    },

    /**
     * Crea una nueva plantilla vía POST /task-template.
     * Agrega la plantilla al store local tras la respuesta del servidor.
     *
     * @param   {Object} context Contexto del módulo Vuex.
     * @param   {Object} payload Datos de la plantilla a crear.
     * @returns {Promise<Object>} Plantilla creada.
     */
    create_template({ commit, state }, payload) {
      return api.post('/task-template', payload).then(function (res) {
        // Agregar al final de la lista local.
        const new_template = res.data.model
        commit('set_models', state.models.concat([new_template]))
        return new_template
      })
    },

    /**
     * Actualiza una plantilla existente vía PUT /task-template/{id}.
     * Reemplaza el item en la lista local con los datos frescos del servidor.
     *
     * @param   {Object} context Contexto del módulo Vuex.
     * @param   {Object} payload Datos de la plantilla con el id incluido.
     * @returns {Promise<Object>} Plantilla actualizada.
     */
    update_template({ commit, state }, payload) {
      /** ID de la plantilla a actualizar para construir la URL del endpoint. */
      const template_id = payload.id
      return api.put('/task-template/' + template_id, payload).then(function (res) {
        const updated = res.data.model
        // Reemplazar en la lista local conservando el orden actual.
        const list = state.models.slice()
        const idx = list.findIndex(function (t) { return t.id == template_id })
        if (idx !== -1) {
          list.splice(idx, 1, updated)
        }
        commit('set_models', list)
        return updated
      })
    },

    /**
     * Elimina una plantilla vía DELETE /task-template/{id} y la remueve de la lista local.
     *
     * @param   {Object} context    Contexto del módulo Vuex.
     * @param   {number} template_id ID de la plantilla a eliminar.
     * @returns {Promise}
     */
    delete_template({ commit, state }, template_id) {
      return api.delete('/task-template/' + template_id).then(function () {
        const list = state.models.filter(function (t) { return t.id != template_id })
        commit('set_models', list)
      })
    },

    /**
     * Alterna el estado activa/inactiva de una plantilla vía PATCH /task-template/{id}/toggle-active.
     * Actualiza el item en la lista local con la respuesta del servidor.
     *
     * @param   {Object} context    Contexto del módulo Vuex.
     * @param   {number} template_id ID de la plantilla a alternar.
     * @returns {Promise<Object>} Plantilla actualizada.
     */
    toggle_active({ commit, state }, template_id) {
      return api.patch('/task-template/' + template_id + '/toggle-active').then(function (res) {
        const updated = res.data.model
        const list = state.models.slice()
        const idx = list.findIndex(function (t) { return t.id == template_id })
        if (idx !== -1) {
          list.splice(idx, 1, updated)
        }
        commit('set_models', list)
        return updated
      })
    },

    /**
     * Mueve una plantilla un lugar hacia arriba dentro de su proceso.
     * Reemplaza en la lista local las plantillas del proceso con el orden actualizado.
     *
     * @param   {Object} context    Contexto del módulo Vuex.
     * @param   {number} template_id ID de la plantilla a mover.
     * @returns {Promise}
     */
    move_up({ commit, state }, template_id) {
      return api.patch('/task-template/' + template_id + '/move-up').then(function (res) {
        // El backend devuelve todas las plantillas del proceso reordenadas.
        const updated_list = res.data.models
        if (!updated_list || !updated_list.length) {
          return
        }
        /** Proceso al que pertenecen las plantillas actualizadas. */
        const proceso = updated_list[0].proceso
        // Reemplazar en la lista global solo las del proceso afectado.
        const other_list = state.models.filter(function (t) { return t.proceso !== proceso })
        commit('set_models', other_list.concat(updated_list))
      })
    },

    /**
     * Mueve una plantilla un lugar hacia abajo dentro de su proceso.
     * Reemplaza en la lista local las plantillas del proceso con el orden actualizado.
     *
     * @param   {Object} context    Contexto del módulo Vuex.
     * @param   {number} template_id ID de la plantilla a mover.
     * @returns {Promise}
     */
    move_down({ commit, state }, template_id) {
      return api.patch('/task-template/' + template_id + '/move-down').then(function (res) {
        // El backend devuelve todas las plantillas del proceso reordenadas.
        const updated_list = res.data.models
        if (!updated_list || !updated_list.length) {
          return
        }
        /** Proceso al que pertenecen las plantillas actualizadas. */
        const proceso = updated_list[0].proceso
        // Reemplazar en la lista global solo las del proceso afectado.
        const other_list = state.models.filter(function (t) { return t.proceso !== proceso })
        commit('set_models', other_list.concat(updated_list))
      })
    },
  },
})
