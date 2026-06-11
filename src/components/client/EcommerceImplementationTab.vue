<template>
  <div class="p-3">
    <h6 class="text-muted mb-2">Tienda online (Ecommerce)</h6>
    <p class="small text-muted mb-3">
      Iniciá la implementación de la tienda online del cliente. Esto arranca el flujo
      conversacional por WhatsApp para configurar dominio, colores y preferencias.
    </p>

    <!-- Sin cliente guardado todavía -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para implementar su tienda online.
    </p>

    <!-- El cliente ya tiene una implementación de ecommerce activa -->
    <div v-else-if="has_active_ecommerce" class="small">
      <span class="badge bg-success mb-2">Implementación de ecommerce iniciada</span>
      <div>
        <router-link :to="{ name: 'implementations_ecommerce' }" class="btn btn-outline-primary btn-sm">
          Ver implementaciones de ecommerce →
        </router-link>
      </div>
    </div>

    <!-- Botón para iniciar la implementación de ecommerce -->
    <div v-else>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="starting"
        @click="start_ecommerce_implementation"
      >
        {{ starting ? 'Iniciando...' : 'Implementar Ecommerce' }}
      </button>

      <p v-if="error_message" class="text-danger small mb-0 mt-2">{{ error_message }}</p>
    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Pestaña del detalle del cliente para iniciar la implementación de su tienda online.
 *
 * Muestra el botón "Implementar Ecommerce" si el cliente aún no tiene una implementación
 * de ecommerce activa; al hacer clic llama al endpoint de inicio y redirige a la vista.
 */
export default {
  name: 'ClientEcommerceImplementationTab',
  props: {
    /** Cliente actualmente abierto en el modal de detalle. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // true mientras se ejecuta el inicio de la implementación.
      starting: false,
      // Mensaje de error a mostrar si el inicio falla.
      error_message: '',
      // true si recién se inició la implementación en esta sesión del modal.
      just_started: false,
    }
  },
  computed: {
    /**
     * Indica si el cliente ya tiene una implementación de ecommerce activa.
     *
     * Se basa en la relación cargada en el registro (si existe) o en el inicio reciente.
     *
     * @returns {boolean}
     */
    has_active_ecommerce() {
      if (this.just_started) {
        return true
      }
      return !!(this.record && this.record.ecommerce_implementation)
    },
  },
  methods: {
    /**
     * Inicia la implementación de ecommerce del cliente y redirige a la vista.
     *
     * @returns {void}
     */
    start_ecommerce_implementation() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      this.starting = true
      this.error_message = ''
      api
        .post('/client/' + this.record.id + '/ecommerce-implementation/start')
        .then(function () {
          self.just_started = true
          // Redirigir a la vista de implementaciones de ecommerce.
          self.$router.push({ name: 'implementations_ecommerce' })
        })
        .catch(function (error) {
          const msg =
            error && error.response && error.response.data && error.response.data.message
              ? error.response.data.message
              : 'No se pudo iniciar la implementación de ecommerce.'
          self.error_message = msg
        })
        .finally(function () {
          self.starting = false
        })
    },
  },
}
</script>
