import api from '@/utils/axios'

/**
 * Módulo Vuex para grupos de base de datos compartida entre clientes.
 * Expone acciones puntuales contra los endpoints JSON de admin-api.
 */
export default {
  namespaced: true,

  state: {},

  mutations: {},

  actions: {
    /**
     * Lista todos los grupos con sus clientes asociados.
     *
     * @returns {Promise<Array<Object>>} Arreglo de grupos serializados.
     */
    getSharedDatabaseGroups() {
      return api.get('/shared-database-groups').then(function (res) {
        if (res.data && res.data.models) {
          return res.data.models
        }
        return []
      })
    },

    /**
     * Crea un grupo de BD compartida.
     *
     * @param {Object} context Contexto Vuex (no usado).
     * @param {string|null|undefined} name Nombre opcional del grupo.
     * @returns {Promise<Object>} Grupo creado.
     */
    createSharedDatabaseGroup(context, name) {
      /** Payload con nombre opcional (el backend acepta null o string vacío). */
      var payload = { name: name || null }
      return api.post('/shared-database-groups', payload).then(function (res) {
        if (res.data && res.data.model) {
          return res.data.model
        }
        return null
      })
    },

    /**
     * Elimina un grupo de BD compartida.
     *
     * @param {Object} context Contexto Vuex (no usado).
     * @param {number|string} id ID del grupo.
     * @returns {Promise<void>}
     */
    deleteSharedDatabaseGroup(context, id) {
      return api.delete('/shared-database-groups/' + id)
    },

    /**
     * Asigna un cliente a un grupo de BD compartida.
     *
     * @param {Object} context Contexto Vuex (no usado).
     * @param {Object} payload { client_id, group_id }.
     * @returns {Promise<Object>} Cliente actualizado (fullModel).
     */
    assignClientToGroup(context, payload) {
      return api
        .post('/clients/' + payload.client_id + '/shared-database-group', {
          shared_database_group_id: payload.group_id,
        })
        .then(function (res) {
          if (res.data && res.data.model) {
            return res.data.model
          }
          return null
        })
    },

    /**
     * Quita un cliente de su grupo de BD compartida.
     *
     * @param {Object} context Contexto Vuex (no usado).
     * @param {number|string} client_id ID del cliente.
     * @returns {Promise<Object>} Cliente actualizado (fullModel).
     */
    removeClientFromGroup(context, client_id) {
      return api.delete('/clients/' + client_id + '/shared-database-group').then(function (res) {
        if (res.data && res.data.model) {
          return res.data.model
        }
        return null
      })
    },
  },
}
