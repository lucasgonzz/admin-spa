/**
 * La coreografía de la escena hero (grupo 369, prompt 05; retiming y mecánica de
 * asentamiento agregados en la misión de la animación corregida, 31/8/2026): mapea un
 * progreso [0,1] a la posición, la escala y la opacidad de las trece tarjetas, mueve al
 * comerciante de la izquierda, reubica al de la derecha junto a la máquina al final del
 * recorrido, y publica las variables CSS que usa el resto de la escena.
 *
 * Viene de `marca/animacion-hero/hero.js` del repo de conocimiento. El guion (los BEAT,
 * SUCK, OUT y SETTLE, las curvas, el jitter, la mecánica de asentamiento) se transcribe tal
 * cual. Lo que cambia:
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
 *  5. **El asentamiento se apaga en teléfono.** En el eje vertical la columna central mide
 *     20vh y no existe la banda entre la máquina y la marca donde el export ubica el bloque
 *     asentado -- el cálculo de `--settle-top` daría un valor negativo o superpuesto a la
 *     marca. Decisión de Lucas (31/8/2026): en `eje === 'v'` el comerciante de la derecha se
 *     queda en su lugar de siempre, sin reubicarse.
 *  6. **`visibleBottomFraction()` de `machine.js` no existe acá.** Ese método proyecta la
 *     caja del objeto 3D con la cámara Three.js vigente -- y `three` se borró del proyecto
 *     en la misión 12. El número equivalente sale de `maquina.fraccion_borde_inferior()`
 *     (ver `maquina-animacion.js`), medido una vez sobre los píxeles del asset que se
 *     shippea, no en tiempo de ejecución.
 */

/* Ritmo del guion, tal cual el export corregido (loop cerrado a 24,75s). */
const BEAT_0 = 0.05
const BEAT_STEP = 0.085
const BEAT_DUR = 0.08
const SUCK_0 = 0.5
const SUCK_STEP = 0.016
const SUCK_DUR = 0.1
const OUT_0 = 0.63
const OUT_STEP = 0.026
const OUT_DUR = 0.115
/* El 10% final del recorrido es la pausa de asentamiento: el comerciante tranquilo se
   reubica junto a la máquina entre SETTLE_0 y SETTLE_1 y se queda ahí. */
const SETTLE_0 = 0.8
const SETTLE_1 = 0.9

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
 * @param {object|null} maquina Lo que devuelve crear_reproductor() de
 *                              maquina-animacion.js, o null si la tira no se pudo cargar.
 * @param {string} eje 'h' horizontal (desktop) | 'v' vertical (teléfono).
 * @returns {{set_progreso: function, relayout: function, set_eje: function, pausar: function, reanudar: function, destruir: function}}
 */
export function crear_coreografia(raiz, maquina, eje) {
  let objetivo = 0
  let P = 0
  let raf_id = null
  let destruido = false
  let lift_dy = 0
  let axis = eje === 'v' ? 'v' : 'h'

  const ancla = raiz.querySelector('.hero-escena__core-anchor')
  const core = raiz.querySelector('.hero-escena__core')
  const lift = raiz.querySelector('.hero-escena__person-lift')
  const settle = raiz.querySelector('.hero-escena__person-settle')
  const slot = raiz.querySelector('.hero-escena__core-slot')
  const brand = raiz.querySelector('.hero-escena__brand')

  /* Dónde vivía `settle` en el template, para devolverlo ahí -- tanto al desasentarse
     como al destruir la coreografía. Ver el comentario largo de `set_settled()` sobre por
     qué esta cirugía de DOM es tolerable acá. */
  const settle_home = settle ? { padre: settle.parentNode, siguiente: settle.nextSibling } : null
  let settle_on = false
  const flip = { x: 0, y: 0 }

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

  /* Último string escrito para cada variable CSS compartida (grupo 370, correctivo 8,
     prompt 04, criterio d). `setProperty` dispara una invalidación de estilo en TODO lo
     que hereda la variable -- las trece tarjetas más los dos blurs del fondo -- así que
     escribirla igual cuando el valor redondeado no cambió (pasa seguido cerca de los
     extremos de una fase, donde range()/toFixed() devuelven el mismo string cuadro tras
     cuadro) es trabajo tirado. Se compara el string YA REDONDEADO, no el número crudo:
     dos números que difieren en la sexta cifra decimal redondean al mismo texto. */
  const ultimo_css = { p: null, suck: null, out: null, power: null, calm: null, stress: null, settled: null }

  /**
   * Escribe una variable CSS en la raíz solo si el string cambió desde el cuadro
   * anterior.
   *
   * @param {string} clave Nombre corto (sin el `--`) de la variable.
   * @param {string} valor String ya formateado con toFixed().
   * @returns {void}
   */
  function escribir_si_cambio(clave, valor) {
    if (ultimo_css[clave] === valor) {
      return
    }
    ultimo_css[clave] = valor
    raiz.style.setProperty('--' + clave, valor)
  }

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
   * Recalcula, para cada tarjeta, cuánto tiene que viajar hasta el centro de la máquina, y
   * -- si corresponde -- dónde va a aterrizar el bloque asentado. Se llama al montar y en
   * cada resize: son medidas en píxeles y una rotación de teléfono las invalida todas.
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
    /* En teléfono no hay banda donde ubicar el bloque asentado (ver el punto 5 del
       docblock de arriba): no se mide nada y `--settle-top` se queda en lo que tenía. */
    if (settle && slot && core && brand && !settle_on && axis === 'h') {
      const t = settle.style.transform
      settle.style.transform = 'none'
      /* Mide el bloque ya apilado y lo ubica en la banda que se abre entre la máquina y
         el logo. */
      settle.classList.add('hero-escena__person-row--asentado')
      slot.appendChild(settle)
      const bh = settle.getBoundingClientRect().height / k
      const core_top = core.getBoundingClientRect().top / k
      const vf = maquina && maquina.fraccion_borde_inferior ? maquina.fraccion_borde_inferior() : 0.578
      const mb = ancla.getBoundingClientRect()
      const gap_top = (mb.top + mb.height * vf) / k - 38 - core_top
      const gap_bottom = brand.getBoundingClientRect().top / k + 18 - core_top
      raiz.style.setProperty('--settle-top', (gap_top + (gap_bottom - gap_top - bh) / 2) + 'px')
      settle.classList.remove('hero-escena__person-row--asentado')
      settle_home.padre.insertBefore(settle, settle_home.siguiente)
      settle.style.transform = t
    }
  }

  /**
   * FLIP: cambia de columna y de layout, y compensa el salto con una traslación que el
   * `frame()` de abajo relaja a cero. Es un no-op en teléfono: `axis === 'v'` nunca deja
   * pasar `on = true` (ver `frame()`).
   *
   * @param {boolean} on
   * @returns {void}
   */
  function set_settled(on) {
    if (!settle || !slot || on === settle_on) {
      return
    }
    const k = escala()
    const a = settle.getBoundingClientRect()
    settle.style.transform = 'none'
    if (on) {
      settle.classList.add('hero-escena__person-row--asentado')
      slot.appendChild(settle)
    } else {
      settle.classList.remove('hero-escena__person-row--asentado')
      settle_home.padre.insertBefore(settle, settle_home.siguiente)
    }
    settle_on = on
    const b = settle.getBoundingClientRect()
    flip.x = (a.left + a.width / 2 - (b.left + b.width / 2)) / k
    flip.y = (a.top + a.height / 2 - (b.top + b.height / 2)) / k
  }

  /**
   * @param {number} p
   * @returns {string}
   */
  function fase(p) {
    if (p < SUCK_0) {
      return 'caos'
    }
    if (p < OUT_0) {
      return 'succion'
    }
    if (p < SETTLE_0) {
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
      const d = lift_dy * (1 - in_out(range(p, 0.03, 0.42)))
      lift.style.transform = 'translate3d(0,' + d.toFixed(1) + 'px,0)'
    }

    if (settle) {
      /* En teléfono `g` nunca pasa de 0: `set_settled(false)` es un no-op si ya estaba
         apagado, así que esto no hace nada en cada cuadro salvo cuando axis cambia a
         mitad de recorrido (ver set_eje()). */
      const g = axis === 'v' ? 0 : in_out(range(p, SETTLE_0, SETTLE_1))
      set_settled(g > 0.001)
      escribir_si_cambio('settled', g.toFixed(3))
      if (settle_on) {
        const sc = lerp(0.78, 1, g)
        settle.style.transform =
          'translate3d(' + (flip.x * (1 - g)).toFixed(1) + 'px,' + (flip.y * (1 - g)).toFixed(1) +
          'px,0) scale(' + sc.toFixed(3) + ')'
      } else {
        settle.style.transform = 'none'
      }
    }

    escribir_si_cambio('p', p.toFixed(4))
    escribir_si_cambio('suck', range(p, SUCK_0, SUCK_0 + 0.14).toFixed(3))
    escribir_si_cambio('out', range(p, OUT_0, 0.9).toFixed(3))
    escribir_si_cambio('power', range(p, 0.02, 0.2).toFixed(3))
    escribir_si_cambio('calm', range(p, 0.66, 0.84).toFixed(3))
    escribir_si_cambio('stress', (1 - range(p, 0.56, 0.74)).toFixed(3))

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
     * Cambia el eje de entrada de las tarjetas: 'h' desde el costado (desktop), 'v'
     * desde arriba (teléfono). Recalcula las medidas, porque la disposición de la grilla
     * cambió con el breakpoint y los viajes hasta el centro de la máquina ya no son los
     * mismos.
     *
     * Si el comerciante de la derecha estaba asentado y el teléfono rota a vertical a
     * mitad de recorrido, se desasienta de una: en 'v' no hay banda donde mostrarlo
     * asentado, así que se lo devuelve a su lugar de siempre en el mismo cuadro.
     *
     * @param {string} nuevo 'h' | 'v'
     * @returns {void}
     */
    set_eje(nuevo) {
      const valor = nuevo === 'v' ? 'v' : 'h'
      if (valor === axis) {
        return
      }
      axis = valor
      if (axis === 'v' && settle_on) {
        set_settled(false)
        escribir_si_cambio('settled', '0.000')
        if (settle) {
          settle.style.transform = 'none'
        }
      }
      layout()
    },

    /**
     * Corta el bucle sin destruir nada (grupo 370, correctivo 8, prompt 04): lo llama
     * EscenaHero cuando la escena sale del viewport o la pestaña pasa a segundo plano.
     * `raf_id` hace de guarda: llamarlo dos veces seguidas no hace nada raro.
     *
     * Por qué no hace falta resetear ningún estado para que la reanudación no salte: P
     * (el progreso renderizado) queda congelado en el valor que tenía -- no se toca acá
     * -- así que las tarjetas quedan exactamente donde estaban. El jitter usa el
     * timestamp de rAF tal cual llega (no un contador propio), así que al reanudar
     * simplemente sigue desde el reloj real; es una fase distinta del seno/coseno, no
     * un salto de posición.
     *
     * @returns {void}
     */
    pausar() {
      if (raf_id !== null) {
        window.cancelAnimationFrame(raf_id)
        raf_id = null
      }
    },

    /**
     * Reanuda el bucle si estaba pausado. Si ya estaba corriendo (o si ya se destruyó),
     * no hace nada.
     *
     * @returns {void}
     */
    reanudar() {
      if (raf_id === null && !destruido) {
        raf_id = window.requestAnimationFrame(frame)
      }
    },

    /**
     * Devuelve el bloque asentado a su lugar de origen en el template antes de cortar --
     * si el componente se desmonta con el comerciante ya reubicado dentro de
     * `.hero-escena__core-slot` y nadie lo devuelve, el nodo queda colgado del padre que
     * Vue puede estar por retirar del DOM. Es la misma cirugía que hace `set_settled()`,
     * llamada una vez más al final.
     *
     * @returns {void}
     */
    destruir() {
      destruido = true
      if (raf_id !== null) {
        window.cancelAnimationFrame(raf_id)
        raf_id = null
      }
      window.removeEventListener('resize', layout)
      if (settle_on) {
        set_settled(false)
      }
    },
  }
}
