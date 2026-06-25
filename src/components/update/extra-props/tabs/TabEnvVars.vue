<template>
  <div>
    <!-- Estado de carga inicial mientras se lee el .env de las APIs vía SSH -->
    <div v-if="loading" class="text-center py-4">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
      <span class="text-muted small">Leyendo .env de las APIs del cliente vía SSH...</span>
    </div>

    <!-- Error global: no se pudo conectar a ninguna API -->
    <div v-else-if="global_error" class="alert alert-danger py-2 small">
      {{ global_error }}
    </div>

    <!-- Sin diferencias: todas las variables comunes coinciden -->
    <div v-else-if="!loading && all_diffs_by_key.length === 0" class="alert alert-success py-2 small mb-0">
      <i class="bi bi-check-circle me-1"></i>
      Todas las variables comunes coinciden con el template en todas las APIs del cliente.
    </div>

    <!-- Tabla de diferencias detectadas -->
    <template v-else>

      <!-- Cabecera: contador de diferencias y botón de aplicación masiva -->
      <div class="d-flex align-items-center mb-3 gap-2">
        <span class="text-muted small">
          {{ all_diffs_by_key.length }} variable(s) con diferencias en {{ results.length }} API(s)
        </span>
        <button
          class="btn btn-sm btn-primary ms-auto"
          :disabled="selected_keys.length === 0 || applying"
          @click="apply_selected"
        >
          {{ applying ? 'Aplicando...' : 'Aplicar seleccionadas (' + selected_keys.length + ') a todas las APIs' }}
        </button>
      </div>

      <!-- Alertas de error SSH por API (no bloquean la visualización del resto) -->
      <div
        v-for="r in results.filter(function(r) { return r.error })"
        :key="'err-' + r.client_api_id"
        class="alert alert-warning py-2 small mb-2"
      >
        <strong>{{ r.api_url }}</strong>: {{ r.error }}
      </div>

      <!-- Resultado de la última aplicación masiva -->
      <div
        v-if="apply_result"
        class="alert small py-2 mb-3"
        :class="apply_result.has_errors ? 'alert-warning' : 'alert-success'"
      >
        <template v-if="apply_result.updated_apis > 0">
          <i class="bi bi-check-circle me-1"></i>
          Variables aplicadas en {{ apply_result.updated_apis }} API(s).
        </template>
        <div
          v-for="f in apply_result.failed_apis"
          :key="f.api_url"
          class="mt-1"
        >
          <i class="bi bi-exclamation-triangle me-1 text-warning"></i>
          <strong>{{ f.api_url }}</strong>: {{ f.error }}
        </div>
      </div>

      <!-- Tabla de variables con diferencias -->
      <table class="table table-sm table-hover mb-0">
        <thead class="table-light">
          <tr>
            <!-- Checkbox de selección total -->
            <th style="width:36px">
              <input
                type="checkbox"
                class="form-check-input"
                :checked="selected_keys.length === all_diffs_by_key.length && all_diffs_by_key.length > 0"
                @change="toggle_all"
              />
            </th>
            <th>Variable</th>
            <th>Valor en template</th>
            <th>Valor en cliente</th>
            <th>APIs afectadas</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in all_diffs_by_key"
            :key="item.key"
          >
            <!-- Checkbox individual por variable -->
            <td class="align-middle">
              <input
                type="checkbox"
                class="form-check-input"
                :checked="selected_keys.indexOf(item.key) !== -1"
                @change="toggle_key(item.key)"
              />
            </td>
            <td class="align-middle">
              <code class="small">{{ item.key }}</code>
            </td>
            <!-- Valor esperado según el template (en verde) -->
            <td class="align-middle small text-success">
              {{ item.template_value || '(vacío)' }}
            </td>
            <!-- Valor actual en el cliente (muteado) -->
            <td class="align-middle small text-muted">
              {{ item.sample_client_value !== undefined ? (item.sample_client_value || '-') : '-' }}
            </td>
            <!-- Badges con el slug de cada API donde hay diferencia -->
            <td class="align-middle">
              <span
                v-for="api_url in item.affected_apis"
                :key="api_url"
                class="badge bg-warning text-dark me-1 small"
                :title="api_url"
              >
                {{ short_api_label(api_url) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Tab "Variables .env" del panel de actualización de cliente.
 *
 * Al montarse, ejecuta check_diff_all para el cliente del update,
 * listando todas las variables comunes que difieren en cualquiera de sus APIs.
 * Permite seleccionar variables y aplicarlas a todas las APIs con un solo clic.
 */
export default {
  name: 'TabEnvVars',

  props: {
    /**
     * Objeto completo del update (ClientVersionUpgrade).
     * Debe tener update.client.id para hacer la llamada al backend.
     */
    update: { type: Object, default: null },
  },

  data() {
    return {
      /** Indica si se está cargando el diff inicial vía SSH. */
      loading: false,

      /** Mensaje de error global si no se pudo ejecutar el check (no SSH por API). */
      global_error: null,

      /** Resultados del check_diff_all: array de { client_api_id, api_url, diffs, error }. */
      results: [],

      /** Keys seleccionadas por el usuario para aplicar al hacer clic en el botón. */
      selected_keys: [],

      /** Indica si se está ejecutando el apply_diff_all. */
      applying: false,

      /** Resultado de la última aplicación: { updated_apis, failed_apis, has_errors }. */
      apply_result: null,
    }
  },

  computed: {
    /**
     * Merge de todos los diffs de todas las APIs, agrupados por key de variable.
     * Cada item incluye las APIs donde esa variable difiere (affected_apis).
     *
     * Estructura devuelta:
     * [{ key, template_value, sample_client_value, affected_apis: [api_url] }]
     *
     * @returns {Array}
     */
    all_diffs_by_key() {
      /* Mapa intermedio para agrupar las diferencias por key. */
      var map = {}

      this.results.forEach(function (result) {
        result.diffs.forEach(function (diff) {
          /* Si la key no existe aún en el mapa, la inicializa. */
          if (!map[diff.key]) {
            map[diff.key] = {
              key:                 diff.key,
              template_value:      diff.template_value,
              /* Toma el primer valor de cliente encontrado como muestra representativa. */
              sample_client_value: diff.client_value,
              affected_apis:       [],
            }
          }
          map[diff.key].affected_apis.push(result.api_url)
        })
      })

      return Object.values(map)
    },
  },

  watch: {
    /**
     * Recarga el diff cuando cambia el objeto update (por ejemplo, al navegar entre registros).
     */
    update: {
      immediate: true,
      handler(val) {
        if (val && val.id) {
          this.load_diffs()
        }
      },
    },
  },

  methods: {
    /**
     * Llama a check_diff_all y carga los diffs de todas las APIs del cliente del update.
     * Selecciona todas las keys por defecto para facilitar la aplicación masiva.
     *
     * @returns {void}
     */
    load_diffs() {
      var self = this

      /* Obtiene el ID del cliente a partir del objeto update. */
      var client_id = self.update && self.update.client && self.update.client.id

      if (!client_id) {
        self.global_error = 'No se pudo obtener el ID del cliente del update.'
        return
      }

      self.loading = true
      self.global_error = null
      self.results = []
      self.selected_keys = []
      self.apply_result = null

      api.post('/env-template/check-diff-all/' + client_id).then(function (res) {
        self.results = res.data.results || []

        /* Selecciona todas las keys con diferencias por defecto. */
        self.selected_keys = self.all_diffs_by_key.map(function (item) { return item.key })
        self.loading = false
      }).catch(function () {
        self.global_error = 'No se pudo cargar el diff de variables. Intentá de nuevo.'
        self.loading = false
      })
    },

    /**
     * Llama a apply_diff_all con las keys seleccionadas y recarga el diff al terminar.
     * Si hay errores en algunas APIs, los muestra sin bloquear las exitosas.
     *
     * @returns {void}
     */
    apply_selected() {
      var self = this
      var client_id = self.update && self.update.client && self.update.client.id

      if (!client_id || self.selected_keys.length === 0) {
        return
      }

      self.applying = true
      self.apply_result = null

      api.post('/env-template/apply-diff-all/' + client_id, { keys: self.selected_keys })
        .then(function (res) {
          var updated = res.data.updated_apis || 0
          var failed  = res.data.failed_apis  || []

          /* Almacena el resultado para mostrarlo en la UI. */
          self.apply_result = {
            updated_apis: updated,
            failed_apis:  failed,
            has_errors:   failed.length > 0,
          }

          /* Recarga el diff para confirmar que las variables quedaron en sync. */
          self.load_diffs()
        })
        .catch(function () {
          self.apply_result = {
            updated_apis: 0,
            failed_apis:  [{ api_url: 'todas', error: 'Error al aplicar. Intentá de nuevo.' }],
            has_errors:   true,
          }
        })
        .then(function () {
          self.applying = false
        })
    },

    /**
     * Alterna el estado de selección de una key individual.
     *
     * @param {string} key  Nombre de la variable a seleccionar o deseleccionar.
     * @returns {void}
     */
    toggle_key(key) {
      /* Busca el índice de la key en el array de seleccionadas. */
      var idx = this.selected_keys.indexOf(key)
      if (idx === -1) {
        this.selected_keys.push(key)
      } else {
        this.selected_keys.splice(idx, 1)
      }
    },

    /**
     * Selecciona todas las keys si no están todas seleccionadas; de lo contrario las deselecciona.
     *
     * @returns {void}
     */
    toggle_all() {
      if (this.selected_keys.length === this.all_diffs_by_key.length) {
        /* Deselecciona todo. */
        this.selected_keys = []
      } else {
        /* Selecciona todas las keys disponibles. */
        this.selected_keys = this.all_diffs_by_key.map(function (item) { return item.key })
      }
    },

    /**
     * Extrae el primer segmento del hostname de una URL de API como label corto para badges.
     * Por ejemplo: "https://api.micliente.com" → "api"
     *
     * @param {string} url  URL completa de la API.
     * @returns {string}    Slug del subdominio o la URL completa si no se puede parsear.
     */
    short_api_label(url) {
      try {
        var hostname = new URL(url).hostname
        return hostname.split('.')[0]
      } catch (e) {
        return url
      }
    },
  },
}
</script>
