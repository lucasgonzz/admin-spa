<template>
  <base-modal :show="open_local" :title="title" size="md" @update:show="open_local = $event" @close="on_hidden">
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
        v-else-if="field.type === 'date'"
        ref="active_field"
        :draft="draft"
        @filter="on_filter"
      />
      <filter-select
        v-else-if="field.type === 'select' || field.type === 'pipeline_status'"
        ref="active_field"
        :field="field"
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
      <column-filter-footer @add-only="on_add_only" @filter="on_filter" />
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
      } else if (t === 'date') {
        d.menor_que = ''
        d.igual_que = ''
        d.mayor_que = ''
      } else if (t === 'select') {
        d.igual_que = null
      } else if (t === 'search') {
        d.igual_que = ''
      } else if (t === 'checkbox') {
        d.checkbox = -1
      }
      this.draft = d
    },
    on_hidden() {
      this.$emit('close')
    },
    on_add_only() {
      this.$emit('add', this.build_payload())
      this.open_local = false
    },
    on_filter() {
      this.$emit('add-and-run', this.build_payload())
      this.open_local = false
    },
    build_payload() {
      return Object.assign({}, this.draft)
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
