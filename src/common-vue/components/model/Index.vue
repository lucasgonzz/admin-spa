<template>
  <base-modal
    :show="open"
    :title="title"
    size="xl"
    :stack_level="from_has_many ? 1 : 0"
    @update:show="on_modal_show"
    @close="$emit('close')"
  >
    <div v-if="fetching_record" class="text-center py-5" role="status" aria-live="polite">
      <span class="spinner-border text-primary" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando registro…</p>
    </div>
    <template v-else-if="draft">
      <template v-if="show_properties_nav">
        <ul class="nav nav-tabs mb-3" role="tablist">
          <li
            v-for="item in properties_nav_items"
            :key="item.key"
            class="nav-item"
            role="presentation"
          >
            <button
              type="button"
              class="nav-link"
              :class="{ active: active_tab === item.key }"
              @click="active_tab = item.key"
            >
              {{ item.label }}
            </button>
          </li>
        </ul>
        <div v-show="should_show_group_form">
          <model-form
            :form="draft"
            :all_properties="all_properties"
            :active_group_title="active_group_title"
            :parent_model_name="effective_parent_model_name"
          />
        </div>
        <div
          v-for="t in extra_tabs"
          v-show="active_tab === ('extra:' + t.key)"
          :key="'extra-pane-' + t.key"
        >
          <component
            v-if="t.component"
            :is="t.component"
            v-bind="extra_tab_scope"
            @record-updated="on_extra_record_updated"
          />
          <slot
            v-else
            :name="'model-extra-' + t.key"
            v-bind="extra_tab_scope"
          />
        </div>
      </template>
      <model-form
        v-else
        :form="draft"
        :all_properties="all_properties"
        :parent_model_name="effective_parent_model_name"
      />
    </template>
    <template #footer>
      <div class="d-flex w-100 align-items-center flex-wrap gap-2">
        <button
          v-if="can_delete"
          type="button"
          class="btn btn-danger"
          :disabled="saving || deleting || fetching_record"
          @click="on_delete"
        >
          {{ deleting ? 'Eliminando...' : 'Eliminar' }}
        </button>
        <div class="ms-auto d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-secondary" :disabled="deleting || fetching_record" @click="on_footer_close">
            Cerrar
          </button>
          <button type="button" class="btn btn-primary" :disabled="saving || deleting || fetching_record || !draft" @click="on_save">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </template>
  </base-modal>
</template>

<script>
import api from '@/utils/axios'
import { route_string } from '@/utils/route_string'
import ModelForm from './form/Index.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Modal CRUD: crea o actualiza vía API admin.
 * Navegación única de propiedades en este componente (grupos + extras).
 * Se muestra únicamente cuando el meta del modelo declara al menos un `group_title`.
 * Pestañas extra: prop `extra_tabs` desde ResourceView (`key`, `label`, `component` opcional y slot `model-extra-${key}`).
 * Eliminar usa la acción Vuex `delete_model` del módulo `model_name` (definida en `__base_store.js`).
 * En el formulario (`form/Index.vue`), las properties `type: 'search'` usan `search/Index.vue` (SearchField).
 */
export default {
  name: 'ModelModal',
  components: { ModelForm, BaseModal },
  props: {
    show: { type: Boolean, default: false },
    model_name: { type: String, required: true },
    all_properties: { type: Array, default: () => [] },
    /** registro a editar; null = alta */
    record: { type: Object, default: null },
    /**
     * Segmento de URL del recurso en admin-api si difiere del `model_name` (ej. `protocol-entry`).
     */
    api_resource_path: { type: String, default: '' },
    /**
     * Pestañas adicionales (Básico + estas). Sin `component`, el contenido viene del scoped slot homónimo.
     * @type {Array<{ key: string, label: string, component?: Object }>}
     */
    extra_tabs: { type: Array, default: () => [] },
    /** Modal hijo abierto desde un campo has_many del formulario padre. */
    from_has_many: { type: Boolean, default: false },
    /** Borrador del modelo padre (Client, etc.). */
    has_many_parent_model: { type: Object, default: null },
    /** Nombre del modelo padre en meta/Vuex. */
    has_many_parent_model_name: { type: String, default: '' },
    /** Propiedad meta del padre que declara la relación has_many. */
    has_many_prop: { type: Object, default: null },
    /**
     * Hook opcional ejecutado antes de crear (POST) un registro nuevo.
     * Recibe el payload y debe devolver una Promise.
     * Si resuelve, el guardado continúa; si rechaza, se cancela sin mostrar error.
     * Solo aplica al flujo de creación (no a edición/actualización).
     *
     * @type {Function|null}
     */
    before_create: { type: Function, default: null },
  },
  emits: ['close', 'saved', 'deleted', 'update:show', 'extra-record-updated'],
  data() {
    return {
      open: false,
      draft: null,
      saving: false,
      deleting: false,
      /** Pestaña activa: `group:<name>` o `extra:<key>`. */
      active_tab: null,
      /** Registro completo obtenido al abrir edición (p. ej. versión con relaciones). */
      fetched_record: null,
      /** true mientras se descarga el detalle completo antes de armar el borrador. */
      fetching_record: false,
    }
  },
  computed: {
    /**
     * Path HTTP del recurso (POST/PUT), alineado a `__base_store` cuando `api_resource_path` está seteado.
     * @returns {string}
     */
    resource_http_segment() {
      if (this.api_resource_path && String(this.api_resource_path).trim() !== '') {
        return String(this.api_resource_path).replace(/^\//, '')
      }
      return route_string(this.model_name)
    },
    /**
     * Nombre del modelo padre para campos has_many en el formulario.
     * @returns {string}
     */
    effective_parent_model_name() {
      if (this.from_has_many && this.has_many_parent_model_name) {
        return this.has_many_parent_model_name
      }
      return this.model_name
    },
    /**
     * Configuración has_many cuando este modal es hijo anidado.
     * @returns {Object}
     */
    has_many_config() {
      if (this.has_many_prop && this.has_many_prop.has_many) {
        return this.has_many_prop.has_many
      }
      return {}
    },
    /** Solo edición: al crear aún no hay registro en servidor. */
    can_delete() {
      if (!this.draft) {
        return false
      }
      if (this.from_has_many) {
        const child_key = this.has_many_config.child_route_key || 'id'
        return Boolean(this.draft.id || this.draft[child_key])
      }
      return Boolean(this.draft.id)
    },
    title() {
      const hm = this.has_many_config
      const label = hm.text || this.model_name.replace(/_/g, ' ')
      if (this.record && (this.record.id || this.record.uuid)) {
        return 'Editar ' + label
      }
      return 'Nuevo ' + label
    },
    /**
     * Detecta si el meta trae al menos un separador de grupo.
     * @returns {boolean}
     */
    has_group_props() {
      let has_groups = false
      this.all_properties.forEach((prop) => {
        if (prop && prop.group_title) {
          has_groups = true
        }
      })
      return has_groups
    },
    /**
     * Primer título de grupo definido (fallback para props previas al primer separador).
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
     * Items de grupos visibles para la barra única.
     * @returns {Array<{ key: string, label: string, type: string, group_title: string }>}
     */
    visible_group_items() {
      const visible_group_titles = []
      this.all_properties.forEach((prop) => {
        if (
          prop
          && prop.group_title
          && this.group_has_visible_props(prop.group_title)
        ) {
          const already = visible_group_titles.find((t) => t === prop.group_title)
          if (!already) {
            visible_group_titles.push(prop.group_title)
          }
        }
      })
      const group_items = []
      visible_group_titles.forEach((group_title) => {
        group_items.push({
          key: 'group:' + group_title,
          label: group_title,
          type: 'group',
          group_title,
        })
      })
      return group_items
    },
    /**
     * Barra única (grupos + extras) para propiedades del modal.
     * @returns {Array<{ key: string, label: string, type: string, group_title?: string }>}
     */
    properties_nav_items() {
      const items = []
      this.visible_group_items.forEach((group_item) => {
        items.push(group_item)
      })
      this.extra_tabs.forEach((extra_tab) => {
        items.push({
          key: 'extra:' + extra_tab.key,
          label: extra_tab.label,
          type: 'extra',
          extra_key: extra_tab.key,
        })
      })
      return items
    },
    /**
     * Mostrar barra cuando hay grupos en ModelProperties y/o pestañas extra (`extra_tabs`).
     * Sin esto, recursos con solo `model-extra` (sin `group_title`) nunca muestran la pestaña extra.
     * @returns {boolean}
     */
    show_properties_nav() {
      return (
        (this.has_group_props || this.has_extra_tabs)
        && this.properties_nav_items.length > 0
      )
    },
    /**
     * Grupo activo parseado desde `active_tab`.
     * @returns {string|null}
     */
    active_group_title() {
      if (!this.active_tab || this.active_tab.indexOf('group:') !== 0) {
        return null
      }
      return this.active_tab.substring(6)
    },
    /**
     * @returns {boolean}
     */
    is_active_tab_group() {
      return Boolean(this.active_group_title)
    },
    /**
     * Muestra el formulario de grupos cuando la pestaña activa es un grupo, o cuando no hay
     * grupos en el meta pero sí pestañas extra (evita modal solo con Extra y sin campos básicos).
     * @returns {boolean}
     */
    should_show_group_form() {
      if (this.is_active_tab_group) {
        return true
      }
      return !this.has_group_props && this.has_extra_tabs
    },
    /**
     * @returns {boolean}
     */
    has_extra_tabs() {
      return Boolean(this.extra_tabs && this.extra_tabs.length)
    },
    /**
     * Props uniformes para slots / componentes de pestañas extra.
     * `record` debe ser el borrador en edición cuando existe, no la fila original
     * de ResourceView: esa referencia no se actualiza al hacer upsert en Vuex y
     * deja la pestaña extra con datos obsoletos tras mail/setup.
     * @returns {Object}
     */
    extra_tab_scope() {
      /** Objeto lead efectivo para la pestaña extra: mismo que edita el formulario. */
      const record_for_extra = this.draft && this.draft.id ? this.draft : this.record
      return {
        draft: this.draft,
        record: record_for_extra,
        all_properties: this.all_properties,
        model_name: this.model_name,
        parent_active_tab: this.active_tab,
      }
    },
  },
  watch: {
    /**
     * Sincroniza visibilidad con el padre. `immediate: true` es necesario cuando el modal
     * hijo has_many se monta vía import async con `show` ya en true.
     */
    show: {
      immediate: true,
      handler(v) {
        this.open = v
        if (v) {
          this.prepare_draft_for_open()
        } else {
          this.fetched_record = null
          this.fetching_record = false
          this.draft = null
        }
      },
    },
    all_properties: {
      handler() {
        this.ensure_active_tab()
      },
      deep: true,
    },
  },
  methods: {
    /**
     * Fila meta que corresponde a un campo del formulario (editable o solo lectura).
     * @param {Object|null} p definición de propiedad
     * @returns {boolean}
     */
    is_form_field(p) {
      if (!p || !p.key) {
        return false
      }
      if (p.group_title) {
        return false
      }
      return true
    },
    /**
     * Campo que el usuario puede editar (excluye informativos y `exclude_on_update` en meta).
     * @param {Object|null} p definición de propiedad
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
     * Devuelve el grupo efectivo de una prop según el orden del meta.
     * @param {Object} target_prop propiedad a evaluar
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
     * Indica si un grupo tiene al menos un campo editable.
     * @param {string} group_title título de grupo
     * @returns {boolean}
     */
    group_has_visible_props(group_title) {
      if (!group_title) {
        return false
      }
      let has_visible_props = false
      const self = this
      this.all_properties.forEach((prop) => {
        if (
          !has_visible_props
          && prop
          && !prop.group_title
          && self.get_group_title_for_prop(prop) === group_title
          && self.is_form_field(prop)
        ) {
          has_visible_props = true
        }
      })
      return has_visible_props
    },
    /**
     * Mantiene pestaña activa válida para la barra única.
     * @returns {void}
     */
    ensure_active_tab() {
      if (!this.show_properties_nav) {
        this.active_tab = null
        return
      }
      const current_item = this.properties_nav_items.find((item) => item.key === this.active_tab)
      if (current_item) {
        return
      }
      this.active_tab = this.properties_nav_items[0].key
    },
    /**
     * Sincroniza visibilidad del modal con el padre al cerrar desde BaseModal.
     * @param {boolean} v nuevo valor de show.
     * @returns {void}
     */
    on_modal_show(v) {
      this.open = v
      this.$emit('update:show', v)
      if (!v) {
        this.$emit('close')
      }
    },
    /**
     * Cierra el modal desde el pie y notifica al padre.
     * @returns {void}
     */
    on_footer_close() {
      this.open = false
      this.$emit('update:show', false)
      this.$emit('close')
    },
    /**
     * Convierte fechas del API (ISO, SQL, etc.) al formato que exige `input type="datetime-local"`.
     * Sin esto el control puede quedar vacío o no actualizar el v-model y el PUT no envía la clave.
     *
     * @param {string|number|null|undefined} raw valor serializado por Laravel u otro origen
     * @returns {string|null}
     */
    to_datetime_local_for_form(raw) {
      if (raw == null || raw === '') {
        return null
      }
      const s = String(raw).trim()
      if (s === '') {
        return null
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
     * Normaliza valores de API a `YYYY-MM-DD` para `input type="date"`.
     *
     * @param {string|number|null|undefined} raw
     * @returns {string|null}
     */
    to_date_only_for_form(raw) {
      if (raw == null || raw === '') {
        return null
      }
      const s = String(raw).trim()
      if (s === '') {
        return null
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return s
      }
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
      if (m) {
        return m[1]
      }
      return s.slice(0, 10)
    },
    /**
     * Prepara el borrador al abrir el modal.
     * En Versiones edición, descarga el registro completo (seeders, comandos, etc.).
     *
     * @returns {void}
     */
    prepare_draft_for_open() {
      const self = this
      if (self.model_name === 'version' && self.record && self.record.id) {
        self.fetching_record = true
        self.fetched_record = null
        self.draft = null
        self.$store
          .dispatch('version/fetch_full_model', self.record.id)
          .then(function (model) {
            self.fetched_record = model || self.record
            self.build_draft()
            self.ensure_active_tab()
          })
          .catch(function () {
            self.fetched_record = self.record
            self.build_draft()
            self.ensure_active_tab()
          })
          .then(function () {
            self.fetching_record = false
          })
        return
      }
      if (self.model_name === 'lead' && self.record && self.record.id) {
        self.fetching_record = true
        self.fetched_record = null
        self.draft = null
        self.$store
          .dispatch('lead/fetch_full_model', self.record.id)
          .then(function (model) {
            self.fetched_record = model || self.record
            self.build_draft()
            self.ensure_active_tab()
          })
          .catch(function () {
            self.fetched_record = self.record
            self.build_draft()
            self.ensure_active_tab()
          })
          .then(function () {
            self.fetching_record = false
          })
        return
      }
      self.fetched_record = null
      self.build_draft()
      self.ensure_active_tab()
    },
    /**
     * Construye el borrador desde `record` o valores por defecto del meta.
     * En edición: asegura una clave por cada campo del meta (evita huecos en Vue 2) y normaliza fechas.
     * @returns {void}
     */
    build_draft() {
      /** Fuente de datos: detalle completo si se cargó, si no la fila del listado. */
      const source_record = this.fetched_record || this.record
      if (source_record && source_record.id) {
        const o = Object.assign({}, source_record)
        const self = this
        this.all_properties.forEach((p) => {
          if (!p.key || p.only_show) {
            return
          }
          let v
          if (Object.prototype.hasOwnProperty.call(o, p.key)) {
            v = o[p.key]
          } else {
            v = p.value !== undefined ? p.value : null
          }
          if (p.type === 'day' && v != null && v !== '') {
            v = self.to_date_only_for_form(v)
          }
          if (p.type === 'date' && v != null && v !== '') {
            v = self.to_datetime_local_for_form(v)
          }
          if (self.is_has_many_meta_field(p)) {
            if (!Array.isArray(v)) {
              v = []
            }
          }
          if (p.key === 'childrens' && !Array.isArray(v)) {
            v = []
          }
          o[p.key] = v
        })
        if (!Array.isArray(o.childrens)) {
          o.childrens = []
        }
        this.draft = o
      } else {
        const o = { id: null, childrens: [] }
        this.all_properties.forEach((p) => {
          if (!p.key || p.only_show) {
            return
          }
          if (this.is_has_many_meta_field(p)) {
            o[p.key] = []
            return
          }
          o[p.key] = p.value !== undefined ? p.value : null
        })
        this.draft = o
      }
    },
    /**
     * Indica si una fila meta representa relación has_many embebida.
     *
     * @param {Object|null} p definición meta
     * @returns {boolean}
     */
    is_has_many_meta_field(p) {
      if (!p || !p.key) {
        return false
      }
      if (p.has_many && p.has_many.model_name) {
        return true
      }
      return p.type === 'has_many' && Boolean(p.has_many)
    },
    /**
     * Arma payload del hijo has_many excluyendo claves no persistibles.
     *
     * @returns {Object}
     */
    build_has_many_child_payload() {
      const payload = {}
      const self = this
      this.all_properties.forEach(function (p) {
        if (!p || !p.key || p.only_show || p.group_title) {
          return
        }
        if (p.not_persisted_on_model) {
          return
        }
        if (!self.draft || !Object.prototype.hasOwnProperty.call(self.draft, p.key)) {
          return
        }
        payload[p.key] = self.draft[p.key]
      })
      const parent = this.has_many_parent_model || {}
      payload.model_id = parent.id != null ? parent.id : null
      return payload
    },
    /**
     * Usa rutas anidadas (`client/{uuid}/apis`) cuando el padre ya tiene identificador de ruta.
     *
     * @returns {boolean}
     */
    uses_nested_has_many_api() {
      const hm = this.has_many_config
      if (!hm.api_create_path) {
        return false
      }
      const parent = this.has_many_parent_model || {}
      const parent_key = hm.parent_route_key || 'uuid'
      const parent_value = parent[parent_key]
      return parent_value != null && parent_value !== ''
    },
    /**
     * Segmento HTTP estándar del hijo (POST/PUT directo, p. ej. client-api).
     *
     * @returns {string}
     */
    has_many_standard_http_segment() {
      const hm = this.has_many_config
      if (hm.api_store_path && String(hm.api_store_path).trim() !== '') {
        return String(hm.api_store_path).replace(/^\//, '')
      }
      return route_string(this.model_name)
    },
    /**
     * Registra referencia temporal en el padre para enlazar al persistir el Client.
     *
     * @param {Object} created_model modelo hijo devuelto por la API
     * @returns {void}
     */
    register_temporal_child_on_parent(created_model) {
      const parent = this.has_many_parent_model
      if (!parent || parent.id != null) {
        return
      }
      if (!created_model || created_model.temporal_id == null) {
        return
      }
      if (!parent.childrens || !Array.isArray(parent.childrens)) {
        parent.childrens = []
      }
      let already_registered = false
      parent.childrens.forEach(function (child_ref) {
        if (
          !already_registered
          && child_ref
          && child_ref.temporal_id != null
          && String(child_ref.temporal_id) === String(created_model.temporal_id)
        ) {
          already_registered = true
        }
      })
      if (already_registered) {
        return
      }
      parent.childrens.push({
        model_name: this.has_many_config.model_name,
        temporal_id: created_model.temporal_id,
      })
    },
    /**
     * Resuelve plantilla de ruta anidada has_many (`{parent}`, `{child}`).
     *
     * @param {string} template plantilla declarada en meta
     * @returns {string}
     */
    resolve_has_many_api_path(template) {
      if (!template) {
        return this.resource_http_segment
      }
      const hm = this.has_many_config
      const parent = this.has_many_parent_model || {}
      const child = this.draft || {}
      const parent_key = hm.parent_route_key || 'uuid'
      const child_key = hm.child_route_key || 'uuid'
      let path = template
      if (parent[parent_key] != null) {
        path = path.replace('{parent}', String(parent[parent_key]))
      }
      if (child[child_key] != null) {
        path = path.replace('{child}', String(child[child_key]))
      }
      return path.replace(/^\//, '')
    },
    /**
     * Indica si el borrador hijo ya existe en servidor (edición).
     *
     * @returns {boolean}
     */
    has_many_child_exists() {
      if (!this.draft) {
        return false
      }
      const child_key = this.has_many_config.child_route_key || 'id'
      if (this.draft.id != null) {
        return true
      }
      const child_value = this.draft[child_key]
      return child_value != null && child_value !== ''
    },
    /**
     * Fusiona el lead devuelto por acciones de la pestaña extra (mails, setups)
     * en el borrador del modal para que formulario + extra muestren el mismo estado.
     *
     * @param {Object} model payload del hijo (pestaña extra por componente).
     * @returns {void}
     */
    on_extra_record_updated(model) {
      if (model && model.id && this.draft && this.draft.id === model.id) {
        this.apply_server_model_to_draft(model)
      }
      this.$emit('extra-record-updated', model)
    },
    /**
     * Copia al borrador los campos del modelo persistido en servidor y normaliza
     * fechas según el meta (misma lógica que build_draft) para no romper inputs.
     *
     * @param {Object} model lead completo desde la API.
     * @returns {void}
     */
    apply_server_model_to_draft(model) {
      Object.assign(this.draft, model)
      const self = this
      this.all_properties.forEach((p) => {
        if (!p.key || p.only_show) {
          return
        }
        if (!Object.prototype.hasOwnProperty.call(self.draft, p.key)) {
          return
        }
        /** Valor actual tras assign, a normalizar si el meta declara fecha. */
        let v = self.draft[p.key]
        if (p.type === 'day' && v != null && v !== '') {
          v = self.to_date_only_for_form(v)
          self.draft[p.key] = v
        }
        if (p.type === 'date' && v != null && v !== '') {
          v = self.to_datetime_local_for_form(v)
          self.draft[p.key] = v
        }
      })
    },
    /**
     * Persiste el draft vía POST o PUT según exista id.
     * @returns {void}
     */
    on_save() {
      const self = this
      self.saving = true

      if (this.from_has_many && this.has_many_prop) {
        const hm = this.has_many_config
        const payload = this.build_has_many_child_payload()
        const is_update = this.has_many_child_exists()
        const self = this

        if (this.uses_nested_has_many_api()) {
          const path_template = is_update ? hm.api_update_path : hm.api_create_path
          const http_path = '/' + this.resolve_has_many_api_path(path_template)

          if (is_update) {
            api
              .put(http_path, payload)
              .then(function (res) {
                self.$emit('saved', res.data.model)
                self.open = false
                self.$emit('update:show', false)
                self.$emit('close')
                self.saving = false
              })
              .catch(function () {
                self.saving = false
              })
            return
          }

          api
            .post(http_path, payload)
            .then(function (res) {
              self.$emit('saved', res.data.model)
              self.open = false
              self.$emit('update:show', false)
              self.$emit('close')
              self.saving = false
            })
            .catch(function () {
              self.saving = false
            })
          return
        }

        const standard_segment = this.has_many_standard_http_segment()
        if (is_update && this.draft && this.draft.id != null) {
          api
            .put('/' + standard_segment + '/' + this.draft.id, payload)
            .then(function (res) {
              self.$emit('saved', res.data.model)
              self.open = false
              self.$emit('update:show', false)
              self.$emit('close')
              self.saving = false
            })
            .catch(function () {
              self.saving = false
            })
          return
        }

        api
          .post('/' + standard_segment, payload)
          .then(function (res) {
            self.register_temporal_child_on_parent(res.data.model)
            self.$emit('saved', res.data.model)
            self.open = false
            self.$emit('update:show', false)
            self.$emit('close')
            self.saving = false
          })
          .catch(function () {
            self.saving = false
          })
        return
      }

      const path = '/' + this.resource_http_segment
      // Objeto plano para el JSON: evita rarezas al serializar proxies de Vue 3 en axios.
      const payload = JSON.parse(JSON.stringify(this.draft))
      if (this.draft && this.draft.id) {
        api
          .put(path + '/' + this.draft.id, payload)
          .then((res) => {
            self.$emit('saved', res.data.model)
            self.open = false
            self.$emit('update:show', false)
            self.$emit('close')
            self.saving = false
          })
          .catch(function () {
            self.saving = false
          })
        return
      }

      /**
       * Flujo de creación: si hay un hook before_create, lo ejecuta antes del POST.
       * El hook recibe el payload y devuelve una Promise.
       * Si resuelve, se procede con el guardado normal.
       * Si rechaza, se cancela la creación sin mostrar error (el hook gestiona su propia UI).
       */
      if (typeof this.before_create === 'function') {
        this.before_create(payload)
          .then(function () {
            api
              .post(path, payload)
              .then(function (res) {
                self.$emit('saved', res.data.model)
                self.open = false
                self.$emit('update:show', false)
                self.$emit('close')
                self.saving = false
              })
              .catch(function () {
                self.saving = false
              })
          })
          .catch(function () {
            /* Hook canceló el guardado: libera el estado de saving sin notificar error. */
            self.saving = false
          })
        return
      }

      api
        .post(path, payload)
        .then((res) => {
          self.$emit('saved', res.data.model)
          self.open = false
          self.$emit('update:show', false)
          self.$emit('close')
          self.saving = false
        })
        .catch(function () {
          self.saving = false
        })
    },
    /**
     * Elimina el registro vía acción `delete_model` del store del modelo y cierra el modal.
     * @returns {void}
     */
    on_delete() {
      if (!this.draft) {
        return
      }
      if (!window.confirm('¿Confirma eliminar este registro? Esta acción no se puede deshacer.')) {
        return
      }
      const self = this

      if (this.from_has_many && this.has_many_prop) {
        const hm = this.has_many_config
        const child_key = hm.child_route_key || 'id'
        const deleted_ref = this.draft.id != null
          ? this.draft.id
          : (this.draft.temporal_id != null ? this.draft.temporal_id : this.draft[child_key])
        self.deleting = true

        if (this.uses_nested_has_many_api()) {
          const http_path = '/' + this.resolve_has_many_api_path(hm.api_delete_path)
          api
            .delete(http_path)
            .then(function () {
              self.deleting = false
              self.$emit('deleted', deleted_ref)
              self.open = false
              self.$emit('update:show', false)
              self.$emit('close')
            })
            .catch(function () {
              self.deleting = false
            })
          return
        }

        if (this.draft.id == null) {
          self.deleting = false
          return
        }

        const standard_segment = this.has_many_standard_http_segment()
        api
          .delete('/' + standard_segment + '/' + this.draft.id)
          .then(function () {
            self.deleting = false
            self.$emit('deleted', deleted_ref)
            self.open = false
            self.$emit('update:show', false)
            self.$emit('close')
          })
          .catch(function () {
            self.deleting = false
          })
        return
      }

      if (!this.draft.id) {
        return
      }
      self.deleting = true
      this.$store
        .dispatch(this.model_name + '/delete_model', this.draft.id)
        .then(function () {
          self.deleting = false
          const id = self.draft.id
          self.$emit('deleted', id)
          self.open = false
          self.$emit('update:show', false)
          self.$emit('close')
        })
        .catch(function () {
          self.deleting = false
        })
    },
  },
}
</script>
