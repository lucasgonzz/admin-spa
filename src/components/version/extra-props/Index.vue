<template>
  <div class="version-model-extra">
    <p class="text-muted small mb-2">
      Mismo esquema de pestañas que la ficha Blade de la versión. Los cambios quedan en el borrador
      hasta <strong>Guardar</strong> en el modal; sin clientes seleccionados, el ítem aplica a todos.
    </p>

    <div v-if="clients_error" class="alert alert-warning small mb-2">{{ clients_error }}</div>

    <ul class="nav nav-tabs" role="tablist">
      <li v-for="t in extra_tab_items" :key="t.id" class="nav-item" role="presentation">
        <button
          type="button"
          class="nav-link py-2"
          :class="{ active: extra_tab === t.id }"
          role="tab"
          :aria-selected="extra_tab === t.id"
          @click="extra_tab = t.id"
        >
          {{ t.label }}
          <span
            v-if="t.badge != null"
            class="badge rounded-pill ms-1"
            :class="extra_tab === t.id ? 'text-bg-primary' : 'text-bg-light'"
          >{{ t.badge }}</span>
        </button>
      </li>
    </ul>
    <div class="tab-content p-3 bg-white border border-top-0 rounded-bottom mb-0">
    <div v-show="extra_tab === 'notifications'" class="version-extra-panel" role="tabpanel">
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead>
            <tr>
              <th style="width: 72px">Orden</th>
              <th>Título</th>
              <th>Cuerpo</th>
              <th class="text-center" style="width: 72px">Activa</th>
              <th style="width: 100px">Alcance</th>
              <th style="width: 160px">Clientes</th>
              <th style="width: 100px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in draft_notifications" :key="row_key(row, idx)">
              <td>
                <input v-model.number="row.sort_order" type="number" class="form-control form-control-sm" />
              </td>
              <td>
                <input v-model="row.title" type="text" class="form-control form-control-sm" required />
              </td>
              <td>
                <textarea v-model="row.body" rows="2" class="form-control form-control-sm" required />
              </td>
              <td class="text-center">
                <input v-model="row.is_active" type="checkbox" class="form-check-input" />
              </td>
              <td><span class="small">{{ scope_label(row) }}</span></td>
              <td>
                <select
                  v-model="row.client_ids"
                  class="form-select form-select-sm"
                  multiple
                  size="3"
                >
                  <option v-for="c in clients_options" :key="c.id" :value="c.id">{{ client_option_label(c) }}</option>
                </select>
              </td>
              <td class="text-nowrap">
                <button type="button" class="btn btn-sm btn-outline-danger" @click="remove_at('notifications', idx)">
                  ×
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="btn btn-sm btn-success" @click="add_notification">+ Agregar</button>
    </div>

    <div v-show="extra_tab === 'seeders'" class="version-extra-panel" role="tabpanel">
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead>
            <tr>
              <th style="width: 72px">Orden</th>
              <th class="version-run-input-col">Seeder class</th>
              <th>Descripción</th>
              <th class="text-center" style="width: 88px">Requerido</th>
              <!-- Indica si el seeder se ejecuta una vez por base de datos o una vez por usuario/tenant -->
              <th style="width: 130px" title="por_base_de_datos: se corre una vez por DB · por_usuario: se corre una vez por cada tenant">Scope ejecución</th>
              <th style="width: 100px">Alcance</th>
              <th style="width: 160px">Clientes</th>
              <th style="width: 120px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in draft_seeders" :key="row_key(row, idx)">
              <td>
                <input v-model.number="row.execution_order" type="number" class="form-control form-control-sm" />
              </td>
              <td class="version-run-input-col">
                <div class="input-group input-group-sm">
                  <input :id="'seeder-class-' + row_key(row, idx)" v-model="row.seeder_class" type="text" class="form-control" required />
                  <button type="button" class="btn btn-outline-secondary" @click="copy_field('seeder-class-' + row_key(row, idx))">
                    Copiar
                  </button>
                </div>
              </td>
              <td>
                <input v-model="row.description" type="text" class="form-control form-control-sm" />
              </td>
              <td class="text-center">
                <input v-model="row.is_required" type="checkbox" class="form-check-input" />
              </td>
              <!-- Selector de scope de ejecución: por_base_de_datos (default) o por_usuario -->
              <td>
                <select v-model="row.run_scope" class="form-select form-select-sm">
                  <option value="per_database">Por base de datos</option>
                  <option value="per_user">Por usuario</option>
                </select>
              </td>
              <td><span class="small">{{ scope_label(row) }}</span></td>
              <td>
                <select v-model="row.client_ids" class="form-select form-select-sm" multiple size="3">
                  <option v-for="c in clients_options" :key="c.id" :value="c.id">{{ client_option_label(c) }}</option>
                </select>
              </td>
              <td class="text-nowrap">
                <button type="button" class="btn btn-sm btn-outline-danger" @click="remove_at('seeders', idx)">×</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="btn btn-sm btn-success" @click="add_seeder">+ Agregar</button>
    </div>

    <div v-show="extra_tab === 'commands'" class="version-extra-panel" role="tabpanel">
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead>
            <tr>
              <th style="width: 72px">Orden</th>
              <th class="version-run-input-col">Comando</th>
              <th>Descripción</th>
              <th class="text-center" style="width: 88px">Requerido</th>
              <!-- Si está marcado, el deployment SSH lo omite y queda pendiente para ejecución manual -->
              <th class="text-center" style="width: 88px" title="No se ejecuta por deployment automatizado">Manual</th>
              <!-- Indica si el comando se ejecuta una vez por base de datos o una vez por usuario/tenant -->
              <th style="width: 130px" title="por_base_de_datos: se corre una vez por DB · por_usuario: se corre una vez por cada tenant">Scope ejecución</th>
              <th style="width: 100px">Alcance</th>
              <th style="width: 160px">Clientes</th>
              <th style="width: 120px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in draft_commands" :key="row_key(row, idx)">
              <td>
                <input v-model.number="row.execution_order" type="number" class="form-control form-control-sm" />
              </td>
              <td class="version-run-input-col">
                <div class="input-group input-group-sm">
                  <input :id="'cmd-text-' + row_key(row, idx)" v-model="row.command" type="text" class="form-control" required />
                  <button type="button" class="btn btn-outline-secondary" @click="copy_field('cmd-text-' + row_key(row, idx))">
                    Copiar
                  </button>
                </div>
              </td>
              <td>
                <input v-model="row.description" type="text" class="form-control form-control-sm" />
              </td>
              <td class="text-center">
                <input v-model="row.is_required" type="checkbox" class="form-check-input" />
              </td>
              <td class="text-center">
                <input v-model="row.run_manually" type="checkbox" class="form-check-input" />
              </td>
              <!-- Selector de scope de ejecución: por_usuario (default) o por_base_de_datos -->
              <td>
                <select v-model="row.run_scope" class="form-select form-select-sm">
                  <option value="per_user">Por usuario</option>
                  <option value="per_database">Por base de datos</option>
                </select>
              </td>
              <td><span class="small">{{ scope_label(row) }}</span></td>
              <td>
                <select v-model="row.client_ids" class="form-select form-select-sm" multiple size="3">
                  <option v-for="c in clients_options" :key="c.id" :value="c.id">{{ client_option_label(c) }}</option>
                </select>
              </td>
              <td class="text-nowrap">
                <button type="button" class="btn btn-sm btn-outline-danger" @click="remove_at('commands', idx)">×</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="btn btn-sm btn-success" @click="add_command">+ Agregar</button>
    </div>

    <div v-show="extra_tab === 'manual_tasks'" class="version-extra-panel" role="tabpanel">
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead>
            <tr>
              <th style="width: 72px">Orden</th>
              <th>Título</th>
              <th>Descripción</th>
              <th class="text-center" style="width: 88px">Requerida</th>
              <th style="width: 100px">Alcance</th>
              <th style="width: 160px">Clientes</th>
              <th style="width: 100px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in draft_manual_tasks" :key="row_key(row, idx)">
              <td>
                <input v-model.number="row.execution_order" type="number" class="form-control form-control-sm" />
              </td>
              <td>
                <input v-model="row.title" type="text" class="form-control form-control-sm" required />
              </td>
              <td>
                <input v-model="row.description" type="text" class="form-control form-control-sm" />
              </td>
              <td class="text-center">
                <input v-model="row.is_required" type="checkbox" class="form-check-input" />
              </td>
              <td><span class="small">{{ scope_label(row) }}</span></td>
              <td>
                <select v-model="row.client_ids" class="form-select form-select-sm" multiple size="3">
                  <option v-for="c in clients_options" :key="c.id" :value="c.id">{{ client_option_label(c) }}</option>
                </select>
              </td>
              <td class="text-nowrap">
                <button type="button" class="btn btn-sm btn-outline-danger" @click="remove_at('manual_tasks', idx)">×</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="btn btn-sm btn-success" @click="add_manual_task">+ Agregar</button>
    </div>

    <div v-show="extra_tab === 'upgrades'" class="version-extra-panel" role="tabpanel">
      <p class="text-muted mb-3">
        Para publicar esta versión a un cliente, creá una actualización desde la sección
        <router-link to="/actualizaciones" class="text-decoration-none">Actualizaciones</router-link>.
      </p>
      <div v-if="draft_upgrades.length" class="table-responsive">
        <table class="table table-sm table-bordered">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Sincronizado</th>
              <th>Creada</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(u, ui) in draft_upgrades" :key="u.id || 'u' + ui">
              <td>{{ upgrade_client_name(u) }}</td>
              <td>
                <span class="badge" :class="upgrade_status_badge_class(u.status)">
                  {{ upgrade_status_label(u.status) }}
                </span>
              </td>
              <td>{{ u.synced_at || '—' }}</td>
              <td>{{ u.created_at || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p class="text-muted small mb-0">Lectura desde datos cargados en el registro; el flujo de actualizaciones se administra en su pantalla.</p>
      </div>
      <p v-else class="text-muted mb-0">No hay actualizaciones vinculadas a esta versión en los datos actuales.</p>
    </div>
    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Props extra del recurso `version` (fuera de common-vue). Se inyecta vía slot `model-extra` en ResourceView.
 * Edición en memoria sobre `draft`; la persistencia es al Guardar del modal (POST/PUT + nested sync en API).
 */
export default {
  name: 'VersionExtraProps',
  props: {
    /** Borrador del modal; se mutan notifications, seeders, commands, manual_tasks y client_ids por fila. */
    draft: { type: Object, default: null },
    record: { type: Object, default: null },
    all_properties: { type: Array, default: () => [] },
    model_name: { type: String, default: '' },
  },
  data() {
    return {
      /** Pestaña extra activa: alineada con ids en el Blade (notifications, seeders, …). */
      extra_tab: 'notifications',
      /** Clientes activos para multiselect (misma idea que Blade). */
      clients_options: [],
      /** Mensaje si falla la carga de clientes. */
      clients_error: '',
    }
  },
  computed: {
    /**
     * Definición de pestañas + badges con conteo (como en show.blade.php).
     * @returns {Array<{ id: string, label: string, badge: number }>}
     */
    extra_tab_items() {
      return [
        { id: 'notifications', label: 'Notificaciones', badge: this.draft_notifications.length },
        { id: 'seeders', label: 'Seeders', badge: this.draft_seeders.length },
        { id: 'commands', label: 'Comandos', badge: this.draft_commands.length },
        { id: 'manual_tasks', label: 'Tareas manuales', badge: this.draft_manual_tasks.length },
        { id: 'upgrades', label: 'Actualizaciones', badge: this.draft_upgrades.length },
      ]
    },
    /**
     * Actualizaciones hacia clientes, si el API incluyó `upgrades` en el registro.
     * @returns {Array<Object>}
     */
    draft_upgrades() {
      const d = this.draft
      if (d && Array.isArray(d.upgrades)) {
        return d.upgrades
      }
      const r = this.record
      if (r && Array.isArray(r.upgrades)) {
        return r.upgrades
      }
      return []
    },
    /**
     * Lista de notificaciones en el borrador (siempre array).
     * @returns {Array<Object>}
     */
    draft_notifications() {
      return this.draft && Array.isArray(this.draft.notifications) ? this.draft.notifications : []
    },
    /**
     * @returns {Array<Object>}
     */
    draft_seeders() {
      return this.draft && Array.isArray(this.draft.seeders) ? this.draft.seeders : []
    },
    /**
     * @returns {Array<Object>}
     */
    draft_commands() {
      return this.draft && Array.isArray(this.draft.commands) ? this.draft.commands : []
    },
    /**
     * @returns {Array<Object>}
     */
    draft_manual_tasks() {
      return this.draft && Array.isArray(this.draft.manual_tasks) ? this.draft.manual_tasks : []
    },
  },
  watch: {
    /**
     * Si el padre reconstruye el draft al abrir otro registro, se reinicializan colecciones y client_ids.
     */
    draft: {
      deep: false,
      handler() {
        this.extra_tab = 'notifications'
        this.ensure_nested_collections()
      },
    },
  },
  mounted() {
    this.ensure_nested_collections()
    this.load_clients()
  },
  methods: {
    /**
     * Normaliza client_ids desde restricted_clients cuando ya hay arrays en el borrador.
     * En alta (sin id) inicializa colecciones vacías para poder agregar filas antes del primer Guardar.
     * En edición no crea claves vacías: si la fila del listado no trajo relaciones, omitir la clave
     * en el JSON evita que el API interprete "lista vacía" y borre datos en servidor.
     * @returns {void}
     */
    ensure_nested_collections() {
      const d = this.draft
      if (!d) {
        return
      }
      const keys = ['notifications', 'seeders', 'commands', 'manual_tasks']
      if (!d.id) {
        keys.forEach((k) => {
          if (!Array.isArray(d[k])) {
            d[k] = []
          }
        })
      }
      keys.forEach((k) => {
        if (Array.isArray(d[k])) {
          this.normalize_client_ids_from_relations(d[k], k)
        }
      })
    },
    /**
     * Rellena client_ids desde restricted_clients / restrictedClients si aún no hay selección.
     * @param {Array<Object>|undefined} items filas de una relación.
     * @param {string|undefined} collection_key notifications|seeders|commands|manual_tasks.
     * @returns {void}
     */
    normalize_client_ids_from_relations(items, collection_key) {
      if (!Array.isArray(items)) {
        return
      }
      items.forEach((item) => {
        if (!item) {
          return
        }
        if (!Array.isArray(item.client_ids)) {
          item.client_ids = []
        }
        const rel = item.restricted_clients || item.restrictedClients
        if (Array.isArray(rel) && rel.length && item.client_ids.length === 0) {
          item.client_ids = rel.map((c) => c.id)
        }
        /* Default run_scope si el registro viene sin el campo (versiones anteriores a la migración) */
        if (!item.run_scope) {
          if (collection_key === 'seeders') {
            item.run_scope = 'per_database'
          } else if (collection_key === 'commands') {
            item.run_scope = 'per_user'
          }
        }
        /* Default run_manually en comandos si el registro viene sin el campo */
        if (collection_key === 'commands' && item.run_manually === undefined) {
          item.run_manually = false
        }
      })
    },
    /**
     * Carga clientes para los multiselect (solo activos, como en Blade).
     * @returns {void}
     */
    load_clients() {
      const self = this
      this.clients_error = ''
      api
        .get('/client')
        .then(function (res) {
          const m = res.data && res.data.models
          const raw = Array.isArray(m) ? m : (m && m.data) || []
          const active_clients = raw.filter(function (c) {
            return c.is_active !== false && c.is_active !== 0
          })
          /* Orden alfabético por razón social para facilitar la búsqueda en el multiselect */
          active_clients.sort(function (a, b) {
            return self.client_option_label(a).localeCompare(self.client_option_label(b), 'es')
          })
          self.clients_options = active_clients
        })
        .catch(function () {
          self.clients_error = 'No se pudieron cargar los clientes para el multiselect.'
        })
    },
    /**
     * Etiqueta de alcance según cantidad de client_ids.
     * @param {Object} row fila con client_ids.
     * @returns {string}
     */
    scope_label(row) {
      const n = row && Array.isArray(row.client_ids) ? row.client_ids.length : 0
      if (n === 0) {
        return 'Todos'
      }
      return n + ' cliente(s)'
    },
    /**
     * Clave estable para v-for.
     * @param {Object} row fila.
     * @param {number} idx índice.
     * @returns {string|number}
     */
    row_key(row, idx) {
      if (row && row._row_key) {
        return row._row_key
      }
      if (row && row.id) {
        return row.id
      }
      return 'i' + idx
    },
    /**
     * Asigna id temporal único a filas nuevas para listas y inputs.
     * @returns {string}
     */
    new_row_key() {
      return 'n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
    },
    /**
     * Elimina una fila de una colección del draft.
     * @param {string} collection notifications|seeders|commands|manual_tasks.
     * @param {number} idx índice.
     * @returns {void}
     */
    remove_at(collection, idx) {
      if (!this.draft || !Array.isArray(this.draft[collection])) {
        return
      }
      this.draft[collection].splice(idx, 1)
    },
    /**
     * Añade una notificación vacía al borrador.
     * @returns {void}
     */
    add_notification() {
      if (!Array.isArray(this.draft.notifications)) {
        this.draft.notifications = []
      }
      this.ensure_nested_collections()
      this.draft.notifications.push({
        _row_key: this.new_row_key(),
        id: null,
        sort_order: 0,
        title: '',
        body: '',
        is_active: true,
        client_ids: [],
      })
    },
    /**
     * Añade un seeder; orden 0 en servidor se reasigna al final si es nuevo.
     * El run_scope por defecto es per_database: la mayoría de los seeders son
     * datos maestros comunes a todos los usuarios de una misma base de datos.
     * Solo usar per_user cuando el seeder genera filas con user_id específico
     * (p.ej. PdfColumnProfileSeeder, PaymentMethodSeeder).
     * @returns {void}
     */
    add_seeder() {
      if (!Array.isArray(this.draft.seeders)) {
        this.draft.seeders = []
      }
      this.ensure_nested_collections()
      this.draft.seeders.push({
        _row_key: this.new_row_key(),
        id: null,
        seeder_class: '',
        description: '',
        execution_order: 0,
        is_required: true,
        /* Default per_database: los seeders nuevos son comunes a la BD salvo indicación contraria */
        run_scope: 'per_database',
        client_ids: [],
      })
    },
    /**
     * Añade un comando.
     * El run_scope por defecto es per_user: la mayoría de los comandos operan
     * sobre datos de un tenant específico (usan config('app.USER_ID') o {user_id?}).
     * Solo usar per_database cuando el comando opera sobre modelos maestros sin
     * user_id (p.ej. set_iva_condition_slugs, set_payment_method_types).
     * @returns {void}
     */
    add_command() {
      if (!Array.isArray(this.draft.commands)) {
        this.draft.commands = []
      }
      this.ensure_nested_collections()
      this.draft.commands.push({
        _row_key: this.new_row_key(),
        id: null,
        command: '',
        description: '',
        execution_order: 0,
        is_required: true,
        run_manually: false,
        /* Default per_user: los comandos nuevos son por tenant salvo indicación contraria */
        run_scope: 'per_user',
        client_ids: [],
      })
    },
    /**
     * Añade una tarea manual.
     * @returns {void}
     */
    add_manual_task() {
      if (!Array.isArray(this.draft.manual_tasks)) {
        this.draft.manual_tasks = []
      }
      this.ensure_nested_collections()
      this.draft.manual_tasks.push({
        _row_key: this.new_row_key(),
        id: null,
        title: '',
        description: '',
        execution_order: 0,
        is_required: true,
        client_ids: [],
      })
    },
    /**
     * Copia el valor de un input al portapapeles (similar al Blade).
     * @param {string} element_id id del input.
     * @returns {void}
     */
    copy_field(element_id) {
      const el = typeof document !== 'undefined' ? document.getElementById(element_id) : null
      if (!el || !el.value) {
        return
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(el.value).catch(function () {
          el.select()
          document.execCommand('copy')
        })
      } else {
        el.select()
        document.execCommand('copy')
      }
    },
    /**
     * Etiqueta visible de un cliente en los multiselect de alcance.
     * Prioriza la razón social (company_name); si no hay, usa el nombre de contacto.
     * @param {Object|null} client registro de cliente del API.
     * @returns {string}
     */
    client_option_label(client) {
      if (!client) {
        return '—'
      }

      const company_name = client.company_name ? String(client.company_name).trim() : ''
      if (company_name) {
        return company_name
      }

      const contact_name = client.name ? String(client.name).trim() : ''
      if (contact_name) {
        return contact_name
      }

      return 'Cliente #' + client.id
    },
    /**
     * Nombre de cliente asociado a un upgrade, si vino anidado en el JSON.
     * @param {Object} u registro de upgrade.
     * @returns {string}
     */
    upgrade_client_name(u) {
      if (u && u.client) {
        return this.client_option_label(u.client)
      }
      return '—'
    },
    /**
     * Etiqueta de estado (misma lista que en Blade show).
     * @param {string|undefined} status
     * @returns {string}
     */
    upgrade_status_label(status) {
      const labels = {
        pendiente: 'Pendiente',
        listo_para_actualizar: 'Listo para actualizar',
        actualizandose: 'Actualizándose',
        terminada: 'Terminada',
        fallida: 'Fallida',
      }
      return (status && labels[status]) || (status || '—')
    },
    /**
     * Clase de badge de estado, coherente con Bootstrap 5.
     * @param {string|undefined} status
     * @returns {string}
     */
    upgrade_status_badge_class(status) {
      const map = {
        pendiente: 'text-bg-secondary',
        listo_para_actualizar: 'text-bg-info',
        actualizandose: 'text-bg-warning',
        terminada: 'text-bg-success',
        fallida: 'text-bg-danger',
      }
      return (status && map[status]) || 'text-bg-light'
    },
  },
}
</script>

<style scoped>
/* Columna del seeder/comando a ejecutar: el doble de ancho que una columna de texto estándar */
.version-run-input-col {
  min-width: 480px;
  width: 40%;
}
.version-run-input-col .input-group {
  min-width: 100%;
}
.version-run-input-col .form-control {
  min-width: 0;
}
</style>
