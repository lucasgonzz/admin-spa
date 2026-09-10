<template>
  <div
    ref="raiz"
    class="animacion-procesador"
    role="img"
    :aria-label="ETIQUETA_ACCESIBLE"
  >
    <!-- ═══ EL FONDO, A SANGRE ═══════════════════════════════════════════════════════
         Va POR FUERA del escenario a propósito: el degradé oscuro y las líneas de
         circuito ocupan toda la pantalla, no el cuadrado de 1080. Es el punto donde el
         port se separa del original, que asumía un lienzo cuadrado -- así, en escritorio
         16:9, no quedan bandas negras a los costados. -->
    <div class="animacion-procesador__degrade" aria-hidden="true"></div>

    <svg
      class="animacion-procesador__circuito"
      viewBox="0 0 1080 1080"
      preserveAspectRatio="xMidYMid slice"
      :style="{ opacity: 0.5 * bloom }"
      aria-hidden="true"
      focusable="false"
    >
      <g :transform="transform_circuito">
        <path v-for="(trazo, indice) in TRAZOS" :key="indice" :d="trazo" />
      </g>
    </svg>

    <!-- ═══ EL ESCENARIO: 1080×1080, centrado y escalado de una sola vez ═══════════════
         Todo lo de adentro se posiciona en unidades de ese cuadrado, igual que el
         original -- pero, a diferencia del original, el cuadrado NO recorta: recorta la
         pantalla. Ver el comentario del `overflow` en el <style>. -->
    <div class="animacion-procesador__escenario" :style="estilo_escenario">
      <!-- El resplandor que sigue al procesador. Queda DENTRO del escenario y FUERA de la
           cámara, igual que en el original: no se mueve con el zoom. -->
      <div class="animacion-procesador__resplandor" :style="estilo_resplandor" aria-hidden="true"></div>

      <!-- La regla invisible con la que se mide si algún titular desborda el cuadro. Ver
           medir_textos(). -->
      <div ref="regla" class="animacion-procesador__regla" aria-hidden="true">
        <span class="animacion-procesador__titular" data-clave="carga">{{ TEXTOS.carga }}</span>
        <span class="animacion-procesador__titular" data-clave="vende">{{ TEXTOS.vende }}</span>
        <span class="animacion-procesador__rasgo" data-clave="f1">{{ TEXTOS.f1 }}</span>
        <span class="animacion-procesador__rasgo" data-clave="f2">{{ TEXTOS.f2 }}</span>
        <span class="animacion-procesador__ia" data-clave="ia">{{ TEXTOS.ia }}</span>
      </div>

      <div class="animacion-procesador__camara" :style="{ transform: camara }">
        <!-- ── Toma 1: los seis problemas sueltos, sus cables y el círculo ───────────── -->
        <div
          class="animacion-procesador__toma"
          :style="{ visibility: toma_problemas ? 'visible' : 'hidden' }"
        >
          <svg
            v-if="conexiones"
            class="animacion-procesador__conexiones"
            :width="geo.w"
            :height="geo.h"
            aria-hidden="true"
            focusable="false"
          >
            <g v-for="cable in conexiones" :key="cable.indice" :opacity="cable.opacidad">
              <line
                :x1="cable.x1"
                :y1="cable.y1"
                :x2="cable.x2"
                :y2="cable.y2"
                :stroke="ACENTO"
                :stroke-width="cable.ancho"
                stroke-linecap="round"
                :stroke-dasharray="cable.largo"
                :stroke-dashoffset="cable.recorte"
              />
              <circle
                v-for="(punto, k) in cable.puntos"
                :key="k"
                :cx="punto.cx"
                :cy="punto.cy"
                r="4.2"
                fill="#bcd9ff"
                :opacity="punto.opacidad"
              />
            </g>
          </svg>

          <div
            v-for="tarjeta in tarjetas"
            :key="tarjeta.indice"
            class="animacion-procesador__tarjeta"
            :style="tarjeta.estilo"
          >
            <div class="animacion-procesador__caja-icono">
              <svg
                class="animacion-procesador__icono"
                width="26"
                height="26"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <g v-if="tarjeta.icono === 'ventas'">
                  <rect x="2.2" y="6.2" width="19.6" height="11.6" rx="2.6" />
                  <circle cx="12" cy="12" r="2.6" />
                  <path d="M5.6 12h.5M17.9 12h.5" />
                </g>
                <g v-else-if="tarjeta.icono === 'stock'">
                  <path d="M21 8.2 12 3.4 3 8.2v7.6l9 4.8 9-4.8z" />
                  <path d="M3 8.2l9 4.8 9-4.8M12 13v7.6" />
                </g>
                <g v-else-if="tarjeta.icono === 'cuentas'">
                  <path d="M4.4 4.2h12.4a2 2 0 0 1 2 2v13.6H6.4a2 2 0 0 1-2-2z" />
                  <path d="M8 8.4h7M8 12.2h7" />
                </g>
                <g v-else-if="tarjeta.icono === 'ecom'">
                  <circle cx="9.4" cy="19.6" r="1.5" />
                  <circle cx="17.8" cy="19.6" r="1.5" />
                  <path d="M2.6 3.4h2.7l2.5 11.4h10.2L21 6.8H6.2" />
                </g>
                <g v-else-if="tarjeta.icono === 'wa'">
                  <path d="M20.8 11.6a8.4 8.4 0 0 1-12.5 7.3L3.4 20.4l1.6-4.7A8.4 8.4 0 1 1 20.8 11.6z" />
                  <path d="M9 10.2c.6 2.2 2.4 3.9 4.6 4.5" />
                </g>
                <g v-else>
                  <rect x="3" y="4.4" width="18" height="15.2" rx="2.4" />
                  <circle cx="8.6" cy="9.8" r="1.5" />
                  <path d="M21 15.6l-4.8-4.6L7 19.6" />
                </g>
              </svg>
            </div>
            <div class="animacion-procesador__rotulo">{{ tarjeta.texto }}</div>
          </div>
        </div>

        <!-- ── Todo lo que el procesador emite: sale de su centro, chico, y sube ─────── -->
        <div v-if="emitidos.logo" class="animacion-procesador__emitido" :style="emitidos.logo">
          <img
            class="animacion-procesador__logotipo"
            src="../../../assets/logotipo-comerciocity.png"
            alt=""
            width="334"
            height="77"
          />
        </div>

        <div v-if="emitidos.carga" class="animacion-procesador__emitido" :style="emitidos.carga">
          <div class="animacion-procesador__titular" :style="ajuste('carga')">{{ TEXTOS.carga }}</div>
        </div>

        <div v-if="emitidos.vende" class="animacion-procesador__emitido" :style="emitidos.vende">
          <div
            class="animacion-procesador__titular animacion-procesador__recorte animacion-procesador__titular--degrade"
            :style="ajuste('vende')"
          >{{ TEXTOS.vende }}</div>
        </div>

        <div v-if="emitidos.f1" class="animacion-procesador__emitido" :style="emitidos.f1">
          <div class="animacion-procesador__rasgo" :style="ajuste('f1')">{{ TEXTOS.f1 }}</div>
        </div>
        <div v-if="emitidos.f2" class="animacion-procesador__emitido" :style="emitidos.f2">
          <div class="animacion-procesador__rasgo" :style="ajuste('f2')">{{ TEXTOS.f2 }}</div>
        </div>

        <div v-if="emitidos.logo_ia" class="animacion-procesador__emitido" :style="emitidos.logo_ia">
          <img
            class="animacion-procesador__logotipo"
            src="../../../assets/logotipo-comerciocity.png"
            alt=""
            width="334"
            height="77"
          />
        </div>
        <div v-if="emitidos.ia" class="animacion-procesador__emitido" :style="emitidos.ia">
          <div
            class="animacion-procesador__ia"
            :class="{ 'animacion-procesador__recorte': ondeando }"
            :style="estilo_ia"
          >{{ TEXTOS.ia }}</div>
        </div>

        <!-- ── Las dos líneas que el cuadro estático suma a la composición final ─────── -->
        <template v-if="reduced_motion">
          <div
            class="animacion-procesador__emitido animacion-procesador__emitido--quieto"
            :style="{ top: alto_reposo(282) + 'px' }"
          >
            <div class="animacion-procesador__titular" :style="ajuste('carga')">{{ TEXTOS.carga }}</div>
          </div>
          <div
            class="animacion-procesador__emitido animacion-procesador__emitido--quieto"
            :style="{ top: alto_reposo(356) + 'px' }"
          >
            <div
              class="animacion-procesador__titular animacion-procesador__recorte animacion-procesador__titular--degrade"
              :style="ajuste('vende')"
            >{{ TEXTOS.vende }}</div>
          </div>
        </template>

        <chip-procesador
          :tiempo="tiempo"
          :claves="claves_escena"
          :x="geo.cx"
          :y="chip_y"
          :quieto="reduced_motion"
        />
      </div>
    </div>

    <!-- La viñeta, también a sangre y por encima de todo: en el original enmarcaba el
         cuadrado, acá enmarca la pantalla, que es lo que pide el encuadre a sangre. -->
    <div class="animacion-procesador__vineta" aria-hidden="true"></div>
  </div>
</template>

<script>
import ChipProcesador from './ChipProcesador.vue'
import {
  Easing,
  animate,
  clamp,
  derivar_escenas,
  interpolate,
  lerp,
  tiempo_autoral,
} from './motor-tiempo'

/* ═══ La escena, tal como salió del export ═══════════════════════════════════════════
   Estos números NO se deducen de nuevo: están medidos contra la escena original y
   cambiarlos desarma la coreografía. Son los de la composición HORIZONTAL, que es la que
   Lucas aprobó en Claude Design y no se toca. */

const W = 1080
const H = 1080
const CX = 540
const CY = 462
const R = 372
const CARD_W = 258
const CARD_H = 78

/* Cuánto baja el procesador cuando termina de descender. */
const CHIP_DOWN = 700

/* ═══ La composición VERTICAL ═════════════════════════════════════════════════════════
   En una pantalla parada el cuadrado de 1080 es un mal encuadre y está MEDIDO: a 390×844
   la escala cae a 0,361, el cuadrado ocupa 390 px de los 844 de alto —menos de la mitad
   de la pantalla— y el rótulo de las tarjetas, que son 22 unidades, aterriza en 7,9 px
   reales. Ilegible.

   La salida no es agrandar la tipografía tarjeta por tarjeta: es ACHICAR EL ESPACIO DE
   COORDENADAS. El tamaño real de cualquier cosa de la escena es
   `unidades × (ancho del contenedor / ancho del espacio)`, así que pasar el espacio de
   1080 a 600 unidades de ancho multiplica TODO por 1,8 de una sola vez —la tipografía, el
   procesador, los iconos, los cables— sin tocar un solo tamaño. A 390 px de ancho la
   escala pasa a 0,65 y ese mismo rótulo de 22 unidades da 14,3 px reales.

   Lo que sí hay que recomponer es la geometría: en un espacio de 600×(alto real) el
   círculo de tarjetas no entra, así que se estira a ELIPSE —angosta y alta— y el
   procesador queda en el centro exacto. Decisión de Lucas, 10/9/2026.

   🔴 La coreografía no cambia: son las mismas 12 escenas, los mismos tiempos y los mismos
   beats. Cambia DÓNDE está cada cosa, nunca CUÁNDO pasa. */

/**
 * A partir de qué proporción `alto / ancho` entra la composición vertical.
 *
 * 1,55 no es un número redondo elegido de arriba: cae en el hueco que hay entre las dos
 * familias de pantallas paradas que existen de verdad.
 *
 *   · La tablet más estirada en vertical —iPad Air 11", 820×1180— da 1,44, y ahí el
 *     cuadrado todavía funciona: el rótulo mide 16,7 px reales.
 *   · El teléfono más achaparrado que sigue vivo —360×640 y 375×667— da 1,78, y ahí ya
 *     no: 7,3 px.
 *
 * Cualquier corte entre 1,45 y 1,77 parte la misma frontera; 1,55 la parte al medio y deja
 * margen para los dos lados. Se mide contra la caja del componente y no contra el
 * user-agent, así que rotar el teléfono devuelve la composición horizontal sin nada
 * especial: 844×390 da 0,46 y entra por el mismo camino que el escritorio.
 */
const UMBRAL_VERTICAL = 1.55

/**
 * El ancho del espacio de coordenadas vertical.
 *
 * Sale de despejar el requisito de legibilidad: el rótulo son 22 unidades y tiene que dar
 * 13 px reales o más a 390 px de ancho, o sea `22 × 390 / V_W ≥ 13` → `V_W ≤ 660`. Se toma
 * 600 en vez de 660 para que la cuenta también cierre en el teléfono chico de 360 px, donde
 * el mismo rótulo da 13,2 px.
 */
const V_W = 600

/**
 * El semieje horizontal de la elipse de tarjetas.
 *
 * Lo limita el ancho de la tarjeta y no el gusto: las tarjetas laterales caen a
 * `±sen(60°) · V_RX` del centro y miden 258 de ancho, así que
 * `0,866 · V_RX + 129 ≤ V_W / 2` obliga a `V_RX ≤ 197` para que apenas rocen el borde.
 * Con 170 quedan 24 unidades de aire de cada lado (unos 15 px reales a 390).
 */
const V_RX = 170

/** Aire entre el canto de la tarjeta de arriba (y la de abajo) y el borde de la pantalla. */
const V_MARGEN = 34

/**
 * Techo del semieje vertical, en múltiplos de `V_RX`.
 *
 * Sin techo, una pantalla absurdamente larga estiraría la elipse hasta que las tarjetas
 * quedaran desparramadas sin relación entre sí. 3,9 corresponde a una proporción de 2,45,
 * o sea más que cualquier teléfono real —el más largo de uso corriente, 412×915, da 2,22—,
 * así que en la práctica no llega a actuar nunca: es una red, no una regla de diseño.
 */
const V_RY_MAXIMO = V_RX * 3.9

/**
 * El zoom de la cámara en vertical, cuadro por cuadro (los tiempos son los mismos).
 *
 * 🔴 En vertical **el primer plano ya no lo hace el zoom, lo hace el espacio**, y esto no
 * es una renuncia: en el cuadrado el 1,7 existe porque una tarjeta de 258 sobre 1080 es
 * apenas el 24 % del ancho y sin acercarse no se lee; en un espacio de 600 esa misma
 * tarjeta ya ocupa el 43 %, o sea *más* de lo que ocupaba allá acercándose. El acercamiento
 * está hecho antes de que la cámara toque nada.
 *
 * Lo que sí queda es el barrido: el foco arranca arriba del anillo y baja hasta el centro
 * cuando el anillo cierra, que en una elipse tan alta son 405 unidades —un tercio de la
 * pantalla— y se ve perfectamente. El beat es el mismo y cae en el mismo instante.
 *
 * El 1,06 es un techo MEDIDO, no una preferencia: con la cámara en `z`, el borde izquierdo
 * visible es `300 − 300/z`, y la tarjeta más a la izquierda del anillo empieza en la unidad
 * 23,8 (`300 − sen(60°)·V_RX − 129`). Pasando de 1,086 la pantalla le come el canto a esa
 * tarjeta; con 1,7 —el número del cuadrado— la guillotina. Se probó y se ve.
 */
const V_ZOOM = [1.06, 1.04, 1, 1, 1, 1]

/* Las alturas de descanso de cada cosa que el procesador emite. */
const Y_LOGO = 152
const Y_SLOT = 282
/* Dos líneas, no tres (ver TEXTOS). Centradas en el MISMO eje que ocupaban las tres del
   export --el medio era 392-- así el bloque emitido queda donde la coreografía lo dejaba:
   346 y 438 son 392 ∓ 46, la mitad de los 92 que separaban a las tres. */
const Y_T1 = 346
const Y_T2 = 438
const Y_IA = 430

/* Ritmo de entrada de las seis tarjetas: la primera a los 0,34 s, una cada 0,72 s, y la
   primera se queda un segundo más sola antes de que llegue la segunda. */
const T0 = 0.34
const STEP = 0.72
const HOLD1 = 1.0

/* Toda aparición de texto dura lo mismo. */
const EM = 0.75

const ACENTO = '#2f7bff'

/* Margen por lado que se le deja a un titular con `nowrap` antes de encogerlo, en unidades
   del escenario. El ancho útil sale de restárselo dos veces al ancho del espacio: 1020
   sobre los 1080 del cuadrado, 540 sobre los 600 de la vertical. Ver medir_textos(). */
const MARGEN_TEXTO = 30

/**
 * La tabla de escenas del export (`window.OM_SCENES`). `dur` es lo que cada escena dura en
 * pantalla y `nat` la duración en la que fue coreografiada; el motor warpea una en la otra.
 * Los `dur` suman 24,4 s, que es la duración total de la animación.
 */
const ESCENAS = [
  { name: 'Problemas', dur: 6.5, nat: 5.9 },
  { name: 'Conexion', dur: 1, nat: 1.2 },
  { name: 'Procesado', dur: 1, nat: 1.4 },
  { name: 'Logo', dur: 1.1 },
  { name: 'Carga una vez', dur: 1.4, nat: 1.2 },
  { name: 'Vende en todos lados', dur: 1.6, nat: 1.3 },
  { name: 'Bajada', dur: 1.4 },
  { name: 'Whatsapp', dur: 4.1, nat: 1.6 },
  { name: 'Absorcion', dur: 0.7, nat: 1.2 },
  { name: 'Procesado IA', dur: 1, nat: 1.2 },
  { name: 'Onda IA', dur: 3 },
  { name: 'Cierre', dur: 1.6 },
]

/**
 * El copy de la escena. Se le pusieron los acentos que el export no tenía ("gestión",
 * "fácil", "imágenes", "depósito") y se corrigió "Whatsapp" → "WhatsApp": es una página
 * pública en castellano y el export venía sin ellos por una limitación de su editor, no
 * por una decisión de redacción.
 */
const TEXTOS = {
  carga: 'Cargá una vez',
  vende: 'Vendé en todos lados',
  /* 🔴 Estas dos líneas son las que Lucas escribió en el pedido, NO las que traía el
     export de Claude Design. El export venía con "Tienda Online" / "Atender a tus
     clientes por WhatsApp" / "Sistema de gestión completo y amigable" -- los valores que
     quedaron cargados en el editor mientras diseñaba-- y el port se los quedó sin que
     nadie lo notara. Lo levantó el chequeo independiente el 10/9/2026 y Lucas eligió su
     propio texto: se perdían IMÁGENES y CARGA DE FACTURAS, que son dos de las cosas que
     más lo diferencian, y entraba una línea genérica que él nunca escribió.

     Y son DOS, no tres: su frase agrupa cuatro conceptos de a dos ("Imágenes y tienda
     online, WhatsApp y carga de facturas"), y la tercera ranura del export decía
     justamente la línea que se descartó. El remate sigue siendo `ia`, que ya era el
     suyo. */
  f1: 'Imágenes y tienda online',
  f2: 'WhatsApp y carga de facturas',
  ia: 'Todo asistido por IA, nunca fue tan fácil',
}

const ETIQUETA_ACCESIBLE =
  'ComercioCity: cargá una vez, vendé en todos lados. Tienda online, atención por ' +
  'WhatsApp y un sistema de gestión completo, todo asistido por IA.'

/** Las seis cosas sueltas que hoy el comerciante maneja por separado. */
const TARJETAS = [
  { t: 'Ventas en negro y blanco', ic: 'ventas' },
  { t: 'Stock multi depósito', ic: 'stock' },
  { t: 'Cuentas corrientes', ic: 'cuentas' },
  { t: 'Tienda online', ic: 'ecom' },
  { t: 'Contestar WhatsApp', ic: 'wa' },
  { t: 'Cargar imágenes', ic: 'img' },
]
const N = TARJETAS.length
const ARC = 360 / N

/** Las líneas de circuito del fondo. */
const TRAZOS = [
  'M-40 190 H150 l46 46 H360',
  'M-40 690 H120 l52 -52 H330 l40 40 H470',
  'M1120 150 H960 l-48 48 H760',
  'M1120 560 H980 l-44 -44 H820 l-38 38 H700',
  'M180 -40 V120 l44 44 V300',
  'M900 -40 V180 l-40 40 V340',
  'M240 1120 V960 l50 -50 V800',
  'M860 1120 V920 l-44 -44 V740',
  'M-40 400 H90 l38 38 H240',
  'M1120 880 H1000 l-40 -40 H860',
]

/* ── Exactamente dos helpers de movimiento (el tercero, `pop`, vive en el chip) ─────── */
const MOTION = {
  enter: (s, d) => animate({ from: 0, to: 1, start: s, end: s + (d || 0.34), ease: Easing.easeOutCubic }),
  glide: (s, e) => animate({ from: 0, to: 1, start: s, end: e, ease: Easing.easeInOutCubic }),
}

/** Segundo autoral en el que llega la tarjeta `i`. */
const llegada = (i) => T0 + i * STEP + (i >= 1 ? HOLD1 : 0)

/**
 * Un punto sobre la ELIPSE de tarjetas: 0° es arriba y el ángulo crece en sentido horario.
 *
 * Con `rx === ry` es literalmente la fórmula polar de siempre —la composición horizontal
 * pasa por acá y sale con los mismos números hasta el último bit—; con `rx < ry` es la
 * elipse angosta y alta de la composición vertical.
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} rx semieje horizontal
 * @param {number} ry semieje vertical
 * @param {number} grados
 * @returns {number[]} el par [x, y]
 */
function pol(cx, cy, rx, ry, grados) {
  const a = (grados * Math.PI) / 180
  return [cx + rx * Math.sin(a), cy - ry * Math.cos(a)]
}

/** El techo de dt de un cuadro: una pestaña que vuelve no tiene que saltar la animación. */
const DT_MAXIMO = 0.1

export default {
  name: 'AnimacionProcesador',

  components: { ChipProcesador },

  props: {
    /**
     * Progreso [0,1] de la sección, si el padre lo pasa atado. Es la misma señal que
     * emite FondoSeccionSticky. **Adelanta** la línea de tiempo: nunca la rebobina ni la
     * reemplaza, así que la animación sigue corriendo sola aunque nadie scrollee.
     * Alternativa equivalente: llamar al método `adelantar_desde_scroll()` por `ref`.
     */
    progreso: {
      type: Number,
      default: null,
    },
  },

  emits: ['terminada'],

  data() {
    return {
      /** Segundo de RELOJ, de 0 a 24,4. El tiempo autoral sale de acá vía el warp. */
      tiempo_reloj: 0,
      /**
       * La caja del componente, medida. De estos dos números sale TODO el encuadre: qué
       * composición entra, con qué escala y qué forma tiene la elipse de tarjetas. En 0
       * hasta la primera medición, y ahí `geo` devuelve el cuadrado a escala 1.
       */
      ancho_caja: 0,
      alto_caja: 0,
      /** true si el sistema pide reduced-motion: cuadro estático, sin reloj y sin rAF. */
      reduced_motion: false,
      /**
       * true si la animación está en pantalla. Arranca en true a propósito: hasta que el
       * observer entregue su primera medición no hay que pausar nada, y si el navegador
       * no tiene IntersectionObserver se queda en true para siempre.
       */
      en_viewport: true,
      /** true cuando el reloj llegó al final. Ahí se suelta el rAF y se sostiene el cuadro. */
      terminada: false,
      /** Handle del requestAnimationFrame en vuelo, o null. */
      raf: null,
      /** Timestamp del cuadro anterior, o null cuando el reloj está frenado. */
      ultimo_ts: null,
      /** El IntersectionObserver que vigila si la animación se ve, o null. */
      observador: null,
      /** El ResizeObserver que recalcula la escala, o null. */
      redimensionador: null,
      /**
       * Ancho natural de cada titular, en unidades del escenario. Se mide una sola vez y
       * sirve para las dos composiciones: la unidad no cambia, lo que cambia es contra qué
       * ancho útil se la compara. Ver medir_textos() y ajuste().
       */
      anchos_texto: {},
    }
  },

  computed: {
    /* Constantes que el template necesita nombrar. */
    TEXTOS: () => TEXTOS,
    TRAZOS: () => TRAZOS,
    ACENTO: () => ACENTO,
    ETIQUETA_ACCESIBLE: () => ETIQUETA_ACCESIBLE,

    /**
     * El encuadre entero, resuelto de una sola vez: qué composición entra, con qué escala,
     * qué tamaño tiene el espacio de coordenadas y dónde y cómo es la elipse de tarjetas.
     *
     * Es el ÚNICO lugar del componente donde se decide algo por el tamaño de la pantalla.
     * Todo lo demás —la coreografía, los tiempos, las opacidades— lee de acá y no vuelve a
     * preguntar por la caja.
     *
     * @returns {{vertical: boolean, escala: number, w: number, h: number, cx: number,
     *            cy: number, rx: number, ry: number}}
     *   `cy` es el centro de la elipse Y la altura de reposo del procesador: en la escena
     *   original los dos son el mismo punto y acá se sostiene.
     */
    geo() {
      const ancho = this.ancho_caja
      const alto = this.alto_caja

      /* Antes de la primera medición, el cuadrado a escala 1: exactamente el estado que
         tenía el componente en su primer cuadro antes de que existiera la vertical. */
      const cuadrado = {
        vertical: false,
        escala: 1,
        w: W,
        h: H,
        cx: CX,
        cy: CY,
        rx: R,
        ry: R,
      }
      if (!(ancho > 0) || !(alto > 0)) return cuadrado

      /* ── Composición HORIZONTAL: el cuadrado de 1080, escalado por el lado más corto.
         🔴 Ni un número de acá cambió respecto del port original. */
      if (alto / ancho <= UMBRAL_VERTICAL) {
        return Object.assign({}, cuadrado, { escala: Math.min(ancho, alto) / W })
      }

      /* ── Composición VERTICAL: el espacio se angosta a V_W y se estira hasta el alto
         real de la pantalla, así que el escenario TAPA el viewport en vez de dejar dos
         bandas muertas. El procesador queda en el centro exacto y la elipse crece hasta
         donde le dé el alto. */
      const escala = ancho / V_W
      const h = alto / escala
      const ry = Math.max(
        CARD_H,
        Math.min(h / 2 - CARD_H / 2 - V_MARGEN, V_RY_MAXIMO)
      )

      return {
        vertical: true,
        escala: escala,
        w: V_W,
        h: h,
        cx: V_W / 2,
        cy: h / 2,
        rx: V_RX,
        ry: ry,
      }
    },

    /* ⛔ RETIRADOS (10/9/2026, misión experiencia-nueva): los computed `vertical()` y
       `escala()`, que devolvían `this.geo.vertical` y `this.geo.escala`. Ninguno tenía
       consumidor -- verificado con grep sobre todo src/, incluido el template de este
       mismo archivo: `vertical` solo aparece en comentarios y dentro de `geo`, y quien
       necesita la escala usa `g.escala` directo (ver `estilo_escenario`). El doc de
       `vertical()` decía "Lo usa el template y lo mira el chequeo" y las dos mitades eran
       falsas: el template no lo nombra y no hay ningún chequeo que lo lea (el único ref
       externo a este componente es el de ScrollDolor.vue, que solo llama
       `adelantar_desde_scroll()`). Si algún día hace falta exponerlos, es de una línea;
       lo que no vale es dejarlos con un doc que asegura un consumidor inexistente. */

    /** Ancho que le queda a un titular con `nowrap` antes de tener que encogerlo. */
    ancho_util() {
      return this.geo.w - 2 * MARGEN_TEXTO
    },

    /** La tabla de escenas ya derivada: secciones, claves, duración de reloj y autoral. */
    derivado() {
      return derivar_escenas(ESCENAS)
    },

    /** Duración total en tiempo de reloj: 24,4 s. */
    duracion() {
      return this.derivado.total
    },

    /**
     * El tiempo autoral `T`: el único número del que sale toda la escena. Sale de warpear
     * el segundo de reloj contra la tabla de escenas.
     */
    tiempo() {
      return tiempo_autoral(this.derivado, this.tiempo_reloj)
    },

    /**
     * El mapa de claves con los nombres cortos que usa la coreografía (`K` en el
     * original). No incluye `wide`, que depende de `T` y se calcula aparte.
     */
    claves_escena() {
      const c = this.derivado.claves
      return {
        Conexion: c.Conexion,
        Procesado: c.Procesado,
        Logo: c.Logo,
        carga: c['Carga una vez'],
        vende: c['Vende en todos lados'],
        bajada: c.Bajada,
        wa: c.Whatsapp,
        abs: c.Absorcion,
        ia: c['Procesado IA'],
        onda: c['Onda IA'],
        fin: c.Cierre,
      }
    },

    /** El instante en el que el círculo queda cerrado y la cámara puede abrir. */
    apertura() {
      return llegada(N - 1) + 0.16
    },

    /** 0..1: cuánto abrió la cámara. Mientras vale 0, las tarjetas lejanas se atenúan. */
    ancho_camara() {
      return MOTION.glide(this.apertura, this.claves_escena.Conexion - 0.05)(this.tiempo)
    },

    /** 0..1: cuánto descendió el procesador. */
    descenso() {
      return MOTION.glide(this.claves_escena.bajada, this.claves_escena.abs)(this.tiempo)
    },

    /** Y del procesador en unidades del escenario. */
    chip_y() {
      return lerp(this.geo.cy, this.alto_reposo(CHIP_DOWN), this.descenso)
    },

    estilo_escenario() {
      const g = this.geo
      /* El tamaño del escenario se escribe acá y no en el CSS porque en vertical deja de
         ser un cuadrado fijo: es V_W de ancho por el alto real de la pantalla. En
         horizontal estos cuatro valores dan 1080/1080/-540/-540, que es exactamente lo que
         decía la hoja de estilos. */
      return {
        width: g.w + 'px',
        height: g.h.toFixed(2) + 'px',
        marginLeft: -g.w / 2 + 'px',
        marginTop: (-g.h / 2).toFixed(2) + 'px',
        transform: 'scale(' + g.escala.toFixed(5) + ')',
      }
    },

    /**
     * La cámara: prioridad a la tarjeta que llega, y el zoom out recién cuando el círculo
     * se cierra. Va sobre un grupo con `transform-origin: 0 0`, como el original.
     *
     * Los CUADROS son los mismos en las dos composiciones —la cámara abre en el mismo
     * instante— y lo único que cambia es cuánto se acerca y a qué altura mira:
     *
     *   · en horizontal, los cinco números del export, intactos;
     *   · en vertical, un acercamiento más corto (ver V_ZOOM) y un foco derivado de la
     *     elipse. Los 200 y 232 del original son el 0,704 y el 0,618 del radio por encima
     *     del centro del anillo, así que acá se escriben como esa misma fracción de `ry`:
     *     encuadran la tarjeta que llega igual que allá, sea cual sea el alto de la
     *     pantalla. Después del cierre el foco es el centro del espacio, que en vertical
     *     coincide con el centro del anillo -- por eso no queda deriva: en el cuadrado esa
     *     deriva de 462 a 540 existía sólo porque los dos centros no coincidían.
     */
    camara() {
      const K = this.claves_escena
      const T = this.tiempo
      const g = this.geo
      const cuadros = [0, this.apertura, K.Conexion - 0.05, K.Logo, K.carga, K.fin + 6]
      const zoom = g.vertical ? V_ZOOM : [1.7, 1.58, 1.0, 1.0, 1.0, 1.0]
      const foco = g.vertical
        ? [g.cy - 0.704 * g.ry, g.cy - 0.618 * g.ry, g.cy, g.cy, g.cy, g.cy]
        : [200, 232, 462, 478, 540, 540]
      const z = interpolate(cuadros, zoom, Easing.easeInOutCubic)(T)
      const fy = interpolate(cuadros, foco, Easing.easeInOutCubic)(T)
      return (
        'translate(' +
        (g.w / 2 - g.cx * z).toFixed(2) +
        'px,' +
        (g.h / 2 - fy * z).toFixed(2) +
        'px) scale(' +
        z.toFixed(4) +
        ')'
      )
    },

    /* ── El fondo ──────────────────────────────────────────────────────────────────── */

    /** La aparición del fondo en los primeros 0,9 s. */
    bloom() {
      return MOTION.enter(0, 0.9)(this.tiempo)
    },

    /**
     * Deriva lenta de las líneas de circuito.
     *
     * 🔴 EL MÓDULO ES 40 EN LOS DOS EJES, Y NO ES UN NÚMERO ELEGIDO A OJO: 40 es el margen
     * con el que están dibujados los TRAZOS. Todos los que arrancan fuera del cuadro lo
     * hacen exactamente 40 unidades afuera -- `-40` de un lado, `1120` del otro sobre un
     * viewBox de 1080. O sea que 40 es TODO el colchón que hay, y la deriva no puede
     * gastar más que eso sin meter la punta de un trazo dentro del cuadro.
     *
     * En x había `% 60` y se pasaba por 20. Con `-d % 60` la deriva vive en (-60, 0], así
     * que cuando bajaba de -40 los tres trazos que arrancan en `x = 1120`
     * (`M1120 150`, `M1120 560`, `M1120 880`) terminaban DENTRO del cuadro -- hasta 20
     * unidades antes del borde derecho, o sea un hilo cortado en el aire. Medido sobre la
     * línea de tiempo real (22,1 s autorales): pasaba el 27,6% de la animación, en dos
     * tramos (T de 8 a 12 y de 20 a 22,1). Solo se ve en composición HORIZONTAL: el SVG va
     * con `preserveAspectRatio="xMidYMid slice"`, así que en apaisado la escala la fija el
     * ancho y el rango x [0, 1080] queda entero a la vista; en vertical la fija el alto y
     * esa zona ya está recortada.
     *
     * Con `% 40` la deriva vive en (-40, 0] y el trazo termina en (1080, 1120]: nunca
     * entra. El eje y ya usaba 40 y por eso nunca falló -- esto lo único que hace es
     * dejar los dos ejes en el mismo número, que es el que la geometría pedía.
     * (Medido y corregido el 10/9/2026, misión experiencia-nueva.)
     *
     * @returns {string}
     */
    transform_circuito() {
      const d = this.tiempo * 5
      return 'translate(' + (-d % 40) + ',' + (d % 40) + ')'
    },

    /** 0..1: cuánto se calienta el resplandor mientras el procesador trabaja. */
    calor() {
      const K = this.claves_escena
      const T = this.tiempo
      return (
        MOTION.glide(K.Procesado + 0.3, K.Logo - 0.1)(T) * (1 - MOTION.glide(K.Logo, K.Logo + 0.7)(T)) +
        MOTION.glide(K.ia, K.onda)(T) * (1 - MOTION.glide(K.onda + 0.4, K.onda + 1.0)(T))
      )
    },

    estilo_resplandor() {
      return {
        /* Centrado en el procesador: mide 860 y el centro cae en left + 430. */
        left: this.geo.cx - 430 + 'px',
        top: this.chip_y - 430 + 'px',
        background:
          'radial-gradient(circle, rgba(47,123,255,' +
          (0.19 + 0.3 * this.calor).toFixed(3) +
          ') 0%, rgba(47,123,255,0) 68%)',
        opacity: this.bloom,
      }
    },

    /* ── La toma de los problemas ──────────────────────────────────────────────────── */

    /** Equivale al `<Shot from={0} to={K.Logo + 0.3}>` del original. */
    toma_problemas() {
      return this.tiempo >= 0 && this.tiempo < this.claves_escena.Logo + 0.3
    },

    /**
     * Las seis tarjetas: entran de a una arriba del círculo, el círculo rota para hacerle
     * lugar a la siguiente, y al final todas caen hacia el procesador y desaparecen.
     */
    tarjetas() {
      const K = this.claves_escena
      const T = this.tiempo
      const g = this.geo
      const lista = []

      for (let i = 0; i < N; i++) {
        const aparece = MOTION.enter(llegada(i), 0.34)(T)
        if (aparece <= 0.001) continue

        /* Cada tarjeta que llega después empuja a ésta un sexto de vuelta. */
        let giro = 0
        for (let j = i + 1; j < N; j++) giro += MOTION.glide(llegada(j) - 0.26, llegada(j) + 0.02)(T)
        const grados = -ARC * giro

        /* Entra desde 52 unidades más afuera del anillo. En la elipse se agranda a los dos
           semiejes por igual: no es exactamente la normal, pero son 52 unidades de entrada
           y a cambio la composición horizontal sale con los mismos números de siempre. */
        const fuera = 52 * (1 - aparece)
        let [x, y] = pol(g.cx, g.cy, g.rx + fuera, g.ry + fuera, grados)

        /* Mientras la cámara está cerca, las que se alejan del tope se atenúan. */
        const atenua = lerp(1 - 0.78 * clamp((giro - 0.5) / 1.1, 0, 1), 1, this.ancho_camara)

        /* La caída al procesador. */
        const absorbe = animate({
          from: 0,
          to: 1,
          start: K.Procesado + 0.02 + i * 0.04,
          end: K.Procesado + 0.56 + i * 0.04,
          ease: Easing.easeInQuart,
        })(T)
        x = lerp(x, g.cx, absorbe)
        y = lerp(y, g.cy, absorbe)

        const escala = lerp(0.88 + 0.12 * aparece, 0.06, absorbe)
        const opacidad = aparece * (1 - absorbe * absorbe)

        /* El borde brilla apenas llega y se enfría en tres cuartos de segundo. */
        const caliente = 1 - clamp((T - llegada(i) - 0.15) / 0.75, 0, 1)

        lista.push({
          indice: i,
          texto: TARJETAS[i].t,
          icono: TARJETAS[i].ic,
          estilo: {
            left: x - CARD_W / 2 + 'px',
            top: y - CARD_H / 2 + 'px',
            transform: 'scale(' + escala.toFixed(4) + ')',
            opacity: opacidad * atenua,
            zIndex: i + 1,
            borderColor: 'rgba(126,172,255,' + (0.18 + 0.3 * caliente).toFixed(3) + ')',
            boxShadow:
              '0 18px 44px rgba(0,0,0,0.34), 0 0 ' +
              (34 * caliente).toFixed(0) +
              'px rgba(47,123,255,' +
              (0.3 * caliente).toFixed(3) +
              ')',
          },
        })
      }

      return lista
    },

    /** Los cables de cada tarjeta al procesador, con la energía que viaja al centro. */
    conexiones() {
      const K = this.claves_escena
      const T = this.tiempo
      const g = this.geo
      const brillo = MOTION.glide(K.Conexion, K.Conexion + 0.7)(T)
      const ido = MOTION.glide(K.Procesado + 0.55, K.Logo - 0.05)(T)
      if (ido >= 0.999) return null

      const lista = []
      for (let i = 0; i < N; i++) {
        const aparece = MOTION.enter(llegada(i), 0.34)(T)
        if (aparece <= 0.02) continue

        let giro = 0
        for (let j = i + 1; j < N; j++) giro += MOTION.glide(llegada(j) - 0.26, llegada(j) + 0.02)(T)
        const grados = -ARC * giro

        /* El cable va DERECHO de la tarjeta al procesador, y por eso acá sí hace falta la
           dirección real y no el ángulo: en la elipse el punto de 60° y su dirección desde
           el centro dejan de coincidir, y tomando el ángulo el cable saldría apuntando a
           cualquier lado menos a su tarjeta. En el círculo esta cuenta devuelve el mismo
           `(sen, -cos)` de siempre, así que arranca a 50 unidades de la tarjeta y termina a
           108 del centro del chip, igual que en el original. */
        const [tx, ty] = pol(g.cx, g.cy, g.rx, g.ry, grados)
        const distancia = Math.hypot(tx - g.cx, ty - g.cy) || 1
        const ux = (tx - g.cx) / distancia
        const uy = (ty - g.cy) / distancia

        const x1 = tx - 50 * ux
        const y1 = ty - 50 * uy
        const x2 = g.cx + 108 * ux
        const y2 = g.cy + 108 * uy
        const dibujo = MOTION.glide(llegada(i) + 0.18, llegada(i) + 0.62)(T)
        const largo = Math.hypot(x2 - x1, y2 - y1)

        const puntos = []
        if (dibujo > 0.98 && T > K.Conexion - 0.1) {
          const fases = [0, 0.5]
          for (let k = 0; k < fases.length; k++) {
            const p = ((T - K.Conexion + 0.1) * 1.15 + i * 0.13 + fases[k]) % 1
            puntos.push({
              cx: lerp(x1, x2, p).toFixed(2),
              cy: lerp(y1, y2, p).toFixed(2),
              opacidad: ((1 - p) * 0.9 * brillo).toFixed(3),
            })
          }
        }

        lista.push({
          indice: i,
          opacidad: ((0.3 + 0.62 * brillo) * (1 - ido)).toFixed(3),
          x1: x1.toFixed(2),
          y1: y1.toFixed(2),
          x2: x2.toFixed(2),
          y2: y2.toFixed(2),
          ancho: (1.6 + 1.1 * brillo).toFixed(2),
          largo: largo.toFixed(2),
          recorte: (largo * (1 - dibujo)).toFixed(2),
          puntos: puntos,
        })
      }

      return lista.length ? lista : null
    },

    /* ── Lo que el procesador emite ────────────────────────────────────────────────── */

    /**
     * Los ocho elementos que salen del procesador. Cada uno es `null` (todavía no salió) o
     * el objeto de estilo con el que se dibuja. Los tiempos son los del original.
     */
    emitidos() {
      const K = this.claves_escena
      const y = this.alto_reposo
      return {
        logo: this.emitir(K.Logo, K.Logo + 0.85, y(Y_LOGO), [K.bajada, K.bajada + 0.55]),
        carga: this.emitir(K.carga, K.carga + 0.7, y(Y_SLOT), [K.vende, K.vende + 0.55]),
        vende: this.emitir(K.vende + 0.3, K.vende + 1.05, y(Y_SLOT), [K.bajada, K.bajada + 0.55]),
        f1: this.emitir(K.bajada + 0.35, K.bajada + 0.35 + EM, y(Y_T1), [K.abs + 0.3, K.abs + 0.92]),
        /* K.wa + 0.35 y no + 0.05: la escena "Whatsapp" dura 4,1s porque en el export
           salían DOS textos ahí adentro. Con uno solo, entrando al principio, quedaba
           un hueco largo al final. Corrido al medio, la escena vuelve a tener su ritmo. */
        f2: this.emitir(K.wa + 0.35, K.wa + 0.35 + EM, y(Y_T2), [K.abs + 0.15, K.abs + 0.77]),
        logo_ia: this.emitir(K.ia + 0.45, K.onda - 0.1, y(Y_LOGO), null),
        ia: this.emitir(K.ia + 0.7, K.onda + 0.15, y(Y_IA), null),
      }
    },

    /** true mientras la onda de energía recorre el texto de IA. */
    ondeando() {
      const K = this.claves_escena
      return this.tiempo >= K.onda - 0.02 && this.tiempo <= K.fin + 0.02
    },

    estilo_ia() {
      const base = 'rgba(236,244,255,0.95)'
      if (!this.ondeando) return Object.assign({ color: base }, this.ajuste('ia'))

      const K = this.claves_escena
      const avance = clamp((this.tiempo - K.onda) / Math.max(0.2, K.fin - K.onda), 0, 1)
      return Object.assign(
        {
          backgroundImage:
            'linear-gradient(100deg,' +
            base +
            ' 0%,' +
            base +
            ' 30%, #ffffff 40%, #9ad4ff 50%, #ffffff 60%,' +
            base +
            ' 70%,' +
            base +
            ' 100%)',
          backgroundSize: '190% 100%',
          backgroundPosition: (145 - 190 * avance).toFixed(1) + '% 0',
        },
        this.ajuste('ia')
      )
    },
  },

  watch: {
    /**
     * @param {number} valor
     * @returns {void}
     */
    progreso(valor) {
      if (valor === null) return
      this.adelantar_desde_scroll(valor)
    },
  },

  mounted() {
    this.reduced_motion = !!(
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )

    this.medir_caja()
    this.vigilar_tamano()

    /* La tipografía de marca (Geist) llega por Google Fonts y puede aparecer después del
       primer cuadro: eso cambia el ancho de los titulares, así que se vuelve a medir. */
    this.$nextTick(this.medir_textos)
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(this.medir_textos).catch(() => {})
    }

    if (this.reduced_motion) {
      /* Estado ESTÁTICO, no una versión suave del movimiento: se planta el reloj en el
         final y no se arranca ningún rAF. El template suma las dos líneas del titular,
         que en el cuadro final de la animación ya no están porque volvieron al
         procesador. */
      this.tiempo_reloj = this.duracion
      this.terminada = true
      this.$emit('terminada')
      return
    }

    document.addEventListener('visibilitychange', this.revisar_reloj)
    this.vigilar_visibilidad()
    this.revisar_reloj()
  },

  beforeUnmount() {
    /* Nada sobrevive al componente: ni el rAF, ni los dos observers, ni el listener de
       pestaña. Es el error que ya se cometió con la escena anterior. */
    this.frenar()
    document.removeEventListener('visibilitychange', this.revisar_reloj)
    window.removeEventListener('resize', this.medir_caja)
    if (this.observador) {
      this.observador.disconnect()
      this.observador = null
    }
    if (this.redimensionador) {
      this.redimensionador.disconnect()
      this.redimensionador = null
    }
  },

  methods: {
    /**
     * API pública para el padre: le suma tiempo a la línea desde el progreso de scroll de
     * su sección. **Adelanta**, no reemplaza: si el reloj ya está más adelante que el
     * scroll, no pasa nada. Nunca rebobina.
     *
     * @param {number} progreso 0..1
     * @returns {void}
     */
    adelantar_desde_scroll(progreso) {
      if (this.reduced_motion) return
      const p = clamp(Number(progreso) || 0, 0, 1)
      this.avanzar_a(p * this.duracion)
      this.revisar_reloj()
    },

    /**
     * Mueve el reloj hacia adelante hasta `t`, sin pasarse de la duración total y sin
     * volver atrás nunca.
     *
     * @param {number} t
     * @returns {void}
     */
    avanzar_a(t) {
      const nuevo = clamp(Math.max(t, this.tiempo_reloj), 0, this.duracion)
      if (nuevo !== this.tiempo_reloj) this.tiempo_reloj = nuevo
      if (this.tiempo_reloj >= this.duracion && !this.terminada) {
        this.terminada = true
        this.$emit('terminada')
      }
    },

    /**
     * Un cuadro del reloj.
     *
     * @param {number} ts
     * @returns {void}
     */
    pulso_reloj(ts) {
      this.raf = null
      if (this.ultimo_ts === null) this.ultimo_ts = ts

      let dt = (ts - this.ultimo_ts) / 1000
      this.ultimo_ts = ts
      if (!(dt > 0)) dt = 0
      /* Un cuadro larguísimo (pestaña que vuelve, hilo trabado) no tiene que saltear medio
         segundo de coreografía de golpe. */
      if (dt > DT_MAXIMO) dt = DT_MAXIMO

      this.avanzar_a(this.tiempo_reloj + dt)
      if (!this.terminada) this.raf = requestAnimationFrame(this.pulso_reloj)
    },

    /**
     * Decide si el reloj tiene que estar corriendo y lo arranca o lo frena. Es el único
     * lugar donde se pide o se cancela un rAF.
     *
     * @returns {void}
     */
    revisar_reloj() {
      const debe_correr =
        !this.reduced_motion &&
        this.en_viewport &&
        !document.hidden &&
        !this.terminada

      if (debe_correr && this.raf === null) {
        this.ultimo_ts = null
        this.raf = requestAnimationFrame(this.pulso_reloj)
      } else if (!debe_correr && this.raf !== null) {
        this.frenar()
      }
    },

    /** @returns {void} */
    frenar() {
      if (this.raf !== null) {
        cancelAnimationFrame(this.raf)
        this.raf = null
      }
      this.ultimo_ts = null
    },

    /**
     * Apaga la animación cuando no se ve. Sin esto, un rAF a 60 cuadros por segundo sigue
     * corriendo con la sección diez pantallas más arriba.
     *
     * @returns {void}
     */
    vigilar_visibilidad() {
      if (typeof IntersectionObserver !== 'function' || !this.$refs.raiz) return
      let self = this
      this.observador = new IntersectionObserver(
        function (entradas) {
          for (let i = 0; i < entradas.length; i++) self.en_viewport = entradas[i].isIntersecting
          self.revisar_reloj()
        },
        { threshold: 0 }
      )
      this.observador.observe(this.$refs.raiz)
    },

    /**
     * El encuadre entero depende del tamaño de la caja, así que hay que volver a medirla
     * cuando cambia -- rotar el teléfono, abrir la barra del navegador, redimensionar la
     * ventana. Rotar es el caso que importa: cruza el umbral y cambia de composición.
     *
     * @returns {void}
     */
    vigilar_tamano() {
      if (typeof ResizeObserver === 'function' && this.$refs.raiz) {
        let self = this
        this.redimensionador = new ResizeObserver(function () {
          self.medir_caja()
        })
        this.redimensionador.observe(this.$refs.raiz)
        return
      }
      window.addEventListener('resize', this.medir_caja, { passive: true })
    },

    /**
     * Mide la caja del componente. No decide nada: de estos dos números sale todo el
     * encuadre, y eso lo resuelve `geo`.
     *
     * @returns {void}
     */
    medir_caja() {
      const raiz = this.$refs.raiz
      if (!raiz) return
      const ancho = raiz.clientWidth
      const alto = raiz.clientHeight
      if (ancho > 0 && alto > 0) {
        this.ancho_caja = ancho
        this.alto_caja = alto
      }
    },

    /**
     * Traduce una altura de reposo del espacio original al espacio de coordenadas que esté
     * en uso. Las alturas del export están escritas contra un cuadrado de 1080, así que lo
     * que se conserva es la distancia al CENTRO: en horizontal devuelve el número tal cual,
     * y en vertical lo reubica respecto del centro de una pantalla más larga.
     *
     * @param {number} base altura en el espacio original de 1080
     * @returns {number}
     */
    alto_reposo(base) {
      return this.geo.h / 2 + (base - H / 2)
    },

    /**
     * Mide el ancho natural de cada titular, en unidades del escenario.
     *
     * Todos van con `white-space: nowrap` y sus tamaños están calibrados contra Geist, la
     * tipografía de marca -- que la página ya carga, así que en el cuadrado ninguno se
     * ajusta. Pero si Google Fonts no llega, el stack de sistema tiene otras métricas y
     * "Todo asistido por IA, nunca fue tan fácil" queda a un pelo de los 1080: sin esto se
     * cortaría contra el borde del escenario.
     *
     * Lo medido son ANCHOS y no factores, a propósito: la unidad no cambia entre las dos
     * composiciones, lo que cambia es el ancho útil contra el que se los compara. Así una
     * sola medición sirve para las dos, incluso si el teléfono rota.
     *
     * @returns {void}
     */
    medir_textos() {
      const regla = this.$refs.regla
      if (!regla) return
      const nodos = regla.querySelectorAll('[data-clave]')
      const anchos = {}
      for (let i = 0; i < nodos.length; i++) {
        anchos[nodos[i].getAttribute('data-clave')] = nodos[i].offsetWidth
      }
      this.anchos_texto = anchos
    },

    /**
     * El estilo de encogido de un titular, o un objeto vacío si entra tal cual.
     *
     * @param {string} clave
     * @returns {Object}
     */
    ajuste(clave) {
      const ancho = this.anchos_texto[clave]
      const util = this.ancho_util
      if (!ancho || ancho <= util) return {}
      return { transform: 'scale(' + (util / ancho).toFixed(4) + ')' }
    },

    /**
     * Todo lo que el procesador emite sale de su centro, chico, y sube hasta su altura de
     * descanso. Si tiene `oculta`, después vuelve a meterse adentro del procesador.
     *
     * @param {number} desde segundo autoral en el que empieza a salir
     * @param {number} hasta segundo autoral en el que terminó de subir
     * @param {number} y_descanso altura final, en unidades del escenario
     * @param {number[]|null} oculta par [desde, hasta] en el que vuelve al procesador
     * @returns {Object|null} el estilo, o null si todavía no salió
     */
    emitir(desde, hasta, y_descanso, oculta) {
      const T = this.tiempo
      const p = MOTION.glide(desde, hasta)(T)
      if (p <= 0.001) return null

      const chip_y = this.chip_y
      const y = lerp(chip_y, y_descanso, p)
      const s = lerp(0.22, 1, p)

      const vuelta = oculta ? MOTION.glide(oculta[0], oculta[1])(T) : 0
      const y_final = lerp(y, chip_y + 8, vuelta)
      const s_final = lerp(s, 0.22, vuelta)

      return {
        top: y_final.toFixed(2) + 'px',
        transform: 'translateY(-50%) scale(' + s_final.toFixed(4) + ')',
        opacity: Math.min(p * 1.3, 1) * Math.max(0, 1 - vuelta * 1.7),
      }
    },
  },
}
</script>

<style scoped>
/* La animación se dibuja en un espacio de coordenadas propio y ese espacio se escala una
   sola vez, desde JS. Por eso los px de acá abajo no son px de pantalla y no hay ni un solo
   `@media` de tamaño: el encuadre entero se decide en el computed `geo`, contra la caja
   medida, y no en la hoja de estilos.

   Son DOS composiciones y la única diferencia entre ellas es ese espacio:
     · horizontal -- el cuadrado de 1080×1080 del export, escalado por el lado más corto;
     · vertical   -- 600 de ancho por el alto real de la pantalla, con la elipse de
       tarjetas estirada. Entra cuando el alto le saca bastante al ancho (ver
       UMBRAL_VERTICAL) y existe porque en un teléfono el cuadrado dejaba el rótulo de las
       tarjetas en 7,9 px reales.

   Las excepciones son las tres capas del fondo (degradé, circuito y viñeta), que van a
   sangre completa por fuera del escenario -- decisión de encuadre de Lucas, 10/9. */
.animacion-procesador {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  /* svh donde exista: en el teléfono, 100vh incluye la barra del navegador y la
     animación queda más alta que la pantalla. */
  min-height: 100svh;
  overflow: hidden;
  background: #04060b;
  /* La tipografía de la página (Geist), que ya está cargada: no se suma ninguna webfont
     nueva. El fallback es el mismo stack que declaraba la escena original. */
  font-family: var(--demo-font-family, 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
}

/* ── El fondo, a sangre ─────────────────────────────────────────────────────────────── */

.animacion-procesador__degrade {
  position: absolute;
  inset: 0;
  background: radial-gradient(115% 85% at 50% 34%, #0d1a33 0%, #070b15 52%, #04060b 100%);
}

/* `slice` en vez de estirar: la trama se agranda para cubrir la pantalla pero las
   diagonales conservan su ángulo. Estirarla con `none` las deformaría. */
.animacion-procesador__circuito {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: rgba(92, 152, 255, 0.2);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.animacion-procesador__vineta {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(120% 100% at 50% 50%, rgba(0, 0, 0, 0) 54%, rgba(0, 0, 0, 0.6) 100%);
}

/* ── El escenario ───────────────────────────────────────────────────────────────────── */

/* El tamaño, los márgenes y la escala los escribe `estilo_escenario` desde JS, porque en
   la composición vertical el escenario deja de ser un cuadrado fijo: es V_W de ancho por
   el alto real de la pantalla. En horizontal esos valores son los de siempre
   (1080 × 1080, margen -540). */
.animacion-procesador__escenario {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: 50% 50%;
  /* 🔴 SIN `overflow: hidden`, y esto no es un olvido. El original lo tenía porque el
     cuadrado ERA la pantalla: recortar contra el canto no se notaba. Acá el fondo va a
     sangre, así que ese canto es una línea invisible en el medio de la imagen y una
     tarjeta cortada ahí queda guillotinada en el aire -- se vio en la primera captura a
     1440×900. Quien recorta ahora es `.animacion-procesador`, o sea la pantalla: en 16:9
     el círculo de tarjetas simplemente respira más ancho que el cuadrado, que es lo que
     pide el encuadre a sangre. */
}

/* `left` lo pone `estilo_resplandor`: sigue al procesador, que en vertical no está en 540. */
.animacion-procesador__resplandor {
  position: absolute;
  width: 860px;
  height: 860px;
  border-radius: 50%;
  filter: blur(4px);
}

.animacion-procesador__camara {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.animacion-procesador__toma {
  position: absolute;
  inset: 0;
}

.animacion-procesador__conexiones {
  position: absolute;
  inset: 0;
  overflow: visible;
}

/* ── Las seis tarjetas ──────────────────────────────────────────────────────────────── */

.animacion-procesador__tarjeta {
  position: absolute;
  width: 258px;
  height: 78px;
  box-sizing: border-box;
  padding: 0 18px;
  display: flex;
  align-items: center;
  gap: 13px;
  border-radius: 22px;
  border: 1px solid transparent;
  background: linear-gradient(160deg, #1c2b4b 0%, #0c1424 100%);
}

.animacion-procesador__caja-icono {
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(47, 123, 255, 0.14);
  border: 1px solid rgba(126, 172, 255, 0.2);
}

.animacion-procesador__icono {
  display: block;
  flex: 0 0 auto;
  fill: none;
  stroke: #5aa9ff;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.animacion-procesador__rotulo {
  min-width: 0;
  font-weight: 600;
  font-size: 22px;
  line-height: 1.18;
  letter-spacing: -0.012em;
  color: #f4f7fd;
  text-wrap: pretty;
}

/* ── Lo que emite el procesador ─────────────────────────────────────────────────────── */

.animacion-procesador__emitido {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
}

.animacion-procesador__emitido--quieto {
  transform: translateY(-50%);
}

.animacion-procesador__logotipo {
  display: block;
  width: 334px;
  height: 77px;
}

.animacion-procesador__titular {
  font-weight: 800;
  font-size: 62px;
  letter-spacing: -0.035em;
  white-space: nowrap;
  color: #f4f7fd;
}

.animacion-procesador__titular--degrade {
  background-image: linear-gradient(96deg, #7cc0ff 0%, #4f8dff 45%, #8f7dff 100%);
}

.animacion-procesador__rasgo {
  font-weight: 600;
  font-size: 40px;
  letter-spacing: -0.022em;
  white-space: nowrap;
  color: rgba(230, 239, 254, 0.94);
}

.animacion-procesador__ia {
  font-weight: 700;
  font-size: 52px;
  letter-spacing: -0.03em;
  white-space: nowrap;
}

/* El recorte del degradé contra el texto. Va en una clase y no en el estilo inline porque
   `-webkit-background-clip` no se puede asignar como propiedad del objeto style. */
.animacion-procesador__recorte {
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
}

/* La regla con la que se miden los titulares: ocupa lugar en el layout (por eso
   `visibility` y no `display: none`, que daría offsetWidth 0) pero no se ve ni se toca. */
.animacion-procesador__regla {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
}

/* `inline-block` y no `block`: la regla es una caja de ancho automático, y con hijos de
   bloque todos heredarían el ancho del más largo en vez de medir el suyo. */
.animacion-procesador__regla span {
  display: inline-block;
}
</style>
