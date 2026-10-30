<template>
  <div class="senas-del-lead">
    <h6 class="text-primary mb-2">Seña (antes del alta)</h6>
    <div class="alert alert-light border mb-3">
      <!-- Lead ya promovido: la seña se registra en la venta del cliente, no acá. -->
      <p v-if="promovido" class="small text-muted mb-0">
        Este lead ya es cliente: las señas se registran en su pestaña Ventas.
      </p>

      <template v-else>
        <p class="small text-muted mb-2">
          Se aplica sola a las cuotas cuando el lead se promueve a cliente.
        </p>

        <p v-if="cargando" class="small text-muted mb-2">Cargando señas...</p>
        <p v-else-if="error_carga" class="small text-danger mb-2">{{ error_carga }}</p>
        <template v-else>
          <ul v-if="senas.length" class="list-unstyled small mb-2 senas-del-lead__lista">
            <li v-for="sena in senas" :key="sena.id" class="senas-del-lead__sena">
              <span class="text-muted">{{ formatear_fecha(sena.fecha) }}</span>
              <span class="fw-semibold ms-2">{{ format_monto_con_moneda(sena.monto, sena.moneda || moneda) }}</span>
              <span v-if="sena.nota" class="text-muted fst-italic ms-2">{{ sena.nota }}</span>
            </li>
          </ul>
          <p v-else class="small text-muted fst-italic mb-2">Todavía no hay señas registradas.</p>
          <p v-if="senas.length" class="small fw-semibold mb-2">
            Total en seña: {{ format_monto_con_moneda(total, moneda) }}
          </p>
        </template>

        <sena-form
          v-if="form_abierto"
          :id_base="'lead-' + lead.id + '-sena'"
          :url="'/leads/' + lead.id + '/senas'"
          :moneda="moneda"
          titulo="Registrar seña del lead"
          @registrada="sena_registrada"
          @cancelar="form_abierto = false"
        />
        <button v-else type="button" class="btn btn-sm btn-outline-success" @click="form_abierto = true">
          <i class="bi bi-cash-coin me-1"></i>Registrar seña
        </button>
      </template>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import SenaForm from '@/components/senas/SenaForm.vue'
import { formatear_fecha } from '@/components/cobranzas/meses'
import { format_monto_con_moneda } from '@/components/cobranzas/plata'

/**
 * Sección «Seña (antes del alta)» del contrato del lead (misión senas-en-ventas, 30/10/2026).
 *
 * Lista las señas pendientes del lead (`GET leads/{id}/senas` → `{senas, total}`) y deja
 * registrar una nueva (`POST leads/{id}/senas`, con `SenaForm`). Esas señas no tocan ninguna
 * cuota todavía: el backend las aplica solo cuando el lead se promueve a cliente y se crea la
 * venta del contrato. Si el lead ya fue promovido (`promoted_client_id`) la sección solo avisa
 * que las señas van en la pestaña Ventas del cliente.
 *
 * Una API vieja que no tiene la ruta contesta 404: se muestra el error en la sección sin romper
 * el resto del contrato.
 */
export default {
  name: 'LeadContractSenas',
  components: { SenaForm },
  props: {
    /** Lead abierto en el modal. */
    lead: { type: Object, required: true },
  },
  data() {
    return {
      // Señas pendientes `[{id, monto, moneda, fecha, nota, origen}]`.
      senas: [],
      // Suma que manda la API (si falta, se suma la lista).
      total_api: null,
      // true mientras corre el GET.
      cargando: false,
      // Mensaje si el GET falla.
      error_carga: '',
      // true si el formulario de alta está abierto.
      form_abierto: false,
    }
  },
  computed: {
    /**
     * true si el lead ya se promovió a cliente.
     * @returns {boolean}
     */
    promovido() {
      return !!this.lead.promoted_client_id
    },
    /**
     * Moneda de las señas: la del contrato del lead (USD por defecto).
     * @returns {string}
     */
    moneda() {
      return this.lead.contract_currency || 'USD'
    },
    /**
     * Total señado: el de la API o, si no vino, la suma de la lista.
     * @returns {number}
     */
    total() {
      if (this.total_api !== null) {
        return this.total_api
      }
      return this.senas.reduce(function (acumulado, sena) {
        return acumulado + (Number(sena.monto) || 0)
      }, 0)
    },
  },
  watch: {
    /**
     * Al abrir otro lead se vuelve a pedir la lista y se cierra el formulario.
     */
    'lead.id': {
      immediate: true,
      handler: function () {
        this.form_abierto = false
        this.cargar()
      },
    },
  },
  methods: {
    formatear_fecha,
    format_monto_con_moneda,
    /**
     * GET leads/{id}/senas. No se pide si el lead ya fue promovido.
     */
    cargar() {
      const self = this
      self.senas = []
      self.total_api = null
      self.error_carga = ''
      if (!this.lead || !this.lead.id || this.promovido) {
        return
      }
      const lead_id = this.lead.id
      self.cargando = true
      api
        .get('/leads/' + lead_id + '/senas', { silent_error: true })
        .then(function (res) {
          self.cargando = false
          if (!self.lead || self.lead.id !== lead_id) {
            return
          }
          const data = res.data || {}
          self.senas = Array.isArray(data.senas) ? data.senas : []
          self.total_api = data.total !== undefined && data.total !== null ? Number(data.total) : null
        })
        .catch(function (error) {
          self.cargando = false
          self.error_carga = resolve_error_message(error)
        })
    },
    /**
     * La seña se registró: cierra el formulario, avisa y vuelve a pedir la lista.
     */
    sena_registrada() {
      this.form_abierto = false
      window.dispatchEvent(new CustomEvent('admin-spa-toast', {
        detail: { message: 'Seña registrada: se aplicará a las cuotas cuando el lead se promueva.', variant: 'success' },
      }))
      this.cargar()
    },
  },
}
</script>

<style scoped lang="scss">
/* Lista de señas: una por renglón, con una guía a la izquierda. */
.senas-del-lead__lista {
	border-left: 2px solid #b7dfc6;
	padding-left: 0.6rem;
}

.senas-del-lead__sena {
	padding: 0.1rem 0;
	overflow-wrap: anywhere;
}
</style>
