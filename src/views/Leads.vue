<template>
  <div class="lead-module leads-view">
    <!--
      Fila superior: los filtros activos como chips (para que la lista corta tenga explicación) y,
      a la derecha, el panel de demos agendadas y el catálogo. Es todo lo que quedó de la barra de
      acciones del ResourceView (decisión D5, 17/10/2026): sin orden, sin "Solo calificados", sin
      filtro por fecha, sin selección ni "Actuar".
    -->
    <div class="leads-toolbar d-flex align-items-center flex-wrap gap-2 mb-3">
      <!-- Deep link desde el panel de inicio (?filtro=sin-responder): solo los que piden atención. -->
      <span
        v-if="solo_atencion_activo"
        class="badge rounded-pill text-bg-primary d-inline-flex align-items-center"
        title="Solo los chats con un mensaje sin responder, esperando confirmación o con error de envío"
      >
        Solo con atención pendiente
        <button
          type="button"
          class="btn btn-sm btn-link p-0 ms-2 text-white lh-1 text-decoration-none"
          title="Quitar el filtro"
          aria-label="Quitar el filtro de atención pendiente"
          @click="quitar_filtro_sin_responder"
        >
          <i class="bi bi-x-lg" aria-hidden="true" />
        </button>
      </span>
      <!-- Tarjeta de estado activa. La misma tarjeta se destilda clickeándola de nuevo. -->
      <span
        v-if="status_filtro_activo_texto"
        class="badge rounded-pill text-bg-secondary d-inline-flex align-items-center"
        :title="'Mostrando solo leads en ' + status_filtro_activo_texto"
      >
        {{ status_filtro_activo_texto }}
        <button
          type="button"
          class="btn btn-sm btn-link p-0 ms-2 text-white lh-1 text-decoration-none"
          title="Quitar el filtro de estado"
          aria-label="Quitar el filtro de estado"
          @click="limpiar_filtro_de_estado"
        >
          <i class="bi bi-x-lg" aria-hidden="true" />
        </button>
      </span>
      <span v-if="chats_total_texto" class="small text-muted">{{ chats_total_texto }}</span>

      <div class="ms-auto d-flex align-items-center gap-2">
        <!-- Botón toggle para el panel de demos agendadas (próximas, en curso y realizadas) -->
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
        <!--
          Catálogo de demos: desde la misión demos-instalacion-y-ecommerce (31/8/2026) tiene
          ruta propia en el módulo Demos, así que este botón navega en vez de abrir un modal.
          Es un router-link y no un botón con @click para que se pueda abrir en otra pestaña
          con ctrl+click, como cualquier link del admin.
        -->
        <router-link
          class="btn btn-outline-primary btn-sm"
          to="/demos/catalogo"
          title="Gestionar catálogo de demos"
          aria-label="Gestionar catálogo de demos"
        >
          <i class="bi bi-window-sidebar" aria-hidden="true" />
        </router-link>
      </div>
    </div>

    <!-- Tarjetas de estado: cuántos leads hay en cada estado clave y cuántos necesitan respuesta.
         Los conteos son GLOBALES (no aplican el texto buscado ni el filtro de atención). Son el
         único filtro por estado que quedó: clic filtra la lista, otro clic lo saca. -->
    <lead-status-cards
      :cards="lead_status_cards"
      :active_status_slug="active_status_slug"
      :loading="loading_status_cards"
      @select="on_select_status_card"
    />

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
                      <th class="small">Etapa</th>
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
                      <td class="small">
                        <span class="badge" :class="demo_lifecycle_badge(lead).class">{{ demo_lifecycle_badge(lead).label }}</span>
                      </td>
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
                      <th class="small">Etapa</th>
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
                      <td class="small">
                        <span class="badge" :class="demo_lifecycle_badge(lead).class">{{ demo_lifecycle_badge(lead).label }}</span>
                      </td>
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
                      <th class="small">Etapa</th>
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
                      <td class="small">
                        <span class="badge" :class="demo_lifecycle_badge(lead).class">{{ demo_lifecycle_badge(lead).label }}</span>
                      </td>
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

    <!-- La bandeja: buscador + lista de chats (reemplaza a la tabla desde el 17/10/2026). -->
    <lead-chats-list
      ref="chats_list"
      :active_lead_id="sidebar_lead ? sidebar_lead.id : null"
      @open-conversation="on_open_conversation"
      @open-modal="on_open_lead_modal"
    />

    <!-- Sidebar lateral de conversación WhatsApp (solo desktop; en mobile se navega a ruta) -->
    <lead-conversation-sidebar
      :lead="sidebar_lead"
      @close="on_sidebar_close"
      @record-updated="on_sidebar_record_updated"
      @open-lead-modal="on_open_lead_modal"
    />

    <!--
      Modal del lead: el mismo ModelModal genérico de siempre, montado acá directo (como hace
      CloserPanel.vue) porque ya no hay ResourceView que lo monte. Las solapas extra y su orden son
      los de siempre, con la Demo propia en lugar del grupo del meta.
    -->
    <model-modal
      model_name="lead"
      :show="modal_lead !== null"
      :all_properties="lead_modal_properties"
      :record="modal_lead"
      :extra_tabs="model_extra_tabs"
      :properties_nav_order="model_properties_nav_order"
      @update:show="on_lead_modal_show"
      @close="on_close_lead_modal"
      @saved="on_lead_modal_saved"
      @extra-record-updated="on_record_updated"
      @open-conversation="on_open_conversation"
    />
  </div>
</template>

<script>
import { markRaw } from 'vue'
import api from '@/utils/axios'
import { cached_get, MAX_AGE_SETTINGS } from '@/common-vue/helpers/request_cache_helper'
import ModelModal from '@/common-vue/components/model/Index.vue'
import LeadExtraProps from '@/components/lead/extra-props/Index.vue'
import LeadResumenTab from '@/components/lead/resumen/Index.vue'
import LeadContractTab from '@/components/lead/contract/Index.vue'
import LeadDemoTab from '@/components/lead/demo/Index.vue'
import LeadConversationSidebar from '@/components/lead/LeadConversationSidebar.vue'
import LeadStatusCards from '@/components/lead/LeadStatusCards.vue'
import LeadChatsList from '@/components/lead/chats/Index.vue'
import SubjectPipelinesTab from '@/components/pipeline/SubjectPipelinesTab.vue'

/**
 * Definición de pestaña extra fuera de `data()` para no recrear el array por instancia.
 * `markRaw` evita que Vue 3 envuelva la definición del componente en un Proxy (warning en consola
 * y `<component :is>` puede dejar de resolver bien, afectando el modal al guardar).
 */
const lead_model_extra_tabs = [
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
    /* Solapa Demo propia (misión flujo-lead-landing-closer, 17/10/2026): Configuración, Videos,
       Links y Formulario en sub-solapas. Reemplaza al grupo "Demo" del meta, que el form genérico
       dibujaba como una sola grilla de campos; ese grupo se oculta en `lead_modal_properties`. */
    key: 'demo',
    label: 'Demo',
    component: markRaw(LeadDemoTab),
  },
  {
    key: 'contract',
    label: 'Contrato',
    component: markRaw(LeadContractTab),
  },
  {
    /* Oportunidades del lead en los pipelines del CRM (misión pipelines-crm, 27/9/2026). La
       pestaña deduce que el sujeto es un lead del `model_name` que le pasa el modal. */
    key: 'pipelines',
    label: 'Pipelines',
    component: markRaw(SubjectPipelinesTab),
  },
]

/**
 * Orden de pestañas del modal de lead: extras intercalados con el grupo Basico del meta.
 * Pipelines va al final: es la mirada comercial de campañas, no el día a día del lead.
 */
const lead_model_properties_nav_order = [
  'extra:resumen',
  'extra:extra',
  'extra:demo',
  'group:Basico',
  'extra:contract',
  'extra:pipelines',
]

/**
 * Status del lead que representan el ciclo de vida completo de una demo agendada, desde que se
 * agenda hasta que se confirma realizada. Se usa para traer todos los leads relevantes del panel
 * "Demos agendadas" en una sola consulta (antes solo se pedía 'demo_agendada', por lo que un lead
 * desaparecía del panel apenas el ciclo automatizado le cambiaba el status).
 */
const DEMO_LIFECYCLE_STATUSES = [
  'demo_agendada',
  'ingresando_demo',
  'demo_en_curso',
  'demo_pendiente_de_ingreso',
  'demo_pendiente_de_terminar',
  'demo_realizada',
]

/**
 * Subconjunto de status que indica que la demo ya arrancó pero todavía no se confirmó su fin.
 * Se usa para clasificar leads en el grupo "En curso" (solo para días anteriores a hoy; las
 * demos de hoy en este rango de status van al grupo "Hoy" de Próximas).
 */
const EN_CURSO_LIFECYCLE_STATUSES = [
  'ingresando_demo',
  'demo_en_curso',
  'demo_pendiente_de_ingreso',
  'demo_pendiente_de_terminar',
]

/**
 * Vista principal del módulo de leads (misión flujo-lead-landing-closer, 17/10/2026).
 *
 * Dejó de ser una tabla sobre ResourceView: ahora son las tarjetas de estado (que filtran), el
 * buscador y una lista de chats estilo WhatsApp (`components/lead/chats`), más el panel opcional
 * "Demos agendadas", el sidebar de conversación (≥768 px; en teléfono se navega a la ruta) y el
 * modal genérico del lead. Los datos de la lista viven en `store/lead.js` (`chats*`).
 *
 * Sigue en keep-alive (`App.vue`): volver a clickear Leads en el menú incrementa
 * `leads_reload_version` y acá se recarga como una primera entrada.
 */
export default {
  name: 'ViewLeads',
  components: {
    ModelModal,
    LeadConversationSidebar,
    LeadStatusCards,
    LeadChatsList,
  },
  data() {
    return {
      /** Pestañas extra del modal de leads. */
      model_extra_tabs: lead_model_extra_tabs,
      /** Orden de la barra de pestañas del modal (Resumen → Operaciones → Demo → Basico → Contrato → Pipelines). */
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
      /** Lead actualmente abierto en el sidebar lateral de conversación (null = cerrado). */
      sidebar_lead: null,
      /** Lead abierto en el modal de detalle (null = cerrado). Alcanza con que traiga `id`. */
      modal_lead: null,
      /** `value` de la tarjeta de estado que está filtrando la lista (null = ninguna). */
      active_status_slug: null,
    }
  },
  computed: {
    /**
     * Tarjetas de estado tal cual las devuelve GET /lead/status-cards (orden y colores incluidos).
     * @returns {Array<{ value: string, text: string, color: string, group: string|null, total: number, sin_responder: number, slugs?: string[] }>}
     */
    lead_status_cards() {
      return this.$store.state.lead.status_cards || []
    },
    /**
     * true mientras el GET de tarjetas de estado está en vuelo.
     * @returns {boolean}
     */
    loading_status_cards() {
      return this.$store.state.lead.loading_status_cards
    },
    /**
     * Filtros vivos de la lista de chats.
     * @returns {{ q: string, status: string|null, solo_atencion: boolean }}
     */
    chats_filtros() {
      return this.$store.state.lead.chats_filtros || { q: '', status: null, solo_atencion: false }
    },
    /**
     * @returns {boolean}
     */
    solo_atencion_activo() {
      return Boolean(this.chats_filtros.solo_atencion)
    },
    /**
     * Texto de la tarjeta que está filtrando, para el chip. Vacío si no hay filtro de estado.
     * @returns {string}
     */
    status_filtro_activo_texto() {
      if (!this.active_status_slug) {
        return ''
      }
      const slug = String(this.active_status_slug)
      let texto = ''
      this.lead_status_cards.forEach(function (card) {
        if (card && String(card.value) === slug) {
          texto = card.text || ''
        }
      })
      return texto || slug
    },
    /**
     * "N chats" al lado de los chips, cuando la lista cargó bien.
     * @returns {string}
     */
    chats_total_texto() {
      const st = this.$store.state.lead
      if (st.chats_error || !st.chats_meta) {
        return ''
      }
      const total = parseInt(st.chats_meta.total, 10)
      if (isNaN(total) || (total === 0 && st.loading_chats)) {
        return ''
      }
      return total === 1 ? '1 chat' : total + ' chats'
    },
    /**
     * Meta del lead para el modal, con el grupo "Demo" OCULTO.
     *
     * La solapa Demo ahora es un componente propio (`extra:demo`), pero el meta sigue declarando
     * el grupo con sus campos, y el modal genérico pinta una pestaña por cada grupo con campos
     * visibles: sin esto habría dos pestañas "Demo", la nueva y la grilla vieja al final. Se les
     * pone `show: false` en vez de sacarlos del array a propósito: `build_draft()` recorre
     * `all_properties` para normalizar fechas (`demo_date` es `day`) y asegurar cada clave en el
     * borrador, y eso tiene que seguir pasando para que la solapa nueva escriba en `draft` y el
     * Guardar del modal lo mande igual que antes.
     *
     * @returns {Array<Object>}
     */
    lead_modal_properties() {
      const props = this.$store.getters['meta/properties']('lead') || []
      let grupo_actual = null
      return props.map(function (p) {
        if (!p) {
          return p
        }
        if (p.group_title && !p.key) {
          grupo_actual = p.group_title
          return p
        }
        if (grupo_actual === 'Demo' && p.show !== false) {
          return Object.assign({}, p, { show: false })
        }
        return p
      })
    },
  },
  watch: {
    /**
     * keep-alive: si Leads ya está activo, activated() no corre al pulsar Leads otra vez.
     * El menú incrementa leads_reload_version; este watcher dispara la recarga completa.
     *
     * @returns {void}
     */
    '$store.state.lead.leads_reload_version'(new_version, old_version) {
      if (new_version === old_version) {
        return
      }
      this.reload_module_from_nav()
    },
  },
  /**
   * El deep link del panel de inicio (`?filtro=sin-responder`) se aplica ANTES del primer GET, que
   * sale en `mounted()`. Sin el parámetro se commitea `false` a propósito: el estado del store
   * sobrevive a la navegación y entrar a /leads a secas tiene que mostrar la bandeja completa.
   *
   * @returns {void}
   */
  created() {
    this.$store.commit('lead/set_chats_filtros', {
      solo_atencion: this.$route.query.filtro === 'sin-responder',
    })
  },

  mounted() {
    /* Guardar la versión de recarga inicial para comparar en activated() */
    this._last_leads_reload_version = this.$store.state.lead.leads_reload_version
    /* Meta del modelo `lead`: la necesita el ModelModal para armar sus grupos/campos. Antes la
       precargaba ResourceView; ahora nadie más la pide en esta vista. */
    this.$store.dispatch('meta/fetch_meta', 'lead').catch(function () {
      return null
    })
    /* La lista, desde la primera página. */
    this.$store.dispatch('lead/fetch_chats', { page: 1 })
    /* Al montar la vista, verificar si la URL trae ?lead_id para abrir el modal directo. */
    this.open_lead_from_query_param()
    /* Totales de no leídos por estado (badge del menú). `ensure_*`: el Nav pide lo mismo en este
       mismo tick (y lo repite cada vez que se remonta, que es cada vez que se sale de la
       conversación de un lead). */
    this.$store.dispatch('lead/ensure_unread_badges_fresh')
    /* Conteos globales por estado para las tarjetas. */
    this.$store.dispatch('lead/fetch_status_cards')
    /* Restaurar scroll si el usuario volvió desde la conversación WhatsApp de un lead. */
    this.restore_scroll_position()
    /* keep-alive: activated() corre INMEDIATAMENTE después de este mounted() en el primer
       montaje, y su rama "vengo de otro módulo" repite todo lo de acá arriba. Esta bandera hace
       que la primera activación no haga nada: se acaba de cargar todo. */
    this._primera_activacion_pendiente = true
  },

  /**
   * keep-alive: se llama cada vez que Leads vuelve a ser la vista activa.
   * Detecta si el usuario clickeó Leads en el menú (reload solicitado) comparando
   * leads_reload_version. En ese caso recarga la lista y resetea filtros, igual que un remount.
   * Si viene de otro módulo o de la conversación, refresca la lista respetando los filtros
   * y restaura el scroll guardado.
   * @returns {void}
   */
  activated() {
    if (this._primera_activacion_pendiente) {
      this._primera_activacion_pendiente = false
      return
    }
    const current_version = this.$store.state.lead.leads_reload_version
    if (current_version !== this._last_leads_reload_version) {
      this.reload_module_from_nav()
      this.$store.dispatch('lead/fetch_status_cards')
      /* Si venimos de una navegación con ?lead_id (ej. desde el panel del closer), activated()
         también tiene que revisar el query param, igual que mounted(). */
      this.open_lead_from_query_param()
      return
    }
    /* Deep link desde Inicio con la vista ya en caché: el parámetro llega acá y no a created(). */
    if (this.$route.query.filtro === 'sin-responder' && !this.solo_atencion_activo) {
      this.$store.commit('lead/set_chats_filtros', { solo_atencion: true })
    }
    /* Venimos de otro módulo o de la conversación: la lista no se actualizó en segundo plano
       (el socket solo refresca filas estando en esta ruta), así que se vuelve a pedir la primera
       página con los mismos filtros. */
    this.$store.dispatch('lead/fetch_chats', { page: 1 })
    this.$store.dispatch('lead/ensure_unread_badges_fresh')
    this.$store.dispatch('lead/fetch_status_cards')
    this.restore_scroll_position()
    this.open_lead_from_query_param()
  },

  methods: {
    /**
     * Contenedor que scrollea de verdad: el documento tiene `overflow: hidden` y el scroll vive en
     * `<main.app-main-scroll>` (ver `_app.sass`). `window.scrollTo` acá no mueve nada.
     * @returns {Element}
     */
    scroll_container() {
      const main = this.$el && this.$el.closest ? this.$el.closest('.app-main-scroll') : null
      return main || document.scrollingElement || document.documentElement
    },
    /**
     * Guarda la posición de scroll antes de navegar a la conversación en teléfono.
     * @returns {void}
     */
    save_scroll_position() {
      const el = this.scroll_container()
      this.$store.commit('lead/set_scroll_y', el ? (el.scrollTop || 0) : 0)
    },
    /**
     * Restaura la posición de scroll guardada al volver desde la conversación de un lead.
     * Doble nextTick para esperar a que la lista termine de pintar.
     * @returns {void}
     */
    restore_scroll_position() {
      const saved_y = this.$store.state.lead.scroll_y
      if (!saved_y || saved_y <= 0) {
        return
      }
      const self = this
      this.$nextTick(function () {
        self.$nextTick(function () {
          const el = self.scroll_container()
          if (el) {
            el.scrollTop = saved_y
          }
          self.$store.commit('lead/set_scroll_y', 0)
        })
      })
    },
    /**
     * @returns {void}
     */
    scroll_to_top() {
      const el = this.scroll_container()
      if (el) {
        el.scrollTop = 0
      }
    },

    /**
     * Recarga Leads como primera entrada: resetea filtros y UI local y pide la lista de nuevo.
     * Invocado desde activated() (keep-alive) o desde el watcher de leads_reload_version.
     *
     * @returns {void}
     */
    reload_module_from_nav() {
      this._last_leads_reload_version = this.$store.state.lead.leads_reload_version
      /* Volver a Leads desde el menú es una entrada limpia: también se cae el deep link de
         "solo sin responder", chip y query incluidos. */
      this.limpiar_filtro_de_la_query()
      this.$store.commit('lead/set_chats_filtros', { q: '', status: null, solo_atencion: false })
      this.$store.commit('lead/set_scroll_y', 0)
      this.active_status_slug = null
      this.sidebar_lead = null
      this.modal_lead = null
      this.show_demos_agendadas = false
      this.$store.dispatch('lead/fetch_chats', { page: 1 })
      this.scroll_to_top()
    },
    /**
     * Saca `filtro` de la query sin recargar la vista, dejando el resto de los parámetros.
     *
     * ⚠️ Borra SOLO `filtro`: `lead_id` tiene que poder convivir con el deep link
     * (`/leads?filtro=sin-responder&lead_id=5`), igual que `open_lead_from_query_param()` borra
     * solo `lead_id` y deja el `filtro` puesto.
     *
     * @returns {void}
     */
    limpiar_filtro_de_la_query() {
      if (!this.$route.query.filtro) {
        return
      }
      const query = Object.assign({}, this.$route.query)
      delete query.filtro
      this.$router.replace({ query: query }).catch(function () {})
    },
    /**
     * ✕ del chip: apaga el filtro de atención, saca `filtro` de la query y recarga la lista.
     *
     * @returns {void}
     */
    quitar_filtro_sin_responder() {
      this.$store.commit('lead/set_chats_filtros', { solo_atencion: false })
      this.limpiar_filtro_de_la_query()
      this.$store.dispatch('lead/fetch_chats', { page: 1 })
    },

    /**
     * Si la URL trae ?lead_id=N (ej. al entrar desde un link de notificación WhatsApp, desde el
     * closer o desde el header de la conversación en teléfono), busca ese lead y abre su modal.
     * Limpia el query param después para que un refresh no lo vuelva a disparar.
     * @returns {void}
     */
    open_lead_from_query_param() {
      const lead_id = this.$route.query.lead_id
      if (!lead_id) {
        return
      }
      const self = this
      this.$store.dispatch('lead/fetch_full_model', lead_id).then(function (lead) {
        if (!lead) {
          self.$root.$emit('open_toast', 'No se encontró el lead solicitado.')
          return
        }
        self.on_open_lead_modal(lead)
      }).catch(function () {
        self.$root.$emit('open_toast', 'Error al cargar el lead solicitado.')
      }).then(function () {
        const query = Object.assign({}, self.$route.query)
        delete query.lead_id
        self.$router.replace({ query: query }).catch(function () {})
      })
    },

    /**
     * Abre el modal de detalle del lead. Alcanza con un objeto con `id`: el ModelModal pide el
     * registro completo por su cuenta al abrirse.
     * @param {Object} lead
     * @returns {void}
     */
    on_open_lead_modal(lead) {
      if (!lead || !lead.id) {
        return
      }
      this.modal_lead = lead
    },
    /**
     * Sincroniza el cierre del modal disparado desde adentro (BaseModal: Escape/backdrop/botón).
     * @param {boolean} value
     * @returns {void}
     */
    on_lead_modal_show(value) {
      if (!value) {
        this.modal_lead = null
      }
    },
    /**
     * @returns {void}
     */
    on_close_lead_modal() {
      this.modal_lead = null
    },
    /**
     * Guardar del modal: el lead vuelve actualizado; se refresca su fila y las tarjetas (pudo
     * cambiar de estado a mano).
     * @param {Object} model
     * @returns {void}
     */
    on_lead_modal_saved(model) {
      this.on_record_updated(model)
    },
    /**
     * Sincroniza en la lista, la conversación y las tarjetas los cambios que llegan desde el
     * modal (Guardar o acciones de las solapas extra) o desde el sidebar.
     * @param {Object} model lead actualizado en backend.
     * @returns {void}
     */
    on_record_updated(model) {
      if (!model || !model.id) {
        return
      }
      this.$store.dispatch('lead/upsert_model_in_lists', model)
      const conv = this.$store.state.lead.lead_en_conversacion
      if (conv && conv.id == model.id) {
        this.$store.commit('lead/update_lead_en_conversacion', model)
      }
      /* La fila de chat tiene otra forma que el lead (texto del último mensaje, semáforo): se
         vuelve a pedir en vez de armarla acá. */
      this.$store.dispatch('lead/fetch_chat_row', model.id)
      /* Editar el lead a mano puede haberle cambiado el estado, y ese es el único camino de
         cambio de estado que no pasa por el socket. */
      this.$store.dispatch('lead/fetch_status_cards')
    },

    /**
     * Abre la conversación WhatsApp del lead.
     * En desktop (≥768px): abre el sidebar lateral sin navegar.
     * En mobile (<768px): navega a la ruta de pantalla completa.
     * Si venía del modal (botón de la solapa Resumen), el modal se cierra antes: quedaría por
     * encima del sidebar.
     * @param {Object} lead Lead de la fila o del modal.
     * @returns {void}
     */
    on_open_conversation(lead) {
      if (!lead || !lead.id) {
        return
      }
      if (this.modal_lead) {
        this.modal_lead = null
      }
      if (window.innerWidth >= 768) {
        this.sidebar_lead = lead
      } else {
        this.save_scroll_position()
        this.$router.push({ name: 'lead_conversation', params: { lead_id: lead.id } })
      }
    },
    /**
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
      if (this.sidebar_lead && model && model.id && this.sidebar_lead.id === model.id) {
        this.sidebar_lead = Object.assign({}, this.sidebar_lead, model)
      }
    },

    /**
     * Clic en una tarjeta de estado: filtra la lista por ese estado (o por los slugs de una
     * tarjeta agrupada, como "Demo" u "Otros"). Volver a clickear la misma tarjeta saca el filtro:
     * sin la barra de grupos ya no hay botón "Todos".
     *
     * @param {{ value: string, text: string, slugs?: string[] }} card
     * @returns {void}
     */
    on_select_status_card(card) {
      if (!card || !card.value) {
        return
      }
      if (this.active_status_slug === card.value) {
        this.limpiar_filtro_de_estado()
        return
      }
      this.active_status_slug = card.value
      const status = Array.isArray(card.slugs) && card.slugs.length ? card.slugs.join(',') : card.value
      this.$store.commit('lead/set_chats_filtros', { status: status })
      this.$store.dispatch('lead/fetch_chats', { page: 1 })
    },
    /**
     * @returns {void}
     */
    limpiar_filtro_de_estado() {
      this.active_status_slug = null
      this.$store.commit('lead/set_chats_filtros', { status: null })
      this.$store.dispatch('lead/fetch_chats', { page: 1 })
    },

    /**
     * Fila del panel de demos: abre el modal del lead.
     * @param {Object} lead
     * @returns {void}
     */
    on_demo_row_click(lead) {
      this.on_open_lead_modal(lead)
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
      const self = this
      /* GET duración configurada para calcular "Llamar a las". Cacheado: acá solo se lee, y el
         PUT de /cuenta#lead-demo-settings invalida la entrada. */
      cached_get('/settings/lead-demo', { max_age_ms: MAX_AGE_SETTINGS }).then(function (data) {
        if (data && data.duracion_minutos) {
          self.duracion_minutos = parseInt(data.duracion_minutos, 10) || 60
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
      const today = new Date()
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
     * Agrupa leads por demo_date y ordena días y horas según el criterio indicado.
     * @param {Array} leads Lista de leads con demo_date.
     * @param {boolean} sort_dates_asc true = fechas ascendente; false = descendente (más reciente primero).
     * @returns {Array} Grupos { date_key, heading, is_today, leads }.
     */
    build_demos_day_groups(leads, sort_dates_asc) {
      const self = this
      const today_str = self.get_today_str()
      const groups_map = {}

      leads.forEach(function (lead) {
        const date_key = self.parse_demo_date_key(lead)
        if (!date_key) {
          return
        }
        if (!groups_map[date_key]) {
          groups_map[date_key] = []
        }
        groups_map[date_key].push(lead)
      })

      const date_keys = Object.keys(groups_map)
      date_keys.sort(function (a, b) {
        if (sort_dates_asc) {
          return a.localeCompare(b)
        }
        return b.localeCompare(a)
      })

      const grouped = []
      date_keys.forEach(function (date_key) {
        const day_leads = groups_map[date_key].slice()
        /* Dentro del día: próximas por hora ascendente; realizadas por hora descendente. */
        day_leads.sort(function (a, b) {
          const ta = a.demo_start_time || ''
          const tb = b.demo_start_time || ''
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
     * Carga todos los leads del ciclo de vida de la demo (cualquier status relevante), clasifica
     * por demo_date + status real, y agrupa por fecha para el panel del header.
     * Las demos de hoy (cualquier status) van a Próximas; las de días anteriores se dividen
     * entre "En curso" (status intermedio sin confirmar fin) y "Realizadas" (resto).
     * @returns {void}
     */
    load_demos_agendadas() {
      const self = this
      self.loading_demos_agendadas = true
      api
        .get('/lead', { params: { status: DEMO_LIFECYCLE_STATUSES.join(',') } })
        .then(function (res) {
          let leads = (res.data && res.data.models)
            ? res.data.models
            : (Array.isArray(res.data) ? res.data : [])

          /* Conservar solo leads con demo_date válida. */
          leads = leads.filter(function (l) {
            return !!self.parse_demo_date_key(l)
          })

          const today_str = self.get_today_str()

          /*
           * Clasificación en tres grupos, basada en demo_date + status real del lead:
           * - Próximas: hoy (CUALQUIER status, para que una demo en curso o recién realizada nunca
           *   "desaparezca") + días futuros.
           * - En curso: días anteriores a hoy cuyo status sigue en un estado intermedio sin
           *   confirmar fin (caso borde: demo que quedó trabada sin cerrarse).
           * - Realizadas: días anteriores a hoy con status demo_realizada, o cualquier otro status
           *   viejo no resuelto (el día ya pasó, no tiene sentido seguir mostrándolo como pendiente).
           */
          const proximas_leads = []
          const en_curso_leads = []
          const realizadas_leads = []

          leads.forEach(function (lead) {
            const date_key = self.parse_demo_date_key(lead)

            if (date_key >= today_str) {
              proximas_leads.push(lead)
              return
            }

            if (EN_CURSO_LIFECYCLE_STATUSES.indexOf(lead.status) >= 0) {
              en_curso_leads.push(lead)
              return
            }

            realizadas_leads.push(lead)
          })

          self.demos_por_dia = self.build_demos_day_groups(proximas_leads, true)
          self.demos_en_curso_por_dia = self.build_demos_day_groups(en_curso_leads, true)
          self.demos_pasadas_por_dia = self.build_demos_day_groups(realizadas_leads, false)
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
      const parts = date_key.split('-')
      if (parts.length !== 3) {
        return date_key
      }
      const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      const local_date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      const weekday = weekdays[local_date.getDay()] || ''
      const label = parts[2] + '/' + parts[1] + '/' + parts[0]
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
      const target_client = lead.target_client
      if (target_client) {
        const company_name = (target_client.company_name || '').trim()
        if (company_name) {
          return company_name
        }
        const client_name = (target_client.name || '').trim()
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
      const match = (lead.demo_start_time + '').match(/(\d{1,2}):(\d{2})/)
      if (!match) {
        return '—'
      }
      const total_minutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + this.duracion_minutos
      const hours = Math.floor(total_minutes / 60)
      const mins = total_minutes % 60
      return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0')
    },
    /**
     * Devuelve label y clase de badge según la etapa del ciclo de vida de la demo
     * (pendiente / en curso / realizada), a partir del status real del lead.
     * @param {Object} lead Lead con campo status.
     * @returns {{label: string, class: string}}
     */
    demo_lifecycle_badge(lead) {
      const status = lead && lead.status
      if (status === 'demo_realizada') {
        return { label: 'Realizada', class: 'bg-light text-secondary border' }
      }
      if (EN_CURSO_LIFECYCLE_STATUSES.indexOf(status) >= 0) {
        return { label: 'En curso', class: 'bg-success' }
      }
      return { label: 'Pendiente', class: 'bg-primary' }
    },
    /**
     * Devuelve la clase CSS del badge según el estado del demo setup.
     *
     * 🔴 `sin_confirmar` comparte el amarillo con `ejecutandose`, y no cae al gris del `return` de
     * abajo. Los dos estados significan lo mismo para el que mira la lista: hay una corrida viva y
     * no se sabe cómo terminó. Con el gris se veía idéntico a `pendiente` —o sea, a un setup que
     * nunca corrió— en las tres listas, que es la lectura exactamente opuesta a la real. Es la
     * misma decisión que ya toma `lead/extra-props/Index.vue`, donde `sin_confirmar` mapea a
     * 'running' para ocultar el botón de volver a dispararlo.
     *
     * @param {string|null} status Estado del setup.
     * @returns {string} Clase Bootstrap para el badge.
     */
    demo_setup_badge_class(status) {
      if (status === 'exitoso') return 'bg-success'
      if (status === 'ejecutandose' || status === 'sin_confirmar') return 'bg-warning text-dark'
      if (status === 'fallido') return 'bg-danger'
      return 'bg-secondary'
    },
  },
}
</script>

<style scoped>
/* Filas clickeables del panel de demos agendadas (misma UX que la lista de chats). */
.demos-agendadas-row {
  cursor: pointer;
}

/* Contenedor con scroll horizontal cuando la tabla no entra en pantallas angostas. */
.demos-agendadas-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* Ancho mínimo para mantener columnas legibles y forzar scroll horizontal en móvil. */
.demos-agendadas-table {
  min-width: 48rem;
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

/* En teléfono los chips y los botones de la derecha comparten una sola fila angosta: los botones
   no se encogen y los chips se truncan antes de romper la fila. */
@media (max-width: 575.98px) {
  .leads-toolbar .badge {
    max-width: 70vw;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
