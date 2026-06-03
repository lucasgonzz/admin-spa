<template>
  <div class="support-ai-settings-section">
    <div class="form-check mb-3">
      <input
        id="support_ai_suggestions_enabled"
        v-model="local_suggestions_enabled"
        class="form-check-input"
        type="checkbox"
        :disabled="loading || saving" />
      <label class="form-check-label small" for="support_ai_suggestions_enabled">
        Activar sugerencias automáticas de IA para soporte
      </label>
    </div>
    <p class="text-muted small mb-3">
      Cuando está activado, cada mensaje nuevo de un cliente por WhatsApp se envía automáticamente a Claude
      para obtener una sugerencia de respuesta.
    </p>

    <div v-if="local_suggestions_enabled" class="row g-2 align-items-end">
      <div class="col-sm-4">
        <label class="form-label small" for="support_ai_auto_send_delay">
          Tiempo de espera antes de enviar (segundos)
        </label>
        <input
          id="support_ai_auto_send_delay"
          v-model.number="local_auto_send_delay"
          type="number"
          min="0"
          max="3600"
          class="form-control form-control-sm"
          :disabled="loading || saving" />
      </div>
      <div class="col-auto">
        <button type="button" class="btn btn-primary btn-sm" :disabled="loading || saving || !can_save" @click="on_save">
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </div>

    <div v-else class="mb-2">
      <button type="button" class="btn btn-primary btn-sm" :disabled="loading || saving || !can_save" @click="on_save">
        {{ saving ? 'Guardando…' : 'Guardar' }}
      </button>
    </div>

    <p v-if="local_suggestions_enabled" class="form-text small text-muted mb-2">
      0 = Claude responde automáticamente sin intervención humana. Mayor a 0 = el operador tiene ese tiempo para
      revisar y editar antes de que se envíe. Si el operador responde manualmente antes de que se cumpla el tiempo,
      se cancela el envío automático.
    </p>

    <p v-if="loading" class="text-muted small mt-2 mb-0">Cargando…</p>
    <p v-else-if="saved_message" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
    <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Sección en Cuenta: sugerencias IA automáticas y demora de envío en soporte WhatsApp.
 */
export default {
  name: 'SupportAiSettingsSection',
  data() {
    return {
      /** Checkbox: sugerencias automáticas activas. */
      local_suggestions_enabled: false,
      /** Segundos antes del envío automático (0 = inmediato). */
      local_auto_send_delay: 0,
      /** Valores persistidos en servidor. */
      stored_suggestions_enabled: false,
      stored_auto_send_delay: 0,
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
     * Habilita guardar solo si hubo cambios y el delay está en rango cuando aplica.
     *
     * @returns {boolean}
     */
    can_save() {
      if (this.local_suggestions_enabled !== this.stored_suggestions_enabled) {
        if (!this.local_suggestions_enabled) {
          return true
        }
        return this.is_delay_valid()
      }
      if (!this.local_suggestions_enabled) {
        return false
      }
      if (this.local_auto_send_delay !== this.stored_auto_send_delay) {
        return this.is_delay_valid()
      }
      return false
    },
  },
  mounted() {
    this.load_setting()
  },
  methods: {
    /**
     * Valida delay entre 0 y 3600.
     *
     * @returns {boolean}
     */
    is_delay_valid() {
      const value = parseInt(this.local_auto_send_delay, 10)
      return !isNaN(value) && value >= 0 && value <= 3600
    },
    /**
     * GET /settings/support-ai.
     *
     * @returns {void}
     */
    load_setting() {
      const self = this
      self.loading = true
      self.error_message = ''
      api
        .get('/settings/support-ai')
        .then(function (res) {
          const data = res.data || {}
          const enabled = !!data.suggestions_enabled
          const delay = parseInt(data.auto_send_delay, 10)
          self.local_suggestions_enabled = enabled
          self.stored_suggestions_enabled = enabled
          if (!isNaN(delay)) {
            self.local_auto_send_delay = delay
            self.stored_auto_send_delay = delay
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
     * PUT /settings/support-ai.
     *
     * @returns {void}
     */
    on_save() {
      const self = this
      const delay = parseInt(self.local_auto_send_delay, 10)
      if (self.local_suggestions_enabled && (isNaN(delay) || delay < 0 || delay > 3600)) {
        self.error_message = 'El tiempo de espera debe estar entre 0 y 3600 segundos.'
        return
      }
      self.saving = true
      self.saved_message = ''
      self.error_message = ''
      api
        .put('/settings/support-ai', {
          suggestions_enabled: self.local_suggestions_enabled,
          auto_send_delay: self.local_suggestions_enabled ? delay : self.stored_auto_send_delay,
        })
        .then(function (res) {
          const data = res.data || {}
          self.local_suggestions_enabled = !!data.suggestions_enabled
          self.stored_suggestions_enabled = self.local_suggestions_enabled
          const saved_delay = parseInt(data.auto_send_delay, 10)
          if (!isNaN(saved_delay)) {
            self.local_auto_send_delay = saved_delay
            self.stored_auto_send_delay = saved_delay
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
