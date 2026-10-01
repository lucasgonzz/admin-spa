import __base_store from '@/common-vue/store/__base_store'
import api from '@/utils/axios'

/**
 * Versiones de ecommerce (`ecommerce-versions` en admin-api), misión cruzada `versiones-tienda`
 * (1/10/2026).
 *
 * Una versión de ecommerce es el puntero a los dos artefactos que GitHub Actions publica en el
 * release del tag `v{version}` de tienda-spa y tienda-api. El listado y el modal CRUD salen del
 * `resource-view` genérico (meta `ecommerce_version` + este store); el backend verifica los dos
 * assets al publicar y no deja borrar una versión que alguna tienda o corrida usa.
 *
 * Además expone `fetch_published`, que usan los selectores de versión de los modales de instalar y
 * actualizar una tienda (EcommerceVersionSelect).
 */
export default __base_store({
  state: {
    model_name: 'ecommerce_version',
    /** Path real del recurso (kebab, plural) distinto del nombre de módulo Vuex. */
    api_resource_path: 'ecommerce-versions',
    use_per_page: false,
    per_page: 100,
  },
  actions: {
    /**
     * Versiones PUBLICADAS (las únicas que se pueden desplegar), de la más nueva a la más vieja
     * por orden semántico, y la última publicada (la que usa el backend si no se elige ninguna).
     *
     * @returns {Promise<{ models: Array<Object>, ultima_publicada: Object|null }>}
     */
    fetch_published() {
      return api.get('/ecommerce-versions?status=published').then(function (res) {
        const body = res.data || {}
        return {
          models: Array.isArray(body.models) ? body.models : [],
          ultima_publicada: body.ultima_publicada || null,
        }
      })
    },
  },
})
