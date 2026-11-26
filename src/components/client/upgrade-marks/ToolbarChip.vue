<template>
  <!--
    Botón «Requieren actualización (N)» de la barra del listado de clientes: filtra a los clientes con algo
    ya integrado (corrección o funcionalidad) que todavía no tienen instalado, y al volver a tocarlo deja el
    listado completo. Sin las rutas de marcas en el admin (404) o sin clientes marcados no se muestra.
  -->
  <button
    v-if="visible"
    type="button"
    class="btn btn-sm text-nowrap upgrade-marks-chip"
    :class="filter_active ? 'btn-secondary' : 'btn-outline-secondary'"
    :aria-pressed="filter_active ? 'true' : 'false'"
    :title="filter_active ? 'Volver a todos los clientes' : 'Ver sólo los clientes que requieren actualización'"
    @click="on_toggle">
    <i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>{{ label }}
  </button>
</template>

<script>
import api from '@/utils/axios'
import {
  UPGRADE_MARKS_CHANGED_EVENT,
  chip_label,
  chip_visible,
  is_upgrade_filter_active,
  normalize_marks_response,
  toggle_upgrade_filter,
} from '@/utils/client_upgrade_marks'

/**
 * Botón del listado de clientes que aplica (o saca) el filtro de la columna `requires_upgrade`. Usa el store
 * del recurso `client` con las mismas mutaciones y acciones que el modal de filtro de columna de ResourceView.
 */
export default {
  name: 'UpgradeMarksToolbarChip',
  data() {
    return {
      // Totales del GET; null mientras no cargó o si el admin todavía no tiene las rutas.
      totales: null,
    }
  },
  computed: {
    /**
     * Filtros actuales del listado de clientes.
     *
     * @returns {Array<Object>}
     */
    filters() {
      const state = this.$store.state.client
      return state && state.filters ? state.filters : []
    },
    /**
     * Si el filtro de «requiere actualización» está puesto.
     *
     * @returns {boolean}
     */
    filter_active() {
      return is_upgrade_filter_active(this.filters)
    },
    /**
     * Si el botón se muestra.
     *
     * @returns {boolean}
     */
    visible() {
      return chip_visible(this.totales, this.filter_active)
    },
    /**
     * Texto del botón con el conteo.
     *
     * @returns {string}
     */
    label() {
      return chip_label(this.totales)
    },
  },
  mounted() {
    this.load_totals()
    window.addEventListener(UPGRADE_MARKS_CHANGED_EVENT, this.load_totals)
  },
  beforeUnmount() {
    window.removeEventListener(UPGRADE_MARKS_CHANGED_EVENT, this.load_totals)
  },
  methods: {
    /**
     * Pide las marcas abiertas sólo para el conteo. Un error (p. ej. 404 de un admin viejo) oculta el botón
     * sin avisar: no es un problema que el operador tenga que ver.
     *
     * @returns {void}
     */
    load_totals() {
      const self = this
      api
        .get('client-upgrade-marks', { silent_error: true })
        .then(function (res) {
          self.totales = normalize_marks_response(res.data).totales
        })
        .catch(function () {
          self.totales = null
        })
    },
    /**
     * Aplica o saca el filtro. Para volver al listado completo repite lo que hace ResourceView al limpiar
     * filtros (mutaciones públicas del store del recurso) y recarga la lista base.
     *
     * @returns {void}
     */
    on_toggle() {
      const plan = toggle_upgrade_filter(this.filters)
      this.$store.commit('client/set_filters', plan.filters)
      this.$store.commit('client/set_filter_page', 1)
      if (plan.action === 'run') {
        this.$store.dispatch('client/run_filter', { page: 1 })
        return
      }
      this.$store.commit('client/set_filtered', [])
      this.$store.commit('client/set_is_filtered', false)
      this.$store.commit('client/set_total_filter_results', 0)
      this.$store.dispatch('client/get_models')
    },
  },
}
</script>
