<template>
  <!--
    La grabación de una llamada de Juan (misión leads-referidos-compromisos, E3).

    Se monta dentro de cada llamada de la lista de la ficha de la oportunidad (OpportunityModal), tenga o no grabación: sin grabación, o con una
    subida cortada o con error, ofrece «Subir la grabación» sobre ESA llamada (no se registra otra). Muestra en qué paso está el audio
    que subió Juan (en cola, transcribiendo, transcripto o con error), el resumen que armó la IA, la transcripción completa plegada
    y el próximo contacto que la IA entendió de la llamada (si quedó agendado o sólo como propuesta). Si falló, o quedó colgada,
    «Reintentar» la vuelve a poner en cola (por ejemplo, cuando se instala ffmpeg en el servidor); si la IA no pudo resumir, «Volver a resumir»
    repite sólo el resumen.

    Lo usan Lucas y Juan: Juan sube las grabaciones de sus llamadas y necesita ver cómo van y reintentarlas, por eso NO se esconde
    según el perfil. Ninguna de sus acciones le escribe al lead. Mientras la grabación espera o se transcribe, el componente vuelve a
    mirar el estado cada 15 segundos; cuando termina avisa con `cambio` para que la ficha recargue el compromiso.
  -->
  <div class="grabacion" :class="grabacion ? 'grabacion--' + grabacion.status : 'grabacion--sin'">
    <div class="grabacion__head">
      <i class="bi bi-mic" aria-hidden="true" />
      <span class="grabacion__titulo">Grabación de la llamada</span>
      <span class="grabacion__estado">{{ grabacion ? etiqueta : 'Sin grabación' }}</span>
    </div>

    <template v-if="grabacion">
      <!-- Subida que se cortó a la mitad: el audio no llegó entero; se retoma con «Subir la grabación» sobre esta misma llamada. -->
      <p v-if="grabacion.status === 'subiendo'" class="grabacion__linea">
        La subida quedó incompleta ({{ tamano_recibido }} de {{ tamano_total }}). Subí el archivo de nuevo: reemplaza a este.
      </p>

      <p v-if="grabacion.status === 'error' && grabacion.error_text" class="grabacion__error">{{ grabacion.error_text }}</p>

      <!-- El resumen que armó la IA. -->
      <p v-if="grabacion.resumen" class="grabacion__resumen">{{ grabacion.resumen }}</p>

      <!-- Lo que la IA entendió como próximo contacto, y qué se hizo con eso. -->
      <p v-if="grabacion.compromiso_propuesto" class="grabacion__propuesta">
        <strong>Próximo contacto que se entendió:</strong> {{ grabacion.compromiso_propuesto }}.
        <span v-if="grabacion.compromiso_id">Quedó agendado.</span>
        <span v-else>No se agendó solo (ya había una fecha acordada, el motor está apagado, la fecha ya pasó o la llamada cerró el caso).</span>
      </p>

      <details v-if="grabacion.status === 'lista' && grabacion.tiene_transcripcion" class="grabacion__transcripcion" @toggle="al_desplegar">
        <summary>Ver la transcripción</summary>
        <p v-if="cargando_transcripcion" class="grabacion__linea">Cargando…</p>
        <p v-else-if="grabacion.transcripcion" class="grabacion__texto">{{ grabacion.transcripcion }}</p>
      </details>
    </template>

    <!-- Subida a ESTA llamada (no crea otra): sin grabación, con una subida a medias o con error. -->
    <div v-if="subida.activa" class="grabacion__subida">
      <div class="progress" role="progressbar" aria-label="Subida de la grabación" :aria-valuenow="porcentaje_subido" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar" :style="{ width: porcentaje_subido + '%' }" />
      </div>
      <p class="grabacion__linea">Subiendo la grabación: {{ subida.hechas }} de {{ subida.total }} partes. No cierres esta ventana.</p>
    </div>

    <div class="grabacion__botones">
      <button v-if="grabacion && grabacion.puede_reintentar" type="button" class="btn btn-sm btn-outline-primary" :disabled="ocupado" @click="reintentar">
        {{ reintentando ? 'Reintentando…' : 'Reintentar' }}
      </button>
      <button v-if="grabacion && grabacion.puede_resumir" type="button" class="btn btn-sm btn-outline-primary" :disabled="ocupado || esperando_resumen" @click="volver_a_resumir">
        {{ esperando_resumen ? 'Resumiendo…' : 'Volver a resumir' }}
      </button>
      <template v-if="puede_subir">
        <input ref="archivo_input" type="file" accept="audio/*,.m4a,.amr,.3gp" class="grabacion__archivo" :disabled="ocupado" @change="on_elegir_archivo" />
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="ocupado" @click="elegir_archivo">Subir la grabación</button>
      </template>
    </div>

    <p v-if="mensaje_de_error" class="grabacion__error">{{ mensaje_de_error }}</p>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { espera_para_volver_a_mirar, etiqueta_de_estado, tamano_en_palabras, validar_archivo } from '@/utils/grabacion_de_llamada'
import { subir_grabacion } from '@/utils/subida_de_grabacion'

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
      /** Estado de la subida a esta llamada. */
      subida: { activa: false, hechas: 0, total: 0 },
      /** true desde que se pidió «Volver a resumir» hasta que aparece el resumen (se mira cada 15 s, hasta 8 veces). */
      esperando_resumen: false,
      /** Cuántas veces se miró esperando el resumen. */
      miradas_del_resumen: 0,
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
    /** @returns {boolean} true si hay algo en curso que bloquea los botones. */
    ocupado() {
      return this.reintentando || this.subida.activa
    },
    /** @returns {boolean} true si se puede subir un archivo a esta llamada: no tiene grabación, quedó a medias o terminó en error. */
    puede_subir() {
      return !this.grabacion || this.grabacion.status === 'subiendo' || this.grabacion.status === 'error'
    },
    /** @returns {number} Porcentaje de partes ya subidas (0 a 100). */
    porcentaje_subido() {
      return this.subida.total > 0 ? Math.round((this.subida.hechas / this.subida.total) * 100) : 0
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
      let espera = this.grabacion ? espera_para_volver_a_mirar(this.grabacion.status) : 0
      if (this.esperando_resumen) {
        espera = 15000
      }
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
          if (self.esperando_resumen) {
            self.miradas_del_resumen++
            if (self.grabacion && (self.grabacion.resumen || !self.grabacion.puede_resumir || self.miradas_del_resumen >= 8)) {
              self.esperando_resumen = false
              self.$emit('cambio')
            }
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
    /** Abre el selector de archivos de audio. */
    elegir_archivo() {
      if (this.$refs.archivo_input) {
        this.$refs.archivo_input.click()
      }
    },
    /**
     * Se eligió un archivo: se valida y se sube a ESTA llamada (reemplaza a una subida a medias o con error). Al terminar la grabación
     * queda «en cola» y la ficha recarga sus llamadas.
     *
     * @param {Event} event Evento `change` del input de archivo.
     */
    on_elegir_archivo(event) {
      const self = this
      const archivo = event && event.target && event.target.files ? event.target.files[0] : null
      this.mensaje_de_error = ''
      if (!archivo) {
        return
      }
      const revision = validar_archivo(archivo.name, archivo.size)
      event.target.value = ''
      if (!revision.ok) {
        this.mensaje_de_error = revision.mensaje
        return
      }
      this.subida = { activa: true, hechas: 0, total: 1 }
      subir_grabacion({
        lead_id: this.lead_id,
        llamada_id: this.llamada.id,
        archivo: archivo,
        al_avanzar: function (hechas, total) {
          self.subida = { activa: true, hechas: hechas, total: total }
        },
      })
        .then(function (grabacion) {
          self.subida = { activa: false, hechas: 0, total: 0 }
          self.grabacion = grabacion
          self.$emit('cambio')
          self.programar_la_proxima_mirada()
        })
        .catch(function (error) {
          self.subida = { activa: false, hechas: 0, total: 0 }
          const respuesta = error && error.response ? error.response.data : null
          // Un 409 con la grabación: ese audio (o esa llamada) ya tenía grabación; se muestra la que está.
          if (error && error.response && error.response.status === 409 && respuesta && respuesta.grabacion) {
            self.grabacion = respuesta.grabacion
            self.mensaje_de_error = respuesta.message || 'Esa grabación ya estaba cargada.'
            return
          }
          self.mensaje_de_error = error && error.response ? resolve_error_message(error) : (error && error.message ? error.message : 'No se pudo subir la grabación.')
        })
    },
    /** «Volver a resumir»: la IA no había podido resumir; se repite sólo el resumen (la transcripción no se vuelve a pagar). */
    volver_a_resumir() {
      const self = this
      this.mensaje_de_error = ''
      api
        .post('/lead/' + this.lead_id + '/llamadas/' + this.llamada.id + '/grabacion/resumir', {}, { silent_error: true })
        .then(function () {
          self.esperando_resumen = true
          self.miradas_del_resumen = 0
          self.programar_la_proxima_mirada()
        })
        .catch(function (error) {
          self.mensaje_de_error = resolve_error_message(error)
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
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.45rem;
}

.grabacion__botones:empty {
  display: none;
}

.grabacion__archivo {
  display: none;
}

.grabacion__subida {
  margin-top: 0.5rem;
}

.grabacion__subida .progress {
  height: 0.5rem;
}
</style>
