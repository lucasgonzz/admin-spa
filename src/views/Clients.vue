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
import ContratoTab from '@/components/client/ContratoTab.vue'
import LicenciasTab from '@/components/client/LicenciasTab.vue'
import ClientScheduleTab from '@/components/client/ScheduleTab.vue'
import ClientTokensTab from '@/components/client/TokensTab.vue'

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
        {
          /* Contrato del cliente (misión modulo-cobranzas, 18/9/2026): hasta ahora vivía solo en
             el lead; al promoverlo se copia acá y desde acá se edita y se genera el PDF. */
          key: 'contrato',
          label: 'Contrato',
          component: markRaw(ContratoTab),
        },
        {
          /* Cuotas de la licencia (misma misión): monto y mes de cada cuota del contrato, con
             pagos parciales. Es la otra mitad de la plata del cliente, junto a Mensualidad. */
          key: 'licencias',
          label: 'Licencias',
          component: markRaw(LicenciasTab),
        },
        {
          key: 'horarios',
          label: 'Horarios',
          component: markRaw(ClientScheduleTab),
        },
        {
          /* Consumo de IA de este cliente (misión tokens-por-cliente, 17/9/2026): cuánto gastó,
             por día y por acción, con el costo estimado en dólares. */
          key: 'tokens',
          label: 'Tokens',
          component: markRaw(ClientTokensTab),
        },
      ],
    }
  },
}
</script>
