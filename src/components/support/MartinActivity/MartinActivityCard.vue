<template>
  <!--
    «Recorrido de Martín»: tarjeta plegable al final de una atención, con el objetivo, los pasos
    del plan y «Ver acciones». Arranca plegada mostrando cuántos pasos quedaron hechos.
  -->
  <section class="martin-tarjeta" :class="{ 'martin-tarjeta--abierta': abierta }">
    <button
      type="button"
      class="martin-tarjeta-cabecera"
      :aria-expanded="abierta ? 'true' : 'false'"
      @click="abierta = !abierta">
      <i class="bi bi-signpost-2 martin-tarjeta-icono" aria-hidden="true"></i>
      <span class="martin-tarjeta-titulo">Recorrido de Martín</span>
      <span v-if="seguimiento" class="badge rounded-pill text-bg-info martin-tarjeta-origen">{{ rotulo_seguimiento }}</span>
      <span class="martin-tarjeta-meta">{{ meta }}</span>
      <i class="bi martin-tarjeta-chevron" :class="abierta ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
    </button>
    <div v-if="abierta" class="martin-tarjeta-cuerpo">
      <martin-attention-detail :atencion="atencion" />
      <p class="martin-tarjeta-aclaracion mb-0">{{ aclaracion }}</p>
    </div>
  </section>
</template>

<script>
import MartinAttentionDetail from './MartinAttentionDetail.vue'
import { rango_de_atencion, es_seguimiento, ROTULO_SEGUIMIENTO, ACLARACION_ACTIVIDAD } from '@/utils/martin_activity'

/**
 * Tarjeta del recorrido de una atención de Martín en la conversación.
 */
export default {
  name: 'MartinActivityCard',
  components: { MartinAttentionDetail },
  props: {
    /**
     * Atención tal como la devuelve `GET support-ticket/{id}/martin-activity`.
     */
    atencion: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      /** Tarjeta desplegada. */
      abierta: false,
      aclaracion: ACLARACION_ACTIVIDAD,
      rotulo_seguimiento: ROTULO_SEGUIMIENTO,
    }
  },
  computed: {
    /**
     * true si la atención es de un seguimiento proactivo.
     *
     * @returns {boolean}
     */
    seguimiento() {
      return es_seguimiento(this.atencion)
    },
    /**
     * «11/11/26, 14:02 a 14:20 · 3 de 5 pasos» (o la cantidad de acciones si no hay plan).
     *
     * @returns {string}
     */
    meta() {
      const pasos = Array.isArray(this.atencion.pasos) ? this.atencion.pasos : []
      const rango = rango_de_atencion(this.atencion)
      if (pasos.length) {
        const hechos = pasos.filter(function (paso) { return paso.estado === 'hecho' }).length
        return rango + ' · ' + hechos + ' de ' + pasos.length + ' pasos'
      }
      const acciones = Array.isArray(this.atencion.acciones) ? this.atencion.acciones.length : 0
      return rango + ' · ' + acciones + (acciones === 1 ? ' acción' : ' acciones')
    },
  },
}
</script>

<style scoped lang="scss">
.martin-tarjeta {
	width: min(100%, 28rem);
	margin-top: 0.35rem;
	border: 1px solid var(--bs-border-color);
	border-radius: 10px;
	background: var(--bs-body-bg);
	box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
	text-align: left;
}

.martin-tarjeta-cabecera {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.15rem 0.4rem;
	width: 100%;
	padding: 0.4rem 0.6rem;
	border: 0;
	border-radius: 10px;
	background: transparent;
	font-size: 0.8rem;
	text-align: left;
	color: var(--bs-body-color);

	&:hover,
	&:focus-visible {
		background: var(--bs-tertiary-bg);
	}
}

.martin-tarjeta-icono {
	color: var(--bs-primary);
}

.martin-tarjeta-titulo {
	font-weight: 600;
}

.martin-tarjeta-origen {
	font-size: 0.68rem;
	font-weight: 500;
}

.martin-tarjeta-meta {
	font-size: 0.72rem;
	color: var(--bs-secondary-color);
}

.martin-tarjeta-chevron {
	margin-left: auto;
	color: var(--bs-secondary-color);
}

.martin-tarjeta-cuerpo {
	padding: 0.25rem 0.6rem 0.6rem;
	border-top: 1px solid var(--bs-border-color);
	padding-top: 0.5rem;
}

.martin-tarjeta-aclaracion {
	margin-top: 0.5rem;
	font-size: 0.7rem;
	color: var(--bs-secondary-color);
}
</style>
