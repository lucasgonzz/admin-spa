<template>
  <div class="border rounded p-3 bg-light">
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
      <label class="form-label fw-semibold mb-0">{{ field_label }}</label>
      <button type="button" class="btn btn-sm btn-outline-primary" @click="on_add_row">+ Agregar video</button>
    </div>
    <p class="small text-muted mb-3">
      Se incluyen en el mail «Mail 1 - DEMO» debajo de los videos generales cuando tengan link al video.
      <strong>Comentarios</strong> es solo para vos (no va al mail): brief de qué debería tratar el video antes de completar título y descripción.
    </p>
    <div v-if="!local_rows.length" class="text-muted small mb-0">Sin videos personalizados. Podés agregar uno o más con el botón de arriba.</div>
    <div v-for="(row, idx) in local_rows" :key="row._key" class="card mb-2">
      <div class="card-body py-2">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
          <span class="small text-muted">Video {{ idx + 1 }}</span>
          <button type="button" class="btn btn-sm btn-outline-danger" @click="on_remove_row(idx)">Quitar</button>
        </div>
        <div class="row g-2">
          <div class="col-12">
            <label class="form-label small mb-0">Comentarios <span class="text-muted fw-normal">(interno, no va al mail)</span></label>
            <textarea
              v-model="row.comments"
              rows="2"
              class="form-control form-control-sm"
              placeholder="Ej.: mostrar carga masiva de artículos desde Excel para ferretería"
              @input="emit_update"
            ></textarea>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label small mb-0">Título</label>
            <input v-model="row.title" type="text" class="form-control form-control-sm" placeholder="Ej.: Carga masiva de artículos" @input="emit_update" />
          </div>
          <div class="col-12 col-md-8">
            <label class="form-label small mb-0">Link al video</label>
            <input v-model="row.video_url" type="text" class="form-control form-control-sm" placeholder="https://..." @input="emit_update" />
          </div>
          <div class="col-12">
            <label class="form-label small mb-0">Descripción</label>
            <textarea v-model="row.description" rows="2" class="form-control form-control-sm" placeholder="Texto corto que verá el prospecto junto al título" @input="emit_update"></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
let __demo_video_row_seq = 0

/**
 * Editor de la lista `personalized_demo_videos` del lead (admin-spa).
 * Emite `update:modelValue` con objetos planos serializables al guardar el modal.
 */
export default {
  name: 'LeadPersonalizedDemoVideosEditor',
  props: {
    /** Texto de etiqueta principal (viene del meta `text` de la property). */
    field_label: { type: String, default: 'Videos tutoriales personalizados' },
    /** Filas actuales: `{ id?, title, description, comments, video_url }`. */
    modelValue: { type: Array, default: () => [] },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      /** Copia editable con clave estable `_key` para el v-for. */
      local_rows: [],
    }
  },
  watch: {
    modelValue: {
      deep: true,
      handler: function (next) {
        const self = this
        const incoming = self.normalize_payload(next)
        const current = self.normalize_payload(self.local_rows)
        if (JSON.stringify(incoming) === JSON.stringify(current)) {
          return
        }
        self.sync_from_prop(next)
      },
    },
  },
  mounted() {
    this.sync_from_prop(this.modelValue)
  },
  methods: {
    /**
     * Convierte filas API o locales a forma comparable (sin `_key`).
     * @param {Array<Object>|undefined|null} rows
     * @returns {Array<Object>}
     */
    normalize_payload(rows) {
      const source = Array.isArray(rows) ? rows : []
      return source.map(function (r) {
        return {
          id: r && r.id != null && r.id !== '' ? r.id : null,
          title: r && r.title != null ? String(r.title) : '',
          description: r && r.description != null ? String(r.description) : '',
          comments: r && r.comments != null ? String(r.comments) : '',
          video_url: r && r.video_url != null ? String(r.video_url) : '',
        }
      })
    },
    /**
     * Clona el valor entrante del padre hacia `local_rows`.
     * @param {Array<Object>|undefined|null} rows
     * @returns {void}
     */
    sync_from_prop(rows) {
      const self = this
      const source = Array.isArray(rows) ? rows : []
      self.local_rows = source.map(function (r) {
        return {
          _key: 'k' + __demo_video_row_seq++,
          id: r && r.id != null ? r.id : null,
          title: r && r.title != null ? String(r.title) : '',
          description: r && r.description != null ? String(r.description) : '',
          comments: r && r.comments != null ? String(r.comments) : '',
          video_url: r && r.video_url != null ? String(r.video_url) : '',
        }
      })
    },
    /**
     * Emite el payload limpio (sin `_key`) hacia el formulario del modal.
     * @returns {void}
     */
    emit_update() {
      const self = this
      const out = []
      self.local_rows.forEach(function (r) {
        const item = {
          title: r.title,
          description: r.description,
          comments: r.comments,
          video_url: r.video_url,
        }
        if (r.id != null && r.id !== '') {
          item.id = r.id
        }
        out.push(item)
      })
      self.$emit('update:modelValue', out)
    },
    /**
     * Agrega una fila vacía al final.
     * @returns {void}
     */
    on_add_row() {
      this.local_rows.push({
        _key: 'k' + __demo_video_row_seq++,
        id: null,
        title: '',
        description: '',
        comments: '',
        video_url: '',
      })
      this.emit_update()
    },
    /**
     * Elimina una fila por índice.
     * @param {number} index índice en `local_rows`.
     * @returns {void}
     */
    on_remove_row(index) {
      this.local_rows.splice(index, 1)
      this.emit_update()
    },
  },
}
</script>
