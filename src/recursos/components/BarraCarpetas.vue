<template>
  <aside class="barra-lateral" aria-label="Carpetas de videos" :inert="oculta || null">
    <div class="buscar">
      <input
        v-model="consulta"
        type="search"
        placeholder="¿Qué querés aprender? (ej. imagen, cheque, lista)"
        aria-label="Buscar videos"
        @input="al_escribir"
      />
    </div>

    <div ref="lista" class="lista-carpetas">
      <div
        v-for="c in carpetas_visibles"
        :key="c.nro"
        class="carpeta"
        :class="{ abierta: c.abierta, completa: c.completa }"
      >
        <!-- Cabecera de la carpeta: número (o check), nombre, n/N y la barra verde. -->
        <button
          type="button"
          class="cab"
          :aria-expanded="c.abierta ? 'true' : 'false'"
          @click="alternar(c.nro)"
        >
          <span class="nro" aria-hidden="true">{{ c.completa ? '✓' : c.nro }}</span>
          <span class="nombre">{{ c.nombre }}</span>
          <span class="cuenta">
            <template v-if="con_sesion">{{ c.av.hechos }}/{{ c.av.n }}</template>
            <span class="flecha" aria-hidden="true">▶</span>
          </span>
          <!-- Cuántos videos y cuántos minutos de material hay en la carpeta (siempre de TODA la
               carpeta; con búsqueda activa, además, cuántos coinciden). Va en un renglón propio debajo
               del nombre: así no le saca ancho al nombre en el cajón del teléfono. -->
          <span class="meta">{{ texto_meta(c) }}</span>
          <span v-if="con_sesion" class="mini">
            <span class="barra"><i :style="{ width: (c.av.pct * 100).toFixed(1) + '%' }" /></span>
            <span class="pct">{{ Math.round(c.av.pct * 100) }} %</span>
          </span>
        </button>

        <!-- Videos de la carpeta, con sus secciones. Plegada no se dibuja. -->
        <div v-if="c.abierta" class="videos">
          <template v-for="fila in c.filas" :key="fila.clave">
            <div v-if="fila.seccion" class="seccion">{{ fila.seccion }}</div>
            <button
              v-else
              type="button"
              class="vid"
              :class="{ sel: fila.video.codigo === estado.actual }"
              :aria-current="fila.video.codigo === estado.actual ? 'true' : null"
              @click="abrir(fila.video.codigo)"
            >
              <icono-estado :fraccion="fraccion_de(fila.video)" :hecho="terminado_de(fila.video)" />
              <span class="t">
                {{ fila.video.titulo }}
                <small v-if="resto_de(fila.video)">{{ resto_de(fila.video) }}</small>
              </span>
              <span class="dur">{{ mmss(fila.video.duracion) }}</span>
            </button>
          </template>
        </div>
      </div>

      <div v-if="!carpetas_visibles.length && consulta_normalizada" class="vacio">
        No hay videos con "{{ consulta.trim() }}".
      </div>
    </div>
  </aside>
</template>

<script>
import IconoEstado from './IconoEstado.vue'
import {
  estado,
  avance,
  fraccion,
  terminado,
  abrir_video,
  alternar_carpeta,
  cargar_indice,
} from '../estado'
import { mmss, minutos_texto, normalizar, numero_de } from '../utiles'

/**
 * Barra de carpetas: el buscador y la lista de carpetas desplegables con sus videos, como la
 * del prototipo (número, nombre, barra verde, n/N, check al completar; adentro las secciones y
 * cada video con su ícono de estado y "seguís en m:ss").
 *
 * En ≤ 860 px es el cajón que abre el botón "Carpetas" de la cabecera.
 */
export default {
  name: 'BarraCarpetas',
  components: { IconoEstado },
  props: {
    /** true cuando es un cajón cerrado: se vuelve `inert` para que el teclado no entre ahí. */
    oculta: { type: Boolean, default: false },
  },
  data() {
    return {
      /** Estado compartido de la página. */
      estado: estado,
      /** Texto del buscador. */
      consulta: '',
    }
  },
  computed: {
    /**
     * true si hay sesión (sin sesión no se muestra avance: decisión 2 de Lucas).
     * @returns {boolean}
     */
    con_sesion() {
      return !!this.estado.usuario
    },
    /**
     * Búsqueda en minúsculas y sin acentos.
     * @returns {string}
     */
    consulta_normalizada() {
      return normalizar(this.consulta.trim())
    },
    /**
     * Texto en el que se busca cada video: número, título y "para qué" (normalizados una vez
     * por catálogo). La transcripción se suma aparte, cuando llega el índice.
     * @returns {Object<string, string>}
     */
    textos_de_busqueda() {
      /** Texto por código. */
      const textos = {}
      this.estado.videos.forEach(function (v) {
        textos[v.codigo] = normalizar(numero_de(v.codigo) + ' ' + v.titulo + ' ' + v.para_que)
      })
      return textos
    },
    /**
     * Carpetas a dibujar, cada una con su avance y sus filas (secciones y videos). Con búsqueda
     * se muestran solo las carpetas con coincidencias, desplegadas.
     * @returns {Array<Object>}
     */
    carpetas_visibles() {
      /** Búsqueda normalizada. */
      const q = this.consulta_normalizada
      /** Textos por código. */
      const textos = this.textos_de_busqueda
      /** Índice de transcripciones (null hasta que llega). */
      const indice = this.estado.indice
      /** Videos por carpeta, en orden. */
      const por_carpeta = {}
      this.estado.videos.forEach(function (v) {
        if (!por_carpeta[v.carpeta]) {
          por_carpeta[v.carpeta] = []
        }
        por_carpeta[v.carpeta].push(v)
      })
      /**
       * Indica si un video coincide con la búsqueda.
       * @param {Object} v
       * @returns {boolean}
       */
      const coincide = function (v) {
        if (!q) {
          return true
        }
        return textos[v.codigo].indexOf(q) !== -1 || (!!indice && !!indice[v.codigo] && indice[v.codigo].indexOf(q) !== -1)
      }
      /** Resultado. */
      const salida = []
      this.estado.carpetas.forEach((c) => {
        /** Todos los videos de la carpeta (el avance se mide sobre todos). */
        const todos = por_carpeta[c.nro] || []
        /** Los que coinciden con la búsqueda. */
        const vs = todos.filter(coincide)
        if (!vs.length) {
          return
        }
        /** Avance de la carpeta. */
        const av = avance(todos)
        /** Filas: un título por cada cambio de sección, y los videos. */
        const filas = []
        /** Sección de la fila anterior. */
        let seccion = null
        vs.forEach(function (v) {
          if (v.seccion !== seccion) {
            seccion = v.seccion
            if (seccion) {
              filas.push({ clave: 's-' + v.codigo, seccion: seccion })
            }
          }
          filas.push({ clave: v.codigo, video: v })
        })
        salida.push({
          nro: c.nro,
          nombre: c.nombre,
          av: av,
          segundos: todos.reduce(function (suma, v) {
            return suma + (Number(v.duracion) || 0)
          }, 0),
          completa: this.con_sesion && av.n > 0 && av.hechos === av.n,
          abierta: q ? true : !!this.estado.abiertas[c.nro],
          coinciden: vs.length,
          filas: filas,
        })
      })
      return salida
    },
  },
  watch: {
    /** Al abrir otro video, la lista lo trae a la vista (como `pintarCarpetas()` del prototipo). */
    'estado.actual'() {
      this.$nextTick(() => {
        /** Video seleccionado en la lista. */
        const sel = this.$refs.lista ? this.$refs.lista.querySelector('.vid.sel') : null
        if (sel && typeof sel.scrollIntoView === 'function') {
          sel.scrollIntoView({ block: 'nearest' })
        }
      })
    },
  },
  methods: {
    mmss: mmss,
    /**
     * Renglón de datos de una carpeta: "12 videos · 18 min" ("1 video" en singular; con búsqueda,
     * "2 de 12 videos · 18 min"). Los minutos suman TODOS los videos de la carpeta, no solo los que
     * coinciden con lo que se busca.
     * @param {Object} c Carpeta de `carpetas_visibles`.
     * @returns {string}
     */
    texto_meta(c) {
      /** Cantidad de videos de la carpeta. */
      const n = c.av.n
      /** "12 videos" / "2 de 12 videos". */
      const videos = (this.consulta_normalizada ? c.coinciden + ' de ' : '') + n + (n === 1 ? ' video' : ' videos')
      /** Minutos de material. */
      const minutos = minutos_texto(c.segundos)
      return minutos ? videos + ' · ' + minutos : videos
    },
    /**
     * @param {Object} v
     * @returns {number}
     */
    fraccion_de(v) {
      return this.con_sesion ? fraccion(v) : 0
    },
    /**
     * @param {Object} v
     * @returns {boolean}
     */
    terminado_de(v) {
      return this.con_sesion && terminado(v)
    },
    /**
     * Renglón chico debajo del título: "Visto" o "42 % · seguís en 1:15".
     * @param {Object} v
     * @returns {string}
     */
    resto_de(v) {
      if (!this.con_sesion) {
        return ''
      }
      if (terminado(v)) {
        return 'Visto'
      }
      /** Fracción vista. */
      const f = fraccion(v)
      if (f <= 0.01) {
        return ''
      }
      /** Progreso del video. */
      const p = this.estado.progreso[v.codigo]
      return Math.round(f * 100) + ' % · seguís en ' + mmss(p ? p.posicion : 0)
    },
    /**
     * @param {number} nro
     * @returns {void}
     */
    alternar(nro) {
      alternar_carpeta(nro)
    },
    /**
     * @param {string} codigo
     * @returns {void}
     */
    abrir(codigo) {
      abrir_video(codigo)
    },
    /**
     * La primera vez que se escribe se pide el índice de transcripciones (§2, C2).
     * @returns {void}
     */
    al_escribir() {
      if (this.consulta.trim()) {
        cargar_indice()
      }
    },
  },
}
</script>
