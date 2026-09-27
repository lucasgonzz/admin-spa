<template>
  <!--
    Editor de la definición de campos de una etapa (lo que pide al entrar una oportunidad).

    Cada campo: etiqueta, tipo (catálogo del back), obligatorio, "agenda" (solo en campos de fecha:
    completa la próxima acción) y, si es una lista, sus opciones una por línea. La clave interna la
    genera el back a partir de la etiqueta; la de un campo existente se muestra y se conserva.
    Qué combinaciones valen (dos agenda, lista sin opciones, más de 20 campos…) lo valida el back:
    los errores del 422 aparecen debajo de cada fila.
  -->
  <div class="pl-fields">
    <div v-for="message in general_errors" :key="message" class="invalid-feedback d-block mb-2">{{ message }}</div>

    <p v-if="!rows.length" class="pl-fields__empty">Esta etapa no pide campos.</p>

    <div
      v-for="(row, index) in rows"
      :key="row.uid"
      class="pl-fields__row"
      :class="{ 'pl-fields__row--error': row_errors(index).length > 0 }"
    >
      <div class="pl-fields__main">
        <input
          v-model="row.label"
          type="text"
          class="form-control form-control-sm pl-fields__label"
          :class="{ 'is-invalid': has_error(index, 'label') }"
          placeholder="Etiqueta (ej.: Fecha de la reunión)"
          :aria-label="'Etiqueta del campo ' + (index + 1)"
        />
        <select
          v-model="row.type"
          class="form-select form-select-sm pl-fields__type"
          :class="{ 'is-invalid': has_error(index, 'type') }"
          :aria-label="'Tipo del campo ' + (index + 1)"
          @change="on_type_change(row)"
        >
          <option v-for="type in type_options(row)" :key="type.value" :value="type.value">{{ type.label }}</option>
        </select>
      </div>

      <div class="pl-fields__flags">
        <div class="form-check mb-0">
          <input :id="'pl-field-req-' + row.uid" v-model="row.required" class="form-check-input" type="checkbox" />
          <label class="form-check-label small" :for="'pl-field-req-' + row.uid">Obligatorio</label>
        </div>
        <div v-if="is_date_type(row.type)" class="form-check mb-0">
          <input :id="'pl-field-agenda-' + row.uid" v-model="row.agenda" class="form-check-input" type="checkbox" />
          <label
            class="form-check-label small"
            :for="'pl-field-agenda-' + row.uid"
            title="Al mover a esta etapa, esta fecha pasa a ser la próxima acción de la oportunidad"
          >
            Agenda
          </label>
        </div>
        <span v-if="row.key" class="pl-fields__key" title="Clave interna del campo (no cambia al renombrarlo)">{{ row.key }}</span>

        <div class="pl-fields__row-actions">
          <button
            type="button"
            class="btn btn-sm btn-light"
            :disabled="index === 0"
            :aria-label="'Subir el campo ' + (index + 1)"
            title="Subir"
            @click="move_row(index, -1)"
          >
            <i class="bi bi-arrow-up" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="btn btn-sm btn-light"
            :disabled="index === rows.length - 1"
            :aria-label="'Bajar el campo ' + (index + 1)"
            title="Bajar"
            @click="move_row(index, 1)"
          >
            <i class="bi bi-arrow-down" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="btn btn-sm btn-light pl-fields__remove"
            :aria-label="'Quitar el campo ' + (index + 1)"
            title="Quitar"
            @click="remove_row(index)"
          >
            <i class="bi bi-trash" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div v-if="row.type === 'select'" class="pl-fields__options">
        <label class="form-label mb-1" :for="'pl-field-options-' + row.uid">Opciones (una por línea)</label>
        <textarea
          :id="'pl-field-options-' + row.uid"
          v-model="row.options_text"
          rows="3"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': has_error(index, 'options') }"
        />
      </div>

      <div v-for="message in row_errors(index)" :key="message" class="invalid-feedback d-block">{{ message }}</div>
    </div>

    <button type="button" class="btn btn-outline-secondary btn-sm" @click="add_row">
      <i class="bi bi-plus-lg me-1" aria-hidden="true" />Agregar campo
    </button>
  </div>
</template>

<script>
import { DATE_FIELD_TYPES, new_field_row } from '@/components/pipeline/pipeline_helpers'

/**
 * Editor de campos. Trabaja sobre su propia copia de las filas (tomada al montarse) y avisa cada
 * cambio con `update:modelValue`; el padre lo monta de nuevo (v-if + key) por cada etapa que abre.
 */
export default {
  name: 'PipelineStageFieldsEditor',
  props: {
    /** Filas editables (`field_rows_from_definition` de pipeline_helpers). */
    modelValue: { type: Array, default: function () { return [] } },
    /** Tipos de campo que publica el back: `[{ value, label }]`. */
    field_types: { type: Array, default: function () { return [] } },
    /** `errors` del último 422 al guardar la etapa (claves `fields.<i>.<propiedad>`). */
    errors: { type: Object, default: function () { return {} } },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      /** Copia local de las filas: se edita acá y se avisa hacia arriba. */
      rows: this.modelValue.map(function (row) {
        return Object.assign({}, row)
      }),
    }
  },
  computed: {
    /**
     * Errores de la definición que no son de una fila puntual (ej. "a lo sumo un campo agenda",
     * "máximo 20 campos"), según cómo los nombre el back.
     * @returns {Array<string>}
     */
    general_errors() {
      const errors = this.errors || {}
      const messages = []
      Object.keys(errors).forEach(function (key) {
        const is_about_fields = key === 'fields' || key.indexOf('fields.') === 0
        const is_row_specific = /^fields\.\d+(\.|$)/.test(key)
        if (!is_about_fields || is_row_specific) {
          return
        }
        const value = errors[key]
        const list = Array.isArray(value) ? value : [value]
        list.forEach(function (message) {
          if (message && messages.indexOf(String(message)) === -1) {
            messages.push(String(message))
          }
        })
      })
      return messages
    },
  },
  watch: {
    rows: {
      deep: true,
      handler(value) {
        this.$emit('update:modelValue', value.slice())
      },
    },
  },
  methods: {
    /**
     * @param {string} type
     * @returns {boolean}
     */
    is_date_type(type) {
      return DATE_FIELD_TYPES.indexOf(type) !== -1
    },
    /**
     * Opciones del selector de tipo: el catálogo del back. Si todavía no llegó, al menos el valor
     * actual, para que el selector no quede en blanco.
     *
     * @param {Object} row
     * @returns {Array<{value: string, label: string}>}
     */
    type_options(row) {
      if (this.field_types.length) {
        return this.field_types
      }
      return [{ value: row.type, label: row.type }]
    },
    /**
     * Un campo que deja de ser fecha no puede seguir marcado como agenda (el tilde se esconde).
     *
     * @param {Object} row
     */
    on_type_change(row) {
      if (!this.is_date_type(row.type)) {
        row.agenda = false
      }
    },
    add_row() {
      this.rows.push(new_field_row())
    },
    /**
     * @param {number} index
     */
    remove_row(index) {
      this.rows.splice(index, 1)
    },
    /**
     * @param {number} index
     * @param {number} direction -1 sube, 1 baja
     */
    move_row(index, direction) {
      const target = index + direction
      if (target < 0 || target >= this.rows.length) {
        return
      }
      const moved = this.rows.splice(index, 1)[0]
      this.rows.splice(target, 0, moved)
    },
    /**
     * Mensajes del 422 de la fila `index` (`fields.3`, `fields.3.label`, `fields.3.options.0`…).
     *
     * @param {number} index
     * @returns {Array<string>}
     */
    row_errors(index) {
      const errors = this.errors || {}
      const prefix = 'fields.' + index
      const messages = []
      Object.keys(errors).forEach(function (key) {
        if (key !== prefix && key.indexOf(prefix + '.') !== 0) {
          return
        }
        const value = errors[key]
        const list = Array.isArray(value) ? value : [value]
        list.forEach(function (message) {
          if (message && messages.indexOf(String(message)) === -1) {
            messages.push(String(message))
          }
        })
      })
      return messages
    },
    /**
     * @param {number} index
     * @param {string} prop
     * @returns {boolean}
     */
    has_error(index, prop) {
      const errors = this.errors || {}
      const prefix = 'fields.' + index + '.' + prop
      return Object.keys(errors).some(function (key) {
        return key === prefix || key.indexOf(prefix + '.') === 0
      })
    },
  },
}
</script>

<style scoped>
.pl-fields__empty {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.pl-fields__row {
  padding: 0.75rem;
  margin-bottom: 0.6rem;
  background: var(--bg-section);
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
}

.pl-fields__row--error {
  border-color: var(--bs-danger-border-subtle);
}

.pl-fields__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 12rem);
  gap: 0.5rem;
}

@media (max-width: 575.98px) {
  .pl-fields__main {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pl-fields__flags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin-top: 0.5rem;
}

.pl-fields__key {
  font-family: var(--bs-font-monospace);
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  background: var(--bg-card);
  border: 1px solid var(--color-border-secondary);
  border-radius: 6px;
  padding: 0.05rem 0.35rem;
}

.pl-fields__row-actions {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.pl-fields__row-actions .btn {
  padding: 0.15rem 0.45rem;
  border: 1px solid var(--color-border-secondary);
}

.pl-fields__remove:hover {
  color: var(--bs-danger);
}

.pl-fields__options {
  margin-top: 0.5rem;
}
</style>
