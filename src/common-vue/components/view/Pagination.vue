<template>
  <!--
    Paginador del listado. Se autooculta cuando hay una sola página: así el consumidor no
    necesita envolverlo en ningún v-if propio.
  -->
  <nav
    v-if="safe_total_pages > 1"
    class="view-pagination mt-2"
    aria-label="Paginación del listado"
  >
    <ul class="pagination pagination-sm justify-content-center mb-1">
      <!-- Primera página -->
      <li class="page-item" :class="{ disabled: is_at_first }">
        <button
          type="button"
          class="page-link"
          title="Primera página"
          :disabled="is_at_first"
          @click="go_to(1)"
        >&laquo;</button>
      </li>
      <!-- Página anterior -->
      <li class="page-item" :class="{ disabled: is_at_first }">
        <button
          type="button"
          class="page-link"
          title="Página anterior"
          :disabled="is_at_first"
          @click="go_to(safe_page - 1)"
        >&lsaquo;</button>
      </li>

      <!--
        Ventana de números: se esconde en teléfono (<576px) porque no entra en 360px.
        Ahí queda el indicador compacto "3 / 12" de más abajo.
      -->
      <li
        v-for="item in pages_window"
        :key="item.key"
        class="page-item d-none d-sm-flex"
        :class="{ disabled: item.is_gap || loading, active: item.page === safe_page }"
      >
        <span v-if="item.is_gap" class="page-link">…</span>
        <button
          v-else
          type="button"
          class="page-link"
          :title="'Ir a la página ' + item.page"
          :disabled="loading"
          @click="go_to(item.page)"
        >{{ item.page }}</button>
      </li>

      <!-- Indicador compacto para teléfono: reemplaza a la ventana de números. -->
      <li class="page-item disabled d-flex d-sm-none">
        <span class="page-link">{{ safe_page }} / {{ safe_total_pages }}</span>
      </li>

      <!-- Página siguiente -->
      <li class="page-item" :class="{ disabled: is_at_last }">
        <button
          type="button"
          class="page-link"
          title="Página siguiente"
          :disabled="is_at_last"
          @click="go_to(safe_page + 1)"
        >&rsaquo;</button>
      </li>
      <!-- Última página -->
      <li class="page-item" :class="{ disabled: is_at_last }">
        <button
          type="button"
          class="page-link"
          title="Última página"
          :disabled="is_at_last"
          @click="go_to(safe_total_pages)"
        >&raquo;</button>
      </li>
    </ul>

    <!-- Leyenda: se esconde en pantallas chicas para no robarle altura a la grilla. -->
    <p class="text-muted small text-center mb-0 d-none d-md-block">
      Mostrando {{ rango_desde }}–{{ rango_hasta }} de {{ safe_total_results }}
    </p>
  </nav>
</template>

<script>
/**
 * Paginador genérico de listados: « ‹ [ventana de números] › », más la leyenda
 * "Mostrando X–Y de N".
 *
 * No sabe nada del store: recibe los contadores por props y emite `paginate` con la página
 * destino. Quien lo usa decide si esa página va al listado base o a la búsqueda filtrada.
 */
export default {
  name: 'ViewPagination',
  emits: ['paginate'],
  props: {
    /** Página actual (1-based). */
    page: {
      type: Number,
      default: 1,
    },
    /** Cantidad total de páginas. Con 1 o menos el componente no renderiza nada. */
    total_pages: {
      type: Number,
      default: 1,
    },
    /** Cantidad total de resultados (para la leyenda). */
    total_results: {
      type: Number,
      default: 0,
    },
    /** Filas por página (para calcular el rango de la leyenda). */
    per_page: {
      type: Number,
      default: 25,
    },
    /** true mientras hay una petición en vuelo: deshabilita los botones. */
    loading: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    /**
     * Total de páginas saneado (mínimo 1): evita ventanas vacías si llega null o 0.
     * @returns {number}
     */
    safe_total_pages() {
      var total = parseInt(this.total_pages, 10)
      if (isNaN(total) || total < 1) {
        return 1
      }
      return total
    },
    /**
     * Página actual saneada y acotada al rango válido.
     * @returns {number}
     */
    safe_page() {
      var current = parseInt(this.page, 10)
      if (isNaN(current) || current < 1) {
        return 1
      }
      if (current > this.safe_total_pages) {
        return this.safe_total_pages
      }
      return current
    },
    /**
     * Filas por página saneadas (mínimo 1).
     * @returns {number}
     */
    safe_per_page() {
      var per = parseInt(this.per_page, 10)
      if (isNaN(per) || per < 1) {
        return 25
      }
      return per
    },
    /**
     * Total de resultados saneado (mínimo 0).
     * @returns {number}
     */
    safe_total_results() {
      var total = parseInt(this.total_results, 10)
      if (isNaN(total) || total < 0) {
        return 0
      }
      return total
    },
    /**
     * true si ya estamos en la primera página (o mientras carga): apaga « y ‹.
     * @returns {boolean}
     */
    is_at_first() {
      return this.loading || this.safe_page <= 1
    },
    /**
     * true si ya estamos en la última página (o mientras carga): apaga › y ».
     * @returns {boolean}
     */
    is_at_last() {
      return this.loading || this.safe_page >= this.safe_total_pages
    },
    /**
     * Ventana de números: primera, "…", las dos anteriores, la actual, las dos siguientes,
     * "…", última. Los huecos son ítems deshabilitados, no botones.
     *
     * @returns {Array<{ key: string, page: number|null, is_gap: boolean }>}
     */
    pages_window() {
      var total = this.safe_total_pages
      var current = this.safe_page
      var items = []
      var desde = current - 2
      var hasta = current + 2
      var i = 0

      if (desde < 1) {
        desde = 1
      }
      if (hasta > total) {
        hasta = total
      }

      if (desde > 1) {
        items.push({ key: 'pagina-1', page: 1, is_gap: false })
        if (desde > 2) {
          items.push({ key: 'hueco-inicio', page: null, is_gap: true })
        }
      }

      for (i = desde; i <= hasta; i = i + 1) {
        items.push({ key: 'pagina-' + i, page: i, is_gap: false })
      }

      if (hasta < total) {
        if (hasta < total - 1) {
          items.push({ key: 'hueco-fin', page: null, is_gap: true })
        }
        items.push({ key: 'pagina-' + total, page: total, is_gap: false })
      }

      return items
    },
    /**
     * Primer resultado visible en la página actual (1-based). 0 si no hay resultados.
     * @returns {number}
     */
    rango_desde() {
      if (this.safe_total_results === 0) {
        return 0
      }
      return (this.safe_page - 1) * this.safe_per_page + 1
    },
    /**
     * Último resultado visible en la página actual.
     * @returns {number}
     */
    rango_hasta() {
      var hasta = this.safe_page * this.safe_per_page
      if (hasta > this.safe_total_results) {
        return this.safe_total_results
      }
      return hasta
    },
  },
  methods: {
    /**
     * Emite el cambio de página, salvo que no haya nada que cambiar.
     *
     * No emite si está cargando, si la página destino es la actual, o si se sale del rango:
     * cualquiera de esos casos generaría una petición al pedo.
     *
     * @param {number|null} page Página destino (1-based).
     * @returns {void}
     */
    go_to(page) {
      var destino = parseInt(page, 10)
      if (this.loading) {
        return
      }
      if (isNaN(destino)) {
        return
      }
      if (destino < 1 || destino > this.safe_total_pages) {
        return
      }
      if (destino === this.safe_page) {
        return
      }
      this.$emit('paginate', destino)
    },
  },
}
</script>

<style scoped>
/* El paginador es hermano de la tabla: separación mínima y nada más. */
.view-pagination {
  width: 100%;
}
</style>
