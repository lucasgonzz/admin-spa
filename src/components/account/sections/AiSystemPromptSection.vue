<template>
  <div class="ai-system-prompt-section">
    <div class="alert alert-info py-2 small mb-3" role="alert">
      Este texto es solo el esqueleto (contexto y formato JSON). El protocolo completo de ventas
      se carga desde GitHub en cada sugerencia; usá «Actualizar protocolo» para forzar la última
      versión.
    </div>

    <div v-if="loading && !contenido_local" class="d-flex align-items-center gap-2 text-muted">
      <span class="spinner-border spinner-border-sm" /> Cargando…
    </div>

    <template v-else>
      <div class="mb-2">
        <label class="form-label small text-muted mb-1" for="ai-prompt-descripcion">Descripción</label>
        <input
          id="ai-prompt-descripcion"
          v-model="descripcion_local"
          type="text"
          class="form-control form-control-sm"
          maxlength="255"
          @input="on_input_change"
        />
      </div>

      <textarea
        v-model="contenido_local"
        class="form-control ai-system-prompt-textarea"
        rows="28"
        spellcheck="false"
        @input="on_input_change"
      />

      <div class="mt-3">
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm"
          :disabled="protocol_refresh_loading"
          @click="on_refresh_protocol"
        >
          <span
            v-if="protocol_refresh_loading"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi bi-arrow-clockwise me-1" aria-hidden="true" />
          Actualizar protocolo
        </button>
        <p class="form-text small text-muted mb-0 mt-2">
          El protocolo se carga automáticamente desde GitHub cada 10 minutos. Usá este botón para
          forzar una actualización inmediata.
        </p>
      </div>

      <div class="d-flex align-items-center gap-3 mt-3">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading || !has_unsaved_changes"
          @click="on_save"
        >
          {{ loading ? 'Guardando…' : 'Guardar cambios' }}
        </button>
        <span v-if="guardado_visible" class="text-success small">✓ Guardado</span>
      </div>
    </template>
  </div>
</template>

<script>
/**
 * Sección de cuenta: editor del system prompt de Claude (texto base en BD).
 */
export default {
  name: 'AiSystemPromptSection',
  data() {
    return {
      /** Copia editable del contenido cargado desde la API. */
      contenido_local: '',
      /** Copia editable de la descripción. */
      descripcion_local: '',
      /** Snapshot para detectar cambios sin guardar. */
      contenido_guardado: '',
      descripcion_guardada: '',
      /** Muestra "✓ Guardado" temporalmente tras guardar con éxito. */
      guardado_visible: false,
      /** Timer para ocultar el mensaje de guardado. */
      guardado_timer: null,
      /** Spinner del botón "Actualizar protocolo". */
      protocol_refresh_loading: false,
    }
  },
  computed: {
    loading() {
      return this.$store.state.ai_system_prompt.loading
    },
    /**
     * Expuesto al padre (Account) para confirmar salida sin guardar.
     *
     * @returns {boolean}
     */
    has_unsaved_changes() {
      return (
        this.contenido_local !== this.contenido_guardado ||
        this.descripcion_local !== this.descripcion_guardada
      )
    },
  },
  mounted() {
    const self = this
    this.$store
      .dispatch('ai_system_prompt/get_prompt')
      .then(function (prompt) {
        self.sync_from_prompt(prompt)
      })
      .catch(function () {
        self.contenido_local = ''
        self.descripcion_local = ''
      })
  },
  beforeUnmount() {
    if (this.guardado_timer) {
      clearTimeout(this.guardado_timer)
    }
  },
  methods: {
    /**
     * Sincroniza el formulario con el registro devuelto por la API.
     *
     * @param {Object|null} prompt registro activo
     * @returns {void}
     */
    sync_from_prompt(prompt) {
      const contenido = prompt && prompt.contenido ? String(prompt.contenido) : ''
      const descripcion =
        prompt && prompt.descripcion ? String(prompt.descripcion) : 'System prompt principal'
      this.contenido_local = contenido
      this.descripcion_local = descripcion
      this.contenido_guardado = contenido
      this.descripcion_guardada = descripcion
    },

    /**
     * Oculta el indicador de guardado al editar de nuevo.
     *
     * @returns {void}
     */
    on_input_change() {
      if (this.guardado_visible) {
        this.guardado_visible = false
        this.$store.commit('ai_system_prompt/set_guardado', false)
      }
      if (this.guardado_timer) {
        clearTimeout(this.guardado_timer)
        this.guardado_timer = null
      }
    },

    /**
     * Persiste contenido y descripción; muestra confirmación 3 segundos.
     *
     * @returns {void}
     */
    on_save() {
      const self = this
      this.$store
        .dispatch('ai_system_prompt/update_prompt', {
          contenido: this.contenido_local,
          descripcion: this.descripcion_local,
        })
        .then(function (prompt) {
          self.sync_from_prompt(prompt)
          self.guardado_visible = true
          if (self.guardado_timer) {
            clearTimeout(self.guardado_timer)
          }
          self.guardado_timer = setTimeout(function () {
            self.guardado_visible = false
            self.$store.commit('ai_system_prompt/set_guardado', false)
            self.guardado_timer = null
          }, 3000)
        })
        .catch(function () {})
    },

    /**
     * Fuerza invalidación de caché del protocolo en GitHub vía admin-api.
     *
     * @returns {void}
     */
    on_refresh_protocol() {
      const self = this
      this.protocol_refresh_loading = true
      this.$store
        .dispatch('ai_system_prompt/refresh_protocol_cache')
        .then(function () {
          window.dispatchEvent(
            new CustomEvent('admin-spa-toast', {
              detail: {
                message:
                  'Protocolo actualizado correctamente. Los próximos mensajes usarán la versión más reciente.',
                variant: 'success',
              },
            })
          )
        })
        .catch(function () {
          /* El interceptor de axios ya muestra toast de error. */
        })
        .then(function () {
          self.protocol_refresh_loading = false
        })
    },
  },
}
</script>

<style scoped>
.ai-system-prompt-textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 0.8125rem;
  line-height: 1.45;
  white-space: pre;
}
</style>
