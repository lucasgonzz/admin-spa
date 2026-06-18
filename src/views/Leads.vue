<template>
  <div>
    <resource-view
      model_name="lead"
      :model_extra_tabs="model_extra_tabs"
      @extra-record-updated="on_record_updated"
    >
      <template #right>
        <!-- Botón toggle para el panel de demos del día -->
        <button
          type="button"
          class="btn btn-sm me-2"
          :class="show_demos_hoy ? 'btn-primary' : 'btn-outline-primary'"
          @click="on_toggle_demos_hoy"
        >
          <i class="bi bi-calendar-check me-1" /> Demos de hoy
        </button>
        <button type="button" class="btn btn-outline-primary btn-sm" @click="on_open_demo_modal">
          <i class="bi bi-window-sidebar me-1" /> Gestionar demos
        </button>
      </template>

      <template #header>
        <!-- Panel de demos del día: visible solo cuando el toggle está activo -->
        <div v-if="show_demos_hoy" class="card mt-3 mb-3">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h6 class="card-title mb-0">
                <i class="bi bi-calendar-check me-1" />
                Demos de hoy
              </h6>
              <!-- Botón para refrescar la lista manualmente -->
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                :disabled="loading_demos_hoy"
                @click="load_demos_hoy"
              >
                <i class="bi bi-arrow-clockwise" />
              </button>
            </div>

            <!-- Estado de carga -->
            <p v-if="loading_demos_hoy" class="text-muted small mb-0">Cargando demos...</p>

            <!-- Sin demos hoy -->
            <p v-else-if="!demos_hoy.length" class="text-muted small mb-0">No hay demos agendadas para hoy.</p>

            <!-- Tabla de demos del día ordenadas por hora de inicio -->
            <table v-else class="table table-sm table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th class="small">Hora inicio</th>
                  <th class="small">Llamar a las</th>
                  <th class="small">Lead</th>
                  <th class="small">Empresa</th>
                  <th class="small">Estado setup</th>
                  <th class="small">Resumen IA</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="lead in demos_hoy" :key="lead.id">
                  <!-- Hora de inicio de la demo -->
                  <td class="small">{{ lead.demo_start_time || '—' }}</td>
                  <!-- Hora estimada de llamada = inicio + duración configurada -->
                  <td class="small fw-semibold text-primary">{{ calc_llamar_a_las(lead) }}</td>
                  <!-- Nombre del contacto -->
                  <td class="small">{{ lead.contact_name || '(sin nombre)' }}</td>
                  <!-- Empresa -->
                  <td class="small">{{ lead.company_name || '—' }}</td>
                  <!-- Estado del demo setup -->
                  <td class="small">
                    <span
                      class="badge"
                      :class="demo_setup_badge_class(lead.demo_setup_status)"
                    >{{ lead.demo_setup_status || '—' }}</span>
                  </td>
                  <!-- Indicador de resumen IA disponible -->
                  <td class="small">
                    <span v-if="lead.demo_summary" class="badge bg-success">
                      <i class="bi bi-stars me-1" /> Disponible
                    </span>
                    <span v-else class="text-muted">Pendiente</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </resource-view>

    

    <base-modal
      :show="show_demo_modal"
      title="Gestión de demos"
      size="xl"
      @update:show="on_update_demo_modal"
      @close="on_close_demo_modal"
    >
      <resource-view model_name="demo" />
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="on_close_demo_modal">Cerrar</button>
      </template>
    </base-modal>
  </div>
</template>

<script>
import { markRaw } from 'vue'
import api from '@/utils/axios'
import ResourceView from '@/common-vue/components/view/Index.vue'
import LeadExtraProps from '@/components/lead/extra-props/Index.vue'
import LeadConversationTab from '@/components/lead/conversation/Index.vue'
import LeadContractTab from '@/components/lead/contract/Index.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Definición de pestaña extra fuera de `data()` para no recrear el array por instancia.
 * `markRaw` evita que Vue 3 envuelva la definición del componente en un Proxy (warning en consola
 * y `<component :is>` puede dejar de resolver bien, afectando el modal al guardar).
 */
const lead_model_extra_tabs = [
  {
    key: 'extra',
    label: 'Operaciones',
    component: markRaw(LeadExtraProps),
  },
  {
    key: 'contract',
    label: 'Contrato',
    component: markRaw(LeadContractTab),
  },
  {
    key: 'conversation',
    label: 'Conversación WhatsApp',
    component: markRaw(LeadConversationTab),
  },
]

/**
 * Vista principal del módulo de leads.
 *
 * Incluye el ResourceView estándar y el panel opcional "Demos de hoy" que
 * muestra los leads con demo agendada para la fecha actual, ordenados por
 * hora de inicio, con columna "Llamar a las" calculada con la duración configurada.
 */
export default {
  name: 'ViewLeads',
  components: { ResourceView, LeadExtraProps, LeadConversationTab, LeadContractTab, BaseModal },
  data() {
    return {
      /** Controla visibilidad del modal para gestionar catálogo de demos. */
      show_demo_modal: false,
      /** Pestañas extra del modal de leads usando la API nueva `model_extra_tabs`. */
      model_extra_tabs: lead_model_extra_tabs,
      /** Controla visibilidad del panel de demos del día. */
      show_demos_hoy: false,
      /** Lista de leads con demo agendada hoy, ordenados por demo_start_time. */
      demos_hoy: [],
      /** Indica si la carga del panel de demos está en curso. */
      loading_demos_hoy: false,
      /** Duración de la demo en minutos (leída desde settings al abrir el panel). */
      duracion_minutos: 60,
    }
  },
  methods: {
    /**
     * Abre modal fullscreen con el CRUD de demos.
     * @returns {void}
     */
    on_open_demo_modal() {
      this.show_demo_modal = true
    },
    /**
     * Sincroniza el estado show del modal de demos.
     * @param {boolean} value nuevo estado de visibilidad.
     * @returns {void}
     */
    on_update_demo_modal(value) {
      this.show_demo_modal = value
    },
    /**
     * Cierra modal de demos.
     * @returns {void}
     */
    on_close_demo_modal() {
      this.show_demo_modal = false
    },
    /**
     * Sincroniza en la tabla los cambios recibidos desde acciones extra del modal.
     * @param {Object} model lead actualizado en backend.
     * @returns {void}
     */
    on_record_updated(model) {
      this.$store.dispatch('lead/upsert_model_in_lists', model)
      const conv = this.$store.state.lead.lead_en_conversacion
      if (conv && model && model.id && conv.id == model.id) {
        this.$store.commit('lead/update_lead_en_conversacion', model)
      }
    },
    /**
     * Alterna la visibilidad del panel de demos del día.
     * Al activarlo por primera vez, carga los datos de settings y leads.
     * @returns {void}
     */
    on_toggle_demos_hoy() {
      this.show_demos_hoy = !this.show_demos_hoy
      if (this.show_demos_hoy && !this.demos_hoy.length) {
        this.load_demos_settings_and_leads()
      }
    },
    /**
     * Carga primero la duración configurada y luego la lista de leads del día.
     * @returns {void}
     */
    load_demos_settings_and_leads() {
      var self = this
      /* GET duración configurada para calcular "Llamar a las". */
      api.get('/settings/lead-demo').then(function (res) {
        if (res.data && res.data.duracion_minutos) {
          self.duracion_minutos = parseInt(res.data.duracion_minutos, 10) || 60
        }
        self.load_demos_hoy()
      }).catch(function () {
        /* Si falla el GET de settings, usar default de 60 minutos y cargar igual. */
        self.load_demos_hoy()
      })
    },
    /**
     * Carga los leads con demo agendada desde la API y filtra por fecha de hoy.
     * El filtrado por fecha se hace en el cliente para no requerir cambios en el endpoint.
     * @returns {void}
     */
    load_demos_hoy() {
      var self = this
      self.loading_demos_hoy = true
      api
        .get('/lead', { params: { status: 'demo_agendada' } })
        .then(function (res) {
          var leads = (res.data && res.data.models)
            ? res.data.models
            : (Array.isArray(res.data) ? res.data : [])

          /* Calcular la fecha de hoy en formato YYYY-MM-DD para comparar con demo_date. */
          var today = new Date()
          var today_str = today.getFullYear()
            + '-' + String(today.getMonth() + 1).padStart(2, '0')
            + '-' + String(today.getDate()).padStart(2, '0')

          /* Filtrar solo los leads con demo_date igual a hoy. */
          leads = leads.filter(function (l) {
            if (!l.demo_date) return false
            /* demo_date puede venir como "2026-06-12" o "2026-06-12T00:00:00..." */
            var date_part = (l.demo_date + '').substring(0, 10)
            return date_part === today_str
          })

          /* Ordenar por hora de inicio de demo (texto HH:MM). */
          leads.sort(function (a, b) {
            var ta = a.demo_start_time || ''
            var tb = b.demo_start_time || ''
            return ta.localeCompare(tb)
          })
          self.demos_hoy = leads
        })
        .catch(function () {
          self.demos_hoy = []
        })
        .then(function () {
          self.loading_demos_hoy = false
        })
    },
    /**
     * Calcula la hora estimada para llamar al lead: inicio de demo + duración.
     * @param {Object} lead Lead con demo_start_time.
     * @returns {string} Hora formateada HH:MM o '—' si no se puede calcular.
     */
    calc_llamar_a_las(lead) {
      if (!lead.demo_start_time) {
        return '—'
      }
      /* Parsear hora de inicio en formato HH:MM. */
      var match = (lead.demo_start_time + '').match(/(\d{1,2}):(\d{2})/)
      if (!match) {
        return '—'
      }
      /* Sumar duración en minutos y convertir de vuelta a HH:MM. */
      var total_minutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + this.duracion_minutos
      var hours = Math.floor(total_minutes / 60)
      var mins = total_minutes % 60
      return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0')
    },
    /**
     * Devuelve la clase CSS del badge según el estado del demo setup.
     * @param {string|null} status Estado del setup.
     * @returns {string} Clase Bootstrap para el badge.
     */
    demo_setup_badge_class(status) {
      if (status === 'exitoso') return 'bg-success'
      if (status === 'ejecutandose') return 'bg-warning text-dark'
      if (status === 'fallido') return 'bg-danger'
      return 'bg-secondary'
    },
  },
}
</script>
