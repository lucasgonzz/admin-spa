<template>
  <div class="mb-2">
    <label class="form-label">{{ field.text || 'Valor' }}</label>
    <select ref="first_input" v-model="draft.igual_que" class="form-select" :disabled="loading_relation_options">
      <option :value="null">—</option>
      <template v-if="has_option_groups">
        <optgroup v-for="group in grouped_resolved_options" :key="group.name" :label="group.name">
          <option v-for="o in group.options" :key="o.value" :value="o.value">{{ o.text }}</option>
        </optgroup>
      </template>
      <template v-else>
        <option v-for="o in resolved_options" :key="o.value" :value="o.value">{{ o.text }}</option>
      </template>
    </select>
    <div v-if="loading_relation_options" class="form-text">Cargando opciones…</div>
  </div>
</template>

<script>
import api from '@/utils/axios'
import { route_string } from '@/utils/route_string'

/**
 * Filtro select: opciones estáticas del meta o cargadas dinámicamente por relación.
 */
export default {
  name: 'FilterSelect',
  props: {
    /** Definición meta de la columna a filtrar. */
    field: { type: Object, required: true },
    /** Borrador del criterio de filtro (mutado por v-model). */
    draft: { type: Object, required: true },
    /** Nombre del módulo Vuex / recurso padre (contexto de la grilla). */
    model_name: { type: String, default: '' },
  },
  data() {
    return {
      /** Opciones obtenidas por GET relacional cuando el meta define `relation`. */
      relation_options: [],
      /** Indica carga en curso de opciones relacionales. */
      loading_relation_options: false,
    }
  },
  computed: {
    /**
     * Opciones finales: estáticas del meta o dinámicas por relación.
     * @returns {Array<{ value: *, text: string }>}
     */
    resolved_options() {
      if (this.field.options && this.field.options.length > 0) {
        return this.field.options
      }
      return this.relation_options
    },
    /**
     * Indica si alguna opción tiene grupo visual (optgroup).
     * @returns {boolean}
     */
    has_option_groups() {
      return this.resolved_options.some(function (o) { return o.group != null })
    },
    /**
     * Agrupa opciones por `group` preservando el orden de aparición.
     * @returns {Array<{ name: string, options: Array }>}
     */
    grouped_resolved_options() {
      var order = []
      var map = {}
      this.resolved_options.forEach(function (o) {
        var g = o.group || 'Otros'
        if (!map[g]) {
          map[g] = []
          order.push(g)
        }
        map[g].push(o)
      })
      return order.map(function (name) { return { name: name, options: map[name] } })
    },
  },
  watch: {
    /**
     * Recarga opciones si cambia el campo al abrir otro filtro en el mismo modal.
     * @returns {void}
     */
    field: {
      handler() {
        this.load_relation_options_if_needed()
      },
      immediate: true,
    },
  },
  methods: {
    /**
     * Enfoca el select al abrir el modal de filtro.
     * @returns {void}
     */
    focus_input() {
      const select = this.$refs.first_input
      if (select) {
        select.focus()
      }
    },
    /**
     * Dispara carga de opciones cuando el meta referencia otra entidad sin `options`.
     * @returns {void}
     */
    load_relation_options_if_needed() {
      const relation = this.field && this.field.relation
      if (!relation) {
        this.relation_options = []
        return
      }
      if (this.field.options && this.field.options.length > 0) {
        return
      }
      if (this.loading_relation_options) {
        return
      }

      this.loading_relation_options = true
      const self = this
      const label_key = this.field.relation_label || 'name'

      api
        .get('/' + route_string(relation) + '?for_select=1')
        .then(function (response) {
          const models = self.extract_models_array(response.data)
          const options = []
          models.forEach(function (model) {
            if (!model || model.id == null) {
              return
            }
            options.push({
              value: model.id,
              text: self.resolve_option_label(model, label_key),
            })
          })
          self.relation_options = options
          self.loading_relation_options = false
        })
        .catch(function () {
          self.relation_options = []
          self.loading_relation_options = false
        })
    },
    /**
     * Normaliza respuesta paginada o lista simple del API relacional.
     * @param {Object|Array} data cuerpo JSON del GET relacional.
     * @returns {Array<Object>}
     */
    extract_models_array(data) {
      if (!data) {
        return []
      }
      if (Array.isArray(data)) {
        return data
      }
      if (data.models && Array.isArray(data.models)) {
        return data.models
      }
      if (data.models && data.models.data && Array.isArray(data.models.data)) {
        return data.models.data
      }
      return []
    },
    /**
     * Resuelve el texto visible de una opción según clave del meta o fallback.
     * @param {Object} model fila del modelo relacionado.
     * @param {string} label_key atributo a mostrar.
     * @returns {string}
     */
    resolve_option_label(model, label_key) {
      if (model[label_key] != null && String(model[label_key]).trim() !== '') {
        return String(model[label_key])
      }
      if (model.name != null && String(model.name).trim() !== '') {
        return String(model.name)
      }
      return '#' + model.id
    },
  },
}
</script>
