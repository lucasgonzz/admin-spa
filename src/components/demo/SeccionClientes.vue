<template>
  <section
    ref="seccion"
    class="demo-clientes"
    :style="movimiento_reducido ? null : { minHeight: recorrido_vh + 'vh' }"
  >
    <!-- 🔴 Punto de enganche del avance guiado, y NO es decorativo: sin esto el gesto
         deposita al lead en el BORDE de la sección, y ahí no hay nada que ver. Medido en
         la página real el 10/9/2026: el primer momento entra entre progreso 0,0 y 0,07
         (ver MOMENTOS), así que el borde de la sección es una pantalla en blanco durante
         los primeros 176px de recorrido.

         Es el mismo mecanismo que FondoSeccionSticky.vue usa con su prop `snap_progreso`
         (default 0,42): un div vacío plantado a `(100% - 100vh) * fracción` del tope, que
         es lo que el navegador alinea. La cuenta sale sola para cualquier `recorrido_vh`.

         La clase `demo-fondo-seccion__snap` es el CONTRATO de destinos de esta página:
         avance-guiado.js la busca por SELECTOR_DESTINOS. El estilo lo pone ESTE archivo
         (ver el <style>) porque el de FondoSeccionSticky es scoped y su atributo data-v-*
         no llega hasta acá -- el cubo hace exactamente lo mismo, por el mismo motivo. -->
    <div
      v-if="!movimiento_reducido"
      class="demo-fondo-seccion__snap demo-clientes__ancla"
      aria-hidden="true"
    ></div>

    <div class="demo-clientes__pin">
      <div class="demo-clientes__lavado" aria-hidden="true"></div>

      <!-- Momento 1: el número. Es lo único que hay en pantalla, a propósito. -->
      <div
        class="demo-clientes__momento demo-clientes__momento--numero"
        :class="{ 'demo-clientes__momento--apagado': apagado(0) }"
        :style="estilo_momento(0)"
      >
        <p class="demo-clientes__antetitulo">No sos el primero en dar este paso.</p>
        <p class="demo-clientes__titulo">
          <span class="demo-clientes__titulo-cuerpo">{{ cantidad }} negocios</span>
          <span class="demo-clientes__titulo-remate">ya trabajan así.</span>
        </p>
        <p class="demo-clientes__pie">
          Ferreterías, distribuidoras, jugueterías, kioscos, joyerías.
        </p>
      </div>

      <!-- Momento 2: la pared de logos, que se arma con el scroll. -->
      <div
        class="demo-clientes__momento demo-clientes__momento--pared"
        :class="{ 'demo-clientes__momento--apagado': apagado(1) }"
        :style="estilo_momento(1)"
      >
        <p class="demo-clientes__rotulo">Algunos de ellos</p>
        <!-- Las casillas NO llevan ningún binding: la demora del escalonado se escribe una
             sola vez en mounted(), directo al DOM. Con `:style` acá, los 35 <li> entrarían
             al diff de Vue en cada frame del scroll (2.160 comparaciones por segundo en un
             teléfono) para escribir siempre el mismo número. Ver escalonar(). -->
        <ul ref="pared" class="demo-clientes__pared" :style="estilo_pared">
          <li v-for="cliente in logos" :key="cliente.id" class="demo-clientes__casilla">
            <img
              class="demo-clientes__logo"
              :src="cliente.logo"
              :alt="cliente.nombre"
              loading="lazy"
              decoding="async"
            />
          </li>
        </ul>
      </div>

      <!-- Momento 3: las tiendas online, que están abiertas ahora mismo. -->
      <div
        class="demo-clientes__momento demo-clientes__momento--tiendas"
        :class="{ 'demo-clientes__momento--apagado': apagado(2) }"
        :style="estilo_momento(2)"
      >
        <p class="demo-clientes__rotulo">Y no solo en el mostrador</p>
        <p class="demo-clientes__subtitulo">
          {{ tiendas.length }} de ellos también venden por internet.
        </p>
        <p class="demo-clientes__pie">
          Su propia tienda, con su dominio y el mismo catálogo del sistema. Están abiertas
          ahora mismo.
        </p>
        <ul ref="tiendas" class="demo-clientes__tiendas" :style="estilo_tiendas">
          <li v-for="tienda in tiendas" :key="tienda.id" class="demo-clientes__tienda">
            <a
              class="demo-clientes__tienda-link"
              :href="tienda.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                class="demo-clientes__tienda-logo"
                :src="tienda.logo"
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span class="demo-clientes__tienda-datos">
                <span class="demo-clientes__tienda-nombre">{{ tienda.nombre }}</span>
                <span class="demo-clientes__tienda-rubro">{{ tienda.rubro }}</span>
              </span>
              <i class="bi bi-arrow-up-right demo-clientes__tienda-flecha" aria-hidden="true"></i>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script>
import { logos_clientes, tiendas_comerciocity } from './clientes'

/**
 * 🔴 Cuánta gente usa esto, y por qué NO dice "50".
 *
 * Medido el 10/9/2026 contra el admin de producción: la tabla `clients` tiene 47 filas,
 * todas activas. Sacando `DEMO`, el registro de Lucas y `mayorista-de-pesca` (promovido
 * pero nunca instalado) quedan **44 negocios reales en el admin**, más los cuatro que
 * operan por fuera (Sr. Imperio, Desire, Feitoamao, Rosmar): **48 o 49 en total**.
 *
 * Lucas creía que eran 50 y pidió expresamente que se chequeara. "Casi 50" es lo más
 * fuerte que se puede afirmar sin mentir. Si alguien lo va a subir a 50, que primero
 * vuelva a contar la tabla -- este comentario existe para que ese chequeo sea de un
 * minuto y no de una tarde.
 */
const CANTIDAD = 'Casi 50'

/**
 * Ventanas de cada momento sobre el progreso [0,1] de la sección.
 *
 * `entra` y `sale` no se solapan entre momentos vecinos a propósito: el momento 1 termina
 * de irse en 0.26 y el 2 recién empieza a aparecer en 0.26. Con las ventanas montadas se
 * ven dos textos encimados en el cruce, que es exactamente lo que una página con esta
 * estética no puede permitirse.
 *
 * `deriva` es el tramo en el que el bloque se desplaza en vertical, y `hasta` dónde llega:
 * -1 es "pasa de largo" (entra desde abajo y se va por arriba, como una diapositiva que
 * cruza), 0 es "llega y se queda". El último momento se queda: es el que el lead está
 * leyendo cuando la sección suelta el scroll.
 */
const MOMENTOS = [
  { entra: [0.0, 0.07], sale: [0.2, 0.26], deriva: [0.0, 0.26], hasta: -1 },
  { entra: [0.26, 0.33], sale: [0.62, 0.68], deriva: [0.26, 0.68], hasta: -1 },
  { entra: [0.68, 0.76], sale: null, deriva: [0.68, 0.88], hasta: 0 },
]

/** Tramo del progreso en el que se arma la pared de logos. */
const PARED = [0.3, 0.6]
/** Tramo del progreso en el que entran las tarjetas de tienda. */
const TIENDAS = [0.74, 0.95]
/** Cuánto se abre el abanico del escalonado, en fracción del tramo de su lista. */
const ABANICO = 0.52

/**
 * @param {number} valor
 * @returns {number} `valor` recortado a [0,1].
 */
function acotar(valor) {
  return valor < 0 ? 0 : valor > 1 ? 1 : valor
}

/**
 * Rampa lineal acotada: 0 antes de `desde`, 1 después de `hasta`.
 *
 * @param {number} p
 * @param {number} desde
 * @param {number} hasta
 * @returns {number}
 */
function rampa(p, desde, hasta) {
  return hasta === desde ? (p >= hasta ? 1 : 0) : acotar((p - desde) / (hasta - desde))
}

/**
 * Smoothstep. Le saca las esquinas a la rampa: sin esto la aparición arranca y frena de
 * golpe, y con el scroll quieto en el borde de una ventana se nota.
 *
 * @param {number} t
 * @returns {number}
 */
function suavizar(t) {
  return t * t * (3 - 2 * t)
}

/**
 * La sección de clientes de la página de experiencia: casi 50 negocios reales, sus logos
 * y las tiendas online que ya están abiertas.
 *
 * Referencia visual que dio Lucas (10/9/2026): apple.com/la/mac-mini -- movida por el
 * scroll, no por un reloj. Tres momentos y nada más: el número, la pared de logos, las
 * tiendas. La estética de esta página es de restricción ("Apple no significa más
 * animaciones: es lo contrario"), así que cada efecto de acá tiene un solo trabajo:
 * opacidad + desplazamiento vertical en los momentos, y un escalonado suave en las dos
 * listas. Nada gira, nada rebota, nada tiene sombra que se mueva.
 *
 * 🔴 Va SUELTA en el scroll de la página, no adentro de un FondoSeccionSticky: trae su
 * propio pin. Dos position:sticky anidados se despegan en momentos distintos y dejan un
 * tramo de scroll sin contenido -- es un bug real que ya costó dos correctivos en esta
 * misma página (grupos 322/325, ver el comentario de cabecera de FondoSeccionSticky.vue).
 *
 * El progreso se mide igual que en FondoSeccionSticky (rect de la <section>, que no es la
 * que queda pinneada) y se persigue con amortiguación exponencial, no se toma crudo: una
 * rueda de mouse en Windows entrega escalones de ~100px y sin amortiguar la escena salta
 * de pose en pose ("parece que sucede todo en seis fps", Lucas, 4/8/2026).
 */
export default {
  name: 'SeccionClientes',

  props: {
    /**
     * Alto total de la sección en vh: 100vh de pantalla + el resto de recorrido pinneado.
     * 380 son ~93vh de scroll por momento, que es lo que tarda en leerse cada uno sin que
     * se sienta ni atropellado ni vacío. Es prop y no constante para que se pueda calibrar
     * desde ScrollDolor.vue sin tocar este archivo.
     */
    recorrido_vh: {
      type: Number,
      default: 380,
    },
  },

  data() {
    return {
      /** Progreso [0,1] renderizado, el que se ve. */
      progreso: 0,
      /** Progreso [0,1] crudo del rect, al que persigue el de arriba. */
      progreso_objetivo: 0,
      /** id del requestAnimationFrame en vuelo, o null. Es el candado del bucle. */
      raf_id: null,
      /** Timestamp del frame anterior, para escalar la amortiguación por el delta real. */
      ultimo_ts: 0,
      /** El ancestro que realmente scrollea (en este admin, <main class="app-main-scroll">). */
      scroll_target: null,
      /** IntersectionObserver que apaga el bucle cuando la sección sale de pantalla. */
      observador: null,
      /** true mientras la sección toca el viewport. */
      a_la_vista: false,
      /**
       * Estado ESTÁTICO, no una versión suave (restricción escrita: demo_experiencia.md
       * §3.18-bis). Con la preferencia puesta no hay pin, no hay bucle y no hay listeners:
       * los tres momentos quedan uno abajo del otro, completos y quietos.
       */
      movimiento_reducido:
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }
  },

  computed: {
    /* Los tres van por `computed` y no por `data` a propósito: lo que entra a data() lo
       convierte Vue en un proxy reactivo, y estos son constantes de un import -- 35 objetos
       proxificados para nada. Un computed devuelve el array crudo. */

    /** @returns {string} */
    cantidad() {
      return CANTIDAD
    },

    /** @returns {Array} */
    logos() {
      return logos_clientes
    },

    /** @returns {Array} */
    tiendas() {
      return tiendas_comerciocity
    },

    /**
     * Progreso local de la pared, para el escalonado de las casillas.
     * @returns {Object}
     */
    estilo_pared() {
      if (this.movimiento_reducido) {
        return null
      }

      return { '--p': rampa(this.progreso, PARED[0], PARED[1]).toFixed(4) }
    },

    /**
     * Progreso local de las tarjetas de tienda.
     * @returns {Object}
     */
    estilo_tiendas() {
      if (this.movimiento_reducido) {
        return null
      }

      return { '--p': rampa(this.progreso, TIENDAS[0], TIENDAS[1]).toFixed(4) }
    },
  },

  mounted() {
    this.escalonar(this.$refs.pared)
    this.escalonar(this.$refs.tiendas)

    if (this.movimiento_reducido) {
      return
    }

    this.scroll_target = this.encontrar_ancestro_scroll()
    this.scroll_target.addEventListener('scroll', this.on_scroll, { passive: true })
    window.addEventListener('resize', this.on_scroll, { passive: true })
    document.addEventListener('visibilitychange', this.on_visibilidad)

    if (typeof IntersectionObserver === 'function') {
      this.observador = new IntersectionObserver(this.on_interseccion, {
        /* Un poco de margen para que el bucle ya esté corriendo cuando el primer píxel de
           la sección entra: arrancarlo justo en el borde deja el primer frame en 0. */
        rootMargin: '15% 0px',
      })
      this.observador.observe(this.$refs.seccion)
    } else {
      this.a_la_vista = true
    }

    /* Primer valor sin animar: si la página se recarga con el scroll a mitad de la sección
       (o el lead vuelve con el botón de atrás), la escena tiene que aparecer donde
       corresponde, no barrer desde 0 hasta ahí. */
    this.calcular_objetivo()
    this.progreso = this.progreso_objetivo
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
     * Opacidad y desplazamiento de un momento, como variables CSS.
     *
     * @param {number} indice
     * @returns {Object|null} null bajo prefers-reduced-motion (el CSS ya deja todo visible).
     */
    estilo_momento(indice) {
      if (this.movimiento_reducido) {
        return null
      }

      const momento = MOMENTOS[indice]
      const deriva = rampa(this.progreso, momento.deriva[0], momento.deriva[1])

      return {
        '--o': this.opacidad(indice).toFixed(4),
        '--y': (1 + (momento.hasta - 1) * suavizar(deriva)).toFixed(4),
      }
    },

    /**
     * @param {number} indice
     * @returns {number} Opacidad [0,1] del momento.
     */
    opacidad(indice) {
      const momento = MOMENTOS[indice]
      const entra = suavizar(rampa(this.progreso, momento.entra[0], momento.entra[1]))
      const sale = momento.sale
        ? suavizar(rampa(this.progreso, momento.sale[0], momento.sale[1]))
        : 0

      return Math.min(entra, 1 - sale)
    },

    /**
     * Un momento invisible sigue ocupando toda la pantalla: `visibility: hidden` es lo que
     * lo saca del árbol de accesibilidad y del test de clics, para que las tarjetas de
     * tienda no queden tapadas por un bloque transparente.
     *
     * @param {number} indice
     * @returns {boolean}
     */
    apagado(indice) {
      return !this.movimiento_reducido && this.opacidad(indice) < 0.02
    },

    /**
     * Escribe la demora del escalonado de cada hijo, una sola vez, directo al DOM.
     *
     * No pasa por el render de Vue porque es un valor que no cambia nunca: dejarlo como
     * `:style` metería los 35 <li> de la pared en el diff de cada frame del scroll. La
     * lista es estática (viene de un import), así que no hace falta rehacerlo en updated().
     *
     * @param {Element} lista
     * @returns {void}
     */
    escalonar(lista) {
      if (!lista || !lista.children) {
        return
      }

      const total = lista.children.length

      for (let i = 0; i < total; i++) {
        const demora = total > 1 ? (i / (total - 1)) * ABANICO : 0
        lista.children[i].style.setProperty('--d', demora.toFixed(4))
      }
    },

    /**
     * Sube por los ancestros hasta el que realmente scrollea. En este admin es
     * <main class="app-main-scroll"> -- html/body/#app son height:100% + overflow:hidden,
     * así que un listener en `window` nunca recibe el scroll: no burbujea hasta ahí y el
     * progreso quedaría congelado en el valor del primer frame. No se hardcodea el selector
     * para no atar el componente a App.vue: si no hay ninguno, cae a `window`.
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

    /**
     * @returns {void}
     */
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

    /**
     * Una pestaña en segundo plano no dispara rAF, pero sí puede quedar con uno pedido y
     * entregar un salto enorme al volver. Se corta explícito y se retoma al volver.
     *
     * @returns {void}
     */
    on_visibilidad() {
      if (document.hidden) {
        this.cancelar_bucle()
      } else if (this.a_la_vista) {
        this.arrancar_bucle()
      }
    },

    /**
     * @returns {void}
     */
    arrancar_bucle() {
      if (this.raf_id !== null || !this.a_la_vista || document.hidden) {
        return
      }

      this.ultimo_ts = 0
      this.raf_id = window.requestAnimationFrame(this.animar)
    },

    /**
     * @returns {void}
     */
    cancelar_bucle() {
      if (this.raf_id !== null) {
        window.cancelAnimationFrame(this.raf_id)
        this.raf_id = null
      }
    },

    /**
     * Un frame: recalcula el objetivo, acerca el progreso renderizado y decide si sigue.
     *
     * @param {number} ts
     * @returns {void}
     */
    animar(ts) {
      this.raf_id = null

      if (!this.$refs.seccion) {
        return
      }

      /* El delta se topea en 100ms: una pestaña que vuelve del fondo entrega un salto
         enorme, que con la fórmula de abajo daría factor ~1 -- o sea exactamente el salto
         que esta amortiguación existe para evitar. */
      const delta_ms = this.ultimo_ts ? Math.min(100, ts - this.ultimo_ts) : 16.67
      this.ultimo_ts = ts

      this.calcular_objetivo()

      /* 0.14 por frame a 60fps, escalado por el delta real: con un factor fijo por frame,
         un monitor de 120Hz corre la escena al doble de velocidad. */
      const factor = 1 - Math.pow(1 - 0.14, delta_ms / 16.67)
      const diferencia = this.progreso_objetivo - this.progreso

      if (Math.abs(diferencia) < 0.0005) {
        /* Llegó: se asienta en el valor exacto y el bucle CORTA. Sin este corte queda un
           rAF girando para siempre con el scroll quieto, y lo paga la batería del lead. */
        if (this.progreso !== this.progreso_objetivo) {
          this.progreso = this.progreso_objetivo
        }

        return
      }

      this.progreso = this.progreso + diferencia * factor
      this.raf_id = window.requestAnimationFrame(this.animar)
    },

    /**
     * Progreso crudo según cuánto del alto pinneable ya se scrolleó. Mide la <section>,
     * que no es sticky y por lo tanto sí se mueve; su hijo __pin no serviría.
     *
     * @returns {void}
     */
    calcular_objetivo() {
      if (!this.$refs.seccion) {
        return
      }

      const rect = this.$refs.seccion.getBoundingClientRect()
      const alto_pinneable = rect.height - window.innerHeight

      this.progreso_objetivo =
        alto_pinneable > 0 ? acotar(-rect.top / alto_pinneable) : rect.top <= 0 ? 1 : 0
    },
  },
}
</script>

<style scoped>
.demo-clientes {
  position: relative;
  box-sizing: border-box;
}

.demo-clientes *,
.demo-clientes *::before,
.demo-clientes *::after {
  box-sizing: border-box;
}

/* Único elemento pinneado. `overflow: hidden` acá adentro y no en un ancestro: en el
   elemento sticky no rompe nada (lo que rompería el pin es un ancestro con overflow), y
   es lo que garantiza que ningún momento pueda abrir scroll -- ni vertical ni, sobre
   todo, horizontal. */
.demo-clientes__pin {
  position: sticky;
  top: 0;
  /* svh después de vh, mismo orden que el resto de la página (.demo-hitos, el video de
     intro, la animación): un navegador sin soporte ignora la segunda declaración entera y
     se queda con la primera. Sin esto, en teléfono con la barra del navegador a la vista
     el pin mide más que lo que se ve y el contenido centrado se corre hacia abajo. */
  height: 100vh;
  height: 100svh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Un solo lavado de color para toda la sección, muy por debajo del umbral de "efecto":
   apenas separa esta pantalla de la anterior. Si se lo ve, está de más. */
.demo-clientes__lavado {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    120% 90% at 50% 8%,
    rgba(11, 132, 248, 0.07) 0%,
    rgba(11, 132, 248, 0) 62%
  );
  pointer-events: none;
}

.demo-clientes__momento {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(10px, 1.6vw, 18px);
  padding: clamp(20px, 5vw, 56px) clamp(16px, 4vw, 48px);
  text-align: center;
  opacity: var(--o, 1);
  transform: translate3d(0, calc(var(--y, 0) * 22px), 0);
  will-change: opacity, transform;
}

/* El momento del número, además, escala apenas: llega chico y se va grande. Es el único
   que lo hace -- en los otros dos el contenido es una grilla y una escala la desalinea. */
.demo-clientes__momento--numero {
  transform: translate3d(0, calc(var(--y, 0) * 22px), 0) scale(calc(1 - var(--y, 0) * 0.03));
}

.demo-clientes__momento--apagado {
  visibility: hidden;
}

.demo-clientes__antetitulo {
  margin: 0;
  font-size: clamp(0.95rem, 1.5vw, 1.1rem);
  color: var(--demo-color-texto-suave);
}

.demo-clientes__titulo {
  margin: 0;
  font-size: clamp(2rem, 6vw, 3.4rem);
  font-weight: 700;
  line-height: 1.08;
  /* Tracking negativo en texto display grande (§15 de apple-design/SKILL.md). */
  letter-spacing: -0.025em;
}

/* Jerarquía tenue, y es deliberada: el cuerpo en suave y el remate en el color fuerte.
   NO aplanar poniendo las dos líneas del mismo color -- es la corrección que ya se hizo
   tres veces en esta página (demo_experiencia.md §3.18-ter). */
.demo-clientes__titulo-cuerpo {
  display: block;
  color: var(--demo-color-texto-suave);
}

.demo-clientes__titulo-remate {
  display: block;
  color: var(--demo-color-texto);
}

.demo-clientes__pie {
  margin: 0;
  max-width: 42ch;
  font-size: clamp(0.95rem, 1.5vw, 1.1rem);
  line-height: 1.5;
  color: var(--demo-color-texto-suave);
}

.demo-clientes__rotulo {
  margin: 0;
  font-size: clamp(0.8rem, 1.2vw, 0.9rem);
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--demo-color-texto-suave);
}

.demo-clientes__subtitulo {
  margin: 0;
  font-size: clamp(1.35rem, 3.4vw, 2.1rem);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--demo-color-texto);
}

/* La pared: 6 / 9 / 12 columnas según el ancho.
   Flex y no grid, y esto es a propósito: la cantidad de logos no es un número redondo (hoy
   35) y con una grilla la última fila queda pegada a la izquierda con un hueco al final.
   Con flex + `justify-content: center` la última fila queda centrada y se lee como algo
   deliberado, además de que agregar o sacar un logo no obliga a recalcular ninguna columna.
   El `- 0.02px` del ancho de la casilla es el margen contra el redondeo a subpíxel: sin él,
   en algunos anchos la suma de seis casillas da una milésima más que el 100% y la fila se
   parte en cinco. */
.demo-clientes__pared {
  --p: 0;
  --columnas: 6;
  --hueco: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 1080px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--hueco);
}

/* `clamp(0, ..., 1)` con números sin unidad: el avance de cada casilla sale del progreso
   de la lista (--p, un solo binding por frame) menos su propia demora (--d, escrita una
   vez en mounted()). Toda la cuenta la hace el motor de CSS; Vue no toca estos 35 nodos. */
.demo-clientes__casilla {
  --d: 0;
  --avance: clamp(0, calc((var(--p, 0) - var(--d, 0)) / 0.4), 1);
  flex: 0 0
    calc((100% - (var(--columnas) - 1) * var(--hueco)) / var(--columnas) - 0.02px);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(3px, 0.7vw, 9px);
  border: 1px solid rgba(28, 35, 51, 0.06);
  border-radius: clamp(7px, 1vw, 12px);
  background: #fff;
  box-shadow: 0 1px 2px rgba(28, 35, 51, 0.04);
  opacity: var(--avance);
  /* translateY 2D y no translate3d: con 3D el navegador promueve las 35 casillas a capa
     propia y en un teléfono eso es memoria de vídeo que no hace falta gastar. */
  transform: translateY(calc((1 - var(--avance)) * 12px))
    scale(calc(0.92 + var(--avance) * 0.08));
}

.demo-clientes__logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* Las tiendas: flex y no grid, para que la última fila quede centrada. Con 7 tarjetas y
   4 columnas, una grilla las deja pegadas a la izquierda y se lee como si faltara algo. */
.demo-clientes__tiendas {
  --p: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 940px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(8px, 1.2vw, 14px);
}

/* En teléfono va una tarjeta por fila. Con dos por fila el nombre entra en ~80px y
   "HB Distribuciones" se corta con puntos suspensivos: un nombre propio recortado se lee
   como un error, no como una decisión. Siete filas de 58px entran de sobra en el pin. */
.demo-clientes__tienda {
  --d: 0;
  --avance: clamp(0, calc((var(--p, 0) - var(--d, 0)) / 0.45), 1);
  flex: 1 1 100%;
  opacity: var(--avance);
  transform: translateY(calc((1 - var(--avance)) * 14px));
}

@media (min-width: 480px) {
  .demo-clientes__tienda {
    flex: 0 1 clamp(190px, 30vw, 220px);
  }
}

.demo-clientes__tienda-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(28, 35, 51, 0.08);
  border-radius: 12px;
  background: #fff;
  text-align: left;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.demo-clientes__tienda-link:hover,
.demo-clientes__tienda-link:focus-visible {
  border-color: rgba(11, 132, 248, 0.35);
  box-shadow: 0 4px 14px rgba(28, 35, 51, 0.08);
}

.demo-clientes__tienda-logo {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.demo-clientes__tienda-datos {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
}

.demo-clientes__tienda-nombre {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--demo-color-texto);
  /* Un nombre largo tiene que recortarse, nunca ensanchar la tarjeta. */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-clientes__tienda-rubro {
  font-size: 0.78rem;
  color: var(--demo-color-texto-suave);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-clientes__tienda-flecha {
  flex: 0 0 auto;
  font-size: 0.85rem;
  color: var(--demo-color-texto-suave);
}

/* Teléfono chico (360×640, que es el piso que hay que bancar): siete tarjetas apiladas más
   el titular NO entran con la tarjeta del tamaño normal -- medido, sobraban 9px, o sea que
   con la barra de direcciones del navegador arriba se recortaba la última. Acá la tarjeta
   baja de 58 a ~45px de alto y quedan ~75px de aire.
   🔴 Va acá abajo y no al lado de `.demo-clientes__tienda`: las reglas base de la tarjeta
   están más abajo en el archivo y, con la misma especificidad, ganan las últimas. Puesto
   arriba el bloque entero no hace nada y no avisa. */
@media (max-width: 479px) {
  .demo-clientes__tiendas {
    gap: 7px;
  }

  .demo-clientes__tienda-link {
    gap: 8px;
    padding: 7px 10px;
  }

  .demo-clientes__tienda-logo {
    width: 28px;
    height: 28px;
  }

  .demo-clientes__tienda-nombre {
    font-size: 0.88rem;
  }

  .demo-clientes__tienda-rubro {
    font-size: 0.74rem;
  }
}

/* Tablet: 9 columnas. Este es el ancho donde se esconden los defectos -- una pared pensada
   para 12 acá todavía cree que entra, y las casillas terminan de 40px. */
@media (min-width: 768px) {
  .demo-clientes__pared {
    --columnas: 9;
    --hueco: 10px;
  }
}

@media (min-width: 1200px) {
  .demo-clientes__pared {
    --columnas: 12;
    --hueco: 14px;
  }
}

/* 🔴 Estado ESTÁTICO, no una versión suave de la animación: los tres momentos quedan uno
   abajo del otro, en el flujo normal, completos y quietos. Sin pin no hay nada que
   sincronizar con el scroll, así que el componente ni siquiera engancha listeners (ver
   `movimiento_reducido` en el script) y el `min-height` de 380vh no se escribe. */
@media (prefers-reduced-motion: reduce) {
  .demo-clientes__pin {
    position: static;
    display: block;
    height: auto;
    overflow: visible;
  }

  .demo-clientes__lavado {
    display: none;
  }

  .demo-clientes__momento {
    position: static;
    inset: auto;
    visibility: visible;
    opacity: 1;
    transform: none;
    will-change: auto;
    padding: clamp(48px, 8vw, 90px) clamp(16px, 4vw, 48px);
  }

  .demo-clientes__casilla,
  .demo-clientes__tienda {
    opacity: 1;
    transform: none;
  }
}

/* El marcador de enganche (ver el comentario del template). Alto cero y sin pintar nada:
   lo único que hace es existir en la posición correcta para que el navegador lo alinee.
   0,08 y no 0,07 exacto: el momento del número termina de entrar en 0,07, y un pelo de
   margen evita que el redondeo a píxeles de dispositivo lo deje justo en el borde de la
   entrada. */
.demo-clientes__ancla {
  position: absolute;
  left: 0;
  width: 1px;
  height: 1px;
  top: calc((100% - 100vh) * 0.08);
  scroll-snap-align: start;
  pointer-events: none;
}
</style>
