<template>
  <section ref="seccion" class="demo-nueva-era">
    <div ref="grupo_era" class="demo-nueva-era__grupo" :style="estilo_era">
      <h2 class="demo-nueva-era__titulo demo-nueva-era__paso">Bienvenido a la nueva era.</h2>
      <p class="demo-nueva-era__parrafo demo-nueva-era__paso">
        Esto no es un sistema de gestión, es
        <strong class="demo-nueva-era__remate-inline">la mejor plataforma de Argentina</strong>
        para automatizar tus operaciones diarias.
      </p>
    </div>

    <div ref="grupo_implementacion" class="demo-nueva-era__grupo" :style="estilo_implementacion">
      <p class="demo-nueva-era__parrafo demo-nueva-era__paso">
        Pasar de un sistema a otro
        <strong class="demo-nueva-era__enfasis">no es fácil</strong>,
        <em
          class="demo-nueva-era__tipeo"
          :class="{ 'demo-nueva-era__tipeo--cursor': tipeo_cursor_visible }"
        >{{ tipeo_texto }}</em>:
        todos nuestros clientes venían de un sistema que ya no les permitía crecer.
      </p>
      <p class="demo-nueva-era__resaltado demo-nueva-era__paso">
        Por eso un pilar de nuestro servicio es la implementación personalizada.
      </p>

      <ul class="demo-nueva-era__pilares">
        <li v-for="pilar in pilares" :key="pilar.icono" class="demo-nueva-era__pilar demo-nueva-era__paso">
          <span class="demo-nueva-era__pilar-disco" aria-hidden="true">
            <i class="bi" :class="pilar.icono"></i>
          </span>
          <span class="demo-nueva-era__pilar-texto">{{ pilar.texto }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script>
/**
 * Los tres pilares de la implementación personalizada.
 *
 * El texto es de Lucas (10/9/2026) y se respeta en sustancia: lo único que se tocó es la
 * puntuación del primero, que venía con coma donde va una conjunción ("Migramos toda tu
 * información, te entregamos el sistema listo para vender").
 *
 * Los íconos van los tres en azul y ninguno en naranja: el naranja de marca es un acento
 * puntual ÚNICO y en cuanto se repite deja de leerse como acento (regla explícita de
 * marca/identidad.md). Tres íconos en fila son una serie por definición.
 */
const PILARES = [
  {
    icono: 'bi-database-check',
    texto: 'Migramos toda tu información y te entregamos el sistema listo para vender.',
  },
  {
    icono: 'bi-receipt',
    texto: 'Configuramos tus puntos de venta de ARCA para que factures solo lo que querés.',
  },
  {
    icono: 'bi-sliders',
    texto: 'Si tu negocio lo requiere, hacemos desarrollos a tu medida.',
  },
]

/** Dónde arranca la aparición de un grupo, en fracción del alto del viewport. */
const ARRANQUE = 0.85
/** Cuánto scroll (en fracción de viewport) tarda un grupo en terminar de entrar. */
const RECORRIDO = 0.45
/** Cuánto se abre el abanico del escalonado dentro de un grupo. */
const ABANICO = 0.5

/**
 * Texto que se revela con efecto de máquina de escribir dentro del segundo párrafo
 * (pedido de Lucas, 11/9/2026). Separado como constante -y no escrito directo en el
 * template- porque el mismo string se usa para calcular cada substring tipeada Y como
 * valor final bajo `prefers-reduced-motion`.
 */
const TEXTO_TIPEADO = 'y lo sabemos'
/** Espera desde que la sección entra en el viewport hasta que arranca el tipeo, en ms.
 *  Pedido explícito: 4 segundos, nunca al cargar la página. */
const TIPEO_ESPERA_MS = 4000
/** Cuánto tarda en aparecer cada letra, en ms. Ritmo de máquina de escribir real, ni
 *  instantáneo ni tan lento que se sienta forzado. */
const TIPEO_VELOCIDAD_MS = 55

/**
 * @param {number} valor
 * @returns {number} `valor` recortado a [0,1].
 */
function acotar(valor) {
  return valor < 0 ? 0 : valor > 1 ? 1 : valor
}

/**
 * "Bienvenido a la nueva era" + los tres pilares de la implementación personalizada.
 *
 * Sección de texto, en el flujo normal: no se pinnea ni secuestra el scroll. Lo único que
 * se mueve es la entrada de cada renglón, y se mueve poco -- 18px y una opacidad. Es una
 * sección para leer, no una escena.
 *
 * 🔴 La entrada NO se hace con un IntersectionObserver de una sola vía (clase + `forwards`
 * + `unobserve`). Ese patrón ya se usó en esta página y costó tres correctivos: no tiene
 * marcha atrás, así que al subir el bloque queda pegado en su estado final y la segunda
 * pasada se siente rota. Acá la entrada es función pura del progreso del grupo, así que la
 * reversa sale gratis. El IntersectionObserver que sí hay tiene otro trabajo: apagar el
 * rAF cuando la sección no se ve.
 *
 * El tipeo de "y lo sabemos" (Punto 3, 11/9/2026) es la EXCEPCIÓN deliberada a ese mismo
 * párrafo: ahí sí hace falta un IntersectionObserver de una sola vía + `disconnect()`,
 * porque no es una animación continua atada al progreso del scroll -es un evento que pasa
 * UNA vez, como el armado de una máquina de escribir-, y reiniciarlo cada vez que el lead
 * sube y vuelve a bajar se leería roto, no como un efecto. Mismo patrón que ya usa
 * ConfirmacionArmandoDemo.vue para su animación de entrada + la invitación al video: un
 * observer que dispara, arranca un timer, y se desconecta solo.
 *
 * La jerarquía tipográfica es deliberadamente tenue (demo_experiencia.md §3.18-ter):
 * cuerpo en `--demo-color-texto-suave`, remate en `--demo-color-texto`. No aplanarla.
 */
export default {
  name: 'SeccionNuevaEra',

  data() {
    return {
      /** Progreso [0,1] renderizado de cada grupo. */
      p_era: 0,
      p_implementacion: 0,
      /** Progreso crudo del rect, al que persiguen los de arriba. */
      objetivo_era: 0,
      objetivo_implementacion: 0,
      raf_id: null,
      ultimo_ts: 0,
      scroll_target: null,
      observador: null,
      a_la_vista: false,
      /**
       * Estado ESTÁTICO, no una versión suave (demo_experiencia.md §3.18-bis): con la
       * preferencia puesta no hay bucle ni listeners y el CSS deja todo visible con el
       * fallback de `var(--p, 1)`.
       */
      movimiento_reducido:
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      /**
       * Substring de TEXTO_TIPEADO ya revelada (Punto 3). Vacía hasta que arranca el
       * efecto -es el estado "todavía no tipeé nada", no un error de render.
       */
      tipeo_texto: '',
      /** Observer de una sola vía que dispara el tipeo al entrar la sección en viewport. */
      tipeo_observador: null,
      /** Handle del setTimeout de la espera de TIPEO_ESPERA_MS, para poder cancelarlo si
       *  el componente se desmonta en el medio. */
      tipeo_espera_timeout: null,
      /** Handle del setInterval que va revelando una letra por vez. */
      tipeo_intervalo: null,
    }
  },

  computed: {
    /** @returns {Array} */
    pilares() {
      return PILARES
    },

    /** @returns {Object|null} */
    estilo_era() {
      return this.movimiento_reducido ? null : { '--p': this.p_era.toFixed(4) }
    },

    /** @returns {Object|null} */
    estilo_implementacion() {
      return this.movimiento_reducido ? null : { '--p': this.p_implementacion.toFixed(4) }
    },

    /**
     * true mientras conviene mostrar el cursor parpadeante junto al tipeo: antes de que
     * arranque (los primeros TIPEO_ESPERA_MS) y mientras está en curso. Sin esto, esos
     * tramos dejan un hueco vacío entre la coma y los dos puntos ("no es fácil, : todos
     * nuestros...") que se lee como texto roto, no como una animación en marcha. Se apaga
     * solo apenas el texto queda completo -un cursor parpadeando para siempre no era parte
     * del pedido.
     *
     * @returns {boolean}
     */
    tipeo_cursor_visible() {
      return this.tipeo_texto !== TEXTO_TIPEADO
    },
  },

  mounted() {
    this.escalonar(this.$refs.grupo_era)
    this.escalonar(this.$refs.grupo_implementacion)
    this.iniciar_tipeo()

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

    /* Primer valor sin animar: si la página se recarga con el scroll ya acá abajo, el texto
       tiene que estar puesto, no barriendo desde 0. */
    this.calcular_objetivo()
    this.p_era = this.objetivo_era
    this.p_implementacion = this.objetivo_implementacion
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

    /* Mismo criterio que el resto de esta página con sus timers (ConfirmacionArmandoDemo,
       ExperienciaDemo): si el lead navega afuera a mitad de la espera o del tipeo, no puede
       quedar un timer corriendo contra un componente ya desmontado. */
    if (this.tipeo_observador) {
      this.tipeo_observador.disconnect()
      this.tipeo_observador = null
    }
    if (this.tipeo_espera_timeout !== null) {
      window.clearTimeout(this.tipeo_espera_timeout)
      this.tipeo_espera_timeout = null
    }
    if (this.tipeo_intervalo !== null) {
      window.clearInterval(this.tipeo_intervalo)
      this.tipeo_intervalo = null
    }
  },

  methods: {
    /**
     * Escribe la demora del escalonado en cada renglón del grupo, una sola vez y directo
     * al DOM: es un valor que no cambia nunca, y como `:style` entraría al diff de Vue en
     * cada frame del scroll para escribir siempre lo mismo.
     *
     * @param {Element} grupo
     * @returns {void}
     */
    escalonar(grupo) {
      if (!grupo) {
        return
      }

      const pasos = grupo.querySelectorAll('.demo-nueva-era__paso')

      for (let i = 0; i < pasos.length; i++) {
        const demora = pasos.length > 1 ? (i / (pasos.length - 1)) * ABANICO : 0
        pasos[i].style.setProperty('--d', demora.toFixed(4))
      }
    },

    /**
     * Arranca el efecto de tipeo de "y lo sabemos" (Punto 3): a los TIPEO_ESPERA_MS de que
     * la sección entra en el viewport -nunca al cargar la página, que es lo que un
     * `mounted()` sin este observer haría (la sección nace montada junto con el resto del
     * recorrido, mucho antes de que el lead scrollee hasta acá).
     *
     * Mismo patrón que ConfirmacionArmandoDemo.vue: IntersectionObserver de una sola vía
     * que dispara y se desconecta. A diferencia del `observador` de arriba (que prende y
     * apaga el bucle de rAF cada vez que la sección entra y sale de la vista), este es
     * intencionalmente de un solo uso -una máquina de escribir que se reinicia cada vez
     * que el lead sube y vuelve a bajar se leería rota, no como un efecto.
     *
     * @returns {void}
     */
    iniciar_tipeo() {
      if (this.movimiento_reducido || typeof IntersectionObserver !== 'function') {
        /* Sin animación que disparar: bajo reduced-motion el texto queda puesto de una
           (mismo criterio que el resto del componente), y sin IntersectionObserver
           (navegador viejo) no hay forma de saber cuándo entra en viewport -mejor
           mostrarlo directo que dejarlo vacío para siempre. */
        this.tipeo_texto = TEXTO_TIPEADO
        return
      }

      const self = this

      this.tipeo_observador = new IntersectionObserver(function (entradas) {
        if (!entradas[entradas.length - 1].isIntersecting) {
          return
        }

        self.tipeo_espera_timeout = window.setTimeout(function () {
          self.tipeo_espera_timeout = null
          self.tipear()
        }, TIPEO_ESPERA_MS)

        /* Una sola vez: sin esto, cada vez que el lead vuelve a pasar por acá (sube y
           baja de nuevo) se reprogramaría la espera y el tipeo se repetiría. */
        self.tipeo_observador.disconnect()
      })

      this.tipeo_observador.observe(this.$refs.seccion)
    },

    /**
     * Revela TEXTO_TIPEADO de a una letra, a TIPEO_VELOCIDAD_MS por letra.
     *
     * @returns {void}
     */
    tipear() {
      const self = this
      let i = 0

      this.tipeo_intervalo = window.setInterval(function () {
        i++
        self.tipeo_texto = TEXTO_TIPEADO.slice(0, i)

        if (i >= TEXTO_TIPEADO.length) {
          window.clearInterval(self.tipeo_intervalo)
          self.tipeo_intervalo = null
        }
      }, TIPEO_VELOCIDAD_MS)
    },

    /**
     * Sube por los ancestros hasta el que realmente scrollea: en este admin es
     * <main class="app-main-scroll">, y un listener en `window` no recibiría nunca su
     * evento de scroll (no burbujea hasta ahí). No se hardcodea el selector.
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
     * Un frame: recalcula los dos objetivos, los persigue con amortiguación exponencial y
     * corta cuando los dos llegaron. Sin ese corte quedaría un rAF girando para siempre
     * con el scroll quieto, y lo paga la batería del lead.
     *
     * @param {number} ts
     * @returns {void}
     */
    animar(ts) {
      this.raf_id = null

      if (!this.$refs.seccion) {
        return
      }

      /* Topeado en 100ms: una pestaña que vuelve del fondo entrega un salto enorme que con
         la fórmula de abajo daría factor ~1, o sea el salto que esto viene a evitar. */
      const delta_ms = this.ultimo_ts ? Math.min(100, ts - this.ultimo_ts) : 16.67
      this.ultimo_ts = ts

      this.calcular_objetivo()

      /* 0.14 por frame a 60fps, escalado por el delta real: con un factor fijo por frame un
         monitor de 120Hz corre la entrada al doble de velocidad. La amortiguación no es
         estética -- una rueda de mouse en Windows entrega escalones de ~100px y sin esto
         el texto aparece de golpe, a saltos. */
      const factor = 1 - Math.pow(1 - 0.14, delta_ms / 16.67)

      const dif_era = this.objetivo_era - this.p_era
      const dif_impl = this.objetivo_implementacion - this.p_implementacion
      const llego_era = Math.abs(dif_era) < 0.0005
      const llego_impl = Math.abs(dif_impl) < 0.0005

      this.p_era = llego_era ? this.objetivo_era : this.p_era + dif_era * factor
      this.p_implementacion = llego_impl
        ? this.objetivo_implementacion
        : this.p_implementacion + dif_impl * factor

      if (llego_era && llego_impl) {
        return
      }

      this.raf_id = window.requestAnimationFrame(this.animar)
    },

    /** @returns {void} */
    calcular_objetivo() {
      const vh = window.innerHeight
      const recorrido = vh * RECORRIDO

      this.objetivo_era = this.progreso_de(this.$refs.grupo_era, vh, recorrido)
      this.objetivo_implementacion = this.progreso_de(
        this.$refs.grupo_implementacion,
        vh,
        recorrido,
      )
    },

    /**
     * Progreso [0,1] de un grupo: 0 mientras su borde superior está por debajo del 85% del
     * viewport, 1 medio viewport más arriba. Va por grupo y no por sección entera porque
     * la sección mide más de una pantalla: con un solo progreso, los pilares terminarían
     * de aparecer antes de que el lead los tenga a la vista.
     *
     * @param {Element} grupo
     * @param {number} vh
     * @param {number} recorrido
     * @returns {number}
     */
    progreso_de(grupo, vh, recorrido) {
      if (!grupo) {
        return 0
      }

      return acotar((vh * ARRANQUE - grupo.getBoundingClientRect().top) / recorrido)
    },
  },
}
</script>

<style scoped>
.demo-nueva-era {
  box-sizing: border-box;
  padding: clamp(64px, 11vh, 130px) clamp(16px, 4vw, 48px);
  /* dvh encima de vh (mismo par que ya usa el resto de la página: .demo-hitos en
     demo-experiencia.scss, .demo-scroll-dolor__puente, __video-intro): en un teléfono
     real con barra de direcciones dinámica, vh se fija contra el viewport GRANDE (barra
     escondida), y justo al aterrizar el guiado -con la barra típicamente visible- el
     padding sale un poco más grande que el espacio que en verdad se ve. Un navegador sin
     soporte de dvh ignora esta línea entera y se queda con la de arriba. */
  padding-top: clamp(64px, 11dvh, 130px);
  padding-bottom: clamp(64px, 11dvh, 130px);
}

.demo-nueva-era *,
.demo-nueva-era *::before,
.demo-nueva-era *::after {
  box-sizing: border-box;
}

.demo-nueva-era__grupo {
  --p: 1;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

.demo-nueva-era__grupo + .demo-nueva-era__grupo {
  margin-top: clamp(64px, 11vh, 128px);
  /* dvh, mismo motivo que el padding de arriba. */
  margin-top: clamp(64px, 11dvh, 128px);
  max-width: 940px;
}

/* El avance de cada renglón sale del progreso del grupo (--p, un solo binding por frame)
   menos su propia demora (--d, escrita una vez en mounted()). La cuenta la hace el motor
   de CSS: Vue no toca estos nodos en ningún frame del scroll. */
.demo-nueva-era__paso {
  --d: 0;
  --avance: clamp(0, calc((var(--p, 1) - var(--d, 0)) / 0.45), 1);
  opacity: var(--avance);
  transform: translateY(calc((1 - var(--avance)) * 18px));
}

.demo-nueva-era__titulo {
  margin: 0 0 clamp(16px, 2.4vw, 26px);
  font-size: clamp(1.9rem, 5.4vw, 3rem);
  font-weight: 700;
  line-height: 1.1;
  /* Tracking negativo en texto display grande (§15 de apple-design/SKILL.md). */
  letter-spacing: -0.025em;
  color: var(--demo-color-texto);
}

/* Cuerpo en el color suave. El remate que va adentro es lo único que sube al color fuerte:
   es la jerarquía tenue de esta página y es deliberada (§3.18-ter). No aplanarla poniendo
   todo el párrafo en --demo-color-texto. */
.demo-nueva-era__parrafo {
  margin: 0;
  font-size: clamp(1.05rem, 1.6vw, 1.25rem);
  line-height: 1.6;
  color: var(--demo-color-texto-suave);
}

.demo-nueva-era__remate-inline {
  font-weight: 600;
  color: var(--demo-color-texto);
}

/* Negrita simple (Punto 3, 11/9/2026): a diferencia de __remate-inline, NO sube al color
   fuerte -Lucas pidió negrita, no un segundo remate destacado dentro del mismo párrafo, y
   la jerarquía tenue de esta página ya tiene su remate (§3.18-ter, ver arriba). */
.demo-nueva-era__enfasis {
  font-weight: 700;
}

/* Cursiva + tipeo (Punto 3). El texto en sí no lleva color propio -hereda el suave del
   párrafo-, la cursiva es lo único que lo distingue mientras no está tipeando. */
.demo-nueva-era__tipeo {
  font-style: italic;
}

/* Cursor parpadeante: cubre los TIPEO_ESPERA_MS de espera antes de que arranque el tipeo
   y el tipeo en sí. Sin esto, ese tramo se ve como un hueco vacío entre la coma y los dos
   puntos ("no es fácil, : todos nuestros...") -se lee como texto roto, no como una
   animación en marcha. Se apaga solo apenas termina (ver tipeo_cursor_visible). */
.demo-nueva-era__tipeo--cursor::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 1px;
  vertical-align: text-bottom;
  background: currentColor;
  animation: demo-nueva-era-cursor 0.9s step-end infinite;
}

@keyframes demo-nueva-era-cursor {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.demo-nueva-era__resaltado {
  margin: clamp(14px, 2vw, 20px) 0 0;
  font-size: clamp(1.2rem, 1.9vw, 1.5rem);
  font-weight: 600;
  line-height: 1.35;
  color: var(--demo-color-texto);
}

.demo-nueva-era__pilares {
  list-style: none;
  margin: clamp(28px, 4vw, 44px) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(12px, 1.6vw, 18px);
}

/* Superficie oscura (misión paleta-oscura-experiencia, 10/9/2026): antes era una
   tarjeta blanca -tenía sentido con la página clara de entonces. Ahora usa el mismo
   fondo que las tarjetas de problema de la animación (--demo-color-superficie,
   definida en demo-experiencia.scss junto al resto del tema oscuro), para que un
   pilar de "nueva era" y una tarjeta de la animación lean como el mismo sistema. */
.demo-nueva-era__pilar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: clamp(14px, 1.8vw, 20px);
  border: 1px solid var(--demo-color-borde-superficie);
  border-radius: 14px;
  background: var(--demo-color-superficie);
}

.demo-nueva-era__pilar-disco {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  /* Mismo tono que usa la animación para sus cajas de ícono
     (.animacion-procesador__caja-icono) -no un azul nuevo inventado para acá. */
  background: rgba(47, 123, 255, 0.14);
  border: 1px solid var(--demo-color-borde-superficie);
  color: var(--demo-color-azul);
  font-size: 1rem;
}

.demo-nueva-era__pilar-texto {
  /* min-width: 0 para que un texto largo se acomode en vez de ensanchar la columna: es
     por donde aparece el scroll horizontal en una grilla de tres. */
  min-width: 0;
  font-size: clamp(0.98rem, 1.35vw, 1.08rem);
  line-height: 1.5;
  color: var(--demo-color-texto-suave);
}

/* 🔴 Punto 1 (11/9/2026): "Bienvenido a la nueva era" no entraba en pantalla en celular.
   No era un `overflow: hidden` cortando nada -- no hay ninguno en este componente ni en
   sus ancestros -- sino que la sección, con sus dos grupos completos, mide MÁS que la
   pantalla en un teléfono bajo (medido: 899px de contenido contra 640px de viewport a
   360x640; 981px contra 568px a 360x568), y esta sección va SUELTA en el scroll (no
   dentro de un <fondo-seccion-sticky>, ver ScrollDolor.vue), así que no tiene la flechita
   de "seguir bajando" que sí tienen las otras seis secciones del recorrido -- nada le
   avisa al lead que hay más para ver. El guiado aterriza bien (el título siempre se ve
   completo apenas llega, verificado con scrollTo instantáneo y suave en cinco tamaños de
   teléfono) y el scroll nativo después sí revela el resto sin trabarse -- pero mientras
   tanto, el borde inferior de la pantalla corta la primera tarjeta de pilares A MITAD DE
   PALABRA en los teléfonos más bajos (360x568: "...el sistema listo ~~para vender.~~"), y
   eso se lee como contenido roto, no como una invitación a scrollear un poco más.

   El arreglo de fondo (agregarle la flecha de avance a esta sección) vive en
   FondoSeccionSticky.vue/ScrollDolor.vue, fuera del alcance de este punto. Achicar el
   ritmo vertical achica la sección entera -- menos separación entre bloques, tarjetas más
   compactas -- lo suficiente para que en los altos de teléfono más comunes (390x844,
   375x812) el sobrante caiga en el padding, no en el texto; en los más bajos (360x568) lo
   reduce bastante aunque no lo cierra del todo, que ya es una decisión de densidad de
   layout para consultar con Lucas, no algo para resolver a fuerza de achicar números. */
@media (max-width: 767.98px) {
  .demo-nueva-era {
    padding: clamp(40px, 7vh, 80px) clamp(16px, 4vw, 48px);
    padding-top: clamp(40px, 7dvh, 80px);
    padding-bottom: clamp(40px, 7dvh, 80px);
  }

  .demo-nueva-era__grupo + .demo-nueva-era__grupo {
    margin-top: clamp(40px, 7vh, 80px);
    margin-top: clamp(40px, 7dvh, 80px);
  }

  .demo-nueva-era__pilares {
    margin-top: clamp(20px, 3vw, 32px);
  }

  .demo-nueva-era__pilar {
    padding: clamp(12px, 1.8vw, 16px);
  }
}

/* Tablet y para arriba: los tres pilares en fila. En teléfono quedan apilados -- tres
   columnas de 110px son tres columnas ilegibles. */
@media (min-width: 768px) {
  .demo-nueva-era__pilares {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .demo-nueva-era__pilar {
    flex-direction: column;
    gap: 14px;
  }
}

/* 🔴 Estado ESTÁTICO, no una versión suave: todo puesto, nada moviéndose. El componente
   además ni engancha listeners bajo esta preferencia (ver `movimiento_reducido`). */
@media (prefers-reduced-motion: reduce) {
  .demo-nueva-era__paso {
    opacity: 1;
    transform: none;
  }

  /* Red de seguridad, no la vía principal: bajo esta preferencia iniciar_tipeo() ya pone
     TEXTO_TIPEADO completo de una y nunca agrega la clase --cursor. Esto cubre el caso
     borde de un navegador que entiende la media query pero no IntersectionObserver. */
  .demo-nueva-era__tipeo--cursor::after {
    animation: none;
    opacity: 0;
  }
}
</style>
