<template>
  <!-- Teleport al body: evita que el stacking context del padre bloquee el modal -->
  <Teleport to="body">
    <div
      class="modal fade"
      id="scheduleMessageModal"
      tabindex="-1"
      aria-labelledby="scheduleMessageModalLabel"
      aria-hidden="true"
      ref="modal_el"
    >
    <div class="modal-dialog modal-dialog-scrollable">
      <div class="modal-content">

        <div class="modal-header">
          <h5 class="modal-title" id="scheduleMessageModalLabel">
            <i class="bi bi-clock me-2" aria-hidden="true" />
            {{ is_editing ? 'Editar envío programado' : 'Programar envío' }}
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar" />
        </div>

        <div class="modal-body">

          <!-- Fecha y hora del envío: es lo que decide si se puede escribir texto libre -->
          <div class="mb-3">
            <label class="form-label form-label-sm fw-semibold mb-1" for="schedule_at_input">
              ¿Cuándo se envía?
            </label>
            <input
              id="schedule_at_input"
              v-model="scheduled_at_local"
              type="datetime-local"
              class="form-control form-control-sm"
              :min="min_datetime_local"
              :max="max_datetime_local"
            />
            <small class="text-muted d-block mt-1">
              Se puede programar hasta 30 días para adelante.
            </small>
          </div>

          <!-- Cartel de ventana: cambia en vivo con la fecha elegida -->
          <div
            v-if="is_within_window"
            class="alert alert-success py-2 px-3 small mb-3"
            role="status"
          >
            <i class="bi bi-unlock me-1" aria-hidden="true" />
            Dentro de la ventana de 24 hs (vence {{ window_expires_label }}) — podés escribir lo
            que quieras.
          </div>
          <div v-else class="alert alert-warning py-2 px-3 small mb-3" role="status">
            <i class="bi bi-lock me-1" aria-hidden="true" />
            <template v-if="window_expires_at_ms">
              Fuera de la ventana de 24 hs (venció {{ window_expires_label }}) — Meta solo permite
              una plantilla aprobada.
            </template>
            <template v-else>
              El lead nunca escribió, así que la ventana de 24 hs está cerrada — Meta solo permite
              una plantilla aprobada.
            </template>
          </div>

          <!-- ================= MODO TEXTO LIBRE ================= -->
          <div v-if="is_within_window" class="mb-3">
            <label class="form-label form-label-sm fw-semibold mb-1" for="schedule_content_input">
              Mensaje
            </label>
            <textarea
              id="schedule_content_input"
              v-model="content"
              class="form-control form-control-sm"
              rows="4"
              maxlength="4096"
              placeholder="Escribí el mensaje que querés que salga."
            />
            <small class="text-muted d-block mt-1">{{ content.length }} / 4096</small>
          </div>

          <!-- ================= MODO PLANTILLA ================= -->
          <div v-else class="mb-3">

            <!-- Preview de la plantilla elegida, con sus variables a completar -->
            <div v-if="selected_template">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <small class="text-muted fw-semibold">
                  Plantilla: {{ selected_template.template_name }}
                </small>
                <button
                  type="button"
                  class="btn btn-link btn-sm p-0 text-muted"
                  @click="selected_template = null"
                >
                  <i class="bi bi-x-lg" /> Cambiar
                </button>
              </div>

              <div
                class="bg-success bg-opacity-10 border border-success border-opacity-25 rounded p-3 mb-3"
                style="white-space: pre-wrap; font-size: 0.9rem;"
              >{{ preview_text }}</div>

              <div v-if="empty_variables.length > 0">
                <small class="text-danger fw-semibold d-block mb-2">
                  <i class="bi bi-exclamation-triangle-fill me-1" />
                  Completá los datos faltantes:
                </small>
                <div v-for="v in empty_variables" :key="v.placeholder" class="mb-2">
                  <label class="form-label form-label-sm mb-1">{{ v.label }}</label>
                  <div class="d-flex gap-2 align-items-start">
                    <input
                      v-model="v.value"
                      type="text"
                      class="form-control form-control-sm"
                      :placeholder="v.placeholder"
                    />
                    <button
                      v-if="v.ai_suggestable"
                      type="button"
                      class="btn btn-outline-secondary btn-sm flex-shrink-0 text-nowrap"
                      :disabled="v.loading"
                      @click="on_suggest_motivo(v)"
                    >
                      <span v-if="v.loading" class="spinner-border spinner-border-sm" />
                      <template v-else>Sugerir con IA</template>
                    </button>
                  </div>
                  <small v-if="v.error" class="text-danger d-block mt-1">{{ v.error }}</small>
                </div>
              </div>
            </div>

            <!-- Lista de plantillas: buscador, sugeridas por estado y grupos por categoría -->
            <div v-else>
              <div class="mb-3">
                <div class="input-group input-group-sm">
                  <span class="input-group-text bg-white border-end-0">
                    <i class="bi bi-search text-muted" />
                  </span>
                  <input
                    v-model="search_text"
                    type="text"
                    class="form-control form-control-sm border-start-0"
                    placeholder="Buscar plantilla..."
                  />
                </div>
              </div>

              <div v-if="is_searching">
                <small class="text-muted fw-semibold d-block mb-2">
                  {{ filtered_templates.length }} resultado(s)
                </small>
                <div
                  v-for="tpl in filtered_templates"
                  :key="tpl.id"
                  class="template-item border rounded p-2 mb-2"
                  @click="on_select(tpl)"
                >
                  <div class="fw-semibold small">{{ tpl.template_name }}</div>
                  <div
                    v-if="tpl.body_template"
                    class="text-muted"
                    style="font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                  >
                    {{ tpl.body_template }}
                  </div>
                </div>
              </div>

              <template v-else>
                <div v-if="sugeridas.length > 0" class="mb-3">
                  <small class="text-muted fw-semibold d-block mb-2">
                    <i class="bi bi-stars me-1 text-warning" />
                    Sugeridas para este lead (estado: {{ lead_estado }})
                  </small>
                  <div
                    v-for="tpl in sugeridas"
                    :key="tpl.id"
                    class="template-item border rounded p-2 mb-2"
                    @click="on_select(tpl)"
                  >
                    <div class="fw-semibold small">{{ tpl.template_name }}</div>
                    <div
                      v-if="tpl.body_template"
                      class="text-muted"
                      style="font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                    >
                      {{ tpl.body_template }}
                    </div>
                  </div>
                </div>

                <div v-for="grupo in grupos" :key="grupo.categoria" class="mb-2">
                  <div
                    class="group-header d-flex align-items-center justify-content-between py-1"
                    @click="toggle_grupo(grupo.categoria)"
                  >
                    <div class="d-flex align-items-center">
                      <i
                        class="bi me-1 text-muted"
                        :class="grupos_abiertos[grupo.categoria] ? 'bi-chevron-down' : 'bi-chevron-right'"
                      />
                      <small class="fw-semibold">{{ grupo.label }}</small>
                    </div>
                    <small class="text-muted">{{ grupo.templates.length }}</small>
                  </div>

                  <div v-if="grupos_abiertos[grupo.categoria]" class="ps-1">
                    <div
                      v-for="tpl in grupo.templates"
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
              </template>
            </div>

          </div>

          <!-- Check propio de cada programado, apagado por default -->
          <div class="form-check mb-3">
            <input
              id="schedule_cancel_if_replies"
              v-model="cancel_if_lead_replies"
              class="form-check-input"
              type="checkbox"
            />
            <label class="form-check-label small" for="schedule_cancel_if_replies">
              Cancelar si el lead responde antes
            </label>
            <small class="text-muted d-block">
              Si el lead escribe entre ahora y la hora del envío, el mensaje se descarta en vez de
              salir. Apagado, sale igual.
            </small>
          </div>

          <!-- Error del backend (422): se muestra acá adentro y el modal no se cierra -->
          <div v-if="error_message" class="alert alert-danger py-2 px-3 small mb-3" role="alert">
            {{ error_message }}
          </div>

          <button
            type="button"
            class="btn btn-success w-100"
            :disabled="guardando || !can_submit"
            @click="on_submit"
          >
            <span v-if="guardando" class="spinner-border spinner-border-sm me-2" />
            <i v-else class="bi bi-clock me-2" />
            {{ is_editing ? 'Guardar cambios' : 'Programar envío' }}
          </button>

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
 * Fallback defensivo de variables cuando el backend todavía no envía `tpl.variables`.
 * Copiado de TemplatePickerModal.vue junto con toda la mecánica de selección de plantilla
 * (ver el comentario grande más abajo).
 */
const FALLBACK_VARIABLE_MAP = [
  { placeholder: '{{1}}', field: 'contact_name',    label: 'Nombre del contacto',      ai_suggestable: false },
  { placeholder: '{{2}}', field: 'demo_start_time', label: 'Hora de la demo (HH:MM)',  ai_suggestable: false },
]

/** Tope de mensaje de la Cloud API de WhatsApp; el backend valida lo mismo. */
const MAX_CONTENT_LENGTH = 4096

/** Cuánto para adelante se puede programar (freno #5 del backend). */
const MAX_DAYS_AHEAD = 30

/**
 * Valor de un placeholder resuelto desde el lead. Copiado de TemplatePickerModal.vue: el
 * recorte de `contact_name` a la primera palabra es el nombre que ve el LEAD en el saludo
 * (decisión de Lucas, 8/9/2026) y espeja Lead::getContactFirstNameAttribute() del backend.
 *
 * @param {Object} lead
 * @param {string|null} field
 * @returns {string}
 */
function resolve_lead_field_value(lead, field) {
  if (!field) return ''
  const raw = lead?.[field] || ''
  if (field === 'contact_name') {
    return String(raw).trim().split(/\s+/)[0] || ''
  }
  return raw
}

/**
 * Dos dígitos con cero adelante.
 *
 * @param {number} n
 * @returns {string}
 */
function pad_two(n) {
  return n < 10 ? '0' + n : String(n)
}

/**
 * Formatea un Date al valor que espera `<input type="datetime-local">` (hora LOCAL, sin zona).
 * No se puede usar toISOString(): eso pasa a UTC y corre la hora tres horas.
 *
 * @param {Date} d
 * @returns {string} "YYYY-MM-DDTHH:mm"
 */
function to_datetime_local(d) {
  if (!d || isNaN(d.getTime())) return ''
  return (
    d.getFullYear() + '-' + pad_two(d.getMonth() + 1) + '-' + pad_two(d.getDate())
    + 'T' + pad_two(d.getHours()) + ':' + pad_two(d.getMinutes())
  )
}

/**
 * Convierte un Date a ISO 8601 CON offset local ("2026-09-11T16:00:00-03:00"), que es lo que
 * espera el endpoint. Igual que arriba: toISOString() mandaría UTC y el backend guardaría
 * una hora distinta de la que el operador vio en pantalla.
 *
 * @param {Date} d
 * @returns {string}
 */
function to_iso_with_offset(d) {
  /* getTimezoneOffset() devuelve minutos a RESTAR para llegar a UTC: en Argentina, +180. */
  const offset_minutes = -d.getTimezoneOffset()
  const sign = offset_minutes >= 0 ? '+' : '-'
  const abs_minutes = Math.abs(offset_minutes)
  return (
    d.getFullYear() + '-' + pad_two(d.getMonth() + 1) + '-' + pad_two(d.getDate())
    + 'T' + pad_two(d.getHours()) + ':' + pad_two(d.getMinutes()) + ':00'
    + sign + pad_two(Math.floor(abs_minutes / 60)) + ':' + pad_two(abs_minutes % 60)
  )
}

/**
 * Etiqueta legible de un momento ("hoy a las 17:00", "mañana a las 17:00",
 * "el 12/09/2026 a las 17:00"). Mismo criterio de cercanía que los divisores del hilo.
 *
 * @param {number} ms
 * @returns {string}
 */
function format_when(ms) {
  if (!ms) return ''
  const at = new Date(ms)
  if (isNaN(at.getTime())) return ''

  const at_midnight = new Date(at.getTime())
  at_midnight.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diff_days = Math.round((at_midnight - today) / 86400000)
  const time = pad_two(at.getHours()) + ':' + pad_two(at.getMinutes())

  if (diff_days === 0) return 'hoy a las ' + time
  if (diff_days === 1) return 'mañana a las ' + time
  if (diff_days === -1) return 'ayer a las ' + time
  return 'el ' + at.toLocaleDateString('es-AR') + ' a las ' + time
}

/**
 * Modal para programar (o editar) el envío de un mensaje de WhatsApp a un lead.
 *
 * 🔴 El modo NO lo elige el operador: lo decide la fecha. Si el envío cae antes de que venza
 * la ventana de 24 hs de Meta, aparece el textarea de texto libre; si la supera, el textarea
 * se reemplaza por el selector de plantilla. Cambiar la fecha cambia el formulario en vivo.
 *
 * La ventana se recibe ya calculada por prop desde LeadConversationView.vue (mismo
 * `last_lead_inbound_at_ms` que alimenta su computed `whatsapp_window_open`), justamente para
 * que no existan dos definiciones de "hasta cuándo se puede escribir libre" en la SPA. La
 * autoridad final igual es el backend, que revalida con WhatsappSessionWindowService y puede
 * devolver 422; ese mensaje se muestra acá adentro sin cerrar el modal.
 *
 * ⚠️ Toda la mecánica de selección de plantilla —lista con buscador, sugeridas por estado,
 * grupos por categoría, preview con variables reemplazadas, variables faltantes y el botón
 * "Sugerir con IA"— está COPIADA de `TemplatePickerModal.vue`. Se copió en vez de extraerse a
 * un componente compartido porque extraerla obligaba a tocar ese archivo (que hoy anda) dentro
 * de esta misión; es el mismo criterio con el que `PendingOutgoingBubble.vue` copió los
 * estilos de `MessageBubble.vue`. **Si el selector cambia allá, hay que replicarlo acá.**
 */
export default {
  name: 'ScheduleMessageModal',

  props: {
    /** Lead completo (necesita `id`, `status`, `contact_name`, `demo_start_time`). */
    lead: {
      type: Object,
      required: true,
    },
    /**
     * Momento en que vence la ventana de 24 hs de WhatsApp, en milisegundos. 0 = el lead
     * nunca escribió y la ventana está cerrada (solo plantilla, cualquiera sea la fecha).
     */
    window_expires_at_ms: {
      type: Number,
      default: 0,
    },
  },

  emits: ['saved'],

  data() {
    return {
      /* Fecha y hora elegidas, en el formato del input datetime-local (hora local). */
      scheduled_at_local: '',
      /* Texto libre del mensaje (modo texto_libre). */
      content: '',
      /* Check de Lucas: apagado por default, siempre. */
      cancel_if_lead_replies: false,
      /* Plantilla elegida (modo plantilla); null = mostrar la lista. */
      selected_template: null,
      /* Variables de la plantilla que el lead no tiene resueltas y hay que completar. */
      empty_variables: [],
      /* Id del programado que se está editando; null = alta nueva. */
      editing_id: null,
      /* true mientras el POST/PUT está en vuelo. */
      guardando: false,
      /* Mensaje de error del backend (422) mostrado adentro del modal. */
      error_message: '',
      /* Texto del buscador de plantillas. */
      search_text: '',
      /* Estado de apertura de cada grupo de categoría. */
      grupos_abiertos: { recuperacion: true },
      /* Momento de apertura del modal: fija el mínimo del input sin moverse mientras se edita. */
      opened_at_ms: 0,
      /* Plantilla a preseleccionar en modo edición, hasta que el store termine de cargarlas. */
      pending_template_name: '',
      /* Valores guardados de esa plantilla, para reponer las variables completadas a mano. */
      pending_template_variables: null,
    }
  },

  computed: {
    /**
     * true si el modal está editando un programado existente.
     *
     * @returns {boolean}
     */
    is_editing() {
      return this.editing_id != null
    },

    /**
     * Fecha y hora elegidas, en milisegundos. 0 si el input está vacío o es inválido.
     *
     * @returns {number}
     */
    scheduled_at_ms() {
      if (!this.scheduled_at_local) return 0
      const parsed = new Date(this.scheduled_at_local).getTime()
      return isNaN(parsed) ? 0 : parsed
    },

    /**
     * 🔴 El modo se decide solo: dentro de la ventana se puede texto libre, fuera solo plantilla.
     *
     * @returns {boolean}
     */
    is_within_window() {
      if (!this.window_expires_at_ms || !this.scheduled_at_ms) return false
      return this.scheduled_at_ms < this.window_expires_at_ms
    },

    /**
     * Modo que se le manda al backend, derivado de la fecha.
     *
     * @returns {string} 'texto_libre' | 'plantilla'
     */
    mode() {
      return this.is_within_window ? 'texto_libre' : 'plantilla'
    },

    /** Cuándo vence la ventana de 24 hs, en texto. @returns {string} */
    window_expires_label() {
      return format_when(this.window_expires_at_ms)
    },

    /** Mínimo del input: el momento en que se abrió el modal. @returns {string} */
    min_datetime_local() {
      return to_datetime_local(new Date(this.opened_at_ms || Date.now()))
    },

    /** Máximo del input: 30 días para adelante. @returns {string} */
    max_datetime_local() {
      const base = this.opened_at_ms || Date.now()
      return to_datetime_local(new Date(base + MAX_DAYS_AHEAD * 86400000))
    },

    /**
     * true si el formulario está completo y se puede mandar.
     *
     * @returns {boolean}
     */
    can_submit() {
      if (!this.lead || !this.lead.id) return false
      if (!this.scheduled_at_ms) return false
      if (this.mode === 'texto_libre') {
        const text = (this.content || '').trim()
        return text.length > 0 && text.length <= MAX_CONTENT_LENGTH
      }
      return Boolean(this.selected_template) && !this.has_empty_required
    },

    /* ---------------------------------------------------------------------------------
       De acá para abajo: mecánica de plantillas copiada de TemplatePickerModal.vue.
       --------------------------------------------------------------------------------- */

    /** Estado del pipeline del lead. @returns {string} */
    lead_estado() {
      return this.lead?.status || ''
    },

    /** Todas las plantillas del store. @returns {Array} */
    all_templates() {
      return this.$store.state.followup_template.models || []
    },

    /** Solo las plantillas con flag `activa`. @returns {Array} */
    todas_activas() {
      return this.all_templates.filter((t) => t.activa)
    },

    /** Plantillas activas del estado actual del lead. @returns {Array} */
    sugeridas() {
      return this.todas_activas.filter((t) => t.estado === this.lead_estado)
    },

    /** true si el buscador tiene texto. @returns {boolean} */
    is_searching() {
      return this.search_text.trim().length > 0
    },

    /** Plantillas que matchean el buscador por nombre o cuerpo. @returns {Array} */
    filtered_templates() {
      const query = this.search_text.trim().toLowerCase()
      if (!query) return []
      return this.todas_activas.filter((tpl) => {
        const name = (tpl.template_name || '').toLowerCase()
        const body = (tpl.body_template || '').toLowerCase()
        return name.includes(query) || body.includes(query)
      })
    },

    /**
     * Plantillas activas agrupadas por categoría, ordenadas por `categoria_orden` y `dia_numero`.
     *
     * @returns {Array<{categoria: string, label: string, orden: number, templates: Array}>}
     */
    grupos() {
      const map = {}

      this.todas_activas.forEach((tpl) => {
        const categoria = tpl.categoria || 'otros'
        if (!map[categoria]) {
          map[categoria] = {
            categoria,
            label: tpl.categoria_label || 'Otras plantillas',
            orden: tpl.categoria_orden != null ? tpl.categoria_orden : 99,
            templates: [],
          }
        }
        map[categoria].templates.push(tpl)
      })

      const grupos_list = Object.values(map)
      grupos_list.forEach((g) => {
        g.templates.sort((a, b) => (a.dia_numero || 0) - (b.dia_numero || 0))
      })
      grupos_list.sort((a, b) => a.orden - b.orden)
      return grupos_list
    },

    /**
     * Variables de la plantilla elegida tal como las expone el backend, con fallback.
     *
     * @returns {Array<{placeholder: string, field: string|null, label: string, ai_suggestable: boolean}>}
     */
    active_variables() {
      if (!this.selected_template) return []

      const vars = this.selected_template.variables
      if (Array.isArray(vars) && vars.length > 0) return vars

      const body = this.selected_template.body_template || ''
      return FALLBACK_VARIABLE_MAP.filter((v) => body.includes(v.placeholder))
    },

    /** Texto de la plantilla con las variables ya reemplazadas. @returns {string} */
    preview_text() {
      if (!this.selected_template?.body_template) return ''

      let text = this.selected_template.body_template

      this.active_variables.forEach(({ placeholder, field }) => {
        let value = field ? resolve_lead_field_value(this.lead, field) : ''
        const override = this.empty_variables.find((v) => v.placeholder === placeholder)
        if (override && override.value) value = override.value
        text = text.replaceAll(placeholder, value)
      })

      return text
    },

    /** true si queda alguna variable obligatoria sin completar. @returns {boolean} */
    has_empty_required() {
      return this.empty_variables.some((v) => !v.value || v.value.trim() === '')
    },

    /** Valores de las variables en orden ({{1}}, {{2}}, ...). @returns {string[]} */
    resolved_variables() {
      const result = []

      this.active_variables.forEach(({ placeholder, field }) => {
        const manual = this.empty_variables.find((v) => v.placeholder === placeholder)
        if (manual) {
          result.push(manual.value || '')
        } else {
          result.push(field ? resolve_lead_field_value(this.lead, field) : '')
        }
      })

      return result
    },
  },

  watch: {
    /**
     * Cambiar la fecha limpia el error del backend: casi siempre el 422 era justamente por
     * la ventana, y dejarlo en pantalla hace pensar que el formulario sigue mal.
     *
     * @returns {void}
     */
    scheduled_at_local() {
      this.error_message = ''
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
     * Abre el modal. Sin argumento es un alta nueva; con un programado existente entra en
     * modo edición y precarga fecha, texto o plantilla, y el check.
     *
     * @param {Object|null} [scheduled] fila de `lead.scheduled_messages` a editar
     * @returns {void}
     */
    open(scheduled) {
      this.reset()

      if (scheduled && scheduled.id) {
        this.editing_id = scheduled.id
        this.scheduled_at_local = to_datetime_local(new Date(scheduled.scheduled_send_at))
        this.cancel_if_lead_replies = Boolean(scheduled.cancel_if_lead_replies)
        /* El content se precarga siempre: si era plantilla y el operador adelanta la fecha
           para adentro de la ventana, arranca con ese mismo texto en vez de con nada. */
        this.content = scheduled.content || ''
        if (scheduled.mode === 'plantilla') {
          this.pending_template_name = scheduled.template_name || ''
          this.pending_template_variables = scheduled.template_variables || null
        }
      } else {
        this.scheduled_at_local = to_datetime_local(new Date(this.default_send_at_ms()))
      }

      /* Cargar plantillas si el store está vacío; recién ahí se puede preseleccionar. */
      if (this.all_templates.length === 0) {
        this.$store
          .dispatch('followup_template/fetch')
          .then(() => {
            this.try_preselect_template()
          })
          .catch(() => {
            /* Silencioso: la lista queda vacía y el botón de confirmar sigue deshabilitado. */
          })
      } else {
        this.try_preselect_template()
      }

      const modal = Modal.getOrCreateInstance(this.$refs.modal_el)
      modal.show()
    },

    /**
     * Cierra el modal programáticamente.
     *
     * @returns {void}
     */
    close() {
      const modal = Modal.getInstance(this.$refs.modal_el)
      if (modal) modal.hide()
    },

    /**
     * Deja el formulario en blanco. Se llama en cada apertura para que no queden restos de
     * la vez anterior (sobre todo al pasar de editar uno a crear otro).
     *
     * @returns {void}
     */
    reset() {
      this.scheduled_at_local = ''
      this.content = ''
      this.cancel_if_lead_replies = false
      this.selected_template = null
      this.empty_variables = []
      this.editing_id = null
      this.guardando = false
      this.error_message = ''
      this.search_text = ''
      this.pending_template_name = ''
      this.pending_template_variables = null
      this.opened_at_ms = Date.now()
    },

    /**
     * Fecha sugerida al abrir un alta nueva: dentro de tres horas si eso todavía cae en la
     * ventana de 24 hs (el caso más común, y ahí se puede texto libre); si no, mañana a esta
     * misma hora, que es lo que pidió Lucas y sale por plantilla.
     *
     * @returns {number} milisegundos
     */
    default_send_at_ms() {
      const in_three_hours = Date.now() + 3 * 3600000
      if (this.window_expires_at_ms && in_three_hours < this.window_expires_at_ms) {
        return in_three_hours
      }
      return Date.now() + 24 * 3600000
    },

    /**
     * En modo edición de una plantilla: la busca en el store, la selecciona y repone los
     * valores que el operador había completado a mano.
     *
     * @returns {void}
     */
    try_preselect_template() {
      if (!this.pending_template_name) {
        return
      }
      const name = this.pending_template_name
      const tpl = this.all_templates.find((t) => t.template_name === name)
      if (!tpl) {
        /* La plantilla ya no está en el listado: queda la lista abierta para elegir otra. */
        this.pending_template_name = ''
        this.pending_template_variables = null
        return
      }

      this.on_select(tpl)

      /* Reponer los valores guardados sobre las variables que quedaron para completar. */
      const saved = this.pending_template_variables || []
      this.empty_variables.forEach((v) => {
        const idx = this.active_variables.findIndex((av) => av.placeholder === v.placeholder)
        if (idx !== -1 && saved[idx]) {
          v.value = saved[idx]
        }
      })

      this.pending_template_name = ''
      this.pending_template_variables = null
    },

    /**
     * Pliega/despliega un grupo de categoría.
     *
     * @param {string} categoria slug de la categoría
     * @returns {void}
     */
    toggle_grupo(categoria) {
      this.grupos_abiertos[categoria] = !this.grupos_abiertos[categoria]
    },

    /**
     * Selecciona una plantilla y detecta qué variables hay que completar a mano.
     * Copiado de TemplatePickerModal.vue.
     *
     * @param {Object} tpl
     * @returns {void}
     */
    on_select(tpl) {
      this.selected_template = tpl
      this.empty_variables = []

      if (!tpl.body_template) return

      this.active_variables.forEach(({ placeholder, field, label, ai_suggestable }) => {
        const value = resolve_lead_field_value(this.lead, field)
        if (!value) {
          this.empty_variables.push({
            placeholder,
            label,
            value: '',
            ai_suggestable: !!ai_suggestable,
            loading: false,
            error: '',
          })
        }
      })
    },

    /**
     * Pide a la IA una redacción del motivo de la demora. Copiado de TemplatePickerModal.vue.
     *
     * @param {Object} v entrada de `empty_variables` con `ai_suggestable: true`
     * @returns {void}
     */
    on_suggest_motivo(v) {
      v.loading = true
      v.error = ''

      api.post('/lead/' + this.lead.id + '/suggest-recovery-reason')
        .then((res) => {
          v.value = res.data?.motivo || ''
        })
        .catch(() => {
          v.error = 'No se pudo sugerir el motivo, escribilo a mano'
        })
        .finally(() => {
          v.loading = false
        })
    },

    /**
     * Confirma el alta o la edición del envío programado.
     *
     * @returns {void}
     */
    on_submit() {
      if (!this.can_submit || this.guardando) {
        return
      }

      this.error_message = ''

      /* Frenos locales: el backend los repite, pero avisar acá evita un ida y vuelta. */
      const now_ms = Date.now()
      if (this.scheduled_at_ms <= now_ms) {
        this.error_message = 'La fecha del envío ya pasó: elegí un momento futuro.'
        return
      }
      if (this.scheduled_at_ms > now_ms + MAX_DAYS_AHEAD * 86400000) {
        this.error_message = 'No se puede programar a más de ' + MAX_DAYS_AHEAD + ' días.'
        return
      }

      const payload = {
        lead_id:                this.lead.id,
        scheduled_send_at:      to_iso_with_offset(new Date(this.scheduled_at_ms)),
        mode:                   this.mode,
        content:                this.mode === 'plantilla' ? this.preview_text : this.content.trim(),
        cancel_if_lead_replies: this.cancel_if_lead_replies,
      }

      if (this.mode === 'plantilla') {
        payload.template_name      = this.selected_template.template_name
        payload.template_language  = this.selected_template.language_code || 'es_AR'
        payload.template_variables = this.resolved_variables
      }

      const action = this.is_editing ? 'lead/update_scheduled_message' : 'lead/schedule_message'
      if (this.is_editing) {
        payload.scheduled_id = this.editing_id
      }

      this.guardando = true
      this.$store
        .dispatch(action, payload)
        .then((model) => {
          this.close()
          this.$emit('saved', model)
        })
        .catch((err) => {
          /* 422 de los frenos del backend: se muestra adentro y el modal NO se cierra. */
          this.error_message =
            err?.response?.data?.message
            || err?.message
            || 'No se pudo programar el envío.'
        })
        .finally(() => {
          this.guardando = false
        })
    },
  },
}
</script>

<style scoped>
/* Ítems de plantilla de la lista (copiado de TemplatePickerModal.vue) */
.template-item {
  cursor: pointer;
  transition: background-color 0.15s;
}
.template-item:hover {
  background-color: var(--bs-gray-100);
}

/* Cabecera de grupo plegable */
.group-header {
  cursor: pointer;
}
.group-header:hover small.fw-semibold {
  color: var(--bs-primary);
}
</style>
