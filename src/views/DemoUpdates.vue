<template>
  <resource-view
    model_name="demo_update"
    resource_api_path="demo-update"
    :model_extra_tabs="model_extra_tabs"
    @extra-record-updated="on_record_updated"
  />
</template>

<script>
import { markRaw } from 'vue'
import ResourceView from '@/common-vue/components/view/Index.vue'
import DemoUpdateExtraProps from '@/components/demo_update/extra-props/Index.vue'

/**
 * Pestaña extra del modal de actualizaciones de demo (log en vivo + checklist).
 */
const demo_update_model_extra_tabs = [
  {
    key: 'operations',
    label: 'Operaciones',
    component: markRaw(DemoUpdateExtraProps),
  },
]

export default {
  name: 'ViewDemoUpdates',

  components: { ResourceView },

  data() {
    return {
      /** Pestañas del modal CRUD además del grupo Básico del meta. */
      model_extra_tabs: demo_update_model_extra_tabs,
    }
  },

  methods: {
    /**
     * Sincroniza en la tabla los cambios devueltos por el polling de la pestaña Operaciones.
     *
     * @param {Object} model  DemoUpdate actualizado en backend.
     * @returns {void}
     */
    on_record_updated(model) {
      this.$store.dispatch('demo_update/upsert_model_in_lists', model)
    },
  },
}
</script>
