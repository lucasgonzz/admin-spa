<template>
  <section class="timeline-page" aria-labelledby="timeline-title">
    <header class="timeline-header">
      <div>
        <p class="timeline-eyebrow"><i class="bi bi-bezier2" aria-hidden="true"></i> Seguimiento de negocios</p>
        <h1 id="timeline-title">Implementaciones</h1>
        <p class="timeline-intro">Revisá el avance de gestión, ecommerce y agentes en una misma línea de tiempo.</p>
      </div>
      <nav class="timeline-actions" aria-label="Operación de implementaciones">
        <RouterLink :to="{ name: 'implementations_sistema' }" class="btn btn-sm btn-outline-secondary">
          Gestionar sistema <i class="bi bi-arrow-up-right" aria-hidden="true"></i>
        </RouterLink>
        <RouterLink :to="{ name: 'implementations_ecommerce' }" class="btn btn-sm btn-outline-secondary">
          Gestionar ecommerce <i class="bi bi-arrow-up-right" aria-hidden="true"></i>
        </RouterLink>
      </nav>
    </header>

    <p v-if="loading" class="timeline-empty" role="status">Cargando implementaciones…</p>
    <div v-else-if="error" class="timeline-empty">
      <p role="alert">No pudimos cargar las implementaciones.</p>
      <button type="button" class="btn btn-outline-primary btn-sm" @click="load">Volver a intentar</button>
    </div>
    <p v-else-if="!businesses.length" class="timeline-empty">Todavía no hay implementaciones registradas.</p>

    <template v-else>
      <div class="timeline-toolbar">
        <div class="timeline-search">
          <i class="bi bi-search" aria-hidden="true"></i>
          <input v-model.trim="search" type="search" class="form-control" placeholder="Buscar negocio" aria-label="Buscar negocio">
        </div>
        <div class="timeline-legend" aria-label="Estados de las etapas">
          <span v-for="state in ['pending', 'sent', 'completed']" :key="state">
            <i class="legend-dot" :class="'stage--' + state" aria-hidden="true"></i>{{ states[state] }}
          </span>
        </div>
        <div v-if="undated_width" class="timeline-jumps" aria-label="Desplazamiento por la línea de tiempo">
          <button type="button" class="btn btn-sm btn-link" @click="scroll_to(false)">Ver fechas</button>
          <button type="button" class="btn btn-sm btn-link" @click="scroll_to(true)">Etapas sin fecha <i class="bi bi-arrow-right" aria-hidden="true"></i></button>
        </div>
      </div>
      <p class="timeline-hint">
        {{ visible_businesses.length }} {{ visible_businesses.length === 1 ? 'negocio' : 'negocios' }} · Más recientes arriba
        <span v-if="visible_businesses.length"> · Deslizá hacia los costados para recorrer la línea de tiempo</span>
      </p>

      <p v-if="!visible_businesses.length" class="timeline-empty">No hay negocios que coincidan con la búsqueda.</p>
      <div
        v-else
        ref="timeline_scroll"
        class="timeline-scroll"
        role="region"
        aria-label="Línea de tiempo por negocio"
        tabindex="0"
        :style="{ '--dates-width': axis.width + 'px', '--undated-width': undated_width + 'px' }"
      >
        <div class="timeline-grid timeline-axis">
          <div class="timeline-sticky">Negocio</div>
          <div class="timeline-dates">
            <span v-for="tick in axis.ticks" :key="tick.day" class="timeline-tick" :style="{ left: tick.x + 'px' }" :title="tick.full_label">
              {{ tick.label }}
            </span>
          </div>
          <div v-if="undated_width" class="undated-heading">Etapas sin fecha</div>
        </div>

        <article v-for="business in visible_businesses" :key="business.id" class="timeline-business">
          <div class="timeline-grid timeline-business-heading">
            <div class="timeline-sticky business-identity">
              <img v-if="business.logo_url && !invalid_logos[business.id]" :src="business.logo_url" alt="" loading="lazy" @error="invalid_logos[business.id] = true">
              <span v-else class="business-avatar" aria-hidden="true">{{ initials(business.name) }}</span>
              <h2>{{ business.name }}</h2>
            </div>
          </div>
          <div
            v-for="branch in business.branches"
            :key="branch.type + '-' + branch.id"
            class="timeline-grid timeline-branch"
            :class="'branch--' + branch.type"
            :style="{ '--track-height': branch.height + 'px' }"
          >
            <div class="timeline-sticky branch-name">
              <i class="bi" :class="types[branch.type].icon" aria-hidden="true"></i>
              <div>
                <strong>{{ types[branch.type].label }}</strong>
                <small>{{ branch.completed_count }}/{{ branch.required_count }} etapas</small>
                <small v-if="branch_states[branch.status]" class="branch-state">{{ branch_states[branch.status] }}</small>
              </div>
            </div>
            <div class="timeline-dates branch-history">
              <span v-for="tick in axis.ticks" :key="tick.day" class="branch-gridline" :style="{ left: tick.x + 'px' }" aria-hidden="true"></span>
              <span v-if="branch.start !== null" class="branch-start" :style="{ left: branch.start + 'px' }" :title="'Inicio: ' + format_date(branch.created_at)" aria-hidden="true"></span>
              <span class="branch-line" aria-hidden="true" :style="{ left: (branch.line_start ?? 0) + 'px' }"></span>
              <span
                v-for="stage in branch.offset_stages"
                :key="stage.number"
                class="branch-connector"
                aria-hidden="true"
                :style="{ left: stage.x + 'px', height: stage.offset + 'px' }"
              ></span>
              <button
                v-for="stage in branch.dated"
                :key="stage.number"
                class="stage-button dated-stage"
                :class="'stage--' + stage.state"
                type="button"
                :style="{ left: stage.x + 'px', '--stage-offset': stage.offset + 'px' }"
                :aria-label="stage.name + ' · ' + states[stage.state]"
                @click="show_stage(business, branch, stage)"
              >
                <span class="stage-marker"><i class="bi" :class="stage.icon" aria-hidden="true"></i></span>
                <span class="stage-label">{{ stage.name }}</span>
              </button>
            </div>
            <div v-if="undated_width" class="branch-undated">
              <button
                v-for="stage in branch.undated"
                :key="stage.number"
                class="stage-button"
                :class="'stage--' + stage.state"
                type="button"
                :aria-label="stage.name + ' · ' + states[stage.state]"
                @click="show_stage(business, branch, stage)"
              >
                <span class="stage-marker"><i class="bi" :class="stage.icon" aria-hidden="true"></i></span>
                <span class="stage-label">{{ stage.name }}</span>
              </button>
            </div>
          </div>
        </article>
      </div>
    </template>

    <dialog ref="stage_dialog" class="stage-dialog" aria-labelledby="stage-dialog-title" @close="detail = null" @click.self="$refs.stage_dialog.close()">
      <div v-if="detail" class="stage-dialog-body">
        <button type="button" class="btn-close" aria-label="Cerrar detalle" autofocus @click="$refs.stage_dialog.close()"></button>
        <p class="timeline-eyebrow">{{ detail.business }} · {{ detail.branch }}</p>
        <h2 id="stage-dialog-title">{{ detail.stage.name }}</h2>
        <p class="stage-dialog-state" :class="'stage--' + detail.stage.state">
          <i class="legend-dot" aria-hidden="true"></i>{{ states[detail.stage.state] }}
        </p>
        <dl class="stage-evidence">
          <template v-for="entry in evidence" :key="entry.key">
            <dt>{{ entry.label }}</dt>
            <dd>
              <span v-if="entry.at">{{ format_date(entry.at) }}</span>
              <span v-if="entry.source">{{ entry.source }}</span>
              <RouterLink v-if="entry.ticket" :to="{ name: 'support_ticket_conversation', params: { ticket_id: entry.ticket } }" @click="$refs.stage_dialog.close()">
                Ver ticket #{{ entry.ticket }} <i class="bi bi-arrow-up-right" aria-hidden="true"></i>
              </RouterLink>
              <span v-if="!entry.ticket && !entry.source" class="evidence-missing">{{ entry.empty }}</span>
            </dd>
          </template>
        </dl>
      </div>
    </dialog>
  </section>
</template>

<script>
import api from '@/utils/axios'

const TYPES = {
  sistema: { label: 'Gestión', icon: 'bi-pc-display', stages: ['clipboard-check', 'cloud-download', 'file-earmark-arrow-up', 'database-up', 'box-seam', 'tags', 'receipt', 'chat-dots'] },
  tienda: { label: 'Ecommerce', icon: 'bi-shop', stages: ['clipboard-check', 'globe2', 'hdd-network', 'window', 'shop-window'] },
  agentes: { label: 'Agentes', icon: 'bi-robot', stages: ['sliders', 'mortarboard', 'whatsapp', 'link-45deg', 'chat-square-text', 'robot', 'shield-check', 'rocket-takeoff'] },
}
const TYPE_ORDER = Object.keys(TYPES)
const STATES = { pending: 'Pendiente', sent: 'Información enviada', completed: 'Completada', skipped: 'Omitida' }
const BRANCH_STATES = { pending: 'Pendiente', completed: 'Completada', paused: 'Pausada', cancelled: 'Cancelada' }
const DAY_MS = 86400000
const AR_TIME_ZONE = 'America/Argentina/Buenos_Aires'
const day_format = new Intl.DateTimeFormat('es-AR', { timeZone: AR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const tick_format = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: '2-digit' })
const full_tick_format = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', dateStyle: 'long' })
const detail_format = new Intl.DateTimeFormat('es-AR', { timeZone: AR_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' })

function timestamp(value) {
  const result = value ? Date.parse(value) : NaN
  return Number.isFinite(result) ? result : null
}

function day(value) {
  const date = timestamp(value)
  if (date === null) return null
  const parts = Object.fromEntries(day_format.formatToParts(date).map(({ type, value }) => [type, value]))
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY_MS
}

function state_for(stage) {
  if (stage.status === 'completed' || stage.status === 'skipped') return stage.status
  return stage.sent_at || stage.sent_ticket_id || stage.sent_source ? 'sent' : 'pending'
}

function stage_day(stage) {
  return day(stage.status === 'completed' ? stage.completed_at : stage.sent_at)
}

function make_axis(businesses) {
  const days = []
  for (const business of businesses) {
    for (const branch of business.implementations) {
      days.push(day(branch.created_at), ...branch.stages.map(stage_day))
    }
  }
  const recorded_days = days.filter(Number.isFinite)
  const first = recorded_days.length ? Math.min(...recorded_days) : day(new Date().toISOString())
  const span = Math.max(6, recorded_days.length ? Math.max(...recorded_days) - first : 0)
  const width = Math.min(880, Math.max(500, span * 24))
  const padding = 56
  const x = (point) => padding + (point - first) * (width - padding * 2) / span
  const multiple_years = new Date(first * DAY_MS).getUTCFullYear() !== new Date((first + span) * DAY_MS).getUTCFullYear()
  const ticks = Array.from({ length: 5 }, (_, index) => {
    const point = first + Math.round(index * span / 4)
    const date = point * DAY_MS
    const parts = Object.fromEntries(tick_format.formatToParts(date).map(({ type, value }) => [type, value]))
    const label = parts.day + ' ' + parts.month + (multiple_years ? ' ' + parts.year : '')
    return { day: point, x: x(point), label, full_label: full_tick_format.format(date) }
  })
  return { width, x, ticks }
}

function make_branch(branch, axis) {
  const kind = TYPES[branch.type]
  const created_day = day(branch.created_at)
  const stages = branch.stages.map((stage) => ({
    ...stage,
    state: state_for(stage),
    day: stage_day(stage),
    icon: 'bi-' + (kind.stages[stage.number - 1] || 'circle'),
  }))
  const lanes = []
  const dated = stages.filter((stage) => Number.isFinite(stage.day)).sort((left, right) => left.day - right.day)
  for (const stage of dated) {
    stage.x = axis.x(stage.day)
    // Los hitos del mismo día mantienen la misma X y se apilan para que todos puedan abrirse.
    const available_lane = lanes.findIndex((last_x) => stage.x - last_x >= 98)
    const lane = available_lane === -1 ? lanes.length : available_lane
    lanes[lane] = stage.x
    stage.offset = lane * 78
  }
  const created_x = created_day === null ? null : axis.x(created_day)
  return {
    ...branch,
    dated,
    offset_stages: dated.filter((stage) => stage.offset > 0),
    undated: stages.filter((stage) => !Number.isFinite(stage.day)),
    height: 90 + 78 * Math.max(0, lanes.length - 1),
    start: created_x,
    line_start: created_x === null ? dated[0]?.x ?? null : Math.min(created_x, dated[0]?.x ?? created_x),
    completed_count: stages.filter((stage) => stage.state === 'completed').length,
    required_count: stages.filter((stage) => stage.state !== 'skipped').length,
  }
}

function search_key(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function normalize_businesses(businesses) {
  return businesses.map((business) => {
    const implementations = business.implementations.filter((branch) => Object.hasOwn(TYPES, branch.type))
    const newest = Math.max(0, ...implementations.map((branch) => timestamp(branch.created_at) ?? 0))
    implementations.sort((left, right) => TYPE_ORDER.indexOf(left.type) - TYPE_ORDER.indexOf(right.type))
    return { ...business, implementations, newest }
  })
    .filter((business) => business.implementations.length)
    .sort((left, right) => right.newest - left.newest)
}

export default {
  name: 'ImplementationTimeline',
  data() {
    return {
      types: TYPES,
      states: STATES,
      branch_states: BRANCH_STATES,
      businesses: [],
      invalid_logos: {},
      search: '',
      loading: true,
      error: false,
      detail: null,
    }
  },
  computed: {
    axis() {
      return make_axis(this.businesses)
    },
    visible_businesses() {
      const query = search_key(this.search)
      return this.businesses
        .filter((business) => search_key(business.name).includes(query))
        .map((business) => ({
          ...business,
          branches: business.implementations.map((branch) => make_branch(branch, this.axis)),
        }))
    },
    undated_width() {
      let count = 0
      for (const business of this.visible_businesses) {
        for (const branch of business.branches) count = Math.max(count, branch.undated.length)
      }
      return count ? 22 + count * 98 : 0
    },
    evidence() {
      const stage = this.detail.stage
      return [
        {
          key: 'sent', label: 'Información enviada',
          at: stage.sent_at, source: stage.sent_source, ticket: stage.sent_ticket_id,
          empty: stage.sent_at ? 'Sin ticket vinculado' : 'Sin envío registrado',
        },
        {
          key: 'completed', label: 'Finalización',
          at: stage.completed_at, source: stage.completed_source, ticket: stage.completed_ticket_id,
          empty: stage.state === 'completed' ? 'Origen sin registrar' : 'Sin finalización registrada',
        },
      ]
    },
  },
  watch: {
    search() {
      this.$nextTick(() => this.scroll_to(false))
    },
  },
  mounted() {
    this.load()
  },
  methods: {
    async load() {
      this.loading = true
      this.error = false
      try {
        const { data } = await api.get('/implementation-timeline')
        if (!Array.isArray(data.data)) throw new Error('Respuesta de implementaciones inválida')
        this.invalid_logos = {}
        this.businesses = normalize_businesses(data.data)
      } catch {
        this.error = true
      } finally {
        this.loading = false
        this.$nextTick(() => this.scroll_to(false))
      }
    },
    initials(name) {
      return name.trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase()
    },
    scroll_to(undated) {
      const timeline = this.$refs.timeline_scroll
      if (!timeline) return
      if (undated) {
        timeline.scrollLeft = this.axis.width
        return
      }
      const first_business = this.visible_businesses[0]
      const sticky_width = timeline.querySelector('.timeline-sticky').offsetWidth
      const recorded_positions = first_business.branches.flatMap((branch) => [branch.start, ...branch.dated.map((stage) => stage.x)])
      const recent_x = Math.max(0, ...recorded_positions.filter(Number.isFinite))
      const visible_dates_width = timeline.clientWidth - sticky_width
      // Deja a la vista los hitos del negocio más reciente al abrir en una pantalla angosta.
      timeline.scrollLeft = recent_x > visible_dates_width - 56 ? recent_x - visible_dates_width * 0.68 : 0
    },
    format_date(value) {
      const date = timestamp(value)
      return date === null ? '' : detail_format.format(date)
    },
    show_stage(business, branch, stage) {
      this.detail = { business: business.name, branch: TYPES[branch.type].label, stage }
      this.$nextTick(() => this.$refs.stage_dialog?.showModal())
    },
  },
}
</script>

<style scoped>
.timeline-page {
  --ink: #17243a;
  --muted: #52647c;
  --border: #dce5ef;
  --side-width: 206px;
  color: var(--ink);
  padding: clamp(14px, 2.3vw, 34px);
}
.timeline-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: end;
  gap: 18px;
  margin-bottom: 24px;
  padding: clamp(16px, 2.2vw, 30px);
  border: 1px solid var(--border);
  border-radius: 18px;
  background: linear-gradient(112deg, #edf5ff, #f7fafe 68%, #fff8ed);
}
.timeline-eyebrow {
  margin: 0 0 7px;
  color: #3a5679;
  font-size: 0.76rem;
  font-weight: 700;
}
.timeline-header h1 {
  margin: 0 0 7px;
  font-size: clamp(1.6rem, 3vw, 2.25rem);
  letter-spacing: -0.035em;
}
.timeline-intro { margin: 0; color: var(--muted); }
.timeline-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.timeline-actions a { background: #fff; color: #344963; border-color: #bdcddd; }
.timeline-actions a:hover { background: #eaf2fa; color: var(--ink); }
.timeline-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.timeline-search { position: relative; width: min(100%, 290px); }
.timeline-search i { position: absolute; left: 12px; top: 8px; color: var(--muted); }
.timeline-search input { padding-left: 36px; border-color: var(--border); }
.timeline-legend { display: flex; flex-wrap: wrap; gap: 7px 16px; }
.timeline-jumps { display: flex; flex-wrap: wrap; gap: 8px; }
.timeline-jumps button { padding: 0; text-decoration: none; }
.timeline-legend span, .stage-dialog-state { display: inline-flex; align-items: center; gap: 7px; font-size: 0.84rem; }
.legend-dot {
  width: 11px;
  height: 11px;
  flex: 0 0 11px;
  border: 2px solid var(--stage-color, #73839a);
  border-radius: 50%;
  background: var(--stage-bg, #f2f5f9);
}
.timeline-hint { margin: 10px 0; color: var(--muted); font-size: 0.78rem; }
.timeline-empty { padding: 36px 18px; text-align: center; color: var(--muted); border: 1px dashed var(--border); border-radius: 14px; }
.timeline-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: white;
  scrollbar-color: #95acc7 #edf3f9;
}
.timeline-grid {
  display: grid;
  grid-template-columns: var(--side-width) var(--dates-width) var(--undated-width);
  width: max-content;
  min-width: 100%;
}
.timeline-sticky {
  position: sticky;
  left: 0;
  z-index: 3;
  border-right: 1px solid var(--border);
}
.timeline-axis {
  min-height: 40px;
  background: #eff5fb;
  color: #455b76;
  font-size: 0.75rem;
  font-weight: 700;
}
.timeline-axis .timeline-sticky, .undated-heading { padding: 12px 16px; background: #eff5fb; }
.timeline-dates { position: relative; }
.timeline-tick {
  position: absolute;
  top: 12px;
  transform: translateX(-50%);
  white-space: nowrap;
}
.timeline-business + .timeline-business { border-top: 1px solid var(--border); }
.timeline-business-heading { background: #f6f8fc; }
.business-identity {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 13px;
  background: #f6f8fc;
}
.business-identity img, .business-avatar {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 9px;
  border: 1px solid #d3e0ee;
  background: #e9f2ff;
  object-fit: contain;
}
.business-avatar { display: grid; place-items: center; color: #31577f; font-size: 0.8rem; font-weight: 750; }
.business-identity h2 { margin: 0; font-size: 0.9rem; font-weight: 750; overflow-wrap: anywhere; }
.timeline-branch { min-height: var(--track-height); }
.branch--sistema { --branch-color: #379cc7; --branch-bg: #e8f6fc; --branch-ink: #1b5f81; }
.branch--tienda { --branch-color: #d2a11c; --branch-bg: #fff6d8; --branch-ink: #735600; }
.branch--agentes { --branch-color: #dc743b; --branch-bg: #fff0e5; --branch-ink: #914819; }
.branch-name {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 12px 13px 10px 23px;
  background: #fff;
}
.branch-name::before {
  position: absolute;
  content: '';
  top: 0;
  bottom: 0;
  left: 13px;
  border-left: 2px solid #cbd8e8;
}
.branch-name::after {
  position: absolute;
  content: '';
  top: 0;
  left: 13px;
  width: 12px;
  height: 28px;
  border: solid var(--branch-color);
  border-width: 0 0 2px 2px;
  border-bottom-left-radius: 9px;
}
.timeline-branch:last-child .branch-name::before { height: 28px; bottom: auto; }
.branch-name > i {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  flex: 0 0 29px;
  border-radius: 8px;
  background: var(--branch-bg);
  color: var(--branch-ink);
}
.branch-name strong, .branch-name small { display: block; }
.branch-name strong { color: var(--branch-ink); font-size: 0.82rem; }
.branch-name small { color: var(--muted); font-size: 0.72rem; }
.branch-name .branch-state { font-weight: 700; }
.branch-gridline { position: absolute; top: 0; bottom: 0; border-left: 1px solid #eaf0f7; }
.branch-line { position: absolute; top: 28px; right: 0; border-top: 2px solid var(--branch-color); }
.branch-connector { position: absolute; top: 28px; border-left: 2px solid var(--branch-color); }
.branch-start {
  position: absolute;
  top: 25px;
  z-index: 1;
  width: 8px;
  height: 8px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: var(--branch-color);
}
.branch-undated {
  position: relative;
  display: flex;
  align-items: flex-start;
  padding: 12px 11px 8px;
  background: #f8fafc;
  border-left: 1px dashed #adbed2;
}
.branch-undated:has(.stage-button)::before {
  position: absolute;
  top: 28px;
  left: 0;
  right: 0;
  border-top: 2px dashed var(--branch-color);
  content: '';
}
.stage-button {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 4px;
  width: 98px;
  flex: 0 0 98px;
  padding: 0 3px;
  border: 0;
  background: none;
  color: var(--ink);
}
.stage-button:focus-visible, .timeline-scroll:focus-visible { outline: 2px solid #2262bc; outline-offset: -2px; }
.dated-stage { position: absolute; top: calc(12px + var(--stage-offset)); transform: translateX(-50%); }
.stage--pending, .stage--skipped { --stage-color: #73839a; --stage-bg: #f2f5f9; --stage-ink: #46566c; }
.stage--sent { --stage-color: #2269c7; --stage-bg: #eaf3ff; --stage-ink: #164e99; }
.stage--completed { --stage-color: #248358; --stage-bg: #e6f6ed; --stage-ink: #186340; }
.stage--skipped .stage-marker { border-style: dashed; }
.stage-marker {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 2px solid var(--stage-color);
  border-radius: 50%;
  background: var(--stage-bg);
  color: var(--stage-ink);
  font-size: 0.94rem;
}
.stage-button:hover .stage-marker { box-shadow: 0 0 0 4px color-mix(in srgb, var(--stage-color) 23%, transparent); }
.stage-label {
  max-width: 92px;
  padding: 1px 3px;
  border-radius: 3px;
  background: #ffffffef;
  font-size: 0.71rem;
  font-weight: 650;
  line-height: 1.18;
  overflow-wrap: anywhere;
}
.branch-undated .stage-label { background: #f8fafc; }
.stage-dialog {
  width: min(480px, calc(100% - 24px));
  max-height: calc(100% - 24px);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 15px;
  color: var(--ink);
}
.stage-dialog::backdrop { background: #14254166; }
.stage-dialog-body { position: relative; padding: 24px; }
.stage-dialog-body .btn-close { position: absolute; top: 13px; right: 13px; }
.stage-dialog h2 { padding-right: 15px; font-size: 1.42rem; }
.stage-dialog-state { color: var(--stage-ink); font-weight: 650; }
.stage-evidence { margin: 4px 0 0; }
.stage-evidence dt { border-top: 1px solid var(--border); padding-top: 11px; font-size: 0.86rem; }
.stage-evidence dd { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 0.84rem; margin: 5px 0 12px; }
.stage-evidence dd:last-child { margin-bottom: 0; }
.evidence-missing { color: var(--muted); }
@media (max-width: 767px) {
  .timeline-page { --side-width: 126px; }
  .timeline-toolbar { gap: 10px; }
  .timeline-legend span, .timeline-jumps button { font-size: 0.76rem; }
  .timeline-hint { line-height: 1.3; }
  .business-identity { padding-inline: 8px; gap: 6px; }
  .business-identity img, .business-avatar { width: 28px; height: 28px; flex-basis: 28px; }
  .business-identity h2 { font-size: 0.77rem; }
  .branch-name { gap: 5px; padding-inline: 15px 4px; }
  .branch-name::before, .branch-name::after { left: 6px; }
  .branch-name > i { width: 23px; height: 23px; flex-basis: 23px; }
  .branch-name strong { font-size: 0.73rem; }
  .branch-name small { font-size: 0.66rem; }
}
</style>
