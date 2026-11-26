<template>
  <div class="support-ticket-description w-100">
    <!--
      Descripción del ticket (support_tickets.summary, ≤ 600): qué pasa y qué se le indicó al cliente. La
      reescribe Martín en cada respuesta (misión martin-descripcion-y-actualizaciones, 25/11/2026), así que
      casi nunca se edita: se lee. Por eso se ve como un texto con su label y sólo al hacer clic (o Enter) se
      convierte en textarea. Se guarda con el botón Guardar del header, igual que el nombre.
    -->
    <label
      :for="field_id"
      class="support-ticket-description-label"
      @click.prevent="on_label_click">{{ label }}</label>
    <textarea
      v-if="editing"
      :id="field_id"
      ref="textarea"
      class="support-ticket-description-body support-ticket-description-input"
      rows="1"
      :maxlength="max"
      :disabled="!has_ticket"
      :value="ticket_summary_draft"
      :placeholder="placeholder"
      @input="on_draft_input"
      @blur="on_blur"
      @keydown.esc.stop.prevent="on_escape"></textarea>
    <div
      v-else
      :id="field_id"
      class="support-ticket-description-body support-ticket-description-read"
      :class="{ 'support-ticket-description-read--empty': display.is_placeholder, 'support-ticket-description-read--disabled': !has_ticket }"
      role="button"
      tabindex="0"
      :aria-disabled="has_ticket ? 'false' : 'true'"
      title="Clic para editar"
      @click="on_read_click"
      @keydown.enter.prevent="on_enter"
      @keydown.space.prevent="on_enter">{{ display.text }}</div>
    <small v-if="editing && ticket_summary_draft.length > max - 100" class="text-muted support-ticket-description-count">
      {{ ticket_summary_draft.length }}/{{ max }}
    </small>
  </div>
</template>

<script>
import {
  DESCRIPTION_LABEL,
  DESCRIPTION_PLACEHOLDER,
  description_display,
  edit_transition,
} from '@/utils/support_description'

/** Contador para que cada instancia tenga un id propio (el label apunta al campo). */
let next_field_id = 0

/**
 * Descripción del ticket: texto con label en lectura, textarea al hacer clic. El padre consolida el PUT con
 * nombre y estado (mismo patrón que TicketNameField); la lógica de lectura/edición vive en
 * `utils/support_description.js`.
 */
export default {
  name: 'TicketSummaryField',
  emits: ['update:ticket_summary_draft'],
  props: {
    /** Si hay ticket seleccionado (habilita edición). */
    has_ticket: {
      type: Boolean,
      default: false,
    },
    /** Borrador sincronizado con la vista padre. */
    ticket_summary_draft: {
      type: String,
      default: '',
    },
    /** Descripción guardada en el servidor: a ella vuelve Escape y contra ella se detectan cambios. */
    saved_summary: {
      type: String,
      default: '',
    },
  },
  data() {
    next_field_id += 1
    return {
      // Largo máximo de support_tickets.summary.
      max: 600,
      // true mientras se muestra el textarea.
      editing: false,
      // Id único del campo (lo usa el for del label).
      field_id: 'support-ticket-description-' + next_field_id,
      label: DESCRIPTION_LABEL,
      placeholder: DESCRIPTION_PLACEHOLDER,
    }
  },
  computed: {
    /**
     * Texto de lectura: el borrador o el placeholder gris.
     *
     * @returns {{text: string, is_placeholder: boolean}}
     */
    display() {
      return description_display(this.ticket_summary_draft)
    },
  },
  watch: {
    /**
     * Al cambiar de ticket el campo vuelve siempre a lectura.
     */
    has_ticket() {
      this.editing = false
    },
    /**
     * Cuando llega la descripción guardada (Guardar del header, o Martín por Pusher) y el borrador ya
     * coincide, el campo vuelve a lectura salvo que Lucas siga escribiendo en él.
     */
    saved_summary() {
      const el = this.$refs.textarea
      const typing = !!el && typeof document !== 'undefined' && document.activeElement === el
      if (this.editing && !typing) {
        this.apply('blur')
      }
    },
  },
  methods: {
    /**
     * Estado actual para la transición pura.
     *
     * @returns {{editing: boolean, draft: string, saved: string, disabled: boolean}}
     */
    current_state() {
      return {
        editing: this.editing,
        draft: this.ticket_summary_draft,
        saved: this.saved_summary,
        disabled: !this.has_ticket,
      }
    },
    /**
     * Aplica el resultado de una transición: modo, borrador (si volvió al guardado) y foco.
     *
     * @param {string} event click | enter | escape | blur
     * @returns {void}
     */
    apply(event) {
      const next = edit_transition(this.current_state(), event)
      this.editing = next.editing
      if (next.draft_changed) {
        this.$emit('update:ticket_summary_draft', next.draft)
      }
      if (next.focus) {
        this.focus_textarea()
      }
    },
    /**
     * Clic sobre el texto: abre la edición, salvo que Lucas esté seleccionando texto para copiarlo.
     *
     * @returns {void}
     */
    on_read_click() {
      const selection = typeof window !== 'undefined' && window.getSelection ? String(window.getSelection()) : ''
      if (selection.trim() !== '') {
        return
      }
      this.apply('click')
    },
    /**
     * Clic en el label: equivale a hacer clic en el texto.
     *
     * @returns {void}
     */
    on_label_click() {
      this.apply('click')
    },
    /**
     * Enter o espacio sobre el texto (accesibilidad por teclado).
     *
     * @returns {void}
     */
    on_enter() {
      this.apply('enter')
    },
    /**
     * Escape: descarta el borrador y vuelve a lectura.
     *
     * @returns {void}
     */
    on_escape() {
      this.apply('escape')
    },
    /**
     * El textarea pierde el foco: sin cambios vuelve a lectura.
     *
     * @returns {void}
     */
    on_blur() {
      this.apply('blur')
    },
    /**
     * Propaga el borrador al padre y reajusta el alto.
     *
     * @param {Event} event Evento input nativo
     * @returns {void}
     */
    on_draft_input(event) {
      const v = event && event.target ? event.target.value : ''
      this.$emit('update:ticket_summary_draft', v)
      this.autosize()
    },
    /**
     * Foco al textarea recién montado, con el cursor al final y el alto ajustado al texto.
     *
     * @returns {void}
     */
    focus_textarea() {
      const self = this
      this.$nextTick(function () {
        const el = self.$refs.textarea
        if (!el) {
          return
        }
        self.autosize()
        el.focus()
        const end = el.value.length
        el.setSelectionRange(end, end)
      })
    },
    /**
     * Ajusta el alto del textarea a su contenido: así ocupa lo mismo que el texto de lectura y al hacer clic
     * no se mueve nada debajo.
     *
     * @returns {void}
     */
    autosize() {
      const el = this.$refs.textarea
      if (!el) {
        return
      }
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 2 + 'px'
    },
  },
}
</script>

<style scoped lang="scss">
.support-ticket-description {
	position: relative;
}

/* Label discreto, como el de un campo de Ajustes de iOS: chico, gris y sin mayúsculas forzadas. */
.support-ticket-description-label {
	display: block;
	margin: 0 0 0.1rem 0.5rem;
	font-size: 0.72rem;
	font-weight: 600;
	letter-spacing: 0.02em;
	color: var(--bs-secondary-color);
	cursor: pointer;
}

/* Lectura y edición comparten caja (mismo padding, borde y tipografía) para que el clic no salte. */
.support-ticket-description-body {
	display: block;
	width: 100%;
	margin: 0;
	padding: 0.25rem 0.5rem;
	border: 1px solid transparent;
	border-radius: 0.5rem;
	font-family: inherit;
	font-size: 0.85rem;
	line-height: 1.4;
	color: var(--bs-body-color);
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.support-ticket-description-read {
	cursor: text;
	transition: background-color 0.15s ease;
}

.support-ticket-description-read:hover,
.support-ticket-description-read:focus-visible {
	background-color: var(--bs-tertiary-bg);
	outline: none;
}

.support-ticket-description-read--empty {
	color: var(--bs-secondary-color);
	font-style: italic;
}

.support-ticket-description-read--disabled {
	cursor: default;
	pointer-events: none;
}

.support-ticket-description-input {
	resize: none;
	overflow: hidden;
	min-height: 2rem;
	background-color: var(--bs-body-bg);
	border-color: var(--bs-border-color);
}

.support-ticket-description-input:focus {
	outline: none;
	border-color: var(--bs-primary);
	box-shadow: 0 0 0 0.15rem rgba(var(--bs-primary-rgb), 0.15);
}

.support-ticket-description-count {
	display: block;
	text-align: right;
	font-size: 0.72rem;
}
</style>
