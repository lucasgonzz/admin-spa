<template>
  <div class="p-3 prueba-tab">
    <!-- Sin registro guardado todavía: no hay id al que pedirle la prueba -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá primero para ver el estado de la prueba.
    </p>

    <!-- Carga inicial -->
    <div v-else-if="loading" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Consultando el sistema del negocio...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <!-- No está en prueba -->
    <div v-else-if="!datos || !datos.es_prueba" class="alert alert-light border small mb-0">
      <template v-if="datos && datos.armando">
        {{ datos.mensaje }}
      </template>
      <template v-else>
        Este {{ model_name === 'lead' ? 'lead' : 'cliente' }} no está en prueba gratuita.
      </template>
    </div>

    <div v-else>
      <!-- ============================================================ -->
      <!-- Encabezado: estado y días                                     -->
      <!-- ============================================================ -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                <span class="fw-semibold">Prueba gratuita</span>
                <span class="badge" :class="datos.vencida ? 'bg-danger' : 'bg-success'">
                  {{ datos.vencida ? 'Vencida' : 'En curso' }}
                </span>
              </div>
              <div class="small text-muted">
                <template v-if="datos.vence_at">
                  {{ datos.vencida ? 'Venció el' : 'Vence el' }} {{ fecha(datos.vence_at) }}
                  <span v-if="datos.inicio_at"> · empezó el {{ fecha(datos.inicio_at) }}</span>
                </template>
                <template v-else>Sin fecha de vencimiento cargada.</template>
              </div>
              <div v-if="datos.lead_nombre || datos.client_nombre" class="small mt-1">
                {{ datos.client_nombre }}<span v-if="datos.lead_nombre"> · {{ datos.lead_nombre }}</span>
              </div>
            </div>
            <div class="text-center prueba-dias">
              <div class="display-6 fw-bold lh-1" :class="datos.vencida ? 'text-danger' : 'text-primary'">
                {{ datos.dias_restantes === null ? '—' : datos.dias_restantes }}
              </div>
              <div class="small text-muted">
                {{ datos.dias_restantes === 1 ? 'día restante' : 'días restantes' }}
                <span v-if="datos.dia_actual"> · día {{ datos.dia_actual }} de {{ datos.dias }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <!-- ============================================================ -->
        <!-- Hitos                                                         -->
        <!-- ============================================================ -->
        <div class="col-12 col-lg-7">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <span class="fw-semibold">Hitos</span>
                <span class="badge bg-light text-dark border">
                  {{ hitos_hechos }} de {{ datos.hitos_lista.length }}
                </span>
              </div>
              <ul class="list-unstyled mb-2 prueba-hitos">
                <li
                  v-for="hito in datos.hitos_lista"
                  :key="hito.tipo"
                  class="d-flex align-items-start gap-2 py-1 border-bottom"
                  :class="{ 'prueba-hito-proximo': hito.tipo === datos.proximo_hito }"
                >
                  <span
                    class="badge rounded-pill prueba-hito-marca"
                    :class="hito.at ? 'bg-success' : 'bg-secondary bg-opacity-25 text-secondary'"
                  >{{ hito.at ? '✓' : '·' }}</span>
                  <span class="flex-grow-1">
                    <span :class="hito.at ? '' : 'text-muted'">{{ hito.label }}</span>
                    <span v-if="hito.tipo === datos.proximo_hito" class="badge bg-warning text-dark ms-1">Próximo paso</span>
                  </span>
                  <span class="small text-muted text-nowrap">{{ hito.at ? fecha(hito.at) : '' }}</span>
                </li>
              </ul>
              <p class="small text-muted mb-0">
                <template v-if="datos.hitos_fuente === 'instancia'">
                  Leído recién del sistema del negocio<span v-if="datos.semilla_presente === true">; todavía tiene los datos de ejemplo</span><span v-else-if="datos.semilla_presente === false">; ya importó lo suyo (sin datos de ejemplo)</span>.
                </template>
                <template v-else>
                  Armado con los eventos que llegaron al admin: su sistema no contestó la consulta en vivo
                  (versión sin la ruta, o sin respuesta).
                </template>
              </p>
            </div>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- WhatsApps de la prueba y Tomás                                 -->
        <!-- ============================================================ -->
        <div class="col-12 col-lg-5">
          <div class="card h-100">
            <div class="card-body">
              <div class="fw-semibold mb-2">Mensajes de la prueba</div>
              <p class="small mb-2">
                Bienvenida de Martín:
                <span v-if="datos.bienvenida_enviada" class="text-success">enviada{{ datos.bienvenida_at ? ' el ' + fecha(datos.bienvenida_at) : '' }}</span>
                <span v-else class="text-muted">todavía no salió</span>
              </p>
              <p class="small mb-2">
                Último empujón:
                <span v-if="datos.ultimo_empujon_at">{{ fecha(datos.ultimo_empujon_at) }}</span>
                <span v-else class="text-muted">ninguno</span>
              </p>
              <ul v-if="datos.envios && datos.envios.length" class="list-unstyled small mb-3 prueba-envios">
                <li v-for="envio in datos.envios" :key="envio.id" class="d-flex flex-wrap gap-2 py-1 border-bottom">
                  <span class="badge" :class="clase_estado(envio.estado)">{{ envio.estado }}</span>
                  <span class="flex-grow-1 text-truncate">{{ nombre_del_envio(envio) }}</span>
                  <span class="text-muted text-nowrap">{{ fecha(envio.enviado_at || envio.created_at) }}</span>
                </li>
              </ul>
              <p v-else class="small text-muted mb-3">Todavía no salió ningún mensaje.</p>

              <div v-if="aviso_resultado" class="alert py-2 small" :class="aviso_resultado.ok ? 'alert-success' : 'alert-danger'">
                {{ aviso_resultado.texto }}
              </div>
              <button
                type="button"
                class="btn btn-outline-primary btn-sm w-100"
                :disabled="avisando"
                @click="avisar_a_tomas"
              >
                {{ avisando ? 'Avisando...' : 'Avisar a Tomás' }}
              </button>
              <p class="text-muted small mb-0 mt-2">
                Le manda un WhatsApp y una notificación al closer para que lo llame. Al día 5 y al vencer
                se le avisa solo.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-end mt-3">
        <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="loading" @click="cargar">
          Actualizar
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Pestaña «Prueba» del modal del lead y de la ficha del cliente (misión cruzada
 * prueba-martin-importacion, 3/11/2026, programa «Prueba gratuita de 7 días»).
 *
 * Muestra cuántos días le quedan al negocio, en qué hito va (leído EN VIVO de su sistema por el
 * admin, con los eventos recibidos como respaldo), qué WhatsApps de la prueba le salieron (la
 * bienvenida de Martín y los empujones) y el botón «Avisar a Tomás».
 *
 * La misma pestaña sirve para los dos modales: `model_name` (`client` | `lead`) decide a qué ruta
 * pedirle (`admin/client/{id}/prueba` o `admin/lead/{id}/prueba`). Solo usa `record`.
 */
export default {
  name: 'PruebaTab',
  props: {
    /** Registro abierto en el modal (cliente o lead). */
    record: { type: Object, default: null },
    /** `client` o `lead`: decide la ruta. */
    model_name: { type: String, default: 'client' },
  },
  data() {
    return {
      loading: false,
      load_error: null,
      datos: null,
      avisando: false,
      aviso_resultado: null,
    }
  },
  computed: {
    /** Base de las rutas según el modelo abierto. */
    base_url() {
      const prefijo = this.model_name === 'lead' ? 'lead' : 'client'
      return '/' + prefijo + '/' + this.record.id + '/prueba'
    },
    /** Cuántos hitos ya pasaron. */
    hitos_hechos() {
      if (!this.datos || !this.datos.hitos_lista) {
        return 0
      }
      return this.datos.hitos_lista.filter(function (h) {
        return !!h.at
      }).length
    },
  },
  watch: {
    'record.id': {
      immediate: true,
      handler(id) {
        if (id) {
          this.cargar()
        }
      },
    },
  },
  methods: {
    /** Trae el estado de la prueba (le pega en vivo al sistema del negocio). */
    cargar() {
      this.loading = true
      this.load_error = null
      api
        .get(this.base_url)
        .then((res) => {
          this.datos = res.data
        })
        .catch((error) => {
          this.load_error = resolve_error_message(error) || 'No se pudo leer el estado de la prueba.'
        })
        .finally(() => {
          this.loading = false
        })
    },
    /** Botón «Avisar a Tomás». */
    avisar_a_tomas() {
      if (!window.confirm('¿Avisarle a Tomás ahora por WhatsApp para que lo llame?')) {
        return
      }
      this.avisando = true
      this.aviso_resultado = null
      api
        .post(this.base_url + '/avisar-a-tomas')
        .then(() => {
          this.aviso_resultado = { ok: true, texto: 'Aviso enviado a Tomás.' }
          this.cargar()
        })
        .catch((error) => {
          this.aviso_resultado = {
            ok: false,
            texto: resolve_error_message(error) || 'No se pudo avisar a Tomás.',
          }
        })
        .finally(() => {
          this.avisando = false
        })
    },
    /** Fecha corta en hora local. */
    fecha(iso) {
      if (!iso) {
        return ''
      }
      const d = new Date(iso)
      if (isNaN(d.getTime())) {
        return String(iso)
      }
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    },
    /** Rótulo humano de un envío. */
    nombre_del_envio(envio) {
      if (envio.plantilla === 'aviso_tomas') {
        const motivos = { dia_5: 'día 5', vencida: 'venció', manual: 'a pedido' }
        return 'Aviso a Tomás (' + (motivos[envio.hito] || envio.hito) + ')'
      }
      if (envio.plantilla === 'cc_prueba_bienvenida') {
        return 'Bienvenida de Martín'
      }
      if (envio.plantilla && envio.plantilla.indexOf('cc_prueba_paso_') === 0) {
        const hito = this.datos.hitos_catalogo ? this.datos.hitos_catalogo[envio.hito] : null
        return 'Empujón: ' + (hito || envio.hito)
      }
      return envio.plantilla
    },
    /** Color del badge de estado de un envío. */
    clase_estado(estado) {
      if (estado === 'enviado') {
        return 'bg-success'
      }
      if (estado === 'en_cola') {
        return 'bg-warning text-dark'
      }
      return 'bg-danger'
    },
  },
}
</script>

<style scoped>
.prueba-hito-marca {
  min-width: 1.6rem;
  margin-top: 0.15rem;
}
.prueba-hito-proximo {
  background: rgba(255, 193, 7, 0.08);
}
.prueba-dias {
  min-width: 7rem;
}
.prueba-envios {
  max-height: 14rem;
  overflow-y: auto;
}
</style>
