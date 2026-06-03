<template>
  <div>
    <input
      class="form-control"
      :value="display_text"
      :placeholder="placeholder"
      :disabled="disabled"
      readonly
      @click="open_modal"
      @focus="open_modal"
      @keydown="on_trigger_keydown"
    />
    <search-modal
      :show="show_modal"
      :model_name="relation"
      :initial_query="modal_initial_query"
      @update:show="on_modal_show"
      @close="on_modal_close"
      @selected="on_row_selected"
    />
  </div>
</template>

<script>
import SearchModal from './Modal.vue'

/**
 * Input que abre el modal de búsqueda (click, focus o primera tecla).
 * v-model: id del registro relacionado. Requiere `relation` (nombre de modelo en API).
 */
export default {
  name: 'SearchField',
  components: { SearchModal },
  props: {
    modelValue: { type: [Number, String, null], default: null },
    /**
     * Nombre del modelo a buscar en el API (ej. client, version).
     */
    relation: { type: String, default: '' },
    /**
     * Clave en el registro elegido para mostrar en el input (ej. name, version).
     */
    relation_label: { type: String, default: 'name' },
    /**
     * Texto de placeholder del input.
     */
    placeholder: { type: String, default: 'Haga clic para buscar…' },
    /**
     * Etiqueta mostrada si el padre tiene el objeto anidado (ej. form.client.name).
     */
    display_label: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'selected'],
  data() {
    return {
      show_modal: false,
      /** Texto mostrado tras elegir en el modal (sincronizado con el registro). */
      selected_display: '',
      /** Primera letra o criterio semilla al abrir con teclado. */
      modal_initial_query: '',
    }
  },
  computed: {
    /**
     * Valor mostrado en el input reutilizable.
     * @returns {string}
     */
    display_text() {
      if (this.display_label) {
        return this.display_label
      }
      if (this.modelValue != null && this.modelValue !== '' && this.selected_display) {
        return this.selected_display
      }
      if (this.modelValue != null && this.modelValue !== '') {
        return '#' + String(this.modelValue)
      }
      return ''
    },
  },
  watch: {
    modelValue() {
      if (this.modelValue == null || this.modelValue === '') {
        this.selected_display = ''
      }
    },
    display_label() {
      if (this.display_label) {
        this.selected_display = ''
      }
    },
  },
  methods: {
    /**
     * Abre el modal con criterio vacío o desde una tecla.
     * @param {string} [seed]
     * @returns {void}
     */
    open_modal(seed) {
      if (this.disabled) {
        return
      }
      this.modal_initial_query = seed != null ? String(seed) : ''
      this.show_modal = true
    },
    /**
     * Tecla imprimible: abre modal y pone la letra en el criterio.
     * @param {KeyboardEvent} e
     * @returns {void}
     */
    on_trigger_keydown(e) {
      if (this.show_modal) {
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        this.open_modal(e.key)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.open_modal('')
      }
    },
    /**
     * Sincroniza cierre/estado con SearchModal.
     * @param {boolean} v
     * @returns {void}
     */
    on_modal_show(v) {
      this.show_modal = v
    },
    on_modal_close() {
      this.show_modal = false
    },
    /**
     * Fila elegida: actualiza v-model (id) y el texto de presentación.
     * @param {Object} row
     * @returns {void}
     */
    on_row_selected(row) {
      if (!row) {
        return
      }
      const id = row.id
      this.$emit('update:modelValue', id)
      const k = this.relation_label
      this.selected_display =
        row && k in row && row[k] != null
          ? String(row[k])
          : id != null
            ? String(id)
            : ''
      this.$emit('selected', row)
    },
  },
}
</script>
