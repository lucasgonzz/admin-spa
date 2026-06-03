<template>
  <div>
    <button class="btn btn-outline-primary btn-sm" @click="show = true">
      <i class="bi bi-eye" /> Columnas
    </button>
    <base-modal :show="show" title="Columnas a mostrar" size="lg" @update:show="show = $event" @close="show = false">
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Visibilidad</th>
              <th style="width: 140px">Ancho</th>
              <th style="width: 150px">Salto de linea.</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(p, idx) in local_rows"
              :key="p.key"
              :class="{ 'table-primary': drag_index === idx }"
              @dragover.prevent="on_drag_over(idx)"
              @drop.prevent="on_drop(idx)"
            >
              <td>
                <div
                  class="d-flex align-items-center gap-2 drag_handle"
                  draggable="true"
                  @dragstart="on_drag_start(idx)"
                  @dragend="on_drag_end"
                >
                  <i class="bi bi-grip-vertical text-muted" title="Arrastrar para ordenar" />
                  <label class="mb-0 form-check-label d-flex align-items-center gap-1">
                    <input v-model="p.show" type="checkbox" class="form-check-input" />
                    {{ p.text }}
                  </label>
                </div>
              </td>
              <td>
                <input
                  v-model.number="p.width"
                  type="number"
                  min="40"
                  max="800"
                  class="form-control form-control-sm"
                  style="max-width: 6rem"
                />
              </td>
              <td>
                <label class="mb-0 form-check-label d-flex align-items-center gap-1">
                  <input v-model="p.wrap_content" type="checkbox" class="form-check-input" />
                  <span>Sí</span>
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="show = false">Cerrar</button>
        <button type="button" class="btn btn-primary" @click="save">Guardar</button>
      </template>
    </base-modal>
  </div>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Configuración de visibilidad y ancho; persiste en column-preferences.
 */
export default {
  name: 'PropsToShowButton',
  components: { BaseModal },
  props: {
    model_name: { type: String, required: true },
    default_properties: { type: Array, default: () => [] },
  },
  data() {
    return {
      show: false,
      local_rows: [],
      drag_index: null,
    }
  },
  watch: {
    show(v) {
      if (v) {
        this.load_local()
      }
    },
  },
  methods: {
    /**
     * Carga configuración guardada y, si no existe, inicializa con defaults.
     * @returns {void}
     */
    load_local() {
      const self = this
      api
        .get('/column-preferences/' + this.model_name)
        .then((res) => {
          const saved = (res.data && res.data.properties) || []
          if (saved && saved.length) {
            self.local_rows = JSON.parse(JSON.stringify(saved))
          } else {
            self.local_rows = self.default_properties
              .filter((p) => p.key && !p.not_show_on_table)
              .map((p) => {
                return {
                  key: p.key,
                  text: p.text,
                  show: p.show !== false,
                  width: p.width || 120,
                  wrap_content: !!p.wrap_content,
                }
              })
          }
        })
        .catch(function () {
          self.local_rows = self.default_properties
            .filter((p) => p.key && !p.not_show_on_table)
            .map((p) => {
              return {
                key: p.key,
                text: p.text,
                show: p.show !== false,
                width: p.width || 120,
                wrap_content: !!p.wrap_content,
              }
            })
        })
    },
    /**
     * Registra el índice de inicio para el reordenamiento drag and drop.
     * @param {number} idx índice de la fila origen.
     * @returns {void}
     */
    on_drag_start(idx) {
      // Guarda la posición de origen para mover la fila al hacer drop.
      this.drag_index = idx
    },
    /**
     * Mantiene la referencia visual de la fila de destino al pasar el cursor.
     * @param {number} idx índice de la fila destino.
     * @returns {void}
     */
    on_drag_over(idx) {
      // No hace falta alterar datos aquí; solo mantiene comportamiento explícito.
      return idx
    },
    /**
     * Reordena las columnas moviendo la fila desde drag_index hasta idx.
     * @param {number} idx índice de destino final.
     * @returns {void}
     */
    on_drop(idx) {
      // Si no hay origen definido o el destino es el mismo, no se modifica el orden.
      if (this.drag_index === null || this.drag_index === idx) {
        this.drag_index = null
        return
      }
      // Extrae la fila arrastrada y la inserta en la nueva posición.
      const moved_row = this.local_rows.splice(this.drag_index, 1)[0]
      this.local_rows.splice(idx, 0, moved_row)
      this.drag_index = null
    },
    /**
     * Limpia el estado temporal de drag cuando finaliza la interacción.
     * @returns {void}
     */
    on_drag_end() {
      this.drag_index = null
    },
    /**
     * Persiste la configuración de columnas en la API y emite evento saved.
     * @returns {void}
     */
    save() {
      const self = this
      api
        .put('/column-preferences/' + this.model_name, { properties: this.local_rows })
        .then(function () {
          self.$emit('saved', self.local_rows)
          self.show = false
        })
    },
  },
}
</script>

<style scoped>
.drag_handle {
  cursor: grab;
  user-select: none;
}
</style>
