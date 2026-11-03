<template>
  <div class="pruebas-view">
    <!-- Cabecera: el resumen del pool y las acciones generales -->
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h5 class="mb-0 me-2">Pruebas gratuitas</h5>
      <template v-if="resumen">
        <span class="badge text-bg-success" :title="'Instancias libres para un alta (mínimo ' + resumen.pool_minimo + ')'">
          {{ resumen.libres }} libres
        </span>
        <span class="badge text-bg-info" title="Instancias que se están armando">{{ resumen.creando }} armándose</span>
        <span class="badge text-bg-primary" :title="'Ocupadas y despiertas (tope ' + resumen.max_activas + ')'">
          {{ resumen.activas }} activas
        </span>
        <span class="badge text-bg-secondary" title="Vencidas con el worker parado">{{ resumen.dormidas }} dormidas</span>
        <span v-if="resumen.fallidas" class="badge text-bg-danger">{{ resumen.fallidas }} fallidas</span>
      </template>
      <div class="ms-auto d-flex align-items-center gap-2">
        <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="loading" title="Volver a cargar" @click="cargar">
          <i class="bi bi-arrow-clockwise" aria-hidden="true" />
        </button>
        <button type="button" class="btn btn-outline-primary btn-sm" :disabled="manteniendo" @click="mantener">
          {{ manteniendo ? 'Encolando...' : 'Completar el pool' }}
        </button>
      </div>
    </div>

    <div v-if="load_error" class="alert alert-danger py-2 small">{{ load_error }}</div>

    <div v-if="loading && !instancias.length" class="text-center py-5">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando el pool...</p>
    </div>

    <p v-else-if="!instancias.length" class="text-muted small">
      Todavía no hay instancias. «Completar el pool» encola el armado de las que falten para llegar al mínimo
      (hace falta la plantilla de la versión publicada: <code>php artisan pruebas:plantilla</code>).
    </p>

    <!-- Una tarjeta por instancia: en escritorio son columnas, en teléfono se apilan -->
    <div v-else class="row g-3">
      <div v-for="instancia in instancias" :key="instancia.id" class="col-12 col-md-6 col-xl-4">
        <div class="card h-100 pruebas-card" :class="'pruebas-card--' + instancia.estado">
          <div class="card-body d-flex flex-column">
            <div class="d-flex align-items-center gap-2 mb-2">
              <strong>{{ instancia.nombre }}</strong>
              <span class="badge" :class="badge_de(instancia)">{{ etiqueta_de(instancia) }}</span>
              <span v-if="instancia.dormida" class="badge text-bg-secondary">dormida</span>
              <span class="ms-auto small text-muted">v{{ instancia.version || '?' }}</span>
            </div>

            <div class="small mb-1">
              <a :href="instancia.url" target="_blank" rel="noopener" class="text-break">{{ instancia.url }}</a>
            </div>

            <div v-if="instancia.client" class="small">
              Cliente:
              <router-link :to="{ path: '/clientes', query: { id: instancia.client.id } }">{{ instancia.client.nombre }}</router-link>
              <span class="text-muted">· {{ instancia.client.estado }}</span>
              <span v-if="instancia.client.trial_ends_at" class="text-muted d-block">Vence {{ formatear_fecha(instancia.client.trial_ends_at) }}</span>
            </div>
            <div v-if="instancia.lead" class="small text-muted">
              Lead: {{ instancia.lead.nombre || '—' }} <span v-if="instancia.lead.telefono">· {{ instancia.lead.telefono }}</span>
            </div>
            <div v-if="!instancia.client && !instancia.lead" class="small text-muted">Sin negocio asignado.</div>

            <!-- Etapa y progreso mientras se arma o se asigna -->
            <div v-if="['creando', 'asignando'].includes(instancia.estado)" class="mt-2">
              <div class="small text-muted mb-1">{{ instancia.etapa || '…' }} · {{ instancia.progreso }} %</div>
              <div class="progress" style="height: 6px" role="progressbar" :aria-valuenow="instancia.progreso" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-bar" :style="{ width: instancia.progreso + '%' }" />
              </div>
            </div>

            <div v-if="instancia.error" class="alert alert-danger py-1 px-2 small mt-2 mb-0">
              <strong>{{ instancia.etapa }}:</strong> {{ instancia.error }}
            </div>

            <div v-if="instancia.respaldo_ruta" class="small text-muted mt-2">Respaldo: <code>{{ instancia.respaldo_ruta }}</code></div>

            <!-- Acciones: solo las que tienen sentido en ese estado -->
            <div class="d-flex flex-wrap gap-2 mt-auto pt-3">
              <button
                v-if="puede_dormir(instancia)"
                type="button"
                class="btn btn-outline-secondary btn-sm"
                :disabled="accion_en_curso === instancia.id"
                @click="accion(instancia, 'dormir')"
              >
                Dormir
              </button>
              <button
                v-if="puede_despertar(instancia)"
                type="button"
                class="btn btn-outline-success btn-sm"
                :disabled="accion_en_curso === instancia.id"
                @click="accion(instancia, 'despertar')"
              >
                Despertar
              </button>
              <button
                v-if="instancia.estado === 'fallida'"
                type="button"
                class="btn btn-outline-primary btn-sm"
                :disabled="accion_en_curso === instancia.id"
                @click="accion(instancia, 'reintentar')"
              >
                Reintentar
              </button>
              <button
                v-if="puede_borrar(instancia)"
                type="button"
                class="btn btn-outline-danger btn-sm ms-auto"
                :disabled="accion_en_curso === instancia.id"
                @click="borrar(instancia)"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/** Cada cuánto se refresca la lista mientras haya instancias armándose o asignándose. */
const POLEO_MS = 15000

/**
 * El pool de instancias de la prueba gratuita (programa «Prueba gratuita de 7 días», misión
 * prueba-alta-instancia, 3/11/2026): una tarjeta por `prueba-NN` del VPS con su estado, el negocio
 * que la ocupa, la etapa y el progreso mientras se arma, y las acciones (dormir, despertar,
 * reintentar, borrar con respaldo). «Completar el pool» encola el armado de las que falten.
 */
export default {
  name: 'ViewPruebas',
  data() {
    return {
      loading: false,
      load_error: null,
      instancias: [],
      resumen: null,
      manteniendo: false,
      accion_en_curso: null,
      poleo: null,
    }
  },
  computed: {
    hay_trabajo_en_curso() {
      return this.instancias.some(function (i) {
        return i.estado === 'creando' || i.estado === 'asignando' || i.estado === 'borrando'
      })
    },
  },
  mounted() {
    this.cargar()
  },
  beforeUnmount() {
    this.detener_poleo()
  },
  methods: {
    cargar() {
      const self = this
      self.loading = true
      self.load_error = null
      api
        .get('/prueba/instancias', { silent_error: true })
        .then(function (res) {
          self.instancias = (res.data && res.data.instancias) || []
          self.resumen = (res.data && res.data.resumen) || null
          self.loading = false
          self.programar_poleo()
        })
        .catch(function (error) {
          self.load_error = resolve_error_message(error)
          self.loading = false
        })
    },
    programar_poleo() {
      this.detener_poleo()
      if (this.hay_trabajo_en_curso) {
        this.poleo = setTimeout(this.cargar, POLEO_MS)
      }
    },
    detener_poleo() {
      if (this.poleo) {
        clearTimeout(this.poleo)
        this.poleo = null
      }
    },
    mantener() {
      const self = this
      self.manteniendo = true
      api
        .post('/prueba/instancias/mantener', {}, { silent_error: true })
        .then(function (res) {
          const encoladas = (res.data && res.data.encoladas) || []
          self.manteniendo = false
          self.toast(encoladas.length ? 'Encoladas: ' + encoladas.join(', ') + '.' : 'El pool ya está completo.', 'success')
          self.cargar()
        })
        .catch(function (error) {
          self.manteniendo = false
          self.toast(resolve_error_message(error), 'danger')
        })
    },
    accion(instancia, nombre) {
      const self = this
      self.accion_en_curso = instancia.id
      api
        .post('/prueba/instancias/' + instancia.id + '/' + nombre, {}, { silent_error: true })
        .then(function (res) {
          self.reemplazar(res.data && res.data.instancia)
          self.accion_en_curso = null
          self.toast('Listo: ' + nombre + ' ' + instancia.nombre + '.', 'success')
          if (nombre === 'reintentar' || nombre === 'borrar') {
            self.cargar()
          }
        })
        .catch(function (error) {
          self.accion_en_curso = null
          const datos = error && error.response && error.response.data
          if (datos && datos.instancia) {
            self.reemplazar(datos.instancia)
          }
          self.toast(resolve_error_message(error), 'danger')
        })
    },
    borrar(instancia) {
      const quien = instancia.client ? instancia.client.nombre : instancia.nombre
      if (!window.confirm('Se borra ' + instancia.nombre + ' (' + quien + '): respaldo en el VPS, baja de los 4 sitios, la base, el supervisor y el DNS. ¿Seguir?')) {
        return
      }
      this.accion(instancia, 'borrar')
    },
    reemplazar(instancia) {
      if (!instancia || !instancia.id) {
        return
      }
      const indice = this.instancias.findIndex(function (i) {
        return i.id === instancia.id
      })
      if (indice >= 0) {
        this.instancias.splice(indice, 1, instancia)
      }
    },
    puede_dormir(instancia) {
      return !instancia.dormida && ['asignada', 'cliente'].includes(instancia.estado)
    },
    puede_despertar(instancia) {
      return instancia.dormida
    },
    puede_borrar(instancia) {
      return ['libre', 'asignada', 'fallida'].includes(instancia.estado)
    },
    etiqueta_de(instancia) {
      const etiquetas = {
        creando: 'armándose',
        libre: 'libre',
        asignando: 'asignándose',
        asignada: 'en prueba',
        fallida: 'fallida',
        cliente: 'cliente',
        borrando: 'borrándose',
        borrada: 'borrada',
      }
      return etiquetas[instancia.estado] || instancia.estado
    },
    badge_de(instancia) {
      const clases = {
        creando: 'text-bg-info',
        libre: 'text-bg-success',
        asignando: 'text-bg-info',
        asignada: 'text-bg-primary',
        fallida: 'text-bg-danger',
        cliente: 'text-bg-dark',
        borrando: 'text-bg-warning text-dark',
        borrada: 'text-bg-secondary',
      }
      return clases[instancia.estado] || 'text-bg-secondary'
    },
    formatear_fecha(valor) {
      const fecha = new Date(valor)
      if (Number.isNaN(fecha.getTime())) {
        return String(valor)
      }
      return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    },
    toast(message, variant) {
      window.dispatchEvent(new CustomEvent('admin-spa-toast', { detail: { message: message, variant: variant } }))
    },
  },
}
</script>

<style scoped>
.pruebas-card--fallida {
  border-color: #dc3545;
}
.pruebas-card--libre {
  border-color: #198754;
}
</style>
