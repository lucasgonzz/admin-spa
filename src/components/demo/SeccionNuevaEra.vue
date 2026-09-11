<template>
  <section ref="seccion" class="demo-nueva-era">
    <div ref="grupo_era" class="demo-nueva-era__grupo" :style="estilo_era">
      <h2 class="demo-nueva-era__titulo demo-nueva-era__paso">Bienvenido a la nueva era.</h2>
      <p class="demo-nueva-era__parrafo demo-nueva-era__paso">
        Esto no es un sistema de gestión, es
        <strong class="demo-nueva-era__remate-inline">la mejor plataforma de Argentina</strong>
        para automatizar tus operaciones diarias, ventas por internet, atención personal a
        clientes por WhatsApp asistida por IA, imágenes automáticas y gestión de cuentas con
        clientes y proveedores.
      </p>
    </div>

    <div ref="grupo_implementacion" class="demo-nueva-era__grupo" :style="estilo_implementacion">
      <p class="demo-nueva-era__parrafo demo-nueva-era__paso">
        Pasar de un sistema a otro no es fácil, y lo sabemos: todos nuestros clientes venían
        de un sistema que ya no les permitía crecer.
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
  },

  mounted() {
    this.escalonar(this.$refs.grupo_era)
    this.escalonar(this.$refs.grupo_implementacion)

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
}
</style>
