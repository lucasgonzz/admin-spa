<template>
  <div class="support-alert-settings-section">
    <p class="text-muted small mb-3">
      Si un ticket abierto lleva más tiempo sin respuesta del operador, se muestra un badge en la bandeja
      y una notificación en tiempo real.
    </p>

    <div class="row g-2 align-items-end">
      <div class="col-sm-4">
        <label class="form-label small" for="support_alert_minutes">Tiempo límite de respuesta (minutos)</label>
        <input
          id="support_alert_minutes"
          v-model.number="local_value"
          type="number"
          min="5"
          max="1440"
          class="form-control form-control-sm"
          :disabled="loading || saving" />
      </div>
      <div class="col-auto">
        <button type="button" class="btn btn-primary btn-sm" :disabled="loading || saving || !can_save" @click="on_save">
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="text-muted small mt-2 mb-0">Cargando…</p>
    <p v-else-if="saved_message" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
    <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Sección en Cuenta: umbral de alertas por demora en respuesta de soporte.
 */
export default {
  name: 'SupportAlertSettingsSection',
  data() {
    return {
      /** Valor editable en el input. */
      local_value: 30,
      /** Valor persistido en servidor (para detectar cambios). */
      stored_value: 30,
      /** Carga inicial GET settings. */
      loading: true,
      /** PUT en curso. */
      saving: false,
      /** Mensaje de éxito tras guardar. */
      saved_message: '',
      /** Error de validación o API. */
      error_message: '',
    }
  },
  computed: {
    /**
     * Habilita guardar solo si el valor cambió y está en rango.
     *
     * @returns {boolean}
     */
    can_save() {
      const value = parseInt(this.local_value, 10)
      if (isNaN(value) || value < 5 || value > 1440) {
        return false
      }
      return value !== this.stored_value
    },
  },
  mounted() {
    this.load_setting()
  },
  methods: {
    /**
     * GET /settings/support-alert-minutes.
     *
     * @returns {void}
     */
    load_setting() {
      const self = this
      self.loading = true
      self.error_message = ''
      api
        .get('/settings/support-alert-minutes')
        .then(function (res) {
          const value = parseInt(res.data && res.data.value, 10)
          if (!isNaN(value)) {
            self.local_value = value
            self.stored_value = value
          }
        })
        .catch(function () {
          self.error_message = 'No se pudo cargar la configuración.'
        })
        .then(function () {
          self.loading = false
        })
    },
    /**
     * PUT /settings/support-alert-minutes con validación 5–1440.
     *
     * @returns {void}
     */
    on_save() {
      const self = this
      const value = parseInt(self.local_value, 10)
      if (isNaN(value) || value < 5 || value > 1440) {
        self.error_message = 'El valor debe estar entre 5 y 1440 minutos.'
        return
      }
      self.saving = true
      self.saved_message = ''
      self.error_message = ''
      api
        .put('/settings/support-alert-minutes', { value: value })
        .then(function (res) {
          const saved = parseInt(res.data && res.data.value, 10)
          if (!isNaN(saved)) {
            self.local_value = saved
            self.stored_value = saved
          }
          self.saved_message = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_message = msg
        })
        .then(function () {
          self.saving = false
        })
    },
  },
}
</script>
