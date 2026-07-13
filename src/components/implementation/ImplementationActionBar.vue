<template>
  <!--
    Barra de acciones manuales de la implementación (prompt 345).

    Un botón por acción del backend (ImplementationActionService::ACTIONS). Cada click
    abre un preview editable en un modal; nada se envía sin que Martín confirme ahí.
    Diseño sobrio: la acción sugerida para la etapa actual va destacada (btn-primary),
    el resto queda disponible pero secundaria (btn-outline-secondary).
  -->
  <div class="impl-action-bar mb-4">
    <h6 class="impl-section-title">Acciones</h6>

    <!-- Fila de botones, uno por acción -->
    <div class="impl-action-bar__buttons d-flex flex-wrap gap-2">
      <div
        v-for="action in actions"
        :key="action.key"
        class="impl-action-bar__item"
      >
        <button
          type="button"
          class="btn btn-sm w-100"
          :class="action.available ? 'btn-primary' : 'btn-outline-secondary'"
          :disabled="loading_state"
          @click="open_action(action)"
        >
          {{ action.label }}
        </button>

        <!-- Destinatario y último envío, en texto chico y gris debajo del botón -->
        <div class="impl-action-bar__meta small text-muted">
          <span>{{ recipient_hint(action) }}</span>
          <span v-if="action.last_executed_at">
            · enviado el {{ format_date(action.last_executed_at) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Modal de preview/edición/envío de la acción seleccionada -->
    <base-modal
      :show="show_modal"
      :title="current_action ? current_action.label : ''"
      size="lg"
      @close="close_modal"
    >
      <template v-if="preview">
        <!-- Línea de destinatario: a quién le va a llegar y su teléfono -->
        <p v-if="current_action && current_action.key !== 'user_setup'" class="mb-2">
          Le va a llegar a <strong>{{ preview.recipient_label }}</strong>
          <span v-if="preview.recipient_phone"> ({{ preview.recipient_phone }})</span>.
        </p>

        <!-- Aviso de ventana cerrada con plantilla disponible: neutro, se envía igual -->
        <div
          v-if="preview.window_open === false && preview.template_name"
          class="alert alert-secondary py-2 small mb-3"
        >
          Pasaron más de 24 h desde el último mensaje del cliente. Se va a enviar como
          plantilla aprobada (<code>{{ preview.template_name }}</code>), por eso el texto
          no se puede editar.
        </div>

        <!-- Aviso de ventana cerrada sin plantilla: bloquea el envío -->
        <div
          v-else-if="preview.window_open === false && !preview.template_name"
          class="alert alert-warning py-2 small mb-3"
        >
          La ventana de 24 h está cerrada y esta acción todavía no tiene plantilla
          aprobada. Esperá a que el cliente escriba, o mandale la presentación.
        </div>

        <!-- Selector de etapa: solo para la acción 'progreso' -->
        <div v-if="current_action && current_action.key === 'progreso'" class="mb-3">
          <label class="form-label small text-muted mb-1">Etapa a informar</label>
          <select
            v-model.number="preview_stage"
            class="form-select form-select-sm"
            :disabled="loading_preview"
            @change="load_preview"
          >
            <option v-for="opt in progreso_stage_options" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- 'user_setup': el body es el payload real, no es texto editable -->
        <pre v-if="current_action && current_action.key === 'user_setup'" class="impl-action-bar__payload p-2 border rounded small mb-0">{{ preview.body }}</pre>

        <!-- Resto de acciones: texto editable (o solo lectura si va por plantilla) -->
        <textarea
          v-else
          v-model="edited_body"
          class="form-control"
          rows="12"
          :readonly="!preview.editable"
        />

        <!-- Motivo del error 422 (ej: ventana cerrada sin plantilla): visible dentro del modal -->
        <div v-if="error_message" class="alert alert-danger py-2 small mt-3 mb-0">
          {{ error_message }}
        </div>
      </template>

      <!-- Cargando el preview -->
      <div v-else class="text-center text-muted py-4">
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
        Cargando preview…
      </div>

      <template #footer>
        <button type="button" class="btn btn-secondary" :disabled="sending" @click="close_modal">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!can_submit"
          @click="submit_action"
        >
          {{ submit_label }}
        </button>
      </template>
    </base-modal>
  </div>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'

export default {
  name: 'ImplementationActionBar',

  components: { BaseModal },

  props: {
    /**
     * Implementación activa en el panel de detalle. Se espera que tenga
     * `id`, `current_stage` y `stages` (con `config.name`) cargados.
     */
    implementation: { type: Object, required: true },
  },

  emits: ['updated'],

  data() {
    return {
      /** Estado de acciones devuelto por GET /implementation/{id}/actions. */
      actions: [],

      /** Indicador de carga del estado de acciones (deshabilita los botones). */
      loading_state: false,

      /** Acción actualmente abierta en el modal (item de `actions`), o null. */
      current_action: null,

      /**
       * Preview devuelto por el backend para la acción abierta:
       * { action, body, recipient_label, recipient_phone, window_open, requires_template, editable, template_name }.
       */
      preview: null,

      /** Indicador de carga del preview (mientras se pide o se recalcula por cambio de etapa). */
      loading_preview: false,

      /** Etapa elegida para la acción 'progreso' (default: implementation.current_stage). */
      preview_stage: 1,

      /** Texto editable del modal, prellenado con preview.body. */
      edited_body: '',

      /** Indicador de envío en curso (evita doble click). */
      sending: false,

      /** Motivo del error 422 al ejecutar (ej: ventana cerrada sin plantilla), visible en el modal. */
      error_message: '',

      /** Visibilidad del modal de preview/envío. */
      show_modal: false,
    }
  },

  computed: {
    /**
     * Opciones del selector de etapa para la acción 'progreso': una por cada
     * stage cargado en la implementación, con su nombre desde stages.config.
     *
     * @returns {Array<{value: number, label: string}>}
     */
    progreso_stage_options() {
      const stages = (this.implementation && this.implementation.stages) || []

      /** Copia ordenada por número de etapa para el selector. */
      const sorted = stages.slice().sort(function (a, b) {
        return (a.stage_number || 0) - (b.stage_number || 0)
      })

      return sorted.map(function (stage) {
        const name = stage.config && stage.config.name ? stage.config.name : ''
        return {
          value: stage.stage_number,
          label: 'Etapa ' + stage.stage_number + (name ? ' — ' + name : ''),
        }
      })
    },

    /**
     * Etiqueta del botón de envío según la acción abierta.
     *
     * @returns {string}
     */
    submit_label() {
      if (this.sending) {
        return this.current_action && this.current_action.key === 'user_setup'
          ? 'Aplicando...'
          : 'Enviando...'
      }
      return this.current_action && this.current_action.key === 'user_setup'
        ? 'Aplicar configuración'
        : 'Enviar'
    },

    /**
     * Habilita el botón de envío: hace falta preview cargado, no estar enviando,
     * y que la ventana no esté cerrada sin plantilla disponible (requires_template).
     *
     * @returns {boolean}
     */
    can_submit() {
      if (!this.preview || this.sending || this.loading_preview) {
        return false
      }
      return !this.preview.requires_template
    },
  },

  watch: {
    /**
     * Recarga el estado de acciones cuando cambia la implementación seleccionada
     * o su etapa actual (la acción sugerida como 'available' depende de eso).
     *
     * @param {Object|null} new_val
     * @param {Object|null} old_val
     */
    'implementation.id': {
      immediate: true,
      handler() {
        this.load_actions_state()
      },
    },
    'implementation.current_stage'() {
      this.load_actions_state()
    },
  },

  methods: {
    /**
     * Carga el estado de las 6 acciones (destinatario, ventana, última ejecución)
     * desde GET /implementation/{id}/actions.
     *
     * @returns {void}
     */
    load_actions_state() {
      if (!this.implementation || !this.implementation.id) {
        this.actions = []
        return
      }

      const self = this
      this.loading_state = true

      api
        .get('/implementation/' + this.implementation.id + '/actions')
        .then(function (res) {
          self.actions = res.data.actions || []
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
          self.actions = []
        })
        .then(function () {
          self.loading_state = false
        })
    },

    /**
     * Texto de destinatario debajo del botón de cada acción.
     *
     * @param {Object} action Item de `actions`.
     * @returns {string}
     */
    recipient_hint(action) {
      if (!action || !action.recipient_label || action.recipient_label === '—') {
        return ''
      }
      return 'a ' + action.recipient_label.toLowerCase()
    },

    /**
     * Abre el modal para una acción: fija la etapa por defecto (si aplica) y pide el preview.
     *
     * @param {Object} action Item de `actions` clickeado.
     * @returns {void}
     */
    open_action(action) {
      this.current_action = action
      this.preview = null
      this.error_message = ''
      this.preview_stage = this.implementation ? this.implementation.current_stage : 1
      this.show_modal = true
      this.load_preview()
    },

    /**
     * Pide el preview de la acción abierta (con `stage` en la query si es 'progreso').
     *
     * @returns {void}
     */
    load_preview() {
      if (!this.current_action || !this.implementation) {
        return
      }

      const self = this
      const action_key = this.current_action.key

      /** Query params: solo 'progreso' manda `stage`. */
      const params = action_key === 'progreso' ? { stage: this.preview_stage } : {}

      this.loading_preview = true
      this.error_message = ''

      api
        .get('/implementation/' + this.implementation.id + '/actions/' + action_key + '/preview', { params })
        .then(function (res) {
          self.preview = res.data
          self.edited_body = res.data.body || ''
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
          self.preview = null
        })
        .then(function () {
          self.loading_preview = false
        })
    },

    /**
     * Ejecuta la acción abierta: POST /implementation/{id}/actions/{action}.
     *
     * Con éxito cierra el modal, emite `updated` con el modelo fresco y recarga
     * el estado de acciones. Con 422 muestra el motivo dentro del modal sin cerrarlo,
     * preservando el texto editado por el admin.
     *
     * @returns {void}
     */
    submit_action() {
      if (!this.can_submit || !this.current_action || !this.implementation) {
        return
      }

      const self = this
      const action_key = this.current_action.key

      /** Payload: 'user_setup' no manda `content` (no es un mensaje editable). */
      const payload = { stage: this.preview_stage }
      if (action_key !== 'user_setup') {
        payload.content = this.edited_body
      }

      this.sending = true
      this.error_message = ''

      this.$store.commit('auth/setMessage', action_key === 'user_setup' ? 'Aplicando configuración' : 'Enviando mensaje')
      this.$store.commit('auth/setLoading', true)

      api
        .post('/implementation/' + this.implementation.id + '/actions/' + action_key, payload)
        .then(function (res) {
          self.show_modal = false
          self.preview = null
          self.current_action = null
          self.$emit('updated', res.data.model)
          self.load_actions_state()
        })
        .catch(function (error) {
          /*
           * El interceptor global ya muestra el toast; acá además dejamos el motivo
           * visible dentro del modal (sin cerrarlo) para que Martín no pierda el texto.
           */
          const response_data = error && error.response ? error.response.data : null
          self.error_message = (response_data && response_data.message)
            ? response_data.message
            : 'No se pudo ejecutar la acción.'
        })
        .then(function () {
          self.sending = false
          self.$store.commit('auth/setLoading', false)
          self.$store.commit('auth/setMessage', '')
        })
    },

    /**
     * Cierra el modal y limpia el estado de edición.
     *
     * @returns {void}
     */
    close_modal() {
      if (this.sending) {
        return
      }
      this.show_modal = false
      this.preview = null
      this.current_action = null
      this.edited_body = ''
      this.error_message = ''
    },

    /**
     * Formatea una fecha ISO a string legible en locale español (Argentina).
     *
     * @param {string|null} date_string Fecha ISO o null.
     * @returns {string}
     */
    format_date(date_string) {
      if (!date_string) {
        return '—'
      }

      const date = new Date(date_string)

      if (isNaN(date.getTime())) {
        return '—'
      }

      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    },
  },
}
</script>

<style scoped>
/* Título de sección: mismo estilo que el resto del panel de detalle */
.impl-section-title {
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  color: #6c757d;
  margin-bottom: 8px;
}

/* Cada botón de acción con su meta debajo, ancho acotado para que no estire toda la fila */
.impl-action-bar__item {
  min-width: 170px;
  max-width: 220px;
  flex: 1 1 170px;
}

/* Texto de destinatario / último envío debajo del botón */
.impl-action-bar__meta {
  margin-top: 2px;
  line-height: 1.3;
}

/* Payload de 'user_setup': monoespaciado con scroll propio, no crece sin límite */
.impl-action-bar__payload {
  max-height: 320px;
  overflow: auto;
  background-color: #f8f9fa;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
