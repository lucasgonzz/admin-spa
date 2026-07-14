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
                <div class="d-flex gap-2 align-items-start">
                  <input
                    v-model="v.value"
                    type="text"
                    class="form-control form-control-sm"
                    :placeholder="v.placeholder"
                  />
                  <!-- Botón de sugerencia por IA: solo para variables marcadas como ai_suggestable -->
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
                <!-- Texto de error discreto si la sugerencia por IA falló -->
                <small v-if="v.error" class="text-danger d-block mt-1">{{ v.error }}</small>
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

            <!-- Buscador de plantillas por nombre o texto del cuerpo -->
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

            <!-- Modo búsqueda: lista plana de resultados, se ignoran sugeridas y grupos -->
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

            <!-- Modo normal: sugeridas + grupos plegables por categoría -->
            <template v-else>

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

              <!-- Grupos plegables por categoría (accessors categoria/categoria_label/categoria_orden) -->
              <div v-for="grupo in grupos" :key="grupo.categoria" class="mb-2">
                <!-- Cabecera de grupo: discreta, clickeable para plegar/desplegar -->
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

                <!-- Plantillas del grupo, solo si está abierto -->
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

      </div>
    </div>
    </div>
  </Teleport>
</template>

<script>
import { Modal } from 'bootstrap'
import api from '@/utils/axios'

/**
 * Fallback defensivo de variables cuando el backend todavía no envía `tpl.variables`
 * (plantilla sin body, o admin-api desactualizado). Reproduce el comportamiento
 * anterior a este componente: {{1}} = nombre de contacto, {{2}} = hora de la demo.
 */
const FALLBACK_VARIABLE_MAP = [
  { placeholder: '{{1}}', field: 'contact_name',    label: 'Nombre del contacto',      ai_suggestable: false },
  { placeholder: '{{2}}', field: 'demo_start_time', label: 'Hora de la demo (HH:MM)',  ai_suggestable: false },
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
      /* Texto de búsqueda del buscador de plantillas. Si tiene contenido, se aplanan los grupos. */
      search_text: '',
      /* Estado de apertura de cada grupo de categoría (clave = slug de categoria). */
      grupos_abiertos: { recuperacion: true },
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
     * Indica si el buscador tiene texto cargado: en ese caso se aplanan
     * sugeridas + grupos y se muestra únicamente la lista de resultados.
     *
     * @returns {boolean}
     */
    is_searching() {
      return this.search_text.trim().length > 0
    },

    /**
     * Plantillas activas cuyo nombre o cuerpo matchea el texto del buscador
     * (comparación en minúsculas, sin distinción de mayúsculas).
     *
     * @returns {Array}
     */
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
     * Plantillas activas agrupadas por `categoria`, ordenadas por `categoria_orden`
     * (grupo) y por `dia_numero` (plantillas dentro del grupo).
     *
     * @returns {Array<{categoria: string, label: string, orden: number, templates: Array}>}
     */
    grupos() {
      /* Acumulador por slug de categoria. */
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

      /* Plantillas dentro de cada grupo, ordenadas por día de seguimiento. */
      grupos_list.forEach((g) => {
        g.templates.sort((a, b) => (a.dia_numero || 0) - (b.dia_numero || 0))
      })

      /* Grupos ordenados según el criterio de presentación del backend. */
      grupos_list.sort((a, b) => a.orden - b.orden)

      return grupos_list
    },

    /**
     * Variables de la plantilla seleccionada, tal como las expone el backend
     * (`tpl.variables`, prompt 389). Si no vienen (backend viejo o plantilla
     * sin body), cae al mapeo defensivo `FALLBACK_VARIABLE_MAP`.
     *
     * @returns {Array<{placeholder: string, field: string|null, label: string, ai_suggestable: boolean}>}
     */
    active_variables() {
      if (!this.selected_template) return []

      const vars = this.selected_template.variables
      if (Array.isArray(vars) && vars.length > 0) return vars

      /* Fallback: solo incluir del mapeo legacy los placeholders que aparecen en el body. */
      const body = this.selected_template.body_template || ''
      return FALLBACK_VARIABLE_MAP.filter((v) => body.includes(v.placeholder))
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

      this.active_variables.forEach(({ placeholder, field }) => {
        /* Valor resuelto automáticamente desde el lead (si corresponde). */
        let value = field ? (this.lead?.[field] || '') : ''

        /* Los overrides manuales/IA cargados en empty_variables tienen prioridad. */
        const override = this.empty_variables.find((v) => v.placeholder === placeholder)
        if (override && override.value) value = override.value

        text = text.replaceAll(placeholder, value)
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
      const result = []

      this.active_variables.forEach(({ placeholder, field }) => {
        /* Buscar si el usuario completó (a mano o con IA) este placeholder manualmente. */
        const manual = this.empty_variables.find((v) => v.placeholder === placeholder)
        if (manual) {
          result.push(manual.value || '')
        } else {
          result.push(field ? (this.lead?.[field] || '') : '')
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
      this.search_text = ''

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
     * Pliega/despliega un grupo de categoría al hacer click en su cabecera.
     *
     * @param {string} categoria slug de la categoría a alternar
     */
    toggle_grupo(categoria) {
      this.grupos_abiertos[categoria] = !this.grupos_abiertos[categoria]
    },

    /**
     * Selecciona una plantilla y detecta qué variables están vacías en el lead.
     * Las variables vacías (o sin `field`, como el motivo sugerido por IA) se agregan
     * a `empty_variables` para que el usuario las complete.
     *
     * @param {Object} tpl Plantilla seleccionada por el usuario.
     */
    on_select(tpl) {
      this.selected_template = tpl
      this.empty_variables = []

      if (!tpl.body_template) return

      /* Recorrer las variables de la plantilla y detectar cuáles faltan resolver. */
      this.active_variables.forEach(({ placeholder, field, label, ai_suggestable }) => {
        /* Si tiene field y el lead trae el dato, se resuelve sola: no se pide nada al admin. */
        const value = field ? (this.lead?.[field] || '') : ''
        if (!value) {
          this.empty_variables.push({
            placeholder,
            label,
            value: '',
            /* Habilita el botón "Sugerir con IA" cuando el backend lo marca. */
            ai_suggestable: !!ai_suggestable,
            /* Estado local del botón de IA para esta variable puntual. */
            loading: false,
            /* Mensaje de error discreto si la sugerencia de IA falla. */
            error: '',
          })
        }
      })
    },

    /**
     * Pide a la IA (endpoint del prompt 390) una redacción sugerida del motivo
     * de la demora y la vuelca en el input de la variable, que el admin puede
     * seguir editando a mano antes de enviar.
     *
     * @param {Object} v entrada de `empty_variables` con `ai_suggestable: true`
     */
    on_suggest_motivo(v) {
      v.loading = true
      v.error = ''

      api.post('/lead/' + this.lead.id + '/suggest-recovery-reason')
        .then((res) => {
          v.value = res.data?.motivo || ''
        })
        .catch(() => {
          /* No romper el flujo ni cerrar el modal: dejar el input libre para completar a mano. */
          v.error = 'No se pudo sugerir el motivo, escribilo a mano'
        })
        .finally(() => {
          v.loading = false
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

/* Cabecera de grupo plegable: discreta, sin bordes, cursor de interacción */
.group-header {
  cursor: pointer;
}
.group-header:hover small.fw-semibold {
  color: var(--bs-primary);
}
</style>
