<template>
  <!--
    Módulo Agente: variantes A/B de mensajes de onboarding y análisis del agente.
    Dos secciones: métricas en tiempo real de variantes activas y propuestas del analizador.
  -->
  <div class="agente-view">

    <!-- Encabezado con botón de refresco manual -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
      <div>
        <h1 class="h4 mb-0 fw-semibold">Agente</h1>
        <p class="text-secondary small mb-0 mt-1">
          Pruebas A/B y análisis automático del mensaje de presentación.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-sm btn-outline-primary"
        :disabled="loading"
        @click="on_refresh"
      >
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true" />
        Actualizar
      </button>
    </div>

    <!-- Error global del store -->
    <div v-if="error" class="alert alert-danger py-2 small mb-4" role="alert">
      {{ error }}
    </div>

    <!-- ── Sección 1: Variantes activas ── -->
    <section class="agente-section mb-5">
      <div class="mb-3">
        <h2 class="h5 mb-1 fw-semibold">
          <i class="bi bi-chat-dots-fill text-primary me-2" aria-hidden="true" />
          Variantes de mensajes
        </h2>
        <p class="text-secondary small mb-0">
          Pruebas A/B en curso — cada lead nuevo recibe una variante aleatoria del mensaje de presentación.
        </p>
      </div>

      <!-- Carga inicial -->
      <div v-if="loading && !variants.length" class="text-center text-muted py-5">
        <span class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
        Cargando variantes…
      </div>

      <!-- Estado vacío -->
      <div
        v-else-if="!variants.length"
        class="card border-0 shadow-sm"
      >
        <div class="card-body text-center text-secondary py-5 small">
          No hay variantes configuradas todavía.
        </div>
      </div>

      <!-- Cards de variantes -->
      <div v-else class="d-flex flex-column gap-4">
        <div
          v-for="variant in variants"
          :key="variant.id"
          class="card border-0 shadow"
        >
          <div class="card-body">

            <!-- Header: nombre, estado y tipo -->
            <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
              <div class="d-flex align-items-center flex-wrap gap-2">
                <span class="fw-semibold">{{ variant.name }}</span>
                <span
                  class="badge"
                  :class="variant.active ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'"
                >
                  {{ variant.active ? 'Activa' : 'Inactiva' }}
                </span>
                <span class="badge bg-primary-subtle text-primary">
                  {{ message_type_label(variant.message_type) }}
                </span>
              </div>
            </div>

            <!-- Cuerpo del mensaje con placeholder resaltado -->
            <div class="agente-variant-body bg-light rounded-3 p-3 mb-3">
              <template v-for="(part, part_index) in body_parts(variant.body)">
                <span
                  v-if="part.is_placeholder"
                  :key="'ph-' + variant.id + '-' + part_index"
                  class="badge bg-warning-subtle text-warning-emphasis align-middle"
                >{nombre}</span>
                <span
                  v-else
                  :key="'tx-' + variant.id + '-' + part_index"
                  class="agente-variant-body__text"
                >{{ part.text }}</span>
              </template>
            </div>

            <!-- Métricas en fila -->
            <div class="row g-3 mb-3 text-center">
              <div class="col-6 col-md-3">
                <div class="fs-4 fw-bold">{{ variant.sent_count || 0 }}</div>
                <div class="small text-muted">Enviados</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="fs-4 fw-bold">
                  {{ variant.responded_count || 0 }}
                  <span v-if="pct_label(variant, 'responded')" class="fs-6 fw-normal text-muted">
                    ({{ pct_label(variant, 'responded') }})
                  </span>
                </div>
                <div class="small text-muted">Respondieron</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="fs-4 fw-bold">
                  {{ variant.scheduled_count || 0 }}
                  <span v-if="pct_label(variant, 'scheduled')" class="fs-6 fw-normal text-muted">
                    ({{ pct_label(variant, 'scheduled') }})
                  </span>
                </div>
                <div class="small text-muted">Agendaron</div>
              </div>
              <div class="col-6 col-md-3">
                <div class="fs-4 fw-bold">
                  {{ variant.attended_count || 0 }}
                  <span v-if="pct_label(variant, 'attended')" class="fs-6 fw-normal text-muted">
                    ({{ pct_label(variant, 'attended') }})
                  </span>
                </div>
                <div class="small text-muted">Hicieron demo</div>
              </div>
            </div>

            <!-- Footer: delay y acciones -->
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 pt-2 border-top">
              <span class="small text-secondary">
                {{ delay_label(variant) }}
              </span>
              <div class="d-flex gap-2">
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="variant.active ? 'btn-outline-secondary' : 'btn-outline-success'"
                  :disabled="action_loading_id === variant.id"
                  @click="on_toggle_active(variant)"
                >
                  {{ variant.active ? 'Desactivar' : 'Activar' }}
                </button>
                <button
                  v-if="(variant.sent_count || 0) === 0"
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  :disabled="action_loading_id === variant.id"
                  @click="on_delete_variant(variant)"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Aviso de confiabilidad estadística -->
        <div
          v-if="has_low_volume_variants"
          class="alert alert-warning py-2 small mb-0"
          role="status"
        >
          <i class="bi bi-info-circle me-1" aria-hidden="true" />
          Algunas variantes tienen menos de 30 envíos — los porcentajes pueden no ser representativos todavía.
        </div>

        <!-- Tabla comparativa entre variantes con volumen suficiente -->
        <div v-if="show_comparison_table" class="card border-0 shadow-sm mt-2">
          <div class="card-body">
            <h3 class="h6 fw-semibold mb-3">Comparación entre variantes</h3>
            <div class="table-responsive">
              <table class="table table-sm table-borderless mb-0 small">
                <thead>
                  <tr class="text-muted">
                    <th>Variante</th>
                    <th class="text-end">Enviados</th>
                    <th class="text-end">Respuesta</th>
                    <th class="text-end">Agendamiento</th>
                    <th class="text-end">Demo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in comparison_rows"
                    :key="row.id"
                  >
                    <td>{{ row.name }}</td>
                    <td class="text-end">{{ row.sent_count }}</td>
                    <td
                      class="text-end"
                      :class="best_pct_class('responded', row.responded_pct)"
                    >
                      {{ row.responded_pct != null ? row.responded_pct + '%' : '-' }}
                    </td>
                    <td
                      class="text-end"
                      :class="best_pct_class('scheduled', row.scheduled_pct)"
                    >
                      {{ row.scheduled_pct != null ? row.scheduled_pct + '%' : '-' }}
                    </td>
                    <td
                      class="text-end"
                      :class="best_pct_class('attended', row.attended_pct)"
                    >
                      {{ row.attended_pct != null ? row.attended_pct + '%' : '-' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Sección 2: Análisis del agente ── -->
    <section class="agente-section">
      <div class="mb-3">
        <h2 class="h5 mb-1 fw-semibold">
          <i class="bi bi-graph-up-arrow text-primary me-2" aria-hidden="true" />
          Análisis y propuestas
        </h2>
      </div>

      <!-- Placeholder mientras no hay reportes del agente analizador -->
      <div v-if="!analysis_runs.length" class="card border-0 shadow-sm">
        <div class="card-body text-secondary small py-4 px-4 lh-base">
          <p class="mb-2">
            El agente analizador todavía no corrió ningún análisis.
          </p>
          <p class="mb-0">
            Cuando haya suficiente volumen de datos, el agente revisará
            las variantes, identificará la ganadora y propondrá cambios
            para tu aprobación.
          </p>
        </div>
      </div>

      <!-- Lista de reportes pasados del agente analizador -->
      <div v-else class="d-flex flex-column gap-2">
        <div
          v-for="run in analysis_runs"
          :key="run.id"
          class="card border-0 shadow-sm"
        >
          <div class="card-body small">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
              <span class="fw-semibold">{{ format_analysis_date(run.report_date || run.created_at) }}</span>
              <span
                v-if="run.report_type"
                class="badge bg-primary-subtle text-primary"
              >
                {{ run.report_type === 'weekly' ? 'Semanal' : 'Diario' }}
              </span>
            </div>
            <p class="mb-0 text-secondary">
              {{ run.executive_summary || 'Análisis registrado.' }}
            </p>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Vista del módulo Agente: panel de variantes A/B y sección de análisis.
 */
export default {
  name: 'AgenteView',

  data() {
    return {
      /** Segundos del delay global de welcome (desde settings). */
      global_welcome_delay_seconds: 30,
      /** Id de variante con acción en curso (toggle o delete). */
      action_loading_id: null,
      /** Reportes del agente analizador devueltos por GET /admin/agent-report. */
      analysis_runs: [],
    }
  },

  computed: {
    /** Variantes cargadas desde el store. */
    variants() {
      return this.$store.state.agente.variants
    },

    /** Indica si hay una carga en curso. */
    loading() {
      return this.$store.state.agente.loading
    },

    /** Mensaje de error del store. */
    error() {
      return this.$store.state.agente.error
    },

    /**
     * true si alguna variante tiene menos de 30 envíos.
     *
     * @returns {boolean}
     */
    has_low_volume_variants() {
      const self = this
      return self.variants.some(function (v) {
        return (v.sent_count || 0) > 0 && (v.sent_count || 0) < 30
      })
    },

    /**
     * Filas para la tabla comparativa (variantes con sent_count >= 5).
     *
     * @returns {Array}
     */
    comparison_rows() {
      const self = this
      const rows = []
      self.variants.forEach(function (variant) {
        if ((variant.sent_count || 0) < 5) {
          return
        }
        rows.push({
          id: variant.id,
          name: variant.name,
          sent_count: variant.sent_count || 0,
          responded_pct: self.calc_pct(variant, 'responded'),
          scheduled_pct: self.calc_pct(variant, 'scheduled'),
          attended_pct: self.calc_pct(variant, 'attended'),
        })
      })
      return rows
    },

    /**
     * Muestra la tabla si hay 2+ variantes con volumen mínimo.
     *
     * @returns {boolean}
     */
    show_comparison_table() {
      return this.comparison_rows.length >= 2
    },
  },

  mounted() {
    const self = this
    self.load_global_delay()
    self.on_refresh()
    self.try_fetch_analysis_runs()
  },

  methods: {
    /**
     * Carga el delay global de welcome desde settings.
     *
     * @returns {void}
     */
    load_global_delay() {
      const self = this
      api
        .get('/settings/lead-whatsapp-onboarding')
        .then(function (res) {
          const seconds = parseInt(res.data && res.data.welcome_delay_seconds, 10)
          if (!isNaN(seconds) && seconds >= 0) {
            self.global_welcome_delay_seconds = seconds
          }
        })
        .catch(function () {
          /* Fallback silencioso: se mantiene el valor por defecto. */
        })
    },

    /**
     * Refresca variantes desde la API.
     *
     * @returns {void}
     */
    on_refresh() {
      const self = this
      self.$store.commit('auth/setMessage', 'Cargando variantes del agente')
      self.$store.commit('auth/setLoading', true)

      self.$store
        .dispatch('agente/fetch_variants')
        .catch(function () {
          /* El error queda en el store. */
        })
        .finally(function () {
          self.$store.commit('auth/setLoading', false)
          self.$store.commit('auth/setMessage', '')
        })
    },

    /**
     * Carga reportes del agente analizador desde GET /admin/agent-report.
     * Si falla o no hay datos, la sección muestra el placeholder informativo.
     *
     * @returns {void}
     */
    try_fetch_analysis_runs() {
      const self = this
      api
        .get('/agent-report')
        .then(function (res) {
          self.analysis_runs = Array.isArray(res.data) ? res.data : []
        })
        .catch(function () {
          self.analysis_runs = []
        })
    },

    /**
     * Etiqueta legible del tipo de mensaje.
     *
     * @param {string} message_type slug del tipo
     * @returns {string}
     */
    message_type_label(message_type) {
      /* Tipo universal (variantes A/B sin restricción de nombre). */
      if (message_type === 'welcome') {
        return 'Welcome'
      }
      /* Tipos históricos: retrocompatibilidad con registros previos a la migración. */
      if (message_type === 'welcome_with_name') {
        return 'Welcome con nombre'
      }
      if (message_type === 'welcome_without_name') {
        return 'Welcome sin nombre'
      }
      return message_type || '—'
    },

    /**
     * Divide el cuerpo del mensaje para resaltar {nombre}.
     *
     * @param {string} body texto del mensaje
     * @returns {Array<{text: string, is_placeholder: boolean}>}
     */
    body_parts(body) {
      const text = body || ''
      const parts = []
      const segments = text.split('{nombre}')
      segments.forEach(function (segment, index) {
        if (segment) {
          parts.push({ text: segment, is_placeholder: false })
        }
        if (index < segments.length - 1) {
          parts.push({ text: '{nombre}', is_placeholder: true })
        }
      })
      if (!parts.length) {
        parts.push({ text: '', is_placeholder: false })
      }
      return parts
    },

    /**
     * Calcula porcentaje de una métrica sobre enviados.
     *
     * @param {Object} variant variante
     * @param {string} metric responded | scheduled | attended
     * @returns {number|null}
     */
    calc_pct(variant, metric) {
      const sent = variant.sent_count || 0
      if (sent === 0) {
        return null
      }
      let count = 0
      if (metric === 'responded') {
        count = variant.responded_count || 0
      } else if (metric === 'scheduled') {
        count = variant.scheduled_count || 0
      } else if (metric === 'attended') {
        count = variant.attended_count || 0
      }
      return Math.round((count / sent) * 100)
    },

    /**
     * Etiqueta de porcentaje para mostrar en métricas, o null si no aplica.
     *
     * @param {Object} variant variante
     * @param {string} metric responded | scheduled | attended
     * @returns {string|null}
     */
    pct_label(variant, metric) {
      const pct = this.calc_pct(variant, metric)
      if (pct === null) {
        return null
      }
      return String(pct) + '%'
    },

    /**
     * Texto del delay de la variante (propio o global).
     *
     * @param {Object} variant variante
     * @returns {string}
     */
    delay_label(variant) {
      if (variant.delay_seconds != null && variant.delay_seconds !== '') {
        return 'Delay: ' + variant.delay_seconds + 's'
      }
      return 'Delay: global (' + this.global_welcome_delay_seconds + 's)'
    },

    /**
     * Clase CSS para resaltar el mejor porcentaje de una columna.
     *
     * @param {string} metric responded | scheduled | attended
     * @param {number|null} value porcentaje de la fila
     * @returns {string}
     */
    best_pct_class(metric, value) {
      if (value == null) {
        return ''
      }
      const key = metric + '_pct'
      let best = -1
      this.comparison_rows.forEach(function (row) {
        const row_val = row[key]
        if (row_val != null && row_val > best) {
          best = row_val
        }
      })
      if (value === best && best > 0) {
        return 'fw-bold text-success'
      }
      return ''
    },

    /**
     * Activa o desactiva una variante.
     *
     * @param {Object} variant variante
     * @returns {void}
     */
    on_toggle_active(variant) {
      const self = this
      const new_active = !variant.active
      self.action_loading_id = variant.id

      self.$store
        .dispatch('agente/toggle_active', { id: variant.id, active: new_active })
        .catch(function () {
          /* Error en store. */
        })
        .finally(function () {
          self.action_loading_id = null
        })
    },

    /**
     * Elimina una variante sin envíos previos (con confirmación).
     *
     * @param {Object} variant variante
     * @returns {void}
     */
    on_delete_variant(variant) {
      const self = this
      if (
        !window.confirm(
          '¿Eliminar la variante "' + variant.name + '"? Esta acción no se puede deshacer.'
        )
      ) {
        return
      }

      self.action_loading_id = variant.id
      self.$store
        .dispatch('agente/delete_variant', variant.id)
        .catch(function () {
          /* Error en store. */
        })
        .finally(function () {
          self.action_loading_id = null
        })
    },

    /**
     * Formatea fecha de un análisis para mostrar en la lista.
     *
     * @param {string} iso fecha ISO
     * @returns {string}
     */
    format_analysis_date(iso) {
      if (!iso) {
        return '—'
      }
      try {
        return new Date(iso).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch (e) {
        return iso
      }
    },
  },
}
</script>

<style lang="sass" scoped>
.agente-variant-body
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
	font-size: 0.85rem
	white-space: pre-wrap
	word-break: break-word

.agente-variant-body__text
	white-space: pre-wrap
</style>
