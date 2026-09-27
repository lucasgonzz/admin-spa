<template>
  <!--
    Mover una oportunidad de etapa + nota, en UNA sola acción (POST pipeline-opportunities/{id}/move).

    Se abre desde tres lugares: al soltar una tarjeta en otra columna (la etapa ya viene elegida), con
    el botón "Mover" de la tarjeta o de la ficha (el operador la elige acá). En ninguno de los tres se
    toca nada en la base hasta que el back confirma: cancelar deja todo como estaba.

    Qué pide según la etapa destino (la definición viaja en `pipeline.stages[].fields`):
      - sus campos (FieldInput), con `*` en los obligatorios pero sin bloquear el envío;
      - si es perdida, el motivo (lista del pipeline + "Otro");
      - si es abierta SIN campo agenda, la próxima acción (si no se toca, queda la que tenía);
      - si es abierta CON campo agenda, ese campo la completa: acá solo se ofrece la nota;
      - una nota libre, siempre opcional.
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
            <option :value="CUSTOM_REASON">Otro (escribirlo)…</option>
          </select>
          <input
            v-if="uses_custom_reason"
            id="pl-move-lost-text"
            v-model="lost_custom"
            type="text"
            class="form-control"
            :class="{ 'mt-2': lost_reasons.length > 0, 'is-invalid': !!error_for('lost_reason') }"
            placeholder="Escribí el motivo"
          />
          <div v-if="error_for('lost_reason')" class="invalid-feedback d-block">{{ error_for('lost_reason') }}</div>
        </div>

        <!-- Próxima acción: destino abierto y sin campo agenda -->
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
              v-if="next_action.date || next_action.note"
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

        <!-- Destino con campo agenda: el campo completa la fecha; la nota es opcional -->
        <div v-if="target_agenda_field" class="pl-move__section mb-3">
          <label class="form-label mb-1" for="pl-move-agenda-note">Nota de la próxima acción</label>
          <input
            id="pl-move-agenda-note"
            v-model="agenda_note"
            type="text"
            class="form-control"
            :placeholder="target_stage.name"
          />
          <p class="pl-move__hint mb-0 mt-1">Opcional. Si la dejás vacía, queda el nombre de la etapa.</p>
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
import FieldInput from './FieldInput.vue'
import StageTag from './StageTag.vue'
import {
  first_error,
  serialize_field_value,
  sort_stages_for_board,
  subject_name,
  validation_errors,
} from './pipeline_helpers'
import { build_next_action_value, split_for_inputs } from '@/utils/pipeline_dates'

/** Valor del `<option>` "Otro": habilita el texto libre del motivo. */
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
    /** Oportunidad a mover (forma del contrato). */
    opportunity: { type: Object, required: true },
    /** Pipeline de la oportunidad, con `stages` (y sus `fields`) y `lost_reasons`. */
    pipeline: { type: Object, default: null },
    /** Etapa destino ya elegida (al soltar en otra columna); null = la elige el operador. */
    initial_stage_id: { type: [Number, String], default: null },
    /** Nivel de apilamiento (1+ cuando se abre encima de la ficha). */
    stack_level: { type: Number, default: 0 },
  },
  emits: ['close', 'moved'],
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
      /** Próxima acción editable (solo destino abierto sin campo agenda). */
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
    /** @returns {Object|null} El campo agenda de la etapa destino, si tiene. */
    target_agenda_field() {
      if (!this.target_stage || this.target_stage.type !== 'open') {
        return null
      }
      return this.target_fields.find(function (f) {
        return !!f.agenda
      }) || null
    },
    /** @returns {boolean} */
    target_is_lost() {
      return !!this.target_stage && this.target_stage.type === 'lost'
    },
    /** @returns {boolean} */
    target_is_closed() {
      return !!this.target_stage && this.target_stage.type !== 'open'
    },
    /** @returns {boolean} */
    shows_next_action_editor() {
      return !!this.target_stage && this.target_stage.type === 'open' && !this.target_agenda_field
    },
    /** @returns {Array<string>} */
    lost_reasons() {
      const reasons = this.pipeline && this.pipeline.lost_reasons
      return Array.isArray(reasons) ? reasons : []
    },
    /** @returns {boolean} true si el motivo se escribe a mano. */
    uses_custom_reason() {
      return this.lost_reasons.length === 0 || this.lost_choice === CUSTOM_REASON
    },
    /**
     * Aclaración bajo la próxima acción: si no se toca, el back conserva la que tenía.
     * @returns {string}
     */
    next_action_hint() {
      if (this.next_action_touched) {
        return 'Se guarda lo que dejes acá.'
      }
      return this.opportunity && this.opportunity.next_action_at
        ? 'Si no la tocás, queda la que tenía.'
        : 'Opcional.'
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
      this.values = {}
      this.note = ''
      this.lost_choice = ''
      this.lost_custom = ''
      const split = split_for_inputs(opportunity.next_action_at)
      this.next_action = { date: split.date, time: split.time, note: opportunity.next_action_note || '' }
      this.next_action_touched = false
      this.agenda_note = ''
      this.errors = {}
      this.saving = false
    },
    /**
     * @param {string} key
     * @returns {string}
     */
    error_for(key) {
      return first_error(this.errors, key)
    },
    /**
     * @param {number} stage_id
     */
    select_stage(stage_id) {
      this.target_stage_id = Number(stage_id)
      this.errors = {}
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
        payload.lost_reason = this.uses_custom_reason ? this.lost_custom.trim() : this.lost_choice
      }

      // Sin tocarla, la clave no viaja y el back conserva la próxima acción que tenía.
      if (this.shows_next_action_editor && this.next_action_touched) {
        payload.next_action_at = build_next_action_value(this.next_action.date, this.next_action.time)
        payload.next_action_note = this.next_action.note.trim() !== '' ? this.next_action.note.trim() : null
      }

      if (this.target_agenda_field && this.agenda_note.trim() !== '') {
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
