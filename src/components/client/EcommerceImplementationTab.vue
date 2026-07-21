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

    <!--
      Chequeo inicial de si el cliente ya tiene una implementación de ecommerce (prompt 586):
      se muestra este estado transitorio en vez del botón "Implementar Ecommerce" para evitar
      el parpadeo de mostrarlo un instante y ocultarlo apenas confirma que ya existe.
    -->
    <p v-else-if="loading_client_ecommerce_id" class="text-muted small fst-italic mb-0">
      Verificando estado de la tienda online…
    </p>

    <!-- El cliente ya tiene una implementación de ecommerce activa -->
    <div v-else-if="has_active_ecommerce" class="small">
      <span class="badge bg-success mb-2">Implementación de ecommerce iniciada</span>
      <div class="mb-3">
        <router-link :to="{ name: 'implementations_ecommerce' }" class="btn btn-outline-primary btn-sm">
          Ver implementaciones de ecommerce →
        </router-link>
      </div>

      <!--
        Pipeline técnico de instalación/actualización (prompt 586): solo se muestra si se
        pudo resolver el client_ecommerce_id real de este cliente (load_client_ecommerce_id).
      -->
      <ecommerce-installation-detail
        v-if="client_ecommerce_id"
        :client_ecommerce_id="client_ecommerce_id"
        :client_id="record.id"
      />
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
import EcommerceInstallationDetail from '@/components/ecommerce-installation/EcommerceInstallationDetail.vue'

/**
 * Pestaña del detalle del cliente para iniciar la implementación de su tienda online.
 *
 * Muestra el botón "Implementar Ecommerce" si el cliente aún no tiene una implementación
 * de ecommerce activa; al hacer clic llama al endpoint de inicio y redirige a la vista.
 *
 * Prompt 586: además, si ya existe una implementación, resuelve el `client_ecommerce_id`
 * real de este cliente (consultando el listado de implementaciones, ya que no existe un
 * endpoint "client_ecommerce por client_id") para embeber el pipeline técnico de
 * instalación/actualización (EcommerceInstallationDetail).
 */
export default {
  name: 'ClientEcommerceImplementationTab',
  components: { EcommerceInstallationDetail },
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
      // true mientras se resuelve si el cliente ya tiene una implementación de ecommerce
      // (y, de tenerla, su client_ecommerce_id) contra el listado de implementaciones.
      loading_client_ecommerce_id: false,
      // Id del ClientEcommerce del cliente, resuelto desde el listado de implementaciones.
      // null mientras no se confirmó que el cliente tiene una implementación de ecommerce.
      client_ecommerce_id: null,
      // true una vez confirmado (contra el backend) que el cliente tiene una implementación
      // de ecommerce iniciada. Reemplaza la dependencia de record.ecommerce_implementation,
      // que en la práctica no viene cargado desde Client::scopeWithAll (deuda existente,
      // ver nota más abajo).
      implementation_confirmed: false,
    }
  },
  computed: {
    /**
     * Indica si el cliente ya tiene una implementación de ecommerce activa.
     *
     * Se basa en el inicio reciente en esta sesión del modal, en la confirmación contra
     * el backend (implementation_confirmed) o, como último recurso, en la relación
     * `ecommerce_implementation` del record si vino cargada.
     *
     * Deuda técnica (prioridad baja, no se toca en este prompt): `Client::scopeWithAll`
     * (admin-api) no hace eager-load de `ecommerce_implementation`, por lo que ese campo
     * casi nunca viene poblado en `record`; por eso desde este prompt la confirmación real
     * pasa por `load_client_ecommerce_id()` en vez de depender de esa relación.
     *
     * @returns {boolean}
     */
    has_active_ecommerce() {
      if (this.just_started || this.implementation_confirmed) {
        return true
      }
      return !!(this.record && this.record.ecommerce_implementation)
    },
  },
  created() {
    // Resuelve de entrada si este cliente ya tiene una implementación de ecommerce
    // (y su client_ecommerce_id), para poder mostrar el pipeline técnico sin depender
    // de que el usuario haya iniciado la implementación en esta misma sesión.
    this.load_client_ecommerce_id()
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
        .then(function (res) {
          self.just_started = true
          const model = res.data && res.data.model
          if (model && model.client_ecommerce) {
            self.client_ecommerce_id = model.client_ecommerce.id
          }
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

    /**
     * Busca en el listado de implementaciones de ecommerce la que corresponde a este
     * cliente, para confirmar si existe y resolver su client_ecommerce_id (necesario
     * para embeber el pipeline técnico de instalación/actualización).
     *
     * @returns {void}
     */
    load_client_ecommerce_id() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      this.loading_client_ecommerce_id = true
      api
        .get('/ecommerce-implementation')
        .then(function (res) {
          const implementations = (res.data && res.data.models) || []
          const match = implementations.find(function (impl) {
            return impl.client_id === self.record.id
          })
          if (match && match.client_ecommerce) {
            self.implementation_confirmed = true
            self.client_ecommerce_id = match.client_ecommerce.id
          }
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error; el tab simplemente
             se queda mostrando el botón de "Implementar Ecommerce" por las dudas. */
        })
        .finally(function () {
          self.loading_client_ecommerce_id = false
        })
    },
  },
}
</script>
