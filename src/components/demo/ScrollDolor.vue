<template>
  <section class="demo-scroll-dolor">
    <!-- Apertura: revertida a solo titular + subtítulo (grupo 336, correctivo 3;
         decisión de Lucas tras ver la escena cinematográfica implementada -- ver nota
         de reversión en demo_experiencia.md §3.18-bis). Ya no arma su propia
         FondoSeccionSticky: la de acá abajo hace todo el trabajo de pin/fondo. -->
    <fondo-seccion-sticky variante="apertura" v-slot="{ progreso }" @progreso="on_progreso_apertura">
      <header
        class="demo-scroll-dolor__apertura"
        :class="{ 'demo-scroll-dolor__apertura--carga': !apertura_tomada_por_scroll }"
      >
        <h1 class="demo-scroll-dolor__apertura-titulo" :style="estilo_apertura(progreso)">
          {{ contenido.apertura.titulo }}
        </h1>
        <p class="demo-scroll-dolor__apertura-subtitulo" :style="estilo_apertura(progreso, true)">
          {{ contenido.apertura.subtitulo }}
        </p>
      </header>
    </fondo-seccion-sticky>

    <!-- Bloques 1 a 5: párrafo(s) de dolor + línea de alivio resaltada + pieza multimedia -->
    <fondo-seccion-sticky
      v-for="(bloque, indice) in contenido.bloques"
      :key="bloque.id"
      :variante="'bloque-' + (indice + 1)"
      v-slot="{ progreso }"
      @progreso="on_progreso_bloque($event, bloque.id)"
    >
      <article class="demo-scroll-dolor__bloque" :data-bloque-id="bloque.id">
        <div class="demo-scroll-dolor__bloque-texto" :style="estilo_bloque(progreso)">
          <p v-for="(linea, indice2) in bloque.texto" :key="indice2" class="demo-scroll-dolor__parrafo">
            {{ linea }}
          </p>
          <p class="demo-scroll-dolor__resaltado">{{ bloque.resaltado }}</p>
        </div>

        <div class="demo-scroll-dolor__bloque-pieza" :style="estilo_bloque(progreso, true)">
          <marco-dispositivo :tipo="bloque.marco">
            <!-- Único bloque con marco combinado (scroll.2): misma pieza en las dos pantallas -->
            <template v-if="bloque.marco === 'computadora+telefono'" #computadora>
              <pieza-multimedia :slot_id="bloque.id" :titulo="bloque.titulo_pieza" :media="media" />
            </template>
            <template v-if="bloque.marco === 'computadora+telefono'" #telefono>
              <pieza-multimedia :slot_id="bloque.id" :titulo="bloque.titulo_pieza" :media="media" />
            </template>
            <pieza-multimedia
              v-if="bloque.marco !== 'computadora+telefono'"
              :slot_id="bloque.id"
              :titulo="bloque.titulo_pieza"
              :media="media"
            />
          </marco-dispositivo>
        </div>
      </article>
    </fondo-seccion-sticky>

    <!-- Interludio del portal + cierre superpuesto (grupo 325, prompt 04,
         reemplaza entero al interludio de convergencia del grupo 322/05).
         El cierre ya NO va en su propio FondoSeccionSticky: se renderiza por
         encima de la escena del portal (slot #cierre), mientras el panorama
         queda atenuado y desaturado detrás y el arco se cierra sobre todo.
         Estructura de texto del cierre sin cambios respecto de los bloques
         1-5 (título(s) + hitos temporales + frase o párrafo de cierre),
         misma pieza multimedia con marco teléfono. -->
    <interludio-portal @cierre-visible="emitir_evento_cierre">
      <template #cierre>
        <!-- Sin `:style` por progreso a propósito, a diferencia de los bloques 1-5:
             este cierre vive dentro de un wrapper posicionado (translateY 100% -> 0%)
             cuya opacidad y entrada ya las controla por completo el progreso de
             scroll de InterludioPortal. Animarlo también acá sería animarlo dos
             veces, de forma descoordinada -- es el mismo motivo por el que antes
             quedaba afuera del IntersectionObserver (grupo 325, prompt 04). -->
        <article
          class="demo-scroll-dolor__bloque demo-scroll-dolor__cierre demo-interludio__cierre"
          :data-bloque-id="contenido.cierre.id"
        >
          <div class="demo-scroll-dolor__bloque-texto">
            <h2 v-for="(linea, indice) in contenido.cierre.titulos" :key="indice" class="demo-scroll-dolor__cierre-titulo">
              {{ linea }}
            </h2>

            <ul class="demo-scroll-dolor__hitos">
              <li v-for="(hito, indice) in contenido.cierre.hitos" :key="indice">
                <strong>{{ hito.momento }}</strong> {{ hito.texto }}
              </li>
            </ul>

            <!-- Versión dueño: frase corta de cierre -->
            <p v-if="contenido.cierre.frase_final" class="demo-scroll-dolor__frase-final">
              {{ contenido.cierre.frase_final }}
            </p>
            <!-- Versión campeón: párrafo largo ya validado por Lucas (marca/cliente_ideal.md) -->
            <p v-if="contenido.cierre.parrafo_final" class="demo-scroll-dolor__parrafo-final">
              {{ contenido.cierre.parrafo_final }}
            </p>
          </div>

          <div class="demo-scroll-dolor__bloque-pieza">
            <marco-dispositivo :tipo="contenido.cierre.marco">
              <pieza-multimedia :slot_id="contenido.cierre.id" :titulo="contenido.cierre.titulo_pieza" :media="media" />
            </marco-dispositivo>
          </div>
        </article>
      </template>
    </interludio-portal>

    <!-- Puente al formulario: el formulario en sí lo agrega el prompt 05 (ver
         armazón en ExperienciaDemo.vue, que renderiza esta sección justo antes) -->
    <!-- El puente no vive dentro de un FondoSeccionSticky (es hijo directo de la
         página), así que no tiene progreso de sección del cual colgarse: al retirarse
         el IntersectionObserver queda visible y estático. El prompt 05 de este mismo
         grupo lo pasa a su propia pantalla; ahí sí va a tener progreso propio. -->
    <footer class="demo-scroll-dolor__puente" data-bloque-id="puente">
      <p v-for="(linea, indice) in contenido.puente" :key="indice">{{ linea }}</p>
    </footer>
  </section>
</template>

<script>
import MarcoDispositivo from './MarcoDispositivo.vue'
import PiezaMultimedia from './PiezaMultimedia.vue'
import FondoSeccionSticky from './FondoSeccionSticky.vue'
import InterludioPortal from './InterludioPortal.vue'

/**
 * Copy completo del scroll de dolor, transcripto palabra por palabra desde
 * contexto/demo_pagina.md §1 (versión dueño) y §2 (versión campeón) del repo
 * claude-comerciocity. No parafrasear ni ajustar acá: cualquier cambio de
 * texto se hace en ese archivo, no en este componente.
 *
 * Las seis piezas multimedia (scroll.1 a scroll.6) y su marco de dispositivo
 * son las mismas en las dos versiones (contexto/demo_experiencia.md §3.18);
 * lo único que cambia entre dueño y campeón es el texto.
 */
const CONTENIDO_POR_PERFIL = {
  dueno: {
    apertura: {
      titulo: 'Tu negocio funciona porque vos te acordás.',
      subtitulo: 'Y eso tiene un límite.',
    },
    bloques: [
      {
        id: 'scroll.1',
        marco: 'computadora',
        titulo_pieza: 'Stock real por depósito',
        texto: [
          'Le prometés a un cliente algo que creés que tenés.',
          'Vas al depósito y no está.',
        ],
        resaltado: 'Ahora lo mirás antes de prometer.',
      },
      {
        id: 'scroll.2',
        marco: 'computadora+telefono',
        titulo_pieza: 'El artículo del sistema publicado en la tienda',
        texto: [
          'El mismo artículo, cargado tres veces: en el sistema, en el Excel, en la página.',
        ],
        resaltado: 'Ahora lo cargás una sola vez.',
      },
      {
        id: 'scroll.3',
        marco: 'computadora',
        titulo_pieza: 'Actualización masiva de precios aplicándose',
        texto: [
          'Llega la lista nueva del proveedor y la vas a cargar cuando puedas.',
          'Mientras tanto seguís vendiendo al precio de antes.',
        ],
        resaltado: 'Ahora es cuestión de minutos.',
      },
      {
        id: 'scroll.4',
        marco: 'computadora',
        titulo_pieza: 'La venta que se factura en el mismo acto',
        texto: [
          'Cargás la venta. Y después la volvés a cargar en ARCA.',
        ],
        resaltado: 'Ahora facturás donde la venta ya está.',
      },
      {
        id: 'scroll.5',
        marco: 'computadora',
        titulo_pieza: 'Cuenta corriente con los comprobantes detrás',
        texto: [
          'Quién te debe. Desde cuándo. Por qué comprobante.',
          'Hoy eso vive en una libreta y en tu cabeza.',
        ],
        resaltado: 'Ahora vive en un solo lugar, con el comprobante detrás de cada número.',
      },
    ],
    cierre: {
      id: 'scroll.6',
      marco: 'telefono',
      titulo_pieza: 'Consultar un dato desde afuera del local',
      titulos: [
        'Nada de esto es sobre el sistema.',
        'Es sobre dejar de ser el único que sabe.',
      ],
      hitos: [
        { momento: 'El primer día', texto: 'dejás de cargar lo mismo dos veces.' },
        { momento: 'El primer mes', texto: 'dejás de suponer: el stock, los precios y las deudas son los de verdad.' },
        { momento: 'A los doce meses', texto: 'el sistema ya sabe qué vendiste en cada época — y te dice qué comprar antes de que te falte.' },
      ],
      frase_final: 'De operar tu negocio a dirigirlo.',
      parrafo_final: null,
    },
    puente: [
      'Antes de entrar, contanos cómo trabajás.',
      'Con eso armamos tu demo.',
    ],
  },
  campeon: {
    apertura: {
      titulo: 'Vos ya sabés que así no se puede seguir.',
      subtitulo: 'Lo difícil es demostrarlo.',
    },
    bloques: [
      {
        id: 'scroll.1',
        marco: 'computadora',
        titulo_pieza: 'Stock real por depósito',
        texto: [
          'Ves que se prometen cosas que no hay en el depósito.',
          'Y que el problema no es de nadie en particular.',
        ],
        resaltado: 'Es del sistema. Y se arregla.',
      },
      {
        id: 'scroll.2',
        marco: 'computadora+telefono',
        titulo_pieza: 'El artículo del sistema publicado en la tienda',
        texto: [
          'Contás las veces que la misma información se carga de nuevo.',
          'Nadie más las cuenta.',
        ],
        resaltado: 'Acá se carga una sola vez.',
      },
      {
        id: 'scroll.3',
        marco: 'computadora',
        titulo_pieza: 'Actualización masiva de precios aplicándose',
        texto: [
          'Sabés que se está vendiendo con precios viejos.',
          'Explicar cuánto cuesta eso es otra historia.',
        ],
        resaltado: 'Esto se ve mejor que se explica.',
      },
      {
        id: 'scroll.4',
        marco: 'computadora',
        titulo_pieza: 'La venta que se factura en el mismo acto',
        texto: [
          'Ves cargar la misma venta dos veces, todos los días.',
        ],
        resaltado: 'Acá se carga una y se factura ahí mismo.',
      },
      {
        id: 'scroll.5',
        marco: 'computadora',
        titulo_pieza: 'Cuenta corriente con los comprobantes detrás',
        texto: [
          'Preguntás quién debe qué, y la respuesta es una libreta.',
        ],
        resaltado: 'Acá la respuesta está en pantalla, con el comprobante detrás.',
      },
    ],
    cierre: {
      id: 'scroll.6',
      marco: 'telefono',
      titulo_pieza: 'Consultar un dato desde afuera del local',
      titulos: [
        'No hace falta que lo expliques vos.',
      ],
      hitos: [
        { momento: 'El primer día', texto: 'deja de cargarse lo mismo dos veces.' },
        { momento: 'El primer mes', texto: 'las decisiones se toman mirando, no suponiendo.' },
        { momento: 'A los doce meses', texto: 'el sistema sabe qué se vendió en cada época y avisa qué comprar.' },
      ],
      frase_final: null,
      parrafo_final: 'Sabemos que vos sos el que entiende de esto y el que va a llevar el negocio para adelante. Justamente por eso, lo mejor es recorrer la demo junto al dueño: no para que tengas que convencerlo vos después, sino para que lo vea funcionando con sus propios ojos y decidan juntos. En un rato entiende de qué se trata — y la decisión final la toman entre los dos.',
    },
    puente: [
      'Antes de entrar, contanos cómo trabajan.',
      'Con eso armamos la demo.',
    ],
  },
}

/* Tramos de la coreografía de cada sección, en unidades de progreso [0,1] (grupo
   348, prompt 03). Entrada corta, meseta larga, salida corta: la sección está para
   leerse, no para animarse. El desfasaje de la pieza respecto del texto es el mismo
   que daba el animation-delay de 0.18s del sistema anterior, traducido a progreso. */
const ENTRADA_FIN = 0.28
const SALIDA_INICIO = 0.72
const DESFASE_PIEZA = 0.05
/* Desplazamiento vertical, en px: entra desde abajo y sale hacia arriba. */
const ENTRADA_Y = 96
const SALIDA_Y = -48
/* La salida no llega a 0: ver el comentario de estilo_bloque(). */
const SALIDA_OPACIDAD = 0.35

/**
 * Misma curva que usa InterludioPortal (1 - (1-t)³). Dos curvas distintas en la
 * misma página se notan.
 *
 * @param {number} t
 * @returns {number}
 */
function ease_out(t) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Scroll de dolor de la página inmersiva de demo: seis bloques de dolor +
 * alivio, cada uno con su pieza multimedia dentro de un marco de dispositivo,
 * más apertura y puente al formulario. Renderiza la versión dueño o campeón
 * según `perfil` (contexto/demo_experiencia.md §3.17).
 *
 * Instrumentación mínima (§6 del prompt): cada bloque, al terminar de entrar,
 * dispara `emitir_evento` -- método centralizado en el contenedor
 * (ExperienciaDemo.vue) que hoy solo hace console.debug y mañana se conecta
 * al bus de eventos real sin tener que volver a tocar este componente.
 *
 * CORRECTIVO (grupo 348, prompt 03): la página tenía DOS sistemas de animación
 * conviviendo -- el interludio, función pura del progreso de scroll y por lo tanto
 * reversible, y los bloques 1-5, con un IntersectionObserver de una sola vía que
 * agregaba una clase, corría un @keyframes con `forwards` y desobservaba. Ese
 * segundo sistema no tenía marcha atrás (pedido de Lucas del 4/8/2026: "que a
 * medida que voy para arriba las animaciones vayan sucediendo en reversa") y el
 * doble mecanismo ya había causado bugs en tres grupos seguidos. Ahora todo el
 * scroll de dolor se anima por el progreso de su propia sección: la reversa no se
 * programa, es consecuencia de que el progreso baje.
 */
export default {
  name: 'ScrollDolor',

  components: {
    MarcoDispositivo,
    PiezaMultimedia,
    FondoSeccionSticky,
    InterludioPortal,
  },

  props: {
    /**
     * Cargo del lead ('dueno' | 'campeon'). Cualquier valor distinto de
     * 'campeon' (incluido vacío/null/desconocido) muestra la versión dueño:
     * fallback obligatorio de §3.17, porque el costo de equivocarse es
     * asimétrico (un dueño leyendo la versión campeón pierde autoridad).
     */
    perfil: {
      type: String,
      default: 'dueno',
    },
    /** Mapa { slot_id: url } de piezas multimedia, tal como llega del payload. */
    media: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /**
     * Método centralizado de tracking, inyectado por el contenedor.
     * Firma: emitir_evento(nombre: string, payload: object) -> void.
     */
    emitir_evento: {
      type: Function,
      default: function () {},
    },
  },

  data() {
    return {
      /**
       * true si el sistema operativo pide reduced-motion. Se resuelve acá y no en
       * mounted() a propósito: los métodos de estilo corren en el PRIMER render, y
       * un flag que llega después dejaría un frame con los bloques en opacity 0.
       */
      reduced_motion: !!(
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ),
      /**
       * false hasta que el lead scrollea la apertura por primera vez. Mientras es
       * false manda la animación CSS de carga (demo-apertura-entrada); apenas hay
       * scroll, la clase se retira y el titular pasa a depender del progreso, que
       * es lo que le da la reversa al subir.
       */
      apertura_tomada_por_scroll: false,
      /** Ids de bloque cuyo evento de tracking ya se emitió (una vez por bloque). */
      bloques_trackeados: {},
    }
  },

  computed: {
    /**
     * Contenido activo según el perfil, con el fallback obligatorio a la
     * versión dueño (§3.17).
     *
     * @returns {object}
     */
    contenido() {
      if (this.perfil === 'campeon') {
        return CONTENIDO_POR_PERFIL.campeon
      }
      return CONTENIDO_POR_PERFIL.dueno
    },
  },

  methods: {
    /**
     * Normaliza `p` al rango [0,1] dentro de [inicio, fin] -- misma función que
     * usa InterludioPortal, para no tener dos formas de recortar tramos.
     *
     * @param {number} p
     * @param {number} inicio
     * @param {number} fin
     * @returns {number}
     */
    normalizar(p, inicio, fin) {
      if (p <= inicio) {
        return 0
      }
      if (p >= fin) {
        return 1
      }
      return (p - inicio) / (fin - inicio)
    },

    /**
     * Estilo de un bloque 1-5 para el progreso `p` de su propia sección. Tres
     * tramos: entrada (0 -> 0.28), meseta (la mayor parte del recorrido: la
     * sección está para leerse) y salida parcial (0.72 -> 1).
     *
     * La salida es PARCIAL a propósito (hasta 0.35 de opacidad, no hasta 0): que
     * el contenido se desvanezca del todo antes de irse de pantalla se lee como
     * un bug, no como una transición.
     *
     * Es función pura del progreso, así que la reversa al subir sale gratis: el
     * progreso baja y los mismos valores se recorren al revés. Si alguna vez
     * aparece acá un `if (subiendo)`, el enfoque está mal.
     *
     * @param {number} p Progreso [0,1] de la sección.
     * @param {boolean} secundario true para la pieza multimedia, que va desfasada
     *                             ~0.05 de progreso respecto del texto ("primero
     *                             se lee, después se ve" -- es el mismo desfasaje
     *                             que daba el animation-delay de 0.18s).
     * @returns {object}
     */
    estilo_bloque(p, secundario) {
      if (this.reduced_motion) {
        /* Sin estilos inline: manda el CSS, que bajo esta media query deja todo
         * plenamente visible y estático. */
        return {}
      }

      const desfase = secundario ? DESFASE_PIEZA : 0
      const entrada = ease_out(this.normalizar(p, desfase, ENTRADA_FIN + desfase))
      const salida = ease_out(this.normalizar(p, SALIDA_INICIO + desfase, 1))

      const opacidad = entrada - salida * (1 - SALIDA_OPACIDAD)
      const y = (1 - entrada) * ENTRADA_Y + salida * SALIDA_Y

      return {
        opacity: String(opacidad),
        transform: 'translateY(' + y + 'px)',
      }
    },

    /**
     * Estilo de la apertura. A diferencia de los bloques NO tiene tramo de
     * entrada: es lo primero que ve el lead al abrir la página, sin haber
     * scrolleado nada, así que en p = 0 tiene que estar plenamente visible. Su
     * entrada la hace una sola vez la animación CSS de carga; de ahí en más solo
     * queda la salida, que al subir se recorre al revés y hace que el titular
     * "vuelva a entrar".
     *
     * @param {number} p
     * @param {boolean} secundario true para el subtítulo.
     * @returns {object}
     */
    estilo_apertura(p, secundario) {
      if (this.reduced_motion) {
        return {}
      }

      const desfase = secundario ? DESFASE_PIEZA : 0
      const salida = ease_out(this.normalizar(p, SALIDA_INICIO + desfase, 1))

      return {
        opacity: String(1 - salida * (1 - SALIDA_OPACIDAD)),
        transform: 'translateY(' + salida * SALIDA_Y + 'px)',
      }
    },

    /**
     * Retira la animación CSS de carga apenas hay scroll real en la apertura. A
     * partir de ahí el `:style` por progreso es el único que manda -- mientras la
     * animación viva, sus valores le ganan a cualquier estilo inline (las
     * animaciones pisan al inline en la cascada), así que las dos cosas no pueden
     * convivir sobre los mismos elementos.
     *
     * @param {number} p
     * @returns {void}
     */
    on_progreso_apertura(p) {
      if (!this.apertura_tomada_por_scroll && p > 0.001) {
        this.apertura_tomada_por_scroll = true
      }
    },

    /**
     * Tracking de bloque visible: reemplaza al que emitía el IntersectionObserver,
     * en el mismo momento aproximado (el bloque terminó de entrar) y con el mismo
     * evento y payload. Una sola vez por bloque, aunque el lead suba y vuelva a
     * bajar diez veces: es un evento de "lo vio", no de "lo está viendo".
     *
     * @param {number} p
     * @param {string} bloque_id
     * @returns {void}
     */
    on_progreso_bloque(p, bloque_id) {
      if (p < ENTRADA_FIN || this.bloques_trackeados[bloque_id]) {
        return
      }
      this.bloques_trackeados[bloque_id] = true
      this.emitir_evento('scroll_bloque_visible', { bloque_id: bloque_id, perfil: this.perfil })
    },

    /**
     * Tracking del bloque de cierre (grupo 322, prompt 05): ya no tiene
     * IntersectionObserver propio -- el cierre vive dentro de
     * InterludioPortal (grupo 325, prompt 04), que emite 'cierre-visible'
     * apenas arranca a entrar por encima de la escena. Mismo evento y forma
     * que los bloques 1-5 en iniciar_observador, para no perder cobertura
     * de tracking.
     *
     * @returns {void}
     */
    emitir_evento_cierre() {
      this.emitir_evento('scroll_bloque_visible', { bloque_id: this.contenido.cierre.id, perfil: this.perfil })
    },

  },
}
</script>

<style scoped>
/* CORRECTIVO (grupo 336): el gap de acá abajo es la causa real de la franja blanca
   entre secciones -- viene del grupo 300, cuando los hijos directos eran los bloques
   de texto y el aire entre ellos era deseable. Desde el grupo 322 los hijos son
   <section class="demo-fondo-seccion"> pinneadas con su propio fondo generado DENTRO
   del pin (ver FondoSeccionSticky.vue): cualquier gap acá queda sin fondo detrás.
   NO restaurar este gap pensando que es un descuido: el aire entre bloques ahora lo
   da el padding interno de cada sección, no la separación entre secciones. */
.demo-scroll-dolor {
  /* max-width y padding también salen: cada sección ya limita su propio contenido a
     1080px (.demo-fondo-seccion__contenido > * en demo-experiencia.scss). Si quedan
     acá, el margin-left: calc(50% - 50vw) del breakout full-bleed de cada pin calcula
     contra una caja angosta y el fondo queda corrido. */
  max-width: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Apertura: full-bleed real, la da la excepción de FondoSeccionSticky.vue para la
   variante "apertura" (__contenido > * a height:100%, sin max-width ni padding) --
   acá solo hace falta centrar titular y subtítulo adentro de esa caja. */
.demo-scroll-dolor__apertura {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 16px;
}

/* Animación de entrada de la apertura (grupo 336, revierte la escena cinematográfica
   del grupo 325): corre UNA sola vez al cargar, no atada al scroll -- la apertura ya
   está en pantalla cuando el lead llega. Desde el grupo 348 (prompt 03) vive detrás
   del modificador --carga, que ScrollDolor.vue retira apenas hay scroll real: una
   animación en curso le gana en la cascada a cualquier estilo inline, así que la
   animación de carga y el `:style` por progreso no pueden convivir sobre los mismos
   elementos -- primero una, después el otro. CSS puro, sin librerías: es lo primero que
   carga la página. @keyframes demo-apertura-entrada vive en demo-experiencia.scss (no
   acá): la reutiliza también la pantalla de confirmación (ConfirmacionArmandoDemo.vue,
   prompt 03 de este grupo) -- un @keyframes definido dentro de un <style scoped> NO
   queda acotado a ese componente (Vue no le agrega el atributo data-v-*, solo a los
   selectores), así que declararlo acá otra vez pisaría/sería pisado por el de ese otro
   archivo según qué bundle cargue último -- mismo motivo por el que el override del
   título del cierre del interludio vive en el archivo compartido y no en un scoped
   style (ver comentario en demo-experiencia.scss). */

.demo-scroll-dolor__apertura-titulo {
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 700;
  line-height: 1.15;
  /* Tracking negativo en texto display grande (§15 de apple-design/SKILL.md). */
  letter-spacing: -0.02em;
  max-width: 780px;
  margin: 0;
  /* El padding va acá y no en .demo-scroll-dolor__apertura (el header): la excepcion de
     FondoSeccionSticky.vue para la variante apertura (.demo-fondo-seccion__contenido > *)
     solo alcanza al hijo directo del contenido -- el header -- con padding:0 y (0,3,0) de
     especificidad. Puesto en el header, ese padding:0 le gana siempre a cualquier padding
     que se declare ahí. Acá, en el nieto, el selector > * no llega: sin pelea de cascada. */
  padding: 0 20px;
  will-change: opacity, transform;
}

.demo-scroll-dolor__apertura-subtitulo {
  font-size: clamp(1.1rem, 2.4vw, 1.4rem);
  color: var(--demo-color-texto-suave);
  margin: 0;
  max-width: 620px;
  padding: 0 20px;
  will-change: opacity, transform;
}

/* "both": sin esto el subtítulo (con delay) parpadea visible antes de tiempo.

   Dos tiempos, no uno (grupo 355, prompt 02; pedido de Lucas del 5/8/2026): con 1.2s
   para el titular y 0.22s de retraso para el subtítulo, los dos entraban casi juntos y
   se leían como un solo bloque que aparece de golpe. Ahora el titular tarda 3s y el
   subtítulo espera a que termine -- 3s de la animación + 1s de pausa = 4s de retraso --
   para entrar en su propio 1.2s. La curva es la misma de toda la página.

   La duración se declara acá, en el `animation` de cada uso: el @keyframes compartido
   (demo-experiencia.scss) no se toca, así que la confirmación "armando tu demo"
   conserva exactamente sus tiempos. */
.demo-scroll-dolor__apertura--carga .demo-scroll-dolor__apertura-titulo {
  animation: demo-apertura-entrada 3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.demo-scroll-dolor__apertura--carga .demo-scroll-dolor__apertura-subtitulo {
  animation: demo-apertura-entrada 1.2s cubic-bezier(0.16, 1, 0.3, 1) 4s both;
}

@media (prefers-reduced-motion: reduce) {
  .demo-scroll-dolor__apertura-titulo,
  .demo-scroll-dolor__apertura-subtitulo {
    animation: none;
    opacity: 1;
    transform: none;
    filter: none;
  }
}

/* Bloques 1-6: texto + pieza, en columnas en desktop, apiladas en móvil */
.demo-scroll-dolor__bloque {
  display: grid;
  grid-template-columns: minmax(260px, 420px) 1fr;
  gap: 40px;
  align-items: center;
}

/* Alterna el orden visual texto/pieza para dar ritmo al scroll sin animación extra.
   Antes era :nth-child(even) sobre los hermanos directos de .demo-scroll-dolor; desde
   que cada <article> vive dentro de su propio <fondo-seccion-sticky> (grupo 322,
   prompt 01) ya no son hermanos entre sí, así que la alternancia se selecciona por la
   variante del wrapper (bloque-2 y bloque-4 son los "pares" de los cinco bloques). */
.demo-fondo-seccion--bloque-2 .demo-scroll-dolor__bloque,
.demo-fondo-seccion--bloque-4 .demo-scroll-dolor__bloque {
  direction: rtl;
}

.demo-fondo-seccion--bloque-2 .demo-scroll-dolor__bloque > *,
.demo-fondo-seccion--bloque-4 .demo-scroll-dolor__bloque > * {
  direction: ltr;
}

.demo-scroll-dolor__parrafo {
  font-size: clamp(1.05rem, 1.6vw, 1.25rem);
  line-height: 1.5;
  color: var(--demo-color-texto-suave);
  margin: 0 0 8px;
}

.demo-scroll-dolor__resaltado {
  font-size: clamp(1.2rem, 1.9vw, 1.5rem);
  font-weight: 600;
  color: var(--demo-color-texto);
  margin: 12px 0 0;
}

/* Cierre: texto centrado y más ancho, sin la alternancia rtl de los bloques anteriores */
.demo-scroll-dolor__cierre {
  grid-template-columns: minmax(260px, 480px) 1fr;
  direction: ltr !important;
}

.demo-scroll-dolor__cierre-titulo {
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  font-weight: 700;
  line-height: 1.25;
  /* Tracking negativo en texto display grande (§15 de apple-design/SKILL.md). */
  letter-spacing: -0.02em;
  margin: 0 0 4px;
  background: var(--demo-gradient-marca);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* Dentro del interludio (grupo 322, prompt 05, punto 3): el degradé recortado
   en texto se come a sí mismo sobre una animación azul/violeta -- pasa a
   color sólido. Acotado a .demo-interludio__cierre (si el cierre se sigue
   usando en algún otro lado sin fondo animado, ese caso no se toca). Selector
   con 3 clases a propósito, más específico que la regla base de arriba (2
   clases): así gana siempre dentro de este mismo archivo, sin depender del
   orden de carga entre bundles. */
.demo-scroll-dolor__cierre.demo-interludio__cierre .demo-scroll-dolor__cierre-titulo {
  background: none;
  -webkit-background-clip: initial;
  background-clip: initial;
  color: var(--demo-color-texto);
}

.demo-scroll-dolor__hitos {
  list-style: none;
  margin: 24px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 1.05rem;
  color: var(--demo-color-texto-suave);
}

.demo-scroll-dolor__hitos strong {
  color: var(--demo-color-texto);
}

.demo-scroll-dolor__frase-final {
  margin-top: 20px;
  font-size: clamp(1.2rem, 2vw, 1.5rem);
  font-weight: 600;
}

.demo-scroll-dolor__parrafo-final {
  margin-top: 20px;
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--demo-color-texto-suave);
}

/* Puente al formulario: transición sobria, el formulario en sí va justo debajo (prompt 05).
   Único hijo directo de .demo-scroll-dolor que NO vive dentro de un FondoSeccionSticky (los
   demás ya limitan su propio ancho vía .demo-fondo-seccion__contenido > *) -- desde que el
   padre perdió max-width/padding (correctivo del gap, grupo 336) necesita su propia columna
   legible acá, o el texto queda pegado a los bordes del viewport. */
/* El puente ocupa su propia pantalla (grupo 348, prompt 05). Antes eran dos
   renglones con 24px de padding: entre el momento de marca de toda la página --el
   anillo cerrado con el nombre-- y un formulario de nueve preguntas quedaban menos
   de 100px de aire, y el cambio de registro se sentía abrupto ("ni bien bajo,
   aparece enseguida el título del formulario", Lucas, 4/8/2026). Sigue siendo una
   frase de paso, no un encabezado: un escalón más de tipografía y nada más -- sin
   caja, sin borde, sin fondo propio. 100dvh preferido con 100vh de fallback, y el
   orden importa: un navegador sin soporte de dvh ignora esa declaración entera y se
   queda con la de arriba (mismo criterio que ConfirmacionArmandoDemo.vue). */
.demo-scroll-dolor__puente {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 20px;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  font-size: clamp(1.3rem, 2.6vw, 1.7rem);
  color: var(--demo-color-texto);
}

.demo-scroll-dolor__puente p {
  margin: 0 0 6px;
}

@media (max-width: 767.98px) {
  .demo-scroll-dolor__bloque,
  .demo-scroll-dolor__cierre {
    grid-template-columns: 1fr;
    direction: ltr !important;
  }

  /* En teléfono una pantalla entera de puente más el aire del formulario son dos
     gestos largos de scroll para llegar a la primera pregunta: alcanza con 70vh
     para que la frase quede sola en cuadro. Mismo breakpoint que ya usa el resto
     de la página, no uno nuevo. */
  .demo-scroll-dolor__puente {
    min-height: 70vh;
    min-height: 70dvh;
  }
}
</style>
