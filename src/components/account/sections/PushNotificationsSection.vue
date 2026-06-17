<template>
  <div class="push-notifications-section">
    <p class="text-muted small mb-3">
      Activá las notificaciones push en <strong>este dispositivo</strong> para recibir avisos
      del sistema (leads, soporte, recordatorios) aunque la app esté cerrada. El permiso se pide
      una sola vez por dispositivo y queda asociado a tu cuenta. Funciona mejor con la app
      instalada como PWA en el teléfono.
    </p>

    <!-- El navegador no soporta Web Push (navegador viejo o contexto inseguro/HTTP). -->
    <div v-if="status === 'unsupported'" class="alert alert-secondary small mb-0">
      Este navegador no soporta notificaciones push. Probá instalando la app como PWA o usando
      un navegador actualizado sobre HTTPS.
    </div>

    <template v-else>
      <!-- Notificaciones ya activadas en este device. -->
      <div v-if="status === 'granted'" class="d-flex align-items-center gap-2 flex-wrap">
        <span class="badge text-bg-success">✓ Activadas en este dispositivo</span>
        <button
          type="button"
          class="btn btn-outline-danger btn-sm"
          :disabled="working"
          @click="on_disable"
        >
          {{ working ? 'Procesando…' : 'Desactivar en este dispositivo' }}
        </button>
      </div>

      <!-- El usuario bloqueó el permiso en el navegador: no se puede re-pedir desde JS. -->
      <div v-else-if="status === 'denied'" class="alert alert-warning small mb-0">
        Las notificaciones están bloqueadas en la configuración del navegador para este sitio.
        Para activarlas, habilitá los permisos de notificaciones de este sitio desde el navegador
        y recargá la página.
      </div>

      <!-- Permiso aún no solicitado: botón para activarlo. -->
      <button
        v-else
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="working"
        @click="on_enable"
      >
        {{ working ? 'Activando…' : 'Activar notificaciones en este dispositivo' }}
      </button>

      <!-- Mensajes de resultado. -->
      <p v-if="success_message" class="text-success small mt-3 mb-0">{{ success_message }}</p>
      <p v-if="error_message" class="text-danger small mt-3 mb-0">{{ error_message }}</p>
    </template>
  </div>
</template>

<script>
import {
  enable_push_notifications,
  disable_push_notifications,
  push_permission_status,
} from '@/utils/push_notifications'

/**
 * Sección en Cuenta: activa/desactiva las notificaciones Web Push del device actual.
 *
 * Backend: GET /push/vapid-public-key, POST /push/subscribe, POST /push/unsubscribe.
 */
export default {
  name: 'PushNotificationsSection',
  data() {
    return {
      /** Estado del permiso del navegador: 'unsupported' | 'granted' | 'denied' | 'default'. */
      status: 'default',
      /** Indica una operación de suscripción/desuscripción en curso. */
      working: false,
      /** Mensaje de éxito mostrado bajo el botón. */
      success_message: '',
      /** Mensaje de error mostrado bajo el botón. */
      error_message: '',
    }
  },
  mounted() {
    // Lee el estado inicial del permiso para decidir qué control mostrar.
    this.status = push_permission_status()
  },
  methods: {
    /**
     * Pide permiso y suscribe el device a Web Push, guardando la suscripción en el backend.
     */
    on_enable() {
      var self = this
      self.working = true
      self.success_message = ''
      self.error_message = ''
      enable_push_notifications()
        .then(function (subscribed) {
          // Refresca el estado del permiso (granted/denied) tras la respuesta del navegador.
          self.status = push_permission_status()
          if (subscribed) {
            self.success_message = 'Notificaciones activadas en este dispositivo.'
          } else if (self.status === 'denied') {
            self.error_message = 'Rechazaste el permiso de notificaciones en el navegador.'
          } else {
            self.error_message = 'No se pudieron activar las notificaciones en este navegador.'
          }
        })
        .catch(function () {
          self.status = push_permission_status()
          self.error_message = 'Ocurrió un error al activar las notificaciones. Probá de nuevo.'
        })
        .then(function () {
          self.working = false
        })
    },

    /**
     * Revoca la suscripción del device actual (navegador + backend).
     */
    on_disable() {
      var self = this
      self.working = true
      self.success_message = ''
      self.error_message = ''
      disable_push_notifications()
        .then(function () {
          self.success_message = 'Notificaciones desactivadas en este dispositivo.'
        })
        .catch(function () {
          self.error_message = 'No se pudo desactivar la suscripción. Probá de nuevo.'
        })
        .then(function () {
          self.working = false
        })
    },
  },
}
</script>
