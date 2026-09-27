<template>
  <!--
    Mover una oportunidad de etapa + nota, en UNA sola acción (POST pipeline-opportunities/{id}/move).

    Se abre desde tres lugares: al soltar una tarjeta en otra columna (la etapa ya viene elegida), con
    el botón "Mover" de la tarjeta o de la ficha (el operador la elige acá). En ninguno de los tres se
    toca nada en la base hasta que el back confirma: cancelar deja todo como estaba.

    Qué pide según la etapa destino (la definición viaja en `pipeline.stages[].fields`):
      - sus campos (FieldInput), con `*` en los obligatorios pero sin bloquear el envío;
      - si es perdida, el motivo (lista del pipeline; su "Otro" abre el texto libre);
      - si es abierta, la próxima acción (ronda de arreglos R1, 27/9/2026):
          · con campo agenda: ese campo la completa y acá se ofrece solo su nota; si el campo agenda
            es opcional y queda vacío, en su lugar va el editor completo;
          · sin campo agenda: el editor, precargado SOLO si la actual sobrevive al movimiento
            (`next_action_carries_over`, lo decide el back); si no, vacío y avisando que la actual
            se borra. La regla vive en el back: acá solo se muestra lo que va a pasar;
      - una nota libre, siempre opcional.
    Cambiar la etapa destino adentro del modal vacía todo lo cargado para la anterior.
  -->
  <base-modal
    :show="show"
    :title="modal_title"
    size="lg"
    :stack_level="stack_level"
    @close="on_cancel"
  >
    <div class="pl-move">
      <p class="pl-move__current">
        <span class="text-muted">Ahora en</span>
        <stage-tag :stage="current_stage" show_type />
      </p>

      <!-- Etapa destino -->
      <div class="mb-3">
        <p id="pl-move-stages-label" class="form-label mb-2">Mover a</p>
        <div class="pl-move__stages" role="radiogroup" aria-labelledby="pl-move-stages-label">
          <button
            v-for="stage in stages"
            :key="stage.id"
            type="button"
            role="radio"
            class="pl-move__stage"
            :class="{
              'pl-move__stage--selected': Number(stage.id) === Number(target_stage_id),
              'pl-move__stage--current': Number(stage.id) === Number(current_stage_id),
            }"
            :aria-checked="Number(stage.id) === Number(target_stage_id) ? 'true' : 'false'"
            :disabled="Number(stage.id) === Number(current_stage_id) || saving"
            @click="select_stage(stage.id)"
          >
            <span class="pl-move__dot" :style="{ backgroundColor: stage.color || '#adb5bd' }" aria-hidden="true" />
            <span>{{ stage.name }}</span>
            <span v-if="Number(stage.id) === Number(current_stage_id)" class="pl-move__stage-note">actual</span>
          </button>
        </div>
        <div v-if="error_for('stage_id')" class="invalid-feedback d-block">{{ error_for('stage_id') }}</div>
      </div>

      <p v-if="!target_stage" class="text-muted small mb-0">Elegí a qué etapa pasa.</p>

      <template v-else>
        <!-- Campos que pide la etapa destino -->
        <div v-if="target_fields.length" class="pl-move__section">
          <field-input
            v-for="field in target_fields"
            :key="target_stage.id + '-' + field.key"
            v-model="values[field.key]"
            class="mb-3"
            :field="field"
            :input_id="'pl-move-field-' + field.key"
            :error="error_for('fields.' + field.key)"
          />
        </div>

        <!-- Motivo de pérdida: lo pide el sistema al pasar a una etapa perdida -->
        <div v-if="target_is_lost" class="pl-move__section mb-3">
          <label class="form-label mb-1" :for="lost_reasons.length ? 'pl-move-lost-select' : 'pl-move-lost-text'">
            Motivo de pérdida<span class="pl-move__required" title="Obligatorio"> *</span>
          </label>
          <select
            v-if="lost_reasons.length"
            id="pl-move-lost-select"
            v-model="lost_choice"
            class="form-select"
            :class="{ 'is-invalid': !!error_for('lost_reason') && !uses_custom_reason }"
          >
            <option value="">Elegí un motivo</option>
            <option v-for="reason in lost_reasons" :key="reason" :value="reason">{{ reason }}</option>
            <!-- Solo si la lista del pipeline no trae su propio "Otro": nunca dos. -->
            <option v-if="!other_reason" :value="CUSTOM_REASON">Otro (escribirlo)…</option>
          </select>
          <input
            v-if="uses_custom_reason"
            id="pl-move-lost-text"
            v-model="lost_custom"
            type="text"
            class="form-control"
            :class="{ 'mt-2': lost_reasons.length > 0, 'is-invalid': !!error_for('lost_reason') }"
            :placeholder="lost_reasons.length ? 'Contá cuál (si lo dejás vacío, queda «Otro»)' : 'Escribí el motivo'"
          />
          <div v-if="error_for('lost_reason')" class="invalid-feedback d-block">{{ error_for('lost_reason') }}</div>
        </div>

        <!-- Próxima acción: destino abierto sin campo agenda (o con uno opcional que quedó vacío) -->
        <div v-if="shows_next_action_editor" class="pl-move__section mb-3">
          <p class="form-label mb-1">Próxima acción</p>
          <div class="pl-move__next">
            <input
              v-model="next_action.date"
              type="date"
              class="form-control"
              :class="{ 'is-invalid': !!error_for('next_action_at') }"
              aria-label="Fecha de la próxima acción"
              @input="next_action_touched = true"
            />
            <input
              v-model="next_action.time"
              type="time"
              class="form-control"
              aria-label="Hora de la próxima acción (opcional)"
              title="Hora (opcional)"
              @input="next_action_touched = true"
            />
            <input
              v-model="next_action.note"
              type="text"
              class="form-control pl-move__next-note"
              :class="{ 'is-invalid': !!error_for('next_action_note') }"
              placeholder="Qué hay que hacer"
              aria-label="Nota de la próxima acción"
              @input="next_action_touched = true"
            />
          </div>
          <div class="d-flex flex-wrap align-items-center gap-2 mt-1">
            <span class="pl-move__hint">{{ next_action_hint }}</span>
            <button
              v-if="next_action.date || next_action.time || next_action.note"
              type="button"
              class="btn btn-link btn-sm p-0"
              @click="clear_next_action"
            >
              Quitar
            </button>
          </div>
          <div v-if="error_for('next_action_at')" class="invalid-feedback d-block">{{ error_for('next_action_at') }}</div>
          <div v-if="error_for('next_action_note')" class="invalid-feedback d-block">{{ error_for('next_action_note') }}</div>
        </div>

        <!-- Destino con campo agenda: el campo completa la fecha; acá solo su nota -->
        <div v-if="shows_agenda_note" class="pl-move__section mb-3">
          <label class="form-label mb-1" for="pl-move-agenda-note">Nota de la próxima acción</label>
          <input
            id="pl-move-agenda-note"
            v-model="agenda_note"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': !!error_for('next_action_note') }"
            :placeholder="target_stage.name"
          />
          <p class="pl-move__hint mb-0 mt-1">
            Opcional. La fecha es la de «{{ target_agenda_field.label }}»; si dejás la nota vacía, queda el nombre de la etapa.
          </p>
          <div v-if="error_for('next_action_at')" class="invalid-feedback d-block">{{ error_for('next_action_at') }}</div>
          <div v-if="error_for('next_action_note')" class="invalid-feedback d-block">{{ error_for('next_action_note') }}</div>
        </div>

        <p v-if="target_is_closed" class="pl-move__hint mb-3">
          <i class="bi bi-info-circle" aria-hidden="true" />
          Al cerrarla se borra la próxima acción.
        </p>

        <!-- Nota libre -->
        <div class="pl-move__section">
          <label class="form-label mb-1" for="pl-move-note">Nota</label>
          <textarea
            id="pl-move-note"
            v-model="note"
            rows="3"
            class="form-control"
            :class="{ 'is-invalid': !!error_for('note') }"
            placeholder="Qué pasó, qué se habló (opcional)"
          />
          <div v-if="error_for('note')" class="invalid-feedback d-block">{{ error_for('note') }}</div>
        </div>
      </template>
    </div>

    <template #footer>
      <button type="button" class="btn btn-secondary" :disabled="saving" @click="on_cancel">Cancelar</button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="saving || !target_stage"
        @click="submit"
      >
        <span v-if="saving" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
        {{ submit_label }}
      </button>
    </template>
  </base-modal>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import FieldInput from '@/components/pipeline/FieldInput.vue'
import StageTag from '@/components/pipeline/StageTag.vue'
import {
  OTHER_REASON_LABEL,
  find_other_reason,
  first_error,
  is_rule_error,
  serialize_field_value,
  sort_stages_for_board,
  subject_name,
  validation_errors,
} from '@/components/pipeline/pipeline_helpers'
import { build_next_action_value, format_short, split_for_inputs } from '@/utils/pipeline_dates'

/** Valor del `<option>` "Otro" que se agrega cuando la lista del pipeline no trae el suyo. */
const CUSTOM_REASON = '__otro__'

/**
 * Modal de mover de etapa. Se re-inicializa entero cada vez que cambia la oportunidad o la etapa
 * elegida de entrada (no arrastra nada de la oportunidad anterior); además el padre lo monta con
 * `v-if` y una `key` nueva por apertura.
 */
export default {
  name: 'PipelineMoveModal',
  components: { BaseModal, FieldInput, StageTag },
  props: {
    /** Visibilidad del modal. */
    show: { type: Boolean, default: true },
    /** Oportunidad a mover (forma del contrato, con `next_action_carries_over`). */
    opportunity: { type: Object, required: true },
    /** Pipeline de la oportunidad, con `stages` (y sus `fields`) y `lost_reasons`. */
    pipeline: { type: Object, default: null },
    /** Etapa destino ya elegida (al soltar en otra columna); null = la elige el operador. */
    initial_stage_id: { type: [Number, String], default: null },
    /** Nivel de apilamiento (1+ cuando se abre encima de la ficha). */
    stack_level: { type: Number, default: 0 },
  },
  emits: ['close', 'moved', 'rule-error'],
  data() {
    return {
      CUSTOM_REASON: CUSTOM_REASON,
      /** Etapa destino elegida. */
      target_stage_id: null,
      /** Valores de los campos de la etapa destino, por `key`. */
      values: {},
      /** Nota libre del movimiento. */
      note: '',
      /** Motivo elegido de la lista (o CUSTOM_REASON). */
      lost_choice: '',
      /** Motivo escrito a mano ("Otro"). */
      lost_custom: '',
      /** Próxima acción editable. */
      next_action: { date: '', time: '', note: '' },
      /** true cuando el operador tocó la próxima acción: recién ahí se manda. */
      next_action_touched: false,
      /** Nota de la próxima acción cuando la completa un campo agenda. */
      agenda_note: '',
      /** Errores del último 422. */
      errors: {},
      /** true mientras corre el POST. */
      saving: false,
    }
  },
  computed: {
    /** @returns {Array<Object>} Etapas en el orden del tablero. */
    stages() {
      return sort_stages_for_board((this.pipeline && this.pipeline.stages) || [])
    },
    /** @returns {number|null} */
    current_stage_id() {
      return this.opportunity ? this.opportunity.stage_id : null
    },
    /** @returns {Object|null} Etapa actual (del pipeline, o la foto que trae la oportunidad). */
    current_stage() {
      const self = this
      const found = this.stages.find(function (s) {
        return Number(s.id) === Number(self.current_stage_id)
      })
      return found || (this.opportunity && this.opportunity.stage) || null
    },
    /** @returns {Object|null} */
    target_stage() {
      const self = this
      if (this.target_stage_id === null || this.target_stage_id === undefined) {
        return null
      }
      return this.stages.find(function (s) {
        return Number(s.id) === Number(self.target_stage_id)
      }) || null
    },
    /** @returns {Array<Object>} Definición de campos de la etapa destino. */
    target_fields() {
      const fields = this.target_stage && this.target_stage.fields
      return Array.isArray(fields) ? fields : []
    },
    /** @returns {boolean} */
    target_is_open() {
      return !!this.target_stage && this.target_stage.type === 'open'
    },
    /** @returns {Object|null} El campo agenda de la etapa destino, si es abierta y tiene. */
    target_agenda_field() {
      if (!this.target_is_open) {
        return null
      }
      return this.target_fields.find(function (f) {
        return !!f.agenda
      }) || null
    },
    /** @returns {boolean} true si el campo agenda tiene un valor que se va a mandar. */
    agenda_field_has_value() {
      const field = this.target_agenda_field
      return !!field && serialize_field_value(field, this.values[field.key]) !== undefined
    },
    /**
     * La nota de la próxima acción sola (la fecha la pone el campo agenda): destino con campo
     * agenda obligatorio, o opcional pero con valor.
     * @returns {boolean}
     */
    shows_agenda_note() {
      const field = this.target_agenda_field
      return !!field && (!!field.required || this.agenda_field_has_value)
    },
    /**
     * El editor completo de próxima acción: destino abierto sin campo agenda, o con uno opcional
     * que quedó vacío (entonces la fecha no la pone nadie más).
     * @returns {boolean}
     */
    shows_next_action_editor() {
      return this.target_is_open && !this.shows_agenda_note
    },
    /** @returns {boolean} */
    target_is_lost() {
      return !!this.target_stage && this.target_stage.type === 'lost'
    },
    /** @returns {boolean} */
    target_is_closed() {
      return !!this.target_stage && this.target_stage.type !== 'open'
    },
    /** @returns {Array<string>} */
    lost_reasons() {
      const reasons = this.pipeline && this.pipeline.lost_reasons
      return Array.isArray(reasons) ? reasons : []
    },
    /** @returns {string|null} El "Otro" de la lista del pipeline, si lo tiene. */
    other_reason() {
      return find_other_reason(this.lost_reasons)
    },
    /** @returns {boolean} true si el motivo se escribe a mano. */
    uses_custom_reason() {
      if (this.lost_reasons.length === 0 || this.lost_choice === CUSTOM_REASON) {
        return true
      }
      return this.other_reason !== null && this.lost_choice === this.other_reason
    },
    /**
     * El motivo que viaja: el de la lista, o lo escrito en "Otro" (o "Otro" si quedó vacío). Sin
     * lista y sin nada escrito viaja vacío y el back contesta que falta.
     * @returns {string}
     */
    lost_reason_value() {
      if (this.lost_reasons.length === 0) {
        return this.lost_custom.trim()
      }
      if (this.uses_custom_reason) {
        return this.lost_custom.trim() || this.other_reason || OTHER_REASON_LABEL
      }
      return this.lost_choice
    },
    /** @returns {boolean} La próxima acción actual sobrevive al movimiento (lo decide el back). */
    carries_over() {
      return !!(this.opportunity && this.opportunity.next_action_carries_over)
    },
    /** @returns {string} La próxima acción actual en una línea: "mié 30/9 · 15:00 · Llamar". */
    current_next_action_text() {
      const opportunity = this.opportunity || {}
      if (!opportunity.next_action_at) {
        return ''
      }
      const when = format_short(opportunity.next_action_at)
      return opportunity.next_action_note ? when + ' · ' + opportunity.next_action_note : when
    },
    /**
     * Qué pasa con la próxima acción si no se toca el editor (lo que decide el back, dicho antes).
     * @returns {string}
     */
    next_action_hint() {
      if (this.next_action_touched) {
        return 'Se guarda lo que dejes acá.'
      }
      if (this.carries_over) {
        return 'Se mantiene la próxima acción actual; cambiala si hace falta.'
      }
      if (this.current_next_action_text) {
        return 'La próxima acción actual (' + this.current_next_action_text + ') se borra al mover.'
      }
      return 'Opcional.'
    },
    /** @returns {string} */
    modal_title() {
      return 'Mover · ' + subject_name(this.opportunity)
    },
    /** @returns {string} */
    submit_label() {
      if (this.saving) {
        return 'Moviendo…'
      }
      if (this.target_is_closed) {
        const label = this.$store.getters['pipeline/label_for']('stage_types', this.target_stage.type)
        return 'Cerrar como ' + String(label).toLowerCase()
      }
      return 'Mover'
    },
  },
  watch: {
    /** Otra oportunidad: todo de cero. */
    'opportunity.id': function () {
      this.reset_form()
    },
    /** Otra etapa elegida de entrada (otro arrastre): todo de cero. */
    initial_stage_id: function () {
      this.reset_form()
    },
    /** Cada apertura arranca limpia. */
    show: function (is_visible) {
      if (is_visible) {
        this.reset_form()
      }
    },
  },
  created() {
    this.reset_form()
  },
  methods: {
    /**
     * Deja el formulario como recién abierto para la oportunidad actual.
     */
    reset_form() {
      const opportunity = this.opportunity || {}
      const initial = this.initial_stage_id
      const has_initial = initial !== null && initial !== undefined && initial !== ''
      this.target_stage_id = has_initial && Number(initial) !== Number(opportunity.stage_id) ? Number(initial) : null
      this.reset_stage_inputs()
      this.saving = false
    },
    /**
     * Vacía todo lo que depende de la etapa destino: valores de sus campos, motivo, notas y el
     * editor de próxima acción (que vuelve a precargarse solo si la actual sobrevive al movimiento).
     */
    reset_stage_inputs() {
      const opportunity = this.opportunity || {}
      this.values = {}
      this.note = ''
      this.lost_choice = ''
      this.lost_custom = ''
      if (this.carries_over) {
        const split = split_for_inputs(opportunity.next_action_at)
        this.next_action = { date: split.date, time: split.time, note: opportunity.next_action_note || '' }
      } else {
        this.next_action = { date: '', time: '', note: '' }
      }
      this.next_action_touched = false
      this.agenda_note = ''
      this.errors = {}
    },
    /**
     * @param {string} key
     * @returns {string}
     */
    error_for(key) {
      return first_error(this.errors, key)
    },
    /**
     * Elegir otra etapa destino adentro del modal arranca su formulario de cero.
     *
     * @param {number} stage_id
     */
    select_stage(stage_id) {
      if (Number(stage_id) === Number(this.target_stage_id)) {
        return
      }
      this.target_stage_id = Number(stage_id)
      this.reset_stage_inputs()
    },
    /**
     * Vacía la próxima acción: al mandar viaja `next_action_at: null` y la quita.
     */
    clear_next_action() {
      this.next_action = { date: '', time: '', note: '' }
      this.next_action_touched = true
    },
    /**
     * Cerrar sin mover. No hay nada que deshacer: el tablero no se tocó.
     */
    on_cancel() {
      if (this.saving) {
        return
      }
      this.$emit('close')
    },
    /**
     * Arma el payload según el contrato de `move` y lo manda. Lo que falte o esté mal lo contesta
     * el back con un 422; los errores quedan debajo de cada campo (y el toast global los resume).
     */
    submit() {
      const self = this
      if (this.saving || !this.target_stage || !this.opportunity) {
        return
      }
      const payload = { stage_id: Number(this.target_stage.id) }

      const fields = {}
      this.target_fields.forEach(function (field) {
        const value = serialize_field_value(field, self.values[field.key])
        if (value !== undefined) {
          fields[field.key] = value
        }
      })
      payload.fields = fields

      if (this.note.trim() !== '') {
        payload.note = this.note.trim()
      }

      if (this.target_is_lost) {
        payload.lost_reason = this.lost_reason_value
      }

      // La clave viaja solo si el operador tocó el editor; si no, decide el back (conservar o
      // borrar según `next_action_carries_over`).
      if (this.shows_next_action_editor && this.next_action_touched) {
        payload.next_action_at = build_next_action_value(this.next_action.date, this.next_action.time)
        payload.next_action_note = this.next_action.note.trim() !== '' ? this.next_action.note.trim() : null
      }

      if (this.shows_agenda_note && this.agenda_note.trim() !== '') {
        payload.next_action_note = this.agenda_note.trim()
      }

      this.saving = true
      this.errors = {}
      api
        .post('/pipeline-opportunities/' + this.opportunity.id + '/move', payload)
        .then(function (res) {
          const data = res.data || {}
          self.saving = false
          self.$emit('moved', { opportunity: data.opportunity || null, activity: data.activity || null })
        })
        .catch(function (error) {
          self.saving = false
          self.errors = validation_errors(error)
          // Un 422 de regla ("ya está en esa etapa", "tiene otra abierta"…) casi siempre es que lo
          // cargado quedó viejo: se vuelve a pedir la lista de pipelines y se avisa al padre.
          if (is_rule_error(error)) {
            self.$store.dispatch('pipeline/fetch_pipelines').catch(function () {
              return null
            })
            self.$emit('rule-error')
          }
        })
    },
  },
}
</script>

<style scoped>
.pl-move__current {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.pl-move__stages {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.pl-move__stage {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 34px;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  line-height: 1.2;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.pl-move__stage:hover:not(:disabled) {
  background: var(--bg-hover);
}

.pl-move__stage--selected,
.pl-move__stage--selected:hover:not(:disabled) {
  background: var(--color-text-primary);
  border-color: var(--color-text-primary);
  color: #fff;
}

.pl-move__stage:disabled {
  opacity: 0.55;
  cursor: default;
}

.pl-move__dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.pl-move__stage--selected .pl-move__dot {
  box-shadow: 0 0 0 2px #fff;
}

.pl-move__stage-note {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
}

.pl-move__section {
  border-top: 1px solid var(--color-border-secondary);
  padding-top: 1rem;
}

.pl-move__required {
  color: var(--bs-danger);
}

/* Fecha, hora y nota en una fila en escritorio; en teléfono la nota baja a su propia línea. */
.pl-move__next {
  display: grid;
  grid-template-columns: minmax(0, 11rem) minmax(0, 8rem) minmax(0, 1fr);
  gap: 0.5rem;
}

@media (max-width: 575.98px) {
  .pl-move__next {
    grid-template-columns: minmax(0, 1fr) minmax(0, 7.5rem);
  }

  .pl-move__next-note {
    grid-column: 1 / -1;
  }
}

.pl-move__hint {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
</style>
