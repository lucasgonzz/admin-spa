import __base_store from '@/common-vue/store/__base_store'

/**
 * Store del recurso DemoUpdate.
 * Gestiona el listado paginado de actualizaciones de demo y el upsert
 * en la lista cuando el polling de log recibe el modelo actualizado.
 */
export default __base_store({
  state: {
    model_name: 'demo_update',
    /** Path real del recurso en admin-api (kebab-case). */
    api_resource_path: 'demo-update',
    use_per_page: true,
    per_page: 50,
  },
})
