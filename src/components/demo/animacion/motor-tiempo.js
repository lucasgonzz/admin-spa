/**
 * Motor de tiempo de la animación del procesador.
 *
 * Es un port literal de las cinco cosas que la escena usa del runtime de Claude Design
 * (`animations-v3`): `Easing`, `clamp`, `interpolate`, `animate` y el warp de escenas
 * (`ccDerive` + `ccWarp`). Todo lo demás de ese runtime —el editor de línea de tiempo, la
 * barra de reproducción, los watercolor, el Stage con SVG— NO se portó: acá no hace falta
 * nada de eso.
 *
 * Son funciones PURAS: no importan Vue, no tocan el DOM y no guardan estado. La escena
 * entera se calcula a partir de un solo número —el tiempo `T` en segundos— y estas
 * funciones son las que lo convierten en posiciones y opacidades.
 *
 * 🔴 El warp no es un detalle. Cada escena de la tabla tiene dos duraciones:
 *   · `dur` — lo que esa escena DURA en pantalla (tiempo de reloj).
 *   · `nat` — su duración "natural", en la que fue coreografiada (tiempo autoral).
 * El reloj corre en tiempo de reloj y la coreografía está escrita en tiempo autoral, así
 * que hay que traducir uno al otro escena por escena. Hardcodear los tiempos de arranque
 * a mano desincroniza la coreografía: por eso esto se porta y no se reescribe.
 */

/* ── Easing ─────────────────────────────────────────────────────────────────
   Todas toman t ∈ [0,1] y devuelven t suavizado ∈ [0,1]. Las de tipo "back" y
   "elastic" se pasan de 1 a propósito (rebote). */
export const Easing = {
  linear: (t) => t,

  /* Quad */
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  /* Cubic */
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),

  /* Quart */
  easeInQuart: (t) => t * t * t * t,
  easeOutQuart: (t) => 1 - --t * t * t * t,
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t),

  /* Expo */
  easeInExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t) => {
    if (t === 0) return 0
    if (t === 1) return 1
    if (t < 0.5) return 0.5 * Math.pow(2, 20 * t - 10)
    return 1 - 0.5 * Math.pow(2, -20 * t + 10)
  },

  /* Sine */
  easeInSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  /* Back (se pasa y vuelve) */
  easeOutBack: (t) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  easeInBack: (t) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return c3 * t * t * t - c1 * t * t
  },
  easeInOutBack: (t) => {
    const c1 = 1.70158
    const c2 = c1 * 1.525
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
  },

  /* Elastic */
  easeOutElastic: (t) => {
    const c4 = (2 * Math.PI) / 3
    if (t === 0) return 0
    if (t === 1) return 1
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  },
}

/**
 * Recorta un valor al rango [minimo, maximo].
 *
 * @param {number} valor
 * @param {number} minimo
 * @param {number} maximo
 * @returns {number}
 */
export const clamp = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor))

/**
 * Mapea `t` a través de una lista de cuadros clave, estilo Popmotion.
 *
 *   interpolate([0, 0.5, 1], [0, 100, 50])(0.25) === 50
 *
 * Fuera del rango devuelve el extremo correspondiente (no extrapola). `ease` puede ser una
 * función sola (misma para todos los tramos) o un arreglo con una por tramo.
 *
 * @param {number[]} entrada cuadros clave, en orden creciente
 * @param {number[]} salida valor de cada cuadro clave
 * @param {Function|Function[]} [ease]
 * @returns {(t: number) => number}
 */
export function interpolate(entrada, salida, ease = Easing.linear) {
  return (t) => {
    if (t <= entrada[0]) return salida[0]
    if (t >= entrada[entrada.length - 1]) return salida[salida.length - 1]
    for (let i = 0; i < entrada.length - 1; i++) {
      if (t >= entrada[i] && t <= entrada[i + 1]) {
        const tramo = entrada[i + 1] - entrada[i]
        const local = tramo === 0 ? 0 : (t - entrada[i]) / tramo
        const funcion_ease = Array.isArray(ease) ? ease[i] || Easing.linear : ease
        const suavizado = funcion_ease(local)
        return salida[i] + (salida[i + 1] - salida[i]) * suavizado
      }
    }
    return salida[salida.length - 1]
  }
}

/**
 * Tween de un solo tramo: devuelve `from` antes de `start`, `to` después de `end`, y el
 * valor suavizado en el medio.
 *
 * @param {{from?: number, to?: number, start?: number, end?: number, ease?: Function}} opciones
 * @returns {(t: number) => number}
 */
export function animate({ from = 0, to = 1, start = 0, end = 1, ease = Easing.easeInOutCubic }) {
  return (t) => {
    if (t <= start) return from
    if (t >= end) return to
    const local = (t - start) / (end - start)
    return from + (to - from) * ease(local)
  }
}

/**
 * Deriva de la tabla de escenas todo lo que la animación necesita saber del tiempo.
 *
 * Cada escena de la tabla es `{ name, dur, nat? }`. `dur` es lo que dura en pantalla y
 * `nat` la duración en la que fue coreografiada; si no viene `nat`, la escena no está
 * warpeada y vale `dur`.
 *
 * @param {{name: string, dur: number, nat?: number}[]} escenas
 * @returns {{
 *   secciones: {nombre: string, inicio_reloj: number, dur: number, inicio_autoral: number, nat: number}[],
 *   claves: Object<string, number>,
 *   total: number,
 *   total_autoral: number
 * }}
 *   `claves` es el mapa nombre de escena → segundo autoral en el que arranca (lo que la
 *   escena original llama `K` y consigue con `useComposition()`), `total` la duración de
 *   reloj de la animación entera y `total_autoral` la duración en tiempo de coreografía.
 */
export function derivar_escenas(escenas) {
  let inicio_reloj = 0
  let inicio_autoral = 0
  const secciones = []
  const claves = Object.create(null)

  for (let i = 0; i < escenas.length; i++) {
    const escena = escenas[i]
    const nat =
      typeof escena.nat === 'number' && isFinite(escena.nat) && escena.nat > 0
        ? escena.nat
        : escena.dur

    secciones.push({
      nombre: escena.name,
      inicio_reloj: inicio_reloj,
      dur: escena.dur,
      inicio_autoral: inicio_autoral,
      nat: nat,
    })

    /* Si dos escenas se llaman igual, la clave apunta a la PRIMERA. Es lo que hace el
       runtime original y lo que espera la coreografía. */
    if (!Object.prototype.hasOwnProperty.call(claves, escena.name)) {
      claves[escena.name] = Math.round(inicio_autoral * 1000) / 1000
    }

    inicio_reloj += escena.dur
    inicio_autoral += nat
  }

  return {
    secciones: secciones,
    claves: claves,
    total: Math.round(inicio_reloj * 1000) / 1000,
    total_autoral: Math.round(inicio_autoral * 1000) / 1000,
  }
}

/**
 * El warp: convierte un segundo de RELOJ en el segundo AUTORAL equivalente.
 *
 * Ubica en qué escena cae `t`, y adentro de esa escena estira o comprime linealmente el
 * avance según la relación `nat / dur`. Una escena con `dur: 4.1` y `nat: 1.6` reproduce
 * su segundo y medio de coreografía a lo largo de cuatro segundos de pantalla.
 *
 * @param {ReturnType<typeof derivar_escenas>} derivado
 * @param {number} t segundo de reloj
 * @returns {number} segundo autoral, el `T` con el que se calcula toda la escena
 */
export function tiempo_autoral(derivado, t) {
  const secciones = derivado.secciones
  if (secciones.length === 0) return 0

  let indice = secciones.length - 1
  for (let i = 0; i < secciones.length; i++) {
    if (t < secciones[i].inicio_reloj + secciones[i].dur) {
      indice = i
      break
    }
  }

  const seccion = secciones[indice]
  const local = Math.min(Math.max(t - seccion.inicio_reloj, 0), seccion.dur)
  const autoral = seccion.inicio_autoral + (seccion.dur > 0 ? local * (seccion.nat / seccion.dur) : 0)
  return Math.min(autoral, derivado.total_autoral)
}

/**
 * Interpolación lineal simple. La usa toda la escena para mover cosas entre dos puntos.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
export const lerp = (a, b, t) => a + (b - a) * t
