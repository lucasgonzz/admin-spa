<template>
  <div class="prueba-seguimiento">
    <!-- Carga -->
    <div v-if="loading" class="text-center py-3">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Consultando el sistema del negocio...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-3">
      {{ load_error }}
    </div>

    <!-- La instancia todavía se está armando (o no es una prueba): la solapa de arriba ya lo dijo -->
    <p v-else-if="datos && datos.armando" class="text-muted small mb-3">{{ datos.mensaje }}</p>

    <div v-else-if="datos && datos.es_prueba" class="row g-3 mb-3">
      <div class="col-12">
        <div class="card">
          <div class="card-body">
            <label class="form-label fw-semibold mb-1" :for="cupo_input_id">Cupo de imágenes automáticas</label>
            <template v-if="datos.imagenes">
              <p class="text-muted small mb-2">
                {{ datos.imagenes.usadas }} búsquedas usadas · {{ datos.imagenes.restantes }} disponibles.
                El cupo es para toda la prueba. Cambiarlo conserva las búsquedas ya usadas.
              </p>
              <div class="row g-2 align-items-center">
                <div class="col-12 col-sm-auto">
                  <input
                    :id="cupo_input_id"
                    v-model.number="cupo_total"
                    type="number"
                    class="form-control form-control-sm"
                    min="0"
                    max="10000"
                    step="1"
                    :disabled="guardando_cupo"
                  />
                </div>
                <div class="col-12 col-sm-auto">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    :disabled="guardando_cupo || avisando || !cupo_valido"
                    @click="guardar_cupo"
                  >
                    {{ guardando_cupo ? 'Guardando...' : 'Guardar cupo' }}
                  </button>
                </div>
              </div>
            </template>
            <p v-else class="text-muted small mb-0">
              {{ cupo_sin_datos }}
            </p>
            <p v-if="cupo_error" class="text-danger small mt-2 mb-0" role="alert">{{ cupo_error }}</p>
            <p v-if="cupo_guardado" class="text-success small mt-2 mb-0" role="status">Cupo guardado.</p>
          </div>
        </div>
      </div>
      <!-- ============================================================ -->
      <!-- Hitos                                                         -->
      <!-- ============================================================ -->
      <div class="col-12 col-lg-7">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <span class="fw-semibold">Hitos</span>
              <span class="small text-muted">
                <span v-if="datos.dia_actual">día {{ datos.dia_actual }} de {{ datos.dias }} · </span>
                <span class="badge bg-light text-dark border">{{ hitos_hechos }} de {{ datos.hitos_lista.length }}</span>
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
              <span v-else-if="datos.bienvenida_en_cola" class="text-warning">en cola (espera que Meta apruebe la plantilla)</span>
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
            <div class="d-flex flex-wrap gap-2">
              <button
                type="button"
                class="btn btn-outline-primary btn-sm flex-grow-1"
                :disabled="avisando || guardando_cupo"
                @click="avisar_a_tomas"
              >
                {{ avisando ? 'Avisando...' : 'Avisar a Tomás' }}
              </button>
              <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="loading || guardando_cupo" @click="cargar">
                Actualizar
              </button>
            </div>
            <p class="text-muted small mb-0 mt-2">
              Le manda un WhatsApp y una notificación al closer para que lo llame. Al día 5 y al vencer
              se le avisa solo.
            </p>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Encuesta de fin de prueba (solo lectura)                       -->
      <!-- ============================================================ -->
      <div v-if="datos.encuesta" class="col-12">
        <div class="card">
          <div class="card-body">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <span class="fw-semibold">Encuesta de fin de prueba</span>
              <span v-if="datos.encuesta.respondida_at" class="prueba-encuesta-estrellas" :aria-label="datos.encuesta.estrellas + ' de 5 estrellas'">
                <span v-for="n in 5" :key="n" :class="n <= datos.encuesta.estrellas ? 'text-warning' : 'text-muted opacity-25'">★</span>
              </span>
            </div>
            <p v-if="!datos.encuesta.respondida_at" class="small text-muted mb-0">
              <template v-if="datos.encuesta.enviada_at">Enviada el {{ fecha(datos.encuesta.enviada_at) }}. Todavía no la contestó.</template>
              <template v-else>Creada, todavía no salió por ningún canal.</template>
            </p>
            <template v-else>
              <p class="small text-muted mb-2">
                Contestada el {{ fecha(datos.encuesta.respondida_at) }}{{ datos.encuesta.contrato_al_responder ? ' · ya había contratado' : '' }}.
              </p>
              <ul class="list-unstyled small mb-2 row g-1">
                <li v-for="pregunta in preguntas_de_la_encuesta" :key="pregunta.campo" class="col-12 col-md-6 d-flex gap-2">
                  <span class="badge" :class="clase_respuesta(datos.encuesta[pregunta.campo])">{{ texto_respuesta(datos.encuesta[pregunta.campo]) }}</span>
                  <span>{{ pregunta.label }}</span>
                </li>
              </ul>
              <p v-if="datos.encuesta.comentario" class="small mb-0 prueba-encuesta-comentario">«{{ datos.encuesta.comentario }}»</p>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Seguimiento de la prueba gratuita, adentro de la solapa «Prueba» (`PruebaTab.vue`, misión
 * prueba-alta-instancia) del modal del lead y de la ficha del cliente (misión cruzada
 * prueba-martin-importacion, 3/11/2026, programa «Prueba gratuita de 7 días»).
 *
 * Muestra en qué hito va el negocio (leído EN VIVO de su sistema por el admin, con los eventos
 * recibidos como respaldo), en qué día de la prueba está, qué WhatsApps de la prueba le salieron (la
 * bienvenida de Martín y los empujones) y el botón «Avisar a Tomás». El estado, la URL, la instancia y
 * los días editables los muestra la solapa que lo monta. El cupo de imágenes se lee de la misma
 * consulta al sistema del negocio.
 *
 * Sirve para los dos modales: `model_name` (`client` | `lead`) decide a qué ruta pedirle
 * (`admin/client/{id}/prueba/seguimiento` o `admin/lead/{id}/prueba/seguimiento`). Solo usa `record`.
 */
export default {
  name: 'PruebaSeguimiento',
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
      cupo_total: null,
      guardando_cupo: false,
      cupo_error: null,
      cupo_guardado: false,
    }
  },
  computed: {
    /** Base de las rutas según el modelo abierto. */
    base_url() {
      const prefijo = this.model_name === 'lead' ? 'lead' : 'client'
      return this.record && this.record.id ? '/' + prefijo + '/' + this.record.id + '/prueba' : null
    },
    cupo_input_id() {
      return 'prueba-cupo-imagenes-' + this.model_name + '-' + this.record.id
    },
    cupo_valido() {
      return this.datos && this.datos.imagenes
        && Number.isInteger(this.cupo_total) && this.cupo_total >= 0 && this.cupo_total <= 10000
        && this.cupo_total !== this.datos.imagenes.tope
    },
    cupo_sin_datos() {
      if (!this.datos.cupo_imagenes_estado || this.datos.cupo_imagenes_estado === 'version_vieja') {
        return 'Disponible cuando se actualice el sistema del negocio.'
      }
      return 'No se pudo consultar el cupo en el sistema del negocio. Probá actualizar la prueba.'
    },
    /** Las seis preguntas de sí/no de la encuesta, con el rótulo corto que ve el equipo. */
    preguntas_de_la_encuesta() {
      return [
        { campo: 'implementacion_practica', label: 'La puesta en marcha le resultó práctica' },
        { campo: 'soporte_sirvio', label: 'Le sirvió el soporte' },
        { campo: 'probo_gestion', label: 'Entendió y probó la gestión' },
        { campo: 'probo_tienda', label: 'Entendió y probó la tienda' },
        { campo: 'probo_agentes', label: 'Entendió y probó los agentes' },
        { campo: 'atencion_buena', label: 'La atención fue buena' },
      ]
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
    base_url: {
      immediate: true,
      handler(ruta) {
        this.guardando_cupo = false
        if (ruta) {
          this.cargar()
        }
      },
    },
  },
  methods: {
    /** Trae el seguimiento (le pega en vivo al sistema del negocio). */
    cargar() {
      const ruta = this.base_url
      if (!ruta) {
        return
      }
      this.loading = true
      this.load_error = null
      this.cupo_error = null
      this.cupo_guardado = false
      api
        .get(ruta + '/seguimiento', { silent_error: true })
        .then((res) => {
          if (ruta === this.base_url) {
            this.datos = res.data
            this.cupo_total = res.data.imagenes ? res.data.imagenes.tope : null
          }
        })
        .catch((error) => {
          if (ruta === this.base_url) {
            this.load_error = resolve_error_message(error) || 'No se pudo leer el seguimiento de la prueba.'
          }
        })
        .finally(() => {
          if (ruta === this.base_url) {
            this.loading = false
          }
        })
    },
    guardar_cupo() {
      const ruta = this.base_url
      if (!ruta || !this.cupo_valido || this.guardando_cupo) {
        return
      }
      this.guardando_cupo = true
      this.cupo_error = null
      this.cupo_guardado = false
      api
        .put(ruta + '/cupo-imagenes', { tope: this.cupo_total }, { silent_error: true })
        .then((res) => {
          if (ruta === this.base_url) {
            this.datos.imagenes = res.data.imagenes
            this.cupo_total = res.data.imagenes.tope
            this.cupo_guardado = true
          }
        })
        .catch((error) => {
          if (ruta === this.base_url) {
            if (error.response && error.response.data && error.response.data.estado === 'version_vieja') {
              this.datos.imagenes = null
              this.datos.cupo_imagenes_estado = 'version_vieja'
            } else {
              this.cupo_error = resolve_error_message(error) || 'No se pudo guardar el cupo.'
            }
          }
        })
        .finally(() => {
          if (ruta === this.base_url) {
            this.guardando_cupo = false
          }
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
        .post(this.base_url + '/avisar-a-tomas', {}, { silent_error: true })
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
    /** Sí / No / sin contestar de una pregunta de la encuesta. */
    texto_respuesta(valor) {
      return valor === true ? 'Sí' : valor === false ? 'No' : '—'
    },
    clase_respuesta(valor) {
      return valor === true ? 'bg-success' : valor === false ? 'bg-danger' : 'bg-secondary bg-opacity-25 text-secondary'
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
      if (envio.plantilla && envio.plantilla.indexOf('cc_prueba_bienvenida') === 0) {
        return 'Bienvenida de Martín'
      }
      /* Envíos de la misión prueba-e2e-campana-imperio: encuesta, día 5, correos y lo que queda en el sistema. */
      const fijos = {
        cc_prueba_fin_encuesta: 'Encuesta de fin de prueba (WhatsApp)',
        cc_prueba_dia_5: 'Aviso de que le quedan pocos días (WhatsApp)',
        correo_fin_encuesta: 'Encuesta de fin de prueba (correo)',
        correo_dia_5: 'Aviso de que le quedan pocos días (correo)',
        sistema_bienvenida: 'Bienvenida en Soporte de su sistema',
      }
      if (fijos[envio.plantilla]) {
        return fijos[envio.plantilla]
      }
      if (envio.plantilla && envio.plantilla.indexOf('correo_paso_') === 0) {
        const hito_correo = this.datos.hitos_catalogo ? this.datos.hitos_catalogo[envio.hito] : null
        return 'Correo del paso: ' + (hito_correo || envio.hito)
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
.prueba-envios {
  max-height: 14rem;
  overflow-y: auto;
}
.prueba-encuesta-estrellas {
  font-size: 1.15rem;
  letter-spacing: 0.1rem;
  white-space: nowrap;
}
.prueba-encuesta-comentario {
  white-space: pre-line;
  overflow-wrap: anywhere;
}
</style>
