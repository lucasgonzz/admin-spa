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
     * Lista las corridas de instalación/actualización de ecommerce de todos los CLIENTES, para los
     * listados de los submódulos "Instalaciones del ecommerce" y "Actualizaciones del ecommerce"
     * (prompt 587).
     *
     * 🔴 `owner=cliente` NO es opcional. Desde el 31/8/2026 una tienda puede pertenecer a un cliente
     * o a una demo, y el endpoint sin ese parámetro devuelve las dos. Sin el filtro, las corridas de
     * demo aparecían en las pantallas de clientes con la etiqueta "Cliente #null" (el `client_id`
     * viene en null y no matchea contra `clients_by_id`), y desde ahí se podía abrir y borrar una
     * corrida de demo creyendo que era de un cliente. El listado de demos usa `owner=demo`, en
     * `src/store/demo_installation.js`.
     *
     * @param {object} context Contexto Vuex (no usa commit: sin estado propio).
     * @returns {Promise} Resuelve con { models: ClientEcommerceInstallation[] } (res.data).
     */
    fetch_all(context) {
      return api.get('/ecommerce-installations?owner=cliente')
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
     * Dispara una instalación desde cero eligiendo solo el cliente (el backend resuelve el
     * `ClientEcommerce`), para el submódulo global "Instalaciones > Ecommerce".
     *
     * @param {object} context Contexto Vuex (no usa commit: sin estado propio).
     * @param {number} client_id Id del cliente (no del client_ecommerce: el backend lo resuelve).
     * @returns {Promise} Resuelve con la ClientEcommerceInstallation creada (res.data.model).
     */
    start_install_for_client(context, client_id) {
      return api.post('/ecommerce-installations/start-install', { client_id: client_id })
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

    /**
     * Elimina una corrida de instalación/actualización del ecommerce (y sus logs asociados).
     * El backend rechaza el borrado con 422 si la corrida sigue `instalando`.
     *
     * @param {object} context Contexto Vuex (no usa commit: sin estado propio).
     * @param {number} installation_id Id de la ClientEcommerceInstallation a borrar.
     * @returns {Promise} Resuelve con { deleted: true } (res.data).
     */
    delete_installation(context, installation_id) {
      return api.delete('/ecommerce-installations/' + installation_id)
    },
  },
}
