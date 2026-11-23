<template>
  <!--
    Mis tareas (misión embudo-juan-pipeline, E1): las tareas abiertas asignadas al admin, arriba del
    tablero de Juan. Son las que crea el embudo («el lead creó su prueba», «pidió la implementación»)
    y le piden una llamada.

    Es una lista compacta: cada una con el lead, qué hay que hacer, «Abrir conversación» (lleva a la
    conversación del lead, en sólo lectura para el perfil) y «Hecha». Registrar una llamada cierra
    sola las tareas del embudo de ese lead; el tablero le pide a este componente que se recargue
    (`load`, vía ref).

    El perfil «Sólo Leads» no ve Tareas: estos endpoints (`lead-tablero/…`) son los únicos que
    tiene para esto, y por eso no se usa `GET task`.
  -->
  <section class="mt-tareas" aria-label="Mis tareas">
    <header class="mt-tareas__header">
      <h3 class="mt-tareas__title">
        <i class="bi bi-check2-square" aria-hidden="true" />Mis tareas
        <span class="mt-tareas__count">{{ tareas.length }}</span>
      </h3>
      <button
        v-if="tareas.length"
        type="button"
        class="btn btn-link btn-sm mt-tareas__toggle"
        :aria-expanded="abierta ? 'true' : 'false'"
        @click="abierta = !abierta"
      >
        {{ abierta ? 'Ocultar' : 'Mostrar' }}
      </button>
    </header>

    <p v-if="loading && !loaded_once" class="mt-tareas__empty">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true" />Cargando tareas…
    </p>
    <p v-else-if="load_error" class="mt-tareas__empty mt-tareas__empty--error">
      {{ load_error }}
      <button type="button" class="btn btn-link btn-sm p-0 ms-1" @click="load">Reintentar</button>
    </p>
    <p v-else-if="!tareas.length" class="mt-tareas__empty">No tenés tareas pendientes.</p>

    <ul v-else-if="abierta" class="mt-tareas__list">
      <li v-for="tarea in tareas" :key="tarea.id" class="mt-tareas__item">
        <div class="mt-tareas__body">
          <p class="mt-tareas__title-line">{{ tarea.title }}</p>
          <p class="mt-tareas__lead">
            {{ nombre_del_lead(tarea) }}
            <span v-if="tarea.created_at" class="mt-tareas__when" :title="format_datetime(tarea.created_at)">· {{ format_relative(tarea.created_at) }}</span>
          </p>
        </div>
        <div class="mt-tareas__actions">
          <router-link
            v-if="tarea.lead_id"
            class="btn btn-outline-secondary btn-sm"
            :to="{ name: 'lead_conversation', params: { lead_id: tarea.lead_id } }"
          >
            Abrir conversación
          </router-link>
          <button
            type="button"
            class="btn btn-outline-primary btn-sm"
            :disabled="marcando_id === tarea.id"
            @click="marcar_hecha(tarea)"
          >
            {{ marcando_id === tarea.id ? 'Marcando…' : 'Hecha' }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { show_toast } from '@/components/pipeline/pipeline_helpers'
import { format_datetime, format_relative } from '@/utils/pipeline_dates'

/**
 * Lista de tareas abiertas del admin autenticado.
 */
export default {
  name: 'PipelineMisTareas',
  data() {
    return {
      /** Tareas abiertas (`GET lead-tablero/mis-tareas`, hasta 100). */
      tareas: [],
      loading: false,
      /** true cuando ya se mostró algo: las recargas no tapan la lista con el spinner. */
      loaded_once: false,
      load_error: null,
      /** false = lista plegada (queda sólo el encabezado con el conteo). */
      abierta: true,
      /** Id de la tarea que se está marcando como hecha (evita el doble clic). */
      marcando_id: null,
    }
  },
  created() {
    this.load()
  },
  methods: {
    format_datetime,
    format_relative,

    /**
     * Pide las tareas abiertas. Lo llama el tablero (por ref) después de registrar una llamada, porque
     * eso cierra tareas del embudo.
     */
    load() {
      const self = this
      this.loading = true
      this.load_error = null
      api
        .get('/lead-tablero/mis-tareas')
        .then(function (res) {
          const data = res.data || {}
          self.tareas = Array.isArray(data.models) ? data.models : []
          self.loading = false
          self.loaded_once = true
        })
        .catch(function (error) {
          self.loading = false
          // Con una lista ya mostrada, un error de red no la borra: sólo falla la recarga.
          if (!self.loaded_once) {
            self.load_error = resolve_error_message(error)
          }
        })
    },

    /**
     * «Hecha»: POST lead-tablero/tareas/{id}/hecha y la saca de la lista. Una tarea que ya no es de este
     * admin (403 `tarea_ajena`) o ya no existe se resuelve recargando la lista.
     *
     * @param {Object} tarea Tarea de la lista.
     */
    marcar_hecha(tarea) {
      const self = this
      if (this.marcando_id !== null) {
        return
      }
      this.marcando_id = tarea.id
      api
        .post('/lead-tablero/tareas/' + tarea.id + '/hecha')
        .then(function () {
          self.marcando_id = null
          self.tareas = self.tareas.filter(function (t) {
            return Number(t.id) !== Number(tarea.id)
          })
          show_toast('Tarea marcada como hecha.')
        })
        .catch(function () {
          self.marcando_id = null
          self.load()
        })
    },

    /**
     * Cómo se nombra al lead en la lista: contacto y empresa, lo que haya.
     *
     * @param {Object} tarea Tarea de la lista.
     * @returns {string}
     */
    nombre_del_lead(tarea) {
      const lead = tarea.lead || {}
      const partes = [lead.contact_name, lead.company_name].filter(function (parte) {
        return parte && String(parte).trim() !== ''
      })
      return partes.length ? partes.join(' · ') : 'Sin lead'
    },
  },
}
</script>

<style scoped>
/* Nunca más ancha que el área del módulo: en el teléfono el texto se corta en vez de empujar la página. */
.mt-tareas {
  min-width: 0;
  max-width: 100%;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  background: var(--bg-card);
}

.mt-tareas__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.mt-tareas__title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.mt-tareas__count {
  min-width: 1.5rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--bg-hover);
  font-size: 0.75rem;
  text-align: center;
  color: var(--color-text-secondary);
}

.mt-tareas__toggle {
  padding: 0;
  text-decoration: none;
  color: var(--color-text-secondary);
}

.mt-tareas__empty {
  margin: 0.4rem 0 0;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}

.mt-tareas__empty--error {
  color: var(--bs-danger, #dc3545);
}

.mt-tareas__list {
  display: flex;
  flex-direction: column;
  margin: 0.4rem 0 0;
  padding: 0;
  list-style: none;
}

.mt-tareas__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.75rem;
  min-width: 0;
  padding: 0.5rem 0;
  border-top: 1px solid var(--color-border-secondary);
}

.mt-tareas__body {
  flex: 1 1 14rem;
  min-width: 0;
}

.mt-tareas__body p {
  margin: 0;
}

.mt-tareas__title-line {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
  word-break: break-word;
}

.mt-tareas__lead {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  word-break: break-word;
}

.mt-tareas__actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 0.4rem;
}
</style>
