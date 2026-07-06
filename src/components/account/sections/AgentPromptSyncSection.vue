<template>
  <div class="agent-prompt-sync-section">
    <p class="text-muted small mb-3">
      Descarga desde GitHub <strong>todos</strong> los archivos relevantes del agente Martín
      (identidad, system prompt y protocolo de WhatsApp) y los guarda en la base de datos.
      Usá este botón después de editar los archivos en el repositorio
      <code>lucasgonzz/claude-comerciocity</code>. La sincronización también corre sola en
      background cada 10 minutos.
    </p>

    <div class="mb-3">
      <p class="small mb-1"><strong>Archivos sincronizados:</strong></p>
      <p v-if="loading_files" class="small text-muted mb-0">Cargando lista de archivos…</p>
      <p v-else-if="files_error" class="small text-danger mb-0">No se pudo cargar la lista de archivos.</p>
      <ul v-else class="small text-muted mb-0">
        <li v-for="f in files" :key="f.repo_path">
          <code>{{ f.repo_path }}</code> → {{ f.label }}
        </li>
      </ul>
    </div>

    <button
      type="button"
      class="btn btn-primary btn-sm"
      :disabled="syncing"
      @click="on_sync"
    >
      {{ syncing ? 'Sincronizando…' : '↓ Sincronizar desde GitHub' }}
    </button>

    <!-- Resultados por archivo -->
    <div v-if="results.length" class="mt-3">
      <p class="small fw-semibold mb-1">Resultado:</p>
      <ul class="list-unstyled mb-0">
        <li
          v-for="r in results"
          :key="r.file"
          class="small"
          :class="r.ok ? 'text-success' : 'text-danger'"
        >
          {{ r.ok ? '✓' : '✗' }} {{ r.file }}
          <span v-if="r.error"> — {{ r.error }}</span>
        </li>
      </ul>
      <p v-if="all_ok" class="text-success small mt-2 mb-0">Prompts sincronizados correctamente.</p>
      <p v-else-if="results.length" class="text-danger small mt-2 mb-0">Algunos archivos no se pudieron sincronizar.</p>
    </div>

    <p v-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Sección en Cuenta: sincroniza prompts de agentes desde GitHub a la BD.
 *
 * GET  /settings/agent-prompts/files — lista de archivos que se sincronizan
 * POST /settings/agent-prompts/sync
 */
export default {
  name: 'AgentPromptSyncSection',
  data() {
    return {
      /** Request en curso. */
      syncing: false,
      /** Resultados por archivo devueltos por el servidor. */
      results: [],
      /** Error genérico de red o servidor. */
      error_message: '',
      /** Archivos configurados en el backend para sincronización. */
      files: [],
      /** Carga inicial de la lista de archivos. */
      loading_files: true,
      /** Falló el GET de archivos al montar. */
      files_error: false,
    }
  },
  mounted() {
    var self = this
    api
      .get('/settings/agent-prompts/files')
      .then(function (res) {
        self.files = res.data.files || []
      })
      .catch(function () {
        self.files_error = true
      })
      .then(function () {
        self.loading_files = false
      })
  },
  computed: {
    all_ok() {
      return this.results.length > 0 && this.results.every(function (r) { return r.ok })
    },
  },
  methods: {
    on_sync() {
      var self = this
      self.syncing = true
      self.results = []
      self.error_message = ''
      api
        .post('/settings/agent-prompts/sync')
        .then(function (res) {
          self.results = res.data.results || []
        })
        .catch(function (err) {
          var data = err.response && err.response.data
          if (data && data.results) {
            self.results = data.results
          } else {
            self.error_message = 'No se pudo conectar con el servidor.'
          }
        })
        .then(function () {
          self.syncing = false
        })
    },
  },
}
</script>
