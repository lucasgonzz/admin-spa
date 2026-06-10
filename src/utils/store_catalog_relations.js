/**
 * Relaciones de select resueltas desde catálogo Vuex precargado al iniciar sesión.
 * Clave = valor de `relation` en meta del campo (ej. current_version_id → relation: version).
 */
export const store_catalog_relations = {
  version: {
    store_module: 'version',
    load_action: 'load_select_catalog',
  },
}
