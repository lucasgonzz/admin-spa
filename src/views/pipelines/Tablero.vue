<template>
  <!--
    Pipelines > Tablero (misión pipelines-crm, 27/9/2026).

    Encabezado: selector de pipeline (recordado en localStorage y en ?pipeline=), toggle
    Tablero/Listado, "Agregar", filtros (responsable, cliente/lead, búsqueda, chips de vencidas y de
    hoy) y el resumen (abiertas / ganadas / perdidas / tasa) con el embudo desplegable.

    Todo sale de un solo pedido: GET pipelines/{id}/opportunities, que devuelve las oportunidades y
    el `resumen`. El resumen lo calcula el back SIN la búsqueda ni los chips (solo respeta
    responsable y tipo de sujeto), así el embudo no se achica al buscar.
  -->
  <div class="pl-vista">
    <div class="pl-head">
      <div class="pl-head__title">
        <h2 class="h4 mb-0">Pipelines</h2>
        <p v-if="pipeline && pipeline.description" class="pl-head__desc">{{ pipeline.description }}</p>
      </div>
      <router-link class="btn btn-link btn-sm pl-head__config" :to="config_link">
        <i class="bi bi-sliders" aria-hidden="true" />Configurar
      </router-link>
    </div>

    <div v-if="pipelines_error" class="alert alert-danger d-flex flex-wrap align-items-center gap-2">
      <span>{{ pipelines_error }}</span>
      <button type="button" class="btn btn-outline-danger btn-sm ms-auto" @click="load_pipelines">Reintentar</button>
    </div>

    <div v-else-if="!pipelines_loaded" class="text-center py-5" role="status" aria-live="polite">
      <span class="spinner-border text-primary" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando pipelines…</p>
    </div>

    <div v-else-if="!all_pipelines.length" class="pl-empty">
      <i class="bi bi-kanban pl-empty__icon" aria-hidden="true" />
      <p class="mb-1 fw-semibold">Todavía no hay pipelines.</p>
      <p class="text-muted small mb-3">Creá el primero desde la configuración: nombre, etapas y lo que pide cada una.</p>
      <router-link class="btn btn-primary btn-sm" to="/pipelines/configuracion">Ir a configuración</router-link>
    </div>

    <template v-else>
      <!-- Pipeline, vista y alta -->
      <div class="pl-toolbar">
        <div class="pl-toolbar__pipeline">
          <label class="visually-hidden" for="pl-tablero-pipeline">Pipeline</label>
          <select
            id="pl-tablero-pipeline"
            class="form-select pl-toolbar__select"
            :value="pipeline_id ? String(pipeline_id) : ''"
            @change="on_pipeline_select($event)"
          >
            <option v-for="p in active_pipelines" :key="p.id" :value="String(p.id)">{{ p.name }}</option>
            <optgroup v-if="visible_archived.length" label="Archivados">
              <option v-for="p in visible_archived" :key="p.id" :value="String(p.id)">{{ p.name }}</option>
            </optgroup>
            <option v-if="can_show_more_archived" :value="SHOW_ARCHIVED">Ver archivados…</option>
          </select>
          <span v-if="pipeline && pipeline.archived_at" class="pl-toolbar__archived">Archivado</span>
        </div>

        <div class="pl-toolbar__actions">
          <div class="btn-group btn-group-sm" role="group" aria-label="Vista">
            <button
              type="button"
              class="btn"
              :class="view_mode === 'tablero' ? 'btn-secondary' : 'btn-outline-secondary'"
              :aria-pressed="view_mode === 'tablero' ? 'true' : 'false'"
              @click="set_view_mode('tablero')"
            >
              <i class="bi bi-kanban me-1" aria-hidden="true" />Tablero
            </button>
            <button
              type="button"
              class="btn"
              :class="view_mode === 'listado' ? 'btn-secondary' : 'btn-outline-secondary'"
              :aria-pressed="view_mode === 'listado' ? 'true' : 'false'"
              @click="set_view_mode('listado')"
            >
              <i class="bi bi-list-ul me-1" aria-hidden="true" />Listado
            </button>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="!pipeline"
            title="Agregar clientes o leads"
            @click="open_add_modal"
          >
            <i class="bi bi-plus-lg me-1" aria-hidden="true" />Agregar
          </button>
        </div>
      </div>

      <!-- Filtros -->
      <div class="pl-filters">
        <select
          v-model="filters.owner_admin_id"
          class="form-select form-select-sm pl-filters__owner"
          aria-label="Responsable"
        >
          <option value="">Todos los responsables</option>
          <option v-for="admin in admins" :key="admin.id" :value="String(admin.id)">
            {{ admin.name }}{{ Number(admin.id) === Number(my_admin_id) ? ' (yo)' : '' }}
          </option>
        </select>

        <div class="btn-group btn-group-sm pl-filters__subject" role="group" aria-label="Clientes o leads">
          <button
            v-for="option in subject_type_options"
            :key="option.value"
            type="button"
            class="btn"
            :class="filters.subject_type === option.value ? 'btn-secondary' : 'btn-outline-secondary'"
            :aria-pressed="filters.subject_type === option.value ? 'true' : 'false'"
            @click="filters.subject_type = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <input
          v-model="q_input"
          type="search"
          class="form-control form-control-sm pl-filters__search"
          placeholder="Buscar por nombre o empresa"
          aria-label="Buscar por nombre o empresa"
        />

        <template v-if="view_mode === 'listado'">
          <select v-model="filters.estado" class="form-select form-select-sm pl-filters__estado" aria-label="Estado">
            <option value="todas">Todas</option>
            <option value="abiertas">Abiertas</option>
            <option value="ganadas">Ganadas</option>
            <option value="perdidas">Perdidas</option>
          </select>
          <select v-model="filters.stage_id" class="form-select form-select-sm pl-filters__stage" aria-label="Etapa">
            <option value="">Todas las etapas</option>
            <option v-for="stage in board_stages" :key="stage.id" :value="String(stage.id)">{{ stage.name }}</option>
          </select>
        </template>

        <div class="pl-filters__chips">
          <button
            type="button"
            class="pl-chip"
            :class="{ 'pl-chip--active': filters.agenda === 'overdue' }"
            :aria-pressed="filters.agenda === 'overdue' ? 'true' : 'false'"
            @click="toggle_agenda('overdue')"
          >
            <span class="pl-chip__dot pl-chip__dot--overdue" aria-hidden="true" />Vencidas ({{ agenda_counts.overdue }})
          </button>
          <button
            type="button"
            class="pl-chip"
            :class="{ 'pl-chip--active': filters.agenda === 'today' }"
            :aria-pressed="filters.agenda === 'today' ? 'true' : 'false'"
            @click="toggle_agenda('today')"
          >
            <span class="pl-chip__dot pl-chip__dot--today" aria-hidden="true" />Hoy ({{ agenda_counts.today }})
          </button>
        </div>
      </div>

      <!-- Resumen y embudo -->
      <div v-if="resumen" class="pl-summary">
        <div class="pl-summary__line">
          <span><strong>{{ summary.abiertas }}</strong> {{ summary.abiertas === 1 ? 'abierta' : 'abiertas' }}</span>
          <span class="pl-summary__sep" aria-hidden="true">·</span>
          <span><strong>{{ summary.ganadas }}</strong> {{ summary.ganadas === 1 ? 'ganada' : 'ganadas' }}</span>
          <span class="pl-summary__sep" aria-hidden="true">·</span>
          <span><strong>{{ summary.perdidas }}</strong> {{ summary.perdidas === 1 ? 'perdida' : 'perdidas' }}</span>
          <span class="pl-summary__sep" aria-hidden="true">·</span>
          <span title="Ganadas sobre cerradas (ganadas + perdidas)"><strong>{{ summary.tasa }}</strong> de éxito</span>
          <button
            type="button"
            class="btn btn-link btn-sm pl-summary__toggle"
            :aria-expanded="show_funnel ? 'true' : 'false'"
            @click="show_funnel = !show_funnel"
          >
            Embudo <i class="bi" :class="show_funnel ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true" />
          </button>
        </div>

        <div v-if="show_funnel" class="pl-funnel">
          <div class="pl-funnel__stages">
            <div class="pl-funnel__head">
              <span>Etapa</span>
              <span class="text-end" title="Oportunidades que están hoy en la etapa">Ahora</span>
              <span class="text-end" title="Oportunidades distintas que alguna vez entraron a la etapa">Pasaron</span>
            </div>
            <div v-for="row in funnel_rows" :key="row.stage.id" class="pl-funnel__row">
              <div class="pl-funnel__name">
                <stage-tag :stage="row.stage" />
                <span class="pl-funnel__bar" aria-hidden="true">
                  <span class="pl-funnel__bar-fill" :style="{ width: row.pct + '%', backgroundColor: row.stage.color || '#adb5bd' }" />
                </span>
              </div>
              <span class="text-end">{{ row.ahora }}</span>
              <span class="text-end">{{ row.pasaron }}</span>
            </div>
            <p class="pl-funnel__note">
              «Ahora» son las que están hoy en la etapa. «Pasaron» son todas las que alguna vez entraron,
              aunque después hayan seguido de largo o se hayan cerrado: cada una cuenta una sola vez.
            </p>
          </div>
          <div class="pl-funnel__reasons">
            <p class="pl-funnel__title">Motivos de pérdida</p>
            <p v-if="!lost_reasons_summary.length" class="text-muted small mb-0">Todavía no hay oportunidades perdidas.</p>
            <ul v-else class="pl-funnel__reason-list">
              <li v-for="item in lost_reasons_summary" :key="item.motivo">
                <span class="pl-funnel__reason">{{ item.motivo }}</span>
                <strong>{{ item.cantidad }}</strong>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Contenido -->
      <div v-if="loading && !loaded_once" class="text-center py-5" role="status" aria-live="polite">
        <span class="spinner-border text-primary" aria-hidden="true" />
        <p class="text-muted small mt-2 mb-0">Cargando oportunidades…</p>
      </div>

      <div v-else-if="load_error" class="alert alert-danger">
        {{ load_error }}
        <button type="button" class="btn btn-link btn-sm" @click="load_opportunities(false)">Reintentar</button>
      </div>

      <div v-else-if="pipeline" class="pl-content" :class="{ 'pl-content--refreshing': loading }">
        <pipeline-board
          v-if="view_mode === 'tablero'"
          :stages="board_stages"
          :opportunities="opportunities"
          @open="open_opportunity"
          @move="open_move_modal"
        />
        <opportunity-list
          v-else
          :opportunities="opportunities"
          @open="open_opportunity"
          @move="open_move_modal({ opportunity: $event, stage_id: null })"
        />
      </div>
    </template>

    <!-- Modales: cada apertura con una key nueva, así nunca arrastran estado de la anterior. -->
    <move-modal
      v-if="move_modal.show && pipeline"
      :key="'move-' + move_modal.key"
      :show="true"
      :opportunity="move_modal.opportunity"
      :pipeline="pipeline"
      :initial_stage_id="move_modal.stage_id"
      @close="move_modal.show = false"
      @moved="on_moved"
      @rule-error="load_opportunities(true)"
    />

    <opportunity-modal
      v-if="opportunity_modal.show"
      :key="'ficha-' + opportunity_modal.key"
      :show="true"
      :opportunity_id="opportunity_modal.opportunity_id"
      @close="on_opportunity_closed"
      @changed="on_opportunity_changed"
      @deleted="on_opportunity_deleted"
    />

    <add-modal
      v-if="add_modal.show && pipeline"
      :key="'alta-' + add_modal.key"
      :show="true"
      :pipeline="pipeline"
      @close="add_modal.show = false"
      @added="on_added"
    />
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import PipelineBoard from '@/components/pipeline/Board.vue'
import OpportunityList from '@/components/pipeline/OpportunityList.vue'
import MoveModal from '@/components/pipeline/MoveModal.vue'
import OpportunityModal from '@/components/pipeline/OpportunityModal.vue'
import AddModal from '@/components/pipeline/AddModal.vue'
import StageTag from '@/components/pipeline/StageTag.vue'
import { show_toast, sort_stages_for_board } from '@/components/pipeline/pipeline_helpers'

/** Clave de localStorage del último pipeline elegido. */
const STORAGE_PIPELINE_KEY = 'admin_pipelines_pipeline_id'

/** Clave de localStorage de la vista elegida (tablero o listado). */
const STORAGE_VIEW_KEY = 'admin_pipelines_vista'

/** Valor de la opción "Ver archivados…" del selector. */
const SHOW_ARCHIVED = '__archivados__'

/** Espera antes de buscar mientras se tipea. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Lee de localStorage sin romper si no está disponible (modo privado, bloqueado).
 *
 * @param {string} key
 * @returns {string|null}
 */
function storage_get(key) {
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    return null
  }
}

/**
 * Escribe en localStorage sin romper si no está disponible.
 *
 * @param {string} key
 * @param {string} value
 */
function storage_set(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch (error) {
    // Sin localStorage la vista funciona igual: solo no recuerda la elección.
  }
}

/**
 * Filtros de la vista, recién abierta. El responsable arranca en "Todos" en cada entrada (mismo
 * criterio que Tareas: no se persiste).
 *
 * @returns {Object}
 */
function empty_filters() {
  return {
    owner_admin_id: '',
    subject_type: '',
    q: '',
    agenda: '',
    estado: 'todas',
    stage_id: '',
  }
}

export default {
  name: 'ViewPipelinesTablero',
  components: { PipelineBoard, OpportunityList, MoveModal, OpportunityModal, AddModal, StageTag },
  data() {
    const stored_view = storage_get(STORAGE_VIEW_KEY)
    return {
      SHOW_ARCHIVED: SHOW_ARCHIVED,
      /** Pipeline elegido. */
      pipeline_id: null,
      /** true = el selector muestra los archivados. */
      show_archived: false,
      /** Error al cargar la lista de pipelines. */
      pipelines_error: null,
      /** `tablero` | `listado`. */
      view_mode: stored_view === 'listado' ? 'listado' : 'tablero',
      filters: empty_filters(),
      /** Lo que se tipea en el buscador (llega a `filters.q` con debounce). */
      q_input: '',
      search_timer: null,
      /** Oportunidades del pipeline con los filtros actuales. */
      opportunities: [],
      /** Resumen del back (`por_etapa`, `abiertas`, …, `agenda`). */
      resumen: null,
      loading: false,
      /** true cuando ya se mostró algo para el pipeline actual (las recargas no tapan la vista). */
      loaded_once: false,
      load_error: null,
      /** Secuencia de pedidos: una respuesta vieja no pisa a una nueva. */
      request_seq: 0,
      show_funnel: false,
      move_modal: { show: false, opportunity: null, stage_id: null, key: 0 },
      opportunity_modal: { show: false, opportunity_id: null, key: 0 },
      add_modal: { show: false, key: 0 },
      subject_type_options: [
        { value: '', label: 'Todos' },
        { value: 'client', label: 'Clientes' },
        { value: 'lead', label: 'Leads' },
      ],
    }
  },
  computed: {
    /** @returns {Array<Object>} */
    all_pipelines() {
      return this.$store.state.pipeline.pipelines
    },
    /** @returns {boolean} */
    pipelines_loaded() {
      return this.$store.state.pipeline.pipelines_loaded
    },
    /** @returns {Array<Object>} */
    active_pipelines() {
      return this.$store.getters['pipeline/active_pipelines']
    },
    /** @returns {Array<Object>} */
    archived_pipelines() {
      return this.$store.getters['pipeline/archived_pipelines']
    },
    /**
     * Archivados que aparecen en el selector: todos si se pidió verlos, o solo el elegido (si se
     * entró a uno archivado por URL), para que el selector no quede en blanco.
     * @returns {Array<Object>}
     */
    visible_archived() {
      if (this.show_archived) {
        return this.archived_pipelines
      }
      const self = this
      return this.archived_pipelines.filter(function (p) {
        return Number(p.id) === Number(self.pipeline_id)
      })
    },
    /** @returns {boolean} */
    can_show_more_archived() {
      return !this.show_archived && this.archived_pipelines.length > this.visible_archived.length
    },
    /** @returns {Object|null} */
    pipeline() {
      return this.$store.getters['pipeline/pipeline_by_id'](this.pipeline_id)
    },
    /** @returns {string} La configuración, parada en el pipeline que se está mirando. */
    config_link() {
      return this.pipeline_id ? '/pipelines/configuracion?pipeline=' + this.pipeline_id : '/pipelines/configuracion'
    },
    /** @returns {Array<Object>} */
    board_stages() {
      return sort_stages_for_board((this.pipeline && this.pipeline.stages) || [])
    },
    /** @returns {Array<Object>} */
    admins() {
      return this.$store.state.pipeline.admins || []
    },
    /** @returns {number|null} */
    my_admin_id() {
      const me = this.$store.state.auth.admin
      return me ? me.id : null
    },
    /**
     * Parámetros del GET. En el tablero siempre van todas (las columnas ganada/perdida también se
     * llenan); estado y etapa filtran solo en el listado.
     * @returns {Object}
     */
    request_params() {
      const params = { estado: 'todas' }
      if (this.filters.owner_admin_id) {
        params.owner_admin_id = this.filters.owner_admin_id
      }
      if (this.filters.subject_type) {
        params.subject_type = this.filters.subject_type
      }
      if (this.filters.q.trim() !== '') {
        params.q = this.filters.q.trim()
      }
      if (this.filters.agenda) {
        params.agenda = this.filters.agenda
      }
      if (this.view_mode === 'listado') {
        params.estado = this.filters.estado || 'todas'
        if (this.filters.stage_id) {
          params.stage_id = this.filters.stage_id
        }
      }
      return params
    },
    /**
     * Firma del pedido: se recarga solo cuando cambia de verdad (cambiar de vista con los mismos
     * parámetros no vuelve a pedir).
     * @returns {string}
     */
    request_key() {
      return String(this.pipeline_id) + '|' + JSON.stringify(this.request_params)
    },
    /** @returns {{ overdue: number, today: number }} */
    agenda_counts() {
      const agenda = (this.resumen && this.resumen.agenda) || {}
      return {
        overdue: Number(agenda.overdue) || 0,
        today: Number(agenda.today) || 0,
      }
    },
    /** @returns {Object} */
    summary() {
      const r = this.resumen || {}
      const abiertas = Number(r.abiertas) || 0
      const ganadas = Number(r.ganadas) || 0
      const perdidas = Number(r.perdidas) || 0
      const cerradas = ganadas + perdidas
      return {
        abiertas: abiertas,
        ganadas: ganadas,
        perdidas: perdidas,
        tasa: cerradas > 0 ? Math.round((ganadas * 100) / cerradas) + ' %' : '—',
      }
    },
    /**
     * Embudo: una fila por etapa, en el orden del tablero, con `ahora` y `pasaron`. La barra es
     * `pasaron` relativo a la etapa por la que pasaron más.
     * @returns {Array<Object>}
     */
    funnel_rows() {
      const by_stage = {}
      const items = (this.resumen && this.resumen.por_etapa) || []
      items.forEach(function (item) {
        by_stage[item.stage_id] = item
      })
      const rows = this.board_stages.map(function (stage) {
        const item = by_stage[stage.id] || {}
        return {
          stage: stage,
          ahora: Number(item.ahora) || 0,
          pasaron: Number(item.pasaron) || 0,
          pct: 0,
        }
      })
      let max = 0
      rows.forEach(function (row) {
        if (row.pasaron > max) {
          max = row.pasaron
        }
      })
      rows.forEach(function (row) {
        row.pct = max > 0 ? Math.round((row.pasaron * 100) / max) : 0
      })
      return rows
    },
    /** @returns {Array<{motivo: string, cantidad: number}>} */
    lost_reasons_summary() {
      const list = (this.resumen && this.resumen.motivos_perdida) || []
      return Array.isArray(list) ? list : []
    },
  },
  watch: {
    /** Cualquier cambio real de parámetros (o de pipeline) recarga. */
    request_key: function () {
      this.load_opportunities(false)
    },
    /** Buscar mientras se tipea, con un respiro. */
    q_input: function () {
      const self = this
      if (this.search_timer) {
        clearTimeout(this.search_timer)
      }
      this.search_timer = setTimeout(function () {
        self.search_timer = null
        self.filters.q = self.q_input
      }, SEARCH_DEBOUNCE_MS)
    },
    /** Navegar con ?pipeline= (atrás/adelante del navegador, un link) cambia el pipeline. */
    '$route.query.pipeline': function (value) {
      if (!value || !this.pipelines_loaded) {
        return
      }
      const id = Number(value)
      if (!isNaN(id) && id !== Number(this.pipeline_id) && this.$store.getters['pipeline/pipeline_by_id'](id)) {
        this.select_pipeline(id)
      }
    },
  },
  created() {
    this.$store.dispatch('pipeline/fetch_meta')
    this.$store.dispatch('pipeline/fetch_admins')
    this.load_pipelines()
  },
  beforeUnmount() {
    if (this.search_timer) {
      clearTimeout(this.search_timer)
    }
  },
  methods: {
    /**
     * Trae la lista de pipelines y elige el de entrada. También es el "Reintentar" cuando falla.
     */
    load_pipelines() {
      const self = this
      this.pipelines_error = null
      this.$store
        .dispatch('pipeline/fetch_pipelines')
        .then(function () {
          if (!self.pipeline_id) {
            self.resolve_initial_pipeline()
          }
        })
        .catch(function (error) {
          self.pipelines_error = resolve_error_message(error)
        })
    },
    /**
     * Elige el pipeline de entrada: el de `?pipeline=`, si no el último usado (localStorage), si no
     * el primero activo (o el primero archivado, si no hay activos).
     */
    resolve_initial_pipeline() {
      const get = this.$store.getters['pipeline/pipeline_by_id']
      const from_query = this.$route.query.pipeline
      let chosen = from_query ? get(from_query) : null
      if (!chosen) {
        const stored = storage_get(STORAGE_PIPELINE_KEY)
        const from_storage = stored ? get(stored) : null
        chosen = from_storage && !from_storage.archived_at ? from_storage : null
      }
      if (!chosen) {
        chosen = this.active_pipelines[0] || this.archived_pipelines[0] || null
      }
      if (chosen) {
        this.select_pipeline(chosen.id)
      }
    },
    /**
     * Cambia de pipeline: lo recuerda, lo deja en la URL y arranca la carga (vía `request_key`).
     *
     * @param {number} id
     */
    select_pipeline(id) {
      const next_id = Number(id)
      if (next_id === Number(this.pipeline_id)) {
        return
      }
      this.pipeline_id = next_id
      this.opportunities = []
      this.resumen = null
      this.loaded_once = false
      this.load_error = null
      // Las etapas son de cada pipeline: el filtro de etapa no sobrevive al cambio.
      this.filters.stage_id = ''
      storage_set(STORAGE_PIPELINE_KEY, String(next_id))
      if (String(this.$route.query.pipeline || '') !== String(next_id)) {
        const query = Object.assign({}, this.$route.query, { pipeline: String(next_id) })
        this.$router.replace({ query: query }).catch(function () {
          return null
        })
      }
    },
    /**
     * `change` del selector: o un pipeline, o "Ver archivados…".
     *
     * @param {Event} event
     */
    on_pipeline_select(event) {
      const value = event.target.value
      if (value === SHOW_ARCHIVED) {
        this.show_archived = true
        // El select no puede quedar parado en "Ver archivados…": vuelve al pipeline actual.
        event.target.value = this.pipeline_id ? String(this.pipeline_id) : ''
        return
      }
      if (value) {
        this.select_pipeline(value)
      }
    },
    /**
     * @param {string} mode `tablero` | `listado`
     */
    set_view_mode(mode) {
      this.view_mode = mode
      storage_set(STORAGE_VIEW_KEY, mode)
    },
    /**
     * Chips de vencidas / hoy: uno a la vez; tocar el activo lo apaga.
     *
     * @param {string} bucket
     */
    toggle_agenda(bucket) {
      this.filters.agenda = this.filters.agenda === bucket ? '' : bucket
    },
    /**
     * GET pipelines/{id}/opportunities. Con `silent` no muestra spinner (recarga después de mover,
     * editar o dar de alta: la vista queda como está hasta que llega lo nuevo).
     *
     * @param {boolean} silent
     */
    load_opportunities(silent) {
      const self = this
      const id = this.pipeline_id
      if (!id) {
        return
      }
      this.request_seq = this.request_seq + 1
      const seq = this.request_seq
      if (!silent) {
        this.loading = true
      }
      api
        .get('/pipelines/' + id + '/opportunities', { params: this.request_params })
        .then(function (res) {
          if (seq !== self.request_seq) {
            return
          }
          const data = res.data || {}
          self.opportunities = Array.isArray(data.opportunities) ? data.opportunities : []
          self.resumen = data.resumen || null
          self.loading = false
          self.loaded_once = true
          self.load_error = null
        })
        .catch(function (error) {
          if (seq !== self.request_seq) {
            return
          }
          self.loading = false
          if (!self.loaded_once) {
            self.load_error = resolve_error_message(error)
          }
        })
    },
    /**
     * Reemplaza una oportunidad en la lista con la versión nueva (si está), para que la tarjeta
     * cambie de columna al toque; la recarga silenciosa de después acomoda orden y resumen.
     *
     * @param {Object|null} updated
     */
    replace_opportunity(updated) {
      if (!updated || !updated.id) {
        return
      }
      this.opportunities = this.opportunities.map(function (o) {
        return Number(o.id) === Number(updated.id) ? Object.assign({}, o, updated) : o
      })
    },
    /**
     * @param {Object} opportunity
     */
    open_opportunity(opportunity) {
      this.opportunity_modal = {
        show: true,
        opportunity_id: opportunity.id,
        key: this.opportunity_modal.key + 1,
      }
    },
    /**
     * Abre el modal de mover. `stage_id` viene al soltar en otra columna; null desde "Mover".
     *
     * @param {{ opportunity: Object, stage_id: (number|null) }} payload
     */
    open_move_modal(payload) {
      if (!payload || !payload.opportunity) {
        return
      }
      this.move_modal = {
        show: true,
        opportunity: payload.opportunity,
        stage_id: payload.stage_id === undefined ? null : payload.stage_id,
        key: this.move_modal.key + 1,
      }
    },
    open_add_modal() {
      this.add_modal = { show: true, key: this.add_modal.key + 1 }
    },
    /**
     * El back confirmó el movimiento: recién ahora cambia la tarjeta de columna.
     *
     * @param {{ opportunity: Object, activity: Object }} payload
     */
    on_moved(payload) {
      this.move_modal = { show: false, opportunity: null, stage_id: null, key: this.move_modal.key }
      const updated = payload && payload.opportunity
      this.replace_opportunity(updated)
      show_toast(updated && updated.stage ? 'Pasó a «' + updated.stage.name + '».' : 'Oportunidad movida.')
      this.load_opportunities(true)
    },
    /**
     * Al cerrar la ficha se recarga el tablero: si se cerró con un guardado todavía en vuelo, su
     * `changed` no llega a nadie y la tarjeta quedaría vieja.
     */
    on_opportunity_closed() {
      this.opportunity_modal = { show: false, opportunity_id: null, key: this.opportunity_modal.key }
      this.load_opportunities(true)
    },
    /**
     * La ficha cambió algo (responsable, próxima acción, nota, etapa).
     *
     * @param {Object} opportunity
     */
    on_opportunity_changed(opportunity) {
      this.replace_opportunity(opportunity)
      this.load_opportunities(true)
    },
    /**
     * @param {number} id
     */
    on_opportunity_deleted(id) {
      this.opportunity_modal = { show: false, opportunity_id: null, key: this.opportunity_modal.key }
      this.opportunities = this.opportunities.filter(function (o) {
        return Number(o.id) !== Number(id)
      })
      this.load_opportunities(true)
    },
    on_added() {
      this.add_modal = { show: false, key: this.add_modal.key }
      this.load_opportunities(true)
    },
  },
}
</script>

<style scoped>
/* La vista nunca es más ancha que el área del módulo: lo único que scrollea a lo ancho es el
   tablero (o la tabla del listado), adentro de su propio contenedor. */
.pl-vista {
  min-width: 0;
  max-width: 100%;
  padding-top: 0.5rem;
}

.pl-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.pl-head__title {
  min-width: 0;
}

.pl-head__desc {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.pl-head__config {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex: 0 0 auto;
  text-decoration: none;
  color: var(--color-text-secondary);
}

.pl-head__config:hover {
  color: var(--color-text-primary);
}

.pl-empty {
  text-align: center;
  padding: 3rem 1rem;
  border: 1px dashed var(--color-border);
  border-radius: 12px;
  background: var(--bg-card);
}

.pl-empty__icon {
  display: block;
  font-size: 2rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.pl-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
}

.pl-toolbar__pipeline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 16rem;
  max-width: 24rem;
  min-width: 0;
}

.pl-toolbar__select {
  font-weight: 600;
  min-width: 0;
}

.pl-toolbar__archived {
  flex: 0 0 auto;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: var(--bs-warning-bg-subtle);
  color: var(--bs-warning-text-emphasis);
}

.pl-toolbar__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pl-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.pl-filters__owner {
  flex: 0 1 13rem;
  width: auto;
  min-width: 0;
}

.pl-filters__search {
  flex: 1 1 10rem;
  max-width: 18rem;
  width: auto;
  min-width: 0;
}

.pl-filters__estado,
.pl-filters__stage {
  flex: 0 1 10rem;
  width: auto;
  min-width: 0;
}

.pl-filters__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-left: auto;
}

.pl-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 31px;
  padding: 0.2rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--color-text-primary);
  font-size: 0.8rem;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.pl-chip:hover {
  background: var(--bg-hover);
}

.pl-chip--active,
.pl-chip--active:hover {
  background: var(--color-text-primary);
  border-color: var(--color-text-primary);
  color: #fff;
}

.pl-chip__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.pl-chip__dot--overdue {
  background: var(--bs-danger);
}

.pl-chip__dot--today {
  background: var(--color-primary);
}

.pl-summary {
  margin-bottom: 0.75rem;
}

.pl-summary__line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.2rem 0.45rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.pl-summary__line strong {
  color: var(--color-text-primary);
  font-weight: 600;
}

.pl-summary__sep {
  color: var(--color-border);
}

.pl-summary__toggle {
  padding: 0 0.25rem;
  font-size: 0.85rem;
  text-decoration: none;
}

.pl-funnel {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 1rem 2rem;
  margin-top: 0.6rem;
  padding: 0.9rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
}

@media (max-width: 767.98px) {
  .pl-funnel {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pl-funnel__head,
.pl-funnel__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 3.5rem 3.5rem;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.85rem;
}

.pl-funnel__head {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.045em;
  color: var(--color-text-secondary);
  padding-bottom: 0.35rem;
}

.pl-funnel__row {
  padding: 0.3rem 0;
  border-top: 1px solid var(--color-border-secondary);
}

.pl-funnel__name {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.pl-funnel__bar {
  display: block;
  height: 4px;
  border-radius: 999px;
  background: var(--bg-hover);
  overflow: hidden;
}

.pl-funnel__bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  opacity: 0.8;
}

.pl-funnel__note {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.pl-funnel__title {
  margin: 0 0 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.045em;
  color: var(--color-text-secondary);
}

.pl-funnel__reason-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.85rem;
}

.pl-funnel__reason-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem 0;
  border-top: 1px solid var(--color-border-secondary);
}

.pl-funnel__reason {
  min-width: 0;
  word-break: break-word;
}

.pl-content {
  min-width: 0;
  max-width: 100%;
  transition: opacity 0.15s ease;
}

.pl-content--refreshing {
  opacity: 0.65;
}

@media (max-width: 575.98px) {
  .pl-toolbar__pipeline {
    flex-basis: 100%;
    max-width: none;
  }

  .pl-toolbar__actions {
    width: 100%;
    justify-content: space-between;
  }

  .pl-filters__owner {
    flex: 1 1 100%;
  }

  .pl-filters__search {
    flex: 1 1 100%;
    max-width: none;
  }

  .pl-filters__estado,
  .pl-filters__stage {
    flex: 1 1 calc(50% - 0.25rem);
  }

  .pl-filters__chips {
    margin-left: 0;
  }
}
</style>
