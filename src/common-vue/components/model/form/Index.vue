<template>
  <div>
    <form v-if="form" @submit.stop.prevent>
      <!-- Grilla Bootstrap: col-lg-3 = 4 campos por fila (12/3); en md 2 por fila; en xs ancho completo. -->
      <div class="row g-3">
        <div
          v-for="p in visible_form_properties"
          :key="p.key"
          :class="field_column_class(p)"
        >
          <template v-if="is_has_many_field(p)">
            <has-many-field
              :prop="p"
              :parent_model="form"
              :parent_model_name="parent_model_name"
              @modelSaved="$emit('has-many-saved', $event)"
              @modelDeleted="$emit('has-many-deleted')"
            />
          </template>
          <template v-else-if="is_only_show_field(p)">
            <field-label-with-help :text="p.text" :description="p.description" />
            <p class="mb-0 text-body">{{ only_show_display_text(p) }}</p>
          </template>
          <template v-else>
            <div v-if="p.type === 'text'">
              <field-label-with-help :text="p.text" :description="p.description" />
              <input
                v-model="form[p.key]"
                type="text"
                class="form-control"
                :placeholder="field_placeholder(p)"
                :readonly="is_readonly_field(p)"
              />
            </div>
            <div v-else-if="p.type === 'search'">
              <field-label-with-help :text="p.text" :description="p.description" />
              <search-field
                v-model="form[p.key]"
                :relation="p.relation"
                :relation_label="p.relation_label || 'name'"
                :placeholder="search_placeholder(p)"
                :display_label="nested_display_label(p)"
                :disabled="is_readonly_field(p)"
                @selected="on_search_selected(p, $event)"
              />
            </div>
            <div v-else-if="p.type === 'textarea'">
              <field-label-with-help :text="p.text" :description="p.description" />
              <textarea
                v-model="form[p.key]"
                rows="3"
                class="form-control"
                :readonly="is_readonly_field(p)"
              ></textarea>
            </div>
            <div v-else-if="p.type === 'number'">
              <field-label-with-help :text="p.text" :description="p.description" />
              <input
                v-model.number="form[p.key]"
                type="number"
                class="form-control"
                :readonly="is_readonly_field(p)"
              />
            </div>
            <!-- Solo fecha (YYYY-MM-DD); más estable que datetime-local con Vue 3. -->
            <div v-else-if="p.type === 'day'">
              <field-label-with-help :text="p.text" :description="p.description" />
              <input
                v-model="form[p.key]"
                type="date"
                class="form-control"
                :readonly="is_readonly_field(p)"
              />
            </div>
            <div v-else-if="p.type === 'date'">
              <field-label-with-help :text="p.text" :description="p.description" />
              <!--
                datetime-local + v-model en Vue 3 con valor inicial null/ISO con Z suele no sincronizar
                bien; el usuario elige fecha pero el objeto del formulario sigue en null. Control explícito.
              -->
              <input
                :value="datetime_local_display_value(p.key)"
                type="datetime-local"
                class="form-control"
                :readonly="is_readonly_field(p)"
                @input="on_datetime_local_input(p, $event)"
                @change="on_datetime_local_input(p, $event)"
              />
            </div>
            <div v-else-if="p.type === 'select' || p.type === 'pipeline_status'">
              <field-label-with-help :text="p.text" :description="p.description" />
              <select
                v-model="form[p.key]"
                class="form-select"
                :disabled="is_readonly_field(p)"
                @change="on_select_change(p, $event)"
              >
                <template v-if="p.type === 'pipeline_status' && pipeline_options_have_groups(get_select_options(p))">
                  <optgroup
                    v-for="group in get_pipeline_grouped_options(get_select_options(p))"
                    :key="group.name"
                    :label="group.name"
                  >
                    <option
                      v-for="o in group.options"
                      :key="(o.value !== null && o.value !== undefined) ? o.value : ('empty-' + p.key)"
                      :value="o.value"
                    >
                      {{ o.text }}
                    </option>
                  </optgroup>
                </template>
                <template v-else>
                  <option
                    v-for="o in get_select_options(p)"
                    :key="(o.value !== null && o.value !== undefined) ? o.value : ('empty-' + p.key)"
                    :value="o.value"
                  >
                    {{ o.text }}
                  </option>
                </template>
              </select>
            </div>
            <div v-else-if="p.type === 'checkbox'">
              <label class="form-check-label d-flex align-items-center gap-2">
                <input
                  v-model="form[p.key]"
                  type="checkbox"
                  class="form-check-input"
                  :disabled="is_readonly_field(p)"
                />
                {{ p.text }}
              </label>
            </div>
            <div v-else-if="p.type === 'custom' && p.custom_component === 'lead_personalized_demo_videos'">
              <lead-personalized-demo-videos-editor v-model="form[p.key]" :field_label="p.text" />
            </div>
            <div v-else-if="p.type === 'custom' && p.custom_component === 'client_implementation'">
              <client-implementation-extra-props :record="form" @record-updated="on_client_implementation_updated" />
            </div>
            <div v-else-if="p.type === 'custom' && p.custom_component === 'client_ecommerce_urls'">
              <client-ecommerce-urls :record="form" />
            </div>
          </template>
        </div>
      </div>
    </form>
  </div>
</template>

<script>
import SearchField from '@/common-vue/components/search/Index.vue'
import LeadPersonalizedDemoVideosEditor from '@/components/lead/PersonalizedDemoVideosEditor.vue'
import ClientImplementationExtraProps from '@/components/client/extra-props/Index.vue'
import ClientEcommerceUrls from '@/components/client/ClientEcommerceUrls.vue'
import HasManyField from '@/common-vue/components/model/form/HasMany.vue'
import FieldLabelWithHelp from '@/common-vue/components/model/form/FieldLabelWithHelp.vue'
import api from '@/utils/axios'
import { route_string } from '@/utils/route_string'
import { store_catalog_relations } from '@/utils/store_catalog_relations'

/**
 * Formulario estándar del modal: solo tipos declarativos (text, select, etc.) según meta.
 * `type: day` → `input type="date"` (solo calendario).
 * `type: search` (FK) usa el componente SearchField.
 * `type: custom` + `custom_component: lead_personalized_demo_videos` → editor de tutoriales del mail demo.
 * `type: custom` + `custom_component: client_ecommerce_urls` → sección "Tienda online (ecommerce)" (URLs SPA/API).
 * `type: has_many` o propiedad con bloque `has_many` → tabla + modal anidado (`form/HasMany.vue`).
 * Filas del meta solo con `group_title` (sin `key`) agrupan campos.
 * El tablist de navegación se renderiza en `model/Index.vue` y aquí se recibe el grupo activo.
 * `only_show`: etiqueta + valor como texto en `<p>` (sin input).
 * `exclude_on_update` sin `only_show`: sigue como control deshabilitado o solo lectura.
 * `from_has_many`: select FK alimentado solo con hijos persistidos del has_many del draft padre.
 * `from_parent_field`: select FK cuyas opciones se cargan desde un recurso padre (ej. client_apis del client_id).
 * `description`: texto de ayuda bajo la etiqueta (FieldLabelWithHelp).
 * `placeholder`: hint opcional en inputs de texto.
 * Layout: fila Bootstrap (`row g-3`) con columnas `col-lg-3` (cuatro campos por fila en lg+).
 */
export default {
  name: 'ModelForm',
  components: { SearchField, LeadPersonalizedDemoVideosEditor, ClientImplementationExtraProps, ClientEcommerceUrls, HasManyField, FieldLabelWithHelp },
  props: {
    form: { type: Object, default: null },
    all_properties: { type: Array, default: () => [] },
    /** Nombre del modelo padre (requerido para campos has_many). */
    parent_model_name: { type: String, default: '' },
    /** Grupo activo definido por el modal padre (`model/Index.vue`). */
    active_group_title: { type: String, default: null },
  },
  emits: ['search-selected', 'has-many-saved', 'has-many-deleted'],
  data() {
    return {
      /**
       * Cache de opciones por relación para `type: select` relacional.
       * Estructura: { [relation]: [{ value, text }] }.
       */
      relation_select_options: {},
      /**
       * Campo a mostrar por relación (configurable vía `reprecentar_model`).
       * Estructura: { [relation]: 'name' }.
       */
      relation_display_key_by_model: {},
      /**
       * Estado de carga por relación para evitar requests duplicados.
       */
      loading_relation_selects: {},
      /**
       * Opciones cacheadas para selects con `from_has_many` (key = prop.key del FK).
       */
      from_has_many_select_options: {},
      /**
       * Opciones cacheadas para selects con `from_parent_field` (key = prop.key del FK).
       */
      from_parent_field_select_options: {},
    }
  },
  watch: {
    /**
     * Recalcula dependencias de select relacional cuando cambia el meta.
     */
    all_properties: {
      handler() {
        this.load_relation_select_fields()
        this.refresh_all_from_has_many_select_options()
        this.refresh_all_from_parent_field_select_options()
        this.sync_from_has_many_selections()
      },
      deep: true,
      immediate: true,
    },
    /**
     * Recalcula opciones from_has_many / from_parent_field cuando cambia el draft.
     */
    form: {
      handler(form, old_form) {
        this.refresh_all_from_has_many_select_options()
        this.sync_from_has_many_selections()
        if (!form) {
          return
        }
        const parent_keys = this.collect_from_parent_field_parent_keys()
        let parent_changed = !old_form
        if (!parent_changed && old_form) {
          parent_keys.forEach((parent_key) => {
            if (String(form[parent_key]) !== String(old_form[parent_key])) {
              parent_changed = true
            }
          })
        }
        if (parent_changed) {
          this.refresh_all_from_parent_field_select_options()
        }
      },
      deep: true,
    },
    /**
     * Si el catálogo liviano de versiones cambia en Vuex, refresca selects relacionales abiertos.
     */
    '$store.state.version.select_catalog': {
      handler() {
        this.refresh_store_catalog_relation_options('version')
      },
      deep: true,
    },
  },
  mounted() {
    this.load_relation_select_fields()
    this.refresh_all_from_parent_field_select_options()
  },
  computed: {
    /**
     * Indica si existe al menos un separador de grupo en el meta.
     * @returns {boolean}
     */
    has_group_props() {
      let found = false
      this.all_properties.forEach((prop) => {
        if (prop && prop.group_title) {
          found = true
        }
      })
      return found
    },
    /**
     * Primer título de grupo definido; campos anteriores al primer separador se asocian a él.
     * @returns {string|null}
     */
    first_group_title() {
      let first_title = null
      this.all_properties.forEach((prop) => {
        if (!first_title && prop && prop.group_title) {
          first_title = prop.group_title
        }
      })
      return first_title
    },
    /**
     * Definiciones meta con `key` que deben aparecer en el formulario (editables o solo lectura).
     * @returns {Array<Object>}
     */
    form_properties() {
      const self = this
      return this.all_properties.filter((p) => {
        return self.is_form_field(p) && p.show !== false
      })
    },
    /**
     * Campos a renderizar según el grupo seleccionado (incluye informativos `only_show` / `exclude_on_update`).
     * @returns {Array<Object>}
     */
    visible_form_properties() {
      if (!this.has_group_props) {
        return this.form_properties
      }
      if (!this.active_group_title) {
        return this.form_properties
      }
      const self = this
      return this.form_properties.filter((p) => {
        return self.get_group_title_for_prop(p) === self.active_group_title
      })
    },
  },
  methods: {
    /**
     * Sincroniza el borrador del cliente tras iniciar implementación (custom field).
     * @param {Object} record cliente actualizado emitido por el componente hijo.
     * @returns {void}
     */
    on_client_implementation_updated(record) {
      if (record && record.implementation && this.form) {
        this.form.implementation = record.implementation
      }
    },
    /**
     * Clase Bootstrap de columna según ancho declarado en meta.
     * @param {Object} p definición meta
     * @returns {string}
     */
    field_column_class(p) {
      if (this.is_has_many_field(p) || (p && p.full_width)) {
        return 'col-12'
      }
      return 'col-12 col-md-6 col-lg-3'
    },
    /**
     * Campo relacional has_many embebido (tabla + CRUD anidado).
     * @param {Object|null} p definición meta
     * @returns {boolean}
     */
    is_has_many_field(p) {
      if (!p || !p.key) {
        return false
      }
      if (p.has_many && p.has_many.model_name) {
        return true
      }
      return p.type === 'has_many' && Boolean(p.has_many)
    },
    /**
     * Valor que debe mostrar `input[type=datetime-local]` (solo `YYYY-MM-DDTHH:mm` o cadena vacía).
     *
     * @param {string} key clave del campo en el formulario
     * @returns {string}
     */
    datetime_local_display_value(key) {
      if (!this.form) {
        return ''
      }
      const raw = this.form[key]
      if (raw == null || raw === '') {
        return ''
      }
      const s = String(raw).trim()
      if (s === '') {
        return ''
      }
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
        return s
      }
      const m_space = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/)
      if (m_space) {
        return m_space[1] + 'T' + m_space[2]
      }
      const m_iso = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
      if (m_iso) {
        return m_iso[1] + 'T' + m_iso[2]
      }
      return s
    },
    /**
     * Persiste en el objeto `form` (mismo referente que el draft del modal) el valor del datetime-local.
     *
     * @param {Object} p definición meta del campo (para respetar solo lectura)
     * @param {Event} event evento input/change del navegador
     * @returns {void}
     */
    on_datetime_local_input(p, event) {
      if (!this.form || !p || !p.key || this.is_readonly_field(p)) {
        return
      }
      const el = event && event.target
      const v = el && typeof el.value === 'string' ? el.value : ''
      if (v === '') {
        this.form[p.key] = null
        return
      }
      this.form[p.key] = v
    },
    /**
     * Fila del meta que representa un campo de formulario (excluye separadores solo con `group_title`).
     * @param {Object|null} p definición meta
     * @returns {boolean}
     */
    is_form_field(p) {
      if (!p || !p.key) {
        return false
      }
      if (p.table_only) {
        return false
      }
      if (p.group_title) {
        return false
      }
      return true
    },
    /**
     * Campos que el usuario puede modificar (no informativos ni excluidos de actualización en meta).
     * @param {Object|null} p definición meta
     * @returns {boolean}
     */
    is_editable_field(p) {
      if (!this.is_form_field(p)) {
        return false
      }
      if (p.only_show) {
        return false
      }
      if (p.exclude_on_update) {
        return false
      }
      return true
    },
    /**
     * Mostrar en el formulario pero sin permitir edición vía input (p. ej. id con solo `exclude_on_update`).
     * @param {Object|null} p definición meta
     * @returns {boolean}
     */
    is_readonly_field(p) {
      return this.is_form_field(p) && !this.is_editable_field(p)
    },
    /**
     * Campo informativo: se renderiza como texto plano, no como control.
     * @param {Object|null} p definición meta
     * @returns {boolean}
     */
    is_only_show_field(p) {
      return Boolean(p && p.only_show && this.is_form_field(p))
    },
    /**
     * Texto visible para campos `only_show` según tipo y valor actual del formulario.
     * @param {Object} p definición meta
     * @returns {string}
     */
    only_show_display_text(p) {
      if (!this.form || !p || !p.key) {
        return '—'
      }
      const raw = this.form[p.key]
      if (p.type === 'checkbox') {
        return raw ? 'Sí' : 'No'
      }
      if (p.type === 'select' || p.type === 'pipeline_status') {
        const options = this.get_select_options(p)
        let matched_text = ''
        options.forEach((o) => {
          if (o.value == raw) {
            matched_text = o.text
          }
        })
        if (matched_text) {
          return matched_text
        }
        if (raw != null && raw !== '') {
          return String(raw)
        }
        return '—'
      }
      if (p.type === 'search') {
        const nested = this.nested_display_label(p)
        if (nested) {
          return nested
        }
        if (raw != null && raw !== '') {
          return '#' + String(raw)
        }
        return '—'
      }
      if (raw == null || raw === '') {
        return '—'
      }
      return String(raw)
    },
    /**
     * Grupo efectivo de un campo según el orden del meta y los separadores `group_title`.
     * @param {Object} target_prop
     * @returns {string|null}
     */
    get_group_title_for_prop(target_prop) {
      if (!this.has_group_props || !target_prop) {
        return null
      }
      let current_group_title = null
      let group_title_for_prop = null
      this.all_properties.forEach((prop) => {
        if (prop && prop.group_title) {
          current_group_title = prop.group_title
          return
        }
        if (prop === target_prop) {
          group_title_for_prop = current_group_title
        }
      })
      if (!group_title_for_prop) {
        return this.first_group_title
      }
      return group_title_for_prop
    },
    /**
     * Placeholder del campo search según relación indicada en meta (API ModelProperties).
     * @param {Object} p definición de propiedad
     * @returns {string}
     */
    search_placeholder(p) {
      if (p.relation) {
        return 'Buscar ' + (p.relation || '') + '…'
      }
      return 'Buscar…'
    },
    /**
     * Placeholder opcional declarado en meta (`placeholder`) para inputs de texto.
     *
     * @param {Object} p definición de propiedad
     * @returns {string}
     */
    field_placeholder(p) {
      if (p && p.placeholder != null && String(p.placeholder).trim() !== '') {
        return String(p.placeholder)
      }
      return ''
    },
    /**
     * Carga opciones dinámicas para todos los campos select con relation.
     *
     * @returns {void}
     */
    load_relation_select_fields() {
      const self = this
      this.all_properties.forEach((property) => {
        if (!property || property.type !== 'select') {
          return
        }
        if (property.from_has_many && property.from_has_many.collection_key) {
          self.refresh_from_has_many_select_option(property)
          return
        }
        if (self.is_from_parent_field_select(property)) {
          return
        }
        if (!property.relation) {
          return
        }
        self.load_relation_select_options(property)
      })
    },
    /**
     * Indica si el select toma opciones de una colección has_many del draft padre.
     *
     * @param {Object|null} property definición meta
     * @returns {boolean}
     */
    is_from_has_many_select(property) {
      return Boolean(
        property
        && property.from_has_many
        && property.from_has_many.collection_key
      )
    },
    /**
     * Indica si el select toma opciones de un recurso padre referenciado por otro FK del draft.
     *
     * @param {Object|null} property definición meta
     * @returns {boolean}
     */
    is_from_parent_field_select(property) {
      return Boolean(
        property
        && property.from_parent_field
        && property.from_parent_field.parent_key
        && property.from_parent_field.collection_key
      )
    },
    /**
     * Lista de parent_key usados por propiedades from_parent_field del meta actual.
     *
     * @returns {Array<string>}
     */
    collect_from_parent_field_parent_keys() {
      const keys = []
      const self = this
      this.all_properties.forEach((property) => {
        if (!self.is_from_parent_field_select(property)) {
          return
        }
        const parent_key = property.from_parent_field.parent_key
        if (keys.indexOf(parent_key) === -1) {
          keys.push(parent_key)
        }
      })
      return keys
    },
    /**
     * Recarga opciones de todos los selects `from_parent_field`.
     *
     * @returns {void}
     */
    refresh_all_from_parent_field_select_options() {
      const self = this
      this.all_properties.forEach((property) => {
        if (self.is_from_parent_field_select(property)) {
          self.refresh_from_parent_field_select_option(property)
        }
      })
    },
    /**
     * GET al recurso padre (ej. client) y arma opciones desde su colección has_many.
     *
     * @param {Object} property definición meta del FK
     * @returns {void}
     */
    refresh_from_parent_field_select_option(property) {
      const self = this
      const config = property.from_parent_field || {}
      const parent_key = config.parent_key
      const parent_id = this.form && parent_key ? this.form[parent_key] : null

      if (!parent_id) {
        this.from_parent_field_select_options = Object.assign({}, this.from_parent_field_select_options, {
          [property.key]: [{ value: null, text: '—' }],
        })
        if (this.form && property.key && !this.form.id) {
          this.form[property.key] = null
        }
        return
      }

      const fetch_resource = config.fetch_resource || 'client'
      api
        .get('/' + fetch_resource + '/' + parent_id)
        .then(function (res) {
          const parent_model = res.data && res.data.model ? res.data.model : null
          const collection_key = config.collection_key
          const collection = parent_model && collection_key ? parent_model[collection_key] : []
          const active_api_id = parent_model ? parent_model.active_client_api_id : null
          const options = [{ value: null, text: '—' }]

          if (Array.isArray(collection)) {
            collection.forEach(function (child) {
              if (!child || child.id == null) {
                return
              }
              options.push({
                value: child.id,
                text: self.build_from_parent_field_option_label(child, config),
              })
            })
          }

          self.from_parent_field_select_options = Object.assign({}, self.from_parent_field_select_options, {
            [property.key]: options,
          })

          if (!self.form || !property.key) {
            return
          }

          const is_create = !self.form.id
          if (is_create && config.default_other_than_active) {
            const default_id = self.pick_default_target_api_id(collection, active_api_id)
            if (default_id != null) {
              self.form[property.key] = default_id
              if (property.relation && Array.isArray(collection)) {
                collection.forEach(function (child) {
                  if (child && String(child.id) === String(default_id)) {
                    self.form[property.relation] = child
                  }
                })
              }
            }
          }
        })
        .catch(function () {
          self.from_parent_field_select_options = Object.assign({}, self.from_parent_field_select_options, {
            [property.key]: [{ value: null, text: '—' }],
          })
        })
    },
    /**
     * Etiqueta visible de una ClientApi en el select (url + path opcional).
     *
     * @param {Object} child registro hijo (ClientApi)
     * @param {Object} config bloque from_parent_field del meta
     * @returns {string}
     */
    build_from_parent_field_option_label(child, config) {
      const label_key = config.label_key || 'url'
      let text = child[label_key] != null ? String(child[label_key]) : ''
      if (child.path) {
        text = text + ' (' + child.path + ')'
      }
      return text || ('API #' + child.id)
    },
    /**
     * Primera API distinta de active_client_api_id; si solo hay una, esa.
     *
     * @param {Array<Object>} apis colección client_apis
     * @param {number|string|null} active_api_id
     * @returns {number|null}
     */
    pick_default_target_api_id(apis, active_api_id) {
      let fallback_id = null
      if (!Array.isArray(apis)) {
        return null
      }
      let i = 0
      for (i = 0; i < apis.length; i++) {
        const api = apis[i]
        if (!api || api.id == null) {
          continue
        }
        const api_id = api.id
        if (fallback_id == null) {
          fallback_id = api_id
        }
        if (active_api_id == null || String(api_id) !== String(active_api_id)) {
          return api_id
        }
      }
      return fallback_id
    },
    /**
     * Recalcula opciones de todos los selects `from_has_many` del meta actual.
     *
     * @returns {void}
     */
    refresh_all_from_has_many_select_options() {
      const self = this
      this.all_properties.forEach((property) => {
        if (self.is_from_has_many_select(property)) {
          self.refresh_from_has_many_select_option(property)
        }
      })
    },
    /**
     * Construye y cachea opciones del select desde el array has_many del draft.
     *
     * @param {Object} property definición meta del FK
     * @returns {Array<{value: (string|number|null), text: string}>}
     */
    refresh_from_has_many_select_option(property) {
      /** Opciones resultantes para el bind del select. */
      const options = this.build_from_has_many_select_options(property)
      this.from_has_many_select_options = Object.assign({}, this.from_has_many_select_options, {
        [property.key]: options,
      })
      return options
    },
    /**
     * Arma opciones del select leyendo hijos persistidos del draft padre.
     *
     * @param {Object} property definición meta del FK
     * @returns {Array<{value: (string|number|null), text: string}>}
     */
    build_from_has_many_select_options(property) {
      /** Bloque declarativo from_has_many del meta. */
      const config = property.from_has_many || {}
      /** Si true, incluye opción vacía al inicio (default true). */
      const allow_empty = config.allow_empty !== false
      /** Key del array has_many en el draft (ej. client_apis). */
      const collection_key = config.collection_key
      /** Campo del hijo usado como etiqueta visible. */
      const label_key = config.label_key || property.relation_label || 'name'
      /** Opciones normalizadas para el select. */
      const options = []

      if (allow_empty) {
        options.push({
          value: null,
          text: '—',
        })
      }

      /** Colección has_many cargada en el borrador del modal padre. */
      const collection = this.form && collection_key ? this.form[collection_key] : []
      if (Array.isArray(collection)) {
        collection.forEach((child) => {
          if (!child || child.id == null) {
            return
          }
          options.push({
            value: child.id,
            text: this.resolve_option_label(child, label_key),
          })
        })
      }

      return options
    },
    /**
     * Limpia FK huérfanos y sincroniza objetos anidados de relación en el draft.
     *
     * @returns {void}
     */
    sync_from_has_many_selections() {
      const self = this
      if (!this.form) {
        return
      }
      this.all_properties.forEach((property) => {
        if (!self.is_from_has_many_select(property) || !property.key) {
          return
        }
        /** Id FK actualmente seleccionado en el draft. */
        const selected_id = self.form[property.key]
        if (selected_id == null || selected_id === '') {
          if (property.relation) {
            self.form[property.relation] = null
          }
          return
        }

        /** Array has_many del padre referenciado por collection_key. */
        const collection_key = property.from_has_many.collection_key
        const collection = self.form[collection_key] || []
        /** Hijo que coincide con el FK seleccionado. */
        let matched_child = null

        if (Array.isArray(collection)) {
          collection.forEach((child) => {
            if (child && child.id != null && String(child.id) === String(selected_id)) {
              matched_child = child
            }
          })
        }

        if (!matched_child) {
          self.form[property.key] = null
          if (property.relation) {
            self.form[property.relation] = null
          }
          return
        }

        if (property.relation) {
          self.form[property.relation] = matched_child
        }
      })
    },
    /**
     * Indica si las opciones de pipeline_status tienen grupo visual.
     *
     * @param {Array} options opciones del select
     * @returns {boolean}
     */
    pipeline_options_have_groups(options) {
      if (!options || !options.length) {
        return false
      }
      return options.some(function (o) { return o.group != null })
    },
    /**
     * Agrupa opciones de pipeline_status por `group` preservando orden de aparición.
     *
     * @param {Array} options opciones del select
     * @returns {Array<{ name: string, options: Array }>}
     */
    get_pipeline_grouped_options(options) {
      if (!options) {
        return []
      }
      var order = []
      var map = {}
      options.forEach(function (o) {
        var g = o.group || 'Otros'
        if (!map[g]) {
          map[g] = []
          order.push(g)
        }
        map[g].push(o)
      })
      return order.map(function (name) { return { name: name, options: map[name] } })
    },
    /**
     * Sincroniza el objeto anidado de relación al cambiar un select from_has_many.
     *
     * @param {Object} p definición meta del campo
     * @param {Event} event evento change del select
     * @returns {void}
     */
    on_select_change(p, event) {
      if (!this.is_from_has_many_select(p) || !this.form || !p.relation) {
        return
      }
      /** Valor elegido en el select (id del hijo o vacío). */
      const el = event && event.target
      const selected_value = el && typeof el.value !== 'undefined' ? el.value : null
      if (selected_value === '' || selected_value == null) {
        this.form[p.relation] = null
        return
      }

      /** Colección has_many del draft padre. */
      const collection_key = p.from_has_many.collection_key
      const collection = this.form[collection_key] || []
      /** Hijo seleccionado para poblar form[relation]. */
      let matched_child = null

      if (Array.isArray(collection)) {
        collection.forEach((child) => {
          if (child && child.id != null && String(child.id) === String(selected_value)) {
            matched_child = child
          }
        })
      }

      this.form[p.relation] = matched_child
    },
    /**
     * Devuelve opciones para un select.
     * - Si es relacional, retorna opciones cacheadas desde API.
     * - Si no es relacional, conserva las opciones estáticas declaradas.
     *
     * @param {Object} property definición meta del campo
     * @returns {Array<{value: (string|number|null), text: string}>}
     */
    get_select_options(property) {
      if (this.is_from_has_many_select(property)) {
        if (this.from_has_many_select_options[property.key]) {
          return this.from_has_many_select_options[property.key]
        }
        return this.build_from_has_many_select_options(property)
      }
      if (this.is_from_parent_field_select(property)) {
        if (this.from_parent_field_select_options[property.key]) {
          return this.from_parent_field_select_options[property.key]
        }
        return [{ value: null, text: '—' }]
      }
      if (property && property.relation) {
        if (this.relation_select_options[property.relation]) {
          return this.relation_select_options[property.relation]
        }
        return []
      }
      return property && property.options ? property.options : []
    },
    /**
     * Carga modelos relacionados y los transforma en opciones para select.
     *
     * @param {Object} property definición meta del campo
     * @returns {void}
     */
    load_relation_select_options(property) {
      const relation = property.relation
      if (!relation) {
        return
      }
      /** Catálogo global precargado (p. ej. versiones al iniciar sesión). */
      const catalog_config = store_catalog_relations[relation]
      if (catalog_config) {
        this.load_store_catalog_relation_options(property, catalog_config)
        return
      }
      if (this.loading_relation_selects[relation]) {
        return
      }
      if (Object.prototype.hasOwnProperty.call(this.relation_select_options, relation)) {
        return
      }

      this.loading_relation_selects[relation] = true

      const self = this
      let relation_display_key = this.relation_display_key_by_model[relation]

      api
        .get('/meta/' + route_string(relation))
        .then((meta_response) => {
          if (!relation_display_key) {
            relation_display_key = self.get_relation_display_key_from_meta(meta_response.data)
            self.relation_display_key_by_model[relation] = relation_display_key
          }

          return api.get('/' + route_string(relation) + '?for_select=1')
        })
        .then((models_response) => {
          /** Opciones normalizadas para bind del select. */
          const options = []
          /** Modelos de relación, soportando respuesta simple o paginada. */
          const models = self.extract_models_array(models_response.data)

          models.forEach((model) => {
            /** Valor que se persiste en el campo FK. */
            const option_value = model && model.id != null ? model.id : null
            /** Texto visible: relation_label del meta del campo tiene prioridad (ej. version). */
            const option_label_key = property.relation_label || relation_display_key
            const option_text = self.resolve_option_label(model, option_label_key)
            options.push({
              value: option_value,
              text: option_text,
            })
          })

          self.relation_select_options = Object.assign({}, self.relation_select_options, {
            [relation]: options,
          })
          self.loading_relation_selects[relation] = false
        })
        .catch(() => {
          /** No cachear [] en error: permite reintentar si el meta/form vuelve a disparar la carga. */
          self.loading_relation_selects[relation] = false
        })
    },
    /**
     * Arma opciones de select desde catálogo Vuex (sin GET relacional por modal).
     *
     * @param {Object} property definición meta del campo
     * @param {Object} catalog_config entrada de store_catalog_relations
     * @returns {void}
     */
    load_store_catalog_relation_options(property, catalog_config) {
      const self = this
      const relation = property.relation
      if (!relation || !catalog_config || !catalog_config.store_module) {
        return
      }
      if (this.loading_relation_selects[relation]) {
        return
      }
      this.loading_relation_selects[relation] = true

      this.$store
        .dispatch(catalog_config.store_module + '/' + catalog_config.load_action)
        .then(function () {
          self.apply_store_catalog_relation_options(property, catalog_config)
          self.loading_relation_selects[relation] = false
        })
        .catch(function () {
          self.loading_relation_selects[relation] = false
        })
    },
    /**
     * Mapea filas del catálogo Vuex a opciones del select relacional.
     *
     * @param {Object} property definición meta del campo
     * @param {Object} catalog_config entrada de store_catalog_relations
     * @returns {void}
     */
    apply_store_catalog_relation_options(property, catalog_config) {
      const relation = property.relation
      if (!relation || !catalog_config || !catalog_config.store_module) {
        return
      }
      /** Módulo Vuex que contiene select_catalog. */
      const store_module = this.$store.state[catalog_config.store_module]
      if (!store_module || !Array.isArray(store_module.select_catalog)) {
        return
      }
      /** Key de etiqueta declarada en meta (p. ej. version). */
      const option_label_key = property.relation_label || 'version'
      /** Opciones normalizadas para el `<select>`. */
      const options = []
      store_module.select_catalog.forEach(function (model) {
        if (!model || model.id == null) {
          return
        }
        options.push({
          value: model.id,
          text: model[option_label_key] != null ? String(model[option_label_key]) : ('ID ' + String(model.id)),
        })
      })
      this.relation_select_options = Object.assign({}, this.relation_select_options, {
        [relation]: options,
      })
    },
    /**
     * Refresca opciones de una relación servida por catálogo Vuex.
     *
     * @param {string} relation nombre de relación en meta
     * @returns {void}
     */
    refresh_store_catalog_relation_options(relation) {
      const catalog_config = store_catalog_relations[relation]
      if (!catalog_config) {
        return
      }
      const self = this
      this.all_properties.forEach(function (property) {
        if (!property || property.type !== 'select' || property.relation !== relation) {
          return
        }
        self.apply_store_catalog_relation_options(property, catalog_config)
      })
    },
    /**
     * Obtiene la key de representación desde model properties del recurso.
     *
     * Regla:
     * - Si hay una property con `reprecentar_model = true`, se usa su key.
     * - Si no, se usa `name` por defecto.
     *
     * @param {Object} meta_payload payload de `/meta/{relation}`
     * @returns {string}
     */
    get_relation_display_key_from_meta(meta_payload) {
      let display_key = 'name'
      if (!meta_payload || !meta_payload.properties) {
        return display_key
      }

      meta_payload.properties.forEach((property) => {
        if (property && property.reprecentar_model === true && property.key) {
          display_key = property.key
        }
      })

      return display_key
    },
    /**
     * Normaliza respuesta de listado para trabajar con modelos de relación.
     *
     * @param {Object} payload respuesta de API
     * @returns {Array<Object>}
     */
    extract_models_array(payload) {
      if (!payload || !payload.models) {
        return []
      }
      if (Array.isArray(payload.models)) {
        return payload.models
      }
      if (payload.models.data && Array.isArray(payload.models.data)) {
        return payload.models.data
      }
      return []
    },
    /**
     * Resuelve el texto visible por opción de select.
     *
     * @param {Object} model registro relacionado
     * @param {string} relation_display_key key a usar como etiqueta
     * @returns {string}
     */
    resolve_option_label(model, relation_display_key) {
      if (!model) {
        return ''
      }
      if (relation_display_key && model[relation_display_key] != null) {
        return String(model[relation_display_key])
      }
      if (model.name != null) {
        return String(model.name)
      }
      if (model.id != null) {
        return 'ID ' + String(model.id)
      }
      return 'Sin nombre'
    },
    /**
     * Texto a mostrar si el form trae el objeto de relación cargado (p. ej. al editar con withAll).
     * @param {Object} p definición de propiedad
     * @returns {string}
     */
    nested_display_label(p) {
      const rel = p.relation
      if (!rel || !this.form[rel]) {
        return ''
      }
      const k = p.relation_label || 'name'
      const o = this.form[rel]
      return o[k] != null && o[k] !== undefined ? String(o[k]) : ''
    },
    /**
     * Fila elegida en el SearchModal: opcional reemplazo del objeto de relación en el form.
     * @param {Object} p propiedad meta
     * @param {Object} model registro del API
     * @returns {void}
     */
    on_search_selected(p, model) {
      const rel = p.relation
      if (rel && this.form) {
        this.form[rel] = model
      }
      this.$emit('search-selected', p, model)
    },
  },
}
</script>
