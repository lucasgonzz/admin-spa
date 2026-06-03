<template>
  <div class="support-kb-panel border-start bg-white d-flex flex-column h-100">
    <div class="support-kb-panel-header d-flex align-items-center justify-content-between p-2 border-bottom">
      <h2 class="h6 mb-0">Base de conocimiento</h2>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="$emit('close')">Cerrar</button>
    </div>

    <div class="p-2 border-bottom">
      <button type="button" class="btn btn-sm btn-primary w-100" @click="open_create_modal">Nueva entrada</button>
    </div>

    <div v-if="loading" class="flex-grow-1 d-flex align-items-center justify-content-center text-muted">
      <span class="spinner-border spinner-border-sm me-2" /> Cargando…
    </div>

    <div v-else class="support-kb-panel-body flex-grow-1 overflow-auto p-2">
      <div v-if="!entries.length" class="text-muted small">Sin entradas todavía.</div>
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="support-kb-entry border rounded p-2 mb-2">
        <div class="d-flex align-items-start justify-content-between gap-2">
          <div class="min-w-0 flex-grow-1">
            <div class="fw-semibold text-truncate">{{ entry.title }}</div>
            <small class="text-muted d-block text-truncate">{{ content_preview(entry.content) }}</small>
          </div>
          <span
            class="badge flex-shrink-0"
            :class="entry.is_active ? 'bg-success' : 'bg-secondary'">
            {{ entry.is_active ? 'Activa' : 'Inactiva' }}
          </span>
        </div>
        <div class="d-flex flex-wrap gap-1 mt-2">
          <button type="button" class="btn btn-sm btn-outline-primary" @click="open_edit_modal(entry)">Editar</button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="toggle_active(entry)">
            {{ entry.is_active ? 'Desactivar' : 'Activar' }}
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" @click="remove_entry(entry)">Eliminar</button>
        </div>
      </div>
    </div>

    <base-modal :show="modal_visible" :title="modal_title" @update:show="modal_visible = $event" @close="close_modal">
      <div class="mb-3">
        <label class="form-label">Título</label>
        <input v-model="form.title" type="text" class="form-control" maxlength="255" />
      </div>
      <div class="mb-3">
        <label class="form-label">Contenido</label>
        <textarea v-model="form.content" class="form-control" rows="8" />
      </div>
      <div class="form-check mb-3">
        <input id="kb_is_active" v-model="form.is_active" class="form-check-input" type="checkbox" />
        <label class="form-check-label" for="kb_is_active">Activa</label>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-secondary btn-sm" @click="close_modal">Cancelar</button>
        <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="save_entry">
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </base-modal>
  </div>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Panel lateral para ABM de la base de conocimiento de soporte (Claude).
 */
export default {
  name: 'SupportKnowledgeBasePanel',
  components: {
    BaseModal,
  },
  emits: ['close'],
  data() {
    return {
      /** Filas devueltas por GET /support-knowledge-base. */
      entries: [],
      /** Carga inicial del listado. */
      loading: true,
      /** Modal de alta/edición visible. */
      modal_visible: false,
      /** Id en edición; null en alta. */
      editing_id: null,
      /** Formulario del modal. */
      form: {
        title: '',
        content: '',
        is_active: true,
      },
      /** Guardado en curso. */
      saving: false,
    }
  },
  computed: {
    /**
     * Título del modal según modo crear/editar.
     *
     * @returns {string}
     */
    modal_title() {
      return this.editing_id ? 'Editar entrada' : 'Nueva entrada'
    },
  },
  mounted() {
    this.load_entries()
  },
  methods: {
    /**
     * GET listado de entradas de conocimiento.
     *
     * @returns {void}
     */
    load_entries() {
      const self = this
      self.loading = true
      api
        .get('/support-knowledge-base')
        .then(function (res) {
          self.entries = (res.data && res.data.models) || []
        })
        .catch(function () {
          self.entries = []
        })
        .then(function () {
          self.loading = false
        })
    },
    /**
     * Preview corto del contenido para la fila del listado.
     *
     * @param {string} content
     * @returns {string}
     */
    content_preview(content) {
      const text = String(content || '').replace(/\s+/g, ' ').trim()
      if (text.length <= 80) {
        return text
      }
      return text.slice(0, 77) + '…'
    },
    /**
     * Abre modal en modo creación.
     *
     * @returns {void}
     */
    open_create_modal() {
      this.editing_id = null
      this.form = {
        title: '',
        content: '',
        is_active: true,
      }
      this.modal_visible = true
    },
    /**
     * Abre modal precargado para editar una entrada.
     *
     * @param {Object} entry
     * @returns {void}
     */
    open_edit_modal(entry) {
      this.editing_id = entry.id
      this.form = {
        title: entry.title || '',
        content: entry.content || '',
        is_active: !!entry.is_active,
      }
      this.modal_visible = true
    },
    /**
     * Cierra modal y limpia estado de edición.
     *
     * @returns {void}
     */
    close_modal() {
      this.modal_visible = false
      this.editing_id = null
    },
    /**
     * POST o PUT según modo del modal.
     *
     * @returns {void}
     */
    save_entry() {
      const self = this
      const title = String(self.form.title || '').trim()
      const content = String(self.form.content || '').trim()
      if (!title || !content) {
        return
      }
      self.saving = true
      const payload = {
        title: title,
        content: content,
        is_active: !!self.form.is_active,
      }
      const request = self.editing_id
        ? api.put('/support-knowledge-base/' + self.editing_id, payload)
        : api.post('/support-knowledge-base', payload)

      request
        .then(function () {
          self.close_modal()
          self.load_entries()
        })
        .finally(function () {
          self.saving = false
        })
    },
    /**
     * Alterna is_active sin eliminar la entrada.
     *
     * @param {Object} entry
     * @returns {void}
     */
    toggle_active(entry) {
      const self = this
      api
        .put('/support-knowledge-base/' + entry.id, {
          is_active: !entry.is_active,
        })
        .then(function () {
          self.load_entries()
        })
    },
    /**
     * DELETE con confirmación del navegador.
     *
     * @param {Object} entry
     * @returns {void}
     */
    remove_entry(entry) {
      const self = this
      if (!window.confirm('¿Eliminar esta entrada de la base de conocimiento?')) {
        return
      }
      api.delete('/support-knowledge-base/' + entry.id).then(function () {
        self.load_entries()
      })
    },
  },
}
</script>

<style scoped>
.support-kb-panel {
  width: 320px;
  min-width: 280px;
  max-width: 40%;
}

.support-kb-panel-header {
  flex-shrink: 0;
}

.support-kb-entry {
  background: #fafbfc;
}
</style>
