<template>
  <div class="followup-templates-section">
    <!-- Estado de carga durante el fetch inicial -->
    <div v-if="loading" class="d-flex align-items-center gap-2 text-muted">
      <span class="spinner-border spinner-border-sm" /> Cargando…
    </div>

    <div v-else class="table-responsive">
      <table class="table table-sm table-bordered align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Estado</th>
            <th>Día #</th>
            <th>Nombre de plantilla en Meta</th>
            <th>Activa</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in models" :key="row.id">
            <!-- Estado del lead al que aplica la plantilla, formateado legible -->
            <td>{{ format_estado(row.estado) }}</td>

            <!-- Número de día dentro de la secuencia de seguimiento -->
            <td class="text-center">{{ row.dia_numero }}</td>

            <!-- Edición inline del nombre exacto de la plantilla en Meta -->
            <td>
              <input
                v-model="row.template_name"
                type="text"
                class="form-control form-control-sm"
                placeholder="ej: cc_seg_nuevo_d2"
              />
            </td>

            <!-- Activar/desactivar el envío de esta plantilla -->
            <td class="text-center">
              <input v-model="row.activa" type="checkbox" />
            </td>

            <!-- Guardado por fila con feedback inline -->
            <td>
              <div class="d-flex align-items-center gap-2">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  :disabled="saving_id === row.id"
                  @click="on_save(row)"
                >
                  {{ saving_id === row.id ? 'Guardando…' : 'Guardar' }}
                </button>
                <span v-if="feedback_id === row.id && feedback_ok" class="small text-success">Guardado</span>
                <span v-else-if="feedback_id === row.id && !feedback_ok" class="small text-danger">Error</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
/**
 * Sección de cuenta: edición de las plantillas de seguimiento de WhatsApp (Meta).
 *
 * Lista de solo edición (sin alta ni baja): cada fila permite cambiar el
 * `template_name` y el flag `activa`. El `language_code` no se muestra y se
 * reenvía sin cambios al guardar.
 */
export default {
  name: 'FollowupTemplatesSection',
  data() {
    return {
      /** Copia local editable de las plantillas devueltas por la API. */
      models: [],
      /** Carga inicial de la tabla. */
      loading: true,
      /** Id de fila en guardado para deshabilitar su botón. */
      saving_id: null,
      /** Id de fila con feedback visible actualmente. */
      feedback_id: null,
      /** Indica si el último guardado fue exitoso (verde) o con error (rojo). */
      feedback_ok: false,
    }
  },
  mounted() {
    const self = this
    // Trae las plantillas y arma una copia local editable.
    this.$store
      .dispatch('followup_template/fetch')
      .then(function (models) {
        self.models = JSON.parse(JSON.stringify(models || []))
        self.loading = false
      })
      .catch(function () {
        self.loading = false
      })
  },
  methods: {
    /**
     * Formatea un estado crudo (snake_case) a texto legible: reemplaza guiones
     * bajos por espacios y capitaliza la primera letra.
     *
     * @param {string} estado estado crudo del lead (ej: demo_agendada)
     * @returns {string} estado formateado (ej: Demo agendada)
     */
    format_estado(estado) {
      if (!estado) {
        return ''
      }
      const con_espacios = String(estado).replace(/_/g, ' ')
      return con_espacios.charAt(0).toUpperCase() + con_espacios.slice(1)
    },

    /**
     * Persiste una fila y muestra feedback inline de éxito/error por 2 segundos.
     *
     * @param {Object} row plantilla editada
     * @returns {void}
     */
    on_save(row) {
      const self = this
      this.saving_id = row.id
      this.feedback_id = null
      this.$store
        .dispatch('followup_template/update', {
          id: row.id,
          template_name: row.template_name,
          language_code: row.language_code,
          activa: row.activa,
        })
        .then(function (model) {
          // Refresca la copia local con la respuesta del servidor.
          const idx = self.models.findIndex(function (m) {
            return m.id == model.id
          })
          if (idx !== -1) {
            self.models.splice(idx, 1, Object.assign({}, self.models[idx], model))
          }
          self.saving_id = null
          self.show_feedback(row.id, true)
        })
        .catch(function () {
          self.saving_id = null
          self.show_feedback(row.id, false)
        })
    },

    /**
     * Muestra el texto de feedback en una fila y lo oculta tras 2 segundos.
     *
     * @param {number} id id de la fila
     * @param {boolean} ok true si fue exitoso, false si hubo error
     * @returns {void}
     */
    show_feedback(id, ok) {
      const self = this
      this.feedback_id = id
      this.feedback_ok = ok
      setTimeout(function () {
        if (self.feedback_id === id) {
          self.feedback_id = null
        }
      }, 2000)
    },
  },
}
</script>
