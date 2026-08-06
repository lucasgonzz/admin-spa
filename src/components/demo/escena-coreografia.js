/**
 * La coreografía de la escena hero (grupo 369, prompt 05): mapea un progreso [0,1] a la
 * posición, la escala y la opacidad de las trece tarjetas, mueve al comerciante de la
 * izquierda y publica las variables CSS que usa el resto de la escena.
 *
 * Viene de `marca/animacion-hero/hero.js` del repo de conocimiento. El guion (los BEAT,
 * SUCK y OUT, las curvas, el jitter) se transcribe tal cual. Lo que cambia:
 *
 *  1. **No secuestra el scroll.** El export escuchaba `wheel`, `touchmove` y `keydown`
 *     sobre `window` con `preventDefault` y tenía su propio `advance()`, porque en el HTML
 *     standalone el scroll ERA la escena. Acá el scroll de la página lo maneja el avance
 *     guiado (grupo 369, prompt 02) y el progreso entra por `set_progreso()`. Esos cuatro
 *     listeners no existen más: si volvieran, pelearían con el avance guiado y con el
 *     scroll de todo el admin.
 *  2. **Las variables CSS van en la raíz del COMPONENTE, no en `document.documentElement`.**
 *     El export las escribía en `:root`, o sea que `--p`, `--suck`, `--power` y compañía
 *     quedaban puestas en el admin entero. Se heredan igual hacia abajo, así que la
 *     escena funciona idéntico sin ensuciar nada de afuera.
 *  3. **Se puede apagar**: el `requestAnimationFrame` guarda su id y el `resize` se
 *     retira. El export no hacía ninguna de las dos cosas.
 *  4. **Nada de `window.CCHero`.** El que la crea se queda con la referencia.
 */

/* Ritmo del guion, tal cual el export. */
const BEAT_0 = 0.05
const BEAT_STEP = 0.095
const BEAT_DUR = 0.085
const SUCK_0 = 0.56
const SUCK_STEP = 0.018
const SUCK_DUR = 0.11
const OUT_0 = 0.7
const OUT_STEP = 0.03
const OUT_DUR = 0.14

/* Amortiguación interna: el progreso renderizado persigue al que entra. 🔴 Quien llame a
   set_progreso NO tiene que amortiguar de nuevo -- FondoSeccionSticky ya trae la suya y
   dos amortiguaciones en cadena se sienten como un retardo, no como suavidad. Para eso
   está el segundo parámetro. */
const PERSECUCION = 0.11

/**
 * @param {number} v
 * @returns {number}
 */
function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v)
}

/**
 * @param {number} v
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function range(v, a, b) {
  return clamp01((v - a) / (b - a))
}

/**
 * @param {number} t
 * @returns {number}
 */
function out_cubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * @param {number} t
 * @returns {number}
 */
function in_cubic(t) {
  return t * t * t
}

/**
 * @param {number} t
 * @returns {number}
 */
function in_out(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * @param {Element} el
 * @returns {{x: number, y: number}}
 */
function centro_de(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/**
 * Arranca la coreografía dentro de `raiz` (el elemento raíz del componente).
 *
 * @param {Element} raiz
 * @param {object|null} maquina Lo que devuelve crear_maquina(), o null si no hay WebGL.
 * @param {string} eje 'h' horizontal (desktop) | 'v' vertical (teléfono).
 * @returns {{set_progreso: function, relayout: function, destruir: function}}
 */
export function crear_coreografia(raiz, maquina, eje) {
  let objetivo = 0
  let P = 0
  let raf_id = null
  let destruido = false
  let lift_dy = 0
  let axis = eje === 'v' ? 'v' : 'h'

  const ancla = raiz.querySelector('.hero-escena__core-anchor')
  const lift = raiz.querySelector('.hero-escena__person-lift')

  const cards = []
  raiz.querySelectorAll('.hero-escena__p-card').forEach(function (el) {
    cards.push({
      el: el,
      rot: parseFloat(el.dataset.rot || 0),
      beat: parseFloat(el.dataset.beat || 0),
      dx: 0,
      dy: 0,
    })
  })

  const sols = []
  raiz.querySelectorAll('.hero-escena__s-card').forEach(function (el) {
    sols.push({ el: el, dx: 0, dy: 0 })
  })

  /**
   * Factor de escala del contenedor. El export lo leía de `.stage`; acá es la raíz de la
   * escena. Hace falta porque los desplazamientos se calculan en píxeles de pantalla y se
   * aplican en el espacio del transform.
   *
   * @returns {number}
   */
  function escala() {
    if (!raiz.offsetWidth) {
      return 1
    }
    return raiz.getBoundingClientRect().width / raiz.offsetWidth
  }

  /**
   * Recalcula, para cada tarjeta, cuánto tiene que viajar hasta el centro de la máquina.
   * Se llama al montar y en cada resize: son medidas en píxeles y una rotación de
   * teléfono las invalida todas.
   *
   * @returns {void}
   */
  function layout() {
    if (destruido || !ancla) {
      return
    }
    const k = escala()
    const m = centro_de(ancla)
    cards.concat(sols).forEach(function (o) {
      /* Se mide con el transform apagado y se repone: el rect de un elemento
         transformado ya incluye el desplazamiento que le pusimos nosotros. */
      const t = o.el.style.transform
      o.el.style.transform = 'none'
      const c = centro_de(o.el)
      o.el.style.transform = t
      o.dx = (m.x - c.x) / k
      o.dy = (m.y - c.y) / k
    })
    if (lift) {
      const t = lift.style.transform
      lift.style.transform = 'none'
      lift_dy = (m.y - centro_de(lift).y) / k
      lift.style.transform = t
    }
  }

  /**
   * @param {number} p
   * @returns {string}
   */
  function fase(p) {
    if (p < 0.5) {
      return 'caos'
    }
    if (p < 0.7) {
      return 'succion'
    }
    if (p < 0.9) {
      return 'salida'
    }
    return 'final'
  }

  /**
   * @param {number} t Timestamp de requestAnimationFrame.
   * @returns {void}
   */
  function frame(t) {
    if (destruido) {
      return
    }
    P += (objetivo - P) * PERSECUCION
    const p = P
    const time = t / 1000
    const suck = range(p, SUCK_0, SUCK_0 + 0.14)

    cards.forEach(function (o, i) {
      const b = o.beat
      const e = out_cubic(range(p, BEAT_0 + b * BEAT_STEP, BEAT_0 + b * BEAT_STEP + BEAT_DUR))
      const s = in_cubic(range(p, SUCK_0 + i * SUCK_STEP, SUCK_0 + i * SUCK_STEP + SUCK_DUR))
      const jit = (1 - s) * e * (0.3 + suck * 3)
      const jx = Math.sin(time * (1.7 + i * 0.31) + i) * 3 * jit
      const jy = Math.cos(time * (1.4 + i * 0.27) + i * 2) * 3.4 * jit
      const ex = axis === 'h' ? -160 : 0
      const ey = axis === 'h' ? 26 : -130
      const x = lerp(ex, 0, e) + o.dx * s + jx
      const y = lerp(ey, 0, e) + o.dy * s + jy
      const sc = lerp(0.86, 1, e) * (1 - 0.92 * s)
      o.el.style.transform =
        'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' +
        (o.rot * (1 - s) + jit * 1.2).toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')'
      o.el.style.opacity = (e * (1 - s)).toFixed(3)
    })

    sols.forEach(function (o, j) {
      const g = out_cubic(range(p, OUT_0 + j * OUT_STEP, OUT_0 + j * OUT_STEP + OUT_DUR))
      const x = o.dx * (1 - g)
      const y = o.dy * (1 - g)
      const sc = lerp(0.1, 1, g)
      o.el.style.transform =
        'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) +
        ') rotate(' + ((1 - g) * -8).toFixed(2) + 'deg)'
      o.el.style.opacity = g.toFixed(3)
    })

    if (lift) {
      const d = lift_dy * (1 - in_out(range(p, 0.03, 0.46)))
      lift.style.transform = 'translate3d(0,' + d.toFixed(1) + 'px,0)'
    }

    const S = raiz.style
    S.setProperty('--p', p.toFixed(4))
    S.setProperty('--suck', range(p, SUCK_0, SUCK_0 + 0.14).toFixed(3))
    S.setProperty('--out', range(p, OUT_0, 0.9).toFixed(3))
    S.setProperty('--power', range(p, 0.02, 0.2).toFixed(3))
    S.setProperty('--calm', range(p, 0.76, 0.94).toFixed(3))
    S.setProperty('--stress', (1 - range(p, 0.66, 0.84)).toFixed(3))

    const ph = fase(p)
    if (raiz.dataset.phase !== ph) {
      raiz.dataset.phase = ph
    }

    if (maquina) {
      maquina.set_progreso(p)
    }

    /* El bucle NO corta cuando llega al objetivo, a diferencia del de
       FondoSeccionSticky: el jitter de las tarjetas y el latido de los LEDs dependen del
       tiempo, no del progreso, así que una escena quieta igual se mueve. Lo que lo corta
       es destruir(). */
    raf_id = window.requestAnimationFrame(frame)
  }

  layout()
  window.addEventListener('resize', layout, { passive: true })
  raf_id = window.requestAnimationFrame(frame)

  return {
    /**
     * @param {number} p Progreso [0,1].
     * @param {boolean} instantaneo true para saltar sin amortiguar -- lo usa quien ya
     *                              amortigua por su cuenta, para no hacerlo dos veces.
     * @returns {void}
     */
    set_progreso(p, instantaneo) {
      objetivo = clamp01(p)
      if (instantaneo) {
        P = objetivo
      }
    },

    relayout: layout,

    /**
     * @returns {void}
     */
    destruir() {
      destruido = true
      if (raf_id !== null) {
        window.cancelAnimationFrame(raf_id)
        raf_id = null
      }
      window.removeEventListener('resize', layout)
    },
  }
}
