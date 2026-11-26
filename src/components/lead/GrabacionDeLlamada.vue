<template>
  <!--
    La grabación de una llamada de Juan (misión leads-referidos-compromisos, E3).

    Se monta dentro de cada llamada de la lista de la ficha de la oportunidad (OpportunityModal). Muestra en qué paso está el audio
    que subió Juan (en cola, transcribiendo, transcripto o con error), el resumen que armó la IA, la transcripción completa plegada
    y el próximo contacto que la IA entendió de la llamada (si quedó agendado o sólo como propuesta). Si falló, o quedó colgada,
    «Reintentar» la vuelve a poner en cola (por ejemplo, cuando se instala ffmpeg en el servidor).

    Lo usan Lucas y Juan: Juan sube las grabaciones de sus llamadas y necesita ver cómo van y reintentarlas, por eso NO se esconde
    según el perfil. Ninguna de sus acciones le escribe al lead. Mientras la grabación espera o se transcribe, el componente vuelve a
    mirar el estado cada 15 segundos; cuando termina avisa con `cambio` para que la ficha recargue el compromiso.
  -->
  <div v-if="grabacion" class="grabacion" :class="'grabacion--' + grabacion.status">
    <div class="grabacion__head">
      <i class="bi bi-mic" aria-hidden="true" />
      <span class="grabacion__titulo">Grabación de la llamada</span>
      <span class="grabacion__estado">{{ etiqueta }}</span>
    </div>

    <!-- Subida que se cortó a la mitad: el audio no llegó entero. -->
    <p v-if="grabacion.status === 'subiendo'" class="grabacion__linea">
      La subida quedó incompleta ({{ tamano_recibido }} de {{ tamano_total }}). Volvé a registrar la grabación desde «Registrar llamada».
    </p>

    <p v-if="grabacion.status === 'error' && grabacion.error_text" class="grabacion__error">{{ grabacion.error_text }}</p>

    <!-- El resumen que armó la IA. -->
    <p v-if="grabacion.resumen" class="grabacion__resumen">{{ grabacion.resumen }}</p>

    <!-- Lo que la IA entendió como próximo contacto, y qué se hizo con eso. -->
    <p v-if="grabacion.compromiso_propuesto" class="grabacion__propuesta">
      <strong>Próximo contacto que se entendió:</strong> {{ grabacion.compromiso_propuesto }}.
      <span v-if="grabacion.compromiso_id">Quedó agendado.</span>
      <span v-else>No se agendó solo (ya había una fecha acordada, el motor está apagado o la llamada cerró el caso).</span>
    </p>

    <details v-if="grabacion.status === 'lista' && grabacion.tiene_transcripcion" class="grabacion__transcripcion" @toggle="al_desplegar">
      <summary>Ver la transcripción</summary>
      <p v-if="cargando_transcripcion" class="grabacion__linea">Cargando…</p>
      <p v-else-if="grabacion.transcripcion" class="grabacion__texto">{{ grabacion.transcripcion }}</p>
    </details>

    <div v-if="grabacion.puede_reintentar" class="grabacion__botones">
      <button type="button" class="btn btn-sm btn-outline-primary" :disabled="reintentando" @click="reintentar">
        {{ reintentando ? 'Reintentando…' : 'Reintentar' }}
      </button>
    </div>

    <p v-if="mensaje_de_error" class="grabacion__error">{{ mensaje_de_error }}</p>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { espera_para_volver_a_mirar, etiqueta_de_estado, tamano_en_palabras } from '@/utils/grabacion_de_llamada'

/**
 * Estado de la grabación de una llamada, con «Reintentar» y la transcripción a pedido.
 */
export default {
  name: 'GrabacionDeLlamada',
  props: {
    /** Llamada de `GET lead/{id}/llamadas` (trae `grabacion`, sin la transcripción completa, o null). */
    llamada: { type: Object, required: true },
    /** Lead al que pertenece la llamada. */
    lead_id: { type: [Number, String], required: true },
  },
  emits: ['cambio'],
  data() {
    return {
      /** Copia local de la grabación: se refresca sola mientras espera y se completa con la transcripción al desplegarla. */
      grabacion: this.llamada && this.llamada.grabacion ? this.llamada.grabacion : null,
      /** true mientras se pide la transcripción completa. */
      cargando_transcripcion: false,
      /** true mientras viaja el pedido de «Reintentar». */
      reintentando: false,
      /** Por qué falló el último pedido de esta tarjeta ('' si no falló). */
      mensaje_de_error: '',
      /** Temporizador de la próxima mirada al estado (null si no hay nada que esperar). */
      temporizador: null,
    }
  },
  computed: {
    /** @returns {string} Etiqueta del estado en castellano. */
    etiqueta() {
      return this.grabacion ? etiqueta_de_estado(this.grabacion.status) : ''
    },
    /** @returns {string} Lo recibido de un archivo cortado. */
    tamano_recibido() {
      return tamano_en_palabras(this.grabacion ? this.grabacion.bytes_recibidos : 0)
    },
    /** @returns {string} Tamaño total declarado. */
    tamano_total() {
      return tamano_en_palabras(this.grabacion ? this.grabacion.bytes : 0)
    },
  },
  watch: {
    /** La ficha recargó las llamadas: se toma la grabación nueva (sin perder la transcripción ya pedida si es la misma). */
    'llamada.grabacion'(nueva) {
      if (!nueva) {
        this.grabacion = null
        return
      }
      const transcripcion = this.grabacion && this.grabacion.id === nueva.id ? this.grabacion.transcripcion : undefined
      this.grabacion = transcripcion !== undefined ? Object.assign({}, nueva, { transcripcion: transcripcion }) : nueva
      this.programar_la_proxima_mirada()
    },
  },
  mounted() {
    this.programar_la_proxima_mirada()
  },
  beforeUnmount() {
    this.apagar_el_temporizador()
  },
  methods: {
    /** Apaga el temporizador de la próxima mirada, si hay. */
    apagar_el_temporizador() {
      if (this.temporizador !== null) {
        window.clearTimeout(this.temporizador)
        this.temporizador = null
      }
    },
    /** Si la grabación todavía espera o se transcribe, vuelve a mirar su estado en 15 segundos. */
    programar_la_proxima_mirada() {
      const self = this
      this.apagar_el_temporizador()
      const espera = this.grabacion ? espera_para_volver_a_mirar(this.grabacion.status) : 0
      if (espera > 0) {
        this.temporizador = window.setTimeout(function () {
          self.temporizador = null
          self.cargar()
        }, espera)
      }
    },
    /**
     * Lee el estado de la grabación (con la transcripción completa). Si cambió de estado respecto de lo que se veía, avisa a la ficha
     * con `cambio` (una grabación que terminó puede haber dejado un compromiso nuevo).
     */
    cargar() {
      const self = this
      const estado_anterior = this.grabacion ? this.grabacion.status : ''
      this.mensaje_de_error = ''
      return api
        .get('/lead/' + this.lead_id + '/llamadas/' + this.llamada.id + '/grabacion', { silent_error_statuses: [404, 405] })
        .then(function (res) {
          const data = res.data || {}
          if (data.grabacion) {
            self.grabacion = data.grabacion
          }
          if (self.grabacion && self.grabacion.status !== estado_anterior) {
            self.$emit('cambio')
          }
          self.programar_la_proxima_mirada()
        })
        .catch(function () {
          // Es información de apoyo: si falla, se vuelve a intentar en la próxima vuelta sin molestar con un aviso.
          self.programar_la_proxima_mirada()
        })
    },
    /** Al desplegar «Ver la transcripción» por primera vez, pide el texto completo (el listado de llamadas no lo trae). */
    al_desplegar(event) {
      const abierto = event && event.target ? event.target.open === true : false
      if (!abierto || !this.grabacion || this.grabacion.transcripcion || this.cargando_transcripcion) {
        return
      }
      const self = this
      this.cargando_transcripcion = true
      api
        .get('/lead/' + this.lead_id + '/llamadas/' + this.llamada.id + '/grabacion', { silent_error_statuses: [404, 405] })
        .then(function (res) {
          const data = res.data || {}
          if (data.grabacion) {
            self.grabacion = data.grabacion
          }
          self.cargando_transcripcion = false
        })
        .catch(function () {
          self.cargando_transcripcion = false
        })
    },
    /** «Reintentar»: vuelve a poner en cola la transcripción (la API valida si corresponde desde el estado actual). */
    reintentar() {
      const self = this
      if (this.reintentando) {
        return
      }
      this.reintentando = true
      this.mensaje_de_error = ''
      api
        .post('/lead/' + this.lead_id + '/llamadas/' + this.llamada.id + '/grabacion/reintentar', {}, { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          self.reintentando = false
          if (data.grabacion) {
            self.grabacion = data.grabacion
          }
          self.$emit('cambio')
          self.programar_la_proxima_mirada()
        })
        .catch(function (error) {
          self.reintentando = false
          self.mensaje_de_error = resolve_error_message(error)
        })
    },
  },
}
</script>

<style scoped>
.grabacion {
  margin-top: 0.5rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--bg-card);
  min-width: 0;
}

.grabacion p {
  margin: 0;
}

.grabacion__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
}

.grabacion__titulo {
  font-weight: 600;
}

.grabacion__estado {
  margin-left: auto;
  color: var(--color-text-secondary);
}

.grabacion--lista .grabacion__estado {
  color: var(--bs-success, #198754);
}

.grabacion--error .grabacion__estado {
  color: var(--bs-danger, #dc3545);
}

.grabacion__resumen,
.grabacion__propuesta,
.grabacion__linea {
  margin-top: 0.35rem !important;
  font-size: 0.85rem;
  word-break: break-word;
}

.grabacion__linea {
  color: var(--color-text-secondary);
}

.grabacion__error {
  margin-top: 0.35rem !important;
  font-size: 0.82rem;
  color: var(--bs-danger, #dc3545);
  word-break: break-word;
}

.grabacion__transcripcion {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.grabacion__texto {
  margin-top: 0.3rem !important;
  white-space: pre-wrap;
  word-break: break-word;
}

.grabacion__botones {
  margin-top: 0.45rem;
}
</style>
