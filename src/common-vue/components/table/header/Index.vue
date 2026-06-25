<template>
  <thead>
    <tr>
      <th v-if="is_selectable" style="width: 2rem" />
      <!-- Cabecera de la columna opcional de acciones por fila (primera columna de datos). -->
      <th v-if="has_row_actions" class="text-center" style="width: 3rem">Acciones</th>
      <th
        v-for="p in table_properties"
        :key="p.key"
        class="th-filtro"
        :class="{
          'th-filtro--open': is_filter_for(p.key) || th_open_key === p.key,
          'th-filtro--active': is_filter_for(p.key),
        }"
        @click="on_th_click(p.key)"
      >
        <div class="th-filtro__inner">
          <span class="th-filtro__label" v-html="p.text" />
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
        </div>
      </th>
    </tr>
  </thead>
</template>

<script>
import BtnFilter from './column-filter/BtnFilter.vue'

/**
 * Cabecera: una columna por propiedad visible; lupita al hover pegada al margen derecho.
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
      /** key de la columna cuyo botón de filtro está visible por tap (mobile/touch). */
      th_open_key: null,
    }
  },
  mounted() {
    /** Cierra la lupita abierta por tap al hacer click fuera de la tabla. */
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
.th-filtro {
	vertical-align: middle;
	padding-top: 0.45rem;
	padding-bottom: 0.45rem;
}

.th-filtro__inner {
	display: flex;
	align-items: center;
	flex-wrap: nowrap;
	justify-content: space-between;
	gap: 0.625rem;
	width: 100%;
	min-width: 100%;
}

.th-filtro__label {
	flex: 1 1 auto;
	min-width: 0;
	line-height: 1.25;
}

/* Sin hover: título truncado si la columna es angosta. */
.th-filtro:not(:hover):not(.th-filtro--open):not(.th-filtro--active) .th-filtro__label {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/*
  Hover o filtro activo: una sola fila; la columna puede ensancharse
  en lugar de apilar la lupita debajo del título.
*/
.th-filtro:hover,
.th-filtro--open,
.th-filtro--active {
	white-space: nowrap;
}

.th-filtro:hover .th-filtro__inner,
.th-filtro--open .th-filtro__inner,
.th-filtro--active .th-filtro__inner {
	width: max-content;
	min-width: 100%;
}

.th-filtro:hover .th-filtro__label,
.th-filtro--open .th-filtro__label,
.th-filtro--active .th-filtro__label {
	overflow: visible;
	text-overflow: clip;
	white-space: nowrap;
}

.cont-filter-buttons {
	flex: 0 0 auto;
	margin-left: auto;
	align-self: center;
	opacity: 0;
	pointer-events: none;
	transform: translateX(4px) scale(0.92);
	transition: opacity 0.18s ease, transform 0.18s ease;
}

.th-filtro:hover .cont-filter-buttons,
.cont-filter-buttons.force-show {
	opacity: 1;
	pointer-events: auto;
	transform: translateX(0) scale(1);
}
</style>
