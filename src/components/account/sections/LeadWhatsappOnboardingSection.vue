<template>
  <div class="lead-whatsapp-onboarding-section">
    <p class="text-muted small mb-3">
      Cuando un lead nuevo escribe por WhatsApp, el sistema envía primero el mensaje automático (respuesta
      inmediata) y, tras la demora configurada, el mensaje de bienvenida con la presentación de ComercioCity.
      Tras la segunda respuesta del lead, la sugerencia de Claude se pide tras la demora de sugerencia IA
      (cada mensaje nuevo reinicia el contador; 0 = consulta inmediata). Si el setter no pulsa Enviar,
      el mensaje sugerido se manda por WhatsApp tras la demora de confirmación automática (0 = envío inmediato).
      Usá <code>{{ placeholder_nombre }}</code> en las variantes «con nombre» para personalizar el saludo.
    </p>

    <div v-if="loading" class="text-muted small">Cargando…</div>

    <template v-else>
      <div class="mb-3">
        <label class="form-label small fw-semibold" for="lead_auto_with_name">Mensaje automático (con nombre)</label>
        <textarea
          id="lead_auto_with_name"
          v-model="form.auto_message_with_name"
          class="form-control form-control-sm"
          rows="2"
          :disabled="saving"
          @input="on_input_change"
        />
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold" for="lead_auto_without_name">Mensaje automático (sin nombre)</label>
        <textarea
          id="lead_auto_without_name"
          v-model="form.auto_message_without_name"
          class="form-control form-control-sm"
          rows="2"
          :disabled="saving"
          @input="on_input_change"
        />
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold" for="lead_ai_suggestion_delay">Demora antes de pedir sugerencia IA (segundos)</label>
        <input
          id="lead_ai_suggestion_delay"
          v-model.number="form.ai_suggestion_delay_seconds"
          type="number"
          class="form-control form-control-sm"
          style="max-width: 8rem"
          :min="ai_suggestion_delay_min"
          :max="ai_suggestion_delay_max"
          :disabled="saving"
          @input="on_input_change"
        />
        <p class="form-text small text-muted mb-0">
          Tras el 2.º mensaje del lead: espera este tiempo sin nuevos mensajes antes de llamar a Claude.
          Entre {{ ai_suggestion_delay_min }} y {{ ai_suggestion_delay_max }} segundos (por defecto 60).
          0 = consulta a Claude de inmediato tras el último mensaje. Cada mensaje nuevo del lead reinicia el contador.
        </p>
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold" for="lead_ai_auto_send_delay">Demora antes de enviar sugerencia sin confirmar (segundos)</label>
        <input
          id="lead_ai_auto_send_delay"
          v-model.number="form.ai_suggestion_auto_send_delay_seconds"
          type="number"
          class="form-control form-control-sm"
          style="max-width: 8rem"
          :min="auto_send_delay_min"
          :max="auto_send_delay_max"
          :disabled="saving"
          @input="on_input_change"
        />
        <p class="form-text small text-muted mb-0">
          Tras generar la sugerencia de Claude: si el setter no envía manualmente, se manda por WhatsApp al vencer este tiempo.
          Entre {{ auto_send_delay_min }} y {{ auto_send_delay_max }} segundos (por defecto 120).
          0 = envío automático inmediato sin espera del setter.
          No aplica a sugerencias que requieren verificación ni a seguimientos automáticos.
        </p>
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold" for="lead_verificacion_agendamiento_auto_send_delay">
          Demora antes de auto-enviar en el tramo de agendamiento (minutos)
        </label>
        <input
          id="lead_verificacion_agendamiento_auto_send_delay"
          v-model.number="form.verificacion_agendamiento_auto_send_delay_minutes"
          type="number"
          class="form-control form-control-sm"
          style="max-width: 8rem"
          :min="verificacion_agendamiento_auto_send_delay_min"
          :disabled="saving"
          @input="on_input_change"
        />
        <p class="form-text small text-muted mb-0">
          Desde que un lead entra a coordinar la agenda de la demo (solicita disponibilidad, demo agendada, ingresando a
          demo, demo en curso, demo pendiente de terminar) hasta closer activo, todo mensaje de Claude requiere
          verificación de Martín antes de salir. Si nadie lo revisa, se manda igual al vencer este tiempo — para no
          dejar a un lead esperando horas. Mínimo {{ verificacion_agendamiento_auto_send_delay_min }} minutos
          (por defecto 30). Sin límite superior.
        </p>
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold" for="lead_welcome_delay">Demora antes del mensaje de bienvenida (segundos)</label>
        <input
          id="lead_welcome_delay"
          v-model.number="form.welcome_delay_seconds"
          type="number"
          class="form-control form-control-sm"
          style="max-width: 8rem"
          :min="delay_min"
          :max="delay_max"
          :disabled="saving"
          @input="on_input_change"
        />
        <p class="form-text small text-muted mb-0">
          Entre {{ delay_min }} y {{ delay_max }} segundos (por defecto 60).
          0 = envío inmediato del mensaje de bienvenida tras el automático.
        </p>
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold" for="lead_welcome_with_name">Mensaje de bienvenida (con nombre)</label>
        <textarea
          id="lead_welcome_with_name"
          v-model="form.welcome_message_with_name"
          class="form-control form-control-sm"
          rows="6"
          :disabled="saving"
          @input="on_input_change"
        />
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold" for="lead_welcome_without_name">Mensaje de bienvenida (sin nombre)</label>
        <textarea
          id="lead_welcome_without_name"
          v-model="form.welcome_message_without_name"
          class="form-control form-control-sm"
          rows="6"
          :disabled="saving"
          @input="on_input_change"
        />
      </div>

      <button
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="saving || !can_save"
        @click="on_save"
      >
        {{ saving ? 'Guardando…' : 'Guardar' }}
      </button>

      <p v-if="saved_message" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
      <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'

/** Demora mínima del mensaje de bienvenida: 0 = inmediato (debe coincidir con admin-api). */
const DELAY_MIN_SECONDS = 0

/** Demora máxima del mensaje de bienvenida (debe coincidir con admin-api). */
const DELAY_MAX_SECONDS = 3600

/** Demora mínima antes de pedir sugerencia IA: 0 = inmediato (debe coincidir con admin-api). */
const AI_SUGGESTION_DELAY_MIN_SECONDS = 0

/** Demora máxima antes de pedir sugerencia IA (debe coincidir con admin-api). */
const AI_SUGGESTION_DELAY_MAX_SECONDS = 3600

/** Auto-envío: 0 = envío inmediato (debe coincidir con admin-api). */
const AUTO_SEND_DELAY_MIN_SECONDS = 0

/** Auto-envío máximo en segundos (debe coincidir con admin-api). */
const AUTO_SEND_DELAY_MAX_SECONDS = 3600

/** Mínimo para auto-envío en tramo de agendamiento, en minutos: 0 = inmediato (debe coincidir con admin-api). */
const VERIFICACION_AGENDAMIENTO_AUTO_SEND_DELAY_MIN_MINUTES = 0

/**
 * Sección de cuenta: mensajes automáticos de onboarding WhatsApp para leads nuevos.
 */
export default {
  name: 'LeadWhatsappOnboardingSection',
  data() {
    return {
      /** Placeholder devuelto por la API para mostrar en la ayuda. */
      placeholder_nombre: '{nombre}',
      /** Límites de demora de bienvenida (sincronizados con backend). */
      delay_min: DELAY_MIN_SECONDS,
      delay_max: DELAY_MAX_SECONDS,
      /** Límites de demora antes de pedir sugerencia IA (sincronizados con backend). */
      ai_suggestion_delay_min: AI_SUGGESTION_DELAY_MIN_SECONDS,
      ai_suggestion_delay_max: AI_SUGGESTION_DELAY_MAX_SECONDS,
      auto_send_delay_min: AUTO_SEND_DELAY_MIN_SECONDS,
      auto_send_delay_max: AUTO_SEND_DELAY_MAX_SECONDS,
      /** Mínimo de demora en tramo de agendamiento (sin tope superior; sincronizado con backend). */
      verificacion_agendamiento_auto_send_delay_min: VERIFICACION_AGENDAMIENTO_AUTO_SEND_DELAY_MIN_MINUTES,
      /** Valores editables del formulario. */
      form: {
        auto_message_with_name: '',
        auto_message_without_name: '',
        welcome_message_with_name: '',
        welcome_message_without_name: '',
        welcome_delay_seconds: 60,
        ai_suggestion_delay_seconds: 60,
        ai_suggestion_auto_send_delay_seconds: 120,
        verificacion_agendamiento_auto_send_delay_minutes: 30,
      },
      /** Snapshot persistido para detectar cambios. */
      stored_form: null,
      /** GET inicial en curso. */
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
     * Habilita guardar si hay cambios y la demora está en rango.
     *
     * @returns {boolean}
     */
    can_save() {
      if (!this.stored_form) {
        return false
      }
      const welcome_delay = parseInt(this.form.welcome_delay_seconds, 10)
      const ai_delay = parseInt(this.form.ai_suggestion_delay_seconds, 10)
      const auto_send_delay = parseInt(this.form.ai_suggestion_auto_send_delay_seconds, 10)
      const verif_agendamiento_delay = parseInt(this.form.verificacion_agendamiento_auto_send_delay_minutes, 10)
      if (
        isNaN(welcome_delay) ||
        welcome_delay < this.delay_min ||
        welcome_delay > this.delay_max ||
        isNaN(ai_delay) ||
        ai_delay < this.ai_suggestion_delay_min ||
        ai_delay > this.ai_suggestion_delay_max ||
        isNaN(auto_send_delay) ||
        auto_send_delay < this.auto_send_delay_min ||
        auto_send_delay > this.auto_send_delay_max ||
        isNaN(verif_agendamiento_delay) ||
        verif_agendamiento_delay < this.verificacion_agendamiento_auto_send_delay_min
      ) {
        return false
      }
      return JSON.stringify(this.form) !== JSON.stringify(this.stored_form)
    },
    /**
     * Indica si hay cambios sin guardar (para confirmación al salir de Cuenta).
     *
     * @returns {boolean}
     */
    has_unsaved_changes() {
      if (!this.stored_form || this.loading) {
        return false
      }
      return JSON.stringify(this.form) !== JSON.stringify(this.stored_form)
    },
  },
  mounted() {
    this.load_settings()
  },
  methods: {
    /**
     * Parsea segundos de demora permitiendo 0 (no usar `|| default` porque 0 es válido).
     *
     * @param {*} raw Valor crudo de la API.
     * @param {number} fallback Valor por defecto si el parseo falla.
     * @returns {number}
     */
    parse_delay_seconds(raw, fallback) {
      const parsed = parseInt(raw, 10)
      if (isNaN(parsed)) {
        return fallback
      }
      return parsed
    },

    /**
     * Copia un objeto de configuración al formulario local.
     *
     * @param {object} data Respuesta GET/PUT.
     * @returns {void}
     */
    apply_from_response(data) {
      const self = this
      const snapshot = {
        auto_message_with_name: (data && data.auto_message_with_name) || '',
        auto_message_without_name: (data && data.auto_message_without_name) || '',
        welcome_message_with_name: (data && data.welcome_message_with_name) || '',
        welcome_message_without_name: (data && data.welcome_message_without_name) || '',
        welcome_delay_seconds: self.parse_delay_seconds(
          data && data.welcome_delay_seconds,
          60
        ),
        ai_suggestion_delay_seconds: self.parse_delay_seconds(
          data && data.ai_suggestion_delay_seconds,
          60
        ),
        ai_suggestion_auto_send_delay_seconds: self.parse_delay_seconds(
          data && data.ai_suggestion_auto_send_delay_seconds,
          120
        ),
        verificacion_agendamiento_auto_send_delay_minutes: self.parse_delay_seconds(
          data && data.verificacion_agendamiento_auto_send_delay_minutes,
          30
        ),
      }
      self.form = JSON.parse(JSON.stringify(snapshot))
      self.stored_form = JSON.parse(JSON.stringify(snapshot))
      if (data && data.placeholder_nombre) {
        self.placeholder_nombre = data.placeholder_nombre
      }
    },

    /**
     * GET /settings/lead-whatsapp-onboarding.
     *
     * @returns {void}
     */
    load_settings() {
      const self = this
      self.loading = true
      self.error_message = ''
      api
        .get('/settings/lead-whatsapp-onboarding')
        .then(function (res) {
          self.apply_from_response(res.data)
        })
        .catch(function () {
          self.error_message = 'No se pudo cargar la configuración.'
        })
        .then(function () {
          self.loading = false
        })
    },

    /**
     * Limpia mensajes de estado al editar campos.
     *
     * @returns {void}
     */
    on_input_change() {
      this.saved_message = ''
      this.error_message = ''
    },

    /**
     * PUT /settings/lead-whatsapp-onboarding.
     *
     * @returns {void}
     */
    on_save() {
      const self = this
      const welcome_delay = parseInt(self.form.welcome_delay_seconds, 10)
      const ai_delay = parseInt(self.form.ai_suggestion_delay_seconds, 10)
      if (isNaN(welcome_delay) || welcome_delay < self.delay_min || welcome_delay > self.delay_max) {
        self.error_message =
          'La demora del mensaje de bienvenida debe estar entre ' +
          self.delay_min +
          ' y ' +
          self.delay_max +
          ' segundos.'
        return
      }
      if (
        isNaN(ai_delay) ||
        ai_delay < self.ai_suggestion_delay_min ||
        ai_delay > self.ai_suggestion_delay_max
      ) {
        self.error_message =
          'La demora de sugerencia IA debe estar entre ' +
          self.ai_suggestion_delay_min +
          ' y ' +
          self.ai_suggestion_delay_max +
          ' segundos.'
        return
      }

      const auto_send_delay = parseInt(self.form.ai_suggestion_auto_send_delay_seconds, 10)
      if (
        isNaN(auto_send_delay) ||
        auto_send_delay < self.auto_send_delay_min ||
        auto_send_delay > self.auto_send_delay_max
      ) {
        self.error_message =
          'La demora de envío automático debe estar entre ' +
          self.auto_send_delay_min +
          ' y ' +
          self.auto_send_delay_max +
          ' segundos (0 = envío inmediato).'
        return
      }

      const verif_agendamiento_delay = parseInt(self.form.verificacion_agendamiento_auto_send_delay_minutes, 10)
      if (
        isNaN(verif_agendamiento_delay) ||
        verif_agendamiento_delay < self.verificacion_agendamiento_auto_send_delay_min
      ) {
        self.error_message =
          'La demora de auto-envío en agendamiento debe ser mayor o igual a ' +
          self.verificacion_agendamiento_auto_send_delay_min +
          ' minutos.'
        return
      }

      const placeholder = self.placeholder_nombre
      if (self.form.auto_message_with_name.indexOf(placeholder) === -1) {
        self.error_message = 'El mensaje automático con nombre debe incluir ' + placeholder + '.'
        return
      }
      if (self.form.welcome_message_with_name.indexOf(placeholder) === -1) {
        self.error_message = 'El mensaje de bienvenida con nombre debe incluir ' + placeholder + '.'
        return
      }

      self.saving = true
      self.saved_message = ''
      self.error_message = ''

      api
        .put('/settings/lead-whatsapp-onboarding', {
          auto_message_with_name: self.form.auto_message_with_name,
          auto_message_without_name: self.form.auto_message_without_name,
          welcome_message_with_name: self.form.welcome_message_with_name,
          welcome_message_without_name: self.form.welcome_message_without_name,
          welcome_delay_seconds: welcome_delay,
          ai_suggestion_delay_seconds: ai_delay,
          ai_suggestion_auto_send_delay_seconds: auto_send_delay,
          verificacion_agendamiento_auto_send_delay_minutes: verif_agendamiento_delay,
        })
        .then(function (res) {
          self.apply_from_response(res.data)
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
