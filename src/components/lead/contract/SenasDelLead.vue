<template>
  <div class="senas-del-lead">
    <h6 class="text-primary mb-2">Seña (antes del alta)</h6>
    <div class="alert alert-light border mb-3">
      <!-- ====================================================== -->
      <!-- Lead YA promovido: la seña se registra en la venta del -->
      <!-- cliente. Solo se muestra algo especial si quedó una    -->
      <!-- seña pendiente sin aplicar (invisible sería peor).     -->
      <!-- ====================================================== -->
      <template v-if="promovido">
        <div v-if="pendientes.length" class="alert alert-warning py-2 px-3 small mb-0" role="alert">
          <p class="mb-2">{{ aviso_sin_aplicar }}</p>
          <ul class="list-unstyled mb-0 senas-del-lead__lista">
            <li v-for="sena in pendientes" :key="sena.id" class="senas-del-lead__sena d-flex flex-wrap align-items-center gap-2">
              <span class="text-muted">{{ formatear_fecha(sena.fecha) }}</span>
              <span class="fw-semibold">{{ format_monto_con_moneda(sena.monto, sena.moneda || moneda) }}</span>
              <span v-if="sena.nota" class="text-muted fst-italic">{{ sena.nota }}</span>
              <button type="button" class="btn btn-sm btn-outline-danger ms-auto" :disabled="anulando !== null" @click="anular(sena)">
                {{ anulando === sena.id ? 'Anulando...' : 'Anular' }}
              </button>
            </li>
          </ul>
        </div>
        <p v-else class="small text-muted mb-0">
          Este lead ya es cliente: las señas se registran en su pestaña Ventas.
        </p>
        <p v-if="error_carga" class="small text-danger mb-0 mt-2">{{ error_carga }}</p>
      </template>

      <!-- ====================================================== -->
      <!-- Lead sin promover: lista de señas pendientes + alta.   -->
      <!-- ====================================================== -->
      <template v-else>
        <p class="small text-muted mb-2">
          Se aplica sola a las cuotas cuando el lead se promueve a cliente.
        </p>

        <p v-if="cargando" class="small text-muted mb-2">Cargando señas...</p>
        <p v-else-if="error_carga" class="small text-danger mb-2">{{ error_carga }}</p>
        <template v-else>
          <ul v-if="senas.length" class="list-unstyled small mb-2 senas-del-lead__lista">
            <li v-for="sena in senas" :key="sena.id" class="senas-del-lead__sena d-flex flex-wrap align-items-center gap-2">
              <span class="text-muted">{{ formatear_fecha(sena.fecha) }}</span>
              <span class="fw-semibold">{{ format_monto_con_moneda(sena.monto, sena.moneda || moneda) }}</span>
              <span v-if="sena.nota" class="text-muted fst-italic">{{ sena.nota }}</span>
              <button
                v-if="es_pendiente(sena)"
                type="button"
                class="btn btn-sm btn-outline-danger ms-auto"
                :disabled="anulando !== null"
                @click="anular(sena)"
              >
                {{ anulando === sena.id ? 'Anulando...' : 'Anular' }}
              </button>
            </li>
          </ul>
          <p v-else class="small text-muted fst-italic mb-2">Todavía no hay señas registradas.</p>
          <p v-if="senas.length" class="small fw-semibold mb-2">
            Pendiente de aplicar: {{ format_monto_con_moneda(total, moneda) }}
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
 * Lee `GET leads/{id}/senas` → `{senas, total, total_aplicado}`: cada seña trae `aplicada`
 * (booleano) y `total` es SOLO lo pendiente. La ruta responde también para leads ya promovidos.
 *
 * - Lead sin promover: lista las señas, deja registrar una nueva (`POST leads/{id}/senas`, con
 *   `SenaForm`) y anular las pendientes (`DELETE leads/{id}/senas/{senaId}`). Esas señas no
 *   tocan ninguna cuota todavía: el backend las aplica solo cuando el lead se promueve.
 * - Lead promovido: el formulario de alta NO se muestra (las señas van en la pestaña Ventas del
 *   cliente). Pero si quedó una seña con `aplicada === false` (la promoción no generó venta, o
 *   era de otra moneda) se muestra un aviso ámbar con el botón «Anular» por cada una: si no, esa
 *   plata quedaría invisible.
 *
 * Contra una API vieja (sin `aplicada`, `total_aplicado` ni el DELETE): lo ausente se lee como
 * lista vacía / 0, y un 404 del GET se muestra en la sección sin romper el resto del contrato.
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
      // Señas del lead `[{id, monto, moneda, fecha, nota, origen, aplicada}]`.
      senas: [],
      // Suma de lo pendiente que manda la API (si falta, se suma la lista).
      total_api: null,
      // Suma de lo ya aplicado que manda la API (0 si falta).
      total_aplicado: 0,
      // true mientras corre el GET.
      cargando: false,
      // Mensaje si el GET falla.
      error_carga: '',
      // true si el formulario de alta está abierto.
      form_abierto: false,
      // id de la seña que se está anulando (null = ninguna): bloquea los demás botones.
      anulando: null,
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
     * Moneda por defecto de las señas: la del contrato del lead (USD si no tiene).
     * @returns {string}
     */
    moneda() {
      return this.lead.contract_currency || 'USD'
    },
    /**
     * Señas pendientes, o sea las que se pueden anular. En un lead promovido solo cuentan las
     * que la API marca explícitamente `aplicada === false`; en uno sin promover, todas las que
     * no estén marcadas como aplicadas (una API vieja no manda el campo).
     * @returns {Array<Object>}
     */
    pendientes() {
      const self = this
      return this.senas.filter(function (sena) {
        return self.es_pendiente(sena)
      })
    },
    /**
     * Total de lo pendiente: el de la API o, si no vino, la suma de las pendientes.
     * @returns {number}
     */
    total() {
      if (this.total_api !== null) {
        return this.total_api
      }
      return this.pendientes.reduce(function (acumulado, sena) {
        return acumulado + (Number(sena.monto) || 0)
      }, 0)
    },
    /**
     * Texto del aviso ámbar del lead promovido con señas sin aplicar.
     * @returns {string}
     */
    aviso_sin_aplicar() {
      const total = format_monto_con_moneda(this.total_pendiente_lista, this.moneda_pendientes)
      if (this.pendientes.length === 1) {
        return 'Hay una seña de ' + total + ' que no se aplicó a ninguna venta. Anulala y registrala en la pestaña Ventas del cliente.'
      }
      return 'Hay ' + this.pendientes.length + ' señas (' + total + ') que no se aplicaron a ninguna venta. Anulalas y registralas en la pestaña Ventas del cliente.'
    },
    /**
     * Suma de las pendientes de la lista (para el aviso: no depende de `total_api`).
     * @returns {number}
     */
    total_pendiente_lista() {
      return this.pendientes.reduce(function (acumulado, sena) {
        return acumulado + (Number(sena.monto) || 0)
      }, 0)
    },
    /**
     * Moneda para el total del aviso: la de las pendientes si es una sola; si no, la del contrato.
     * @returns {string}
     */
    moneda_pendientes() {
      const monedas = {}
      this.pendientes.forEach(function (sena) {
        if (sena.moneda) {
          monedas[sena.moneda] = true
        }
      })
      const claves = Object.keys(monedas)
      return claves.length === 1 ? claves[0] : this.moneda
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
    /**
     * Si el lead se promueve con el modal abierto, la lista se pide de nuevo: ahora las señas
     * vienen aplicadas (o quedan pendientes y hay que avisarlo).
     */
    'lead.promoted_client_id': function (nuevo, viejo) {
      if (nuevo !== viejo) {
        this.form_abierto = false
        this.cargar()
      }
    },
  },
  methods: {
    formatear_fecha,
    format_monto_con_moneda,
    /**
     * true si la seña se puede anular (está pendiente).
     * @param {Object} sena
     * @returns {boolean}
     */
    es_pendiente(sena) {
      return this.promovido ? sena.aplicada === false : sena.aplicada !== true
    },
    /**
     * Toast global del admin.
     * @param {string} message
     * @param {string} [variant]
     */
    avisar(message, variant) {
      window.dispatchEvent(new CustomEvent('admin-spa-toast', {
        detail: { message: String(message), variant: variant || 'success' },
      }))
    },
    /**
     * Vuelca una respuesta con la forma `{senas, total, total_aplicado}` (la del GET y la del
     * DELETE). Lo ausente se lee como lista vacía / 0.
     * @param {Object} data
     */
    aplicar_respuesta(data) {
      const d = data || {}
      this.senas = Array.isArray(d.senas) ? d.senas : []
      this.total_api = d.total !== undefined && d.total !== null ? Number(d.total) : null
      this.total_aplicado = d.total_aplicado !== undefined && d.total_aplicado !== null ? Number(d.total_aplicado) : 0
    },
    /**
     * GET leads/{id}/senas (también para leads ya promovidos).
     */
    cargar() {
      const self = this
      self.senas = []
      self.total_api = null
      self.total_aplicado = 0
      self.error_carga = ''
      if (!this.lead || !this.lead.id) {
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
          self.aplicar_respuesta(res.data)
        })
        .catch(function (error) {
          self.cargando = false
          self.error_carga = resolve_error_message(error)
        })
    },
    /**
     * DELETE leads/{id}/senas/{senaId}, previa confirmación. Anula una seña PENDIENTE (la API
     * contesta 422 si ya está aplicada y ese mensaje va al toast) y responde con el mismo JSON
     * del GET, con el que se redibuja la lista.
     * @param {Object} sena
     */
    anular(sena) {
      const self = this
      if (this.anulando !== null) {
        return
      }
      const confirmado = window.confirm(
        '¿Anular la seña de ' + format_monto_con_moneda(sena.monto, sena.moneda || this.moneda) +
        ' del ' + formatear_fecha(sena.fecha) + '? Deja de contar para este lead.'
      )
      if (!confirmado) {
        return
      }
      const lead_id = this.lead.id
      self.anulando = sena.id
      api
        .delete('/leads/' + lead_id + '/senas/' + sena.id, { silent_error: true })
        .then(function (res) {
          self.anulando = null
          self.avisar('Seña anulada.')
          if (self.lead && self.lead.id === lead_id) {
            self.aplicar_respuesta(res.data)
          }
        })
        .catch(function (error) {
          self.anulando = null
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * La seña se registró: cierra el formulario, avisa y vuelve a pedir la lista.
     */
    sena_registrada() {
      this.form_abierto = false
      this.avisar('Seña registrada: se aplicará a las cuotas cuando el lead se promueva.')
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
	padding: 0.15rem 0;
	overflow-wrap: anywhere;
}
</style>
