<template>
  <thead>
    <tr>
      <th v-if="is_selectable" style="width: 2rem" />
      <!-- Cabecera de la columna opcional de acciones por fila (primera columna de datos). -->
      <th v-if="has_row_actions" class="text-center" style="width: 3rem">Acciones</th>
      <th
        v-for="p in table_properties"
        :key="p.key"
        class="position-relative th-filtro"
        :class="{ 'th-filtro--open': is_filter_for(p.key) }"
        @click="on_th_click(p.key)"
      >
        <span v-html="p.text" />
        <span
          class="cont-filter-buttons"
          :class="{ 'force-show': is_filter_for(p.key) || th_open_key === p.key }"
        >
          <btn-filter
            :active="is_filter_for(p.key)"
            @open="$emit('open-filter', p)"
            @clear="$emit('clear-filter', p)"
          />
        </span>
      </th>
    </tr>
  </thead>
</template>

<script>
import BtnFilter from './column-filter/BtnFilter.vue'

/**
 * Cabecera: una columna por propiedad visible; lupita (hover o verde si hay filtro).
 */
export default {
  name: 'TableHeader',
  components: { BtnFilter },
  props: {
    table_properties: { type: Array, default: () => [] },
    is_selectable: { type: Boolean, default: false },
    filters: { type: Array, default: () => [] },
    /** true cuando la tabla muestra una columna de acciones por fila (slot row-actions). */
    has_row_actions: { type: Boolean, default: false },
  },
  emits: ['open-filter', 'clear-filter'],
  data() {
    return {
      // key de la columna cuyo botón de filtro está visible por tap (mobile/touch)
      th_open_key: null,
    }
  },
  mounted() {
    // cierra la lupita abierta por tap al hacer click fuera de la tabla
    document.addEventListener('click', this._on_doc_click)
  },
  beforeUnmount() {
    document.removeEventListener('click', this._on_doc_click)
  },
  methods: {
    /**
     * Indica si la columna tiene un filtro activo según su key.
     * @param {string} key clave de columna.
     * @returns {boolean}
     */
    is_filter_for(key) {
      return this.filters.some((f) => f.key == key)
    },
    /**
     * Alterna la visibilidad del botón de filtro al tocar la cabecera (mobile).
     * @param {string} key clave de columna.
     */
    on_th_click(key) {
      this.th_open_key = (this.th_open_key === key) ? null : key
    },
    /**
     * Oculta la lupita abierta por tap si el click fue fuera del thead.
     * @param {Event} e evento click del documento.
     */
    _on_doc_click(e) {
      if (!this.$el.contains(e.target)) {
        this.th_open_key = null
      }
    },
  },
}
</script>

<style scoped lang="scss">
.th-filtro:hover .cont-filter-buttons,
.cont-filter-buttons.force-show {
  max-width: 6rem;
  opacity: 1;
}
.cont-filter-buttons {
  display: inline-block;
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  vertical-align: middle;
  transition: max-width 0.15s, opacity 0.15s;
  white-space: nowrap;
}
</style>
