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
import ClientImagenesTab from '@/components/client/imagenes/Index.vue'
import ClientCandadoSesionTab from '@/components/client/CandadoSesionTab.vue'
import ClientModelosIaTab from '@/components/client/ModelosIaTab.vue'
import SubjectPipelinesTab from '@/components/pipeline/SubjectPipelinesTab.vue'

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
        {
          /* Registro de las consultas de imágenes de este cliente (misión
             imagenes-catalogo-completo, 27/9/2026): cada búsqueda de imágenes (Serper / Google) y
             cada validación con IA, con su costo. Va al lado de Tokens porque son las dos solapas
             de plata de la IA. A diferencia de Tokens, le pregunta EN VIVO al sistema del cliente
             al abrirse (no hay espejo local), y como el modal monta las solapas recién cuando se
             abren, esa consulta no sale si nadie entra acá. */
          key: 'imagenes',
          label: 'Imágenes',
          component: markRaw(ClientImagenesTab),
        },
        {
          /* Modelos de IA por tarea (misión modelos-ia-por-cliente, 30/9/2026): qué modelo usa el
             cliente para el asistente, el WhatsApp, la verificación de imágenes y la importación de
             Excel. Como Imágenes, le pregunta EN VIVO al sistema del cliente al abrirse y no guarda
             nada en el admin (decisión de Lucas: gana el último entre el admin y el modal del
             dueño). Va al lado de Tokens e Imágenes: las tres son de IA. */
          key: 'ia',
          label: 'Inteligencia artificial',
          component: markRaw(ClientModelosIaTab),
        },
        {
          /* Candado de sesión por pestaña (misión candado-sesion-por-pestana, 19/9/2026): mismo
             criterio que Horarios y Tokens (pestaña propia porque hay un push a empresa-api y un
             estado de sincronización para mostrar), no un checkbox más del formulario genérico. */
          key: 'candado-sesion',
          label: 'Candado de sesión',
          component: markRaw(ClientCandadoSesionTab),
        },
        {
          /* Oportunidades del cliente en los pipelines del CRM (misión pipelines-crm, 27/9/2026):
             en qué etapa está de cada campaña, su historial y "Agregar a un pipeline". La pestaña
             deduce que el sujeto es un cliente del `model_name` que le pasa el modal. */
          key: 'pipelines',
          label: 'Pipelines',
          component: markRaw(SubjectPipelinesTab),
        },
      ],
    }
  },
}
</script>
