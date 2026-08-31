<template>
  <div class="demos-actualizaciones-view container-fluid px-0 py-4">

    <!-- Encabezado del submódulo -->
    <div class="mb-3">
      <h4 class="mb-0">Actualizaciones de demos</h4>
      <p class="text-muted small mb-0 mt-1">
        Actualización de una demo ya instalada: el sistema (ERP) y la tienda, cada uno con su
        pipeline. Ninguna de las dos toca los datos cargados en la demo.
      </p>
    </div>

    <!-- Pestañas Sistema / Ecommerce. flex-wrap: en teléfono no entran las dos en una línea. -->
    <ul class="nav nav-tabs flex-wrap mb-3" role="tablist">
      <li v-for="tab in tabs" :key="tab.key" class="nav-item" role="presentation">
        <button
          type="button"
          class="nav-link py-2"
          :class="{ active: active_tab === tab.key }"
          role="tab"
          :aria-selected="active_tab === tab.key"
          @click="active_tab = tab.key"
        >
          {{ tab.label }}
        </button>
      </li>
    </ul>

    <!--
      v-if y no v-show: cada panel hace su propio polling y su propio pedido inicial. Con v-show,
      la pestaña que no se está mirando seguiría poleando en segundo plano.
    -->
    <demo-updates v-if="active_tab === 'sistema'" />
    <demo-ecommerce-runs v-else mode="update" />

  </div>
</template>

<script>
import DemoUpdates from '@/views/DemoUpdates.vue'
import DemoEcommerceRuns from '@/components/demo_installation/DemoEcommerceRuns.vue'

/**
 * Demos > Actualizaciones: actualizar una demo ya instalada, con dos pestañas.
 *
 * - Sistema: es literalmente `DemoUpdates.vue`, la ex pantalla "Actualizaciones > Demo", montada
 *   acá como componente. No se duplicó ni se movió a propósito: sigue siendo la misma pantalla
 *   con el mismo CRUD y el mismo panel de operaciones, solo que ahora vive adentro del módulo
 *   Demos. La ruta vieja `/actualizaciones/demo` quedó como redirect a esta pantalla.
 * - Ecommerce: la tienda de la demo, reusando el pipeline de clientes sobre un ClientEcommerce
 *   cuyo dueño es la demo.
 */
export default {
  name: 'ViewDemosActualizaciones',

  components: {
    DemoUpdates,
    DemoEcommerceRuns,
  },

  data() {
    return {
      /** Pestaña visible. */
      active_tab: 'sistema',

      /** Definición de las pestañas del submódulo. */
      tabs: [
        { key: 'sistema', label: 'Sistema' },
        { key: 'ecommerce', label: 'Ecommerce' },
      ],
    }
  },
}
</script>
