<template>
  <div class="recursos-videos">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <p class="text-muted small mb-0">
        Los peor puntuados primero: 👎, "no me fue útil", "no se entendió" y medio punto por "más o menos",
        sobre las respuestas de cada video.
      </p>
      <button type="button" class="btn btn-outline-primary btn-sm" :disabled="cargando" @click="cargar">
        <span v-if="cargando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
        Actualizar
      </button>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <div v-else-if="cargando && !videos.length" class="text-center py-5 text-muted">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
      Cargando videos...
    </div>

    <p v-else-if="!videos.length" class="text-muted fst-italic">Todavía no hay videos cargados en el centro.</p>

    <div v-else class="card border-0 recursos-panel">
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0 recursos-tabla">
            <thead>
              <tr>
                <th>Video</th>
                <th class="text-end" title="Usuarios que lo empezaron">Vistas</th>
                <th class="text-end">Terminados</th>
                <th class="text-end">👍</th>
                <th class="text-end">👎</th>
                <th class="text-end" title="¿Te resultó útil? sí / no">Útil sí/no</th>
                <th class="text-end" title="¿Se entendió? sí / más o menos / no">Se entendió</th>
                <th class="text-end">Qué mejorar</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="v in videos" :key="v.codigo">
                <tr>
                  <td>
                    <span class="recursos-tabla__nota d-block">
                      {{ v.codigo }}
                      <span v-if="!v.activo" class="badge text-bg-secondary ms-1">Ya no se publica</span>
                    </span>
                    {{ v.titulo }}
                  </td>
                  <td class="text-end">{{ v.vistas }}</td>
                  <td class="text-end">{{ v.terminados }}</td>
                  <td class="text-end">{{ v.votos_si }}</td>
                  <td class="text-end" :class="{ 'text-danger fw-semibold': v.votos_no > 0 }">{{ v.votos_no }}</td>
                  <td class="text-end">{{ v.util_si }} / {{ v.util_no }}</td>
                  <td class="text-end">{{ v.entendio_si }} / {{ v.entendio_mas_o_menos }} / {{ v.entendio_no }}</td>
                  <td class="text-end">
                    <button
                      v-if="v.mejoras > 0"
                      type="button"
                      class="btn btn-link btn-sm p-0"
                      :aria-expanded="abierto === v.codigo ? 'true' : 'false'"
                      @click="alternar_mejoras(v)"
                    >
                      {{ v.mejoras }} {{ abierto === v.codigo ? '▲' : '▼' }}
                    </button>
                    <span v-else class="text-muted">0</span>
                  </td>
                </tr>
                <tr v-if="abierto === v.codigo" class="recursos-tabla__detalle">
                  <td colspan="8">
                    <div v-if="mejoras_cargando" class="small text-muted">Cargando...</div>
                    <ul v-else-if="mejoras.length" class="mb-0 small">
                      <li v-for="(m, i) in mejoras" :key="i" class="mb-1">
                        {{ m.texto }}
                        <span v-if="m.detalle" class="text-muted">— {{ m.detalle }}</span>
                      </li>
                    </ul>
                    <div v-else class="small text-muted">Sin textos.</div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { campo, lista_de, numero, fecha_corta, avisar } from './recursos_admin'

/**
 * Solapa "Videos" del Centro de recursos: por video, vistas, terminados, 👍/👎, la encuesta
 * (útil sí/no, se entendió sí/más o menos/no) y los "qué mejorar", con los peor puntuados
 * primero (el orden lo arma el backend, §3.6). Cada "qué mejorar" se despliega con
 * `GET admin/recursos/videos/{codigo}/mejoras`.
 */
export default {
  name: 'PanelVideosRecursos',
  data() {
    return {
      /** Videos normalizados, en el orden del backend. */
      videos: [],
      /** Código del video con los "qué mejorar" desplegados, o null. */
      abierto: null,
      /** Textos de "qué mejorar" del video desplegado. */
      mejoras: [],
      /** true mientras se traen los "qué mejorar". */
      mejoras_cargando: false,
      /** true mientras se carga la tabla. */
      cargando: false,
      /** Error de carga, o null. */
      error: null,
    }
  },
  created() {
    this.cargar()
  },
  methods: {
    /**
     * Normaliza una fila del backend (acepta los conteos sueltos o agrupados en `votos` y
     * `encuestas`).
     * @param {Object} v
     * @returns {Object}
     */
    normalizar(v) {
      return {
        codigo: campo(v, ['codigo'], ''),
        titulo: campo(v, ['titulo'], ''),
        activo: campo(v, ['activo'], true) !== false,
        vistas: numero(campo(v, ['vistas', 'empezados', 'usuarios'], 0)),
        terminados: numero(campo(v, ['terminados'], 0)),
        votos_si: numero(campo(v, ['votos_si', 'positivos', 'me_gusta', 'votos.si', 'votos.positivos', 'votos.arriba'], 0)),
        votos_no: numero(campo(v, ['votos_no', 'negativos', 'no_me_gusta', 'votos.no', 'votos.negativos', 'votos.abajo'], 0)),
        util_si: numero(campo(v, ['util_si', 'encuestas.util_si', 'encuestas.util.si'], 0)),
        util_no: numero(campo(v, ['util_no', 'encuestas.util_no', 'encuestas.util.no'], 0)),
        entendio_si: numero(campo(v, ['entendio_si', 'encuestas.entendio_si', 'encuestas.entendio.si'], 0)),
        entendio_mas_o_menos: numero(
          campo(v, ['entendio_mas_o_menos', 'encuestas.entendio_mas_o_menos', 'encuestas.entendio.mas_o_menos'], 0)
        ),
        entendio_no: numero(campo(v, ['entendio_no', 'encuestas.entendio_no', 'encuestas.entendio.no'], 0)),
        mejoras: numero(campo(v, ['mejoras', 'cantidad_mejoras', 'mejoras_count', 'encuestas.mejoras'], 0)),
      }
    },
    /**
     * Trae la tabla.
     * @returns {void}
     */
    cargar() {
      const self = this
      self.cargando = true
      self.error = null
      api
        .get('/recursos/videos', { silent_error: true })
        .then(function (res) {
          self.videos = lista_de(res.data, ['videos']).map(self.normalizar)
        })
        .catch(function (error) {
          self.error = resolve_error_message(error)
        })
        .then(function () {
          self.cargando = false
        })
    },
    /**
     * Despliega (o pliega) los "qué mejorar" de un video.
     * @param {Object} v
     * @returns {void}
     */
    alternar_mejoras(v) {
      const self = this
      if (self.abierto === v.codigo) {
        self.abierto = null
        return
      }
      self.abierto = v.codigo
      self.mejoras = []
      self.mejoras_cargando = true
      api
        .get('/recursos/videos/' + encodeURIComponent(v.codigo) + '/mejoras', { silent_error: true })
        .then(function (res) {
          if (self.abierto !== v.codigo) {
            return
          }
          self.mejoras = lista_de(res.data, ['mejoras', 'textos']).map(function (m) {
            if (typeof m === 'string') {
              return { texto: m, detalle: '' }
            }
            /** Quién y cuándo, si vino. */
            const partes = []
            /** Usuario que lo escribió. */
            const usuario = campo(m, ['usuario', 'usuario.nombre'])
            if (usuario) {
              partes.push(usuario)
            }
            /** Su cliente. */
            const cliente = campo(m, ['cliente', 'cliente.nombre'])
            if (cliente) {
              partes.push(cliente)
            }
            /** Fecha. */
            const fecha = campo(m, ['fecha', 'created_at', 'updated_at'])
            if (fecha) {
              partes.push(fecha_corta(fecha))
            }
            return { texto: campo(m, ['mejora', 'texto'], ''), detalle: partes.join(' · ') }
          })
        })
        .catch(function (error) {
          avisar(resolve_error_message(error), 'danger')
          self.abierto = null
        })
        .then(function () {
          self.mejoras_cargando = false
        })
    },
  },
}
</script>

<style scoped>
.recursos-panel {
  background: #ffffff;
  border: 1px solid #ededf0;
  border-radius: 0.75rem;
}
.recursos-tabla__nota {
  font-size: 0.75rem;
  color: #6c757d;
}
.recursos-tabla th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
  font-weight: 600;
  white-space: nowrap;
}
.recursos-tabla__detalle td {
  background: #f8f9fa;
}
</style>
