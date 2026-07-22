<template>
  <div>
    <!-- Modal hijo: componente resuelto (evita renderizar [object Promise] del import async) -->
    <component
      v-if="show_child_modal && child_modal_component"
      :is="child_modal_component"
      :show="show_child_modal"
      :model_name="child_model_name"
      :all_properties="child_properties"
      :record="child_edit_record"
      :from_has_many="true"
      :has_many_parent_model="parent_model"
      :has_many_parent_model_name="parent_model_name"
      :has_many_prop="prop"
      @update:show="on_child_modal_show"
      @close="on_child_modal_close"
      @saved="on_child_saved"
      @deleted="on_child_deleted"
    />

    <!-- Sección con superficie propia: agrupa título, tabla y acciones como un bloque separado del modal -->
    <div class="has-many-section">
      <label class="has-many-section__title">{{ field_label }}</label>

      <!-- Aviso cuando el padre aún no está persistido: los hijos se vinculan al guardar -->
      <p v-if="uses_temporal_children && !parent_is_persisted" class="text-muted small mb-2">
        Puede agregar {{ plural_child_label() }} ahora; se vincularán al guardar el registro principal.
      </p>

      <!-- Tabla compacta con botón contextual de ampliación -->
      <div
        class="has-many-table-container"
        @mouseenter="set_table_hover_state(true)"
        @mouseleave="set_table_hover_state(false)"
      >
        <button
          v-if="show_expand_button && child_rows.length"
          type="button"
          class="btn btn-primary btn-sm has-many-expand-button"
          @click="open_expand_modal"
        >
          <i class="bi bi-eye me-1" aria-hidden="true"></i>
          Ampliar
        </button>

        <resource-table
          :rows="child_rows"
          :table_properties="child_table_properties"
          :model_name="child_model_name"
          @row="on_row_click"
        />
      </div>

      <div class="d-flex flex-wrap gap-2 mt-3">
        <button
          v-if="show_create_button"
          type="button"
          class="btn btn-primary btn-sm"
          @click="on_create"
        >
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
          Agregar {{ singular_child_label() }}
        </button>
        <button
          v-if="show_sync_from_empresa_button"
          type="button"
          class="btn btn-success btn-sm"
          :disabled="sync_from_empresa_loading || !parent_is_persisted"
          @click="on_sync_from_empresa"
        >
          <i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>
          {{ sync_from_empresa_button_text }}
        </button>
      </div>
    </div>

    <!-- Modal ampliado con la misma tabla: reusa la superficie de sección para verse consistente -->
    <base-modal
      :show="show_expand_modal"
      :title="'Detalle de ' + plural_child_label()"
      size="xl"
      @update:show="(v) => (show_expand_modal = v)"
      @close="show_expand_modal = false"
    >
      <div class="has-many-section has-many-section--modal">
        <resource-table
          :rows="child_rows"
          :table_properties="child_table_properties"
          :model_name="child_model_name"
          @row="on_row_click"
        />

        <div class="d-flex flex-wrap gap-2 mt-3">
          <button
            v-if="show_create_button"
            type="button"
            class="btn btn-primary btn-sm"
            @click="on_create"
          >
            <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
            Agregar {{ singular_child_label() }}
          </button>
          <button
            v-if="show_sync_from_empresa_button"
            type="button"
            class="btn btn-success btn-sm"
            :disabled="sync_from_empresa_loading || !parent_is_persisted"
            @click="on_sync_from_empresa"
          >
            <i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>
            {{ sync_from_empresa_button_text }}
          </button>
        </div>
      </div>
    </base-modal>
  </div>
</template>

<script>
import ResourceTable from '@/common-vue/components/table/Index.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import api from '@/utils/axios'
import { resolve_error_message } from '@/utils/axios'

/**
 * Relación has_many embebida en formularios del admin-spa.
 * Muestra tabla de hijos, modal anidado CRUD y vista ampliada (patrón empresa-spa HasMany.vue).
 */
export default {
  name: 'HasManyField',
  components: {
    ResourceTable,
    BaseModal,
  },
  props: {
    /** Definición meta del campo padre (incluye `has_many`). */
    prop: { type: Object, required: true },
    /** Nombre del modelo padre en Vuex/meta (ej. `client`). */
    parent_model_name: { type: String, required: true },
    /** Objeto borrador del formulario padre. */
    parent_model: { type: Object, required: true },
  },
  emits: ['modelSaved', 'modelDeleted'],
  data() {
    return {
      /** Visibilidad del modal CRUD del hijo. */
      show_child_modal: false,
      /** Registro hijo en edición; null en alta. */
      child_edit_record: null,
      /** Estado hover sobre la tabla compacta para mostrar CTA ampliar. */
      show_expand_button: false,
      /** Control del modal de detalle ampliado. */
      show_expand_modal: false,
      /** Propiedades meta del modelo hijo (cache local tras fetch). */
      child_properties: [],
      /** Evita requests duplicados de meta del hijo. */
      loading_child_meta: false,
      /** Definición del modal hijo ya resuelta (no la Promise del dynamic import). */
      child_modal_component: null,
      /** Indica petición de sincronización desde empresa-api en curso. */
      sync_from_empresa_loading: false,
    }
  },
  computed: {
    /**
     * Etiqueta del campo; fuerza string para no mostrar [object Promise] si el meta se corrompe.
     * @returns {string}
     */
    field_label() {
      const raw = this.prop && this.prop.text
      if (typeof raw === 'string') {
        return raw
      }
      if (raw != null && typeof raw !== 'object') {
        return String(raw)
      }
      return ''
    },
    /**
     * Configuración has_many normalizada desde la propiedad meta.
     * @returns {Object}
     */
    has_many_config() {
      if (this.prop && this.prop.has_many) {
        return this.prop.has_many
      }
      return {}
    },
    /**
     * Nombre corto del modelo hijo declarado en meta.
     * @returns {string}
     */
    child_model_name() {
      return this.has_many_config.model_name || ''
    },
    /**
     * Filas hijas enlazadas en el borrador del padre.
     * @returns {Array<Object>}
     */
    child_rows() {
      const key = this.prop && this.prop.key ? this.prop.key : ''
      const rows = this.parent_model && key ? this.parent_model[key] : null
      return Array.isArray(rows) ? rows : []
    },
    /**
     * Columnas visibles para la tabla del hijo.
     * @returns {Array<Object>}
     */
    child_table_properties() {
      const props = this.child_properties || []
      const visible = []
      props.forEach((p) => {
        if (p && p.key && p.show !== false && !p.not_show_on_table && !p.group_title) {
          visible.push(p)
        }
      })
      if (visible.length) {
        return visible
      }
      return props.filter((p) => p && p.key && !p.group_title)
    },
    /**
     * Meta declara soporte de hijos con temporal_id antes de persistir el padre.
     * @returns {boolean}
     */
    uses_temporal_children() {
      return Boolean(this.has_many_config.supports_temporal_children)
    },
    /**
     * Padre ya persistido (tiene id numérico).
     * @returns {boolean}
     */
    parent_is_persisted() {
      const parent = this.parent_model || {}
      return parent.id != null && parent.id !== ''
    },
    /**
     * Indica si se puede usar la API anidada (padre con uuid/id según meta).
     * @returns {boolean}
     */
    can_use_nested_api() {
      if (!this.has_many_config.api_create_path) {
        return false
      }
      const parent_key = this.has_many_config.parent_route_key || 'uuid'
      const parent = this.parent_model || {}
      const parent_value = parent[parent_key]
      return parent_value != null && parent_value !== ''
    },
    /**
     * Muestra botón de alta salvo que meta lo deshabilite explícitamente.
     * @returns {boolean}
     */
    show_create_button() {
      if (this.has_many_config.models_from_parent_prop) {
        return false
      }
      if (typeof this.has_many_config.show_btn_create === 'undefined') {
        return true
      }
      return Boolean(this.has_many_config.show_btn_create)
    },
    /**
     * Configuración opcional de sincronización desde empresa-api (declarada en meta has_many).
     * @returns {Object|null}
     */
    sync_from_empresa_config() {
      const config = this.has_many_config.sync_from_empresa
      if (!config || !config.api_path) {
        return null
      }
      return config
    },
    /**
     * Muestra el botón de sincronizar empleados desde empresa-api.
     * @returns {boolean}
     */
    show_sync_from_empresa_button() {
      return this.sync_from_empresa_config !== null
    },
    /**
     * Texto del botón de sincronización (meta o valor por defecto).
     * @returns {string}
     */
    sync_from_empresa_button_text() {
      if (this.sync_from_empresa_config && this.sync_from_empresa_config.button_text) {
        return this.sync_from_empresa_config.button_text
      }
      return 'Sincronizar desde empresa'
    },
  },
  mounted() {
    this.ensure_child_meta()
    this.load_child_modal_component()
  },
  watch: {
    child_model_name() {
      this.ensure_child_meta()
    },
  },
  methods: {
    /**
     * Precarga el modal CRUD hijo; el import() devuelve Promise y no debe registrarse como componente directo.
     *
     * @returns {void}
     */
    load_child_modal_component() {
      if (this.child_modal_component) {
        return
      }
      const self = this
      import('@/common-vue/components/model/Index.vue')
        .then(function (module) {
          self.child_modal_component = module.default || module
        })
        .catch(function () {
          self.child_modal_component = null
        })
    },
    /**
     * Carga meta del modelo hijo vía store `meta/fetch_meta`.
     *
     * @returns {void}
     */
    ensure_child_meta() {
      const model_name = this.child_model_name
      if (!model_name || this.loading_child_meta) {
        return
      }
      const cached = this.$store.getters['meta/properties'](model_name)
      if (cached && cached.length) {
        this.child_properties = cached
        return
      }
      const self = this
      self.loading_child_meta = true
      this.$store
        .dispatch('meta/fetch_meta', model_name)
        .then(function (data) {
          self.child_properties = (data && data.properties) ? data.properties : []
          self.loading_child_meta = false
        })
        .catch(function () {
          self.child_properties = []
          self.loading_child_meta = false
        })
    },
    /**
     * Etiqueta singular del hijo para botones y títulos.
     *
     * @returns {string}
     */
    singular_child_label() {
      if (this.has_many_config.text) {
        return this.has_many_config.text
      }
      if (this.child_model_name) {
        return this.child_model_name.replace(/_/g, ' ')
      }
      return 'registro'
    },
    /**
     * Etiqueta plural simple del hijo.
     *
     * @returns {string}
     */
    plural_child_label() {
      const singular = this.singular_child_label()
      if (singular.endsWith('s')) {
        return singular
      }
      return singular + 's'
    },
    /**
     * Sincroniza hover para el botón flotante de ampliar.
     *
     * @param {boolean} is_hovered
     * @returns {void}
     */
    set_table_hover_state(is_hovered) {
      this.show_expand_button = is_hovered
    },
    /**
     * Abre el modal de tabla ampliada.
     *
     * @returns {void}
     */
    open_expand_modal() {
      this.show_expand_modal = true
    },
    /**
     * Abre modal hijo en modo alta.
     *
     * @returns {void}
     */
    on_create() {
      const self = this
      this.child_edit_record = null
      if (this.child_modal_component) {
        this.show_child_modal = true
        return
      }
      import('@/common-vue/components/model/Index.vue')
        .then(function (module) {
          self.child_modal_component = module.default || module
          self.show_child_modal = true
        })
        .catch(function () {
          self.child_modal_component = null
        })
    },
    /**
     * Abre modal hijo en modo edición al clickear una fila.
     *
     * @param {Object} row
     * @returns {void}
     */
    on_row_click(row) {
      const self = this
      this.child_edit_record = row
      if (this.child_modal_component) {
        this.show_child_modal = true
        return
      }
      import('@/common-vue/components/model/Index.vue')
        .then(function (module) {
          self.child_modal_component = module.default || module
          self.show_child_modal = true
        })
        .catch(function () {
          self.child_modal_component = null
        })
    },
    /**
     * Propaga visibilidad del modal hijo.
     *
     * @param {boolean} value
     * @returns {void}
     */
    on_child_modal_show(value) {
      this.show_child_modal = value
    },
    /**
     * Limpia estado al cerrar modal hijo.
     *
     * @returns {void}
     */
    on_child_modal_close() {
      this.show_child_modal = false
      this.child_edit_record = null
    },
    /**
     * Fusiona el hijo guardado en el array del padre y notifica al formulario.
     *
     * @param {Object} model registro devuelto por la API
     * @returns {void}
     */
    on_child_saved(model) {
      const key = this.prop.key
      if (!this.parent_model[key] || !Array.isArray(this.parent_model[key])) {
        this.parent_model[key] = []
      }
      let index = -1
      const child_route_key = this.has_many_config.child_route_key || 'id'
      this.parent_model[key].forEach(function (row, i) {
        if (index !== -1 || !model) {
          return
        }
        if (row.temporal_id != null && model.temporal_id != null && String(row.temporal_id) === String(model.temporal_id)) {
          index = i
          return
        }
        if (row.id != null && model.id != null && row.id == model.id) {
          index = i
          return
        }
        if (row[child_route_key] != null && model[child_route_key] != null) {
          if (String(row[child_route_key]) === String(model[child_route_key])) {
            index = i
          }
        }
      })
      if (index >= 0) {
        this.parent_model[key].splice(index, 1, model)
      } else {
        this.parent_model[key].push(model)
      }
      this.$emit('modelSaved', model)
    },
    /**
     * Quita el hijo eliminado del array del padre.
     *
     * @param {number|string} deleted_id identificador devuelto por el modal
     * @returns {void}
     */
    /**
     * Reemplaza la colección has_many del padre tras sincronizar desde empresa-api.
     *
     * @param {Array<Object>} employees filas devueltas por admin-api
     * @returns {void}
     */
    apply_synced_employees(employees) {
      const key = this.prop.key
      if (!key) {
        return
      }
      this.parent_model[key] = Array.isArray(employees) ? employees.slice() : []
      this.$emit('modelSaved', null)
    },
    /**
     * Arma la URL del endpoint de sincronización sustituyendo {parent} por el id/uuid del padre.
     *
     * @returns {string}
     */
    build_sync_from_empresa_path() {
      const config = this.sync_from_empresa_config
      if (!config) {
        return ''
      }
      /** Plantilla de ruta desde meta (ej. client/{parent}/employees/sync-from-empresa). */
      let path = String(config.api_path)
      const parent_key = this.has_many_config.parent_route_key || 'id'
      const parent = this.parent_model || {}
      const parent_value = parent[parent_key]
      path = path.replace('{parent}', String(parent_value))
      if (path.indexOf('{') !== -1) {
        return ''
      }
      return path.charAt(0) === '/' ? path : '/' + path
    },
    /**
     * POST a admin-api para importar empleados desde el empresa-api del cliente.
     *
     * @returns {void}
     */
    on_sync_from_empresa() {
      if (!this.parent_is_persisted) {
        alert('Guarde el cliente antes de sincronizar empleados desde empresa.')
        return
      }
      const sync_path = this.build_sync_from_empresa_path()
      if (!sync_path) {
        alert('No se pudo armar la ruta de sincronización.')
        return
      }
      if (!confirm('¿Sincronizar empleados desde empresa-api? Se crearán contactos nuevos y se actualizarán los ya vinculados. Los creados manualmente en admin no se modifican.')) {
        return
      }
      const self = this
      self.sync_from_empresa_loading = true
      api
        .post(sync_path)
        .then(function (res) {
          /** Lista actualizada de client_employees. */
          const employees = res.data && res.data.client_employees
            ? res.data.client_employees
            : (res.data && res.data.model && res.data.model.client_employees
              ? res.data.model.client_employees
              : [])
          self.apply_synced_employees(employees)
          const created = res.data && res.data.created != null ? res.data.created : 0
          const updated = res.data && res.data.updated != null ? res.data.updated : 0
          alert('Sincronización completada: ' + created + ' nuevo(s), ' + updated + ' actualizado(s).')
        })
        .catch(function (err) {
          alert(resolve_error_message(err))
        })
        .then(function () {
          self.sync_from_empresa_loading = false
        })
    },
    on_child_deleted(deleted_id) {
      const key = this.prop.key
      if (!this.parent_model[key] || !Array.isArray(this.parent_model[key])) {
        return
      }
      const child_route_key = this.has_many_config.child_route_key || 'id'
      const next_rows = []
      this.parent_model[key].forEach(function (row) {
        if (row.id != null && deleted_id != null && row.id == deleted_id) {
          return
        }
        if (row.temporal_id != null && String(row.temporal_id) === String(deleted_id)) {
          return
        }
        if (row[child_route_key] != null && String(row[child_route_key]) === String(deleted_id)) {
          return
        }
        next_rows.push(row)
      })
      this.parent_model[key] = next_rows

      if (this.parent_model.childrens && Array.isArray(this.parent_model.childrens)) {
        const next_childrens = []
        this.parent_model.childrens.forEach(function (child_ref) {
          if (child_ref.temporal_id != null && String(child_ref.temporal_id) === String(deleted_id)) {
            return
          }
          next_childrens.push(child_ref)
        })
        this.parent_model.childrens = next_childrens
      }

      this.$emit('modelDeleted')
    },
  },
}
</script>

<style scoped>
/* Sección con superficie propia: separa visualmente cada tabla has_many del blanco del modal */
.has-many-section {
  background-color: #f5f5f7;
  border: 1px solid #e5e5ea;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

/* Última sección del formulario: sin margen extra debajo, lo maneja la grilla del modal */
.has-many-section:last-child {
  margin-bottom: 0;
}

/* Variante dentro del modal "Ampliar": no repite el título (ya lo muestra el header del modal) */
.has-many-section--modal {
  margin-bottom: 0;
}

/* Encabezado de sección: reemplaza el label gris de input por un título legible del bloque */
.has-many-section__title {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--bs-body-color, #212529);
  margin-bottom: 0.75rem;
}

.has-many-table-container {
  position: relative;
}

.has-many-expand-button {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
}

/* Tabla embebida: fondo blanco propio para recortarse contra la superficie gris de la sección */
.has-many-section :deep(.table-responsive) {
  background-color: #fff;
  border: 1px solid #e5e5ea;
  border-radius: 10px;
  overflow: hidden;
}

/* Más aire en celdas y encabezados: table-sm las deja demasiado apretadas para leer cómodo */
.has-many-section :deep(.table td),
.has-many-section :deep(.table th) {
  padding: 0.65rem 0.85rem;
}

/* Encabezado apenas más marcado que el cuerpo, con texto en semi-bold */
.has-many-section :deep(.table thead th) {
  background-color: #f5f5f7;
  font-weight: 600;
  border-bottom-width: 1px;
}

/* Bordes internos más suaves: table-bordered no debe generar ruido de grilla fuerte */
.has-many-section :deep(.table-bordered),
.has-many-section :deep(.table-bordered td),
.has-many-section :deep(.table-bordered th) {
  border-color: #e5e5ea;
}
</style>
