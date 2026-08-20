<template>
  <div class="push-notifications-section">
    <p class="text-muted small mb-3">
      Activá las notificaciones push en <strong>este dispositivo</strong> para recibir avisos
      del sistema (leads, soporte, recordatorios) aunque la app esté cerrada. El permiso se pide
      una sola vez por dispositivo y queda asociado a tu cuenta. Funciona mejor con la app
      instalada como PWA en el teléfono.
    </p>

    <!-- Mientras se consulta el estado real (permiso + suscripción + backend). -->
    <div v-if="loading" class="d-flex align-items-center gap-2 text-muted small">
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
      Verificando el estado de las notificaciones…
    </div>

    <!-- El navegador no soporta Web Push (navegador viejo o contexto inseguro/HTTP). -->
    <div v-else-if="state === 'unsupported'" class="alert alert-secondary small mb-0">
      Este navegador no soporta notificaciones push. Probá instalando la app como PWA o usando
      un navegador actualizado sobre HTTPS.
    </div>

    <template v-else>
      <!-- Permiso concedido Y device registrado en el backend: el único caso en el que
           las notificaciones realmente van a llegar. -->
      <div v-if="state === 'registered'" class="d-flex align-items-center gap-2 flex-wrap">
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

      <!-- Permiso concedido pero el device NO quedó registrado en el servidor.
           Antes este caso mostraba el badge verde y el usuario no recibía nada. -->
      <div v-else-if="state === 'not_registered'" class="alert alert-warning small mb-0">
        <p class="mb-2">
          <strong>Atención:</strong> diste el permiso, pero este dispositivo no quedó registrado:
          no vas a recibir notificaciones.
        </p>
        <button
          type="button"
          class="btn btn-warning btn-sm"
          :disabled="working"
          @click="on_retry"
        >
          {{ working ? 'Reintentando…' : 'Reintentar registro' }}
        </button>
      </div>

      <!-- El usuario bloqueó el permiso en el navegador: no se puede re-pedir desde JS. -->
      <div v-else-if="state === 'denied'" class="alert alert-warning small mb-0">
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
      <div v-if="error_message" class="mt-3">
        <p class="text-danger small mb-1">{{ error_message }}</p>
        <!--
          El detalle técnico va en pantalla, no solo en la consola: esto se reporta desde un
          iPhone, donde no hay forma de abrir la consola. Sin esto, lo único que se puede leer
          es una frase escrita de antemano — que fue justo lo que hizo que el cartel dijera
          "instalá la PWA" a alguien que ya la tenía instalada.
        -->
        <details v-if="error_detail" class="small">
          <summary class="text-muted" style="cursor: pointer;">Ver detalle técnico</summary>
          <p class="text-muted font-monospace mt-1 mb-0" style="word-break: break-word;">
            {{ error_detail }}
          </p>
        </details>
      </div>
    </template>
  </div>
</template>

<script>
import {
  enable_push_notifications,
  disable_push_notifications,
  push_registration_status,
  running_as_installed_app,
  PUSH_STEPS,
} from '@/utils/push_notifications'

/**
 * Sección en Cuenta: activa/desactiva las notificaciones Web Push del device actual.
 *
 * El estado que se muestra es el REAL (permiso del navegador + suscripción del navegador +
 * fila en el backend), no solo el permiso: hasta el 11/8/2026 esta sección decía "Activadas
 * en este dispositivo" con solo mirar Notification.permission, así que cuando el guardado en
 * el servidor fallaba la interfaz afirmaba lo contrario de la realidad.
 *
 * Backend: GET /push/vapid-public-key, POST /push/subscribe, POST /push/unsubscribe,
 * POST /push/subscription-status.
 */
export default {
  name: 'PushNotificationsSection',
  data() {
    return {
      /** Estado real: 'unsupported' | 'denied' | 'default' | 'registered' | 'not_registered'. */
      state: 'default',
      /** true mientras se consulta el estado real al montar o después de una acción. */
      loading: true,
      /** Indica una operación de suscripción/desuscripción en curso. */
      working: false,
      /** Mensaje de éxito mostrado bajo el botón. */
      success_message: '',
      /** Mensaje de error mostrado bajo el botón. */
      error_message: '',
      /** Detalle técnico del error (nombre y mensaje del navegador), desplegable. */
      error_detail: '',
    }
  },
  mounted() {
    // Consulta el estado real para decidir qué control mostrar.
    this.refresh_state()
  },
  methods: {
    /**
     * Recalcula el estado real combinando permiso, suscripción del navegador y backend.
     *
     * @returns {Promise<void>}
     */
    refresh_state() {
      var self = this
      self.loading = true
      return push_registration_status()
        .then(function (status) {
          self.state = status.state
        })
        .catch(function () {
          // Si ni siquiera se pudo determinar el estado, mostrar el caso de atención:
          // es preferible ofrecer el reintento a afirmar que está todo bien.
          self.state = 'not_registered'
        })
        .then(function () {
          self.loading = false
        })
    },

    /**
     * Pide permiso y suscribe el device a Web Push, guardando la suscripción en el backend.
     */
    on_enable() {
      this.register('Notificaciones activadas en este dispositivo.')
    },

    /**
     * Reintenta el registro cuando el permiso ya está concedido pero el backend no tiene la fila.
     */
    on_retry() {
      this.register('Listo: este dispositivo quedó registrado.')
    },

    /**
     * Registro del device, compartido por el alta y el reintento.
     *
     * @param {string} success_text Mensaje a mostrar si sale bien.
     */
    register(success_text) {
      var self = this
      self.working = true
      self.success_message = ''
      self.error_message = ''
      self.error_detail = ''
      enable_push_notifications()
        .then(function () {
          self.success_message = success_text
        })
        .catch(function (error) {
          self.error_message = self.message_for_error(error)
          self.error_detail = (error && error.detail) ? error.detail : ''
          console.warn('[push] falló el registro', error)
        })
        .then(function () {
          // El estado se recalcula siempre, haya salido bien o mal: es la única forma de
          // que lo que se muestra sea lo que efectivamente quedó guardado.
          return self.refresh_state()
        })
        .then(function () {
          // Si el registro dijo que salió bien pero el estado real no lo confirma, gana el
          // estado real: mostrar "listo" arriba del cartel de atención es la misma clase de
          // mentira que este cambio vino a sacar.
          if (self.success_message && self.state !== 'registered') {
            self.success_message = ''
            self.error_message = 'El registro no quedó confirmado por el servidor. Probá de nuevo.'
          }
          self.working = false
        })
    },

    /**
     * Traduce el error de registro a un mensaje que diga EN QUÉ PASO falló.
     *
     * @param {Error} error Error lanzado por enable_push_notifications.
     * @returns {string}
     */
    message_for_error(error) {
      var step = error && error.step ? error.step : ''

      if (step === PUSH_STEPS.UNSUPPORTED) {
        return 'Este navegador no soporta notificaciones push.'
      }
      if (step === PUSH_STEPS.PERMISSION) {
        return 'No se activaron: falta el permiso de notificaciones del navegador. ' +
          'Si lo rechazaste, habilitalo desde la configuración del sitio y recargá.'
      }
      if (step === PUSH_STEPS.VAPID) {
        return error.message + ' No es un problema de tu teléfono: avisale al equipo de sistemas.'
      }
      if (step === PUSH_STEPS.SUBSCRIPTION) {
        /*
          Acá vivía el cartel que mandaba a instalar la PWA SIN HABER COMPROBADO si ya estaba
          instalada. Se le mostró a Lucas teniéndola en la pantalla de inicio del iPhone: lo mandó
          a resolver algo que ya estaba hecho, y tapó el problema real durante todo ese tiempo.
          Ahora la app lo comprueba, y solo lo dice cuando de verdad falta.
        */
        if (!running_as_installed_app()) {
          return 'El navegador no pudo crear la suscripción de este dispositivo. ' +
            'En iPhone hace falta abrir la app instalada desde la pantalla de inicio, ' +
            'no desde el navegador.'
        }
        return 'El navegador rechazó la suscripción de este dispositivo. ' +
          'Probá de nuevo; si vuelve a fallar, abrí el detalle técnico y pasáselo al equipo.'
      }
      if (step === PUSH_STEPS.BACKEND) {
        return 'El permiso quedó dado, pero el servidor no pudo guardar este dispositivo. ' +
          'Probá de nuevo; si sigue fallando, avisale al equipo de sistemas.'
      }
      return 'Ocurrió un error al activar las notificaciones. Probá de nuevo.'
    },

    /**
     * Revoca la suscripción del device actual (navegador + backend).
     */
    on_disable() {
      var self = this
      self.working = true
      self.success_message = ''
      self.error_message = ''
      self.error_detail = ''
      disable_push_notifications()
        .then(function () {
          self.success_message = 'Notificaciones desactivadas en este dispositivo.'
        })
        .catch(function () {
          self.error_message = 'No se pudo desactivar la suscripción. Probá de nuevo.'
        })
        .then(function () {
          return self.refresh_state()
        })
        .then(function () {
          self.working = false
        })
    },
  },
}
</script>
