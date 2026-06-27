<template>
  <div class="lead-module">
    <resource-view
      ref="lead_resource_view"
      model_name="lead"
      :model_extra_tabs="model_extra_tabs"
      :model_properties_nav_order="model_properties_nav_order"
      @extra-record-updated="on_record_updated"
      @open-conversation="on_open_conversation"
    >
      <!-- Acciones rápidas por fila: respuesta automática Claude, fijar/desfijar y WhatsApp. -->
      <template #row-actions="{ row }">
        <!-- Botón activar/desactivar respuesta automática de Claude (cloud) para el lead -->
        <button
          type="button"
          class="btn btn-sm me-1 d-inline-flex align-items-center justify-content-center"
          :class="is_claude_auto_reply_enabled(row) ? 'btn-primary' : 'btn-outline-primary'"
          :title="is_claude_auto_reply_enabled(row)
            ? 'Claude responde automáticamente. Clic para desactivar.'
            : 'Claude desactivado. Clic para reactivar.'"
          :aria-label="is_claude_auto_reply_enabled(row)
            ? 'Desactivar respuesta automática de Claude'
            : 'Activar respuesta automática de Claude'"
          :disabled="is_claude_auto_reply_toggling(row)"
          @click.stop="on_toggle_claude_auto_reply(row)"
        >
          <span
            v-if="is_claude_auto_reply_toggling(row)"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi bi-stars" :class="is_claude_auto_reply_enabled(row) ? '' : 'opacity-50'" aria-hidden="true" />
        </button>
        <!-- Botón fijar/desfijar lead (pin global, igual a WhatsApp) -->
        <button
          type="button"
          class="btn btn-sm me-1"
          :class="row.pinned_at ? 'btn-warning' : 'btn-outline-secondary'"
          :title="row.pinned_at ? 'Desfijar lead' : 'Fijar lead'"
          :aria-label="row.pinned_at ? 'Desfijar lead' : 'Fijar lead'"
          @click.stop="on_toggle_pinned(row)"
        >
          <i class="bi bi-pin-fill" :class="row.pinned_at ? '' : 'opacity-50'" aria-hidden="true" />
        </button>
        <!-- Botón abrir conversación WhatsApp del lead -->
        <button
          type="button"
          class="btn btn-outline-success btn-sm"
          title="Abrir conversación de WhatsApp"
          aria-label="Abrir conversación de WhatsApp"
          @click="on_open_conversation(row)"
        >
          <i class="bi bi-whatsapp" aria-hidden="true" />
        </button>
      </template>

      <template #toolbar-right>
        <!-- Selector de orden: último mensaje (WhatsApp) vs leads más nuevos por created_at -->
        <div class="btn-group btn-sm">
          <button
            type="button"
            class="btn btn-sm"
            :class="lead_sort_by === 'last_message' ? 'btn-secondary' : 'btn-outline-secondary'"
            title="Ordenar por último mensaje de WhatsApp"
            aria-label="Ordenar por último mensaje de WhatsApp"
            @click="on_sort_change('last_message')"
          >
            <i class="bi bi-chat-dots" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="lead_sort_by === 'created_at' ? 'btn-secondary' : 'btn-outline-secondary'"
            title="Ordenar por leads más nuevos"
            aria-label="Ordenar por leads más nuevos"
            @click="on_sort_change('created_at')"
          >
            <i class="bi bi-sort-down" aria-hidden="true" />
          </button>
        </div>
        <!-- Botón toggle para el panel de demos agendadas (próximas y realizadas) -->
        <button
          type="button"
          class="btn btn-sm"
          :class="show_demos_agendadas ? 'btn-primary' : 'btn-outline-primary'"
          title="Mostrar u ocultar demos agendadas"
          aria-label="Mostrar u ocultar demos agendadas"
          @click="on_toggle_demos_agendadas"
        >
          <i class="bi bi-calendar-check" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          title="Gestionar catálogo de demos"
          aria-label="Gestionar catálogo de demos"
          @click="on_open_demo_modal"
        >
          <i class="bi bi-window-sidebar" aria-hidden="true" />
        </button>
        <!-- Botón recuperar leads sin respuesta (batch AI recovery) -->
        <button
          type="button"
          class="btn btn-sm"
          :class="batch_recovering ? 'btn-warning' : 'btn-outline-warning'"
          :disabled="batch_recovering"
          title="Responder todos los leads sin respuesta (recovery)"
          aria-label="Responder todos los leads sin respuesta"
          @click="on_batch_recover_unanswered"
        >
          <i
            class="bi"
            :class="batch_recovering ? 'bi-hourglass-split' : 'bi-robot'"
            aria-hidden="true"
          />
        </button>
      </template>

      <template #right>
        <!-- Filtro rápido por fecha de inicio de conversación WhatsApp -->
        <div class="d-flex align-items-center w-100 w-md-auto leads-conversation-date-filter">
          <label class="small text-muted mb-0 me-1 text-nowrap" for="lead_conversation_started_date">
            Inicio conv.
          </label>
          <input
            id="lead_conversation_started_date"
            v-model="conversation_started_date"
            type="date"
            class="form-control form-control-sm leads-conversation-date-input"
            title="Filtrar leads que iniciaron conversación en esta fecha"
            @change="on_conversation_started_date_change"
          />
          <button
            v-if="conversation_started_date"
            type="button"
            class="btn btn-outline-secondary btn-sm ms-1"
            title="Quitar filtro de inicio de conversación"
            aria-label="Quitar filtro de inicio de conversación"
            @click="on_clear_conversation_started_date"
          >
            <i class="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
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
                title="Actualizar lista de demos agendadas"
                aria-label="Actualizar lista de demos agendadas"
                :disabled="loading_demos_agendadas"
                @click="load_demos_agendadas"
              >
                <i class="bi bi-arrow-clockwise" aria-hidden="true" />
              </button>
            </div>

            <!-- Estado de carga -->
            <p v-if="loading_demos_agendadas" class="text-muted small mb-0">Cargando demos...</p>

            <!-- Sin demos en ninguno de los tres grupos -->
            <p
              v-else-if="!demos_por_dia.length && !demos_en_curso_por_dia.length && !demos_pasadas_por_dia.length"
              class="text-muted small mb-0"
            >
              No hay demos agendadas.
            </p>

            <!-- Tres columnas en desktop; apilado en móvil -->
            <div v-else class="demos-grupos-grid">
              <!-- Grupo: demos pendientes (fecha futura o hoy antes del inicio) -->
              <div class="demos-grupo-column">
                <h6 class="small fw-semibold text-primary mb-3">
                  <i class="bi bi-clock me-1" />
                  Próximas
                </h6>
                <p
                  v-if="!demos_por_dia.length"
                  class="text-muted small mb-0"
                >
                  Sin demos próximas.
                </p>
                <div
                  v-for="day_group in demos_por_dia"
                  :key="'proxima-' + day_group.date_key"
                  class="mb-4"
                >
                  <div class="d-flex align-items-center flex-wrap gap-1 mb-2 demos-agendadas-day-heading">
                    <span class="badge bg-primary me-2">
                      {{ day_group.is_today ? 'Hoy' : 'Próximo' }}
                    </span>
                    <h6 class="mb-0 small fw-semibold">{{ day_group.heading }}</h6>
                    <span class="text-muted small ms-2">({{ day_group.leads.length }})</span>
                  </div>

                  <div class="table-responsive demos-agendadas-table-wrap">
                    <table class="table table-sm table-hover mb-0 demos-agendadas-table">
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
                          <td class="small">{{ lead.demo_start_time || '—' }}</td>
                          <td class="small fw-semibold text-primary">{{ calc_llamar_a_las(lead) }}</td>
                          <td class="small">{{ demo_client_label(lead) }}</td>
                          <td class="small">{{ lead.contact_name || '(sin nombre)' }}</td>
                          <td class="small">{{ lead.company_name || '—' }}</td>
                          <td class="small">
                            <span
                              class="badge"
                              :class="demo_setup_badge_class(lead.demo_setup_status)"
                            >{{ lead.demo_setup_status || '—' }}</span>
                          </td>
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

              <!-- Grupo: demos en curso (hoy, entre inicio y fin estimado) -->
              <div class="demos-grupo-column">
                <h6 class="small fw-semibold text-success mb-3">
                  <i class="bi bi-play-circle me-1" />
                  En curso
                </h6>
                <p
                  v-if="!demos_en_curso_por_dia.length"
                  class="text-muted small mb-0"
                >
                  Sin demos en curso.
                </p>
                <div
                  v-for="day_group in demos_en_curso_por_dia"
                  :key="'curso-' + day_group.date_key"
                  class="mb-4"
                >
                  <div class="d-flex align-items-center flex-wrap gap-1 mb-2 demos-agendadas-day-heading">
                    <span class="badge bg-success me-2">En curso</span>
                    <h6 class="mb-0 small fw-semibold">{{ day_group.heading }}</h6>
                    <span class="text-muted small ms-2">({{ day_group.leads.length }})</span>
                  </div>

                  <div class="table-responsive demos-agendadas-table-wrap">
                    <table class="table table-sm table-hover mb-0 demos-agendadas-table">
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
                          <td class="small">{{ lead.demo_start_time || '—' }}</td>
                          <td class="small fw-semibold text-primary">{{ calc_llamar_a_las(lead) }}</td>
                          <td class="small">{{ demo_client_label(lead) }}</td>
                          <td class="small">{{ lead.contact_name || '(sin nombre)' }}</td>
                          <td class="small">{{ lead.company_name || '—' }}</td>
                          <td class="small">
                            <span
                              class="badge"
                              :class="demo_setup_badge_class(lead.demo_setup_status)"
                            >{{ lead.demo_setup_status || '—' }}</span>
                          </td>
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

              <!-- Grupo: demos ya realizadas (fecha pasada o hoy con fin superado) -->
              <div class="demos-grupo-column">
                <h6 class="small fw-semibold text-muted mb-3">
                  <i class="bi bi-clock-history me-1" />
                  Realizadas
                </h6>
                <p
                  v-if="!demos_pasadas_por_dia.length"
                  class="text-muted small mb-0"
                >
                  Sin demos realizadas.
                </p>
                <div
                  v-for="day_group in demos_pasadas_por_dia"
                  :key="'pasada-' + day_group.date_key"
                  class="mb-4"
                >
                  <div class="d-flex align-items-center flex-wrap gap-1 mb-2 demos-agendadas-day-heading">
                    <span class="badge bg-light text-secondary border me-2">Realizada</span>
                    <h6 class="mb-0 small fw-semibold">{{ day_group.heading }}</h6>
                    <span class="text-muted small ms-2">({{ day_group.leads.length }})</span>
                  </div>

                  <div class="table-responsive demos-agendadas-table-wrap">
                    <table class="table table-sm table-hover mb-0 demos-agendadas-table">
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
                          <td class="small">{{ lead.demo_start_time || '—' }}</td>
                          <td class="small fw-semibold text-primary">{{ calc_llamar_a_las(lead) }}</td>
                          <td class="small">{{ demo_client_label(lead) }}</td>
                          <td class="small">{{ lead.contact_name || '(sin nombre)' }}</td>
                          <td class="small">{{ lead.company_name || '—' }}</td>
                          <td class="small">
                            <span
                              class="badge"
                              :class="demo_setup_badge_class(lead.demo_setup_status)"
                            >{{ lead.demo_setup_status || '—' }}</span>
                          </td>
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
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          title="Cerrar gestión de demos"
          aria-label="Cerrar gestión de demos"
          @click="on_close_demo_modal"
        >
          <i class="bi bi-x-lg" aria-hidden="true" />
        </button>
      </template>
    </base-modal>

    <!-- Sidebar lateral de conversación WhatsApp (solo desktop; en mobile se navega a ruta) -->
    <lead-conversation-sidebar
      :lead="sidebar_lead"
      @close="on_sidebar_close"
      @record-updated="on_sidebar_record_updated"
    />
  </div>
</template>

<script>
import { markRaw } from 'vue'
import api from '@/utils/axios'
import ResourceView from '@/common-vue/components/view/Index.vue'
import LeadExtraProps from '@/components/lead/extra-props/Index.vue'
import LeadResumenTab from '@/components/lead/resumen/Index.vue'
import LeadConversationTab from '@/components/lead/conversation/Index.vue'
import LeadContractTab from '@/components/lead/contract/Index.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import LeadConversationSidebar from '@/components/lead/LeadConversationSidebar.vue'

/**
 * Definición de pestaña extra fuera de `data()` para no recrear el array por instancia.
 * `markRaw` evita que Vue 3 envuelva la definición del componente en un Proxy (warning en consola
 * y `<component :is>` puede dejar de resolver bien, afectando el modal al guardar).
 */
const lead_model_extra_tabs = [
  {
    key: 'conversation',
    label: 'WhatsApp',
    component: markRaw(LeadConversationTab),
  },
  {
    key: 'resumen',
    label: 'Resumen',
    component: markRaw(LeadResumenTab),
  },
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
]

/**
 * Orden de pestañas del modal de lead: extras intercalados con grupos del meta (Demo, Basico).
 * WhatsApp queda al final para priorizar Resumen y campos operativos al abrir el modal.
 */
const lead_model_properties_nav_order = [
  'extra:resumen',
  'extra:extra',
  'group:Demo',
  'group:Basico',
  'extra:contract',
  'extra:conversation',
]

/**
 * Vista principal del módulo de leads.
 *
 * Incluye el ResourceView estándar y el panel opcional "Demos agendadas" que
 * lista los leads con demo: primero las que aún no ocurrieron (agrupadas por día
 * ascendente) y debajo las ya realizadas (agrupadas por día descendente).
 */
export default {
  name: 'ViewLeads',
  components: { ResourceView, LeadExtraProps, LeadResumenTab, LeadConversationTab, LeadContractTab, BaseModal, LeadConversationSidebar },
  data() {
    return {
      /** Controla visibilidad del modal para gestionar catálogo de demos. */
      show_demo_modal: false,
      /** Pestañas extra del modal de leads usando la API nueva `model_extra_tabs`. */
      model_extra_tabs: lead_model_extra_tabs,
      /** Orden de la barra de pestañas del modal (Resumen → Operaciones → Demo → Basico → Contrato → WhatsApp). */
      model_properties_nav_order: lead_model_properties_nav_order,
      /** Controla visibilidad del panel de demos agendadas. */
      show_demos_agendadas: false,
      /** Demos próximas agrupadas por fecha (ascendente), cada ítem con date_key, heading y leads. */
      demos_por_dia: [],
      /** Demos en curso hoy (inicio pasado, fin no alcanzado), misma estructura que demos_por_dia. */
      demos_en_curso_por_dia: [],
      /** Demos ya realizadas agrupadas por fecha (descendente), misma estructura que demos_por_dia. */
      demos_pasadas_por_dia: [],
      /** Indica si la carga del panel de demos está en curso. */
      loading_demos_agendadas: false,
      /** Duración de la demo en minutos (leída desde settings al abrir el panel). */
      duracion_minutos: 60,
      /** Fecha YYYY-MM-DD para filtrar leads por inicio de conversación WhatsApp. */
      conversation_started_date: '',
      /** Indica si el batch recovery de leads sin respuesta está en curso. */
      batch_recovering: false,
      /** Lead actualmente abierto en el sidebar lateral de conversación (null = cerrado). */
      sidebar_lead: null,
      /** Ids de leads con toggle de respuesta automática Claude en curso (evita doble clic). */
      claude_auto_reply_toggling_ids: [],
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

    /**
     * true si el viewport es desktop (≥768px).
     * Se evalúa en runtime; en contextos sin window devuelve true por defecto.
     * @returns {boolean}
     */
    is_desktop() {
      if (typeof window === 'undefined') {
        return true
      }
      return window.innerWidth >= 768
    },
  },
  watch: {
    /**
     * Mantiene el input de fecha alineado si se resetean filtros desde la tabla o el header.
     * @returns {void}
     */
    '$store.state.lead.filters': {
      handler() {
        this.sync_conversation_started_date_from_store()
      },
      deep: true,
    },
  },
  mounted() {
    /* Guardar la versión de recarga inicial para comparar en activated() */
    this._last_leads_reload_version = this.$store.state.lead.leads_reload_version
    /* Al montar la vista, verificar si la URL trae ?lead_id para abrir el modal directo. */
    this.open_lead_from_query_param()
    /* Sincronizar el input de fecha con un filtro activo previo en el store. */
    this.sync_conversation_started_date_from_store()
    /* Restaurar scroll si el usuario volvió desde la conversación WhatsApp de un lead (primera carga). */
    this.restore_scroll_position()
  },

  /**
   * keep-alive: se llama cada vez que Leads vuelve a ser la vista activa.
   * Detecta si el usuario clickeó Leads en el menú (reload solicitado) comparando
   * leads_reload_version. En ese caso recarga la lista y resetea filtros, igual que un remount.
   * Si viene de la conversación de un lead, solo restaura el scroll (el store ya está al día).
   * @returns {void}
   */
  activated() {
    var current_version = this.$store.state.lead.leads_reload_version
    if (current_version !== this._last_leads_reload_version) {
      /* El usuario clickeó Leads en el menú: refrescar igual que un remount. */
      this._last_leads_reload_version = current_version
      this.$store.commit('lead/set_filters', [])
      this.$store.commit('lead/set_filter_page', 1)
      this.$store.commit('lead/set_filtered', [])
      this.$store.commit('lead/set_is_filtered', false)
      this.conversation_started_date = ''
      this.$store.dispatch('lead/get_models')
      return
    }
    /* Viene de la conversación: restaurar scroll guardado si existe. */
    this.restore_scroll_position()
  },

  /**
   * keep-alive: se llama cuando Leads deja de ser la vista activa (antes de navegar).
   * No hace nada; el scroll se guarda en on_open_conversation() antes de navegar en mobile.
   * @returns {void}
   */
  deactivated() {
    /* Sin acción al salir: el scroll ya fue guardado en on_open_conversation si aplica. */
  },
  methods: {
    /**
     * Si la URL trae ?lead_id=N (ej. al entrar desde un link de notificación WhatsApp),
     * busca ese lead completo y abre su modal automáticamente. Limpia el query param
     * después de abrir para que un refresh posterior no lo vuelva a disparar.
     * @returns {void}
     */
    open_lead_from_query_param() {
      /* Leer el query param lead_id de la URL actual. */
      var lead_id = this.$route.query.lead_id
      if (!lead_id) {
        return
      }
      var self = this
      /* Pedir el lead completo (con mensajes y relaciones) al store. */
      this.$store.dispatch('lead/fetch_full_model', lead_id).then(function (lead) {
        if (!lead) {
          self.$root.$emit('open_toast', 'No se encontró el lead solicitado.')
          return
        }
        /* Esperar a que el ResourceView esté listo antes de abrir el modal. */
        self.wait_for_resource_view_and_open(lead)
      }).catch(function () {
        self.$root.$emit('open_toast', 'Error al cargar el lead solicitado.')
      }).then(function () {
        /* Limpiar el query param sin recargar, para que un refresh no reabra el modal. */
        var query = Object.assign({}, self.$route.query)
        delete query.lead_id
        self.$router.replace({ query: query })
      })
    },
    /**
     * Espera (con reintentos cortos) a que el ref del ResourceView esté disponible
     * antes de abrir el modal, evitando la carrera con el montaje inicial del componente.
     * @param {Object} lead Objeto lead completo a abrir en el modal.
     * @param {number} [attempts] Reintentos restantes (default 10, ~1s total).
     * @returns {void}
     */
    wait_for_resource_view_and_open(lead, attempts) {
      var self = this
      /* Cantidad máxima de reintentos, cada uno espera 100ms → 1s total. */
      var remaining = attempts == null ? 10 : attempts
      var resource_view = this.$refs.lead_resource_view
      if (resource_view && typeof resource_view.on_row === 'function') {
        /* El ResourceView ya está montado y listo: abrir el modal. */
        self.on_demo_row_click(lead)
        return
      }
      if (remaining <= 0) {
        return
      }
      /* Reintentar en 100ms si el ref todavía no está disponible. */
      setTimeout(function () {
        self.wait_for_resource_view_and_open(lead, remaining - 1)
      }, 100)
    },
    /**
     * Fija o desfija un lead en la tabla (pin global: todos los admins ven el mismo estado).
     *
     * Si el lead no está fijado, se setea pinned_at en el backend y aparece con ícono amarillo.
     * Si ya está fijado, se limpia pinned_at y vuelve a estado normal.
     * El último en ser fijado aparece primero entre los fijados (igual que WhatsApp).
     *
     * @param {Object} lead Lead de la fila clickeada.
     * @returns {void}
     */
    on_toggle_pinned(lead) {
      if (!lead || !lead.id) {
        return
      }
      var self = this
      api.post('/lead/' + lead.id + '/toggle-pinned').then(function (res) {
        if (res.data && res.data.model) {
          self.$store.dispatch('lead/upsert_model_in_lists', res.data.model)
        }
      }).catch(function () {
        self.$root.$emit('open_toast', 'No se pudo cambiar el estado del pin.')
      })
    },
    /**
     * Indica si Claude tiene respuesta automática activa para el lead de la fila.
     * Por defecto true cuando el backend no envió el campo (leads legacy en caché).
     *
     * @param {Object} lead Lead de la fila.
     * @returns {boolean}
     */
    is_claude_auto_reply_enabled(lead) {
      if (!lead) {
        return true
      }
      if (lead.claude_auto_reply === undefined || lead.claude_auto_reply === null) {
        return true
      }
      return Boolean(lead.claude_auto_reply)
    },
    /**
     * true si el toggle de respuesta automática Claude está en curso para ese lead.
     *
     * @param {Object} lead Lead de la fila.
     * @returns {boolean}
     */
    is_claude_auto_reply_toggling(lead) {
      if (!lead || !lead.id) {
        return false
      }
      return this.claude_auto_reply_toggling_ids.indexOf(lead.id) >= 0
    },
    /**
     * Registra o libera el id del lead mientras corre el POST toggle-claude-auto-reply.
     *
     * @param {number} lead_id Id del lead.
     * @param {boolean} toggling true para marcar en curso, false para liberar.
     * @returns {void}
     */
    set_claude_auto_reply_toggling(lead_id, toggling) {
      if (!lead_id) {
        return
      }
      var ids = this.claude_auto_reply_toggling_ids.slice()
      var idx = ids.indexOf(lead_id)
      if (toggling) {
        if (idx < 0) {
          ids.push(lead_id)
        }
      } else if (idx >= 0) {
        ids.splice(idx, 1)
      }
      this.claude_auto_reply_toggling_ids = ids
    },
    /**
     * Activa o desactiva la respuesta automática de Claude (cloud) para el lead de la fila.
     * Reutiliza la acción del store que ya sincroniza listas y conversación abierta.
     *
     * @param {Object} lead Lead de la fila clickeada.
     * @returns {void}
     */
    on_toggle_claude_auto_reply(lead) {
      if (!lead || !lead.id || this.is_claude_auto_reply_toggling(lead)) {
        return
      }
      var self = this
      this.set_claude_auto_reply_toggling(lead.id, true)
      this.$store.dispatch('lead/toggle_claude_auto_reply', lead.id).then(function () {
        self.set_claude_auto_reply_toggling(lead.id, false)
      }).catch(function () {
        self.set_claude_auto_reply_toggling(lead.id, false)
        self.$root.$emit('open_toast', 'No se pudo cambiar la respuesta automática de Claude.')
      })
    },
    /**
     * Abre la conversación WhatsApp del lead.
     * En desktop (≥768px): abre el sidebar lateral sin navegar.
     * En mobile (<768px): navega a la ruta de pantalla completa (comportamiento anterior).
     * @param {Object} lead Lead de la fila clickeada en la tabla.
     * @returns {void}
     */
    on_open_conversation(lead) {
      if (!lead || !lead.id) {
        return
      }
      /* Desktop: mostrar sidebar; mobile: navegar a ruta de pantalla completa. */
      if (window.innerWidth >= 768) {
        this.sidebar_lead = lead
      } else {
        /* Guardar scroll actual para restaurarlo al volver desde LeadConversationView. */
        this.$store.commit('lead/set_scroll_y', window.scrollY || 0)
        this.$router.push({ name: 'lead_conversation', params: { lead_id: lead.id } })
      }
    },

    /**
     * Cierra el sidebar lateral de conversación limpiando el lead activo.
     * @returns {void}
     */
    on_sidebar_close() {
      this.sidebar_lead = null
    },

    /**
     * Propaga la actualización del lead recibida desde el sidebar.
     * Si el lead actualizado es el que está abierto, refresca la referencia local
     * para que el watcher de LeadConversationView detecte el cambio.
     * @param {Object} model Lead actualizado.
     * @returns {void}
     */
    on_sidebar_record_updated(model) {
      this.on_record_updated(model)
      /* Actualizar la referencia del sidebar si el modelo coincide con el lead activo. */
      if (this.sidebar_lead && model && model.id && this.sidebar_lead.id === model.id) {
        this.sidebar_lead = Object.assign({}, this.sidebar_lead, model)
      }
    },
    /**
     * Restaura la posición de scroll guardada en el store después de volver
     * desde la vista de conversación de un lead.
     * Usa doble nextTick para esperar a que ResourceView termine de pintar la tabla.
     * @returns {void}
     */
    restore_scroll_position() {
      var saved_y = this.$store.state.lead.scroll_y
      if (!saved_y || saved_y <= 0) {
        return
      }
      var self = this
      this.$nextTick(function () {
        self.$nextTick(function () {
          window.scrollTo(0, saved_y)
          self.$store.commit('lead/set_scroll_y', 0)
        })
      })
    },
    /**
     * Cambia el orden del listado base y recarga desde la API.
     * @param {'last_message'|'created_at'} sort_by
     * @returns {void}
     */
    on_sort_change(sort_by) {
      this.$store.dispatch('lead/change_sort_by', sort_by)
    },
    /**
     * Lee del store el filtro activo sobre first_message_at para reflejarlo en el input de fecha.
     * @returns {void}
     */
    sync_conversation_started_date_from_store() {
      var filters = this.$store.state.lead.filters || []
      var i = 0
      for (i = 0; i < filters.length; i = i + 1) {
        var filter_row = filters[i]
        if (
          filter_row
          && filter_row.key === 'first_message_at'
          && filter_row.type === 'date'
          && filter_row.igual_que
        ) {
          this.conversation_started_date = filter_row.igual_que
          return
        }
      }
      this.conversation_started_date = ''
    },
    /**
     * Aplica o quita el filtro por fecha de inicio de conversación (igual_que en first_message_at).
     * @returns {void}
     */
    on_conversation_started_date_change() {
      var self = this
      var date_value = (this.conversation_started_date || '').trim()
      if (!date_value) {
        this.on_clear_conversation_started_date()
        return
      }

      var payload = {
        type: 'date',
        key: 'first_message_at',
        igual_que: date_value,
        menor_que: '',
        mayor_que: '',
      }

      this.$store.commit('lead/add_filter', payload)
      this.$store.commit('lead/set_filter_page', 1)
      this.$store.dispatch('lead/run_filter', { page: 1 }).then(function () {
        self.sync_conversation_started_date_from_store()
      })
    },
    /**
     * Limpia el filtro de inicio de conversación y vuelve al listado base si no quedan filtros.
     * @returns {void}
     */
    on_clear_conversation_started_date() {
      var self = this
      this.conversation_started_date = ''
      this.$store.commit('lead/remove_filter_by_key', 'first_message_at')

      if (!this.$store.state.lead.is_filtered) {
        return
      }

      var remaining_filters = this.$store.state.lead.filters || []
      if (remaining_filters.length > 0) {
        this.$store.commit('lead/set_filter_page', 1)
        this.$store.dispatch('lead/run_filter', { page: 1 })
        return
      }

      this.$store.commit('lead/set_filter_page', 1)
      this.$store.commit('lead/set_filtered', [])
      this.$store.commit('lead/set_is_filtered', false)
      this.$store.dispatch('lead/get_models').then(function () {
        self.sync_conversation_started_date_from_store()
      })
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
      if (
        this.show_demos_agendadas
        && !this.demos_por_dia.length
        && !this.demos_en_curso_por_dia.length
        && !this.demos_pasadas_por_dia.length
      ) {
        this.load_demos_settings_and_leads()
      }
    },
    /**
     * Carga primero la duración configurada y luego la lista de demos (próximas y realizadas).
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
     * Parsea demo_date y demo_start_time del lead a minutos desde medianoche (inicio y fin estimado).
     * @param {Object} lead Lead con demo_date y demo_start_time.
     * @returns {{ date_key: string, start_minutes: number, end_minutes: number }|null}
     */
    get_demo_time_bounds(lead) {
      var date_key = this.parse_demo_date_key(lead)
      if (!date_key || !lead.demo_start_time) {
        return null
      }
      var match = (lead.demo_start_time + '').match(/(\d{1,2}):(\d{2})/)
      if (!match) {
        return null
      }
      /* Minutos desde medianoche del inicio y del fin (inicio + duración configurada). */
      var start_minutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
      var end_minutes = start_minutes + (this.duracion_minutos || 60)
      return {
        date_key: date_key,
        start_minutes: start_minutes,
        end_minutes: end_minutes,
      }
    },
    /**
     * Indica si la demo del lead está en curso (hoy, entre hora de inicio y fin estimado).
     * @param {Object} lead Lead con demo_date y demo_start_time.
     * @returns {boolean}
     */
    demo_is_in_progress(lead) {
      var bounds = this.get_demo_time_bounds(lead)
      if (!bounds) {
        return false
      }
      var today_str = this.get_today_str()
      if (bounds.date_key !== today_str) {
        return false
      }
      var now = new Date()
      var now_minutes = now.getHours() * 60 + now.getMinutes()
      return now_minutes >= bounds.start_minutes && now_minutes < bounds.end_minutes
    },
    /**
     * Indica si la demo del lead ya finalizó por completo (fecha pasada o hoy con hora de fin superada).
     * No retorna true mientras la demo sigue en curso.
     * @param {Object} lead Lead con demo_date y demo_start_time.
     * @returns {boolean}
     */
    demo_has_occurred(lead) {
      var date_key = this.parse_demo_date_key(lead)
      if (!date_key) {
        return false
      }

      /* Fecha de referencia: hoy en YYYY-MM-DD. */
      var today_str = this.get_today_str()
      if (date_key < today_str) {
        return true
      }
      if (date_key > today_str) {
        return false
      }

      /* Mismo día: solo realizada cuando la hora de fin estimada ya pasó. */
      var bounds = this.get_demo_time_bounds(lead)
      if (!bounds) {
        return false
      }
      var now = new Date()
      var now_minutes = now.getHours() * 60 + now.getMinutes()

      return now_minutes >= bounds.end_minutes
    },
    /**
     * Agrupa leads por demo_date y ordena días y horas según el criterio indicado.
     * @param {Array} leads Lista de leads con demo_date.
     * @param {boolean} sort_dates_asc true = fechas ascendente; false = descendente (más reciente primero).
     * @returns {Array} Grupos { date_key, heading, is_today, leads }.
     */
    build_demos_day_groups(leads, sort_dates_asc) {
      var self = this
      var today_str = self.get_today_str()
      var groups_map = {}

      /* Agrupar leads por demo_date. */
      leads.forEach(function (lead) {
        var date_key = self.parse_demo_date_key(lead)
        if (!date_key) {
          return
        }
        if (!groups_map[date_key]) {
          groups_map[date_key] = []
        }
        groups_map[date_key].push(lead)
      })

      /* Ordenar fechas según criterio (ascendente para próximas, descendente para realizadas). */
      var date_keys = Object.keys(groups_map)
      date_keys.sort(function (a, b) {
        if (sort_dates_asc) {
          return a.localeCompare(b)
        }
        return b.localeCompare(a)
      })

      var grouped = []
      date_keys.forEach(function (date_key) {
        var day_leads = groups_map[date_key].slice()
        /* Dentro del día: próximas por hora ascendente; realizadas por hora descendente. */
        day_leads.sort(function (a, b) {
          var ta = a.demo_start_time || ''
          var tb = b.demo_start_time || ''
          if (sort_dates_asc) {
            return ta.localeCompare(tb)
          }
          return tb.localeCompare(ta)
        })
        grouped.push({
          date_key: date_key,
          heading: self.format_day_heading(date_key),
          is_today: date_key === today_str,
          leads: day_leads,
        })
      })

      return grouped
    },
    /**
     * Carga los leads con demo agendada desde la API, separa próximas, en curso y realizadas
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

          /* Conservar solo leads con demo_date válida. */
          leads = leads.filter(function (l) {
            return !!self.parse_demo_date_key(l)
          })

          /* Separar demos en tres grupos: pendientes, en curso y realizadas. */
          var upcoming_leads = []
          var in_progress_leads = []
          var past_leads = []
          leads.forEach(function (lead) {
            if (self.demo_has_occurred(lead)) {
              past_leads.push(lead)
            } else if (self.demo_is_in_progress(lead)) {
              in_progress_leads.push(lead)
            } else {
              upcoming_leads.push(lead)
            }
          })

          self.demos_por_dia = self.build_demos_day_groups(upcoming_leads, true)
          self.demos_en_curso_por_dia = self.build_demos_day_groups(in_progress_leads, true)
          self.demos_pasadas_por_dia = self.build_demos_day_groups(past_leads, false)
        })
        .catch(function () {
          self.demos_por_dia = []
          self.demos_en_curso_por_dia = []
          self.demos_pasadas_por_dia = []
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
    /**
     * Encola la generación de sugerencia de Claude para todos los leads sin respuesta.
     * Útil para recuperar leads que quedaron sin job por errores del sistema.
     * @returns {void}
     */
    on_batch_recover_unanswered() {
      /* Evitar doble envío si ya hay un recovery en curso. */
      if (this.batch_recovering) {
        return
      }
      var self = this
      this.batch_recovering = true
      api.post('/lead/batch-recover-unanswered').then(function (res) {
        var dispatched = res.data && res.data.dispatched != null ? res.data.dispatched : 0
        var skipped = res.data && res.data.skipped != null ? res.data.skipped : 0
        var msg = dispatched === 0
          ? 'Sin leads pendientes de respuesta (' + skipped + ' ya respondidos o en proceso).'
          : 'Recovery: ' + dispatched + ' lead' + (dispatched === 1 ? '' : 's') + ' procesado' + (dispatched === 1 ? '' : 's') + ', ' + skipped + ' omitido' + (skipped === 1 ? '' : 's') + '.'
        window.dispatchEvent(new CustomEvent('admin-spa-toast', { detail: { message: msg, variant: 'success' } }))
        self.batch_recovering = false
      }).catch(function () {
        window.dispatchEvent(new CustomEvent('admin-spa-toast', { detail: { message: 'Error al iniciar el recovery de leads.', variant: 'danger' } }))
        self.batch_recovering = false
      })
    },
  },
}
</script>

<style scoped>
/* Input compacto del filtro por inicio de conversación en la barra superior. */
.leads-conversation-date-input {
  width: 10.5rem;
  min-width: 10.5rem;
}

/* En móvil el filtro de fecha usa todo el ancho de la fila secundaria. */
@media (max-width: 767.98px) {
  .leads-conversation-date-input {
    width: auto;
    min-width: 0;
    flex: 1 1 auto;
  }
}

/* Filas clickeables del panel de demos agendadas (misma UX que la tabla principal). */
.demos-agendadas-row {
  cursor: pointer;
}

/* Contenedor con scroll horizontal cuando la tabla no entra en pantallas angostas. */
.demos-agendadas-table-wrap {
  -webkit-overflow-scrolling: touch;
}

/* Ancho mínimo para mantener columnas legibles y forzar scroll horizontal en móvil. */
.demos-agendadas-table {
  min-width: 44rem;
  white-space: nowrap;
}

/* Grid responsive: tres columnas en desktop, apilado en móvil. */
.demos-grupos-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .demos-grupos-grid {
    grid-template-columns: 1fr 1fr 1fr;
  }
}
</style>
