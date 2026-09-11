<template>
  <div class="chip-procesador" :style="estilo_raiz">
    <!-- Los 36 pines (9 por lado). Salen del cuerpo hacia afuera y laten con el pulso. -->
    <div
      v-for="(estilo, indice) in estilos_pines"
      :key="indice"
      class="chip-procesador__pin"
      :style="estilo"
    ></div>

    <!-- El encapsulado: el cuadrado oscuro con el halo azul. -->
    <div class="chip-procesador__cuerpo" :style="estilo_cuerpo"></div>

    <!-- El surco interno, un simple borde a 22px del canto. -->
    <div class="chip-procesador__surco"></div>

    <!-- La pastilla clara del centro, donde vive el isotipo y pasa el barrido. -->
    <div class="chip-procesador__pastilla" :style="estilo_pastilla">
      <div class="chip-procesador__barrido" :style="estilo_barrido"></div>
      <div class="chip-procesador__iso">
        <img src="../../../assets/isotipo-comerciocity.svg" alt="" width="66" height="66" />
      </div>
    </div>

    <!-- El anillo que se expande cada vez que el procesador arranca a trabajar. -->
    <div v-if="estilo_anillo" class="chip-procesador__anillo" :style="estilo_anillo"></div>
  </div>
</template>

<script>
import { Easing, animate, clamp, lerp } from './motor-tiempo'

/* Radio del procesador en unidades del escenario de 1080×1080. Es fijo a propósito: toda
   la geometría de adentro (los pines cada 18, los surcos a 22 y 42, los radios de 42/30/24)
   está calibrada contra este número. Quien lo necesite más chico o más grande lo escala
   desde afuera con un `transform: scale()`, no cambiando esta constante. */
const RADIO = 95

/* El helper de movimiento que le toca al chip: `pop`, tal cual la escena original. Es
   UNO, no tres -- los otros dos de la escena (`enter` y `glide`) viven en el MOTION de
   AnimacionProcesador.vue, que es lo que dice el comentario de allá. */
const MOTION = {
  pop: (s, d) => animate({ from: 0, to: 1, start: s, end: s + (d || 0.7), ease: Easing.easeOutBack }),
}

/* El azul de acento, el mismo en los dos temas (ver ACENTO en AnimacionProcesador.vue). */
const ACENTO_RGB = '47,123,255'

/* ═══ LO QUE CAMBIA CON EL TEMA ══════════════════════════════════════════════════════
   Del chip, el tema claro (11/9/2026, misión experiencia-landing) toca solo TRES cosas, y
   las tres son luz que el chip tira sobre el fondo: los pines, el halo del cuerpo y el
   anillo que se expande al arrancar cada tramo. El encapsulado oscuro, el surco y la
   pastilla clara son iguales en los dos temas -- así está en el jsx claro, y tiene
   sentido: el chip es el objeto, no el fondo.

   🔴 `oscuro` son los valores que el componente tenía escritos a mano hasta ese día.
   `claro` sale del diff `oscuro-scene.jsx` → `comerciocity-scene.jsx`. Las fórmulas
   (alfa = base + rango × pulso, radio = base + rango × pulso) siguen en los computed. */
const PALETA = {
  oscuro: {
    pin_rgb: '120,170,255',
    pin_alfa: [0.34, 0.5],
    /* Las dos sombras fijas del cuerpo (el filete interior y la sombra de apoyo); el halo
       azul que late va aparte: radio y alfa como [base, rango]. */
    cuerpo_sombra: '0 0 0 1px rgba(0,0,0,0.5) inset, 0 30px 80px rgba(0,0,0,0.55)',
    cuerpo_halo_radio: [60, 80],
    cuerpo_halo_alfa: [0.3, 0.38],
    anillo_rgb: '90,169,255',
    anillo_alfa: 0.58,
  },
  claro: {
    pin_rgb: ACENTO_RGB,
    pin_alfa: [0.42, 0.45],
    cuerpo_sombra: '0 0 0 1px rgba(0,0,0,0.4) inset, 0 26px 64px rgba(23,44,88,0.30)',
    cuerpo_halo_radio: [54, 70],
    cuerpo_halo_alfa: [0.24, 0.32],
    anillo_rgb: ACENTO_RGB,
    anillo_alfa: 0.5,
  },
}

export default {
  name: 'ChipProcesador',

  props: {
    /**
     * El tiempo autoral `T` en segundos: el único número del que sale todo el movimiento.
     * Lo calcula el padre con `tiempo_autoral()` de motor-tiempo.js.
     */
    tiempo: {
      type: Number,
      default: 0,
    },
    /**
     * El mapa de claves de escena (`K` en la escena original): nombre de momento →
     * segundo autoral en el que arranca. De todo el mapa, el procesador sólo mira cuatro:
     * `Procesado`, `Logo`, `abs` y `onda`, que son los dos tramos en los que trabaja.
     * Vacío es válido: sin claves el procesador nunca se enciende, que es exactamente lo
     * que se quiere cuando se lo muestra quieto.
     */
    claves: {
      type: Object,
      default: () => ({}),
    },
    /**
     * Centro del procesador en el eje X, en unidades del escenario.
     *
     * El componente se posiciona SIEMPRE en absoluto (mide 190×190 y se coloca en
     * `x - 95` / `y - 95`), así que para reusarlo fuera de la animación alcanza con
     * envolverlo en un contenedor `position: relative` y pasarle `x` e `y` iguales a la
     * mitad de ese contenedor. Si hace falta más chico o más grande, se lo escala desde
     * afuera con un `transform: scale()`: el radio de 95 es fijo porque toda la geometría
     * interna está calibrada contra él.
     *
     * ⚠️ Ese reuso es una posibilidad, no un caso existente: hasta el 10/9/2026 acá
     * decía "el cubo 3D" y era falso. CuboProcesador.vue NO monta este componente --
     * dibuja el chip de cada cara con su propio markup y lo dice explícitamente en el
     * comentario de `.demo-cubo__chip` ("no se reemplaza por ChipProcesador.vue, que es
     * otra cosa"). El único que lo monta es AnimacionProcesador.vue.
     */
    x: {
      type: Number,
      default: 540,
    },
    /** Centro del procesador en el eje Y, en unidades del escenario. */
    y: {
      type: Number,
      default: 462,
    },
    /**
     * true para mostrarlo quieto: ya nacido, a escala 1, sin pulso, sin barrido y sin
     * anillo -- el procesador como objeto de la escena, no como algo que esté procesando.
     *
     * Hoy lo prende UN solo consumidor: AnimacionProcesador.vue bajo
     * `prefers-reduced-motion` (`:quieto="reduced_motion"`). Hasta el 10/9/2026 acá decía
     * que también lo usaba "el cubo 3D" y era falso: CuboProcesador.vue no monta este
     * componente en ningún momento, resuelve el chip de sus caras con su propio dibujo.
     *
     * Se conserva igual, y a propósito: es parte de la API del componente y es la única
     * forma de mostrarlo sin línea de tiempo (con `claves` vacío nunca se enciende, pero
     * tampoco nace). Que hoy tenga un solo consumidor no lo vuelve código muerto -- que
     * mañana tenga cero, sí.
     */
    quieto: {
      type: Boolean,
      default: false,
    },
    /**
     * Tema visual, `'oscuro'` | `'claro'`: elige la entrada de PALETA. Se lo pasa
     * AnimacionProcesador.vue con el suyo; el default oscuro es lo que el chip mostró
     * siempre.
     */
    tema: {
      type: String,
      default: 'oscuro',
      validator: (valor) => valor === 'oscuro' || valor === 'claro',
    },
  },

  computed: {
    /**
     * La paleta del tema en uso; con un valor desconocido cae al oscuro (mismo criterio
     * que el `paleta` de AnimacionProcesador.vue).
     *
     * @returns {Object}
     */
    paleta() {
      return PALETA[this.tema] || PALETA.oscuro
    },

    /* ⛔ RETIRADO (10/9/2026, misión experiencia-nueva): el computed `radio()`, que
       devolvía la constante RADIO con el doc "Radio expuesto al template y a quien lo
       consulte". No lo consultaba nadie -- verificado con grep sobre todo src/: el
       template de este archivo no lo nombra, y ningún componente tiene un `ref` a este
       chip (AnimacionProcesador.vue lo monta sin ref). La constante RADIO sigue arriba y
       la usa el propio componente; lo que se va es el envoltorio que prometía una API
       pública que nadie pidió. */

    /** El "nacimiento": el rebote con el que entra al principio de la animación. */
    nacido() {
      if (this.quieto) return 1
      return MOTION.pop(0.85, 0.8)(this.tiempo)
    },

    /** Primer tramo de trabajo: cuando absorbe las seis tarjetas y las procesa. */
    procesando_uno() {
      if (this.quieto) return false
      const k = this.claves
      return this.tiempo > k.Procesado + 0.3 && this.tiempo < k.Logo + 0.05
    },

    /** Segundo tramo: cuando se traga los tres textos y saca el mensaje de IA. */
    procesando_dos() {
      if (this.quieto) return false
      const k = this.claves
      return this.tiempo > k.abs && this.tiempo < k.onda + 0.12
    },

    encendido() {
      return this.procesando_uno || this.procesando_dos
    },

    /** Latido a 3,2 Hz mientras trabaja. Alimenta el brillo, el halo y los pines. */
    pulso() {
      if (!this.encendido) return 0
      return (0.5 + 0.5 * Math.sin(2 * Math.PI * 3.2 * this.tiempo)) * 0.8
    },

    /** Posición 0..1 de la banda que barre la pastilla de arriba abajo. */
    barrido() {
      if (!this.encendido) return 0
      return (this.tiempo * 2.4) % 1
    },

    /** Apertura 0..1 del anillo que sale del procesador al arrancar cada tramo. */
    anillo() {
      const k = this.claves
      if (this.procesando_uno) return clamp((this.tiempo - k.Procesado - 0.4) / 1.0, 0, 1)
      if (this.procesando_dos) return clamp((this.tiempo - k.abs - 0.4) / 1.0, 0, 1)
      return 0
    },

    escala() {
      /* Al nacer crece de 0,72 a 1; después respira apenas con el pulso, y respira más
         en el segundo tramo que en el primero. */
      const respiro = 1 + 0.03 * this.pulso * (this.procesando_dos ? 1 : 0.4)
      return lerp(0.72, 1, this.nacido) * respiro
    },

    estilo_raiz() {
      return {
        left: this.x - RADIO + 'px',
        top: this.y - RADIO + 'px',
        width: RADIO * 2 + 'px',
        height: RADIO * 2 + 'px',
        transform: 'scale(' + this.escala.toFixed(4) + ')',
        opacity: this.nacido,
      }
    },

    estilos_pines() {
      const P = this.paleta
      const color =
        'rgba(' + P.pin_rgb + ',' + (P.pin_alfa[0] + P.pin_alfa[1] * this.pulso).toFixed(3) + ')'
      const estilos = []

      for (let lado = 0; lado < 4; lado++) {
        for (let i = 0; i < 9; i++) {
          /* Nueve pines por lado, centrados: de -72 a +72 de a 18. */
          const desplazamiento = -72 + i * 18
          const cerca = RADIO + desplazamiento - 3 + 'px'
          const estilo = { background: color }

          if (lado === 0) {
            Object.assign(estilo, { left: cerca, top: '-9px', width: '6px', height: '12px' })
          } else if (lado === 1) {
            Object.assign(estilo, { left: cerca, bottom: '-9px', width: '6px', height: '12px' })
          } else if (lado === 2) {
            Object.assign(estilo, { top: cerca, left: '-9px', width: '12px', height: '6px' })
          } else {
            Object.assign(estilo, { top: cerca, right: '-9px', width: '12px', height: '6px' })
          }

          estilos.push(estilo)
        }
      }

      return estilos
    },

    estilo_cuerpo() {
      const p = this.pulso
      const P = this.paleta
      return {
        boxShadow:
          P.cuerpo_sombra +
          ', 0 0 ' +
          (P.cuerpo_halo_radio[0] + P.cuerpo_halo_radio[1] * p) +
          'px rgba(' +
          ACENTO_RGB +
          ',' +
          (P.cuerpo_halo_alfa[0] + P.cuerpo_halo_alfa[1] * p).toFixed(3) +
          ')',
      }
    },

    estilo_pastilla() {
      const p = this.pulso
      return {
        boxShadow:
          '0 0 ' +
          (26 + 46 * p) +
          'px rgba(70,150,255,' +
          (0.45 + 0.42 * p).toFixed(3) +
          '), 0 0 0 1px rgba(255,255,255,0.55) inset',
      }
    },

    estilo_barrido() {
      return {
        top: -46 + this.barrido * 152 + 'px',
        opacity: this.encendido ? 1 : 0,
      }
    },

    /** null cuando no hay anillo que dibujar: así el template lo saca del DOM. */
    estilo_anillo() {
      const a = this.anillo
      if (!this.encendido || a <= 0.01) return null
      const P = this.paleta
      return {
        left: RADIO - 148 * a + 'px',
        top: RADIO - 148 * a + 'px',
        width: 296 * a + 'px',
        height: 296 * a + 'px',
        borderColor: 'rgba(' + P.anillo_rgb + ',' + (P.anillo_alfa * (1 - a)).toFixed(3) + ')',
      }
    },
  },
}
</script>

<style scoped>
/* Todo lo de acá está en unidades del escenario de 1080×1080: el escenario entero se
   escala de una sola vez desde AnimacionProcesador.vue, así que estos px no son px de
   pantalla y no hay que hacerlos responsive uno por uno. */
.chip-procesador {
  position: absolute;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}

.chip-procesador__pin {
  position: absolute;
  border-radius: 3px;
}

.chip-procesador__cuerpo {
  position: absolute;
  inset: 0;
  border-radius: 42px;
  background: linear-gradient(155deg, #16203a 0%, #0b1120 58%, #0a0e1a 100%);
  border: 1px solid rgba(130, 180, 255, 0.3);
}

.chip-procesador__surco {
  position: absolute;
  inset: 22px;
  border-radius: 30px;
  border: 1px solid rgba(120, 170, 255, 0.16);
}

.chip-procesador__pastilla {
  position: absolute;
  inset: 42px;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(150deg, #ffffff 0%, #eef4ff 46%, #dae7fb 100%);
}

.chip-procesador__barrido {
  position: absolute;
  left: 0;
  right: 0;
  height: 46px;
  background: linear-gradient(
    180deg,
    rgba(47, 123, 255, 0) 0%,
    rgba(47, 123, 255, 0.34) 50%,
    rgba(47, 123, 255, 0) 100%
  );
}

.chip-procesador__iso {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* El isotipo del proyecto (SVG, 1,2 KB) en lugar del PNG del export: es el mismo dibujo
   y no suma un archivo nuevo. Va cuadrado porque el SVG lo es (viewBox 256×256); el PNG
   original era 66×71 sólo por el relleno transparente que traía. */
.chip-procesador__iso img {
  display: block;
  width: 66px;
  height: 66px;
}

.chip-procesador__anillo {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
}
</style>
