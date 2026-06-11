<template>
  <div class="p-3">
    <h6 class="text-muted mb-2">Instalaciones del sistema</h6>
    <p class="small text-muted mb-3">
      Gestión del pipeline de instalación inicial del sistema para este cliente.
      Desde aquí podés crear, configurar e iniciar una instalación.
    </p>

    <!-- Botón que navega a la vista de instalaciones del cliente -->
    <router-link
      v-if="record && record.id"
      :to="{ name: 'client_installations', params: { clientId: record.id } }"
      class="btn btn-outline-primary btn-sm"
    >
      Ver instalaciones →
    </router-link>

    <p v-else class="text-muted small fst-italic">
      Guardá el cliente primero para acceder a sus instalaciones.
    </p>
  </div>
</template>

<script>
/**
 * Pestaña extra del modal de cliente que muestra un acceso directo a las instalaciones.
 *
 * Recibe el prop `record` del ResourceView (el modelo del cliente en edición).
 */
export default {
  name: 'ClientInstallationsTab',
  props: {
    /** Modelo del cliente actualmente abierto en el modal de ResourceView. */
    record: { type: Object, default: null },
  },
}
</script>
