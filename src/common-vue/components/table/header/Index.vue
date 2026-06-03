<template>
  <thead>
    <tr>
      <th v-if="is_selectable" style="width: 2rem" />
      <th
        v-for="p in table_properties"
        :key="p.key"
        class="position-relative th-filtro"
        :class="{ 'th-filtro--open': is_filter_for(p.key) }"
      >
        <span v-html="p.text" />
        <span class="cont-filter-buttons" :class="{ 'force-show': is_filter_for(p.key) }">
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
  },
  emits: ['open-filter', 'clear-filter'],
  methods: {
    /**
     * Indica si la columna tiene un filtro activo según su key.
     * @param {string} key clave de columna.
     * @returns {boolean}
     */
    is_filter_for(key) {
      return this.filters.some((f) => f.key == key)
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
