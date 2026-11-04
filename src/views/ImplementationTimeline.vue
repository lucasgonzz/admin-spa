<template>
  <section class="timeline-page" aria-labelledby="timeline-title">
    <h1 id="timeline-title" class="visually-hidden">Implementaciones</h1>

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
        <div class="timeline-scale btn-group btn-group-sm" role="group" aria-label="Escala de fechas">
          <button type="button" class="btn btn-outline-secondary" :aria-pressed="scale === 'activity'" @click="scale = 'activity'">Solo días con actividad</button>
          <button type="button" class="btn btn-outline-secondary" :aria-pressed="scale === 'daily'" @click="scale = 'daily'">Todos los días</button>
        </div>
      </div>
      <p class="timeline-hint">
        {{ visible_businesses.length }} {{ visible_businesses.length === 1 ? 'negocio' : 'negocios' }} · Más recientes arriba
        <span v-if="visible_businesses.length"> · Deslizá hacia los costados para recorrer la línea de tiempo</span>
      </p>

      <p v-if="!visible_businesses.length" class="timeline-empty">No hay negocios que coincidan con la búsqueda.</p>
      <div
        v-else
        :ref="observe_timeline"
        class="timeline-scroll"
        role="region"
        aria-label="Línea de tiempo por negocio"
        tabindex="0"
        :style="{ '--dates-width': axis.width + 'px', '--day-width': day_width + 'px', '--undated-width': undated_width + 'px' }"
        @scroll.passive="update_scroll"
      >
        <div class="timeline-grid timeline-axis">
          <div class="timeline-sticky">Negocio</div>
          <div class="timeline-dates">
            <span v-for="tick in visible_ticks" :key="tick.day" class="timeline-tick" :style="{ left: tick.x + 'px' }" :title="tick.full_label">
              {{ tick.label }}
            </span>
          </div>
          <div v-if="undated_width" class="undated-heading">Sin fecha registrada</div>
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
              <span v-if="branch.start !== null" class="branch-start" :style="{ left: branch.start + 'px' }" :title="'Inicio: ' + format_date(branch.created_at)" aria-hidden="true"></span>
              <span v-if="branch.line_start !== null" class="branch-line" aria-hidden="true" :style="{ left: branch.line_start + 'px', width: (branch.line_end - branch.line_start) + 'px' }"></span>
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
                :aria-describedby="tooltip?.stage.key === stage.key ? 'implementation-stage-tooltip' : undefined"
                @pointerenter="open_stage_tooltip($event, stage)"
                @pointerleave="leave_stage_tooltip"
                @focus="open_stage_tooltip($event, stage)"
                @blur="leave_stage_tooltip"
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
                :aria-describedby="tooltip?.stage.key === stage.key ? 'implementation-stage-tooltip' : undefined"
                @pointerenter="open_stage_tooltip($event, stage)"
                @pointerleave="leave_stage_tooltip"
                @focus="open_stage_tooltip($event, stage)"
                @blur="leave_stage_tooltip"
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

    <Teleport to="body">
      <div
        v-if="tooltip"
        id="implementation-stage-tooltip"
        ref="stage_tooltip"
        class="stage-tooltip"
        role="tooltip"
        :style="tooltip_position"
        @pointerenter="cancel_tooltip_close"
        @pointerleave="leave_stage_tooltip"
      >
        <strong>{{ tooltip.stage.name }}</strong>
        <dl v-if="tooltip_dates.length">
          <template v-for="entry in tooltip_dates" :key="entry.key">
            <dt>{{ entry.label }}</dt>
            <dd>{{ format_date(entry.at) }}</dd>
          </template>
        </dl>
        <span v-else>Sin fecha registrada</span>
      </div>
    </Teleport>

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
              <span v-if="entry.empty && !entry.ticket && !entry.source" class="evidence-missing">{{ entry.empty }}</span>
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
const STAGE_DATES = [
  { key: 'started', label: 'Inicio', field: 'started_at' },
  { key: 'sent', label: 'Información enviada', field: 'sent_at' },
  { key: 'completed', label: 'Finalización', field: 'completed_at' },
]
const DAY_MS = 86400000
const DAY_WIDTH = 118
const STAGE_HEIGHT = 90
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

function stage_dates(stage) {
  return STAGE_DATES.map((entry) => ({ ...entry, at: stage[entry.field] }))
}

function make_axis(days, scale) {
  const first = days[0]
  const last = days[days.length - 1]
  const daily = scale === 'daily'
  const count = days.length && daily ? last - first + 1 : days.length
  const day_indexes = new Map(days.map((date, index) => [date, index]))
  const index_for = (date) => daily ? date - first : day_indexes.get(date)
  return {
    count,
    width: count * DAY_WIDTH,
    multiple_years: new Date(first * DAY_MS).getUTCFullYear() !== new Date(last * DAY_MS).getUTCFullYear(),
    day_at: (index) => daily ? first + index : days[index],
    x: (date) => (index_for(date) + 0.5) * DAY_WIDTH,
    closest_index: (date) => {
      if (!Number.isFinite(date) || count === 0) return 0
      if (daily) return Math.min(count - 1, Math.max(0, index_for(date)))
      const next = days.findIndex((day) => day >= date)
      return next === -1 ? count - 1 : next
    },
  }
}

function make_branch(branch, axis) {
  const lanes = new Map()
  const dated = branch.stages.filter((stage) => stage.day !== null).sort((left, right) => left.day - right.day).map((stage) => {
    // Los hitos del mismo día mantienen la misma X. Se apilan sin representar el orden horario.
    const lane = lanes.get(stage.day) ?? 0
    lanes.set(stage.day, lane + 1)
    return { ...stage, x: axis.x(stage.day), offset: lane * STAGE_HEIGHT }
  })
  const created_x = branch.created_day === null ? null : axis.x(branch.created_day)
  return {
    ...branch,
    dated,
    offset_stages: dated.filter((stage) => stage.offset > 0),
    undated: branch.stages.filter((stage) => stage.day === null),
    height: STAGE_HEIGHT * Math.max(1, ...lanes.values()),
    start: created_x,
    line_start: branch.activity_days.length ? axis.x(branch.activity_days[0]) : null,
    line_end: branch.activity_days.length ? axis.x(branch.activity_days[branch.activity_days.length - 1]) : null,
    completed_count: branch.stages.filter((stage) => stage.state === 'completed').length,
    required_count: branch.stages.filter((stage) => stage.state !== 'skipped').length,
  }
}

function search_key(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function normalize_businesses(businesses) {
  return businesses.map((business) => {
    const implementations = business.implementations.filter((branch) => Object.hasOwn(TYPES, branch.type)).map((branch) => {
      const kind = TYPES[branch.type]
      const created_day = day(branch.created_at)
      const activity_days = new Set()
      if (created_day !== null) activity_days.add(created_day)
      const stages = branch.stages.map((stage) => {
        const dates = stage_dates(stage).map((entry) => day(entry.at)).filter(Number.isFinite)
        dates.forEach((date) => activity_days.add(date))
        return {
          ...stage,
          key: branch.type + '-' + branch.id + '-' + stage.number,
          state: state_for(stage),
          day: dates[dates.length - 1] ?? null,
          icon: 'bi-' + (kind.stages[stage.number - 1] || 'circle'),
        }
      })
      return { ...branch, created_day, activity_days: [...activity_days].sort((left, right) => left - right), stages }
    })
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
      day_width: DAY_WIDTH,
      businesses: [],
      invalid_logos: {},
      search: '',
      scale: 'activity',
      loading: true,
      error: false,
      detail: null,
      timeline: null,
      timeline_observer: null,
      scroll_left: 0,
      viewport_width: 0,
      tooltip: null,
      tooltip_position: { visibility: 'hidden' },
      tooltip_timer: null,
    }
  },
  computed: {
    activity_days() {
      const days = new Set()
      for (const business of this.businesses) {
        for (const branch of business.implementations) branch.activity_days.forEach((day) => days.add(day))
      }
      return [...days].sort((left, right) => left - right)
    },
    axis() {
      return make_axis(this.activity_days, this.scale)
    },
    visible_ticks() {
      // El eje completo conserva su ancho. Solo se dibujan rótulos alrededor del área visible.
      const start = Math.min(this.axis.count, Math.max(0, Math.floor(this.scroll_left / DAY_WIDTH) - 2))
      const end = Math.min(this.axis.count, Math.ceil((this.scroll_left + this.viewport_width) / DAY_WIDTH) + 3)
      const ticks = []
      for (let index = start; index < end; index++) {
        const day = this.axis.day_at(index)
        const date = day * DAY_MS
        const parts = Object.fromEntries(tick_format.formatToParts(date).map(({ type, value }) => [type, value]))
        const label = parts.day + ' ' + parts.month + (this.axis.multiple_years ? ' ' + parts.year : '')
        ticks.push({ day, x: this.axis.x(day), label, full_label: full_tick_format.format(date) })
      }
      return ticks
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
      return count ? 22 + count * DAY_WIDTH : 0
    },
    tooltip_dates() {
      return this.tooltip ? stage_dates(this.tooltip.stage).filter((entry) => timestamp(entry.at) !== null) : []
    },
    evidence() {
      const stage = this.detail.stage
      return [
        { key: 'started', label: 'Inicio', at: stage.started_at },
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
      ].filter((entry) => entry.key !== 'started' || timestamp(entry.at) !== null)
    },
  },
  watch: {
    search() {
      this.hide_stage_tooltip()
      this.$nextTick(this.focus_latest_business)
    },
    scale(value, previous) {
      const old_axis = make_axis(this.activity_days, previous)
      const first_day = old_axis.day_at(Math.min(old_axis.count - 1, Math.floor(this.scroll_left / DAY_WIDTH)))
      this.hide_stage_tooltip()
      this.$nextTick(() => {
        if (!this.timeline) return
        this.timeline.scrollLeft = this.axis.closest_index(first_day) * DAY_WIDTH
        this.update_scroll()
      })
    },
  },
  mounted() {
    this.load()
    window.addEventListener('keydown', this.dismiss_tooltip)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.dismiss_tooltip)
    this.timeline_observer?.disconnect()
    this.cancel_tooltip_close()
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
        this.$nextTick(this.focus_latest_business)
      }
    },
    initials(name) {
      return name.trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase()
    },
    observe_timeline(timeline) {
      if (timeline === this.timeline) return
      this.timeline_observer?.disconnect()
      this.timeline = timeline
      if (!timeline) return
      this.timeline_observer = new ResizeObserver(this.update_scroll)
      this.timeline_observer.observe(timeline)
      this.update_scroll()
    },
    update_scroll() {
      if (!this.timeline) return
      this.scroll_left = this.timeline.scrollLeft
      this.viewport_width = this.timeline.clientWidth
      this.position_stage_tooltip()
    },
    focus_latest_business() {
      const timeline = this.timeline
      const first_business = this.visible_businesses[0]
      if (!timeline || !first_business) return
      const sticky_width = timeline.querySelector('.timeline-sticky').offsetWidth
      const recorded_positions = first_business.branches.map((branch) => branch.line_end)
      const recent_x = Math.max(0, ...recorded_positions.filter(Number.isFinite))
      const visible_dates_width = timeline.clientWidth - sticky_width
      timeline.scrollLeft = recent_x > visible_dates_width - DAY_WIDTH / 2 ? recent_x - visible_dates_width * 0.68 : 0
      timeline.scrollTop = 0
      this.update_scroll()
    },
    format_date(value) {
      const date = timestamp(value)
      return date === null ? '' : detail_format.format(date)
    },
    show_stage(business, branch, stage) {
      this.hide_stage_tooltip()
      this.detail = { business: business.name, branch: TYPES[branch.type].label, stage }
      this.$nextTick(() => this.$refs.stage_dialog?.showModal())
    },
    open_stage_tooltip(event, stage) {
      const anchor = event.currentTarget
      if (this.detail || event.pointerType === 'touch' || (event.type === 'focus' && !anchor.matches(':focus-visible'))) return
      this.cancel_tooltip_close()
      this.tooltip = { anchor, stage }
      this.$nextTick(this.position_stage_tooltip)
    },
    leave_stage_tooltip(event) {
      const anchor = this.tooltip?.anchor
      if (!anchor || anchor.matches(':focus-visible') || (event.type === 'blur' && anchor.matches(':hover'))) return
      this.cancel_tooltip_close()
      this.tooltip_timer = setTimeout(this.hide_stage_tooltip, 140)
    },
    cancel_tooltip_close() {
      clearTimeout(this.tooltip_timer)
    },
    hide_stage_tooltip() {
      this.cancel_tooltip_close()
      this.tooltip = null
      this.tooltip_position = { visibility: 'hidden' }
    },
    dismiss_tooltip(event) {
      if (event.key === 'Escape' && this.tooltip) this.hide_stage_tooltip()
    },
    position_stage_tooltip() {
      const element = this.$refs.stage_tooltip
      if (!this.tooltip || !element || !this.timeline) return
      const anchor = this.tooltip.anchor.getBoundingClientRect()
      const timeline = this.timeline.getBoundingClientRect()
      const sticky = this.timeline.querySelector('.timeline-axis .timeline-sticky').getBoundingClientRect()
      const center = (anchor.left + anchor.right) / 2
      if (center < sticky.right || center > timeline.right || anchor.bottom < sticky.bottom || anchor.top > timeline.bottom) {
        this.hide_stage_tooltip()
        return
      }
      const margin = 8
      const left = Math.max(margin, Math.min(center - element.offsetWidth / 2, window.innerWidth - element.offsetWidth - margin))
      const above = anchor.top - element.offsetHeight - margin
      const top = above >= margin ? above : Math.min(anchor.bottom + margin, window.innerHeight - element.offsetHeight - margin)
      this.tooltip_position = { left: left + 'px', top: top + 'px' }
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
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--ink);
}
.timeline-eyebrow {
  margin: 0 0 7px;
  color: #3a5679;
  font-size: 0.76rem;
  font-weight: 700;
}
.timeline-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.timeline-search { position: relative; width: min(100%, 290px); }
.timeline-search i { position: absolute; left: 12px; top: 8px; color: var(--muted); }
.timeline-search input { padding-left: 36px; border-color: var(--border); }
.timeline-legend { display: flex; flex-wrap: wrap; gap: 7px 16px; }
.timeline-scale button { background: #fff; color: #344963; border-color: #afc2d7; }
.timeline-scale button:hover { background: #f0f5fb; color: #263e5e; }
.timeline-scale button[aria-pressed='true'] { background: #e3eefc; color: #163d70; font-weight: 700; }
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
  flex: 1;
  min-height: 0;
  overflow: auto;
  scroll-padding-top: 42px;
  scroll-padding-left: var(--side-width);
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
  position: sticky;
  top: 0;
  z-index: 4;
  min-height: 40px;
  background: #eff5fb;
  color: #455b76;
  font-size: 0.75rem;
  font-weight: 700;
}
.timeline-axis .timeline-sticky, .undated-heading { padding: 12px 16px; background: #eff5fb; }
.timeline-dates {
  position: relative;
  background-image: repeating-linear-gradient(to right, transparent 0 calc(var(--day-width) - 1px), #dce7f2 calc(var(--day-width) - 1px) var(--day-width));
}
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
.branch-line { position: absolute; top: 28px; border-top: 2px solid var(--branch-color); }
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
  width: calc(var(--day-width) - 12px);
  flex: 0 0 var(--day-width);
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
  display: -webkit-box;
  max-width: 100%;
  padding: 1px 3px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  border-radius: 3px;
  background: #ffffffef;
  font-size: 0.71rem;
  font-weight: 650;
  line-height: 1.18;
  overflow-wrap: anywhere;
}
.branch-undated .stage-label { background: #f8fafc; }
.stage-tooltip {
  position: fixed;
  z-index: 1050;
  max-width: min(320px, calc(100vw - 16px));
  padding: 9px 12px;
  border: 1px solid #38506b;
  border-radius: 9px;
  background: #17243a;
  color: #fff;
  box-shadow: 0 4px 14px #17243a33;
  font-size: 0.78rem;
}
.stage-tooltip strong { display: block; margin-bottom: 3px; }
.stage-tooltip dl { display: grid; grid-template-columns: auto auto; gap: 2px 8px; margin: 0; }
.stage-tooltip dt { font-weight: 600; }
.stage-tooltip dd { margin: 0; }
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
  .timeline-legend span, .timeline-scale button { font-size: 0.76rem; }
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
