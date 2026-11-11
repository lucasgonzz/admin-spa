<template>
  <li class="ficha-entrada" :class="{ 'ficha-entrada--historial': !es_vigente, 'ficha-entrada--vencida': vencida }">
    <!--
      Una entrada de la ficha: el texto, y abajo quién la escribió, en qué ticket, cuándo y hasta
      cuándo vale. Las vigentes se pueden editar (= reemplazar) y dar de baja con motivo; las del
      historial (reemplazadas o dadas de baja) se muestran apagadas y sin acciones.
    -->
    <entrada-form
      v-if="modo === 'editar'"
      :entrada="entrada"
      :guardando="guardando"
      :error="error"
      @enviar="reemplazar"
      @cancelar="cancelar" />

    <template v-else>
      <div class="d-flex align-items-start gap-2">
        <p class="ficha-entrada__texto mb-0 flex-grow-1">{{ entrada.texto }}</p>
        <div v-if="es_vigente && modo === 'ver'" class="ficha-entrada__acciones flex-shrink-0">
          <button
            type="button"
            class="btn btn-sm btn-link p-1"
            title="Editar (se guarda como una entrada nueva que reemplaza a esta)"
            aria-label="Editar entrada"
            @click="abrir('editar')">
            <i class="bi bi-pencil" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="btn btn-sm btn-link p-1 text-danger"
            title="Dar de baja"
            aria-label="Dar de baja la entrada"
            @click="abrir('archivar')">
            <i class="bi bi-archive" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div class="ficha-entrada__meta">
        <span v-if="!es_vigente" class="badge" :class="entrada.status === 'archivada' ? 'text-bg-secondary' : 'text-bg-light border'">
          {{ entrada.status === 'archivada' ? 'Dada de baja' : 'Reemplazada' }}
        </span>
        <span v-if="mostrar_categoria" class="badge text-bg-light border">{{ categoria.singular }}</span>
        <span :class="entrada.source === 'martin' ? 'ficha-entrada__autor--martin' : 'ficha-entrada__autor--lucas'">
          <i :class="entrada.source === 'martin' ? 'bi bi-robot' : 'bi bi-person'" aria-hidden="true"></i>
          {{ autor }}
        </span>
        <router-link
          v-if="entrada.support_ticket_id"
          :to="{ name: 'support_ticket_conversation', params: { ticket_id: entrada.support_ticket_id } }"
          target="_blank"
          title="Abrir la conversación del ticket en otra pestaña">
          Ticket #{{ entrada.support_ticket_id }}
        </router-link>
        <span v-if="fecha" :title="'Escrita: ' + fecha_completa">{{ fecha }}</span>
        <span v-if="entrada.vigente_hasta" :class="vencida ? 'text-danger fw-semibold' : ''">
          <i class="bi bi-hourglass-split" aria-hidden="true"></i>
          {{ vencida ? 'Venció el' : 'Vence el' }} {{ vencimiento }}
        </span>
      </div>
      <p v-if="entrada.status === 'archivada' && entrada.archived_reason" class="ficha-entrada__motivo mb-0">
        Motivo de la baja: {{ entrada.archived_reason }}
      </p>

      <!-- Baja con motivo: queda en el historial, Martín deja de verla. -->
      <form v-if="modo === 'archivar'" class="ficha-entrada__baja" @submit.prevent="archivar">
        <label class="form-label small mb-1" :for="'ficha-baja-' + entrada.id">¿Por qué se da de baja?</label>
        <input
          :id="'ficha-baja-' + entrada.id"
          ref="motivo"
          v-model="motivo"
          type="text"
          class="form-control form-control-sm"
          :maxlength="motivo_max"
          :disabled="guardando"
          placeholder="Ej.: se cumplió, ya no es cierto, quedó repetida">
        <div v-if="error" class="alert alert-danger py-2 px-2 small mt-2 mb-0">{{ error }}</div>
        <div class="d-flex flex-wrap justify-content-end gap-2 mt-2">
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="guardando" @click="cancelar">
            Cancelar
          </button>
          <button type="submit" class="btn btn-sm btn-danger" :disabled="guardando || motivo.trim() === ''">
            <span v-if="guardando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            Dar de baja
          </button>
        </div>
      </form>
    </template>
  </li>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import EntradaForm from './EntradaForm.vue'
import { MOTIVO_MAX, autor_de, categoria_de, esta_vencida, fecha_corta, fecha_hora, fecha_sin_hora } from './categorias'

/**
 * Una entrada de la ficha de soporte del cliente, con sus dos acciones:
 *   - editar:  PUT  client/{id}/support-memory/{entry}          {texto, categoria, vigente_hasta}
 *   - baja:    POST client/{id}/support-memory/{entry}/archive  {motivo}
 *
 * Las dos le avisan al padre con `cambio` para que recargue la ficha (editar crea una entrada
 * nueva con otro id, así que la lista se vuelve a pedir entera).
 */
export default {
  name: 'FichaSoporteEntrada',
  components: { EntradaForm },
  emits: ['cambio'],
  props: {
    /** Id del cliente dueño de la ficha. */
    client_id: { type: [Number, String], required: true },
    /** La entrada (fila de client_support_memory_entries). */
    entrada: { type: Object, required: true },
    /** Muestra el chip de categoría (en el historial, donde no hay agrupado). */
    mostrar_categoria: { type: Boolean, default: false },
  },
  data() {
    return {
      // ver | editar | archivar
      modo: 'ver',
      motivo: '',
      motivo_max: MOTIVO_MAX,
      guardando: false,
      error: '',
    }
  },
  computed: {
    es_vigente() {
      return !this.entrada.status || this.entrada.status === 'vigente'
    },
    categoria() {
      return categoria_de(this.entrada.categoria)
    },
    autor() {
      return autor_de(this.entrada)
    },
    fecha() {
      return fecha_corta(this.entrada.created_at || this.entrada.updated_at)
    },
    fecha_completa() {
      return fecha_hora(this.entrada.created_at || this.entrada.updated_at)
    },
    vencimiento() {
      return fecha_sin_hora(this.entrada.vigente_hasta)
    },
    vencida() {
      return this.es_vigente && esta_vencida(this.entrada)
    },
    url_base() {
      return '/client/' + this.client_id + '/support-memory/' + this.entrada.id
    },
  },
  methods: {
    /** @param {'editar'|'archivar'} modo */
    abrir(modo) {
      const self = this
      this.modo = modo
      this.error = ''
      this.motivo = ''
      if (modo === 'archivar') {
        this.$nextTick(function () {
          if (self.$refs.motivo) {
            self.$refs.motivo.focus()
          }
        })
      }
    },
    cancelar() {
      this.modo = 'ver'
      this.error = ''
    },
    /**
     * Reemplaza la entrada (desde el panel siempre queda `source: lucas`).
     * @param {{categoria: string, texto: string, vigente_hasta: string|null}} cuerpo
     */
    reemplazar(cuerpo) {
      const self = this
      self.guardando = true
      self.error = ''
      api
        .put(self.url_base, cuerpo, { silent_error: true })
        .then(function (res) {
          self.guardando = false
          self.modo = 'ver'
          self.$emit('cambio', { accion: 'reemplazar', respuesta: res.data || {} })
        })
        .catch(function (err) {
          self.guardando = false
          self.error = resolve_error_message(err)
        })
    },
    /** Da de baja la entrada con el motivo escrito. */
    archivar() {
      const self = this
      const motivo = self.motivo.trim()
      if (motivo === '') {
        return
      }
      self.guardando = true
      self.error = ''
      api
        .post(self.url_base + '/archive', { motivo: motivo }, { silent_error: true })
        .then(function (res) {
          self.guardando = false
          self.modo = 'ver'
          self.$emit('cambio', { accion: 'archivar', respuesta: res.data || {} })
        })
        .catch(function (err) {
          self.guardando = false
          self.error = resolve_error_message(err)
        })
    },
  },
}
</script>

<style scoped lang="scss">
.ficha-entrada {
	list-style: none;
	padding: 0.6rem 0.75rem;
	border-bottom: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));

	&:last-child {
		border-bottom: 0;
	}
}

.ficha-entrada__texto {
	white-space: pre-line;
	overflow-wrap: anywhere;
	font-size: 0.92rem;
}

.ficha-entrada__acciones {
	display: inline-flex;
	gap: 0.1rem;
	margin-top: -0.25rem;
}

.ficha-entrada__meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.25rem 0.75rem;
	margin-top: 0.3rem;
	font-size: 0.75rem;
	color: var(--bs-secondary-color);

	a {
		text-decoration: none;
	}
}

.ficha-entrada__autor--martin {
	color: #0b5ed7;
}

.ficha-entrada__motivo {
	margin-top: 0.25rem;
	font-size: 0.75rem;
	font-style: italic;
	color: var(--bs-secondary-color);
}

.ficha-entrada__baja {
	margin-top: 0.5rem;
	padding: 0.6rem;
	border-radius: 0.5rem;
	background: var(--bs-danger-bg-subtle);
}

/* Historial (reemplazada o dada de baja): se lee, pero apagada. */
.ficha-entrada--historial .ficha-entrada__texto {
	color: var(--bs-secondary-color);
}

.ficha-entrada--vencida {
	background: var(--bs-warning-bg-subtle);
}
</style>
