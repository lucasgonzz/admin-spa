<template>
  <div>
    <resource-view
      model_name="demo_update"
      resource_api_path="demo-update"
      @record-selected="on_record_selected"
    />

    <!-- Panel de progreso: visible apenas se selecciona un registro, incluso sin log aún -->
    <demo-update-progress-panel
      v-if="selected_model"
      :demo_update="selected_model"
      class="mt-3 mx-3"
    />
  </div>
</template>

<script>
import ResourceView from '@/common-vue/components/view/Index.vue'
import DemoUpdateProgressPanel from '@/components/demo_update/ProgressPanel.vue'
import api from '@/utils/axios'

export default {
  name: 'ViewDemoUpdates',

  components: { ResourceView, DemoUpdateProgressPanel },

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
     * Asigna el modelo seleccionado e inicia polling si el pipeline está
     * pendiente o en ejecución, de modo que el progreso sea visible desde
     * el momento en que el job es tomado por el worker.
     *
     * @param {Object|null} model  Registro seleccionado en la grilla.
     * @returns {void}
     */
    on_record_selected(model) {
      this.selected_model = model
      this.stop_polling()

      /* Inicia polling tanto para 'pendiente' como para 'ejecutandose' */
      if (model && (model.status === 'pendiente' || model.status === 'ejecutandose')) {
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
      var self = this

      self.polling_interval = setInterval(function () {
        api.get('/demo-update/' + id).then(function (res) {
          /* Modelo actualizado desde el backend */
          var model = res.data.model

          /* Actualiza el panel de progreso con los datos frescos */
          self.selected_model = model

          /* Sincroniza el modelo en la lista de la grilla (upsert sin recargar todo) */
          self.$store.dispatch('demo_update/upsert_model_in_lists', model)

          /* Detiene polling cuando el pipeline ya terminó (exitoso o fallido) */
          if (model.status === 'completado' || model.status === 'fallido') {
            self.stop_polling()
          }
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
    /* Limpia el intervalo al destruir el componente para evitar memory leaks */
    this.stop_polling()
  },
}
</script>
