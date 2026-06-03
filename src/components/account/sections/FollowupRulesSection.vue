<template>
  <div class="followup-rules-section">
    <div v-if="loading" class="d-flex align-items-center gap-2 text-muted">
      <span class="spinner-border spinner-border-sm" /> Cargando…
    </div>

    <div v-else class="table-responsive">
      <table class="table table-sm table-bordered align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Estado</th>
            <th>Horas espera</th>
            <th>Máx. seguimientos</th>
            <th>Activa</th>
            <th>Descripción</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in models" :key="row.id">
            <td>
              <code>{{ row.estado }}</code>
            </td>
            <td style="max-width: 120px">
              <input v-model.number="row.horas_espera" type="number" min="1" class="form-control form-control-sm" />
            </td>
            <td style="max-width: 120px">
              <input v-model.number="row.max_followups" type="number" min="0" class="form-control form-control-sm" />
            </td>
            <td>
              <div class="form-check form-switch">
                <input :id="'act-' + row.id" v-model="row.activa" class="form-check-input" type="checkbox" />
                <label class="form-check-label small" :for="'act-' + row.id">{{ row.activa ? 'Sí' : 'No' }}</label>
              </div>
            </td>
            <td>
              <input v-model="row.descripcion" type="text" class="form-control form-control-sm" />
            </td>
            <td>
              <button type="button" class="btn btn-primary btn-sm" :disabled="saving_id === row.id" @click="on_save(row)">
                {{ saving_id === row.id ? 'Guardando…' : 'Guardar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
/**
 * Sección de cuenta: ABM liviano de reglas de seguimiento (sin ResourceView).
 */
export default {
  name: 'FollowupRulesSection',
  data() {
    return {
      /** Copia local editable de las filas devueltas por la API. */
      models: [],
      /** Carga inicial de la tabla. */
      loading: true,
      /** Id de fila en guardado para spinner por renglón. */
      saving_id: null,
    }
  },
  mounted() {
    const self = this
    this.$store
      .dispatch('followup_rule/get_models')
      .then(function () {
        self.models = JSON.parse(JSON.stringify(self.$store.state.followup_rule.models || []))
        self.loading = false
      })
      .catch(function () {
        self.loading = false
      })
  },
  methods: {
    /**
     * Persiste una fila y refresca la copia local con la respuesta del servidor.
     *
     * @param {Object} row regla editada
     * @returns {void}
     */
    on_save(row) {
      const self = this
      this.saving_id = row.id
      this.$store
        .dispatch('followup_rule/update_rule', {
          id: row.id,
          horas_espera: row.horas_espera,
          max_followups: row.max_followups,
          activa: row.activa,
          descripcion: row.descripcion,
        })
        .then(function (model) {
          const idx = self.models.findIndex(function (m) {
            return m.id == model.id
          })
          if (idx !== -1) {
            self.models.splice(idx, 1, Object.assign({}, self.models[idx], model))
          }
          self.saving_id = null
          if (self.$root && self.$root.$emit) {
            self.$root.$emit('open_toast', 'Regla actualizada.')
          }
        })
        .catch(function () {
          self.saving_id = null
        })
    },
  },
}
</script>
