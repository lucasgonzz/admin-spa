<template>
  <!-- Wrapper de la ruta pública /configuracion/:token -->
  <!-- Pantalla completa sin layout del admin (sin navbar ni sidebar) -->
  <div class="implementation-form-view">
    <formulario-view />
  </div>
</template>

<script>
import FormularioView from '@/components/formulario/FormularioView.vue'

/**
 * Vista wrapper para la ruta pública del formulario de configuración inicial.
 * El layout admin se oculta vía meta.public en App.vue; aquí solo se asegura
 * que el formulario ocupe toda la pantalla con fondo coherente.
 */
export default {
  name: 'ImplementationFormView',

  components: {
    FormularioView,
  },
}
</script>

<style scoped>
/* Pantalla completa con fondo alineado al formulario */
.implementation-form-view {
  min-height: 100vh;
  width: 100%;
  background: linear-gradient(180deg, #eef2ff 0%, #f8f9fc 45%, #f0f4f8 100%);
}
</style>
