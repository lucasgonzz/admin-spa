<template>
  <div class="recursos-preguntas">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div class="btn-group btn-group-sm" role="group" aria-label="Qué preguntas ver">
        <button
          v-for="op in ESTADOS"
          :key="op.valor"
          type="button"
          class="btn"
          :class="estado_elegido === op.valor ? 'btn-dark' : 'btn-outline-secondary'"
          @click="elegir(op.valor)"
        >
          {{ op.texto }}<template v-if="totales[op.valor] != null"> ({{ totales[op.valor] }})</template>
        </button>
      </div>
      <button type="button" class="btn btn-outline-primary btn-sm" :disabled="cargando" @click="cargar">
        <span v-if="cargando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
        Actualizar
      </button>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <div v-else-if="cargando && !preguntas.length" class="text-center py-5 text-muted">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
      Cargando preguntas...
    </div>

    <p v-else-if="!preguntas.length" class="text-muted fst-italic">
      {{ estado_elegido === 'pendientes' ? 'No hay preguntas sin responder.' : 'No hay preguntas en esta lista.' }}
    </p>

    <div v-for="p in preguntas" :key="p.id" class="card border-0 recursos-panel mb-3">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between gap-2 mb-1">
          <div class="small">
            <span class="badge text-bg-light border me-1">{{ p.codigo }}</span>
            <b>{{ p.video_titulo || 'Video ' + p.codigo }}</b>
          </div>
          <div class="small text-muted">{{ fecha_corta(p.fecha) }}</div>
        </div>
        <div class="small text-muted mb-2">
          {{ p.usuario || 'Usuario sin nombre' }}
          <template v-if="p.cliente"> · {{ p.cliente }}</template>
          <template v-if="p.me_gusta"> · 👍 {{ p.me_gusta }}</template>
          <span v-if="p.oculta" class="badge text-bg-secondary ms-1">Oculta</span>
        </div>
        <p class="recursos-preguntas__texto mb-3">{{ p.texto }}</p>

        <label class="form-label small text-muted mb-1" :for="'respuesta-' + p.id">
          {{ p.respuesta ? 'Respuesta publicada (podés corregirla)' : 'Respuesta' }}
        </label>
        <textarea
          :id="'respuesta-' + p.id"
          v-model="borradores[p.id]"
          class="form-control form-control-sm mb-2"
          rows="4"
          placeholder="Escribí la respuesta o tocá «Proponer respuesta» para que la IA arme un borrador con el guion del video."
        />
        <div class="d-flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            :disabled="!!ocupada[p.id]"
            @click="proponer(p)"
          >
            <span v-if="ocupada[p.id] === 'borrador'" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
            Proponer respuesta
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="!!ocupada[p.id] || !(borradores[p.id] || '').trim()"
            @click="responder(p)"
          >
            <span v-if="ocupada[p.id] === 'responder'" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
            {{ p.respuesta ? 'Guardar respuesta' : 'Responder' }}
          </button>
          <button
            type="button"
            class="btn btn-outline-danger btn-sm"
            :disabled="!!ocupada[p.id]"
            @click="alternar_oculta(p)"
          >
            {{ p.oculta ? 'Volver a mostrar' : 'Ocultar' }}
          </button>
        </div>
        <p v-if="motivo_borrador[p.id]" class="small text-danger mt-2 mb-0">{{ motivo_borrador[p.id] }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { campo, lista_de, numero, fecha_corta, avisar } from './recursos_admin'

/**
 * Solapa "Preguntas" del Centro de recursos: las preguntas de los clientes sobre los videos,
 * pendientes primero y las más viejas arriba (lo ordena el backend, §3.6). Desde acá se
 * responden —a mano o partiendo del borrador que propone la IA con el guion del video— y se
 * ocultan.
 *
 * Endpoints: `GET admin/recursos/preguntas?estado=…`, `PUT admin/recursos/preguntas/{id}`
 * (`{respuesta?, oculta?}`) y `POST admin/recursos/preguntas/{id}/borrador`.
 */
export default {
  name: 'PanelPreguntasRecursos',
  data() {
    return {
      /** Filtros del backend. */
      ESTADOS: [
        { valor: 'pendientes', texto: 'Pendientes' },
        { valor: 'respondidas', texto: 'Respondidas' },
        { valor: 'ocultas', texto: 'Ocultas' },
      ],
      /** Filtro elegido. */
      estado_elegido: 'pendientes',
      /** Preguntas normalizadas. */
      preguntas: [],
      /** Cantidad por filtro (`totales` de la respuesta): { pendientes, respondidas, ocultas }. */
      totales: {},
      /** Texto de la caja de respuesta por id. */
      borradores: {},
      /** Acción en curso por id: 'borrador' | 'responder' | 'ocultar'. */
      ocupada: {},
      /** Motivo por el que la IA no pudo proponer (422), por id. */
      motivo_borrador: {},
      /** true mientras se carga la lista. */
      cargando: false,
      /** Error de carga, o null. */
      error: null,
    }
  },
  created() {
    this.cargar()
  },
  methods: {
    fecha_corta: fecha_corta,
    /**
     * Normaliza una pregunta del backend.
     * @param {Object} p
     * @returns {Object}
     */
    normalizar(p) {
      /** Respuesta (string u objeto `{texto}`). */
      const respuesta = campo(p, ['respuesta', 'respuesta.texto'])
      return {
        id: p.id,
        codigo: campo(p, ['codigo', 'video.codigo', 'video_codigo'], ''),
        video_titulo: campo(p, ['video_titulo', 'video.titulo', 'titulo'], ''),
        texto: campo(p, ['texto'], ''),
        fecha: campo(p, ['fecha', 'created_at']),
        usuario: campo(p, ['usuario', 'usuario.nombre', 'usuario_nombre', 'autor']),
        cliente: campo(p, ['cliente', 'cliente.nombre', 'cliente.company_name', 'cliente.name', 'cliente_nombre']),
        respuesta: respuesta || '',
        borrador: campo(p, ['borrador'], ''),
        oculta: !!campo(p, ['oculta'], false),
        me_gusta: numero(campo(p, ['me_gusta', 'me_gusta_count', 'me_gustas_count'], 0)),
      }
    },
    /**
     * Cambia de filtro y recarga.
     * @param {string} valor
     * @returns {void}
     */
    elegir(valor) {
      this.estado_elegido = valor
      this.cargar()
    },
    /**
     * Trae la lista del filtro elegido.
     * @returns {void}
     */
    cargar() {
      const self = this
      self.cargando = true
      self.error = null
      api
        .get('/recursos/preguntas', { params: { estado: self.estado_elegido }, silent_error: true })
        .then(function (res) {
          /** Lista normalizada. */
          const lista = lista_de(res.data, ['preguntas']).map(self.normalizar)
          /** Textos de las cajas: lo publicado, o el borrador guardado. */
          const borradores = {}
          lista.forEach(function (p) {
            borradores[p.id] = p.respuesta || p.borrador || ''
          })
          self.borradores = borradores
          self.motivo_borrador = {}
          self.totales = (res.data && res.data.totales) || {}
          self.preguntas = lista
        })
        .catch(function (error) {
          self.error = resolve_error_message(error)
        })
        .then(function () {
          self.cargando = false
        })
    },
    /**
     * Pide a la IA un borrador de respuesta y lo pone en la caja.
     * @param {Object} p
     * @returns {void}
     */
    proponer(p) {
      const self = this
      self.ocupada[p.id] = 'borrador'
      self.motivo_borrador[p.id] = ''
      api
        .post('/recursos/preguntas/' + p.id + '/borrador', {}, { silent_error: true })
        .then(function (res) {
          /** Borrador devuelto. */
          const borrador = campo(res.data || {}, ['borrador', 'texto', 'pregunta.borrador'], '')
          if (borrador) {
            self.borradores[p.id] = borrador
          } else {
            self.motivo_borrador[p.id] = 'La IA no devolvió un borrador. Escribila a mano.'
          }
        })
        .catch(function (error) {
          /** Motivo que manda el backend en el 422 (`{error, motivo}`: sin clave de IA, falla del modelo). */
          const motivo = error && error.response && error.response.data && error.response.data.motivo
          self.motivo_borrador[p.id] = 'No se pudo proponer: ' + (motivo || resolve_error_message(error)) + ' Podés escribirla a mano.'
        })
        .then(function () {
          self.ocupada[p.id] = null
        })
    },
    /**
     * Publica (o corrige) la respuesta.
     * @param {Object} p
     * @returns {void}
     */
    responder(p) {
      const self = this
      /** Texto de la respuesta. */
      const texto = (self.borradores[p.id] || '').trim()
      if (!texto) {
        return
      }
      self.ocupada[p.id] = 'responder'
      api
        .put('/recursos/preguntas/' + p.id, { respuesta: texto }, { silent_error: true })
        .then(function () {
          avisar('Respuesta publicada. La ve el cliente y, si no está oculta, el resto.', 'success')
          if (self.estado_elegido === 'pendientes') {
            self.sacar(p.id)
            self.mover_total('pendientes', 'respondidas')
          } else {
            p.respuesta = texto
          }
        })
        .catch(function (error) {
          avisar(resolve_error_message(error), 'danger')
        })
        .then(function () {
          self.ocupada[p.id] = null
        })
    },
    /**
     * Oculta la pregunta (o la vuelve a mostrar).
     * @param {Object} p
     * @returns {void}
     */
    alternar_oculta(p) {
      const self = this
      /** Valor nuevo. */
      const oculta = !p.oculta
      self.ocupada[p.id] = 'ocultar'
      api
        .put('/recursos/preguntas/' + p.id, { oculta: oculta }, { silent_error: true })
        .then(function () {
          avisar(oculta ? 'Pregunta oculta.' : 'La pregunta se volvió a mostrar.', 'success')
          if ((oculta && self.estado_elegido !== 'ocultas') || (!oculta && self.estado_elegido === 'ocultas')) {
            self.sacar(p.id)
            if (oculta) {
              self.mover_total(self.estado_elegido, 'ocultas')
            } else {
              self.mover_total('ocultas', p.respuesta ? 'respondidas' : 'pendientes')
            }
          } else {
            p.oculta = oculta
          }
        })
        .catch(function (error) {
          avisar(resolve_error_message(error), 'danger')
        })
        .then(function () {
          self.ocupada[p.id] = null
        })
    },
    /**
     * Pasa una pregunta de un contador a otro (sin volver a pedir la lista).
     * @param {string} desde
     * @param {string} hacia
     * @returns {void}
     */
    mover_total(desde, hacia) {
      if (this.totales[desde] != null) {
        this.totales[desde] = Math.max(0, this.totales[desde] - 1)
      }
      if (this.totales[hacia] != null) {
        this.totales[hacia] = this.totales[hacia] + 1
      }
    },
    /**
     * Saca una pregunta de la lista visible.
     * @param {number} id
     * @returns {void}
     */
    sacar(id) {
      this.preguntas = this.preguntas.filter(function (x) {
        return x.id !== id
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
.recursos-preguntas__texto {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
