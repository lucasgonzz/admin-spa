<template>
  <aside class="barra-lateral" aria-label="Carpetas de videos" :inert="oculta || null">
    <div class="buscar">
      <input
        v-model="consulta"
        type="search"
        placeholder="¿Qué querés aprender? (ej. escanear factura, cheque, lista)"
        aria-label="Buscar videos"
        @input="al_escribir"
        @keydown.enter="al_apretar_enter"
        @keydown.esc="al_apretar_escape"
      />
      <!-- Cuántos videos encontró. Está siempre en la página (vacía cuando no se busca nada) porque un
           aviso `aria-live` solo se anuncia si ya existía antes de cambiar su texto. -->
      <p class="busq-estado" role="status" aria-live="polite">{{ texto_de_estado }}</p>
      <!-- Ninguno tiene todas las palabras: se muestran los que más se parecen. -->
      <p v-if="busqueda.resultados.length && !busqueda.completo" class="busq-aviso">
        Ninguno tiene todas las palabras: estos son los que más se parecen.
      </p>
      <!-- El índice de transcripciones todavía no llegó: se busca ya por título y "para qué". -->
      <p v-if="buscando && estado.indice_cargando" class="busq-aviso espera">
        Buscando también dentro de los videos…
      </p>
    </div>

    <div ref="lista" class="lista-carpetas">
      <!-- Con algo escrito: lista plana de resultados, del más al menos relevante. -->
      <template v-if="buscando">
        <div v-if="!filas_de_resultados.length" class="vacio">
          <template v-if="estado.buscador">
            <p>No encontramos videos con «{{ consulta.trim() }}».</p>
            <p class="sugerencia">Probá con menos palabras o con otra palabra (por ejemplo «factura» en vez de «boleta»).</p>
            <button type="button" @click="limpiar">Volver a las carpetas</button>
          </template>
          <!-- Se escribió antes de que llegara el catálogo: todavía no hay dónde buscar. -->
          <p v-else>Cargando los videos…</p>
        </div>
        <template v-else>
          <button
            v-for="r in filas_visibles"
            :key="r.codigo"
            type="button"
            class="vid res"
            :class="{ sel: r.codigo === estado.actual }"
            :aria-current="r.codigo === estado.actual ? 'true' : null"
            @click="abrir(r.codigo)"
          >
            <icono-estado :fraccion="fraccion_de(r.video)" :hecho="terminado_de(r.video)" />
            <span class="t">
              <!-- Título con las palabras encontradas resaltadas: se dibuja con v-for (nunca v-html),
                   porque el texto viene de la base y no puede interpretarse como HTML. -->
              <span class="res-titulo"><template v-for="(p, i) in r.titulo_partes" :key="i"><mark v-if="p.marca">{{ p.texto }}</mark><template v-else>{{ p.texto }}</template></template></span>
              <small v-if="r.ubicacion_partes.length" class="res-donde"><template v-for="(p, i) in r.ubicacion_partes" :key="i"><mark v-if="p.marca">{{ p.texto }}</mark><template v-else>{{ p.texto }}</template></template></small>
              <small v-if="r.fragmento_partes.length" class="res-fragmento"><template v-for="(p, i) in r.fragmento_partes" :key="i"><mark v-if="p.marca">{{ p.texto }}</mark><template v-else>{{ p.texto }}</template></template></small>
              <small v-if="resto_de(r.video)">{{ resto_de(r.video) }}</small>
            </span>
            <span class="dur">{{ mmss(r.video.duracion) }}</span>
          </button>
          <button v-if="quedan_por_mostrar" type="button" class="mas-resultados" @click="mostrar_mas">
            Mostrar {{ cuantos_mas }} más
          </button>
        </template>
      </template>

      <!-- Sin nada escrito: las carpetas, como siempre. -->
      <template v-else>
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
            <!-- Cuántos videos y cuántos minutos de material hay en la carpeta. Va en un renglón propio
                 debajo del nombre: así no le saca ancho al nombre en el cajón del teléfono. -->
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
      </template>
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
  video_por_codigo,
} from '../estado'
import { buscar } from '../buscador'
import { mmss, minutos_texto } from '../utiles'

/** Cuántos resultados se muestran de entrada, y cuántos más se suman cada vez que se toca "Mostrar más". */
const RESULTADOS_POR_TANDA = 30

/**
 * Barra de carpetas: el buscador y la lista de carpetas desplegables con sus videos, como la
 * del prototipo (número, nombre, barra verde, n/N, check al completar; adentro las secciones y
 * cada video con su ícono de estado y "seguís en m:ss").
 *
 * Con algo escrito en el buscador la lista de carpetas se reemplaza por una lista plana de
 * resultados ordenados por relevancia (`buscador.js`): el título con lo encontrado resaltado, la
 * carpeta y un fragmento de donde aparece. Sin nada escrito, las carpetas quedan como siempre.
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
      /** Cuántos resultados se muestran (crece de a `RESULTADOS_POR_TANDA` con "Mostrar más"). */
      limite: RESULTADOS_POR_TANDA,
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
     * true si hay algo escrito en el buscador: entonces se muestran resultados en lugar de carpetas.
     * @returns {boolean}
     */
    buscando() {
      return this.consulta.trim() !== ''
    },
    /**
     * Resultado de buscar lo escrito (`{ resultados, completo, palabras }`). Se vuelve a calcular con
     * cada tecla y cuando el buscador se rearma porque llegó el índice de transcripciones.
     * @returns {{ resultados: Array<Object>, completo: boolean, palabras: Array<string> }}
     */
    busqueda() {
      if (!this.buscando || !this.estado.buscador) {
        return { resultados: [], completo: true, palabras: [] }
      }
      return buscar(this.estado.buscador, this.consulta)
    },
    /**
     * Resultados listos para dibujar: cada uno con su video del catálogo (duración y avance), que el
     * buscador no devuelve. Un resultado cuyo video ya no está en el catálogo se descarta.
     * @returns {Array<Object>}
     */
    filas_de_resultados() {
      /** Filas armadas. */
      const filas = []
      this.busqueda.resultados.forEach(function (r) {
        /** Video del catálogo. */
        const video = video_por_codigo(r.codigo)
        if (video) {
          filas.push({
            codigo: r.codigo,
            video: video,
            titulo_partes: r.titulo_partes,
            ubicacion_partes: r.ubicacion_partes,
            fragmento_partes: r.fragmento_partes,
          })
        }
      })
      return filas
    },
    /**
     * Los resultados que se ven ahora (los primeros `limite`).
     * @returns {Array<Object>}
     */
    filas_visibles() {
      return this.filas_de_resultados.slice(0, this.limite)
    },
    /**
     * true si hay más resultados que los que se ven.
     * @returns {boolean}
     */
    quedan_por_mostrar() {
      return this.filas_de_resultados.length > this.limite
    },
    /**
     * Cuántos resultados suma el próximo "Mostrar más".
     * @returns {number}
     */
    cuantos_mas() {
      return Math.min(RESULTADOS_POR_TANDA, this.filas_de_resultados.length - this.limite)
    },
    /**
     * Línea de estado de la búsqueda, para leer en pantalla y por lector de pantalla: "12 videos
     * encontrados", "1 video encontrado" o "No se encontraron videos". Vacía sin búsqueda.
     * @returns {string}
     */
    texto_de_estado() {
      // Sin buscador (el catálogo todavía no llegó) no hay nada que contar: la lista dice "Cargando…".
      if (!this.buscando || !this.estado.buscador) {
        return ''
      }
      /** Cantidad de resultados. */
      const n = this.filas_de_resultados.length
      if (!n) {
        return 'No se encontraron videos.'
      }
      if (!this.busqueda.completo) {
        return n === 1 ? '1 video que se parece.' : n + ' videos que se parecen.'
      }
      return n === 1 ? '1 video encontrado.' : n + ' videos encontrados.'
    },
    /**
     * Carpetas a dibujar, cada una con su avance y sus filas (secciones y videos). Es la lista de
     * siempre; con algo escrito en el buscador no se usa (se muestran resultados).
     * @returns {Array<Object>}
     */
    carpetas_visibles() {
      /** Videos por carpeta, en orden. */
      const por_carpeta = {}
      this.estado.videos.forEach(function (v) {
        if (!por_carpeta[v.carpeta]) {
          por_carpeta[v.carpeta] = []
        }
        por_carpeta[v.carpeta].push(v)
      })
      /** Resultado. */
      const salida = []
      this.estado.carpetas.forEach((c) => {
        /** Todos los videos de la carpeta (el avance se mide sobre todos). */
        const vs = por_carpeta[c.nro] || []
        if (!vs.length) {
          return
        }
        /** Avance de la carpeta. */
        const av = avance(vs)
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
          segundos: vs.reduce(function (suma, v) {
            return suma + (Number(v.duracion) || 0)
          }, 0),
          completa: this.con_sesion && av.n > 0 && av.hechos === av.n,
          abierta: !!this.estado.abiertas[c.nro],
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
    /** Cada búsqueda nueva empieza con la primera tanda, desde arriba de la lista. */
    consulta() {
      this.limite = RESULTADOS_POR_TANDA
      if (this.$refs.lista) {
        this.$refs.lista.scrollTop = 0
      }
    },
  },
  methods: {
    mmss: mmss,
    /**
     * Renglón de datos de una carpeta: "12 videos · 18 min" ("1 video" en singular). Los minutos suman
     * todos los videos de la carpeta.
     * @param {Object} c Carpeta de `carpetas_visibles`.
     * @returns {string}
     */
    texto_meta(c) {
      /** Cantidad de videos de la carpeta. */
      const n = c.av.n
      /** "12 videos". */
      const videos = n + (n === 1 ? ' video' : ' videos')
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
    /**
     * Enter en el buscador abre el primer resultado. No hace nada si se está componiendo un carácter
     * con un teclado de teléfono (ahí Enter confirma la palabra, no la búsqueda).
     * @param {KeyboardEvent} ev
     * @returns {void}
     */
    al_apretar_enter(ev) {
      if (ev.isComposing || !this.buscando) {
        return
      }
      ev.preventDefault()
      /** Primer resultado. */
      const primero = this.filas_de_resultados[0]
      if (primero) {
        this.abrir(primero.codigo)
      }
    },
    /**
     * Escape limpia la búsqueda. Con el buscador vacío no hace nada propio: el evento sigue su camino
     * y la página lo usa para cerrar el cajón de carpetas.
     * @param {KeyboardEvent} ev
     * @returns {void}
     */
    al_apretar_escape(ev) {
      if (!this.consulta) {
        return
      }
      // Sin esto el mismo Escape también cerraría el cajón, y el buscador de tipo "search" lo borraría dos veces.
      ev.preventDefault()
      ev.stopPropagation()
      this.limpiar()
    },
    /**
     * Borra lo escrito y vuelve a las carpetas.
     * @returns {void}
     */
    limpiar() {
      this.consulta = ''
    },
    /**
     * Suma otra tanda de resultados.
     * @returns {void}
     */
    mostrar_mas() {
      this.limite += RESULTADOS_POR_TANDA
    },
  },
}
</script>
