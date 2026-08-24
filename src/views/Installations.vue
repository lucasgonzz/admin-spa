<template>
  <div class="installations-view container-fluid px-0 py-4">

    <!-- Encabezado del listado global -->
    <div class="d-flex align-items-center flex-wrap gap-2 mb-4">
      <div>
        <h4 class="mb-0">Instalaciones</h4>
        <p class="text-muted small mb-0 mt-1">
          Instalaciones iniciales de sistema para todos los clientes.
        </p>
      </div>
      <!-- Botón que abre el modal de creación; ahora se puede instalar sin pasar por Clientes -->
      <button
        type="button"
        class="btn btn-primary ms-auto"
        @click="open_create_modal"
      >
        + Nueva instalación
      </button>
    </div>

    <!-- Carga inicial -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Cargando instalaciones…</p>
    </div>

    <!-- Sin registros: el empty state ahora invita a usar el botón nuevo, ya no hace falta ir a Clientes -->
    <div v-else-if="installations.length === 0" class="alert alert-secondary">
      No hay instalaciones registradas todavía. Creá una con el botón "+ Nueva instalación".
    </div>

    <!-- Tabla resumen -->
    <div v-else class="table-responsive">
      <table class="table table-hover table-sm align-middle">
        <thead class="table-light">
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Versión</th>
            <th>Estado</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="installation in installations"
            :key="installation.id"
            style="cursor: pointer"
            @click="open_manage_modal(installation)"
          >
            <td>{{ installation.id }}</td>
            <td>{{ client_display_name(installation) }}</td>
            <td>
              <span class="badge" :class="kind_badge_class(installation.kind)">
                {{ installation.kind || 'completa' }}
              </span>
            </td>
            <td>
              <span v-if="installation.version">
                {{ installation.version.version }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <span
                class="badge"
                :class="status_badge_class(installation.status)"
              >
                {{ installation.status }}
              </span>
            </td>
            <td class="small text-muted">
              {{ format_datetime(installation.started_at) || '—' }}
            </td>
            <td class="small text-muted">
              {{ format_datetime(installation.finished_at) || '—' }}
            </td>
            <td class="text-end">
              <!--
                Abre el modal de gestión de esta instalación puntual (reemplaza la navegación anterior).
                Queda como affordance visual; la fila entera ya dispara el mismo handler, por eso
                @click.stop evita ejecutarlo dos veces (una por el <tr>, otra por el botón).
              -->
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                @click.stop="open_manage_modal(installation)"
              >
                Gestionar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal de gestión: muestra InstallationDetail de la instalación seleccionada -->
    <base-modal
      :show="show_manage_modal"
      title="Gestionar instalación"
      size="lg"
      @update:show="show_manage_modal = $event"
      @close="on_manage_modal_closed"
    >
      <installation-detail
        v-if="selected_installation"
        :installation="selected_installation"
        @update:installation="on_modal_installation_updated"
        @group-updated="on_modal_group_updated"
        @deleted="on_modal_installation_deleted"
      />
    </base-modal>

    <!-- Modal de creación: elegir cliente, APIs destino y versión para instalar sin pasar por Clientes -->
    <base-modal
      :show="show_create_modal"
      title="Nueva instalación"
      @update:show="show_create_modal = $event"
      @close="on_create_modal_closed"
    >
      <div v-if="loading_create_data" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
      </div>

      <form v-else @submit.prevent>
        <!-- Selección de cliente -->
        <div class="mb-3">
          <label class="form-label small">Cliente</label>
          <select
            v-model="new_installation.client_id"
            class="form-select form-select-sm"
            @change="on_client_selected"
          >
            <option :value="null" disabled>Seleccioná un cliente…</option>
            <option
              v-for="client in clients"
              :key="client.id"
              :value="client.id"
            >
              {{ client.name || client.business_name }}
            </option>
          </select>
        </div>

        <!--
          APIs destino. No es un select de una sola API: el cliente tiene dos subdominios y el
          sistema alterna cuál sirve producción, así que la instalación se piensa sobre los dos
          a la vez. Se tilda en cuáles se trabaja y el radio elige en cuál corre el pipeline
          completo; en la otra tildada queda solo el esqueleto.
        -->
        <div class="mb-3">
          <label class="form-label small mb-1">APIs destino</label>

          <div v-if="!selected_client" class="text-muted small">
            Elegí un cliente para ver sus APIs.
          </div>

          <!-- Aviso cuando el cliente elegido no tiene ninguna API cargada -->
          <div
            v-else-if="selected_client_apis.length === 0"
            class="alert alert-warning py-2 small mb-0"
          >
            Este cliente no tiene ninguna API cargada. Cargale una API en su perfil antes de instalar.
          </div>

          <div v-else class="api-targets border rounded">
            <div
              v-for="client_api in selected_client_apis"
              :key="client_api.id"
              class="api-target-row"
            >
              <div class="api-target-check">
                <input
                  :id="'api-incluida-' + client_api.id"
                  class="form-check-input mt-0"
                  type="checkbox"
                  :checked="is_api_incluida(client_api.id)"
                  @change="on_api_toggled(client_api.id, $event.target.checked)"
                />
                <label class="form-check-label small api-target-url" :for="'api-incluida-' + client_api.id">
                  {{ client_api.url }}<span
                    v-if="client_api.id === selected_client_active_api_id"
                    class="text-muted"
                  > (activa)</span>
                </label>
              </div>

              <div class="api-target-real">
                <input
                  :id="'api-real-' + client_api.id"
                  v-model="new_installation.client_api_id_real"
                  class="form-check-input mt-0"
                  type="radio"
                  name="instalacion_real"
                  :value="client_api.id"
                  :disabled="!is_api_incluida(client_api.id)"
                />
                <label
                  class="form-check-label small text-nowrap"
                  :class="is_api_incluida(client_api.id) ? '' : 'text-muted'"
                  :for="'api-real-' + client_api.id"
                  :title="is_api_incluida(client_api.id) ? 'Acá corre el pipeline completo' : 'Tildá esta API para poder elegirla como instalación real'"
                >
                  instalación real
                </label>
              </div>
            </div>

            <!--
              El default arranca acá, y es a propósito: la instalación real vacía el public_html
              del SPA del cliente antes de subir el suyo. Un default que dispara eso con dos clicks
              está mal, y además "ninguna" es el caso normal: los clientes que ya están instalados
              en un subdominio solo necesitan que se les prepare el otro.
            -->
            <div class="api-target-row">
              <div class="api-target-check">
                <input
                  id="api-real-ninguna"
                  v-model="new_installation.client_api_id_real"
                  class="form-check-input mt-0"
                  type="radio"
                  name="instalacion_real"
                  :value="null"
                />
                <label class="form-check-label small" for="api-real-ninguna">
                  Ninguna: solo esqueleto en las tildadas
                </label>
              </div>
            </div>
          </div>

          <p
            v-if="selected_client && selected_client_apis.length > 0"
            class="form-text small mt-2 mb-0"
          >
            En la API que elijas como instalación real corre el pipeline completo. En la otra
            tildada se deja solo el esqueleto: los directorios, <code>public/</code> y el
            <code>.env</code>, que es lo que el upgrade no repone solo.
          </p>
        </div>

        <!-- Selección de versión: preselecciona la última publicada -->
        <div class="mb-3">
          <label class="form-label small">Versión</label>
          <select
            v-model="new_installation.version_id"
            class="form-select form-select-sm"
          >
            <option :value="null" disabled>Seleccioná una versión…</option>
            <option
              v-for="version in versions_desc"
              :key="version.id"
              :value="version.id"
            >
              {{ version.version }}{{ version.status === 'published' ? ' (publicada)' : '' }}
            </option>
          </select>
        </div>
      </form>

      <!-- Footer con el botón de crear: deshabilitado si falta algún campo o mientras se crea -->
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="show_create_modal = false">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!can_create_installation || creating"
          @click="create_installation"
        >
          {{ creating ? 'Creando…' : 'Crear instalación' }}
        </button>
      </template>
    </base-modal>

  </div>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import InstallationDetail from '@/components/installation/InstallationDetail.vue'

/**
 * Listado global de instalaciones iniciales (visible en el menú lateral).
 *
 * Muestra todas las ClientInstallation del sistema. El botón "Gestionar" de cada fila
 * abre un modal con InstallationDetail para esa instalación puntual (variables manuales,
 * iniciar, logs con polling propio y eliminar), en vez de navegar a otra vista.
 */
export default {
  name: 'ViewInstallations',

  components: {
    BaseModal,
    InstallationDetail,
  },

  data() {
    return {
      /** Todas las instalaciones del sistema. */
      installations: [],

      /** true mientras se carga el listado. */
      loading: false,

      /** Instalación seleccionada para el modal de gestión (null = modal cerrado). */
      selected_installation: null,

      /** Controla la visibilidad del modal de gestión. */
      show_manage_modal: false,

      /** Controla la visibilidad del modal de creación. */
      show_create_modal: false,

      /** true mientras se cargan clientes/versiones para el modal de creación (solo la primera vez). */
      loading_create_data: false,

      /** true una vez que clientes y versiones ya se cargaron, para no recargar en cada apertura. */
      create_data_loaded: false,

      /** Clientes disponibles para el select (cada uno trae sus client_apis por withAll()). */
      clients: [],

      /** Versiones disponibles para el select del modal de creación. */
      versions: [],

      /** true mientras se está creando la instalación (POST /installations). */
      creating: false,

      /**
       * Formulario del modal de creación.
       *
       * apis_incluidas son los ids de las client_apis sobre las que se va a trabajar, y
       * client_api_id_real es cuál de esas se instala de verdad (null = ninguna, solo esqueleto).
       * Son dos campos y no uno porque son dos preguntas distintas: "¿la toco?" y "¿la instalo
       * entera?". Con un solo campo no habría forma de pedir esqueleto en las dos.
       */
      new_installation: {
        client_id: null,
        version_id: null,
        apis_incluidas: [],
        client_api_id_real: null,
      },
    }
  },

  computed: {
    /**
     * Cliente actualmente seleccionado en el formulario de creación (objeto completo,
     * con sus client_apis ya incluidas por withAll()).
     *
     * @returns {Object|null}
     */
    selected_client() {
      const self = this
      if (!self.new_installation.client_id) {
        return null
      }
      return self.clients.find(function (c) { return c.id === self.new_installation.client_id }) || null
    },

    /**
     * client_apis del cliente seleccionado. Se puebla el select de API destino con esta lista.
     *
     * @returns {Array}
     */
    selected_client_apis() {
      if (!this.selected_client) {
        return []
      }
      return this.selected_client.client_apis || []
    },

    /**
     * id de la API activa del cliente seleccionado, para marcarla visualmente y preseleccionarla.
     *
     * @returns {number|null}
     */
    selected_client_active_api_id() {
      return this.selected_client ? this.selected_client.active_client_api_id : null
    },

    /**
     * Versiones ordenadas por id descendente (coherente con orderByDesc('id') del backend).
     *
     * @returns {Array}
     */
    versions_desc() {
      return this.versions.slice().sort(function (a, b) { return b.id - a.id })
    },

    /**
     * Habilita el botón de crear.
     *
     * No exige que haya una instalación real elegida: crear solo esqueletos es un caso de uso
     * válido y de hecho el más común (los clientes ya instalados en un subdominio necesitan que
     * se les prepare el otro sin tocar el que anda).
     *
     * @returns {boolean}
     */
    can_create_installation() {
      const form = this.new_installation
      return !!(form.client_id && form.version_id && form.apis_incluidas.length > 0)
    },
  },

  created() {
    this.load_installations()
  },

  methods: {
    /**
     * Abre el modal de gestión para una instalación puntual del listado.
     *
     * @param {Object} installation
     * @returns {void}
     */
    open_manage_modal(installation) {
      this.selected_installation = installation
      this.show_manage_modal = true
    },

    /**
     * Limpia la selección al cerrar el modal (backdrop, Escape o botón cerrar).
     *
     * @returns {void}
     */
    on_manage_modal_closed() {
      this.selected_installation = null
    },

    /**
     * Abre el modal de creación. Carga clientes y versiones la primera vez que se abre
     * (se cachean en data, no se recargan en aperturas siguientes).
     *
     * @returns {void}
     */
    open_create_modal() {
      this.new_installation = {
        client_id: null,
        version_id: null,
        apis_incluidas: [],
        client_api_id_real: null,
      }
      this.show_create_modal = true
      if (!this.create_data_loaded) {
        this.load_create_data()
      }
    },

    /**
     * Sin lógica adicional al cerrar: el formulario se resetea recién en la próxima apertura
     * (open_create_modal), así que acá no hace falta tocar nada.
     *
     * @returns {void}
     */
    on_create_modal_closed() {},

    /**
     * Carga clientes (con sus client_apis vía withAll()) y versiones para poblar los selects
     * del modal de creación. Solo se ejecuta una vez, la primera vez que se abre el modal.
     *
     * @returns {void}
     */
    load_create_data() {
      const self = this
      self.loading_create_data = true
      Promise.all([
        api.get('/client'),
        api.get('/version'),
      ])
        .then(function (responses) {
          self.clients = responses[0].data.models || []
          self.versions = responses[1].data.models || []
          self.create_data_loaded = true

          // Preselecciona automáticamente la última versión publicada (mayor id).
          const published_versions = self.versions.filter(function (v) { return v.status === 'published' })
          if (published_versions.length > 0) {
            const latest_published = published_versions.reduce(function (a, b) {
              return a.id > b.id ? a : b
            })
            self.new_installation.version_id = latest_published.id
          }
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.loading_create_data = false
        })
    },

    /**
     * Al elegir un cliente, tilda TODAS sus APIs y deja la instalación real en "ninguna".
     *
     * Tildar todo por default no es comodidad: el par de subdominios se piensa junto, y si una
     * queda destildada sin querer, ese subdominio se queda sin esqueleto y el upgrade que venga
     * después se corta a mitad de camino. Destildar es el gesto explícito, no tildar.
     * Si el cliente no tiene ninguna client_api, la lista queda vacía y el template ya se
     * encarga de mostrar el aviso correspondiente.
     *
     * @returns {void}
     */
    on_client_selected() {
      this.new_installation.apis_incluidas = this.selected_client_apis.map(function (client_api) {
        return client_api.id
      })
      this.new_installation.client_api_id_real = null
    },

    /**
     * ¿Esta client_api está tildada en el formulario?
     *
     * @param {number} client_api_id
     * @returns {boolean}
     */
    is_api_incluida(client_api_id) {
      return this.new_installation.apis_incluidas.indexOf(client_api_id) !== -1
    },

    /**
     * Tilda o destilda una client_api.
     *
     * Destildar limpia el radio si la instalación real apuntaba justo a esa API: si no, quedaría
     * un destino elegido para el pipeline completo que no está en la lista de lo que se va a
     * tocar, y el backend rechazaría el POST con un 422 que en pantalla no se explica solo.
     *
     * @param {number} client_api_id
     * @param {boolean} incluida
     * @returns {void}
     */
    on_api_toggled(client_api_id, incluida) {
      const form = this.new_installation
      const index = form.apis_incluidas.indexOf(client_api_id)
      if (incluida) {
        if (index === -1) {
          form.apis_incluidas.push(client_api_id)
        }
        return
      }
      if (index !== -1) {
        form.apis_incluidas.splice(index, 1)
      }
      if (form.client_api_id_real === client_api_id) {
        form.client_api_id_real = null
      }
    },

    /**
     * Arma los destinos del POST a partir del formulario, con la instalación real primero.
     *
     * El orden no es cosmético: el backend corre las filas del grupo en el orden en que llegan
     * y la real tiene que ir antes que el esqueleto.
     *
     * @returns {Array<{client_api_id: number, kind: string}>}
     */
    build_targets() {
      const form = this.new_installation
      /* Si la real quedó destildada, no es un destino: manda lo tildado y nada más. */
      const real_id = this.is_api_incluida(form.client_api_id_real) ? form.client_api_id_real : null
      const targets = []
      if (real_id !== null) {
        targets.push({ client_api_id: real_id, kind: 'completa' })
      }
      form.apis_incluidas.forEach(function (client_api_id) {
        if (client_api_id !== real_id) {
          targets.push({ client_api_id: client_api_id, kind: 'esqueleto' })
        }
      })
      return targets
    },

    /**
     * Crea la instalación (POST /installations) y, si sale bien, cierra el modal de creación,
     * agrega las instalaciones creadas al principio de la tabla y abre de inmediato el modal de
     * gestión para que se completen las variables manuales y se pueda iniciar el pipeline.
     *
     * @returns {void}
     */
    create_installation() {
      const self = this
      self.creating = true
      api.post('/installations', {
        client_id: self.new_installation.client_id,
        version_id: self.new_installation.version_id,
        targets: self.build_targets(),
      })
        .then(function (res) {
          /* models trae las dos filas del par; el fallback a model es para una respuesta vieja. */
          const created_rows = res.data.models || [res.data.model]
          self.installations = created_rows.concat(self.installations)
          self.show_create_modal = false
          self.open_manage_modal(res.data.model)
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.creating = false
        })
    },

    /**
     * Refleja en la tabla global un cambio emitido por el InstallationDetail del modal.
     *
     * @param {Object} updated
     * @returns {void}
     */
    on_modal_installation_updated(updated) {
      this.selected_installation = updated
      const index = this.installations.findIndex(function (i) { return i.id === updated.id })
      if (index !== -1) {
        this.installations.splice(index, 1, updated)
      }
    },

    /**
     * Refleja en la tabla global el estado de TODAS las filas del par.
     *
     * Iniciar una instalación arranca las dos filas del grupo, pero el modal muestra una sola:
     * sin esto la hermana se queda con el estado viejo en la tabla hasta que se recargue la
     * vista. No toca selected_installation, que es dueño de on_modal_installation_updated.
     *
     * @param {Array<Object>} updated_rows
     * @returns {void}
     */
    on_modal_group_updated(updated_rows) {
      const self = this
      const rows = updated_rows || []
      rows.forEach(function (row) {
        const index = self.installations.findIndex(function (i) { return i.id === row.id })
        if (index !== -1) {
          self.installations.splice(index, 1, row)
        }
      })
    },

    /**
     * Cierra el modal y quita la instalación eliminada de la tabla global.
     *
     * @param {number} installation_id
     * @returns {void}
     */
    on_modal_installation_deleted(installation_id) {
      this.installations = this.installations.filter(function (i) {
        return i.id !== installation_id
      })
      this.show_manage_modal = false
      this.selected_installation = null
    },

    /**
     * Carga el listado global desde GET /installations.
     *
     * @returns {void}
     */
    load_installations() {
      const self = this
      self.loading = true
      api.get('/installations')
        .then(function (res) {
          self.installations = res.data.models || []
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.loading = false
        })
    },

    /**
     * Nombre legible del cliente asociado a la instalación.
     *
     * @param {Object} installation
     * @returns {string}
     */
    client_display_name(installation) {
      const client = installation.client
      if (!client) {
        return 'Cliente #' + installation.client_id
      }
      return client.name || client.business_name || ('Cliente #' + client.id)
    },

    /**
     * Clase del badge según el estado de la instalación.
     *
     * @param {string} status
     * @returns {string}
     */
    status_badge_class(status) {
      const map = {
        pendiente:  'bg-secondary',
        instalando: 'bg-primary',
        completada: 'bg-success',
        fallida:    'bg-danger',
      }
      return map[status] || 'bg-secondary'
    },

    /**
     * Clase del badge según el tipo de instalación.
     *
     * El fallback a 'completa' es para las filas creadas antes de que existiera el campo: en la
     * base quedaron con el default 'completa', pero una respuesta cacheada en el navegador puede
     * venir sin la clave y no queremos una celda vacía.
     *
     * @param {string} kind
     * @returns {string}
     */
    kind_badge_class(kind) {
      return kind === 'esqueleto' ? 'text-bg-info' : 'text-bg-light border'
    },

    /**
     * Formatea fecha ISO para la tabla.
     *
     * @param {string|null} datetime
     * @returns {string}
     */
    format_datetime(datetime) {
      if (!datetime) {
        return ''
      }
      const d = new Date(datetime)
      return d.toLocaleString('es-AR', {
        day:    '2-digit',
        month:  '2-digit',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
      })
    },
  },
}
</script>

<style scoped>
/* Lista de APIs destino del modal de creación. */
.api-target-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.75rem;
  padding: 0.5rem 0.75rem;
}
.api-target-row + .api-target-row {
  border-top: 1px solid var(--bs-border-color);
}
.api-target-check,
.api-target-real {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
/*
  La URL es lo único elástico de la fila. El min-width: 0 es lo que hace falta de verdad: sin él
  un item flex no baja de su tamaño de contenido, y un subdominio largo empuja el radio fuera del
  modal en tablet, que es justo el ancho donde nadie mira. El overflow-wrap corta la URL, que no
  tiene espacios donde partirse sola.
*/
.api-target-check {
  flex: 1 1 12rem;
  min-width: 0;
}
.api-target-url {
  min-width: 0;
  overflow-wrap: anywhere;
}
.api-target-real {
  margin-left: auto;
  flex-shrink: 0;
}
/*
  En teléfono la fila se parte en dos líneas. El radio baja alineado con la URL en vez de quedar
  pegado al borde derecho: contra el borde se lee como si perteneciera a la fila de abajo.
*/
@media (max-width: 575.98px) {
  .api-target-real {
    margin-left: 1.5rem;
  }
}
.form-check-input {
  flex-shrink: 0;
}
</style>
