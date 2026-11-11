<template>
  <div class="ficha-tickets">
    <!--
      Índice de los tickets del cliente: número, título y resumen (los pone Martín con `titular`).
      Es lo mismo que Martín ve como `indice_tickets`: para encontrar a qué conversación vieja
      volver. Cada fila abre la conversación en otra pestaña, para no perder la ficha.
    -->
    <div v-if="cargando" class="text-center py-3">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
    </div>
    <div v-else-if="error" class="alert alert-danger py-2 small mb-0">{{ error }}</div>
    <p v-else-if="!tickets.length" class="text-muted small fst-italic mb-0">
      Este cliente todavía no tiene tickets de soporte.
    </p>
    <ul v-else class="ficha-tickets__lista mb-0">
      <li v-for="t in tickets_visibles" :key="t.id" class="ficha-tickets__fila">
        <router-link
          class="ficha-tickets__link"
          :to="{ name: 'support_ticket_conversation', params: { ticket_id: t.id } }"
          target="_blank"
          :title="'Abrir el ticket #' + t.id + ' en otra pestaña'">
          <div class="d-flex align-items-baseline gap-2 min-w-0">
            <span class="ficha-tickets__titulo text-truncate">
              #{{ t.id }}<template v-if="titulo(t)"> · {{ titulo(t) }}</template>
            </span>
            <span class="badge ms-auto flex-shrink-0" :class="t.status === 'closed' ? 'text-bg-light border' : 'text-bg-success'">
              {{ t.status === 'closed' ? 'Cerrado' : 'Abierto' }}
            </span>
          </div>
          <p v-if="resumen(t)" class="ficha-tickets__resumen mb-0">{{ resumen(t) }}</p>
          <p v-else class="ficha-tickets__resumen ficha-tickets__resumen--vacio mb-0">Sin resumen todavía.</p>
          <small class="ficha-tickets__fecha">
            {{ fecha_de(t) }}<template v-if="mensajes_de(t) !== null"> · {{ mensajes_de(t) }} {{ mensajes_de(t) === 1 ? 'mensaje' : 'mensajes' }}</template>
          </small>
        </router-link>
      </li>
    </ul>
    <button
      v-if="!cargando && tickets.length > limite && !ver_todos"
      type="button"
      class="btn btn-sm btn-link px-0 mt-1"
      @click="ver_todos = true">
      Ver los {{ tickets.length }} tickets
    </button>
  </div>
</template>

<script>
import { fecha_corta } from './categorias'

/**
 * Lista de tickets del cliente para la ficha de soporte. Solo muestra: la carga la hace el padre.
 *
 * Acepta tanto la fila de la bandeja (`name`, `summary`, `created_at`) como la forma del índice
 * de Martín (`titulo`, `resumen`, `opened_at`, `mensajes`).
 */
export default {
  name: 'FichaSoporteTickets',
  props: {
    tickets: { type: Array, default: function () { return [] } },
    cargando: { type: Boolean, default: false },
    error: { type: String, default: '' },
  },
  data() {
    return {
      // Cuántos se muestran antes de «Ver los N tickets».
      limite: 8,
      ver_todos: false,
    }
  },
  computed: {
    tickets_visibles() {
      return this.ver_todos ? this.tickets : this.tickets.slice(0, this.limite)
    },
  },
  methods: {
    titulo(t) {
      return String(t.titulo || t.name || '').trim()
    },
    resumen(t) {
      return String(t.resumen || t.summary || '').trim()
    },
    fecha_de(t) {
      return fecha_corta(t.opened_at || t.created_at)
    },
    /** Cantidad de mensajes si el backend la manda; null si no. */
    mensajes_de(t) {
      const n = t.mensajes != null ? t.mensajes : t.messages_count
      return n == null ? null : Number(n)
    },
  },
}
</script>

<style scoped lang="scss">
.ficha-tickets__lista {
	list-style: none;
	padding: 0;
	border: 1px solid var(--bs-border-color);
	border-radius: 0.5rem;
	background: #fff;
}

.ficha-tickets__fila {
	border-bottom: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));

	&:last-child {
		border-bottom: 0;
	}
}

.ficha-tickets__link {
	display: block;
	padding: 0.55rem 0.75rem;
	color: inherit;
	text-decoration: none;

	&:hover {
		background: var(--bs-tertiary-bg, #f5f6f6);
	}
}

.ficha-tickets__titulo {
	font-weight: 600;
	font-size: 0.9rem;
	min-width: 0;
}

.ficha-tickets__resumen {
	font-size: 0.82rem;
	color: var(--bs-body-color);
	overflow-wrap: anywhere;
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.ficha-tickets__resumen--vacio {
	color: var(--bs-secondary-color);
	font-style: italic;
}

.ficha-tickets__fecha {
	font-size: 0.72rem;
	color: var(--bs-secondary-color);
}
</style>
