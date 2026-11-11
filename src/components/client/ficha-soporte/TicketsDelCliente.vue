<template>
  <div class="ficha-tickets">
    <!--
      Índice de los tickets del cliente: número, título y resumen (los pone Martín con `titular`).
      Es lo mismo que Martín ve como `indice_tickets`: para encontrar a qué conversación vieja
      volver. El título abre la conversación en otra pestaña, para no perder la ficha; el resumen
      se corrige acá mismo con el lápiz.
    -->
    <p v-if="!tickets.length" class="text-muted small fst-italic mb-0">
      Este cliente todavía no tiene tickets de soporte.
    </p>
    <ul v-else class="ficha-tickets__lista mb-0">
      <li v-for="t in tickets_visibles" :key="t.id" class="ficha-tickets__fila">
        <div class="d-flex align-items-center gap-2 min-w-0">
          <router-link
            class="ficha-tickets__titulo text-truncate"
            :to="{ name: 'support_ticket_conversation', params: { ticket_id: t.id } }"
            target="_blank"
            :title="encabezado(t) + ' (se abre en otra pestaña)'">
            {{ encabezado(t) }}
          </router-link>
          <span class="badge ms-auto flex-shrink-0" :class="estado(t).clase">{{ estado(t).label }}</span>
          <button
            v-if="editando_id !== t.id"
            type="button"
            class="btn btn-sm btn-link p-0 flex-shrink-0"
            title="Editar el resumen"
            aria-label="Editar el resumen del ticket"
            @click="editar(t)">
            <i class="bi bi-pencil" aria-hidden="true"></i>
          </button>
        </div>

        <form v-if="editando_id === t.id" class="ficha-tickets__editor" @submit.prevent="guardar(t)">
          <textarea
            ref="editor"
            v-model="borrador"
            class="form-control form-control-sm"
            rows="3"
            :maxlength="max_resumen"
            :disabled="guardando"
            aria-label="Resumen del ticket"
            placeholder="Qué pasó, qué se hizo y cómo quedó"></textarea>
          <div class="d-flex flex-wrap align-items-center justify-content-end gap-2 mt-1">
            <small class="text-muted me-auto">{{ borrador.length }}/{{ max_resumen }}</small>
            <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="guardando" @click="editando_id = null">
              Cancelar
            </button>
            <button type="submit" class="btn btn-sm btn-primary" :disabled="guardando || borrador.trim() === resumen(t)">
              <span v-if="guardando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              Guardar
            </button>
          </div>
          <div v-if="error_edicion" class="alert alert-danger py-2 px-2 small mt-2 mb-0">{{ error_edicion }}</div>
        </form>
        <template v-else>
          <p v-if="resumen(t)" class="ficha-tickets__resumen mb-0" :title="resumen(t)">{{ resumen(t) }}</p>
          <p v-else class="ficha-tickets__resumen ficha-tickets__resumen--vacio mb-0">Sin resumen todavía.</p>
        </template>
        <small class="ficha-tickets__fecha">
          {{ fecha_de(t) }}<template v-if="mensajes_de(t) !== null"> · {{ mensajes_de(t) }} {{ mensajes_de(t) === 1 ? 'mensaje' : 'mensajes' }}</template>
        </small>
      </li>
    </ul>
    <button
      v-if="tickets.length > limite && !ver_todos"
      type="button"
      class="btn btn-sm btn-link px-0 mt-1"
      @click="ver_todos = true">
      Ver los {{ tickets.length }} tickets
    </button>
  </div>
</template>

<script>
import api from '@/utils/axios'
import { error_legible, fecha_corta } from './categorias'

/**
 * Lista de tickets del cliente para la ficha de soporte (viene en `tickets` del GET de la ficha).
 *
 * Acepta tanto la forma del índice (`titulo`, `resumen`, `opened_at`, `mensajes`) como la fila de
 * la bandeja (`name`, `summary`, `created_at`).
 *
 * El resumen se corrige con el mismo PUT support-ticket/{id} que usa el header de la bandeja,
 * mandando solo `summary`. Al guardar emite `resumen-guardado` ({id, resumen}) para que el padre
 * actualice su lista.
 */
export default {
  name: 'FichaSoporteTickets',
  emits: ['resumen-guardado'],
  props: {
    tickets: { type: Array, default: function () { return [] } },
  },
  data() {
    return {
      // Cuántos se muestran antes de «Ver los N tickets».
      limite: 8,
      ver_todos: false,
      // Ticket cuyo resumen se está editando (null = ninguno).
      editando_id: null,
      borrador: '',
      guardando: false,
      error_edicion: '',
      // Largo máximo de support_tickets.summary.
      max_resumen: 600,
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
    /** «#89 · título», o «Ticket #89» si no tiene. */
    encabezado(t) {
      const titulo = this.titulo(t)
      return titulo ? '#' + t.id + ' · ' + titulo : 'Ticket #' + t.id
    },
    /**
     * Etiqueta del estado con el mismo criterio que la bandeja: cerrado si `status` es `closed` o
     * tiene `closed_at`; abierto si es `open`. Un estado que la bandeja no conoce se muestra tal cual.
     */
    estado(t) {
      if (t.status === 'closed' || t.closed_at) {
        return { label: 'Cerrado', clase: 'text-bg-light border' }
      }
      if (t.status === 'open') {
        return { label: 'Abierto', clase: 'text-bg-success' }
      }
      return { label: String(t.status || 'Sin estado'), clase: 'text-bg-secondary' }
    },
    fecha_de(t) {
      return fecha_corta(t.opened_at || t.created_at)
    },
    /** Cantidad de mensajes si el backend la manda; null si no. */
    mensajes_de(t) {
      const n = t.mensajes != null ? t.mensajes : t.messages_count
      return n == null ? null : Number(n)
    },
    editar(t) {
      const self = this
      self.editando_id = t.id
      self.borrador = self.resumen(t)
      self.error_edicion = ''
      self.$nextTick(function () {
        const ref = self.$refs.editor
        const el = Array.isArray(ref) ? ref[0] : ref
        if (el) {
          el.focus()
        }
      })
    },
    guardar(t) {
      const self = this
      const texto = self.borrador.trim()
      self.guardando = true
      self.error_edicion = ''
      api
        .put('/support-ticket/' + t.id, { id: t.id, summary: texto === '' ? null : texto }, { silent_error: true })
        .then(function (res) {
          const model = res.data && res.data.model ? res.data.model : null
          const guardado = model && Object.prototype.hasOwnProperty.call(model, 'summary') ? model.summary : texto
          self.guardando = false
          self.editando_id = null
          self.$emit('resumen-guardado', { id: t.id, resumen: guardado == null ? '' : String(guardado) })
        })
        .catch(function (err) {
          self.guardando = false
          self.error_edicion = error_legible(err)
        })
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
	padding: 0.55rem 0.75rem;
	border-bottom: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));

	&:last-child {
		border-bottom: 0;
	}
}

.ficha-tickets__titulo {
	font-weight: 600;
	font-size: 0.9rem;
	min-width: 0;
	color: inherit;
	text-decoration: none;

	&:hover {
		text-decoration: underline;
	}
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

.ficha-tickets__editor {
	margin: 0.35rem 0;
}

.ficha-tickets__fecha {
	font-size: 0.72rem;
	color: var(--bs-secondary-color);
}
</style>
