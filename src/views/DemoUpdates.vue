<template>
  <div>
    <resource-view
      model_name="demo_update"
      @record-selected="on_record_selected"
    />

    <!-- Panel de log: visible cuando hay un registro seleccionado con log registrado -->
    <div
      v-if="selected_model && selected_model.log"
      class="mt-3 mx-3"
    >
      <h6 class="text-muted small mb-1">Log de ejecución</h6>
      <pre
        ref="log_pre"
        class="bg-dark text-light p-3 rounded small"
        style="max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;"
      >{{ selected_model.log }}</pre>
    </div>
  </div>
</template>

<script>
import ResourceView from '@/common-vue/components/view/Index.vue'
import api from '@/utils/axios'

export default {
  name: 'ViewDemoUpdates',

  components: { ResourceView },

  data() {
    return {
      /** Registro seleccionado actualmente en la grilla. */
      selected_model: null,

      /** ID del intervalo de polling activo (null si no hay polling en curso). */
      polling_interval: null,
    }
  },

  methods: {
    /**
     * Callback del evento record-selected del ResourceView.
     * Asigna el modelo seleccionado e inicia polling si el pipeline está en ejecución.
     *
     * @param {Object|null} model  Registro seleccionado en la grilla.
     * @returns {void}
     */
    on_record_selected(model) {
      this.selected_model = model
      this.stop_polling()

      // Solo inicia polling mientras el job SSH esté activo.
      if (model && model.status === 'ejecutandose') {
        this.start_polling(model.id)
      }
    },

    /**
     * Inicia polling cada 4 segundos para refrescar el log y el estado del registro.
     * Al detectar un status final (completado/fallido) detiene el intervalo.
     *
     * @param {number} id  ID del DemoUpdate a refrescar.
     * @returns {void}
     */
    start_polling(id) {
      const self = this

      self.polling_interval = setInterval(function () {
        api.get('/demo-update/' + id).then(function (res) {
          // Modelo actualizado desde el backend.
          const model = res.data.model

          // Actualiza el panel de log con los datos frescos.
          self.selected_model = model

          // Sincroniza el modelo en la lista de la grilla (upsert sin recargar todo).
          self.$store.dispatch('demo_update/upsert_model_in_lists', model)

          // Detiene polling cuando el pipeline ya terminó (exitoso o fallido).
          if (model.status !== 'ejecutandose') {
            self.stop_polling()
          }

          // Scroll automático al final del log para seguir la ejecución en tiempo real.
          self.$nextTick(function () {
            if (self.$refs.log_pre) {
              self.$refs.log_pre.scrollTop = self.$refs.log_pre.scrollHeight
            }
          })
        })
      }, 4000)
    },

    /**
     * Detiene el intervalo de polling activo y limpia la referencia.
     *
     * @returns {void}
     */
    stop_polling() {
      if (this.polling_interval) {
        clearInterval(this.polling_interval)
        this.polling_interval = null
      }
    },
  },

  beforeUnmount() {
    // Limpia el intervalo al destruir el componente para evitar memory leaks.
    this.stop_polling()
  },
}
</script>
