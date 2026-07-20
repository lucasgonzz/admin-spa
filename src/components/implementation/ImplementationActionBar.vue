<template>
  <!--
    Modal de acción manual de la implementación.

    Prompt 345: un modal de preview/edición/envío por acción del backend
    (ImplementationActionService::ACTIONS). Prompt 479: este componente deja de pintar
    la fila de botones (ahora la pinta el padre, repartida dentro de cada etapa) y
    queda como único dueño del modal, que el padre abre por ref con open(action, stage).
  -->
  <base-modal
    :show="show_modal"
    :title="current_action ? current_action.label : ''"
    size="lg"
    @close="close_modal"
  >
    <template v-if="preview">
        <!-- Línea de destinatario: a quién le va a llegar y su teléfono (no aplica a side_effect) -->
        <p v-if="current_action && current_action.kind !== 'side_effect'" class="mb-2">
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

        <!--
          Aviso de re-aplicación: solo 'user_setup' con is_reapply (ya se aplicó antes).
          No alarmista, solo deja claro que se va a re-enviar toda la config al cliente.
        -->
        <div
          v-if="current_action && current_action.key === 'user_setup' && is_reapply"
          class="alert alert-secondary py-2 small mb-3"
        >
          Este UserSetup ya se aplicó. Volver a aplicarlo re-envía toda la configuración
          del formulario a la empresa-api del cliente.
        </div>

        <!-- Acciones 'side_effect' ('user_setup' y 'crear_instalacion'): el body es descriptivo, no editable -->
        <pre v-if="current_action && current_action.kind === 'side_effect'" class="impl-action-bar__payload p-2 border rounded small mb-0">{{ preview.body }}</pre>

        <!-- Resto de acciones ('message'): texto editable (o solo lectura si va por plantilla) -->
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

        <!--
          Copiar: solo acciones de tipo 'message'. Únicamente portapapeles, no llama al
          backend ni marca la acción como enviada — por eso está disponible aunque la
          ventana de 24 h esté cerrada (a diferencia de "Enviar").
        -->
        <button
          v-if="current_action && current_action.kind === 'message'"
          type="button"
          class="btn btn-outline-secondary"
          :disabled="!preview"
          @click="copy_body"
        >
          {{ copied ? 'Copiado ✓' : 'Copiar' }}
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
      /** Acción actualmente abierta en el modal (item de `actions` con key, kind, blocked, can_force, etc.), o null. */
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

      /**
       * true cuando el modal abierto es un re-aplicar de 'user_setup' (ya se había
       * aplicado antes, action.can_force === true al abrir). Determina el aviso y
       * la etiqueta "Aplicar de nuevo", y viaja como `force` en el POST.
       */
      is_reapply: false,

      /** Feedback visual de "Copiado ✓" tras copy_body(), se resetea solo a los 2s. */
      copied: false,
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
     * Etiqueta del botón de envío según la acción abierta: distingue 'user_setup'
     * (Aplicar / Aplicar de nuevo si es_reaply), 'crear_instalacion' (Crear instalación)
     * y el resto de acciones de mensaje (Enviar).
     *
     * @returns {string}
     */
    submit_label() {
      const key = this.current_action ? this.current_action.key : null

      if (key === 'user_setup') {
        if (this.sending) {
          return 'Aplicando...'
        }
        return this.is_reapply ? 'Aplicar de nuevo' : 'Aplicar configuración'
      }

      if (key === 'crear_instalacion') {
        return this.sending ? 'Creando...' : 'Crear instalación'
      }

      return this.sending ? 'Enviando...' : 'Enviar'
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

  methods: {
    /**
     * Abre el modal para una acción (invocado por el padre vía $refs.action_modal.open(...)).
     *
     * Recibe el item completo de `actions` (key, kind, blocked, can_force, label, etc., tal
     * como lo arma el padre desde GET /implementation/{id}/actions) y la etapa actual de la
     * implementación, y deja todo listo para pedir el preview: resetea edición/error/copiado,
     * fija la etapa por defecto del selector de 'progreso', y calcula si es un re-aplicar de
     * 'user_setup' (ya se había aplicado antes).
     *
     * @param {Object} action Item de `actions` a abrir.
     * @param {number} [stage] Etapa actual de la implementación (default para 'progreso').
     * @returns {void}
     */
    open(action, stage) {
      this.current_action = action
      this.preview = null
      this.error_message = ''
      this.copied = false
      this.preview_stage = stage != null ? stage : (this.implementation ? this.implementation.current_stage : 1)

      /* 'user_setup' ya aplicado (can_force true): esta apertura es un re-aplicar. */
      this.is_reapply = action && action.key === 'user_setup' && action.can_force === true

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
     * Copia al portapapeles el texto del mensaje (solo acciones de tipo 'message').
     *
     * No envía nada ni registra la acción: es un atajo para mandarlo a mano fuera de
     * la ventana de 24 h. Por eso no depende del estado de la ventana ni del backend.
     *
     * @returns {void}
     */
    copy_body() {
      const self = this

      if (!navigator.clipboard) {
        // Sin API de portapapeles disponible: no rompemos, simplemente no confirmamos copiado.
        return
      }

      navigator.clipboard.writeText(self.edited_body).then(function () {
        self.copied = true
        setTimeout(function () { self.copied = false }, 2000)
      }).catch(function () {
        self.copied = false
      })
    },

    /**
     * Ejecuta la acción abierta: POST /implementation/{id}/actions/{action}.
     *
     * Con éxito cierra el modal y emite `updated` con el modelo fresco (el padre recarga
     * el estado de acciones desde ese handler). Con 422 muestra el motivo dentro del modal
     * sin cerrarlo, preservando el texto editado por el admin.
     *
     * @returns {void}
     */
    submit_action() {
      if (!this.can_submit || !this.current_action || !this.implementation) {
        return
      }

      const self = this
      const action_key = this.current_action.key
      const kind = this.current_action.kind

      /**
       * Payload por tipo de acción:
       * - 'message' (presentacion, form_link, progreso, pedir_archivos, entrega): manda `content` editado.
       * - 'user_setup' (side_effect): no manda `content`, manda `force` (re-aplicar el lock).
       * - 'crear_instalacion' (side_effect): no manda `content` ni `force`.
       */
      const payload = { stage: this.preview_stage }
      if (kind === 'message') {
        payload.content = this.edited_body
      }
      if (action_key === 'user_setup') {
        payload.force = this.is_reapply
      }

      this.sending = true
      this.error_message = ''

      /** Mensaje del indicador global de carga según la acción. */
      let loading_message = 'Enviando mensaje'
      if (action_key === 'user_setup') {
        loading_message = 'Aplicando configuración'
      } else if (action_key === 'crear_instalacion') {
        loading_message = 'Creando instalación'
      }

      this.$store.commit('auth/setMessage', loading_message)
      this.$store.commit('auth/setLoading', true)

      api
        .post('/implementation/' + this.implementation.id + '/actions/' + action_key, payload)
        .then(function (res) {
          self.show_modal = false
          self.preview = null
          self.current_action = null
          self.$emit('updated', res.data.model)
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
      this.copied = false
      this.is_reapply = false
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
/* Payload de acciones 'side_effect' (user_setup, crear_instalacion): monoespaciado con scroll propio */
.impl-action-bar__payload {
  max-height: 320px;
  overflow: auto;
  background-color: #f8f9fa;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
