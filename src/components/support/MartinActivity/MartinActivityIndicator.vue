<template>
  <!--
    Punto junto a «#N · título» con la cantidad de acciones que Martín hizo en el ticket con las
    herramientas del soporte. Con escrituras, el punto cambia de color. Al tocarlo se abre el panel
    con las atenciones, el plan de cada una y sus acciones.
  -->
  <button
    type="button"
    class="martin-indicador"
    :class="clase_punto"
    :title="titulo"
    :aria-label="titulo"
    aria-haspopup="dialog"
    @click="abrir">
    <span class="martin-indicador-punto" aria-hidden="true"></span>
    <span v-if="total > 0" class="martin-indicador-numero">{{ total }}</span>
  </button>

  <base-modal v-model:show="abierto" title="Lo que hizo Martín" size="lg">
    <p class="martin-panel-aclaracion small text-muted">{{ aclaracion }}</p>
    <p v-if="estado.cargando && !estado.cargado" class="text-muted mb-0" role="status">Cargando actividad…</p>
    <div v-else-if="estado.error && !estado.cargado" role="status">
      <p class="text-danger mb-2">{{ estado.error }}</p>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="recargar">Reintentar</button>
    </div>
    <p v-else-if="!atenciones.length" class="text-muted mb-0">Sin actividad registrada</p>
    <div v-else class="d-grid gap-3">
      <p class="small mb-0">
        <strong>{{ total }}</strong> {{ total === 1 ? 'acción' : 'acciones' }}
        en {{ atenciones.length }} {{ atenciones.length === 1 ? 'atención' : 'atenciones' }}<template v-if="escrituras > 0">,
          <span class="martin-panel-escrituras">{{ escrituras }} {{ escrituras === 1 ? 'escritura' : 'escrituras' }} en el sistema</span></template>.
      </p>
      <article
        v-for="atencion in atenciones"
        :key="atencion.run_id"
        class="border rounded p-3 martin-panel-atencion">
        <header class="d-flex flex-wrap align-items-baseline gap-2 justify-content-between mb-2">
          <h3 class="fs-6 mb-0">
            Atención del {{ rango(atencion) }}
            <span v-if="seguimiento(atencion)" class="badge rounded-pill text-bg-info martin-panel-origen">{{ rotulo_seguimiento }}</span>
          </h3>
          <span class="martin-panel-resumen small text-muted">{{ resumen(atencion) }}</span>
        </header>
        <martin-attention-detail :atencion="atencion" :acciones_abiertas="true" />
      </article>
    </div>
  </base-modal>
</template>

<script>
import BaseModal from '@/components/ui/BaseModal.vue'
import MartinAttentionDetail from './MartinAttentionDetail.vue'
import {
  martin_activity_state,
  cargar_actividad_de_martin,
  programar_recarga_de_actividad,
  contar_escrituras,
  rango_de_atencion,
  es_seguimiento,
  ROTULO_SEGUIMIENTO,
  ACLARACION_ACTIVIDAD,
} from '@/utils/martin_activity'

/**
 * Rótulos del resumen de una atención, en el orden en que se muestran. Las escrituras son las del
 * sistema del cliente; los registros internos (ficha, título, notas) van aparte.
 */
const RESUMEN = [
  ['lecturas', 'lectura', 'lecturas'],
  ['consultas', 'consulta', 'consultas'],
  ['escrituras', 'escritura en el sistema', 'escrituras en el sistema'],
  ['registros', 'registro interno', 'registros internos'],
  ['envios', 'envío', 'envíos'],
  ['errores', 'error', 'errores'],
]

/**
 * Indicador de la actividad de Martín en el encabezado del ticket, con su panel.
 *
 * Es quien pide la actividad al abrir un ticket: las tarjetas de la conversación leen el mismo
 * estado compartido (`martin_activity_state`).
 */
export default {
  name: 'MartinActivityIndicator',
  components: { BaseModal, MartinAttentionDetail },
  props: {
    /**
     * Ticket abierto (trae `martin_activity_count` y `martin_writes_count` de la bandeja).
     */
    ticket: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      /** Panel abierto. */
      abierto: false,
      /** Estado compartido con las tarjetas de la conversación. */
      estado: martin_activity_state,
      aclaracion: ACLARACION_ACTIVIDAD,
      rotulo_seguimiento: ROTULO_SEGUIMIENTO,
    }
  },
  computed: {
    /**
     * true si el estado compartido ya tiene la respuesta de este ticket.
     *
     * @returns {boolean}
     */
    cargado_para_este() {
      return this.estado.cargado && String(this.estado.ticket_id) === String(this.ticket.id)
    },
    /**
     * Atenciones del ticket (vacío mientras no hay respuesta).
     *
     * @returns {Array<Object>}
     */
    atenciones() {
      return this.cargado_para_este ? this.estado.atenciones : []
    },
    /**
     * Total de acciones: lo cargado manda; antes de cargar, el contador del ticket.
     *
     * @returns {number}
     */
    total() {
      if (this.cargado_para_este) {
        return Number(this.estado.total_acciones) || 0
      }
      return Number(this.ticket.martin_activity_count) || 0
    },
    /**
     * Escrituras en el sistema del cliente (las que pintan el punto de amarillo): igual que el
     * total, lo cargado manda y antes de cargar, `martin_writes_count`. Los registros internos no
     * cuentan.
     *
     * @returns {number}
     */
    escrituras() {
      if (this.cargado_para_este) {
        return contar_escrituras(this.estado.atenciones)
      }
      return Number(this.ticket.martin_writes_count) || 0
    },
    clase_punto() {
      if (this.escrituras > 0) {
        return 'martin-indicador--escrituras'
      }
      return this.total > 0 ? 'martin-indicador--acciones' : 'martin-indicador--vacio'
    },
    titulo() {
      if (this.total === 0) {
        return 'Martín: sin actividad registrada'
      }
      const acciones = this.total + (this.total === 1 ? ' acción' : ' acciones')
      if (this.escrituras > 0) {
        return 'Martín: ' + acciones + ', ' + this.escrituras + (this.escrituras === 1 ? ' escritura' : ' escrituras') + ' en el sistema'
      }
      return 'Martín: ' + acciones
    },
    /**
     * Clave de los contadores del ticket: si la bandeja los actualiza (Pusher), se recarga.
     *
     * @returns {string}
     */
    contadores_del_ticket() {
      return String(this.ticket.martin_activity_count || 0) + ':' + String(this.ticket.martin_writes_count || 0)
    },
  },
  watch: {
    'ticket.id': {
      immediate: true,
      handler(id) {
        this.abierto = false
        cargar_actividad_de_martin(id)
      },
    },
    contadores_del_ticket(nuevo, viejo) {
      if (viejo !== undefined && nuevo !== viejo) {
        programar_recarga_de_actividad(this.ticket.id)
      }
    },
  },
  methods: {
    /**
     * Abre el panel y trae lo último (Martín puede estar trabajando sin haber escrito todavía).
     *
     * @returns {void}
     */
    abrir() {
      this.abierto = true
      this.recargar()
    },
    recargar() {
      cargar_actividad_de_martin(this.ticket.id)
    },
    rango(atencion) {
      return rango_de_atencion(atencion)
    },
    seguimiento(atencion) {
      return es_seguimiento(atencion)
    },
    /**
     * «3 lecturas · 1 escritura · 1 envío» de una atención.
     *
     * @param {Object} atencion
     * @returns {string}
     */
    resumen(atencion) {
      const datos = atencion.resumen || {}
      return RESUMEN
        .filter(function (fila) { return Number(datos[fila[0]]) > 0 })
        .map(function (fila) {
          const n = Number(datos[fila[0]])
          return n + ' ' + (n === 1 ? fila[1] : fila[2])
        })
        .join(' · ')
    },
  },
}
</script>

<style scoped lang="scss">
.martin-indicador {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	flex-shrink: 0;
	min-height: 1.5rem;
	padding: 0 0.4rem;
	border: 1px solid transparent;
	border-radius: 999px;
	background: transparent;
	font-size: 0.72rem;
	font-weight: 600;
	line-height: 1;
	color: var(--bs-secondary-color);

	&:hover,
	&:focus-visible {
		background: var(--bs-tertiary-bg);
		border-color: var(--bs-border-color);
	}
}

.martin-indicador-punto {
	width: 0.6rem;
	height: 0.6rem;
	border-radius: 50%;
	background: currentColor;
}

.martin-indicador--vacio .martin-indicador-punto {
	background: transparent;
	border: 1.5px solid currentColor;
}

.martin-indicador--acciones {
	color: var(--bs-primary);
}

.martin-indicador--escrituras {
	color: var(--bs-warning-text-emphasis);

	.martin-indicador-punto {
		background: var(--bs-warning);
	}
}

.martin-panel-aclaracion {
	margin-bottom: 0.75rem;
}

.martin-panel-escrituras {
	color: var(--bs-warning-text-emphasis);
	font-weight: 600;
}

.martin-panel-origen {
	margin-left: 0.25rem;
	font-size: 0.7rem;
	font-weight: 500;
	vertical-align: middle;
}

.martin-panel-atencion {
	overflow-wrap: anywhere;
}
</style>
