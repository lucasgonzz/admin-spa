<template>
  <!-- v-if en la RAÍZ: si `RESENAS` quedara vacío, este componente no pinta un solo
       píxel. No hay estado vacío, no hay "próximamente", no hay esqueleto gris: la página
       pasa de la sección anterior a la siguiente como si esta sección no existiera. Fue
       el estado real de la sección hasta el 11/9/2026 (ver el bloque de RESENAS). -->
  <section v-if="hay_resenas" ref="seccion" class="demo-resenas">
    <div ref="grupo" class="demo-resenas__grupo" :style="estilo_grupo">
      <p class="demo-resenas__rotulo demo-resenas__paso">Lo que dicen en Google</p>

      <!-- El promedio y la cantidad son los de la FICHA de Google (PROMEDIO_GOOGLE /
           CANTIDAD_GOOGLE), no los del array de abajo: hay una reseña de 5 estrellas sin
           texto que cuenta para Google y acá no tiene tarjeta que mostrar. -->
      <div class="demo-resenas__promedio demo-resenas__paso">
        <span class="demo-resenas__promedio-numero">{{ promedio_texto }}</span>
        <span
          class="demo-resenas__estrellas demo-resenas__estrellas--grandes"
          role="img"
          :aria-label="promedio_texto + ' de 5 estrellas'"
        >
          <span class="demo-resenas__capa" aria-hidden="true">
            <svg v-for="n in 5" :key="'b' + n" class="demo-resenas__estrella" viewBox="0 0 24 24">
              <path :d="ESTRELLA" />
            </svg>
          </span>
          <span
            class="demo-resenas__capa demo-resenas__capa--llena"
            :style="{ width: ancho_estrellas(PROMEDIO_GOOGLE) }"
            aria-hidden="true"
          >
            <svg v-for="n in 5" :key="'l' + n" class="demo-resenas__estrella" viewBox="0 0 24 24">
              <path :d="ESTRELLA" />
            </svg>
          </span>
        </span>
        <span class="demo-resenas__promedio-cantidad">
          {{ CANTIDAD_GOOGLE }} {{ CANTIDAD_GOOGLE === 1 ? 'reseña' : 'reseñas' }}
        </span>
      </div>

      <ul class="demo-resenas__lista">
        <li
          v-for="(resena, indice) in resenas"
          :key="indice"
          class="demo-resenas__tarjeta demo-resenas__paso"
        >
          <span
            class="demo-resenas__estrellas"
            role="img"
            :aria-label="resena.estrellas + ' de 5 estrellas'"
          >
            <span class="demo-resenas__capa" aria-hidden="true">
              <svg v-for="n in 5" :key="'b' + n" class="demo-resenas__estrella" viewBox="0 0 24 24">
                <path :d="ESTRELLA" />
              </svg>
            </span>
            <span
              class="demo-resenas__capa demo-resenas__capa--llena"
              :style="{ width: ancho_estrellas(resena.estrellas) }"
              aria-hidden="true"
            >
              <svg v-for="n in 5" :key="'l' + n" class="demo-resenas__estrella" viewBox="0 0 24 24">
                <path :d="ESTRELLA" />
              </svg>
            </span>
          </span>

          <p class="demo-resenas__texto">{{ resena.texto }}</p>

          <!-- El negocio va sólo cuando agrega algo: si el autor de la reseña ES el
               negocio (Innovate Materiales firma como Innovate Materiales), repetirlo
               abajo es leer dos veces lo mismo. -->
          <p class="demo-resenas__autor">
            <span class="demo-resenas__autor-nombre">{{ resena.autor }}</span>
            <span
              v-if="resena.negocio && resena.negocio !== resena.autor"
              class="demo-resenas__autor-negocio"
            >{{ resena.negocio }}</span>
          </p>
        </li>
      </ul>

      <p v-if="PERFIL_GOOGLE" class="demo-resenas__pie demo-resenas__paso">
        <a
          class="demo-resenas__enlace"
          :href="PERFIL_GOOGLE"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver todas en Google
          <i class="bi bi-arrow-up-right" aria-hidden="true"></i>
        </a>
      </p>

      <!-- ── Los testimonios en video (11/9/2026, misión experiencia-landing) ─────────
           Tres cortes verticales de Mariel, en la MISMA sección que las reseñas: son la
           misma cosa (gente real contando cómo le fue), dicha de otra forma. Van después
           del enlace a Google y no antes, para que el bloque de Google cierre con su link
           y el de video abra con su propio subtítulo.

           Cada <video> baja SOLO los metadatos (`preload="metadata"`: los tres MP4 tienen
           el `moov` al principio, medido, así que son ~35 KB por video y no los 8-11 MB
           del archivo); no hay autoplay ni `muted`: se escuchan cuando el lead les da
           play, y `playsinline` es para que en iPhone no se abran a pantalla completa.
           El `#t=0.001` del `src` es para que Safari pinte el primer cuadro: sin él, iOS
           muestra un rectángulo negro con el botón de play, que sobre el tema claro es
           una mancha. -->
      <div class="demo-resenas__testimonios">
        <p class="demo-resenas__testimonios-titulo demo-resenas__paso">
          Mariel, de Innovate Materiales, cuenta cómo era antes.
        </p>
        <ul class="demo-resenas__videos">
          <li
            v-for="testimonio in testimonios"
            :key="testimonio.url"
            class="demo-resenas__video demo-resenas__paso"
          >
            <p class="demo-resenas__video-frase">{{ testimonio.frase }}</p>
            <video
              class="demo-resenas__video-reproductor"
              :src="testimonio.url + '#t=0.001'"
              :aria-label="'Testimonio de Mariel, de Innovate Materiales: ' + testimonio.frase"
              preload="metadata"
              controls
              playsinline
            ></video>
            <p class="demo-resenas__video-autor">Mariel · Innovate Materiales</p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script>
/**
 * 🔴 LOS DATOS SON LOS DE LA FICHA REAL DE GOOGLE, Y NO SE INVENTAN.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Hasta el 11/9/2026 esta sección estaba VACÍA a propósito: no existía ninguna fuente de
 * reseñas en ningún repo, se le pidió el perfil a Lucas y hasta que llegó el array quedó
 * en `[]` y la sección no renderizaba nada (el `v-if` de la raíz sigue ahí por si alguna
 * vez vuelve a quedar vacío). Ese día Lucas pasó el link de la ficha de Google Business
 * de ComercioCity (misión experiencia-landing) y de ahí se copió todo lo de abajo.
 *
 * ── DE DÓNDE SALE CADA COSA ───────────────────────────────────────────────────────────
 *
 * - `PERFIL_GOOGLE`: la URL pública de la ficha. Es a donde va "Ver todas en Google".
 *
 * - `RESENAS`: una entrada por reseña CON TEXTO, copiada TAL CUAL de la ficha, con su
 *   ortografía, sus signos repetidos y sus emojis. Son cuatro.
 *
 * - `PROMEDIO_GOOGLE` y `CANTIDAD_GOOGLE`: el promedio y la cantidad que muestra la ficha
 *   (5,0 · 5 reseñas). 🔴 Van como constantes explícitas y NO derivadas del array, y esto
 *   es al revés de lo que decía este comentario hasta el 11/9: la ficha tiene CINCO
 *   reseñas y acá hay CUATRO tarjetas, porque la quinta (Rafael Fossaceca, 5 estrellas)
 *   no tiene texto -- cuenta para el promedio y la cantidad de Google, pero no hay nada
 *   que mostrar en una tarjeta. Derivar "4 reseñas" del array sería contradecir lo que el
 *   lead ve al tocar el link. Si se suma o se saca una reseña, hay que refrescar los DOS
 *   números a mano mirando la ficha.
 *
 * 🔴 Cada campo se copia de la ficha real. No se redacta, no se "mejora la redacción", no
 * se completa el `negocio` a ojo (va sólo cuando el propio autor lo dice o es el nombre del
 * comercio) y no se inventa una reseña para llenar la grilla: son testimonios de personas
 * reales y fabricar uno solo es fabricar el testimonio de alguien.
 *
 * Si algún día Google publica la ficha por API, esto se reemplaza por una carga desde el
 * backend; hasta entonces es una copia a mano y hay que refrescarla a mano.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */
const PERFIL_GOOGLE = 'https://maps.app.goo.gl/xQqz5B2BurGHxXyU7'

/** Promedio de la ficha de Google, tal como lo muestra Google. Ver el bloque de arriba. */
const PROMEDIO_GOOGLE = 5

/** Cantidad de reseñas de la ficha (incluye la que no tiene texto). Ver el bloque de arriba. */
const CANTIDAD_GOOGLE = 5

/**
 * Las cuatro reseñas con texto, textuales. `negocio` es `null` cuando el autor no lo dice:
 * no se adivina.
 *
 * @type {Array<{autor: string, negocio: string|null, estrellas: number, texto: string}>}
 */
const RESENAS = [
  {
    autor: 'Innovate Materiales',
    negocio: 'Innovate Materiales',
    estrellas: 5,
    texto:
      'Excelente el programa, súper completo y la atención de Lucas un 10! Enseñan súper ' +
      'claro a usarlo, paciencia extra a los emprendedores que tenemos todo desordenado🤭, ' +
      'incluso fueron adaptando muchas cosas que pedíamos específicas para nuestro rubro! ' +
      'Todo personalizado, ya vamos 1 año y sigue igual la atención y el soporte cuando no ' +
      'entendes algo! Realmente el negocio no habría progresado sin el orden que no dio ' +
      'esto! Fue una decisión acertada😃',
  },
  {
    autor: 'Elkri ticon',
    negocio: null,
    estrellas: 5,
    texto:
      'Lo estoy usando en mi local hace varios años, me ayudo mucho a ordenar un montón de ' +
      'datos sueltos, llevo al día el stock, devoluciones, facturación, compras.\n' +
      'Aparte, Lucas(genio), siempre estuvo ayudándonos desde el principio hasta que le ' +
      'agarramos la mano. Siempre sumando también nuevas herramientas que le hemos ' +
      'solicitado, y respondiendo siempre en las complicaciones y dudas que han aparecido. ' +
      'Aparte de varias herramientas más.',
  },
  {
    autor: 'Sergio Srebernich',
    negocio: null,
    estrellas: 5,
    texto:
      'Excelente Sistema!! Me cambio la vida para mejor!! Ya que en esta bendita económica ' +
      'variable que tenemos, @ComercioCity me lo soluciono! Muy recomendable.',
  },
  {
    autor: 'Secure Point - Del Viso -',
    negocio: 'Secure Point',
    estrellas: 5,
    texto:
      'Muy buen sistema de gestión financiera, muy sencillo de entender y usar ! Lo ' +
      'recomendamos!!',
  },
]

/**
 * Los testimonios en video: tres cortes verticales (9:16) de Mariel, de Innovate
 * Materiales, filmados para la demo y subidos al bucket público de R2 (misión
 * experiencia-landing, 11/9/2026). Son externos a propósito: pesan entre 8 y 11 MB cada
 * uno y no van dentro del repo. La `frase` es el rótulo corto que va arriba de cada uno,
 * una cita de lo que Mariel dice en ese corte.
 *
 * @type {Array<{frase: string, url: string}>}
 */
const TESTIMONIOS = [
  { frase: 'Un lío total.', url: 'https://videos.comerciocity.store/test-mariel-01-lio-total.mp4' },
  {
    frase: 'Hubo una persona detrás.',
    url: 'https://videos.comerciocity.store/test-mariel-06-bots-vs-persona.mp4',
  },
  { frase: 'Aliviada.', url: 'https://videos.comerciocity.store/test-mariel-09-aliviada.mp4' },
]

/** Path de una estrella de 5 puntas en una caja de 24×24. */
const ESTRELLA =
  'M12 2.4l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.42l-5.88 3.09 1.12-6.55L2.48 9.32l6.58-.96L12 2.4z'

/** Dónde arranca la aparición, en fracción del alto del viewport. */
const ARRANQUE = 0.85
/** Cuánto scroll (en fracción de viewport) tarda en terminar de entrar. */
const RECORRIDO = 0.45
/** Cuánto se abre el abanico del escalonado. */
const ABANICO = 0.5

/**
 * @param {number} valor
 * @returns {number} `valor` recortado a [0,1].
 */
function acotar(valor) {
  return valor < 0 ? 0 : valor > 1 ? 1 : valor
}

/**
 * Las reseñas de Google de ComercioCity, y los testimonios en video de Mariel.
 *
 * Ver el bloque de arriba: los datos son los de la ficha real. Si `RESENAS` quedara vacío
 * la sección entera no renderiza nada (v-if en la raíz), y todo lo que sigue es el
 * maquetado que se enciende solo cuando tiene entradas.
 *
 * La entrada de cada renglón es función pura del progreso del bloque (no un
 * IntersectionObserver de una sola vía, que no tiene marcha atrás al subir y ya costó tres
 * correctivos en esta página). El IntersectionObserver que sí hay tiene otro trabajo:
 * apagar el rAF cuando la sección no se ve.
 */
export default {
  name: 'SeccionResenas',

  data() {
    return {
      p: 0,
      objetivo: 0,
      raf_id: null,
      ultimo_ts: 0,
      scroll_target: null,
      observador: null,
      a_la_vista: false,
      /** Estado ESTÁTICO, no una versión suave (demo_experiencia.md §3.18-bis). */
      movimiento_reducido:
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ESTRELLA: ESTRELLA,
      PERFIL_GOOGLE: PERFIL_GOOGLE,
      PROMEDIO_GOOGLE: PROMEDIO_GOOGLE,
      CANTIDAD_GOOGLE: CANTIDAD_GOOGLE,
    }
  },

  computed: {
    /* Los dos arrays van por `computed` y no por `data`, como en SeccionClientes.vue: lo
       que entra a data() lo vuelve Vue un proxy reactivo, y son constantes de módulo. */

    /** @returns {Array} */
    resenas() {
      return RESENAS
    },

    /** @returns {Array} */
    testimonios() {
      return TESTIMONIOS
    },

    /** @returns {boolean} */
    hay_resenas() {
      return RESENAS.length > 0
    },

    /**
     * @returns {string} El promedio de la ficha con una decimal y coma, como se escribe en
     *   castellano ("5,0"). Sale de PROMEDIO_GOOGLE, no del array: ver el bloque de arriba.
     */
    promedio_texto() {
      return PROMEDIO_GOOGLE.toFixed(1).replace('.', ',')
    },

    /** @returns {Object|null} */
    estilo_grupo() {
      return this.movimiento_reducido ? null : { '--p': this.p.toFixed(4) }
    },
  },

  mounted() {
    /* Con el array vacío no hay raíz renderizada: nada que medir ni a qué engancharse. */
    if (!this.hay_resenas) {
      return
    }

    this.escalonar(this.$refs.grupo)

    if (this.movimiento_reducido) {
      return
    }

    this.scroll_target = this.encontrar_ancestro_scroll()
    this.scroll_target.addEventListener('scroll', this.on_scroll, { passive: true })
    window.addEventListener('resize', this.on_scroll, { passive: true })
    document.addEventListener('visibilitychange', this.on_visibilidad)

    if (typeof IntersectionObserver === 'function') {
      this.observador = new IntersectionObserver(this.on_interseccion, { rootMargin: '15% 0px' })
      this.observador.observe(this.$refs.seccion)
    } else {
      this.a_la_vista = true
    }

    this.calcular_objetivo()
    this.p = this.objetivo
  },

  beforeUnmount() {
    this.cancelar_bucle()

    if (this.observador) {
      this.observador.disconnect()
      this.observador = null
    }

    if (this.scroll_target) {
      this.scroll_target.removeEventListener('scroll', this.on_scroll)
      this.scroll_target = null
    }

    window.removeEventListener('resize', this.on_scroll)
    document.removeEventListener('visibilitychange', this.on_visibilidad)
  },

  methods: {
    /**
     * Ancho de la capa de estrellas llenas, en porcentaje.
     *
     * @param {number} valor Estrellas, de 0 a 5.
     * @returns {string}
     */
    ancho_estrellas(valor) {
      const acotado = Math.max(0, Math.min(5, Number(valor) || 0))

      return (acotado / 5) * 100 + '%'
    },

    /**
     * Escribe la demora del escalonado en cada renglón, una sola vez y directo al DOM: es
     * un valor que no cambia nunca y como `:style` entraría al diff de cada frame.
     *
     * @param {Element} grupo
     * @returns {void}
     */
    escalonar(grupo) {
      if (!grupo) {
        return
      }

      const pasos = grupo.querySelectorAll('.demo-resenas__paso')

      for (let i = 0; i < pasos.length; i++) {
        const demora = pasos.length > 1 ? (i / (pasos.length - 1)) * ABANICO : 0
        pasos[i].style.setProperty('--d', demora.toFixed(4))
      }
    },

    /**
     * Sube por los ancestros hasta el que realmente scrollea: en este admin es
     * <main class="app-main-scroll">, y un listener en `window` nunca recibiría su scroll.
     *
     * @returns {Window|Element}
     */
    encontrar_ancestro_scroll() {
      let nodo = this.$refs.seccion ? this.$refs.seccion.parentElement : null

      while (nodo && nodo !== document.body) {
        const overflow_y = window.getComputedStyle(nodo).overflowY

        if (overflow_y === 'auto' || overflow_y === 'scroll') {
          return nodo
        }

        nodo = nodo.parentElement
      }

      return window
    },

    /** @returns {void} */
    on_scroll() {
      this.arrancar_bucle()
    },

    /**
     * @param {IntersectionObserverEntry[]} entradas
     * @returns {void}
     */
    on_interseccion(entradas) {
      this.a_la_vista = entradas[entradas.length - 1].isIntersecting

      if (this.a_la_vista && !document.hidden) {
        this.arrancar_bucle()
      } else {
        this.cancelar_bucle()
      }
    },

    /** @returns {void} */
    on_visibilidad() {
      if (document.hidden) {
        this.cancelar_bucle()
      } else if (this.a_la_vista) {
        this.arrancar_bucle()
      }
    },

    /** @returns {void} */
    arrancar_bucle() {
      if (this.raf_id !== null || !this.a_la_vista || document.hidden) {
        return
      }

      this.ultimo_ts = 0
      this.raf_id = window.requestAnimationFrame(this.animar)
    },

    /** @returns {void} */
    cancelar_bucle() {
      if (this.raf_id !== null) {
        window.cancelAnimationFrame(this.raf_id)
        this.raf_id = null
      }
    },

    /**
     * @param {number} ts
     * @returns {void}
     */
    animar(ts) {
      this.raf_id = null

      if (!this.$refs.seccion) {
        return
      }

      const delta_ms = this.ultimo_ts ? Math.min(100, ts - this.ultimo_ts) : 16.67
      this.ultimo_ts = ts

      this.calcular_objetivo()

      const factor = 1 - Math.pow(1 - 0.14, delta_ms / 16.67)
      const diferencia = this.objetivo - this.p

      if (Math.abs(diferencia) < 0.0005) {
        /* Llegó: se asienta y el bucle CORTA, o queda un rAF girando con el scroll quieto. */
        if (this.p !== this.objetivo) {
          this.p = this.objetivo
        }

        return
      }

      this.p = this.p + diferencia * factor
      this.raf_id = window.requestAnimationFrame(this.animar)
    },

    /** @returns {void} */
    calcular_objetivo() {
      if (!this.$refs.grupo) {
        return
      }

      const vh = window.innerHeight

      this.objetivo = acotar(
        (vh * ARRANQUE - this.$refs.grupo.getBoundingClientRect().top) / (vh * RECORRIDO),
      )
    },
  },
}
</script>

<style scoped>
.demo-resenas {
  box-sizing: border-box;
  padding: clamp(64px, 11vh, 130px) clamp(16px, 4vw, 48px);
}

.demo-resenas *,
.demo-resenas *::before,
.demo-resenas *::after {
  box-sizing: border-box;
}

.demo-resenas__grupo {
  --p: 1;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  text-align: center;
}

/* El avance de cada renglón sale del progreso del bloque (--p, un solo binding por frame)
   menos su propia demora (--d, escrita una vez en mounted()). */
.demo-resenas__paso {
  --d: 0;
  --avance: clamp(0, calc((var(--p, 1) - var(--d, 0)) / 0.45), 1);
  opacity: var(--avance);
  transform: translateY(calc((1 - var(--avance)) * 18px));
}

.demo-resenas__rotulo {
  margin: 0 0 clamp(16px, 2.4vw, 24px);
  font-size: clamp(0.8rem, 1.2vw, 0.9rem);
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--demo-color-texto-suave);
}

.demo-resenas__promedio {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
}

.demo-resenas__promedio-numero {
  font-size: clamp(2rem, 4.6vw, 2.8rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.025em;
  color: var(--demo-color-texto);
}

.demo-resenas__promedio-cantidad {
  font-size: clamp(0.9rem, 1.3vw, 1rem);
  color: var(--demo-color-texto-suave);
}

/* Dos capas de cinco estrellas, una encima de la otra: la de abajo vacía y la de arriba
   llena, recortada por ancho. Así una fracción (4,7 de 5) se dibuja exacta sin depender de
   que la tipografía tenga el glifo ★ -- Geist puede no tenerlo, y el fallback cambiaría el
   tamaño de la estrella según el sistema del lead. */
.demo-resenas__estrellas {
  position: relative;
  display: inline-block;
  /* El dorado de una reseña, que NO es --demo-color-naranja: el naranja de marca es un
     acento puntual único y esto se repite cinco veces por tarjeta. */
  color: #e8a317;
  line-height: 0;
}

.demo-resenas__capa {
  display: block;
  white-space: nowrap;
}

.demo-resenas__capa--llena {
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
}

.demo-resenas__estrella {
  width: 1em;
  height: 1em;
  font-size: 1.05rem;
  fill: currentColor;
}

/* La capa vacía es la misma estrella, apagada: se ve el hueco de lo que falta.
   🔴 Antes era rgba(28, 35, 51, 0.16) -gris casi negro-, invisible sobre el fondo
   oscuro nuevo (gris oscuro sobre fondo oscuro no se distingue). Ahora es el mismo
   blanco de --demo-color-texto pero a una fracción de opacidad: se sigue leyendo como
   "hueco" -mucho más tenue que la estrella llena- pero sin desaparecer. */
.demo-resenas__capa:not(.demo-resenas__capa--llena) .demo-resenas__estrella {
  fill: rgba(244, 247, 253, 0.18);
}

.demo-resenas__estrellas--grandes .demo-resenas__estrella {
  font-size: 1.35rem;
}

.demo-resenas__lista {
  list-style: none;
  margin: clamp(28px, 4vw, 44px) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(12px, 1.6vw, 18px);
  text-align: left;
}

/* Superficie del tema (misión paleta-oscura-experiencia, 10/9/2026), mismo criterio que
   .demo-nueva-era__pilar: es contenido real (la reseña), no un chip de cliente, así que
   usa --demo-color-superficie en vez de blanco. Se ve desde el 11/9/2026, cuando entraron
   las reseñas reales. */
.demo-resenas__tarjeta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: clamp(16px, 2vw, 22px);
  border: 1px solid var(--demo-color-borde-superficie);
  border-radius: 14px;
  background: var(--demo-color-superficie);
}

.demo-resenas__texto {
  margin: 0;
  font-size: clamp(0.98rem, 1.35vw, 1.08rem);
  line-height: 1.55;
  color: var(--demo-color-texto-suave);
  /* Una de las reseñas trae un salto de línea escrito por su autor: se respeta, como el
     resto del texto. `pre-line` muestra ese salto y sigue envolviendo lo demás. */
  white-space: pre-line;
}

.demo-resenas__autor {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.demo-resenas__autor-nombre {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--demo-color-texto);
}

.demo-resenas__autor-negocio {
  font-size: 0.82rem;
  color: var(--demo-color-texto-suave);
}

.demo-resenas__pie {
  margin: clamp(24px, 3vw, 32px) 0 0;
}

.demo-resenas__enlace {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--demo-color-azul);
  text-decoration: none;
}

.demo-resenas__enlace:hover,
.demo-resenas__enlace:focus-visible {
  text-decoration: underline;
}

/* ── Los testimonios en video ──────────────────────────────────────────────────────────
   Tres cortes verticales 9:16. Todo el color sale de las variables --demo-color-*, así
   que el bloque se ve bien en los dos temas sin una regla por tema.

   🔴 En teléfono van APILADOS, uno por fila, y no en un carrusel horizontal -- y no es
   por gusto: el avance guiado de la página (avance-guiado.js) corta el `touchmove`
   nativo con preventDefault cuando hay una sección vecina a la que ir, y sólo deja pasar
   el gesto dentro de un scroller VERTICAL propio (`dentro_de_scroll_propio()` mira
   `overflowY`). Un scroller horizontal quedaría trabado según dónde esté parado el lead.
   Apilados, cada video mide como mucho 270px de ancho (480 de alto) y entran de a uno
   con su rótulo en cualquier teléfono de 640px de alto para arriba. */
.demo-resenas__testimonios {
  margin: clamp(56px, 8vw, 96px) 0 0;
}

/* Sin `max-width`: es una sola oración y en escritorio entra en una línea; donde no
   entra (teléfono), `balance` reparte las dos líneas en vez de dejar una palabra sola. */
.demo-resenas__testimonios-titulo {
  margin: 0 auto clamp(20px, 3vw, 32px);
  font-size: clamp(1.15rem, 2.2vw, 1.5rem);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.015em;
  color: var(--demo-color-texto);
  text-wrap: balance;
}

.demo-resenas__videos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  gap: clamp(28px, 4vw, 40px);
}

/* Ancho tope de 270px: un vertical más ancho que eso, en escritorio, se vuelve una
   columna de 500px de alto que domina la pantalla y le saca el aire a la sección. */
.demo-resenas__video {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 270px;
}

/* La frase de Mariel, como rótulo: es lo que se lee antes de decidir darle play. */
.demo-resenas__video-frase {
  margin: 0;
  font-size: clamp(1rem, 1.4vw, 1.12rem);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--demo-color-texto);
}

/* `aspect-ratio` reserva el alto antes de que lleguen los metadatos: sin eso la grilla
   salta cuando cada video descubre su tamaño. El fondo es el de superficie del tema, así
   que mientras no hay cuadro que mostrar el rectángulo se lee como una tarjeta más, no
   como un agujero negro. */
.demo-resenas__video-reproductor {
  display: block;
  width: 100%;
  aspect-ratio: 9 / 16;
  border-radius: 16px;
  border: 1px solid var(--demo-color-borde-superficie);
  background: var(--demo-color-superficie);
  object-fit: cover;
}

.demo-resenas__video-autor {
  margin: 0;
  font-size: 0.82rem;
  color: var(--demo-color-texto-suave);
}

/* Tablet y para arriba: las tarjetas en DOS columnas y los tres videos en fila (a 768px
   cada columna de video da ~225px, que es un vertical cómodo). En teléfono va todo
   apilado.

   Dos columnas y no tres para las reseñas, y es por el dato: son CUATRO (ver RESENAS).
   Con tres columnas la cuarta queda sola en una segunda fila, pegada a la izquierda, y
   se lee como si faltara algo -- visto en la página real el 11/9/2026. En 2×2 el orden
   del array deja las dos largas arriba y las dos cortas abajo, así que las filas quedan
   parejas. Si algún día son seis, tres columnas vuelven a cerrar. */
@media (min-width: 768px) {
  .demo-resenas__lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .demo-resenas__videos {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(16px, 2.4vw, 28px);
  }
}

/* 🔴 Estado ESTÁTICO, no una versión suave. */
@media (prefers-reduced-motion: reduce) {
  .demo-resenas__paso {
    opacity: 1;
    transform: none;
  }
}
</style>
