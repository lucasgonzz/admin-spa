<template>
  <div v-if="draft" class="lead-demo-config">
    <!-- Campos que viajan con el Guardar del modal: escriben directo en el borrador. -->
    <div class="row g-3">
      <div class="col-12 col-md-6 col-xl-4">
        <label class="form-label mb-1" for="lead_demo_config_demo_id">Demo asignada</label>
        <select
          id="lead_demo_config_demo_id"
          v-model="draft.demo_id"
          class="form-select"
          :disabled="cargando_demos"
        >
          <option :value="null">— Sin demo asignada —</option>
          <option v-for="o in demo_options" :key="'demo-opt-' + o.value" :value="o.value">{{ o.text }}</option>
        </select>
        <small v-if="cargando_demos" class="form-text text-muted">Cargando instancias…</small>
        <small v-else-if="error_demos" class="form-text text-danger">No se pudo cargar la lista de instancias.</small>
      </div>
      <div class="col-12 col-sm-6 col-md-6 col-xl-3">
        <label class="form-label mb-1" for="lead_demo_config_date">Fecha</label>
        <input id="lead_demo_config_date" v-model="draft.demo_date" type="date" class="form-control" />
      </div>
      <div class="col-6 col-sm-3 col-md-3 col-xl-2">
        <label class="form-label mb-1" for="lead_demo_config_start">Hora inicio</label>
        <!-- Texto y no type="time": el campo siempre fue texto libre (HH:MM) y hay valores
             históricos que un control de hora no podría mostrar; con texto nada se pierde. -->
        <input
          id="lead_demo_config_start"
          v-model="draft.demo_start_time"
          type="text"
          class="form-control"
          placeholder="HH:MM"
          inputmode="numeric"
          autocomplete="off"
        />
      </div>
      <div class="col-6 col-sm-3 col-md-3 col-xl-2">
        <label class="form-label mb-1" for="lead_demo_config_end">Hora fin</label>
        <input
          id="lead_demo_config_end"
          v-model="draft.demo_end_time"
          type="text"
          class="form-control"
          placeholder="HH:MM"
          inputmode="numeric"
          autocomplete="off"
        />
      </div>
      <div class="col-12">
        <!-- Mismo toggle que el form genérico (clases de _forms.sass). -->
        <label class="model-form__toggle-row">
          <span class="model-form__toggle">
            <input v-model="draft.demo_flexible" type="checkbox" />
            <span class="model-form__toggle-track"><span class="model-form__toggle-thumb"></span></span>
          </span>
          <span class="model-form__toggle-text">
            Ventana extendida
            <small class="text-muted d-block">Entra cuando puede; sin horario de closer y sin checks automáticos.</small>
          </span>
        </label>
      </div>
    </div>

    <p class="small text-muted mt-2 mb-3">
      <i class="bi bi-info-circle me-1" aria-hidden="true" />
      Estos campos se guardan con el botón <strong>Guardar</strong> del modal.
    </p>

    <!-- Hora de fin "en caliente": endpoint dedicado que valida, corre el vencimiento del token y
         reprograma el check de fin. Solo con la demo agendada o en curso (misma regla que
         Operaciones). -->
    <div v-if="demo_end_editable" class="lead-demo-config__bloque">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <span class="fw-semibold small">Hora de fin vigente</span>
          <span class="small text-muted ms-2">{{ record.demo_end_time || '—' }}</span>
        </div>
        <button
          v-if="!editing_demo_end"
          type="button"
          class="btn btn-outline-secondary btn-sm"
          @click="start_demo_end_edit"
        >
          <i class="bi bi-clock-history me-1" aria-hidden="true" />Cambiar hora de fin
        </button>
      </div>
      <div v-if="editing_demo_end" class="d-flex align-items-center gap-2 flex-wrap mt-2">
        <input
          v-model="demo_end_draft"
          type="time"
          class="form-control form-control-sm lead-demo-config__time"
          :disabled="saving_demo_end"
          aria-label="Nueva hora de fin"
        />
        <button type="button" class="btn btn-sm btn-primary" :disabled="saving_demo_end || !demo_end_draft" @click="save_demo_end">
          <span v-if="saving_demo_end" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
          Guardar fin
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="saving_demo_end" @click="cancel_demo_end_edit">
          Cancelar
        </button>
        <small class="text-muted w-100">
          Cambia la hora de fin ya mismo (sin pasar por Guardar): el acceso del lead y el check de fin acompañan.
        </small>
      </div>
    </div>

    <!-- Estado del demo setup: lo que antes vivía en la etapa 4 de Operaciones. -->
    <div class="lead-demo-config__bloque">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span class="fw-semibold small">Demo setup</span>
          <span class="badge" :class="setup_badge_class">{{ setup_texto }}</span>
          <small v-if="setup_last_run" class="text-muted">{{ setup_last_run }}</small>
        </div>
        <button
          v-if="puede_correr_setup"
          type="button"
          class="btn btn-sm"
          :class="record.demo_setup_status === 'exitoso' ? 'btn-outline-secondary' : 'btn-primary'"
          :disabled="loading_setup"
          :title="!record.demo_id ? 'Primero asigná una demo y guardá' : ''"
          @click="run_demo_setup"
        >
          <span v-if="loading_setup" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
          {{ record.demo_setup_status === 'exitoso' ? 'Volver a correr demo setup' : 'Correr demo setup ahora' }}
        </button>
      </div>
      <!-- 🔴 Con una corrida viva (ejecutandose / sin_confirmar) el botón NO se muestra, misma
           decisión que Operaciones: un segundo clic le haría un migrate:fresh a la base que la
           primera corrida está sembrando. -->
      <small v-if="setup_en_curso" class="text-muted d-block mt-1">
        Hay una corrida en curso; el botón vuelve cuando termine.
      </small>
      <small v-if="record.demo_setup_last_error" class="text-danger d-block mt-1">
        Último error: {{ record.demo_setup_last_error }}
      </small>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import api, { resolve_error_message } from '@/utils/axios'
import { route_string } from '@/utils/route_string'

/** Estados del lead en los que la demo está agendada o en curso (misma lista que Operaciones). */
const ESTADOS_CON_DEMO = [
  'demo_agendada',
  'ingresando_demo',
  'demo_en_curso',
  'demo_pendiente_de_ingreso',
  'demo_pendiente_de_terminar',
]

/**
 * Sub-solapa Configuración de la Demo (misión flujo-lead-landing-closer, 17/10/2026): demo
 * asignada, fecha, hora de inicio y de fin, ventana extendida (todo sobre `draft`, lo guarda el
 * modal), más dos acciones en caliente que antes estaban en Operaciones: el estado del demo setup
 * con "Correr demo setup ahora" y "Cambiar hora de fin".
 *
 * Las instancias del select salen del mismo endpoint que usaba el form genérico para el campo
 * `demo_id` del meta (`GET /{relation}?for_select=1`, etiqueta `relation_label`): se lee la
 * definición del meta para no copiar acá el nombre de la relación ni de la columna.
 */
export default {
  name: 'LeadDemoConfiguracion',
  props: {
    draft: { type: Object, default: null },
    record: { type: Object, default: null },
    all_properties: { type: Array, default: () => [] },
  },
  emits: ['record-updated'],
  data() {
    return {
      /** Opciones del select de instancias: `{ value, text }`. */
      demo_options: [],
      cargando_demos: false,
      error_demos: false,
      /** Acción de setup en vuelo. */
      loading_setup: false,
      /** Editor de la hora de fin en caliente. */
      editing_demo_end: false,
      demo_end_draft: '',
      saving_demo_end: false,
    }
  },
  computed: {
    /**
     * Definición meta de `demo_id`, para la relación y la etiqueta del select.
     * @returns {Object|null}
     */
    demo_id_prop() {
      let encontrada = null
      this.all_properties.forEach(function (p) {
        if (p && p.key === 'demo_id') {
          encontrada = p
        }
      })
      return encontrada
    },
    /**
     * @returns {boolean}
     */
    demo_end_editable() {
      const r = this.record
      if (!r || !r.demo_id || !r.demo_date || !(r.demo_start_time || '').trim()) {
        return false
      }
      return ESTADOS_CON_DEMO.indexOf(r.status) !== -1
    },
    /**
     * @returns {boolean}
     */
    setup_en_curso() {
      const s = this.record ? this.record.demo_setup_status : null
      return s === 'ejecutandose' || s === 'sin_confirmar'
    },
    /**
     * El botón sale solo con demo asignada y sin una corrida viva.
     * @returns {boolean}
     */
    puede_correr_setup() {
      return Boolean(this.record && this.record.id && this.record.demo_id) && !this.setup_en_curso
    },
    /**
     * @returns {string}
     */
    setup_texto() {
      const s = this.record ? this.record.demo_setup_status : null
      if (s === 'exitoso') return 'Exitoso'
      if (s === 'ejecutandose') return 'Ejecutándose'
      if (s === 'sin_confirmar') return 'Sin confirmar'
      if (s === 'fallido') return 'Fallido'
      return 'Pendiente'
    },
    /**
     * Misma paleta que el panel "Demos agendadas": `sin_confirmar` comparte el amarillo con
     * `ejecutandose` porque los dos son una corrida viva.
     * @returns {string}
     */
    setup_badge_class() {
      const s = this.record ? this.record.demo_setup_status : null
      if (s === 'exitoso') return 'bg-success'
      if (s === 'ejecutandose' || s === 'sin_confirmar') return 'bg-warning text-dark'
      if (s === 'fallido') return 'bg-danger'
      return 'bg-secondary'
    },
    /**
     * "Última corrida: 17/10/2026 10:32 · manual".
     * @returns {string}
     */
    setup_last_run() {
      const r = this.record
      if (!r || !r.demo_setup_last_run_at) {
        return ''
      }
      const m = moment(r.demo_setup_last_run_at)
      if (!m.isValid()) {
        return ''
      }
      let texto = 'Última corrida: ' + m.format('DD/MM/YYYY HH:mm')
      if (r.demo_setup_last_run_manual === true) {
        texto += ' · manual'
      } else if (r.demo_setup_last_run_manual === false) {
        texto += ' · automática'
      }
      return texto
    },
  },
  mounted() {
    this.cargar_demos()
  },
  methods: {
    /**
     * Instancias de demo para el select, con la relación y la etiqueta que declara el meta.
     */
    cargar_demos() {
      const prop = this.demo_id_prop || {}
      const relation = prop.relation || 'demo'
      const label_key = prop.relation_label || 'erp_spa_url'
      const self = this
      this.cargando_demos = true
      this.error_demos = false
      api.get('/' + route_string(relation) + '?for_select=1')
        .then(function (res) {
          const payload = res.data || {}
          let models = []
          if (Array.isArray(payload.models)) {
            models = payload.models
          } else if (payload.models && Array.isArray(payload.models.data)) {
            models = payload.models.data
          }
          self.demo_options = models
            .filter(function (m) { return m && m.id != null })
            .map(function (m) {
              return { value: m.id, text: m[label_key] != null ? String(m[label_key]) : ('ID ' + m.id) }
            })
        })
        .catch(function () {
          self.error_demos = true
        })
        .then(function () {
          self.cargando_demos = false
        })
    },
    /**
     * Dispara el setup en la instancia asignada. El backend devuelve el lead; el modal lo vuelca
     * al borrador y `Leads.vue` a la lista.
     */
    run_demo_setup() {
      if (!this.puede_correr_setup || this.loading_setup) {
        return
      }
      const self = this
      this.loading_setup = true
      this.$store.dispatch('lead/run_demo_setup', this.record.id)
        .then(function (model) {
          self.$emit('record-updated', model)
          self.toast('Demo setup disparado.')
        })
        .catch(function (error) {
          /* Algunas acciones devuelven 422 con el modelo actualizado en el payload. */
          const payload = error && error.response && error.response.data ? error.response.data : null
          if (payload && payload.model) {
            self.$emit('record-updated', payload.model)
          }
          self.toast(resolve_error_message(error))
        })
        .then(function () {
          self.loading_setup = false
        })
    },
    /**
     * Abre el editor de la hora de fin con el valor vigente normalizado a HH:MM.
     */
    start_demo_end_edit() {
      const actual = String(this.record.demo_end_time || '')
      const match = actual.match(/(\d{1,2}):(\d{2})/)
      this.demo_end_draft = match ? ('0' + match[1]).slice(-2) + ':' + match[2] : ''
      this.editing_demo_end = true
    },
    cancel_demo_end_edit() {
      this.editing_demo_end = false
      this.demo_end_draft = ''
    },
    /**
     * POST /lead/{id}/demo-end-time: el backend valida (fin > inicio, mismo día, demo vigente) y
     * devuelve el lead.
     */
    save_demo_end() {
      if (!this.demo_end_draft || this.saving_demo_end) {
        return
      }
      const self = this
      this.saving_demo_end = true
      api.post('/lead/' + this.record.id + '/demo-end-time', { demo_end_time: this.demo_end_draft })
        .then(function (res) {
          const payload = res && res.data ? res.data : {}
          if (payload.model) {
            self.$emit('record-updated', payload.model)
          }
          self.editing_demo_end = false
          self.demo_end_draft = ''
          self.toast('Hora de fin actualizada. El acceso del lead acompaña al fin nuevo.')
        })
        .catch(function (error) {
          self.toast(resolve_error_message(error))
        })
        .then(function () {
          self.saving_demo_end = false
        })
    },
    /**
     * @param {string} mensaje
     */
    toast(mensaje) {
      if (this.$root && this.$root.$emit) {
        this.$root.$emit('open_toast', mensaje)
      }
    },
  },
}
</script>

<style scoped>
.lead-demo-config__bloque {
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.5rem;
  background: var(--bs-tertiary-bg, #f8f9fa);
}

.lead-demo-config__bloque + .lead-demo-config__bloque {
  margin-top: 0.75rem;
}

.lead-demo-config__time {
  width: 8rem;
}
</style>
