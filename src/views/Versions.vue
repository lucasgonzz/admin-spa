<template>
  <resource-view model_name="version" :model_extra_tabs="model_extra_tabs" />
</template>

<script>
import { markRaw } from 'vue'
import ResourceView from '@/common-vue/components/view/Index.vue'
import VersionExtraProps from '@/components/version/extra-props/Index.vue'

/**
 * Pestaña extra del modal de versiones (seeders, comandos, tareas, notificaciones).
 * `markRaw` evita proxy de Vue 3 sobre el componente en `<component :is>`.
 */
const version_model_extra_tabs = [
  {
    key: 'nested',
    label: 'Seeders, comandos y notificaciones',
    component: markRaw(VersionExtraProps),
  },
]

export default {
  name: 'ViewVersions',
  components: { ResourceView, VersionExtraProps },
  data() {
    return {
      /** Pestañas del modal CRUD además del grupo Básico del meta. */
      model_extra_tabs: version_model_extra_tabs,
    }
  },
}
</script>
