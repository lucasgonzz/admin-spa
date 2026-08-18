<template>
  <base-modal
    :show="show"
    title="Confirmá el rango de versiones a aplicar"
    size="lg"
    :stack_level="1"
    @update:show="on_modal_show_update"
    @close="on_cancel"
  >
    <p class="text-muted small mb-3">
      Tramo <code>{{ from_label }}</code> → <code>{{ to_label }}</code>. Los hotfixes vienen
      destildados por defecto: tildá los que corresponda incluir en esta actualización.
    </p>

    <!-- Spinner mientras se calcula el rango en el backend -->
    <div v-if="loading" class="d-flex justify-content-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </div>

    <template v-else>
      <table v-if="candidates.length" class="table table-sm mb-0">
        <thead class="table-light">
          <tr>
            <th style="width: 40px"></th>
            <th>Código</th>
            <th>Título</th>
            <th>Descripción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="candidate in candidates" :key="candidate.id">
            <!-- Checkbox de inclusión. La fila destino queda siempre tildada y disabled:
                 el array final se arma desde selected_ids, no desde lo que el DOM mande. -->
            <td class="align-middle text-center">
              <input
                :id="'version-range-' + candidate.id"
                v-model="selected_ids[candidate.id]"
                type="checkbox"
                class="form-check-input"
                :disabled="candidate.is_target"
              />
            </td>
            <td class="align-middle">
              <code>{{ candidate.version }}</code>
              <span v-if="candidate.is_hotfix" class="badge bg-warning text-dark ms-1">Hotfix</span>
            </td>
            <td class="align-middle">{{ candidate.title }}</td>
            <td class="align-middle small text-muted">{{ candidate.description }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Sin candidatas: no debería abrirse el modal en este caso, pero se cubre igual -->
      <p v-else class="text-muted small mb-0">
        No hay versiones candidatas para este tramo.
      </p>
    </template>

    <template #footer>
      <button type="button" class="btn btn-outline-secondary" :disabled="loading" @click="on_cancel">
        Cancelar
      </button>
      <button type="button" class="btn btn-primary" :disabled="loading" @click="on_confirm">
        Confirmar y crear
      </button>
    </template>
  </base-modal>
</template>

<script>
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Modal de confirmación del rango de versiones a aplicar en una actualización.
 *
 * Se abre después de `POST /update/preview` cuando hay candidatas en el tramo
 * (from, to] entre la versión actual del cliente y la versión destino elegida.
 * El admin puede destildar hotfixes que no correspondan a este cliente; la
 * versión destino siempre queda incluida y no se puede destildar.
 */
export default {
  name: 'UpdateVersionRangeModal',
  components: { BaseModal },
  props: {
    /** Visibilidad del modal. */
    show: { type: Boolean, default: false },
    /** Candidatas del rango, tal como las devuelve `preview_json` (ver UpdateController). */
    candidates: { type: Array, default: () => [] },
    /** Versión actual del cliente, o null si es una instalación nueva. */
    from_version: { type: Object, default: null },
    /** Versión destino elegida en el paso 1. */
    to_version: { type: Object, default: null },
    /** true mientras se está calculando el rango en el backend. */
    loading: { type: Boolean, default: false },
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      /**
       * Estado de tilde por id de versión candidata: `{ [id]: boolean }`.
       * Se reinicializa completo cada vez que cambian las candidatas.
       */
      selected_ids: {},
    }
  },
  computed: {
    /**
     * Código de la versión de origen, o leyenda de instalación nueva si el cliente no tiene una.
     *
     * @returns {string}
     */
    from_label() {
      return this.from_version ? this.from_version.version : '(instalación nueva)'
    },
    /**
     * Código de la versión destino.
     *
     * @returns {string}
     */
    to_label() {
      return this.to_version ? this.to_version.version : ''
    },
  },
  watch: {
    /**
     * Arranca la selección de cada candidata nueva según su `default_checked`
     * (troncal sí, hotfix no, destino siempre) calculado por el backend.
     *
     * @param {Array<Object>} new_candidates
     * @returns {void}
     */
    candidates: {
      immediate: true,
      handler(new_candidates) {
        const selected = {}
        ;(new_candidates || []).forEach(function (candidate) {
          selected[candidate.id] = !!candidate.default_checked
        })
        this.selected_ids = selected
      },
    },
  },
  methods: {
    /**
     * BaseModal se cerró por click en el backdrop, Escape o el botón "X": equivale a cancelar.
     *
     * @param {boolean} is_visible
     * @returns {void}
     */
    on_modal_show_update(is_visible) {
      if (!is_visible) {
        this.on_cancel()
      }
    },

    /**
     * Emite la confirmación con el array final de ids tildados. Arma el array desde
     * `selected_ids` (no desde el DOM) y garantiza que la versión destino esté incluida
     * aunque su checkbox esté disabled.
     *
     * @returns {void}
     */
    on_confirm() {
      const self = this
      const ids = []

      Object.keys(this.selected_ids).forEach(function (id) {
        if (self.selected_ids[id]) {
          ids.push(parseInt(id, 10))
        }
      })

      if (this.to_version && this.to_version.id && ids.indexOf(this.to_version.id) === -1) {
        ids.push(this.to_version.id)
      }

      this.$emit('confirm', ids)
    },

    /**
     * Cancela la confirmación del rango (y con eso, la creación de la actualización).
     *
     * @returns {void}
     */
    on_cancel() {
      this.$emit('cancel')
    },
  },
}
</script>
