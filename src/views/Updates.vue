<template>
  <resource-view
    model_name="update"
    :model_extra_tabs="model_extra_tabs"
    @extra-record-updated="on_record_updated"
  />
</template>

<script>
import { markRaw } from 'vue'
import ResourceView from '@/common-vue/components/view/Index.vue'
import UpdateExtraProps from '@/components/update/extra-props/Index.vue'

/**
 * Pestaña extra del modal de actualizaciones (pasos, seeders, comandos, etc.).
 */
const update_model_extra_tabs = [
  {
    key: 'operations',
    label: 'Operaciones',
    component: markRaw(UpdateExtraProps),
  },
]

export default {
  name: 'ViewUpdates',
  components: { ResourceView, UpdateExtraProps },
  data() {
    return {
      /** Pestañas del modal CRUD además del grupo Básico del meta. */
      model_extra_tabs: update_model_extra_tabs,
    }
  },
  methods: {
    /**
     * Sincroniza en la tabla los cambios devueltos por acciones de la pestaña Operaciones.
     * @param {Object} model ClientVersionUpgrade actualizado en backend.
     * @returns {void}
     */
    on_record_updated(model) {
      this.$store.dispatch('update/upsert_model_in_lists', model)
    },
  },
}
</script>
