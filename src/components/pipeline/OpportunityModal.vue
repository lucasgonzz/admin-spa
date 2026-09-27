<template>
  <!--
    Ficha de una oportunidad (GET pipeline-opportunities/{id}).

    Arriba el sujeto con su contacto: teléfono, mail y un link a WhatsApp que SOLO abre la app
    (https://wa.me/<dígitos>): el sistema no manda ningún mensaje. Después dónde está (pipeline,
    etapa, días), responsable y próxima acción editables, una nota nueva (con canal y fecha
    opcional) y el historial completo, de lo más nuevo a lo más viejo.

    Se abre desde el tablero, el listado, la agenda y la pestaña "Pipelines" del cliente/lead (en
    ese caso encima del modal del cliente, con `stack_level` 1). Cada vez que cambia la
    oportunidad se re-inicializa todo: no queda nada de la anterior.
  -->
  <base-modal
    :show="show"
    :title="modal_title"
    size="lg"
    :stack_level="stack_level"
    @close="$emit('close')"
  >
    <div v-if="loading && !opportunity" class="text-center py-5" role="status" aria-live="polite">
      <span class="spinner-border text-primary" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando oportunidad…</p>
    </div>

    <div v-else-if="load_error" class="alert alert-danger mb-0">{{ load_error }}</div>

    <div v-else-if="opportunity" class="pl-ficha">
      <!-- Sujeto y contacto -->
      <section class="pl-ficha__block">
        <div class="pl-ficha__subject">
          <div class="pl-ficha__subject-names">
            <p class="pl-ficha__name mb-0">{{ subject.name || '(sin nombre)' }}</p>
            <p v-if="subject.secondary" class="pl-ficha__secondary mb-0">{{ subject.secondary }}</p>
          </div>
          <div class="pl-ficha__tags">
            <subject-type-badge :type="opportunity.subject_type" />
            <span v-if="opportunity.subject_type === 'client' && subject.is_active === false" class="pl-ficha__tag">Inactivo</span>
            <span v-if="subject.status_label" class="pl-ficha__tag">{{ subject.status_label }}</span>
          </div>
        </div>
        <p v-if="subject.missing" class="small text-danger mt-2 mb-0">
          El {{ opportunity.subject_type === 'lead' ? 'lead' : 'cliente' }} ya no existe: la oportunidad quedó como historia.
        </p>
        <div class="pl-ficha__contact">
          <a v-if="phone_link" :href="phone_link" class="pl-ficha__contact-item">
            <i class="bi bi-telephone" aria-hidden="true" />{{ subject.phone }}
          </a>
          <a
            v-if="wa_link"
            :href="wa_link"
            target="_blank"
            rel="noopener noreferrer"
            class="pl-ficha__contact-item pl-ficha__contact-item--wa"
            title="Abre WhatsApp con este número. El sistema no manda nada."
          >
            <i class="bi bi-whatsapp" aria-hidden="true" />Abrir WhatsApp
          </a>
          <a v-if="subject.email" :href="'mailto:' + subject.email" class="pl-ficha__contact-item">
            <i class="bi bi-envelope" aria-hidden="true" />{{ subject.email }}
          </a>
          <span v-if="!subject.phone && !subject.email && !subject.missing" class="text-muted small">
            Sin teléfono ni mail cargados.
          </span>
        </div>
      </section>

      <!-- Dónde está -->
      <section class="pl-ficha__block">
        <dl class="pl-ficha__facts">
          <div class="pl-ficha__fact">
            <dt>Pipeline</dt>
            <dd>{{ pipeline_name }}</dd>
          </div>
          <div class="pl-ficha__fact">
            <dt>Etapa</dt>
            <dd class="pl-ficha__stage">
              <stage-tag :stage="opportunity.stage" show_type />
              <span class="text-muted small">{{ days_text }}</span>
            </dd>
          </div>
          <div v-if="is_closed" class="pl-ficha__fact">
            <dt>Cerrada</dt>
            <dd>
              {{ format_datetime(opportunity.closed_at) || '—' }}
              <template v-if="opportunity.lost_reason"> · {{ opportunity.lost_reason }}</template>
            </dd>
          </div>
          <div class="pl-ficha__fact">
            <dt>Alta</dt>
            <dd>{{ format_datetime(opportunity.created_at) || '—' }}</dd>
          </div>
        </dl>
      </section>

      <!-- Responsable y próxima acción -->
      <section class="pl-ficha__block pl-ficha__grid">
        <div>
          <label class="form-label mb-1" for="pl-ficha-owner">Responsable</label>
          <select
            id="pl-ficha-owner"
            :key="'owner-' + owner_select_key"
            class="form-select"
            :value="owner_value"
            :disabled="saving_owner"
            @change="change_owner($event.target.value)"
          >
            <option value="">Sin responsable</option>
            <option v-for="admin in owner_options" :key="admin.id" :value="String(admin.id)">{{ admin.name }}</option>
          </select>
        </div>

        <div>
          <p class="form-label mb-1">Próxima acción</p>
          <p v-if="is_closed" class="text-muted small mb-0">Está cerrada: no lleva próxima acción.</p>

          <div v-else-if="!editing_next" class="pl-ficha__next">
            <next-action-text :opportunity="opportunity" />
            <button type="button" class="btn btn-link btn-sm p-0" @click="start_edit_next">
              {{ opportunity.next_action_at ? 'Cambiar' : 'Agregar' }}
            </button>
          </div>

          <div v-else class="pl-ficha__next-edit">
            <div class="pl-ficha__next-inputs">
              <input
                v-model="next_form.date"
                type="date"
                class="form-control form-control-sm"
                :class="{ 'is-invalid': !!next_error('next_action_at') }"
                aria-label="Fecha de la próxima acción"
              />
              <input
                v-model="next_form.time"
                type="time"
                class="form-control form-control-sm"
                aria-label="Hora (opcional)"
                title="Hora (opcional)"
              />
            </div>
            <input
              v-model="next_form.note"
              type="text"
              class="form-control form-control-sm mt-2"
              :class="{ 'is-invalid': !!next_error('next_action_note') }"
              placeholder="Qué hay que hacer"
              aria-label="Nota de la próxima acción"
            />
            <div v-if="next_error('next_action_at')" class="invalid-feedback d-block">{{ next_error('next_action_at') }}</div>
            <div v-if="next_error('next_action_note')" class="invalid-feedback d-block">{{ next_error('next_action_note') }}</div>
            <div class="d-flex flex-wrap gap-2 mt-2">
              <button type="button" class="btn btn-primary btn-sm" :disabled="saving_next" @click="save_next(false)">
                {{ saving_next ? 'Guardando…' : 'Guardar' }}
              </button>
              <button
                v-if="opportunity.next_action_at"
                type="button"
                class="btn btn-outline-secondary btn-sm"
                :disabled="saving_next"
                @click="save_next(true)"
              >
                Quitar
              </button>
              <button type="button" class="btn btn-link btn-sm" :disabled="saving_next" @click="editing_next = false">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Nota nueva -->
      <section class="pl-ficha__block">
        <label class="form-label mb-1" for="pl-ficha-note">Agregar nota</label>
        <textarea
          id="pl-ficha-note"
          v-model="note_form.body"
          rows="2"
          class="form-control"
          :class="{ 'is-invalid': !!note_error('body') }"
          placeholder="Qué se habló, qué quedó pendiente…"
        />
        <div v-if="note_error('body')" class="invalid-feedback d-block">{{ note_error('body') }}</div>
        <div class="pl-ficha__note-options">
          <select
            v-model="note_form.channel"
            class="form-select form-select-sm"
            :class="{ 'is-invalid': !!note_error('channel') }"
            aria-label="Canal"
          >
            <option value="">Sin canal</option>
            <option v-for="channel in channels" :key="channel.value" :value="channel.value">{{ channel.label }}</option>
          </select>
          <input
            v-model="note_form.occurred_at"
            type="datetime-local"
            class="form-control form-control-sm"
            :class="{ 'is-invalid': !!note_error('occurred_at') }"
            aria-label="Cuándo pasó (vacío = ahora)"
            title="Cuándo pasó. Vacío = ahora."
          />
          <button type="button" class="btn btn-outline-primary btn-sm" :disabled="saving_note" @click="add_note">
            {{ saving_note ? 'Guardando…' : 'Agregar nota' }}
          </button>
        </div>
        <div v-if="note_error('channel')" class="invalid-feedback d-block">{{ note_error('channel') }}</div>
        <div v-if="note_error('occurred_at')" class="invalid-feedback d-block">{{ note_error('occurred_at') }}</div>
      </section>

      <!-- Historial -->
      <section class="pl-ficha__block pl-ficha__block--last">
        <h6 class="pl-ficha__heading">Historial</h6>
        <p v-if="!activities.length" class="text-muted small mb-0">Sin actividad todavía.</p>
        <ol v-else class="pl-timeline">
          <li v-for="activity in activities" :key="activity.id" class="pl-timeline__item">
            <span class="pl-timeline__icon" aria-hidden="true">
              <i class="bi" :class="activity_icon(activity)" />
            </span>
            <div class="pl-timeline__body">
              <div class="pl-timeline__head">
                <span class="pl-timeline__title">{{ activity_title(activity) }}</span>
                <button
                  v-if="activity.type === 'note'"
                  type="button"
                  class="btn btn-link btn-sm p-0 pl-timeline__delete"
                  title="Borrar esta nota"
                  aria-label="Borrar esta nota"
                  :disabled="deleting_activity_id === activity.id"
                  @click="delete_note(activity)"
                >
                  <i class="bi bi-trash" aria-hidden="true" />
                </button>
              </div>
              <p v-if="activity_change_text(activity)" class="pl-timeline__change mb-1">{{ activity_change_text(activity) }}</p>
              <p v-if="activity.body" class="pl-timeline__text mb-1">{{ activity.body }}</p>
              <dl v-if="activity_values(activity).length" class="pl-timeline__values mb-1">
                <div v-for="(item, index) in activity_values(activity)" :key="index" class="pl-timeline__value">
                  <dt>{{ item.label }}</dt>
                  <dd>{{ item.text }}</dd>
                </div>
              </dl>
              <p class="pl-timeline__meta mb-0">
                {{ activity.admin && activity.admin.name ? activity.admin.name : 'Sistema' }}
                · {{ format_datetime(activity.occurred_at) }}
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>

    <!-- Mover desde la ficha: se abre encima (el modal se teletransporta al body igual). -->
    <move-modal
      v-if="move.show && opportunity"
      :key="'ficha-move-' + move.key"
      :show="true"
      :opportunity="opportunity"
      :pipeline="opportunity.pipeline"
      :stack_level="stack_level + 1"
      @close="move.show = false"
      @moved="on_moved"
    />

    <template #footer>
      <div class="d-flex w-100 align-items-center flex-wrap gap-2">
        <button
          v-if="opportunity"
          type="button"
          class="btn btn-outline-danger"
          :disabled="deleting"
          @click="delete_opportunity"
        >
          {{ deleting ? 'Borrando…' : 'Borrar' }}
        </button>
        <div class="ms-auto d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">Cerrar</button>
          <button
            v-if="opportunity"
            type="button"
            class="btn btn-primary"
            :disabled="!opportunity.pipeline"
            @click="open_move"
          >
            <i class="bi bi-arrow-left-right me-1" aria-hidden="true" />Mover
          </button>
        </div>
      </div>
    </template>
  </base-modal>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import MoveModal from './MoveModal.vue'
import NextActionText from './NextActionText.vue'
import StageTag from './StageTag.vue'
import SubjectTypeBadge from './SubjectTypeBadge.vue'
import {
  first_error,
  format_field_value,
  show_toast,
  tel_url,
  validation_errors,
  whatsapp_url,
} from './pipeline_helpers'
import {
  build_next_action_value,
  datetime_local_to_api,
  format_datetime,
  split_for_inputs,
} from '@/utils/pipeline_dates'

/**
 * Íconos de las notas según el canal. Solo el ícono: la etiqueta sale del catálogo del back, y un
 * canal que no esté acá cae al ícono genérico.
 */
const CHANNEL_ICONS = {
  call: 'bi-telephone',
  whatsapp: 'bi-whatsapp',
  meeting: 'bi-camera-video',
  email: 'bi-envelope',
  in_person: 'bi-people',
  other: 'bi-chat-left-text',
}

/**
 * Ordena el historial de lo más nuevo a lo más viejo (una nota puede cargarse con fecha pasada).
 *
 * @param {Array<Object>} list
 * @returns {Array<Object>}
 */
function sort_activities(list) {
  return list.slice().sort(function (a, b) {
    const a_when = String(a.occurred_at || '')
    const b_when = String(b.occurred_at || '')
    if (a_when !== b_when) {
      return a_when < b_when ? 1 : -1
    }
    return Number(b.id) - Number(a.id)
  })
}

/**
 * Ficha de la oportunidad.
 */
export default {
  name: 'PipelineOpportunityModal',
  components: { BaseModal, MoveModal, NextActionText, StageTag, SubjectTypeBadge },
  props: {
    /** Visibilidad del modal. */
    show: { type: Boolean, default: true },
    /** Oportunidad a mostrar. */
    opportunity_id: { type: [Number, String], required: true },
    /** Nivel de apilamiento (1 cuando se abre encima del modal del cliente/lead). */
    stack_level: { type: Number, default: 0 },
  },
  emits: ['close', 'changed', 'deleted'],
  data() {
    return this.initial_state()
  },
  computed: {
    /** @returns {Object} */
    subject() {
      return (this.opportunity && this.opportunity.subject) || {}
    },
    /** @returns {string} */
    modal_title() {
      if (!this.opportunity) {
        return 'Oportunidad'
      }
      return this.subject.name || 'Oportunidad'
    },
    /** @returns {string} */
    pipeline_name() {
      const pipeline = this.opportunity && this.opportunity.pipeline
      if (!pipeline) {
        return '—'
      }
      return pipeline.archived_at ? pipeline.name + ' (archivado)' : pipeline.name
    },
    /** @returns {boolean} */
    is_closed() {
      const stage = this.opportunity && this.opportunity.stage
      return !!stage && stage.type !== 'open'
    },
    /** @returns {string} */
    days_text() {
      const days = Number(this.opportunity && this.opportunity.days_in_stage)
      if (isNaN(days)) {
        return ''
      }
      return '· ' + days + (days === 1 ? ' día' : ' días') + ' en la etapa'
    },
    /** @returns {string} */
    phone_link() {
      return tel_url(this.subject.phone)
    },
    /** @returns {string} */
    wa_link() {
      return whatsapp_url(this.subject.phone)
    },
    /** @returns {Array<Object>} */
    channels() {
      return this.$store.state.pipeline.meta.channels || []
    },
    /** @returns {Array<Object>} */
    admins() {
      return this.$store.state.pipeline.admins || []
    },
    /**
     * Operadores del selector. Si el responsable actual ya no está en la lista (un admin dado de
     * baja), se agrega igual para que el selector lo muestre en vez de quedar en blanco.
     * @returns {Array<Object>}
     */
    owner_options() {
      const list = this.admins.slice()
      const owner = this.opportunity && this.opportunity.owner
      if (owner && owner.id && !list.some(function (a) { return Number(a.id) === Number(owner.id) })) {
        list.push(owner)
      }
      return list
    },
    /** @returns {string} */
    owner_value() {
      const id = this.opportunity && this.opportunity.owner_admin_id
      return id === null || id === undefined ? '' : String(id)
    },
  },
  watch: {
    /** Otra oportunidad: todo de cero y se vuelve a cargar. */
    opportunity_id: function (new_id, old_id) {
      if (String(new_id) !== String(old_id)) {
        Object.assign(this.$data, this.initial_state())
        this.load(false)
      }
    },
  },
  created() {
    this.$store.dispatch('pipeline/fetch_meta')
    this.$store.dispatch('pipeline/fetch_admins')
    this.load(false)
  },
  methods: {
    format_datetime,

    /**
     * Estado inicial completo de la ficha (también se usa para limpiarla al cambiar de oportunidad).
     * @returns {Object}
     */
    initial_state() {
      return {
        /** Oportunidad cargada (con `pipeline` completo y el contacto del sujeto). */
        opportunity: null,
        /** Historial, de lo más nuevo a lo más viejo. */
        activities: [],
        loading: false,
        load_error: null,
        /** Cambio de responsable en curso. */
        saving_owner: false,
        /** Se incrementa para volver el selector al valor guardado si el PUT falla. */
        owner_select_key: 0,
        /** Edición de la próxima acción. */
        editing_next: false,
        next_form: { date: '', time: '', note: '' },
        next_errors: {},
        saving_next: false,
        /** Nota nueva. */
        note_form: { body: '', channel: '', occurred_at: '' },
        note_errors: {},
        saving_note: false,
        /** Nota que se está borrando. */
        deleting_activity_id: null,
        /** Borrado de la oportunidad. */
        deleting: false,
        /** Modal de mover abierto desde la ficha. */
        move: { show: false, key: 0 },
      }
    },

    /**
     * GET pipeline-opportunities/{id}. Con `silent` no muestra el spinner (recarga en segundo plano
     * después de borrar una nota) y avisa al padre con la versión nueva.
     *
     * @param {boolean} silent
     * @returns {Promise}
     */
    load(silent) {
      const self = this
      const id = this.opportunity_id
      if (!id) {
        return Promise.resolve()
      }
      if (!silent) {
        this.loading = true
        this.load_error = null
      }
      return api
        .get('/pipeline-opportunities/' + id)
        .then(function (res) {
          if (String(id) !== String(self.opportunity_id)) {
            return
          }
          const data = res.data || {}
          self.opportunity = data.opportunity || null
          self.activities = sort_activities(Array.isArray(data.activities) ? data.activities : [])
          self.loading = false
          if (silent && self.opportunity) {
            self.$emit('changed', self.opportunity)
          }
        })
        .catch(function (error) {
          if (String(id) !== String(self.opportunity_id)) {
            return
          }
          self.loading = false
          if (!silent) {
            self.load_error = resolve_error_message(error)
          }
        })
    },

    /**
     * Aplica la oportunidad que devolvió una escritura. Las respuestas de move/notas/PUT traen la
     * forma estándar (sin el pipeline completo y, según el endpoint, sin el contacto del sujeto),
     * así que se conservan esos dos datos de la ficha.
     *
     * @param {Object|null} updated
     */
    apply_opportunity(updated) {
      if (!updated) {
        return
      }
      const current = this.opportunity || {}
      const merged = Object.assign({}, current, updated)
      if (!updated.pipeline || !Array.isArray(updated.pipeline.stages)) {
        merged.pipeline = current.pipeline
      }
      const current_subject = current.subject || {}
      const subject = Object.assign({}, current_subject, updated.subject || {})
      if (!subject.phone && current_subject.phone) {
        subject.phone = current_subject.phone
      }
      if (!subject.email && current_subject.email) {
        subject.email = current_subject.email
      }
      merged.subject = subject
      this.opportunity = merged
      this.$emit('changed', merged)
    },

    /**
     * Suma actividades nuevas al historial sin duplicar.
     *
     * @param {Array<Object>} new_activities
     */
    add_activities(new_activities) {
      const list = Array.isArray(new_activities) ? new_activities.filter(Boolean) : []
      if (!list.length) {
        return
      }
      const ids = list.map(function (a) { return Number(a.id) })
      const rest = this.activities.filter(function (a) {
        return ids.indexOf(Number(a.id)) === -1
      })
      this.activities = sort_activities(rest.concat(list))
    },

    /**
     * @param {string} key
     * @returns {string}
     */
    next_error(key) {
      return first_error(this.next_errors, key)
    },

    /**
     * @param {string} key
     * @returns {string}
     */
    note_error(key) {
      return first_error(this.note_errors, key)
    },

    /**
     * PUT con el responsable nuevo ("" = sin responsable).
     *
     * @param {string} value
     */
    change_owner(value) {
      const self = this
      if (!this.opportunity) {
        return
      }
      this.saving_owner = true
      api
        .put('/pipeline-opportunities/' + this.opportunity.id, {
          owner_admin_id: value === '' ? null : Number(value),
        })
        .then(function (res) {
          const data = res.data || {}
          self.saving_owner = false
          self.apply_opportunity(data.opportunity)
          self.add_activities(data.activities)
          show_toast('Responsable actualizado.')
        })
        .catch(function () {
          self.saving_owner = false
          // El selector vuelve a mostrar el responsable guardado.
          self.owner_select_key = self.owner_select_key + 1
        })
    },

    /**
     * Abre la edición de la próxima acción con los valores actuales.
     */
    start_edit_next() {
      const split = split_for_inputs(this.opportunity.next_action_at)
      this.next_form = { date: split.date, time: split.time, note: this.opportunity.next_action_note || '' }
      this.next_errors = {}
      this.editing_next = true
    },

    /**
     * PUT de la próxima acción: `Y-m-d` sin hora, `Y-m-d H:i` con hora, o null para quitarla.
     *
     * @param {boolean} clear true = quitar la próxima acción.
     */
    save_next(clear) {
      const self = this
      if (!this.opportunity || this.saving_next) {
        return
      }
      const payload = clear
        ? { next_action_at: null, next_action_note: null }
        : {
          next_action_at: build_next_action_value(this.next_form.date, this.next_form.time),
          next_action_note: this.next_form.note.trim() !== '' ? this.next_form.note.trim() : null,
        }
      this.saving_next = true
      this.next_errors = {}
      api
        .put('/pipeline-opportunities/' + this.opportunity.id, payload)
        .then(function (res) {
          const data = res.data || {}
          self.saving_next = false
          self.editing_next = false
          self.apply_opportunity(data.opportunity)
          self.add_activities(data.activities)
          show_toast(clear ? 'Próxima acción quitada.' : 'Próxima acción guardada.')
        })
        .catch(function (error) {
          self.saving_next = false
          self.next_errors = validation_errors(error)
        })
    },

    /**
     * POST de una nota. El canal y la fecha son opcionales (sin fecha = ahora); que la fecha no
     * sea futura lo valida el back.
     */
    add_note() {
      const self = this
      if (!this.opportunity || this.saving_note) {
        return
      }
      const payload = { body: this.note_form.body.trim() }
      if (this.note_form.channel) {
        payload.channel = this.note_form.channel
      }
      const occurred_at = datetime_local_to_api(this.note_form.occurred_at)
      if (occurred_at) {
        payload.occurred_at = occurred_at
      }
      this.saving_note = true
      this.note_errors = {}
      api
        .post('/pipeline-opportunities/' + this.opportunity.id + '/notes', payload)
        .then(function (res) {
          const data = res.data || {}
          self.saving_note = false
          self.note_form = { body: '', channel: '', occurred_at: '' }
          self.add_activities([data.activity])
          self.apply_opportunity(data.opportunity)
          show_toast('Nota agregada.')
        })
        .catch(function (error) {
          self.saving_note = false
          self.note_errors = validation_errors(error)
        })
    },

    /**
     * DELETE de una nota (el back solo deja borrar notas; el historial de etapas no se borra).
     * Después se recarga la ficha en segundo plano para que la "última actividad" quede al día.
     *
     * @param {Object} activity
     */
    delete_note(activity) {
      const self = this
      if (!activity || this.deleting_activity_id) {
        return
      }
      if (!window.confirm('¿Borrar esta nota del historial?')) {
        return
      }
      this.deleting_activity_id = activity.id
      api
        .delete('/pipeline-activities/' + activity.id)
        .then(function () {
          self.deleting_activity_id = null
          self.activities = self.activities.filter(function (a) {
            return Number(a.id) !== Number(activity.id)
          })
          show_toast('Nota borrada.')
          self.load(true)
        })
        .catch(function () {
          self.deleting_activity_id = null
        })
    },

    /**
     * DELETE de la oportunidad (con todo su historial), previa confirmación.
     */
    delete_opportunity() {
      const self = this
      if (!this.opportunity || this.deleting) {
        return
      }
      const pipeline = this.opportunity.pipeline ? ' en «' + this.opportunity.pipeline.name + '»' : ''
      const ok = window.confirm(
        '¿Borrar la oportunidad de «' + (this.subject.name || 'este sujeto') + '»' + pipeline + '? '
        + 'Se borra también todo su historial.'
      )
      if (!ok) {
        return
      }
      const id = this.opportunity.id
      this.deleting = true
      api
        .delete('/pipeline-opportunities/' + id)
        .then(function () {
          self.deleting = false
          show_toast('Oportunidad borrada.')
          self.$emit('deleted', id)
        })
        .catch(function () {
          self.deleting = false
        })
    },

    /**
     * Abre el modal de mover con una key nueva (estado limpio).
     */
    open_move() {
      this.move = { show: true, key: this.move.key + 1 }
    },

    /**
     * Resultado del modal de mover: `{ opportunity, activity }`.
     *
     * @param {Object} payload
     */
    on_moved(payload) {
      this.move = { show: false, key: this.move.key }
      this.editing_next = false
      this.add_activities([payload && payload.activity])
      this.apply_opportunity(payload && payload.opportunity)
      const stage = this.opportunity && this.opportunity.stage
      show_toast(stage ? 'Pasó a «' + stage.name + '».' : 'Oportunidad movida.')
    },

    /**
     * Ícono de una actividad del historial.
     *
     * @param {Object} activity
     * @returns {string}
     */
    activity_icon(activity) {
      if (activity.type === 'created') {
        return 'bi-plus-circle'
      }
      if (activity.type === 'stage_change') {
        return 'bi-arrow-right-circle'
      }
      if (activity.type === 'next_action') {
        return 'bi-calendar-event'
      }
      if (activity.type === 'owner') {
        return 'bi-person-check'
      }
      if (activity.type === 'note') {
        return CHANNEL_ICONS[activity.channel] || 'bi-chat-left-text'
      }
      return 'bi-dot'
    },

    /**
     * Título de una actividad: el cambio de etapa con sus nombres (foto, no referencia viva), el
     * canal de una nota, o la etiqueta del tipo que publica el back.
     *
     * @param {Object} activity
     * @returns {string}
     */
    activity_title(activity) {
      const label_for = this.$store.getters['pipeline/label_for']
      if (activity.type === 'stage_change') {
        return (activity.from_stage_name || '—') + ' → ' + (activity.to_stage_name || '—')
      }
      if (activity.type === 'created') {
        return activity.to_stage_name ? 'Alta en «' + activity.to_stage_name + '»' : label_for('activity_types', 'created')
      }
      if (activity.type === 'note' && activity.channel) {
        return label_for('activity_types', 'note') + ' · ' + label_for('channels', activity.channel)
      }
      return label_for('activity_types', activity.type)
    },

    /**
     * "de → a" legible de los cambios de próxima acción y de responsable (`data = {from, to}`).
     *
     * @param {Object} activity
     * @returns {string}
     */
    activity_change_text(activity) {
      const data = activity.data
      if (!data || Array.isArray(data) || typeof data !== 'object') {
        return ''
      }
      if (activity.type === 'next_action') {
        const from = data.from ? format_datetime(data.from) : 'sin fecha'
        const to = data.to ? format_datetime(data.to) : 'sin fecha'
        return from + ' → ' + to + (data.note ? ' · ' + data.note : '')
      }
      if (activity.type === 'owner') {
        return (data.from || 'Sin responsable') + ' → ' + (data.to || 'Sin responsable')
      }
      return ''
    },

    /**
     * Valores que se cargaron al entrar a la etapa (`data = [{key, label, type, value}]`).
     *
     * @param {Object} activity
     * @returns {Array<{label: string, text: string}>}
     */
    activity_values(activity) {
      if (!Array.isArray(activity.data)) {
        return []
      }
      return activity.data.map(function (item) {
        return {
          label: item.label || item.key || '',
          text: format_field_value(item.type, item.value),
        }
      })
    },
  },
}
</script>

<style scoped>
.pl-ficha__block {
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-secondary);
}

.pl-ficha__block--last {
  border-bottom: 0;
  margin-bottom: 0;
  padding-bottom: 0;
}

.pl-ficha__subject {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.pl-ficha__subject-names {
  min-width: 0;
  flex: 1 1 12rem;
}

.pl-ficha__name {
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  word-break: break-word;
}

.pl-ficha__secondary {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.pl-ficha__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.pl-ficha__tag {
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.pl-ficha__contact {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  margin-top: 0.75rem;
}

.pl-ficha__contact-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  text-decoration: none;
  word-break: break-all;
}

.pl-ficha__contact-item--wa {
  color: #198754;
}

.pl-ficha__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem 1.5rem;
  margin: 0;
}

.pl-ficha__fact dt {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.045em;
  color: var(--color-text-secondary);
  margin-bottom: 0.15rem;
}

.pl-ficha__fact dd {
  margin: 0;
  font-size: 0.9rem;
  min-width: 0;
}

.pl-ficha__stage {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.pl-ficha__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 1rem 1.5rem;
}

@media (max-width: 575.98px) {
  .pl-ficha__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pl-ficha__next {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  min-height: var(--toolbar-control-h);
  font-size: 0.9rem;
}

.pl-ficha__next-inputs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 7.5rem);
  gap: 0.5rem;
}

.pl-ficha__note-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.pl-ficha__note-options > select {
  flex: 1 1 9rem;
  width: auto;
}

.pl-ficha__note-options > input {
  flex: 1 1 12rem;
  width: auto;
}

.pl-ficha__note-options > button {
  flex: 0 0 auto;
}

.pl-ficha__heading {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.045em;
  color: var(--color-text-secondary);
  margin-bottom: 0.75rem;
}

/* Historial: línea de tiempo sobria, ícono a la izquierda. */
.pl-timeline {
  list-style: none;
  padding: 0;
  margin: 0;
}

.pl-timeline__item {
  display: flex;
  gap: 0.75rem;
  padding: 0.6rem 0;
}

.pl-timeline__item + .pl-timeline__item {
  border-top: 1px solid var(--color-border-secondary);
}

.pl-timeline__icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-hover);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.pl-timeline__body {
  flex: 1 1 auto;
  min-width: 0;
}

.pl-timeline__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pl-timeline__title {
  font-size: 0.9rem;
  font-weight: 600;
  min-width: 0;
  word-break: break-word;
}

.pl-timeline__delete {
  margin-left: auto;
  color: var(--color-text-secondary);
}

.pl-timeline__delete:hover {
  color: var(--bs-danger);
}

.pl-timeline__change {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.pl-timeline__text {
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.pl-timeline__values {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  font-size: 0.85rem;
}

.pl-timeline__value {
  display: flex;
  gap: 0.4rem;
  min-width: 0;
}

.pl-timeline__value dt {
  font-weight: 600;
  color: var(--color-text-secondary);
  flex: 0 0 auto;
}

.pl-timeline__value dt::after {
  content: ':';
}

.pl-timeline__value dd {
  margin: 0;
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.pl-timeline__meta {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
