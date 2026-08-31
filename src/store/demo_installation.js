import api from '@/utils/axios'

/**
 * Llamadas HTTP del módulo Demos: instalación desde cero del sistema (ERP) de una demo
 * (DemoInstallation) y corridas de ecommerce cuyo dueño es una demo.
 *
 * 🔴 Ojo: esto NO es un módulo de Vuex, a diferencia de sus hermanos `demo_update` y
 * `ecommerce_installation`. Registrar un módulo nuevo exige editar `src/store/index.js`, que
 * queda FUERA del alcance de esta misión, así que se resuelve como un objeto plano de funciones
 * que se importa derecho en los componentes. No se pierde nada: `ecommerce_installation` ya es
 * "una capa fina sobre api" sin estado propio (lo dice su propio docblock), y acá pasa igual —
 * cada panel es dueño de su copia de la corrida y hace su propio polling.
 *
 * Si algún día hace falta estado compartido, se pasa a Vuex y se registra en index.js.
 */
export default {
  /**
   * Lista todas las instalaciones de sistema (ERP) de demos.
   *
   * @returns {Promise} Resuelve con { models: DemoInstallation[] } (res.data).
   */
  fetch_installations() {
    return api.get('/demo-installation')
  },

  /**
   * Trae una instalación puntual con su log completo (para el polling del panel de seguimiento).
   *
   * @param {number} installation_id Id de la DemoInstallation.
   * @returns {Promise} Resuelve con { model: DemoInstallation } (res.data).
   */
  fetch_installation(installation_id) {
    return api.get('/demo-installation/' + installation_id)
  },

  /**
   * Crea la corrida de instalación del sistema de una demo y encola el job.
   *
   * El subdominio y la base de datos ya tienen que estar creados a mano en hPanel: eso no lo
   * hace el pipeline. `env_manual_values` son justamente las credenciales de esa base.
   *
   * @param {Object} payload { demo_id, version_id, env_manual_values }
   * @returns {Promise} Resuelve con { model: DemoInstallation } (res.data).
   */
  create_installation(payload) {
    return api.post('/demo-installation', payload)
  },

  /**
   * Elimina una corrida de instalación de sistema (el backend la rechaza si sigue 'instalando').
   *
   * @param {number} installation_id Id de la DemoInstallation.
   * @returns {Promise}
   */
  delete_installation(installation_id) {
    return api.delete('/demo-installation/' + installation_id)
  },

  /**
   * Catálogo de demos, para los selectores de los modales de creación.
   *
   * Sin `page` el endpoint devuelve el listado completo (ver DemoController::index_json).
   *
   * @returns {Promise} Resuelve con { models: Demo[] } (res.data).
   */
  fetch_demos() {
    return api.get('/demo')
  },

  /**
   * Corridas de ecommerce cuyo dueño es una demo (instalaciones y actualizaciones juntas:
   * cada pantalla filtra después por `mode`).
   *
   * @returns {Promise} Resuelve con { models: ClientEcommerceInstallation[] } (res.data).
   */
  fetch_ecommerce_runs() {
    return api.get('/ecommerce-installations?owner=demo')
  },

  /**
   * Dispara la instalación desde cero del ecommerce de una demo.
   *
   * Es el mismo endpoint que usa el camino de clientes, mandando `demo_id` en vez de `client_id`.
   *
   * @param {number} demo_id Id de la demo dueña del ecommerce.
   * @returns {Promise} Resuelve con { model: ClientEcommerceInstallation } (res.data).
   */
  start_ecommerce_install(demo_id) {
    return api.post('/ecommerce-installations/start-install', { demo_id: demo_id })
  },

  /**
   * Dispara la actualización (siempre última de master) del ecommerce ya instalado de una demo.
   *
   * @param {number} demo_id Id de la demo dueña del ecommerce.
   * @returns {Promise} Resuelve con { model: ClientEcommerceInstallation } (res.data).
   */
  start_ecommerce_update(demo_id) {
    return api.post('/ecommerce-installations/start-update', { demo_id: demo_id })
  },

  /**
   * Líneas de log (y status actual) de una corrida de ecommerce, para el polling del panel.
   *
   * Es el mismo endpoint del camino de clientes: la corrida es un ClientEcommerceInstallation
   * igual, solo cambia quién es el dueño.
   *
   * @param {number} installation_id Id de la ClientEcommerceInstallation.
   * @returns {Promise} Resuelve con { status, models } (res.data).
   */
  fetch_ecommerce_logs(installation_id) {
    return api.get('/ecommerce-installations/' + installation_id + '/logs')
  },

  /**
   * Elimina una corrida de ecommerce (el backend la rechaza con 422 si sigue 'instalando').
   *
   * @param {number} installation_id Id de la ClientEcommerceInstallation.
   * @returns {Promise}
   */
  delete_ecommerce_run(installation_id) {
    return api.delete('/ecommerce-installations/' + installation_id)
  },

  /**
   * Nombre legible de una demo: el `nombre` cargado en el catálogo y, si está vacío, la URL
   * del ERP. Mismo orden de prioridad que `Demo::display_name()` en admin-api.
   *
   * @param {Object|null} demo
   * @returns {string}
   */
  demo_label(demo) {
    if (!demo) {
      return ''
    }
    if (demo.nombre) {
      return demo.nombre
    }
    if (demo.erp_spa_url) {
      return demo.erp_spa_url
    }
    return 'Demo #' + demo.id
  },
}
