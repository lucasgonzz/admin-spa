/**
 * Utilidades de filtros (construcción de payload). Ampliar según reglas de negocio.
 */
export default {
  methods: {
    is_effective_filter(f) {
      if (!f || !f.type) {
        return false
      }
      if (f.type == 'text' && f.que_contenga) {
        return true
      }
      return true
    },
  },
}
