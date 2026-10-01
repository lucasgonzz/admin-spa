import api from '@/utils/axios'

/**
 * Normaliza el argumento de las acciones de arranque, que acepta la forma vieja (un id pelado) o
 * la nueva (`{ id, ecommerce_version_id }`, misión versiones-tienda, 1/10/2026).
 *
 * @param {number|Object} arg Id, u objeto con `id` y `ecommerce_version_id` opcional.
 * @returns {{ id: number, body: Object }} El id y el cuerpo extra a mandar (con la versión si vino).
 */
function start_args(arg) {
  if (arg !== null && typeof arg === 'object') {
    const body = {}
    if (arg.ecommerce_version_id != null) {
      body.ecommerce_version_id = arg.ecommerce_version_id
    }
    return { id: arg.id, body: body }
  }
  return { id: arg, body: {} }
}

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
     * @param {number|{id: number, ecommerce_version_id: (number|null)}} arg Id del ClientEcommerce a
     *   instalar, o `{ id, ecommerce_version_id }` para elegir la versión de ecommerce (sin ella, el
     *   backend usa la última publicada).
     * @returns {Promise} Resuelve con la ClientEcommerceInstallation creada (res.data.model).
     */
    start_install(context, arg) {
      const parsed = start_args(arg)
      return api.post('/client-ecommerce/' + parsed.id + '/installations/start-install', parsed.body)
    },

    /**
     * Dispara una actualización del ecommerce ya instalado de un cliente, a la versión de ecommerce
     * elegida (sin elegir, la última publicada).
     *
     * @param {object} context Contexto Vuex (no usa commit: sin estado propio).
     * @param {number|{id: number, ecommerce_version_id: (number|null)}} arg Id del cliente (no del
     *   client_ecommerce: el backend lo resuelve), o `{ id, ecommerce_version_id }`.
     * @returns {Promise} Resuelve con la ClientEcommerceInstallation creada (res.data.model).
     */
    start_update(context, arg) {
      const parsed = start_args(arg)
      return api.post('/ecommerce-installations/start-update', Object.assign({ client_id: parsed.id }, parsed.body))
    },

    /**
     * Dispara una instalación desde cero eligiendo solo el cliente (el backend resuelve el
     * `ClientEcommerce`), para el submódulo global "Instalaciones > Ecommerce".
     *
     * @param {object} context Contexto Vuex (no usa commit: sin estado propio).
     * @param {number|{id: number, ecommerce_version_id: (number|null)}} arg Id del cliente, o
     *   `{ id, ecommerce_version_id }`.
     * @returns {Promise} Resuelve con la ClientEcommerceInstallation creada (res.data.model).
     */
    start_install_for_client(context, arg) {
      const parsed = start_args(arg)
      return api.post('/ecommerce-installations/start-install', Object.assign({ client_id: parsed.id }, parsed.body))
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
