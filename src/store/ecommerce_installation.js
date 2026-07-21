import api from '@/utils/axios'

/**
 * Acciones del pipeline técnico de instalación/actualización del ecommerce
 * (ClientEcommerceInstallation + EcommerceDeploymentLog, prompts 584/585/586).
 *
 * A diferencia de `ecommerce_implementation` (flujo conversacional por WhatsApp), este
 * módulo NO guarda estado global: los componentes (EcommerceInstallationDetail /
 * EcommerceOperationsPanel) son dueños de su propia copia de la corrida y hacen su propio
 * polling, igual que InstallationDetail.vue en el pipeline equivalente de empresa. El store
 * acá es solo una capa fina sobre `api` para no repetir las URLs en los componentes.
 */
export default {
  namespaced: true,

  actions: {
    /**
     * Lista todas las corridas de instalación/actualización de ecommerce (todos los clientes),
     * para el listado del submódulo "Actualizaciones del ecommerce" (prompt 587).
     *
     * @param {object} context Contexto Vuex (no usa commit: sin estado propio).
     * @returns {Promise} Resuelve con { models: ClientEcommerceInstallation[] } (res.data).
     */
    fetch_all(context) {
      return api.get('/ecommerce-installations')
    },

    /**
     * Dispara una instalación desde cero de la tienda de un cliente.
     *
     * @param {object} context Contexto Vuex (no usa commit: sin estado propio).
     * @param {number} client_ecommerce_id Id del ClientEcommerce a instalar.
     * @returns {Promise} Resuelve con la ClientEcommerceInstallation creada (res.data.model).
     */
    start_install(context, client_ecommerce_id) {
      return api.post('/client-ecommerce/' + client_ecommerce_id + '/installations/start-install')
    },

    /**
     * Dispara una actualización (siempre última de master) del ecommerce ya instalado de un cliente.
     *
     * @param {object} context Contexto Vuex (no usa commit: sin estado propio).
     * @param {number} client_id Id del cliente (no del client_ecommerce: el backend lo resuelve).
     * @returns {Promise} Resuelve con la ClientEcommerceInstallation creada (res.data.model).
     */
    start_update(context, client_id) {
      return api.post('/ecommerce-installations/start-update', { client_id: client_id })
    },

    /**
     * Consulta las líneas de log (y el status actual) de una corrida, para el polling del panel.
     *
     * @param {object} context Contexto Vuex (no usa commit: sin estado propio).
     * @param {number} installation_id Id de la ClientEcommerceInstallation.
     * @returns {Promise} Resuelve con { status, models } (res.data).
     */
    fetch_logs(context, installation_id) {
      return api.get('/ecommerce-installations/' + installation_id + '/logs')
    },
  },
}
