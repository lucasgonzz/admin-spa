<template>
  <resource-view
    model_name="client"
    :model_extra_tabs="model_extra_tabs"
  />
</template>

<script>
import { markRaw } from 'vue'
import ResourceView from '@/common-vue/components/view/Index.vue'
import ClientInstallationsTab from '@/components/client/InstallationsTab.vue'
import EcommerceImplementationTab from '@/components/client/EcommerceImplementationTab.vue'
import MensualidadTab from '@/components/client/MensualidadTab.vue'

/**
 * Vista principal de clientes.
 *
 * Agrega una pestaña extra "Instalaciones" en el modal de detalle de cada cliente,
 * que permite navegar al pipeline de instalación inicial del sistema.
 */
export default {
  name: 'ViewClients',
  components: { ResourceView },
  data() {
    return {
      /**
       * Pestañas extra que se muestran en el modal de detalle del cliente
       * además de las generadas por el meta del modelo.
       */
      model_extra_tabs: [
        {
          key: 'installations',
          label: 'Instalaciones',
          component: markRaw(ClientInstallationsTab),
        },
        {
          key: 'ecommerce',
          label: 'Ecommerce',
          component: markRaw(EcommerceImplementationTab),
        },
        {
          key: 'mensualidad',
          label: 'Mensualidad',
          component: markRaw(MensualidadTab),
        },
      ],
    }
  },
}
</script>
