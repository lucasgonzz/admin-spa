<template>
  <!-- Teleport al body: evita que el stacking context del padre bloquee el modal -->
  <Teleport to="body">
    <!-- Modal Bootstrap para seleccionar y enviar plantillas Meta manualmente -->
    <div
      class="modal fade"
      id="templatePickerModal"
      tabindex="-1"
      aria-labelledby="templatePickerModalLabel"
      aria-hidden="true"
      ref="modal_el"
    >
    <div class="modal-dialog modal-dialog-scrollable">
      <div class="modal-content">

        <div class="modal-header">
          <h5 class="modal-title" id="templatePickerModalLabel">Enviar plantilla</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar" />
        </div>

        <div class="modal-body">

          <!-- Vista de preview: se muestra cuando el usuario ya eligió una plantilla -->
          <div v-if="selected_template">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <small class="text-muted fw-semibold">Vista previa</small>
              <!-- Botón para volver a la lista de plantillas -->
              <button type="button" class="btn btn-link btn-sm p-0 text-muted" @click="selected_template = null">
                <i class="bi bi-x-lg" /> Volver
              </button>
            </div>

            <!-- Texto de la plantilla con variables ya reemplazadas -->
            <div
              class="bg-success bg-opacity-10 border border-success border-opacity-25 rounded p-3 mb-3"
              style="white-space: pre-wrap; font-size: 0.9rem;"
            >{{ preview_text }}</div>

            <!-- Campos editables para las variables que el lead no tiene resueltas -->
            <div v-if="empty_variables.length > 0" class="mb-3">
              <small class="text-danger fw-semibold d-block mb-2">
                <i class="bi bi-exclamation-triangle-fill me-1" />
                Completá los datos faltantes:
              </small>
              <div v-for="v in empty_variables" :key="v.placeholder" class="mb-2">
                <label class="form-label form-label-sm mb-1">{{ v.label }}</label>
                <input
                  v-model="v.value"
                  type="text"
                  class="form-control form-control-sm"
                  :placeholder="v.placeholder"
                />
              </div>
            </div>

            <!-- Botón de confirmación: se deshabilita si hay variables vacías o mientras se envía -->
            <button
              type="button"
              class="btn btn-success w-100"
              :disabled="enviando || has_empty_required"
              @click="on_enviar"
            >
              <span v-if="enviando" class="spinner-border spinner-border-sm me-2" />
              <i v-else class="bi bi-send me-2" />
              Enviar plantilla
            </button>
          </div>

          <!-- Vista de lista: se muestra cuando no hay plantilla seleccionada aún -->
          <div v-else>

            <!-- Plantillas sugeridas según el estado actual del lead -->
            <div v-if="sugeridas.length > 0" class="mb-3">
              <small class="text-muted fw-semibold d-block mb-2">
                <i class="bi bi-stars me-1 text-warning" />
                Sugeridas para este lead (estado: {{ lead_estado }})
              </small>
              <div
                v-for="(tpl, tpl_index) in sugeridas"
                :key="tpl.id"
                class="template-item border rounded p-2 mb-2"
                @click="on_select(tpl)"
              >
                <div class="d-flex justify-content-between align-items-start">
                  <div class="fw-semibold small">{{ tpl.template_name }}</div>
                  <!-- Badge de próximo envío solo para la plantilla que sigue en la cola -->
                  <span
                    v-if="tpl_index === next_template_index && next_followup_label"
                    class="badge bg-primary bg-opacity-10 text-primary ms-2 flex-shrink-0"
                    style="font-size: 0.7rem; font-weight: 500;"
                  >
                    <i class="bi bi-clock me-1" />{{ next_followup_label }}
                  </span>
                </div>
                <div
                  v-if="tpl.body_template"
                  class="text-muted"
                  style="font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                >
                  {{ tpl.body_template }}
                </div>
              </div>
            </div>

            <!-- Todas las plantillas activas ordenadas -->
            <div>
              <small class="text-muted fw-semibold d-block mb-2">
                <i class="bi bi-collection me-1" />
                Todas las plantillas
              </small>
              <div
                v-for="tpl in todas_activas"
                :key="tpl.id"
                class="template-item border rounded p-2 mb-2"
                @click="on_select(tpl)"
              >
                <div class="fw-semibold small">{{ tpl.template_name }}</div>
                <div class="text-muted" style="font-size: 0.75rem;">
                  Estado: {{ tpl.estado }} · Día {{ tpl.dia_numero }}
                </div>
                <div
                  v-if="tpl.body_template"
                  class="text-muted"
                  style="font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                >
                  {{ tpl.body_template }}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
    </div>
  </Teleport>
</template>

<script>
import { Modal } from 'bootstrap'
import api from '@/utils/axios'

/**
 * Mapeo de placeholders Meta a campos del lead y etiquetas legibles para el usuario.
 * Si en el futuro se agregan nuevas variables, se extiende este array.
 */
const VARIABLE_MAP = [
  { placeholder: '{{1}}', field: 'contact_name',    label: 'Nombre del contacto' },
  { placeholder: '{{2}}', field: 'demo_start_time', label: 'Hora de la demo (HH:MM)' },
]

export default {
  name: 'TemplatePickerModal',

  props: {
    /**
     * Objeto lead completo (debe incluir `status`, `contact_name`, `demo_start_time`).
     * Se usa para resolver las variables de la plantilla automáticamente.
     */
    lead: {
      type: Object,
      required: true,
    },
  },

  emits: ['template-sent'],

  data() {
    return {
      /* Plantilla actualmente seleccionada por el usuario (null = mostrar lista). */
      selected_template: null,
      /* Variables que el usuario debe completar manualmente porque el lead no tiene el dato. */
      empty_variables: [],
      /* Indica si se está procesando el envío para bloquear el botón. */
      enviando: false,
      /* Reglas de followup cargadas desde la API para calcular el countdown. */
      followup_rules: [],
      /* Evita repetir la petición de reglas en cada apertura del modal. */
      rules_loaded: false,
    }
  },

  computed: {
    /**
     * Estado del pipeline del lead (campo `status` del modelo Lead).
     * Se usa para filtrar plantillas sugeridas.
     *
     * @returns {string}
     */
    lead_estado() {
      return this.lead?.status || ''
    },

    /**
     * Todas las plantillas del store de followup_template.
     * @returns {Array}
     */
    all_templates() {
      return this.$store.state.followup_template.models || []
    },

    /**
     * Solo las plantillas con flag `activa` en true.
     * @returns {Array}
     */
    todas_activas() {
      return this.all_templates.filter((t) => t.activa)
    },

    /**
     * Plantillas activas cuyo estado coincide con el del lead actual.
     * Se muestran primero en el modal como sugerencias.
     * @returns {Array}
     */
    sugeridas() {
      return this.todas_activas.filter((t) => t.estado === this.lead_estado)
    },

    /**
     * Texto de la plantilla con las variables reemplazadas por datos del lead.
     * Si el usuario completó manualmente alguna variable vacía, también se aplica.
     * @returns {string}
     */
    preview_text() {
      if (!this.selected_template?.body_template) return ''

      /* Empezar con el body_template y reemplazar variable por variable. */
      let text = this.selected_template.body_template

      VARIABLE_MAP.forEach(({ placeholder, field }) => {
        /* Valor del lead para esta variable (puede ser vacío si no está cargado). */
        const value = this.lead?.[field] || ''
        text = text.replaceAll(placeholder, value)
      })

      /* Aplicar encima los overrides que el usuario completó manualmente. */
      this.empty_variables.forEach(({ placeholder, value }) => {
        if (value) text = text.replaceAll(placeholder, value)
      })

      return text
    },

    /**
     * Indica si queda alguna variable obligatoria sin completar (bloquea el botón de envío).
     * @returns {boolean}
     */
    has_empty_required() {
      return this.empty_variables.some((v) => !v.value || v.value.trim() === '')
    },

    /**
     * Array de valores de variables en orden ({{1}}, {{2}}, ...) para enviar al backend.
     * Solo incluye las variables que realmente aparecen en el template.
     * @returns {string[]}
     */
    resolved_variables() {
      const body = this.selected_template?.body_template || ''
      const result = []

      VARIABLE_MAP.forEach(({ placeholder, field }) => {
        /* Si la variable no aparece en este template, no la incluir. */
        if (!body.includes(placeholder)) return

        /* Buscar si el usuario completó este placeholder manualmente. */
        const manual = this.empty_variables.find((v) => v.placeholder === placeholder)
        if (manual) {
          result.push(manual.value || '')
        } else {
          result.push(this.lead?.[field] || '')
        }
      })

      return result
    },

    /**
     * Regla de followup activa para el estado actual del lead.
     *
     * @returns {Object|null}
     */
    followup_rule_for_lead() {
      const estado = this.lead_estado
      return this.followup_rules.find(function (r) {
        return r.estado === estado && r.activa
      }) || null
    },

    /**
     * Timestamp del último mensaje no rechazado del lead.
     * Cae al created_at del lead si no hay mensajes.
     *
     * @returns {number}
     */
    last_lead_message_at() {
      const msgs = (this.lead.messages || []).slice()
      const valid = msgs.filter(function (m) {
        return m.status !== 'rechazado'
      })
      valid.sort(function (a, b) {
        return (b.id || 0) - (a.id || 0)
      })
      const m = valid[0]
      if (m && m.created_at) {
        return new Date(m.created_at).getTime()
      }
      if (this.lead.created_at) {
        return new Date(this.lead.created_at).getTime()
      }
      return Date.now()
    },

    /**
     * Índice (0-based) de la próxima plantilla sugerida a enviarse automáticamente.
     * Equivale al count de followups ya enviados/en proceso (no rechazados).
     *
     * @returns {number}
     */
    next_template_index() {
      const msgs = (this.lead.messages || []).filter(function (m) {
        return m.is_followup && m.status !== 'rechazado'
      })
      return msgs.length
    },

    /**
     * Label de cuánto falta para el próximo envío automático.
     * Cadena vacía si no hay regla o no aplica.
     *
     * @returns {string}
     */
    next_followup_label() {
      const rule = this.followup_rule_for_lead
      if (!rule || !rule.horas_espera) {
        return ''
      }
      const last_at = this.last_lead_message_at
      const sends_at = last_at + rule.horas_espera * 3600000
      const remaining_ms = sends_at - Date.now()
      if (remaining_ms <= 0) {
        return 'en cola'
      }
      const total_mins = Math.ceil(remaining_ms / 60000)
      const hours = Math.floor(total_mins / 60)
      const mins = total_mins % 60
      if (hours > 0 && mins > 0) {
        return 'en ' + hours + 'h ' + mins + 'min'
      }
      if (hours > 0) {
        return 'en ' + hours + 'h'
      }
      return 'en ' + mins + 'min'
    },
  },

  /**
   * Limpia el modal de Bootstrap si el componente se destruye con el modal abierto.
   */
  beforeUnmount() {
    const modal = Modal.getInstance(this.$refs.modal_el)
    if (modal) modal.hide()
  },

  methods: {
    /**
     * Abre el modal y resetea el estado interno.
     * Si las plantillas aún no están cargadas en el store, las solicita.
     */
    open() {
      /* Limpiar selección previa al abrir. */
      this.selected_template = null
      this.empty_variables = []
      this.enviando = false

      /* Cargar templates si el store está vacío. */
      if (this.all_templates.length === 0) {
        this.$store.dispatch('followup_template/fetch')
      }

      /* Cargar reglas de followup una sola vez para el countdown de envío automático. */
      if (!this.rules_loaded) {
        const self = this
        api.get('/followup-rule').then(function (res) {
          self.followup_rules = res.data.models || []
          self.rules_loaded = true
        }).catch(function () {
          /* Silencioso: no mostrar countdown si falla la carga. */
        })
      }

      const modal = Modal.getOrCreateInstance(this.$refs.modal_el)
      modal.show()
    },

    /**
     * Cierra el modal programáticamente.
     */
    close() {
      const modal = Modal.getInstance(this.$refs.modal_el)
      if (modal) modal.hide()
    },

    /**
     * Selecciona una plantilla y detecta qué variables están vacías en el lead.
     * Las variables vacías se agregan a `empty_variables` para que el usuario las complete.
     *
     * @param {Object} tpl Plantilla seleccionada por el usuario.
     */
    on_select(tpl) {
      this.selected_template = tpl
      this.empty_variables = []

      if (!tpl.body_template) return

      /* Recorrer el mapeo y detectar qué variables faltan en el lead. */
      VARIABLE_MAP.forEach(({ placeholder, field, label }) => {
        if (!tpl.body_template.includes(placeholder)) return
        /* Si el lead no tiene el dato, pedir al usuario que lo complete. */
        const value = this.lead?.[field] || ''
        if (!value) {
          this.empty_variables.push({ placeholder, label, value: '' })
        }
      })
    },

    /**
     * Confirma el envío de la plantilla seleccionada.
     * Llama al action del store y cierra el modal en caso de éxito.
     */
    on_enviar() {
      if (!this.selected_template) return
      this.enviando = true

      /* Payload completo para el action del store. */
      const payload = {
        lead_id:       this.lead.id,
        template_name: this.selected_template.template_name,
        language_code: this.selected_template.language_code || 'es_AR',
        variables:     this.resolved_variables,
        content:       this.preview_text,
      }

      this.$store
        .dispatch('lead/send_template', payload)
        .then(() => {
          this.close()
          this.$emit('template-sent')
        })
        .catch((err) => {
          const msg = err?.response?.data?.message || err.message
          alert('Error al enviar la plantilla: ' + msg)
        })
        .finally(() => {
          this.enviando = false
        })
    },
  },
}
</script>

<style scoped>
/* Efecto hover en los ítems de plantilla de la lista */
.template-item {
  cursor: pointer;
  transition: background-color 0.15s;
}
.template-item:hover {
  background-color: var(--bs-gray-100);
}
</style>
