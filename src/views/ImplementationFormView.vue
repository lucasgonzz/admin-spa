<template>
  <!-- Wrapper de la ruta pública /configuracion/:token -->
  <!-- No incluye navbar ni sidebar del admin; pantalla completa para el cliente -->
  <div class="implementation-form-view">
    <formulario-view />
  </div>
</template>

<script>
import FormularioView from '@/components/formulario/FormularioView.vue'

/**
 * Vista wrapper para la ruta pública del formulario de configuración inicial.
 * Es intencional que no tenga el layout del admin (sin navbar, sin sidebar).
 * Renderiza directamente FormularioView que gestiona todo el estado del formulario.
 */
export default {
  name: 'ImplementationFormView',

  components: {
    FormularioView,
  },
}
</script>

<style scoped>
/* Pantalla completa sin contenedor extra */
.implementation-form-view {
  min-height: 100vh;
  background: #f8f9fa;
}
</style>
