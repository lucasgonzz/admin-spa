<template>
  <base-modal :show="open_local" :title="title" size="md" @update:show="on_show_update" @close="on_hidden">
    <div v-if="field">
      <filter-text
        v-if="field.type === 'text' || field.type === 'textarea'"
        ref="active_field"
        :draft="draft"
        @filter="on_filter"
      />
      <filter-number
        v-else-if="field.type === 'number'"
        ref="active_field"
        :draft="draft"
        @filter="on_filter"
      />
      <filter-date
        v-else-if="field.type === 'date' || field.type === 'day'"
        ref="active_field"
        :draft="draft"
        @filter="on_filter"
      />
      <filter-select
        v-else-if="field.type === 'select' || field.type === 'pipeline_status'"
        ref="active_field"
        :field="field"
        :model_name="model_name"
        :draft="draft"
      />
      <filter-search
        v-else-if="field.type === 'search'"
        ref="active_field"
        :field="field"
        :model_name="model_name"
        :draft="draft"
        @filter="on_filter"
      />
      <filter-checkbox
        v-else-if="field.type === 'checkbox'"
        ref="active_field"
        :field="field"
        :draft="draft"
      />
    </div>
    <template #footer>
      <column-filter-footer @filter="on_filter" />
    </template>
  </base-modal>
</template>

<script>
import BaseModal from '@/components/ui/BaseModal.vue'
import FilterText from './fields/FilterText.vue'
import FilterNumber from './fields/FilterNumber.vue'
import FilterDate from './fields/FilterDate.vue'
import FilterSelect from './fields/FilterSelect.vue'
import FilterSearch from './fields/FilterSearch.vue'
import FilterCheckbox from './fields/FilterCheckbox.vue'
import ColumnFilterFooter from './footer/Index.vue'

/**
 * Modal de criterio: construye un objeto `draft` alineado con admin-api SearchController.
 */
export default {
  name: 'ColumnFilterModal',
  components: {
    BaseModal,
    FilterText,
    FilterNumber,
    FilterDate,
    FilterSelect,
    FilterSearch,
    FilterCheckbox,
    ColumnFilterFooter,
  },
  props: {
    show: { type: Boolean, default: false },
    field: { type: Object, default: null },
    model_name: { type: String, default: '' },
    /** Criterios ya aplicados o pendientes en el store del recurso. */
    active_filters: { type: Array, default: () => [] },
  },
  emits: ['close', 'add', 'add-and-run'],
  data() {
    return {
      open_local: false,
      draft: {},
    }
  },
  computed: {
    title() {
      if (!this.field) {
        return 'Filtro'
      }
      return 'Filtrar: ' + (this.field.text || this.field.key)
    },
  },
  watch: {
    /**
     * Sincroniza visibilidad local con la prop del padre.
     * @param {boolean} v
     * @returns {void}
     */
    show(v) {
      this.open_local = v
      if (v) {
        this.init_draft()
        this.focus_active_field_input()
      }
    },
  },
  methods: {
    init_draft() {
      if (!this.field) {
        this.draft = {}
        return
      }
      const t = this.field.type
      const d = { type: t, key: this.field.key }
      if (t === 'text' || t === 'textarea') {
        d.que_contenga = ''
      } else if (t === 'number') {
        d.menor_que = ''
        d.igual_que = ''
        d.mayor_que = ''
      } else if (t === 'date' || t === 'day') {
        d.menor_que = ''
        d.igual_que = ''
        d.mayor_que = ''
      } else if (t === 'select' || t === 'pipeline_status') {
        d.igual_que = null
      } else if (t === 'search') {
        d.igual_que = ''
      } else if (t === 'checkbox') {
        d.checkbox = -1
      }

      /** Criterio previo de esta columna, si el usuario reabre el modal. */
      const existing = (this.active_filters || []).find(function (f) {
        return f && f.key === d.key
      })
      if (existing) {
        Object.keys(existing).forEach(function (k) {
          d[k] = existing[k]
        })
        d.type = t
        d.key = this.field.key
      }

      this.draft = d
    },
    /**
     * Cierra el modal y notifica al padre para resetear show_filter_modal.
     * @returns {void}
     */
    on_hidden() {
      this.open_local = false
      this.$emit('close')
    },
    /**
     * Propaga cierre por backdrop o botón X hacia el padre.
     * @param {boolean} visible
     * @returns {void}
     */
    on_show_update(visible) {
      this.open_local = visible
      if (!visible) {
        this.$emit('close')
      }
    },
    on_add_only() {
      this.$emit('add', this.build_payload())
      this.on_hidden()
    },
    /**
     * Aplica filtro y cierra sincronizando estado con ResourceView.
     * @returns {void}
     */
    on_filter() {
      this.$emit('add-and-run', this.build_payload())
      this.on_hidden()
    },
    /**
     * Arma el payload del filtro normalizando tipos que el backend trata como select.
     * @returns {Object}
     */
    build_payload() {
      const payload = Object.assign({}, this.draft)
      if (payload.type === 'pipeline_status') {
        payload.type = 'select'
      }
      return payload
    },
    /**
     * Enfoca el control del campo activo tras abrir el modal.
     * BaseModal usa teleport: no se puede buscar el input en this.$el.
     * @returns {void}
     */
    focus_active_field_input() {
      const self = this
      this.$nextTick(function () {
        // breve espera para que termine el render teletransportado del modal
        setTimeout(function () {
          const field = self.$refs.active_field
          if (field && typeof field.focus_input === 'function') {
            field.focus_input()
          }
        }, 150)
      })
    },
  },
}
</script>
