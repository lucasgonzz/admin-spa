<template>
  <div class="ai-system-prompt-section">
    <div class="alert alert-info py-2 small mb-3" role="alert">
      Este texto es solo el esqueleto (contexto y formato JSON). El protocolo completo de ventas
      se sincroniza desde GitHub a la base de datos con el botón «Sincronizar desde GitHub»
      (sección «Prompts de agentes»), no se edita acá.
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
