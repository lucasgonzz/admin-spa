<template>
  <div class="ancho">
    <div class="reproductor">
      <video
        ref="video"
        controls
        preload="metadata"
        playsinline
        :src="video.url"
        :poster="video.miniatura_url || undefined"
        @loadedmetadata="al_cargar_metadatos"
        @timeupdate="registrar"
        @seeking="ultimo = null"
        @pause="al_pausar"
        @ended="al_terminar"
        @error="error_video = 'No se pudo abrir el video. Probá de nuevo en un rato.'"
      />
      <!-- "Seguís desde m:ss" con "Empezar de cero", 6 segundos (como el prototipo). -->
      <div v-if="retomar_desde !== null" class="retomar">
        Seguís desde {{ mmss(retomar_desde) }}
        <button type="button" @click="empezar_de_cero">Empezar de cero</button>
      </div>
      <encuesta
        v-if="encuesta"
        :video="video"
        :siguiente="siguiente"
        :por_voto="encuesta.por_voto"
        :terminado="hecho"
        @cerrar="encuesta = null"
        @ver-siguiente="abrir(siguiente.codigo)"
      />
    </div>

    <div class="controles">
      Velocidad:
      <button
        v-for="x in VELOCIDADES"
        :key="x"
        type="button"
        :class="{ activo: x === estado.vel }"
        :aria-pressed="x === estado.vel ? 'true' : 'false'"
        :aria-label="'Velocidad ' + x + '×'"
        @click="cambiar_velocidad(x)"
      >
        {{ x }}×
      </button>
      <span class="sep" />
      <span class="error-video" role="alert">{{ error_video }}</span>
    </div>

    <div class="migas">
      <template v-if="carpeta">{{ carpeta.nro }}. {{ carpeta.nombre }}</template>
      <template v-if="video.seccion"> › {{ video.seccion }}</template>
      · video {{ numero }}
    </div>
    <h1>{{ video.titulo }}</h1>

    <div class="fila-acciones">
      <!-- Con sesión: avance del video y 👍/👎. -->
      <template v-if="estado.usuario">
        <div class="progreso-video">
          <span v-if="hecho" class="visto">✓ Visto</span>
          <template v-else>
            <span class="barra"><i :style="{ width: (fraccion_actual * 100).toFixed(1) + '%' }" /></span>
            <span>{{ Math.round(fraccion_actual * 100) }} % visto · {{ mmss(video.duracion) }}</span>
          </template>
        </div>
        <button
          type="button"
          class="voto"
          :class="{ si: voto === 1 }"
          :aria-pressed="voto === 1 ? 'true' : 'false'"
          title="Me gustó"
          @click="votar_video(1)"
        >
          👍 <span>Me gustó</span>
        </button>
        <button
          type="button"
          class="voto"
          :class="{ no: voto === -1 }"
          :aria-pressed="voto === -1 ? 'true' : 'false'"
          title="No me gustó"
          aria-label="No me gustó"
          @click="votar_video(-1)"
        >
          👎
        </button>
      </template>
      <!-- Sin sesión: la línea de invitado (§5.1). -->
      <p v-else class="linea-invitado">{{ LINEA_INVITADO }}</p>

      <button v-if="siguiente" type="button" class="siguiente" @click="abrir(siguiente.codigo)">
        Siguiente: {{ recortar(siguiente.titulo, 42) }} →
      </button>
    </div>

    <div v-if="video.para_que" class="tarjeta">
      <h3>Para qué sirve y cuándo usarlo</h3>
      <p>{{ video.para_que }}</p>
    </div>

    <div v-if="video.cuando_no || relacionados.length" class="tarjeta">
      <h3>Cuándo no conviene, y qué usar en su lugar</h3>
      <p v-if="video.cuando_no">{{ video.cuando_no }}</p>
      <div v-if="relacionados.length" class="chips">
        <button
          v-for="r in relacionados"
          :key="r.codigo"
          type="button"
          class="chip-video"
          @click="abrir(r.codigo)"
        >
          <icono-estado :fraccion="fraccion_de(r)" :hecho="terminado_de(r)" />
          {{ r.titulo }}
        </button>
      </div>
    </div>

    <div v-if="transcripcion" class="tarjeta">
      <details>
        <summary>Lo que dice el video (texto completo)</summary>
        <p>{{ transcripcion }}</p>
      </details>
    </div>

    <preguntas :video="video" />
  </div>
</template>

<script>
import IconoEstado from './IconoEstado.vue'
import Encuesta from './Encuesta.vue'
import Preguntas from './Preguntas.vue'
import {
  estado,
  VELOCIDADES,
  fraccion,
  terminado,
  video_por_codigo,
  carpeta_por_nro,
  abrir_video,
  elegir_velocidad,
  registrar_tramo,
  anotar_posicion,
  enviar_progreso,
  votar,
} from '../estado'
import { mmss, numero_de, recortar, LINEA_INVITADO } from '../utiles'

/**
 * El video abierto: reproductor con velocidades y "Seguís desde…", migas, título, avance,
 * 👍/👎, "Siguiente", las tarjetas de descripción, la transcripción plegable, las preguntas y
 * la encuesta al terminar.
 *
 * Se monta de nuevo con cada video (App.vue le pone `:key` = código), así que todo su estado
 * (último segundo visto, encuesta, "Seguís desde") arranca limpio y al desmontarse manda lo
 * pendiente del video que se deja.
 *
 * La cuenta de lo visto es la de `registrar()` del prototipo: solo suma si el video avanzó
 * reproduciéndose (no pausado, hacia adelante y sin un salto de más de 2,5 s × velocidad).
 * Saltar con la barra no marca lo salteado.
 */
export default {
  name: 'DetalleVideo',
  components: { IconoEstado, Encuesta, Preguntas },
  props: {
    /** Video del catálogo. */
    video: { type: Object, required: true },
  },
  data() {
    return {
      /** Estado compartido de la página. */
      estado: estado,
      /** Velocidades del reproductor. */
      VELOCIDADES: VELOCIDADES,
      /** Texto para invitados. */
      LINEA_INVITADO: LINEA_INVITADO,
      /** Último `currentTime` registrado (null después de un salto). */
      ultimo: null,
      /** true si ya se mostró la encuesta en esta apertura (o ya estaba respondida). */
      preguntado: !!estado.encuestas[this.video.codigo],
      /** Encuesta abierta: { por_voto } o null. */
      encuesta: null,
      /** Posición desde la que se retomó (muestra el cartel), o null. */
      retomar_desde: null,
      /** Timer que esconde el cartel de "Seguís desde". */
      timer_retomar: null,
      /** Mensaje si el video no se pudo abrir. */
      error_video: '',
    }
  },
  computed: {
    /**
     * Carpeta del video.
     * @returns {Object|null}
     */
    carpeta() {
      return carpeta_por_nro(this.video.carpeta)
    },
    /**
     * Número visible del video (ej. "1.29").
     * @returns {string}
     */
    numero() {
      return numero_de(this.video.codigo)
    },
    /**
     * Video siguiente en el orden del guion, o null.
     * @returns {Object|null}
     */
    siguiente() {
      return this.estado.videos[this.video.i + 1] || null
    },
    /**
     * Relacionados que existen en el catálogo.
     * @returns {Array<Object>}
     */
    relacionados() {
      /** Videos encontrados. */
      const salida = []
      ;(this.video.relacionados || []).forEach(function (codigo) {
        /** Video relacionado. */
        const v = video_por_codigo(codigo)
        if (v) {
          salida.push(v)
        }
      })
      return salida
    },
    /**
     * Transcripción (llega con el detalle).
     * @returns {string}
     */
    transcripcion() {
      /** Detalle del video. */
      const d = this.estado.detalles[this.video.codigo]
      return d ? d.transcripcion : ''
    },
    /**
     * Voto actual: 1, -1 o 0.
     * @returns {number}
     */
    voto() {
      return this.estado.votos[this.video.codigo] || 0
    },
    /**
     * Fracción vista de este video.
     * @returns {number}
     */
    fraccion_actual() {
      return fraccion(this.video)
    },
    /**
     * true si este video cuenta como terminado.
     * @returns {boolean}
     */
    hecho() {
      return terminado(this.video)
    },
  },
  mounted() {
    /** Elemento <video>. */
    const el = this.$refs.video
    el.playbackRate = this.estado.vel
    el.play().catch(function () {
      /* El navegador puede frenar la reproducción automática: el usuario toca play. */
    })
    document.addEventListener('keydown', this.al_tocar_tecla)
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.al_tocar_tecla)
    clearTimeout(this.timer_retomar)
    /* Lo último que se vio de este video sale ya, antes de pasar al otro. */
    this.registrar()
    enviar_progreso()
  },
  methods: {
    mmss: mmss,
    recortar: recortar,
    /**
     * Duración a usar para "llegó al final": la del catálogo y, si no vino, la del archivo.
     * Es método y no computed porque `$refs` no es reactivo.
     * @returns {number}
     */
    duracion_total() {
      /** Elemento <video>. */
      const el = this.$refs.video
      return this.video.duracion || (el && el.duration) || 0
    },
    /**
     * @param {Object} v
     * @returns {number}
     */
    fraccion_de(v) {
      return this.estado.usuario ? fraccion(v) : 0
    },
    /**
     * @param {Object} v
     * @returns {boolean}
     */
    terminado_de(v) {
      return !!this.estado.usuario && terminado(v)
    },
    /**
     * Con los metadatos: velocidad y, si hay sesión y el video quedó a la mitad, retomar desde
     * la última posición (con el cartel y "Empezar de cero").
     * @returns {void}
     */
    al_cargar_metadatos() {
      /** Elemento <video>. */
      const el = this.$refs.video
      if (!el) {
        return
      }
      el.playbackRate = this.estado.vel
      /** Progreso guardado. */
      const p = this.estado.progreso[this.video.codigo]
      if (this.estado.usuario && p && !terminado(this.video) && p.posicion > 5 && p.posicion < el.duration - 8) {
        el.currentTime = p.posicion
        this.retomar_desde = p.posicion
        this.timer_retomar = setTimeout(() => {
          this.retomar_desde = null
        }, 6000)
      }
    },
    /**
     * Vuelve el video al principio.
     * @returns {void}
     */
    empezar_de_cero() {
      /** Elemento <video>. */
      const el = this.$refs.video
      clearTimeout(this.timer_retomar)
      this.retomar_desde = null
      if (el) {
        el.currentTime = 0
        el.play().catch(function () {})
      }
    },
    /**
     * Registra lo reproducido desde el último `timeupdate` (la regla del prototipo) y abre la
     * encuesta a 3 s del final.
     * @returns {void}
     */
    registrar() {
      /** Elemento <video>. */
      const el = this.$refs.video
      if (!el) {
        return
      }
      /** Posición actual. */
      const t = el.currentTime
      if (!el.paused && this.ultimo != null && t >= this.ultimo && t - this.ultimo < 2.5 * el.playbackRate) {
        registrar_tramo(this.video, this.ultimo, t)
      }
      this.ultimo = t
      anotar_posicion(this.video, t)
      /** Duración del video. */
      const duracion = this.duracion_total()
      if (duracion && t >= duracion - 3 && !this.preguntado) {
        this.preguntar(false)
      }
    },
    /**
     * Al pausar: registra y manda lo pendiente.
     * @returns {void}
     */
    al_pausar() {
      this.registrar()
      enviar_progreso()
    },
    /**
     * Al terminar: registra, manda y, si todavía no se preguntó, abre la encuesta.
     * @returns {void}
     */
    al_terminar() {
      this.registrar()
      enviar_progreso()
      if (!this.preguntado) {
        this.preguntar(false)
      }
    },
    /**
     * Abre la encuesta (solo con sesión: sin sesión no se guarda nada).
     * @param {boolean} por_voto true si la abrió un 👎.
     * @returns {void}
     */
    preguntar(por_voto) {
      if (!this.estado.usuario || this.encuesta) {
        return
      }
      this.preguntado = true
      this.encuesta = { por_voto: por_voto }
    },
    /**
     * Cambia la velocidad del reproductor.
     * @param {number} x
     * @returns {void}
     */
    cambiar_velocidad(x) {
      elegir_velocidad(x)
      if (this.$refs.video) {
        this.$refs.video.playbackRate = x
      }
    },
    /**
     * 👍 / 👎. Un 👎 abre la encuesta si todavía no se respondió (como el prototipo).
     * @param {1|-1} valor
     * @returns {void}
     */
    votar_video(valor) {
      /** Voto que quedó. */
      const nuevo = votar(this.video.codigo, valor)
      if (nuevo === -1 && !this.estado.encuestas[this.video.codigo]) {
        this.preguntar(true)
      }
    },
    /**
     * Abre otro video.
     * @param {string} codigo
     * @returns {void}
     */
    abrir(codigo) {
      abrir_video(codigo)
    },
    /**
     * Barra espaciadora = play / pausa, salvo que se esté escribiendo o sobre un control.
     * @param {KeyboardEvent} ev
     * @returns {void}
     */
    al_tocar_tecla(ev) {
      if (ev.key !== ' ' || !this.$refs.video) {
        return
      }
      /** Elemento con el foco. */
      const destino = ev.target
      if (destino && destino.closest && destino.closest('input, textarea, button, select, summary, video, a, [contenteditable], .encuesta')) {
        return
      }
      ev.preventDefault()
      /** Elemento <video>. */
      const el = this.$refs.video
      if (el.paused) {
        el.play().catch(function () {})
      } else {
        el.pause()
      }
    },
  },
}
</script>
