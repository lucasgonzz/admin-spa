<template>
  <div class="centro" :class="{ cajon: estado.cajon }">
    <cabecera />

    <!-- Aviso de arriba: entrada fallida, sesión cerrada. -->
    <div v-if="estado.aviso" class="aviso" :class="estado.aviso.tipo" role="status">
      <span class="cuerpo-aviso">{{ estado.aviso.texto }}</span>
      <button type="button" class="cerrar" aria-label="Cerrar aviso" @click="cerrar_aviso">×</button>
    </div>

    <!-- Le respondieron una pregunta (`respuestas_nuevas` de `recursos/yo`). -->
    <div v-if="videos_con_respuesta.length" class="aviso info" role="status">
      <span class="cuerpo-aviso">
        <span>💬 {{ texto_respuestas }}</span>
        <button
          v-for="v in videos_con_respuesta"
          :key="v.codigo"
          type="button"
          class="chip-video"
          @click="abrir(v.codigo)"
        >
          {{ v.titulo }}
        </button>
      </span>
    </div>

    <main class="principal">
      <barra-carpetas :oculta="angosto && !estado.cajon" />
      <div class="velo" aria-hidden="true" @click="estado.cajon = false" />
      <section ref="detalle" class="detalle">
        <div v-if="estado.cargando" class="vacio">Cargando el centro de recursos…</div>
        <div v-else-if="estado.error_carga" class="vacio">
          No pudimos cargar el centro de recursos. Revisá la conexión y probá de nuevo.
          <br />
          <button type="button" @click="reintentar">Reintentar</button>
        </div>
        <div v-else-if="!estado.videos.length" class="vacio">
          Todavía no hay videos publicados. Volvé a mirar en unos días.
        </div>
        <div v-else-if="video_actual" class="vacio">{{ video_actual.titulo }}</div>
        <div v-else class="vacio">Elegí un video de la izquierda.</div>
      </section>
    </main>

    <div class="toast" :class="{ on: !!estado.toast }" role="status" aria-live="polite">{{ estado.toast }}</div>
  </div>
</template>

<script>
import Cabecera from './components/Cabecera.vue'
import BarraCarpetas from './components/BarraCarpetas.vue'
import {
  estado,
  iniciar,
  reintentar_carga,
  abrir_video,
  video_por_codigo,
  enviar_progreso,
  cerrar_aviso,
} from './estado'

/** Ancho a partir del cual la barra de carpetas pasa a cajón (el mismo del CSS). */
const CONSULTA_ANGOSTO = '(max-width: 860px)'

/**
 * Página del centro de recursos (misión centro-de-recursos-clientes, 13/10/2026): cabecera,
 * barra de carpetas y el video abierto. Reproduce el prototipo aprobado por Lucas con los datos
 * del admin (contrato C2 del plan).
 */
export default {
  name: 'CentroRecursos',
  components: { Cabecera, BarraCarpetas },
  data() {
    return {
      /** Estado compartido de la página. */
      estado: estado,
      /** true en ≤ 860 px (la barra de carpetas es un cajón). */
      angosto: false,
      /** MediaQueryList del ancho angosto. */
      consulta_angosto: null,
    }
  },
  computed: {
    /**
     * Video abierto.
     * @returns {Object|null}
     */
    video_actual() {
      return this.estado.actual ? video_por_codigo(this.estado.actual) : null
    },
    /**
     * Videos con respuestas nuevas a preguntas propias, sin repetir.
     * @returns {Array<Object>}
     */
    videos_con_respuesta() {
      /** Códigos ya agregados. */
      const vistos = {}
      /** Videos encontrados. */
      const salida = []
      this.estado.respuestas_nuevas.forEach(function (r) {
        /** Video de la respuesta. */
        const v = r && video_por_codigo(r.codigo)
        if (v && !vistos[v.codigo]) {
          vistos[v.codigo] = true
          salida.push(v)
        }
      })
      return salida
    },
    /**
     * Texto del aviso de respuestas nuevas.
     * @returns {string}
     */
    texto_respuestas() {
      /** Cantidad de respuestas. */
      const n = this.estado.respuestas_nuevas.length
      return n === 1 ? 'Te respondimos una pregunta:' : 'Te respondimos ' + n + ' preguntas:'
    },
  },
  watch: {
    /** Al abrir otro video, el detalle vuelve arriba (como el prototipo). */
    'estado.actual'() {
      if (this.$refs.detalle) {
        this.$refs.detalle.scrollTop = 0
      }
    },
  },
  mounted() {
    if (window.matchMedia) {
      this.consulta_angosto = window.matchMedia(CONSULTA_ANGOSTO)
      this.angosto = this.consulta_angosto.matches
      this.consulta_angosto.addEventListener('change', this.al_cambiar_ancho)
    }
    document.addEventListener('visibilitychange', this.al_cambiar_visibilidad)
    window.addEventListener('pagehide', this.al_cerrar)
    document.addEventListener('keydown', this.al_tocar_tecla)
    iniciar()
  },
  beforeUnmount() {
    if (this.consulta_angosto) {
      this.consulta_angosto.removeEventListener('change', this.al_cambiar_ancho)
    }
    document.removeEventListener('visibilitychange', this.al_cambiar_visibilidad)
    window.removeEventListener('pagehide', this.al_cerrar)
    document.removeEventListener('keydown', this.al_tocar_tecla)
  },
  methods: {
    cerrar_aviso: cerrar_aviso,
    /**
     * @param {string} codigo
     * @returns {void}
     */
    abrir(codigo) {
      abrir_video(codigo)
    },
    /**
     * Reintenta la carga del catálogo.
     * @returns {void}
     */
    reintentar() {
      reintentar_carga()
    },
    /**
     * @param {MediaQueryListEvent} ev
     * @returns {void}
     */
    al_cambiar_ancho(ev) {
      this.angosto = ev.matches
      if (!ev.matches) {
        this.estado.cajon = false
      }
    },
    /**
     * Al ocultarse la pestaña (cambiar de app en el celular, minimizar) sale lo pendiente: es
     * el último momento seguro en el teléfono.
     * @returns {void}
     */
    al_cambiar_visibilidad() {
      if (document.visibilityState === 'hidden') {
        enviar_progreso({ keepalive: true })
      }
    },
    /**
     * Al cerrar la pestaña sale lo pendiente con `keepalive` (§5.1).
     * @returns {void}
     */
    al_cerrar() {
      enviar_progreso({ keepalive: true })
    },
    /**
     * Escape cierra el cajón de carpetas.
     * @param {KeyboardEvent} ev
     * @returns {void}
     */
    al_tocar_tecla(ev) {
      if (ev.key === 'Escape' && this.estado.cajon) {
        this.estado.cajon = false
      }
    },
  },
}
</script>
