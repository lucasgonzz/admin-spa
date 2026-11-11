<template>
  <!--
    Una atención de Martín: el objetivo, el plan con sus pasos (como la lista de tareas de Claude
    Code: tilde en los hechos, el que está en curso marcado, tachados los descartados) y la lista
    de acciones con ícono por tipo. La usan el panel del encabezado y la tarjeta de la conversación.
  -->
  <div class="martin-atencion">
    <p v-if="atencion.objetivo" class="martin-atencion-objetivo mb-2">
      <span class="martin-atencion-rotulo">Objetivo</span>
      {{ atencion.objetivo }}
    </p>
    <ol v-if="pasos.length" class="martin-pasos list-unstyled mb-2">
      <li
        v-for="(paso, indice) in pasos"
        :key="indice"
        class="martin-paso"
        :class="'martin-paso--' + estado(paso).estado">
        <i class="bi martin-paso-icono" :class="estado(paso).icono" :title="estado(paso).rotulo" aria-hidden="true"></i>
        <span class="visually-hidden">{{ estado(paso).rotulo }}:</span>
        <span class="martin-paso-texto">{{ paso.texto }}</span>
        <span v-if="estado(paso).estado === 'en_curso'" class="martin-paso-marca">en curso</span>
      </li>
    </ol>
    <p v-else class="martin-atencion-sin-plan small text-muted mb-2">Martín no declaró un plan en esta atención.</p>

    <button
      v-if="acciones.length"
      type="button"
      class="btn btn-link btn-sm p-0 martin-atencion-toggle"
      :aria-expanded="acciones_visibles ? 'true' : 'false'"
      @click="acciones_visibles = !acciones_visibles">
      <i class="bi" :class="acciones_visibles ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
      {{ acciones_visibles ? 'Ocultar acciones' : 'Ver acciones (' + acciones.length + ')' }}
    </button>
    <p v-else class="small text-muted mb-0">Sin acciones registradas en esta atención.</p>

    <ul v-if="acciones_visibles && acciones.length" class="martin-acciones list-unstyled mb-0 mt-2">
      <li
        v-for="(accion, indice) in acciones"
        :key="indice"
        class="martin-accion"
        :class="'martin-accion--' + tipo(accion).tipo">
        <i class="bi martin-accion-icono" :class="tipo(accion).icono" :title="tipo(accion).rotulo" aria-hidden="true"></i>
        <div class="martin-accion-cuerpo">
          <div class="martin-accion-resumen">
            <span class="visually-hidden">{{ tipo(accion).rotulo }}:</span>
            {{ accion.summary || accion.command }}
          </div>
          <div class="martin-accion-meta">
            <span>{{ hora(accion.occurred_at) }}</span>
            <span v-if="accion.command" class="martin-accion-comando">{{ accion.command }}</span>
            <span v-if="detalle(accion)">{{ detalle(accion) }}</span>
            <span v-if="tipo(accion).tipo === 'error'" class="text-danger">no salió bien</span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import { estado_de_paso, tipo_de_accion, hora_corta, detalle_de_accion } from '@/utils/martin_activity'

/**
 * Objetivo, plan y acciones de una atención de Martín.
 */
export default {
  name: 'MartinAttentionDetail',
  props: {
    /**
     * Atención tal como la devuelve `GET support-ticket/{id}/martin-activity`.
     */
    atencion: {
      type: Object,
      required: true,
    },
    /**
     * true para mostrar las acciones desplegadas de entrada (el panel del encabezado).
     */
    acciones_abiertas: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      /** Lista de acciones desplegada. */
      acciones_visibles: this.acciones_abiertas,
    }
  },
  computed: {
    /**
     * Pasos del plan (vacío si Martín no declaró plan).
     *
     * @returns {Array<Object>}
     */
    pasos() {
      return Array.isArray(this.atencion.pasos) ? this.atencion.pasos : []
    },
    /**
     * Acciones de la atención, en orden de ocurrencia.
     *
     * @returns {Array<Object>}
     */
    acciones() {
      return Array.isArray(this.atencion.acciones) ? this.atencion.acciones : []
    },
  },
  methods: {
    estado(paso) {
      return estado_de_paso(paso)
    },
    tipo(accion) {
      return tipo_de_accion(accion)
    },
    hora(valor) {
      return hora_corta(valor)
    },
    detalle(accion) {
      return detalle_de_accion(accion)
    },
  },
}
</script>

<style scoped lang="scss">
.martin-atencion {
	font-size: 0.82rem;
	overflow-wrap: anywhere;
}

.martin-atencion-rotulo {
	display: block;
	font-size: 0.7rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.02em;
	color: var(--bs-secondary-color);
}

.martin-atencion-objetivo {
	line-height: 1.3;
}

.martin-pasos {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
}

.martin-paso {
	display: flex;
	align-items: flex-start;
	gap: 0.4rem;
	line-height: 1.3;
}

.martin-paso-icono {
	flex-shrink: 0;
	margin-top: 0.1rem;
	color: var(--bs-secondary-color);
}

.martin-paso--hecho .martin-paso-icono {
	color: var(--bs-success);
}

.martin-paso--en_curso {
	font-weight: 600;

	.martin-paso-icono {
		color: var(--bs-primary);
	}
}

.martin-paso--descartado .martin-paso-texto {
	text-decoration: line-through;
	color: var(--bs-secondary-color);
}

.martin-paso-marca {
	flex-shrink: 0;
	font-size: 0.7rem;
	font-weight: 500;
	color: var(--bs-primary);
}

.martin-atencion-toggle {
	font-size: 0.8rem;
	text-decoration: none;
}

.martin-acciones {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	border-top: 1px solid var(--bs-border-color);
	padding-top: 0.5rem;
}

.martin-accion {
	display: flex;
	align-items: flex-start;
	gap: 0.45rem;
}

.martin-accion-icono {
	flex-shrink: 0;
	margin-top: 0.1rem;
	color: var(--bs-secondary-color);
}

.martin-accion--escritura .martin-accion-icono {
	color: var(--bs-warning-text-emphasis);
}

/* Registro interno (ficha, título, notas): otro color que la escritura en el sistema del cliente. */
.martin-accion--registro .martin-accion-icono {
	color: var(--bs-info-text-emphasis);
}

.martin-accion--envio .martin-accion-icono {
	color: var(--bs-primary);
}

.martin-accion--plan .martin-accion-icono {
	color: var(--bs-success);
}

.martin-accion--error .martin-accion-icono {
	color: var(--bs-danger);
}

.martin-accion-cuerpo {
	min-width: 0;
	flex-grow: 1;
}

.martin-accion-resumen {
	line-height: 1.3;
}

.martin-accion-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 0 0.5rem;
	font-size: 0.72rem;
	color: var(--bs-secondary-color);
}

.martin-accion-comando {
	font-family: var(--bs-font-monospace);
}
</style>
