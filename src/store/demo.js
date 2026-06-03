import __base_store from '@/common-vue/store/__base_store'

export default __base_store({
  state: {
    /** Nombre de recurso usado por __base_store para construir endpoints `/demo`. */
    model_name: 'demo',
    /** Habilita paginación server-side en la grilla de demos. */
    use_per_page: true,
    /** Cantidad por página por defecto para el CRUD de demos en modal. */
    per_page: 100,
  },
})
