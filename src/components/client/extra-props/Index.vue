<template>
  <div v-if="record && record.id">
    <div v-if="!record.implementation" class="mb-0">
      <button
        type="button"
        class="btn btn-sm btn-primary"
        :disabled="loading_action !== ''"
        @click="start_implementation"
      >
        {{ loading_action === 'start_implementation' ? 'Iniciando...' : 'Iniciar implementación' }}
      </button>
    </div>
    <div v-else class="mb-0">
      <span class="badge" :class="implementation_badge_class">{{ implementation_badge_text }}</span>
    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'
import { route_string } from '@/utils/route_string'

export default {
  name: 'ClientImplementationExtraProps',
  props: {
    /**
     * Cliente en edición: en el modal CRUD es el borrador (`draft`) del ModelModal.
     */
    record: { type: Object, default: null },
  },
  emits: ['record-updated'],
  data() {
    return {
      /**
       * Acción en curso para deshabilitar el botón y mostrar feedback.
       */
      loading_action: '',
    }
  },
  computed: {
    /**
     * Texto del badge cuando ya existe implementación: "Etapa X — [estado legible]".
     * @returns {string}
     */
    implementation_badge_text() {
      if (!this.record || !this.record.implementation) {
        return ''
      }
      /** Etapa actual del flujo. */
      var stage_number = this.record.implementation.current_stage || 1
      /** Estado global traducido para operadores. */
      var status_label = this.status_label(this.record.implementation.status)
      return 'Etapa ' + stage_number + ' — ' + status_label
    },
    /**
     * Clase Bootstrap del badge según el estado de la implementación.
     * @returns {string}
     */
    implementation_badge_class() {
      if (!this.record || !this.record.implementation) {
        return 'bg-secondary'
      }
      /** Mapa de clases por status del backend. */
      var status = (this.record.implementation.status || 'pending').toString()
      if (status === 'in_progress') {
        return 'bg-primary'
      }
      if (status === 'completed') {
        return 'bg-success'
      }
      if (status === 'paused') {
        return 'bg-warning text-dark'
      }
      return 'bg-secondary'
    },
  },
  methods: {
    /**
     * Muestra un toast global si existe, con fallback a alert.
     * @param {string} message mensaje de feedback para el usuario.
     * @returns {void}
     */
    open_feedback(message) {
      if (this.$root && this.$root.$emit) {
        this.$root.$emit('open_toast', message)
        return
      }
      alert(message)
    },
    /**
     * Normaliza el mensaje de error de axios para mostrar en UI.
     * @param {any} error error capturado.
     * @returns {string}
     */
    get_error_message(error) {
      if (error && error.response && error.response.data && error.response.data.message) {
        return error.response.data.message
      }
      return 'Ocurrió un error inesperado.'
    },
    /**
     * Traduce el status de la implementación a texto legible en español.
     * @param {string|null} status valor del backend.
     * @returns {string}
     */
    status_label(status) {
      /** Mapa status → etiqueta para operadores. */
      var labels = {
        in_progress: 'En curso',
        completed: 'Completada',
        paused: 'Pausada',
        pending: 'Pendiente',
      }
      return labels[status] || 'Pendiente'
    },
    /**
     * Ejecuta una acción remota con manejo uniforme de estado y errores.
     * @param {string} action_name nombre de acción para spinner.
     * @param {Function} callback función que retorna promise.
     * @param {string} success_message mensaje de éxito.
     * @returns {void}
     */
    run_action(action_name, callback, success_message) {
      const self = this
      self.loading_action = action_name
      callback()
        .then(function (response) {
          /** Payload del endpoint start: { model: Implementation con stages y client }. */
          var payload = response && response.data ? response.data : {}
          if (payload.model) {
            self.record.implementation = payload.model
            self.$emit('record-updated', self.record)
          }
          self.open_feedback(success_message)
        })
        .catch(function (error) {
          self.open_feedback(self.get_error_message(error))
        })
        .then(function () {
          self.loading_action = ''
        })
    },
    /**
     * Inicia la implementación del cliente tras confirmación del operador.
     * @returns {void}
     */
    start_implementation() {
      const self = this
      if (!self.record || !self.record.id) {
        return
      }
      if (!window.confirm('¿Iniciás la implementación para este cliente?')) {
        return
      }
      self.run_action(
        'start_implementation',
        function () {
          return api.post(
            route_string('client/' + self.record.id + '/implementation/start')
          )
        },
        'Implementación iniciada correctamente.'
      )
    },
  },
}
</script>
