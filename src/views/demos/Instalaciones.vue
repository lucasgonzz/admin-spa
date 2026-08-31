<template>
  <div class="demos-instalaciones-view container-fluid px-0 py-4">

    <!-- Encabezado del submódulo -->
    <div class="mb-3">
      <h4 class="mb-0">Instalaciones de demos</h4>
      <p class="text-muted small mb-0 mt-1">
        Instalación desde cero de una demo: el sistema (ERP) y la tienda, cada uno con su pipeline.
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
    <demo-system-installations v-if="active_tab === 'sistema'" />
    <demo-ecommerce-runs v-else mode="install" />

  </div>
</template>

<script>
import DemoSystemInstallations from '@/components/demo_installation/DemoSystemInstallations.vue'
import DemoEcommerceRuns from '@/components/demo_installation/DemoEcommerceRuns.vue'

/**
 * Demos > Instalaciones: instalar desde cero una demo, con dos pestañas.
 *
 * - Sistema: el ERP de la demo (empresa-spa + empresa-api). Pipeline propio, DemoInstallation.
 * - Ecommerce: la tienda de la demo (tienda-spa + tienda-api). Reusa el pipeline de clientes,
 *   que después de polimorfizar el dueño del ClientEcommerce ya no sabe si es cliente o demo.
 */
export default {
  name: 'ViewDemosInstalaciones',

  components: {
    DemoSystemInstallations,
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
