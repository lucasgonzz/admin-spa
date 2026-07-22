/**
 * Módulo Vuex para tareas internas del panel administrativo.
 * Gestiona la lista de tareas, la lista de admins para asignación,
 * y las operaciones de CRUD y reordenamiento por drag & drop.
 */
import __base_store from '@/common-vue/store/__base_store'
import api from '@/utils/axios'

export default __base_store({
  state() {
    return {
      /** Nombre del recurso REST. */
      model_name: 'task',
      /** No usar paginación: cargar todas las tareas de una vez. */
      use_per_page: false,
      /** Lista de admins disponibles para asignación de tareas. */
      admins: [],
      /** Indica si la lista de admins está siendo cargada. */
      admins_loading: false,
    }
  },

  getters: {
    /**
     * Devuelve una función que cuenta tareas pendientes asignadas a un admin.
     * Se usa en la barra lateral para el badge del ítem «Tareas».
     *
     * Semántica (corregida): una tarea sin asignar significa "la puede hacer
     * cualquiera", no "es de todos" — por eso ya NO suma al contador personal.
     *
     * @param {Object} state estado del módulo task.
     * @returns {function(number|string|null): number}
     */
    pending_assigned_count_for_admin(state) {
      return function (admin_id) {
        if (admin_id == null || admin_id === '') {
          return 0
        }
        /** Id numérico normalizado para comparar con los ids de assigned_admins. */
        const target_id = Number(admin_id)
        if (isNaN(target_id)) {
          return 0
        }
        /** Contador de tareas no realizadas donde el admin está entre los asignados. */
        var count = 0
        state.models.forEach(function (t) {
          if (t.is_done) {
            return
          }
          // Determinar si el admin está entre los asignados de la tarea.
          var is_mine = false
          if (Array.isArray(t.assigned_admins)) {
            // Formato nuevo: array de admins { id, name, ... }.
            is_mine = t.assigned_admins.some(function (a) { return Number(a.id) === target_id })
          } else {
            // Defensivo: respuesta vieja en caché sin assigned_admins, usar el legacy.
            is_mine = t.assigned_admin_id != null && Number(t.assigned_admin_id) === target_id
          }
          if (is_mine) {
            count += 1
          }
        })
        return count
      }
    },

    /**
     * Cantidad de tareas pendientes sin ningún admin asignado.
     * Se usa en la barra de navegación para el ítem "Sin asignar" (prompt 09).
     *
     * @param {Object} state estado del módulo task.
     * @returns {number}
     */
    pending_count_unassigned(state) {
      var count = 0
      state.models.forEach(function (t) {
        if (t.is_done) {
          return
        }
        // Determinar si la tarea no tiene ningún asignado, con fallback legacy.
        var is_unassigned
        if (Array.isArray(t.assigned_admins)) {
          is_unassigned = t.assigned_admins.length === 0
        } else {
          is_unassigned = t.assigned_admin_id == null
        }
        if (is_unassigned) {
          count += 1
        }
      })
      return count
    },

    /**
     * Cantidad total de tareas pendientes (sin filtrar por asignación).
     * Se usa en la barra de navegación para el ítem "Todos" (prompt 09).
     *
     * @param {Object} state estado del módulo task.
     * @returns {number}
     */
    pending_count_total(state) {
      return state.models.filter(function (t) { return !t.is_done }).length
    },
  },

  mutations: {
    /**
     * Reemplaza la lista completa de admins.
     *
     * @param {Object} state
     * @param {Array}  value  Array de admins { id, name, email, is_default_task_assignee }
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
     * Carga la lista de admins desde GET /admin/admin.
     * Se usa para poblar el selector de asignación al crear o editar tareas.
     *
     * @returns {Promise}
     */
    fetch_admins({ commit, state }) {
      // Si ya están cargados, no volver a pedir.
      if (state.admins.length > 0) {
        return Promise.resolve(state.admins)
      }
      commit('set_admins_loading', true)
      return api
        .get('/admin')
        .then(function (res) {
          commit('set_admins', res.data.admins || [])
          commit('set_admins_loading', false)
        })
        .catch(function () {
          commit('set_admins_loading', false)
        })
    },

    /**
     * Crea una nueva tarea vía POST /task.
     * La nueva tarea se agrega al inicio de la lista local (sort_order 0 en el backend).
     *
     * @param   {Object} payload  { title, content, assigned_admin_id, todos }
     * @returns {Promise}
     */
    create_task({ commit, state }, payload) {
      return api
        .post('/task', payload)
        .then(function (res) {
          // Insertar al inicio ya que el backend la coloca con sort_order 0.
          const new_task = res.data.model
          const updated = [new_task].concat(state.models)
          commit('set_models', updated)
          return new_task
        })
    },

    /**
     * Actualiza una tarea existente vía PUT /task/{id}.
     * Reemplaza el item en la lista local con los datos frescos del servidor.
     *
     * @param   {Object} payload  { id, ...campos }
     * @returns {Promise}
     */
    update_task({ commit, state }, payload) {
      const task_id = payload.id
      return api
        .put('/task/' + task_id, payload)
        .then(function (res) {
          const updated_task = res.data.model
          // Reemplazar en la lista local conservando el orden actual.
          const tasks = state.models.slice()
          const idx = tasks.findIndex(function (t) { return t.id == task_id })
          if (idx !== -1) {
            tasks.splice(idx, 1, updated_task)
          }
          commit('set_models', tasks)
          return updated_task
        })
    },

    /**
     * Alterna el estado is_done de una tarea vía PUT /task/{id} con solo ese campo.
     * Operación rápida: solo envía is_done al backend.
     *
     * @param   {Object} task  Objeto de tarea con { id, is_done }
     * @returns {Promise}
     */
    toggle_done({ dispatch }, task) {
      return dispatch('update_task', { id: task.id, is_done: !task.is_done })
    },

    /**
     * Elimina una tarea vía DELETE /task/{id} y la remueve de la lista local.
     *
     * @param   {number} task_id
     * @returns {Promise}
     */
    delete_task({ commit, state }, task_id) {
      return api
        .delete('/task/' + task_id)
        .then(function () {
          const tasks = state.models.filter(function (t) { return t.id != task_id })
          commit('set_models', tasks)
        })
    },

    /**
     * Persiste el nuevo orden de tareas en el backend vía PUT /task/reorder.
     * También actualiza la lista local para reflejar el orden visual inmediatamente.
     *
     * @param   {Object} payload  { ids: [id1, id2, ...] } — IDs en el nuevo orden
     * @returns {Promise}
     */
    reorder_tasks({ commit, state }, payload) {
      const ids = payload.ids

      // Reordenar la lista local para reflejar el cambio visualmente de inmediato.
      const tasks_by_id = {}
      state.models.forEach(function (t) { tasks_by_id[t.id] = t })

      // Construir lista reordenada: primero las que aparecen en ids, luego el resto.
      const reordered = ids
        .filter(function (id) { return tasks_by_id[id] })
        .map(function (id) { return tasks_by_id[id] })
      const rest = state.models.filter(function (t) {
        return ids.indexOf(t.id) === -1
      })
      commit('set_models', reordered.concat(rest))

      // Persistir en el backend.
      return api.put('/task/reorder', { ids: ids })
    },
  },
})
