<template>
  <div class="container-fluid px-0 py-4" style="max-width: 1080px">
    <!-- Encabezado con el avance global (criterio de éxito #3 del prompt): título + "X de Y cargados" -->
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
      <div>
        <h2 class="h4 mb-1">Multimedia de la demo</h2>
        <p class="text-muted small mb-0">
          Cargá el link de cada clip. Se guarda solo, campo por campo -- no hace falta un botón
          final.
        </p>
      </div>
      <div v-if="!loading && !load_error && total_slots > 0" class="text-end">
        <div class="fs-5 fw-semibold">{{ loaded_count }} de {{ total_slots }} cargados</div>
      </div>
    </div>

    <!-- Carga inicial -->
    <div v-if="loading" class="text-center py-5">
      <span class="spinner-border text-primary" role="status" aria-hidden="true" />
      <p class="text-muted mt-2">Cargando catálogo…</p>
    </div>

    <!-- Error de red al cargar (distinto de "catálogo no sincronizado": acá el GET mismo falló) -->
    <div v-else-if="load_error" class="alert alert-danger">{{ load_error }}</div>

    <!-- Caso "catálogo no sincronizado": el backend devuelve slots vacío (criterio de éxito #6) -->
    <div v-else-if="total_slots === 0" class="alert alert-warning">
      El catálogo de la demo todavía no se sincronizó desde GitHub, así que no hay ningún slot
      para cargar. Sincronizalo desde
      <router-link :to="{ path: '/cuenta', hash: '#agent-prompt-sync' }">
        Cuenta → Prompts desde GitHub
      </router-link>
      y volvé a esta pantalla.
    </div>

    <!-- Pantalla principal: generada 100% desde el catálogo devuelto por el backend, sin
         ninguna lista de secciones/clips hardcodeada acá -->
    <template v-else>
      <!-- Detalle de avance por grupo, en el mismo orden que devuelve el backend -->
      <div class="card mb-4">
        <div class="card-body py-3">
          <div class="row g-2">
            <div v-for="g in grouped_slots" :key="'resumen-' + g.grupo" class="col-6 col-md-4 col-lg-3 small">
              <span class="text-muted">{{ g.grupo }}:</span>
              <span class="fw-semibold">{{ g.loaded_count }}/{{ g.slots.length }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Un bloque por grupo (las seis secciones del sistema, "Videos fuera de sección" y
           "Scroll de la página inmersiva"), en el orden que llega del backend -->
      <div v-for="g in grouped_slots" :key="g.grupo" class="mb-4">
        <h3 class="h6 text-uppercase text-muted mb-2">{{ g.grupo }}</h3>
        <div class="card">
          <ul class="list-group list-group-flush">
            <li v-for="slot in g.slots" :key="slot.id" class="list-group-item">
              <div class="row g-2 align-items-center">
                <!-- Título + id del clip, y (solo para clips de sección) tipo núcleo/biblioteca
                     y condición de personalización -->
                <div class="col-12 col-md-4">
                  <div class="fw-semibold">
                    {{ slot.titulo }}
                    <span
                      v-if="is_tipo_seccion(slot)"
                      class="badge ms-1 align-middle"
                      :class="tipo_badge_class(slot.tipo)"
                    >
                      {{ tipo_label(slot.tipo) }}
                    </span>
                  </div>
                  <div class="small text-muted">
                    <code>{{ slot.id }}</code>
                  </div>
                  <div v-if="slot.condicion" class="small text-muted">
                    Condición: {{ slot.condicion }}
                  </div>
                </div>

                <!-- Campo de URL: se guarda solo al perder foco si cambió (criterio de éxito
                     #2 y #3); también hay un botón por si el guardado de blur no corre
                     (ej. touch que navega sin blur) -->
                <div class="col-12 col-md-6">
                  <input
                    v-if="row_state[slot.id]"
                    v-model="row_state[slot.id].value"
                    type="text"
                    class="form-control form-control-sm"
                    placeholder="URL del clip"
                    :disabled="row_state[slot.id].saving"
                    @blur="on_blur(slot.id)"
                  />
                  <div v-if="row_state[slot.id] && row_state[slot.id].error" class="small text-danger mt-1">
                    {{ row_state[slot.id].error }}
                  </div>
                  <div v-else-if="row_state[slot.id] && row_state[slot.id].saved_flash" class="small text-success mt-1">
                    ✓ Guardado
                  </div>
                </div>

                <!-- Indicador de estado: cargado / sin cargar, de un golpe de vista -->
                <div class="col-6 col-md-1 text-md-center">
                  <span
                    v-if="row_state[slot.id] && row_state[slot.id].saving"
                    class="spinner-border spinner-border-sm text-primary"
                    role="status"
                    aria-hidden="true"
                  />
                  <span v-else class="badge" :class="has_url(slot.id) ? 'bg-success' : 'bg-secondary'">
                    {{ has_url(slot.id) ? 'Cargado' : 'Sin cargar' }}
                  </span>
                </div>

                <!-- Botón de guardado explícito por fila (alternativa al blur, pedida por el prompt) -->
                <div class="col-6 col-md-1 text-md-end">
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    :disabled="!row_state[slot.id] || row_state[slot.id].saving"
                    @click="save_row(slot.id)"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { resolve_error_message } from '@/utils/axios'

/**
 * Pantalla administrativa de multimedia de la demo (grupo 300 · pagina-inmersiva-demo, prompt 06
 * -- contexto/demo_experiencia.md §3.18). Contracara autenticada de la página pública
 * /experiencia/:uuid: acá el equipo carga/edita la URL de cada uno de los slots del catálogo
 * (hoy 43), consumiendo GET/PUT /demo-media (DemoMediaController, ya pusheado en prompt 02).
 *
 * Punto de diseño central: la pantalla se arma ENTERAMENTE a partir de lo que devuelve el
 * backend (`slots`, agrupados por `grupo`, en el orden que ya resuelve
 * DemoCatalogoService::slots()). No hay ninguna lista de secciones, clips o ids hardcodeada acá
 * -- si mañana se agrega un clip al catálogo del repo y se sincroniza, la fila aparece sola.
 */
export default {
  name: 'ViewDemoMediaConfig',

  data() {
    return {
      /**
       * Estado local por fila, keyed por slot_id: `value` (texto editable del input),
       * `saved_value` (último valor efectivamente persistido, para no re-guardar en un blur sin
       * cambios), `saving`, `error` y `saved_flash` (confirmación visual transitoria). Se arma
       * en `initialize_rows()` después de la carga inicial.
       */
      row_state: {},
    }
  },

  computed: {
    /** true mientras está en curso el GET inicial. */
    loading() {
      return this.$store.state.demo_media.loading
    },
    /** Mensaje de error si el GET inicial falló por red/servidor (no es el caso "sin sincronizar"). */
    load_error() {
      return this.$store.state.demo_media.load_error
    },
    /** Slots del catálogo tal como los devolvió el backend, sin reordenar. */
    slots() {
      return this.$store.state.demo_media.slots
    },
    /** Cantidad total de slots del catálogo. */
    total_slots() {
      return this.slots.length
    },
    /** Cantidad de slots con URL cargada, sobre el total. */
    loaded_count() {
      const self = this
      return this.slots.filter(function (slot) {
        return self.has_url(slot.id)
      }).length
    },
    /**
     * Agrupa `slots` por el campo `grupo`, preservando el orden de aparición que ya trae el
     * backend (tanto el orden de los grupos como el de los clips dentro de cada uno) -- el
     * prompt es explícito en no reordenar en el front. Cada grupo suma su propio contador de
     * avance para el detalle del encabezado.
     *
     * @returns {Array<{ grupo: string, slots: Array<object>, loaded_count: number }>}
     */
    grouped_slots() {
      const self = this
      const groups = []
      const index = {}
      this.slots.forEach(function (slot) {
        const key = slot.grupo || ''
        if (!index[key]) {
          index[key] = { grupo: key, slots: [], loaded_count: 0 }
          groups.push(index[key])
        }
        index[key].slots.push(slot)
      })
      groups.forEach(function (g) {
        g.loaded_count = g.slots.filter(function (slot) {
          return self.has_url(slot.id)
        }).length
      })
      return groups
    },
  },

  mounted() {
    const self = this
    this.$store
      .dispatch('demo_media/load_media')
      .then(function () {
        self.initialize_rows()
      })
      .catch(function () {
        // El mensaje de error ya queda expuesto vía load_error (computed); nada más que hacer acá.
      })
  },

  beforeUnmount() {
    // Limpia los timers pendientes del flash "✓ Guardado" de cada fila para no dejar timeouts
    // colgados al salir de la pantalla.
    const self = this
    Object.keys(this.row_state).forEach(function (slot_id) {
      const row = self.row_state[slot_id]
      if (row && row.saved_timer) {
        clearTimeout(row.saved_timer)
      }
    })
  },

  methods: {
    /**
     * Arma `row_state` a partir de los slots y urls ya cargados en el store. Se llama una sola
     * vez, después del GET inicial.
     *
     * @returns {void}
     */
    initialize_rows() {
      const urls = this.$store.state.demo_media.urls || {}
      const rows = {}
      this.slots.forEach(function (slot) {
        const current = urls[slot.id] || ''
        rows[slot.id] = {
          value: current,
          saved_value: current,
          saving: false,
          error: '',
          saved_flash: false,
          saved_timer: null,
        }
      })
      this.row_state = rows
    },

    /**
     * Indica si un slot tiene URL cargada, leyendo directo del store (fuente de verdad tras
     * cada guardado exitoso) -- así el badge "Cargado/Sin cargar" se actualiza solo, sin
     * recargar la pantalla.
     *
     * @param {string} slot_id
     * @returns {boolean}
     */
    has_url(slot_id) {
      const urls = this.$store.state.demo_media.urls || {}
      return !!(urls[slot_id] && String(urls[slot_id]).trim() !== '')
    },

    /**
     * Un clip de sección trae `tipo` "nucleo" o "biblioteca"; los videos sueltos e piezas de
     * scroll traen otros valores (ej. "video") o ninguno, y no corresponde mostrar el badge ahí.
     *
     * @param {object} slot
     * @returns {boolean}
     */
    is_tipo_seccion(slot) {
      return slot.tipo === 'nucleo' || slot.tipo === 'biblioteca'
    },

    /**
     * Etiqueta visible del tipo de clip.
     *
     * @param {string} tipo
     * @returns {string}
     */
    tipo_label(tipo) {
      return tipo === 'nucleo' ? 'Núcleo' : 'Biblioteca'
    },

    /**
     * Clase del badge de tipo: los de núcleo (los ve todo el mundo) se destacan más que los de
     * biblioteca (opcionales).
     *
     * @param {string} tipo
     * @returns {string}
     */
    tipo_badge_class(tipo) {
      return tipo === 'nucleo' ? 'bg-primary-subtle text-primary' : 'bg-secondary-subtle text-secondary'
    },

    /**
     * Handler de blur del input: guarda solo si el valor cambió respecto del último guardado,
     * para no disparar un PUT en cada blur sin cambios reales.
     *
     * @param {string} slot_id
     * @returns {void}
     */
    on_blur(slot_id) {
      const row = this.row_state[slot_id]
      if (!row) {
        return
      }
      const current = (row.value || '').trim()
      if (current === (row.saved_value || '').trim()) {
        return
      }
      this.save_row(slot_id)
    },

    /**
     * Guarda (o borra, si el campo quedó vacío) la URL de un slot puntual vía
     * PUT /demo-media, con feedback por fila: spinner mientras está en vuelo, "✓ Guardado" al
     * confirmar, o el mensaje de error puntual si falla -- sin afectar al resto de las filas.
     *
     * @param {string} slot_id
     * @returns {void}
     */
    save_row(slot_id) {
      const self = this
      const row = this.row_state[slot_id]
      if (!row || row.saving) {
        return
      }
      const value = (row.value || '').trim()
      row.saving = true
      row.error = ''
      row.saved_flash = false

      this.$store
        .dispatch('demo_media/save_slot_url', { slot_id: slot_id, url: value })
        .then(function (data) {
          const saved_url = data.url || ''
          row.value = saved_url
          row.saved_value = saved_url
          row.saving = false
          row.saved_flash = true
          if (row.saved_timer) {
            clearTimeout(row.saved_timer)
          }
          row.saved_timer = setTimeout(function () {
            row.saved_flash = false
          }, 2000)
        })
        .catch(function (err) {
          row.saving = false
          row.error = resolve_error_message(err)
        })
    },
  },
}
</script>
