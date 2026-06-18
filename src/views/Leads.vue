<template>
  <div>
    <resource-view
      ref="lead_resource_view"
      model_name="lead"
      :model_extra_tabs="model_extra_tabs"
      @extra-record-updated="on_record_updated"
    >
      <template #right>
        <!-- Selector de orden: último mensaje (WhatsApp) vs leads más nuevos por created_at -->
        <div class="btn-group btn-sm me-2">
          <button
            type="button"
            class="btn btn-sm"
            :class="lead_sort_by === 'last_message' ? 'btn-secondary' : 'btn-outline-secondary'"
            @click="on_sort_change('last_message')"
          >
            <i class="bi bi-chat-dots me-1" /> Último mensaje
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="lead_sort_by === 'created_at' ? 'btn-secondary' : 'btn-outline-secondary'"
            @click="on_sort_change('created_at')"
          >
            <i class="bi bi-sort-down me-1" /> Más nuevos
          </button>
        </div>
        <!-- Botón toggle para el panel de demos agendadas (desde hoy en adelante) -->
        <button
          type="button"
          class="btn btn-sm me-2"
          :class="show_demos_agendadas ? 'btn-primary' : 'btn-outline-primary'"
          @click="on_toggle_demos_agendadas"
        >
          <i class="bi bi-calendar-check me-1" /> Demos agendadas
        </button>
        <button type="button" class="btn btn-outline-primary btn-sm" @click="on_open_demo_modal">
          <i class="bi bi-window-sidebar me-1" /> Gestionar demos
        </button>
      </template>

      <template #header>
        <!-- Panel de demos agendadas: visible solo cuando el toggle está activo -->
        <div v-if="show_demos_agendadas" class="card mt-3 mb-3">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h6 class="card-title mb-0">
                <i class="bi bi-calendar-check me-1" />
                Demos agendadas
              </h6>
              <!-- Botón para refrescar la lista manualmente -->
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                :disabled="loading_demos_agendadas"
                @click="load_demos_agendadas"
              >
                <i class="bi bi-arrow-clockwise" />
              </button>
            </div>

            <!-- Estado de carga -->
            <p v-if="loading_demos_agendadas" class="text-muted small mb-0">Cargando demos...</p>

            <!-- Sin demos futuras -->
            <p v-else-if="!demos_por_dia.length" class="text-muted small mb-0">
              No hay demos agendadas desde hoy en adelante.
            </p>

            <!-- Bloques agrupados por día, cada uno con su tabla de demos -->
            <div v-else>
              <div
                v-for="day_group in demos_por_dia"
                :key="day_group.date_key"
                class="mb-4"
              >
                <div class="d-flex align-items-center mb-2">
                  <span
                    class="badge me-2"
                    :class="day_group.is_today ? 'bg-primary' : 'bg-secondary'"
                  >
                    {{ day_group.is_today ? 'Hoy' : 'Próximo' }}
                  </span>
                  <h6 class="mb-0 small fw-semibold">{{ day_group.heading }}</h6>
                  <span class="text-muted small ms-2">({{ day_group.leads.length }})</span>
                </div>

                <table class="table table-sm table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th class="small">Hora inicio</th>
                      <th class="small">Llamar a las</th>
                      <th class="small">Cliente (demo)</th>
                      <th class="small">Lead</th>
                      <th class="small">Empresa</th>
                      <th class="small">Estado setup</th>
                      <th class="small">Resumen IA</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="lead in day_group.leads"
                      :key="lead.id"
                      class="demos-agendadas-row"
                      role="button"
                      tabindex="0"
                      @click="on_demo_row_click(lead)"
                      @keydown.enter="on_demo_row_click(lead)"
                    >
                      <!-- Hora de inicio de la demo -->
                      <td class="small">{{ lead.demo_start_time || '—' }}</td>
                      <!-- Hora estimada de llamada = inicio + duración configurada -->
                      <td class="small fw-semibold text-primary">{{ calc_llamar_a_las(lead) }}</td>
                      <!-- Cliente/demo asignada al lead -->
                      <td class="small">{{ demo_client_label(lead) }}</td>
                      <!-- Contacto del lead que agendó la demo -->
                      <td class="small">{{ lead.contact_name || '(sin nombre)' }}</td>
                      <!-- Empresa del prospecto -->
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
 * Incluye el ResourceView estándar y el panel opcional "Demos agendadas" que
 * lista los leads con demo desde la fecha actual en adelante, agrupados por día
 * y ordenados por hora de inicio, con columna "Llamar a las" según duración configurada.
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
      /** Controla visibilidad del panel de demos agendadas. */
      show_demos_agendadas: false,
      /** Demos agrupadas por fecha (desde hoy), cada ítem con date_key, heading y leads. */
      demos_por_dia: [],
      /** Indica si la carga del panel de demos está en curso. */
      loading_demos_agendadas: false,
      /** Duración de la demo en minutos (leída desde settings al abrir el panel). */
      duracion_minutos: 60,
    }
  },
  computed: {
    /**
     * Criterio de orden activo en el store de leads.
     * @returns {'last_message'|'created_at'}
     */
    lead_sort_by() {
      return this.$store.state.lead.sort_by
    },
  },
  methods: {
    /**
     * Cambia el orden del listado base y recarga desde la API.
     * @param {'last_message'|'created_at'} sort_by
     * @returns {void}
     */
    on_sort_change(sort_by) {
      this.$store.dispatch('lead/change_sort_by', sort_by)
    },
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
     * Abre el modal del lead reutilizando el handler de fila del ResourceView principal.
     * @param {Object} lead Lead de la fila clickeada en el panel de demos.
     * @returns {void}
     */
    on_demo_row_click(lead) {
      if (!lead || !lead.id) {
        return
      }
      var resource_view = this.$refs.lead_resource_view
      if (resource_view && typeof resource_view.on_row === 'function') {
        resource_view.on_row(lead)
      }
    },
    /**
     * Alterna la visibilidad del panel de demos agendadas.
     * Al activarlo por primera vez, carga los datos de settings y leads.
     * @returns {void}
     */
    on_toggle_demos_agendadas() {
      this.show_demos_agendadas = !this.show_demos_agendadas
      if (this.show_demos_agendadas && !this.demos_por_dia.length) {
        this.load_demos_settings_and_leads()
      }
    },
    /**
     * Carga primero la duración configurada y luego la lista de demos futuras.
     * @returns {void}
     */
    load_demos_settings_and_leads() {
      var self = this
      /* GET duración configurada para calcular "Llamar a las". */
      api.get('/settings/lead-demo').then(function (res) {
        if (res.data && res.data.duracion_minutos) {
          self.duracion_minutos = parseInt(res.data.duracion_minutos, 10) || 60
        }
        self.load_demos_agendadas()
      }).catch(function () {
        /* Si falla el GET de settings, usar default de 60 minutos y cargar igual. */
        self.load_demos_agendadas()
      })
    },
    /**
     * Devuelve la fecha de hoy en formato YYYY-MM-DD para comparar con demo_date.
     * @returns {string}
     */
    get_today_str() {
      var today = new Date()
      return today.getFullYear()
        + '-' + String(today.getMonth() + 1).padStart(2, '0')
        + '-' + String(today.getDate()).padStart(2, '0')
    },
    /**
     * Normaliza demo_date del lead a YYYY-MM-DD (ignora hora/timezone).
     * @param {Object} lead Lead con demo_date.
     * @returns {string|null}
     */
    parse_demo_date_key(lead) {
      if (!lead || !lead.demo_date) {
        return null
      }
      return (lead.demo_date + '').substring(0, 10)
    },
    /**
     * Carga los leads con demo agendada desde la API, filtra desde hoy
     * y agrupa por fecha para el panel del header.
     * @returns {void}
     */
    load_demos_agendadas() {
      var self = this
      self.loading_demos_agendadas = true
      api
        .get('/lead', { params: { status: 'demo_agendada' } })
        .then(function (res) {
          var leads = (res.data && res.data.models)
            ? res.data.models
            : (Array.isArray(res.data) ? res.data : [])

          /* Fecha mínima: hoy inclusive. */
          var today_str = self.get_today_str()

          /* Conservar solo leads con demo_date >= hoy. */
          leads = leads.filter(function (l) {
            var date_key = self.parse_demo_date_key(l)
            if (!date_key) {
              return false
            }
            return date_key >= today_str
          })

          /* Agrupar leads por demo_date. */
          var groups_map = {}
          leads.forEach(function (lead) {
            var date_key = self.parse_demo_date_key(lead)
            if (!groups_map[date_key]) {
              groups_map[date_key] = []
            }
            groups_map[date_key].push(lead)
          })

          /* Ordenar fechas ascendente y leads de cada día por hora de inicio. */
          var date_keys = Object.keys(groups_map)
          date_keys.sort(function (a, b) {
            return a.localeCompare(b)
          })

          var grouped = []
          date_keys.forEach(function (date_key) {
            var day_leads = groups_map[date_key].slice()
            day_leads.sort(function (a, b) {
              var ta = a.demo_start_time || ''
              var tb = b.demo_start_time || ''
              return ta.localeCompare(tb)
            })
            grouped.push({
              date_key: date_key,
              heading: self.format_day_heading(date_key),
              is_today: date_key === today_str,
              leads: day_leads,
            })
          })

          self.demos_por_dia = grouped
        })
        .catch(function () {
          self.demos_por_dia = []
        })
        .then(function () {
          self.loading_demos_agendadas = false
        })
    },
    /**
     * Formatea el encabezado de un día con nombre de la semana y fecha DD/MM/YYYY.
     * @param {string} date_key Fecha en formato YYYY-MM-DD.
     * @returns {string}
     */
    format_day_heading(date_key) {
      if (!date_key) {
        return '—'
      }
      var parts = date_key.split('-')
      if (parts.length !== 3) {
        return date_key
      }
      var weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      var local_date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      var weekday = weekdays[local_date.getDay()] || ''
      var label = parts[2] + '/' + parts[1] + '/' + parts[0]
      return weekday + ' ' + label
    },
    /**
     * Etiqueta legible del cliente/demo asignada al lead.
     * Prioriza target_client y cae al catálogo demo (erp_spa_url).
     * @param {Object} lead Lead con relaciones target_client y demo.
     * @returns {string}
     */
    demo_client_label(lead) {
      if (!lead) {
        return '—'
      }
      var target_client = lead.target_client
      if (target_client) {
        var company_name = (target_client.company_name || '').trim()
        if (company_name) {
          return company_name
        }
        var client_name = (target_client.name || '').trim()
        if (client_name) {
          return client_name
        }
      }
      if (lead.demo && lead.demo.erp_spa_url) {
        return lead.demo.erp_spa_url
      }
      return '—'
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

<style scoped>
/* Filas clickeables del panel de demos agendadas (misma UX que la tabla principal). */
.demos-agendadas-row {
  cursor: pointer;
}
</style>
