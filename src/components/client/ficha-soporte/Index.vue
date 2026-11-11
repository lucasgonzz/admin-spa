<template>
  <div class="p-3 ficha-soporte">
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para ver su ficha de soporte.
    </p>

    <div v-else-if="cargando && !cargado_alguna_vez" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando la ficha...</p>
    </div>

    <div v-else-if="error_carga" class="alert alert-danger py-2 small mb-0">
      {{ error_carga }}
      <button type="button" class="btn btn-sm btn-link p-0 ms-2 align-baseline" @click="cargar">Reintentar</button>
    </div>

    <div v-else class="row g-3" :class="{ 'ficha-soporte--actualizando': cargando }">
      <div class="col-12 col-xl-8">
        <!-- ============================================================ -->
        <!-- Ficha operativa: la prosa de Lucas. Le llega a Martín en     -->
        <!-- cada ticket de este cliente, arriba de todo.                 -->
        <!-- ============================================================ -->
        <section class="ficha-panel mb-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <h6 class="ficha-panel__titulo mb-0 flex-grow-1">Ficha operativa</h6>
            <button
              v-if="!editando_operativa"
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="editar_operativa">
              <i class="bi bi-pencil" aria-hidden="true"></i>
              <span class="ms-1">Editar</span>
            </button>
          </div>
          <template v-if="editando_operativa">
            <textarea
              ref="operativa"
              v-model="borrador_operativa"
              class="form-control form-control-sm"
              rows="6"
              :disabled="guardando_operativa"
              placeholder="Lo que Martín tiene que saber siempre de este cliente: cómo es, con quién hablar, qué cuidar."></textarea>
            <div v-if="error_operativa" class="alert alert-danger py-2 px-2 small mt-2 mb-0">{{ error_operativa }}</div>
            <div class="d-flex flex-wrap justify-content-end gap-2 mt-2">
              <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="guardando_operativa" @click="editando_operativa = false">
                Cancelar
              </button>
              <button type="button" class="btn btn-sm btn-primary" :disabled="guardando_operativa || !operativa_cambio" @click="guardar_operativa">
                <span v-if="guardando_operativa" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Guardar
              </button>
            </div>
          </template>
          <p v-else-if="ficha_operativa" class="ficha-panel__prosa mb-0">{{ ficha_operativa }}</p>
          <p v-else class="text-muted small fst-italic mb-0">
            Sin ficha operativa. Es el texto que Martín lee primero en cada ticket de este cliente.
          </p>
        </section>

        <!-- ============================================================ -->
        <!-- Entradas de la ficha: lo que Martín (o Lucas) fue anotando.  -->
        <!-- ============================================================ -->
        <section class="ficha-panel">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
            <h6 class="ficha-panel__titulo mb-0">Memoria del soporte</h6>
            <span class="badge rounded-pill" :class="cerca_del_tope ? 'text-bg-warning' : 'text-bg-light border'"
              :title="'Entradas vigentes: ' + vigentes.length + ' de ' + tope + '. Con la ficha llena, Martín tiene que consolidar.'">
              {{ vigentes.length }} / {{ tope }}
            </span>
            <div class="form-check form-switch mb-0 ms-sm-auto">
              <input
                id="ficha-ver-historial"
                v-model="ver_historial"
                class="form-check-input"
                type="checkbox"
                role="switch"
                @change="cargar">
              <label class="form-check-label small" for="ficha-ver-historial">Ver reemplazadas y dadas de baja</label>
            </div>
            <button
              v-if="!agregando"
              type="button"
              class="btn btn-sm btn-primary ficha-soporte__agregar"
              :disabled="vigentes.length >= tope"
              @click="abrir_agregar('decision')">
              <i class="bi bi-plus-lg" aria-hidden="true"></i>
              <span class="ms-1">Agregar</span>
            </button>
          </div>

          <entrada-form
            v-if="agregando"
            class="mb-3"
            :categoria_inicial="categoria_nueva"
            :guardando="guardando_nueva"
            :error="error_nueva"
            @enviar="agregar"
            @cancelar="agregando = false" />

          <p v-if="!vigentes.length && !agregando" class="text-muted small fst-italic mb-0">
            Todavía no hay nada anotado. Martín escribe acá las decisiones, preferencias, problemas y
            compromisos que surgen en los tickets; también podés agregarlas vos.
          </p>

          <div v-for="grupo in grupos" :key="grupo.key" class="ficha-grupo">
            <div class="ficha-grupo__cabecera">
              <i :class="'bi bi-' + grupo.icon" aria-hidden="true"></i>
              <span>{{ grupo.label }}</span>
              <span class="text-muted">({{ grupo.entradas.length }})</span>
            </div>
            <ul class="ficha-grupo__lista mb-0">
              <entrada-ficha
                v-for="e in grupo.entradas"
                :key="e.id"
                :client_id="record.id"
                :entrada="e"
                @cambio="on_cambio" />
            </ul>
          </div>

          <div v-if="ver_historial" class="ficha-grupo ficha-grupo--historial">
            <div class="ficha-grupo__cabecera">
              <i class="bi bi-clock-history" aria-hidden="true"></i>
              <span>Reemplazadas y dadas de baja</span>
              <span class="text-muted">({{ historial.length }})</span>
            </div>
            <p v-if="!historial.length" class="text-muted small fst-italic px-3 py-2 mb-0">No hay entradas en el historial.</p>
            <ul v-else class="ficha-grupo__lista mb-0">
              <entrada-ficha
                v-for="e in historial"
                :key="e.id"
                :client_id="record.id"
                :entrada="e"
                mostrar_categoria />
            </ul>
          </div>
        </section>
      </div>

      <!-- ============================================================ -->
      <!-- Tickets del cliente con su título y resumen.                 -->
      <!-- ============================================================ -->
      <div class="col-12 col-xl-4">
        <section class="ficha-panel">
          <h6 class="ficha-panel__titulo mb-2">Tickets de soporte</h6>
          <tickets-del-cliente :tickets="tickets" :cargando="cargando_tickets" :error="error_tickets" />
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import EntradaForm from './EntradaForm.vue'
import EntradaFicha from './EntradaFicha.vue'
import TicketsDelCliente from './TicketsDelCliente.vue'
import { CATEGORIAS, TOPE_VIGENTES } from './categorias'

/**
 * Pestaña «Soporte» del detalle del cliente: la ficha de soporte (misión ficha-del-cliente,
 * 11/11/2026). Es la memoria persistente que Martín, el agente de soporte, lee en cada ticket de
 * este cliente y va escribiendo; acá Lucas la ve y la corrige.
 *
 * Rutas del panel (admin-api, grupo admin):
 *   GET  client/{id}/support-memory[?incluir_historial=1]   entradas (y, si vienen, los tickets)
 *   POST client/{id}/support-memory                          agregar {categoria, texto, vigente_hasta}
 *   PUT  client/{id}/support-memory/{entry}                  reemplazar (lo hace EntradaFicha)
 *   POST client/{id}/support-memory/{entry}/archive          dar de baja (lo hace EntradaFicha)
 *   GET|PUT client/{id}/support-memory/ficha-operativa       {ficha_operativa}
 *   GET  client/{id}/support-memory/tickets                  índice de tickets (número, título, resumen)
 */
export default {
  name: 'ClientFichaSoporteTab',
  components: { EntradaForm, EntradaFicha, TicketsDelCliente },
  props: {
    /** Cliente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      cargando: false,
      cargado_alguna_vez: false,
      error_carga: '',
      entradas: [],
      ver_historial: false,
      tope: TOPE_VIGENTES,

      ficha_operativa: '',
      editando_operativa: false,
      borrador_operativa: '',
      guardando_operativa: false,
      error_operativa: '',

      agregando: false,
      categoria_nueva: 'decision',
      guardando_nueva: false,
      error_nueva: '',

      tickets: [],
      cargando_tickets: false,
      error_tickets: '',
    }
  },
  computed: {
    url_base() {
      return '/client/' + this.record.id + '/support-memory'
    },
    vigentes() {
      return this.entradas.filter(function (e) {
        return !e.status || e.status === 'vigente'
      })
    },
    /** Reemplazadas y dadas de baja, la más nueva primero. */
    historial() {
      return this.entradas
        .filter(function (e) {
          return e.status && e.status !== 'vigente'
        })
        .sort(comparar_mas_nueva_primero)
    },
    /** Vigentes agrupadas por categoría, en el orden del bloque que lee Martín; solo las que tienen algo. */
    grupos() {
      const vigentes = this.vigentes
      return CATEGORIAS.map(function (c) {
        return {
          key: c.key,
          label: c.label,
          icon: c.icon,
          entradas: vigentes
            .filter(function (e) {
              const clave = CATEGORIAS.some(function (x) { return x.key === e.categoria }) ? e.categoria : 'otro'
              return clave === c.key
            })
            .sort(comparar_mas_nueva_primero),
        }
      }).filter(function (g) {
        return g.entradas.length > 0
      })
    },
    cerca_del_tope() {
      return this.vigentes.length >= this.tope - 5
    },
    operativa_cambio() {
      return String(this.borrador_operativa || '').trim() !== String(this.ficha_operativa || '').trim()
    },
  },
  watch: {
    'record.id': function (nuevo, viejo) {
      if (nuevo && nuevo !== viejo) {
        this.cargado_alguna_vez = false
        this.editando_operativa = false
        this.agregando = false
        this.cargar_todo()
      }
    },
  },
  mounted() {
    this.cargar_todo()
  },
  methods: {
    cargar_todo() {
      if (!this.record || !this.record.id) {
        return
      }
      this.cargar()
      this.cargar_operativa()
      this.cargar_tickets()
    },
    /** Entradas de la ficha; con el interruptor prendido, también las no vigentes. */
    cargar() {
      const self = this
      if (!self.record || !self.record.id) {
        return
      }
      self.cargando = true
      self.error_carga = ''
      const params = self.ver_historial ? { incluir_historial: 1 } : {}
      api
        .get(self.url_base, { params: params, silent_error: true })
        .then(function (res) {
          self.aplicar_respuesta(res.data)
          self.cargando = false
          self.cargado_alguna_vez = true
        })
        .catch(function (err) {
          self.cargando = false
          self.error_carga = resolve_error_message(err)
        })
    },
    /**
     * Toma las entradas de la respuesta. Tolera las formas posibles del listado: `{entradas}`, el
     * bloque `{ficha_cliente: {entradas}}`, `{models}` o una lista suelta. Si trae la ficha
     * operativa, la usa también.
     */
    aplicar_respuesta(data) {
      const cuerpo = data || {}
      const bloque = cuerpo.ficha_cliente || cuerpo
      let lista = []
      if (Array.isArray(cuerpo)) {
        lista = cuerpo
      } else if (Array.isArray(bloque.entradas)) {
        lista = bloque.entradas
      } else if (Array.isArray(cuerpo.models)) {
        lista = cuerpo.models
      }
      this.entradas = lista
      if (!Array.isArray(cuerpo) && Object.prototype.hasOwnProperty.call(bloque, 'ficha_operativa') && !this.editando_operativa) {
        this.ficha_operativa = bloque.ficha_operativa || ''
      }
    },
    cargar_operativa() {
      const self = this
      api
        .get(self.url_base + '/ficha-operativa', { silent_error: true })
        .then(function (res) {
          const cuerpo = res.data || {}
          if (!self.editando_operativa) {
            self.ficha_operativa = cuerpo.ficha_operativa || ''
          }
        })
        .catch(function () {
          // Sin la ruta todavía la prosa queda vacía; las entradas se siguen viendo.
        })
    },
    /** Índice de tickets del cliente (número, título y resumen). */
    cargar_tickets() {
      const self = this
      self.cargando_tickets = true
      self.error_tickets = ''
      api
        .get(self.url_base + '/tickets', { silent_error: true })
        .then(function (res) {
          const cuerpo = res.data || {}
          self.tickets = Array.isArray(cuerpo) ? cuerpo : (cuerpo.tickets || cuerpo.models || [])
          self.cargando_tickets = false
        })
        .catch(function (err) {
          if (err && err.response && err.response.status === 404) {
            self.cargar_tickets_de_la_bandeja()
            return
          }
          self.cargando_tickets = false
          self.error_tickets = resolve_error_message(err)
        })
    },
    /**
     * Respaldo para un admin-api sin la ruta del índice: la lista de la bandeja
     * (GET support-ticket, la misma que usa Soporte) filtrada por este cliente. Trae `name` y,
     * con la columna nueva, `summary`.
     */
    cargar_tickets_de_la_bandeja() {
      const self = this
      const client_id = Number(self.record.id)
      api
        .get('/support-ticket', { silent_error: true })
        .then(function (res) {
          const cuerpo = res.data || {}
          const lista = Array.isArray(cuerpo.models) ? cuerpo.models : []
          self.tickets = lista
            .filter(function (t) {
              return Number(t.client_id) === client_id
            })
            .sort(function (a, b) {
              return Number(b.id) - Number(a.id)
            })
          self.cargando_tickets = false
        })
        .catch(function (err) {
          self.cargando_tickets = false
          self.error_tickets = resolve_error_message(err)
        })
    },
    editar_operativa() {
      const self = this
      self.borrador_operativa = self.ficha_operativa || ''
      self.error_operativa = ''
      self.editando_operativa = true
      self.$nextTick(function () {
        if (self.$refs.operativa) {
          self.$refs.operativa.focus()
        }
      })
    },
    guardar_operativa() {
      const self = this
      self.guardando_operativa = true
      self.error_operativa = ''
      const texto = String(self.borrador_operativa || '').trim()
      api
        .put(self.url_base + '/ficha-operativa', { ficha_operativa: texto === '' ? null : texto }, { silent_error: true })
        .then(function (res) {
          const cuerpo = res.data || {}
          self.ficha_operativa = Object.prototype.hasOwnProperty.call(cuerpo, 'ficha_operativa') ? (cuerpo.ficha_operativa || '') : texto
          self.guardando_operativa = false
          self.editando_operativa = false
          self.avisar('Ficha operativa guardada.')
        })
        .catch(function (err) {
          self.guardando_operativa = false
          self.error_operativa = resolve_error_message(err)
        })
    },
    abrir_agregar(categoria) {
      this.categoria_nueva = categoria
      this.error_nueva = ''
      this.agregando = true
    },
    /** @param {{categoria: string, texto: string, vigente_hasta: string|null}} cuerpo */
    agregar(cuerpo) {
      const self = this
      self.guardando_nueva = true
      self.error_nueva = ''
      api
        .post(self.url_base, cuerpo, { silent_error: true })
        .then(function () {
          self.guardando_nueva = false
          self.agregando = false
          self.avisar('Entrada agregada a la ficha.')
          self.cargar()
        })
        .catch(function (err) {
          self.guardando_nueva = false
          self.error_nueva = resolve_error_message(err)
        })
    },
    /** Una entrada se editó o se dio de baja: se recarga la lista entera. */
    on_cambio(evento) {
      this.avisar(evento && evento.accion === 'archivar' ? 'Entrada dada de baja.' : 'Entrada actualizada.')
      this.cargar()
    },
    /** Toast global del admin. */
    avisar(message, variant) {
      window.dispatchEvent(new CustomEvent('admin-spa-toast', {
        detail: { message: String(message), variant: variant || 'success' },
      }))
    },
  },
}

/**
 * Orden «la más nueva primero» por fecha de alta (y por id si empatan).
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
function comparar_mas_nueva_primero(a, b) {
  const fa = String(a.created_at || a.updated_at || '')
  const fb = String(b.created_at || b.updated_at || '')
  if (fa !== fb) {
    return fa < fb ? 1 : -1
  }
  return Number(b.id || 0) - Number(a.id || 0)
}
</script>

<style scoped lang="scss">
/* Misma familia visual que Ventas y Mensualidad: paneles claros sin borde pesado. */
.ficha-panel {
	background: #f7f7f8;
	border-radius: 0.75rem;
	padding: 0.85rem 1rem;
}

.ficha-panel__titulo {
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #6c757d;
	font-weight: 600;
}

.ficha-panel__prosa {
	white-space: pre-line;
	overflow-wrap: anywhere;
	font-size: 0.92rem;
}

.ficha-grupo {
	margin-top: 0.75rem;
	background: #fff;
	border: 1px solid var(--bs-border-color);
	border-radius: 0.5rem;
	overflow: hidden;
}

.ficha-grupo__cabecera {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.4rem 0.75rem;
	font-size: 0.8rem;
	font-weight: 600;
	background: var(--bs-tertiary-bg, #f5f6f6);
	border-bottom: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));
}

.ficha-grupo__lista {
	padding: 0;
}

.ficha-grupo--historial {
	border-style: dashed;
}

.ficha-soporte--actualizando {
	opacity: 0.6;
	transition: opacity 0.15s ease-out;
}

/* En teléfono el interruptor y «Agregar» bajan a su propio renglón, a todo el ancho. */
@media (max-width: 575.98px) {
	.ficha-soporte__agregar {
		width: 100%;
	}
}
</style>
