<template>
  <section class="demo-scroll-dolor">
    <!-- Apertura: revertida a solo titular + subtítulo (grupo 336, correctivo 3;
         decisión de Lucas tras ver la escena cinematográfica implementada -- ver nota
         de reversión en demo_experiencia.md §3.18-bis). Ya no arma su propia
         FondoSeccionSticky: la de acá abajo hace todo el trabajo de pin/fondo. -->
    <fondo-seccion-sticky variante="apertura" v-slot="{ progreso }">
      <header
        class="demo-scroll-dolor__apertura"
        :class="{ 'demo-scroll-dolor__apertura--carga': !apertura_entrada_terminada }"
      >
        <h1 class="demo-scroll-dolor__apertura-titulo" :style="estilo_apertura(progreso)">
          {{ contenido.apertura.titulo }}
        </h1>
        <!-- El animationend va en el SUBTÍTULO porque es el último en terminar (entra
             con 4s de retraso): cuando este termina, la entrada completa terminó. -->
        <p
          ref="apertura_subtitulo"
          class="demo-scroll-dolor__apertura-subtitulo"
          :style="estilo_apertura(progreso, true)"
          @animationend="on_entrada_apertura_terminada"
        >
          {{ contenido.apertura.subtitulo }}
        </p>
      </header>
    </fondo-seccion-sticky>

    <!-- Bloques 1 a 5: párrafo(s) de dolor + línea de alivio resaltada + pieza multimedia -->
    <fondo-seccion-sticky
      v-for="(bloque, indice) in contenido.bloques"
      :key="bloque.id"
      :variante="'bloque-' + (indice + 1)"
      :recorrido_vh="recorrido_dolor_vh"
      v-slot="{ progreso }"
      @progreso="on_progreso_bloque($event, bloque.id)"
    >
      <article class="demo-scroll-dolor__bloque" :data-bloque-id="bloque.id">
        <div class="demo-scroll-dolor__bloque-texto" :style="estilo_bloque(progreso, false, indice)">
          <p v-for="(linea, indice2) in bloque.texto" :key="indice2" class="demo-scroll-dolor__parrafo">
            {{ linea }}
          </p>
          <p class="demo-scroll-dolor__resaltado">{{ bloque.resaltado }}</p>
        </div>

        <div class="demo-scroll-dolor__bloque-pieza" :style="estilo_bloque(progreso, true, indice)">
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

    <!-- Interludio del portal. El cierre YA NO va adentro (grupo 355, prompt 06):
         hasta ahora se renderizaba superpuesto sobre la escena (slot #cierre) dentro
         de una tarjeta acotada a 46vh con scroll propio. Lucas, 5/8/2026: "quiero que
         la tarjeta no tenga un alto definido y ocupe todo el alto que tenga que
         ocupar. No quiero que haya un scroll dentro de esa tarjeta".
         De los dos caminos que daba el prompt se tomó el segundo: el cierre deja de
         ser un overlay y pasa a ser el tramo siguiente del scroll. El primero -- que
         el panel entre más arriba y el nombre suba con él -- no cierra: el contenido
         del cierre en la versión campeón (párrafo largo + pieza multimedia) no entra
         en una pantalla junto con el anillo, y en teléfono menos todavía. Así el
         anillo y el nombre se quedan con la escena entera para ellos (el tramo de
         "nombre solo" pasa de 0.84-0.94 a 0.84-1, más largo que antes) y la tarjeta
         llega después, en su propio espacio, sin techo. -->
    <interludio-portal @cierre-visible="emitir_evento_cierre" />

    <!-- El cierre, en flujo normal y sin techo de alto. Sin `:style` por progreso, a
         diferencia de los bloques 1-5: no vive dentro de un FondoSeccionSticky, así
         que no hay progreso de sección del que colgarse. Queda visible y estático,
         como el puente de acá abajo. -->
    <section class="demo-cierre">
        <article
          class="demo-scroll-dolor__bloque demo-scroll-dolor__cierre demo-cierre__tarjeta"
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
    </section>

    <!-- Puente al formulario (el formulario lo renderiza ExperienciaDemo.vue justo
         después de esta sección). Desde el grupo 355 (prompt 08) vive adentro de un
         FondoSeccionSticky como las otras seis: era la única sección del recorrido sin
         fondo propio -- "tiene el fondo muy blanco", Lucas, 5/8/2026 -- y sin progreso
         del cual colgar su entrada, así que quedaba como texto plano y estático en
         medio de una página que se mueve toda. -->
    <fondo-seccion-sticky variante="puente" v-slot="{ progreso }">
      <footer class="demo-scroll-dolor__puente" data-bloque-id="puente">
        <p
          v-for="(linea, indice) in contenido.puente"
          :key="indice"
          class="demo-scroll-dolor__puente-linea"
          :class="indice === 0 ? 'demo-scroll-dolor__puente-linea--protagonista' : 'demo-scroll-dolor__puente-linea--remate'"
          :style="estilo_puente(progreso, indice > 0)"
        >
          {{ linea }}
        </p>
      </footer>
    </fondo-seccion-sticky>
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
   que daba el animation-delay de 0.18s del sistema anterior, traducido a progreso.

   Grupo 369, prompt 04 (Lucas: "que la animación de cómo están apareciendo los dolores
   sea un poco más lenta para que se aprecie mejor"): la entrada pasa de 0.28 a 0.42, y
   el desfase de la pieza acompaña en la misma proporción (0.05/0.28 = 0.075/0.42) o la
   pieza entraría pegada al texto. La SALIDA no se toca: Lucas dijo explícitamente que
   el fundido de salida le gusta como está.

   🔴 LA CUENTA QUE HAY QUE ENTENDER ANTES DE VOLVER A TOCAR ESTOS NÚMEROS, porque el
   prompt 02 de este mismo grupo cambió las reglas del juego y la intuición acá falla.

   Con el avance guiado, el lead ya no recorre la sección con su propio scroll: cada
   gesto es un desplazamiento programado de un punto de enganche al siguiente, y durante
   ESE desplazamiento el progreso de la sección que entra va de 0 a `snap_progreso` --
   por definición del punto de enganche. O sea que la entrada no dura "0.42 de scroll":
   dura la fracción `ENTRADA_FIN / snap_progreso` del gesto, y el gesto dura lo que tarde
   el scroll programado del navegador.

   De ahí salen dos consecuencias que van en contra de lo que uno haría:
     1. Estirar la entrada Y mover el enganche en la misma proporción se cancela solo:
        0.28/0.28 y 0.42/0.42 son los dos el 100% del gesto. No cambia nada.
     2. Poner el enganche donde termina de entrar la PIEZA (0.42 + 0.075 = 0.495), que
        suena a mejora, deja la entrada del texto en el 85% del gesto: o sea la haría
        MÁS RÁPIDA que hoy, justo lo contrario de lo que pidió Lucas. Se probó y se
        descartó por eso. El enganche se queda en ENTRADA_FIN, y la pieza sigue llegando
        al 99,4% de su entrada en el momento del aterrizaje -- exactamente lo que pasa
        hoy con 0.28/0.05, así que no se cambia nada que Lucas ya aceptó.

   Lo que queda para que sea más lento, y es lo que se eligió: MÁS DISTANCIA por gesto
   (ver RECORRIDO_DOLOR_VH). Vale si el navegador escala la duración de su scroll suave
   con la distancia. 🔴 NO VERIFICADO: el panel de navegador de esta sesión no compone
   frames, así que un scroll suave no avanza y no hay forma de medir cuánto dura. Es lo
   único de este prompt que queda a confirmar mirando la página.

   Y si Lucas lo sigue viendo rápido, el lever que manda NO es ninguno de estos números:
   es la duración del desplazamiento, o sea animarlo nosotros en avance-guiado.js en vez
   de delegarlo a `behavior: 'smooth'`. Eso ya es cambiar el mecanismo del prompt 02 y no
   se hizo por cuenta propia. Estirar más estos números no lo va a lograr.

   En scroll libre (hoy el interludio, y cualquier scroll que el control no intercepte)
   los números sí valen como se leen: ahí la entrada ocupa 0.42 del alto pinneable en vez
   de 0.28 y se recorre al pulso del lead, o sea 50% más de scroll para el mismo
   desplazamiento. */
const ENTRADA_FIN = 0.42
const SALIDA_INICIO = 0.72
const DESFASE_PIEZA = 0.075
/* Alto de las secciones de dolor, en vh (el default del componente son 160). Más
   recorrido = más distancia entre un punto de enganche y el siguiente = un
   desplazamiento programado más largo. 200 y no más: cada vh de más es scroll en el que
   no cambia nada para quien recorra la página a mano. */
const RECORRIDO_DOLOR_VH = 200
/* Entrada LATERAL (grupo 355, prompt 03; pedido de Lucas del 5/8/2026): cada mitad
   del bloque entra desplazándose desde su propio lado -- el texto desde el suyo, la
   pieza desde el suyo -- una contra la otra. Antes las dos subían desde abajo (96px)
   y se leía como un fundido en el lugar. La SALIDA no cambia: sigue siendo hacia
   arriba, que es lo que Lucas pidió mantener ("cuando bajo para despedirme de ese
   dolor, que tenga el efecto que tiene ahora"). */
const ENTRADA_X = 80
/* El puente entra desde abajo y no de costado (grupo 355, prompt 08): son dos
   renglones centrados, no un texto y una pieza que se cruzan. Más corto que los 96px
   que usaban los bloques antes de la entrada lateral -- es una transición, no una
   escena. */
const ENTRADA_Y_PUENTE = 40
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
       * false hasta que la entrada de carga de la apertura TERMINÓ de correr.
       * Mientras es false manda la animación CSS (zoom del titular + bounce del
       * subtítulo); cuando termina, la clase se retira y los dos pasan a depender del
       * progreso, que es lo que les da la reversa al subir.
       *
       * 🔴 Esto lo decide el TIEMPO, nunca el scroll (grupo 369, prompt 01). Hasta
       * este prompt la clase se retiraba en cuanto el progreso de la sección superaba
       * 0.001, y eso dejaba la entrada de 3s a merced del primer píxel de scroll:
       * medido en un banco que reproduce el scroller del admin, pedir 2px de scroll
       * con `scroll-snap-type: y mandatory` activo (grupo 355) deposita el scroll en
       * el punto de snap de la sección -- 121px en un viewport de 720, o sea progreso
       * 0.28 -- así que la clase se retiraba en el primer frame siguiente, la
       * animación desaparecía y el titular quedaba en su estado final. Es exactamente
       * lo que Lucas describió: "no lo hace con ningún efecto, simplemente aparece".
       * Cualquier reintroducción de una condición de scroll acá revive ese bug.
       */
      apertura_entrada_terminada: false,
      /** Ids de bloque cuyo evento de tracking ya se emitió (una vez por bloque). */
      bloques_trackeados: {},
      /* Constante de arriba que el template necesita ver. No cambia nunca: vive acá
         porque un template de Vue no alcanza el ámbito del módulo, y no en computed
         porque no se calcula a partir de nada. */
      recorrido_dolor_vh: RECORRIDO_DOLOR_VH,
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

  mounted() {
    /**
     * Red de seguridad del único camino por el que se libera la clase --carga: si la
     * entrada no llegó a existir como animación, no va a haber ningún animationend
     * que esperar y la apertura se quedaría clavada en su estado de carga para
     * siempre, sin la reversa por progreso al subir. Pasa al menos en un caso real y
     * previsible: reduced-motion, donde las animaciones quedan en `none`.
     *
     * 🔴 Y ojo con CUÁL regla las apaga, porque no es la de este archivo: la media
     * query del `<style scoped>` de acá abajo sale como
     * `.demo-scroll-dolor__apertura-titulo[data-v-*]` (0,2,0) y PIERDE contra
     * `.demo-scroll-dolor__apertura--carga .demo-scroll-dolor__apertura-titulo[data-v-*]`
     * (0,3,0), que es la que declara la animación. La que gana de verdad es el bloque
     * de reduced-motion de demo-experiencia.scss, que lleva `animation: none !important`
     * (verificado por el checker aislando las dos reglas). O sea: si alguien limpia ese
     * `!important` del archivo compartido pensando que la media query scoped ya cubre el
     * caso, reduced-motion se come los ~5s de entrada Y esta red deja de dispararse.
     *
     * Se consulta al DOM en vez de duplicar acá las duraciones que declara el CSS:
     * un segundo lugar con los mismos números se desincroniza en el primer ajuste de
     * tiempos que alguien haga en el <style>. Y tampoco se usa un temporizador de
     * respaldo "por si acaso": sería otra copia de la duración, y en una pestaña de
     * fondo (donde el reloj de la animación no avanza pero el del timer sí) cortaría
     * la entrada, que es el bug que este prompt vino a arreglar.
     *
     * getAnimations() acá no es prematuro: medido en el navegador, devuelve la
     * animación ya creada en el instante siguiente a que el elemento entra al
     * documento, sin ninguna lectura de layout de por medio -- la llamada obliga al
     * navegador a resolver los estilos pendientes.
     */
    const self = this
    this.$nextTick(function () {
      const subtitulo = self.$refs.apertura_subtitulo
      if (!subtitulo || !subtitulo.getAnimations || subtitulo.getAnimations().length === 0) {
        self.apertura_entrada_terminada = true
      }
    })
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
     * tramos: entrada (0 -> ENTRADA_FIN, hoy 0.42), meseta (la sección
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
     * @param {number} indice Índice del bloque en el v-for (0-based), para saber de
     *                        qué lado entra cada mitad. Ver bloque_invertido().
     * @returns {object}
     */
    estilo_bloque(p, secundario, indice) {
      if (this.reduced_motion) {
        /* Sin estilos inline: manda el CSS, que bajo esta media query deja todo
         * plenamente visible y estático. */
        return {}
      }

      const desfase = secundario ? DESFASE_PIEZA : 0
      const entrada = ease_out(this.normalizar(p, desfase, ENTRADA_FIN + desfase))
      const salida = ease_out(this.normalizar(p, SALIDA_INICIO + desfase, 1))

      const opacidad = entrada - salida * (1 - SALIDA_OPACIDAD)
      /* Cada mitad entra desde el lado donde REALMENTE está: en un bloque normal el
       * texto viene de la izquierda y la pieza de la derecha; en uno invertido, al
       * revés. Con un desplazamiento fijo, en los invertidos cada mitad entraría
       * cruzando por encima de la otra. */
      const desde_la_derecha = secundario ? !this.bloque_invertido(indice) : this.bloque_invertido(indice)
      const x = (1 - entrada) * ENTRADA_X * (desde_la_derecha ? 1 : -1)
      /* La salida sigue siendo vertical y no se toca. */
      const y = salida * SALIDA_Y

      return {
        opacity: String(opacidad),
        transform: 'translate(' + x + 'px, ' + y + 'px)',
      }
    },

    /**
     * Estilo de un renglón del puente para el progreso `p` de su sección (grupo 355,
     * prompt 08). Mismos tramos, misma curva y mismo desfase que los bloques, pero
     * con desplazamiento VERTICAL: los dos renglones están centrados uno debajo del
     * otro, así que hacerlos entrar de costados opuestos como a un bloque los
     * cruzaría en el aire. Igual que estilo_bloque, es función pura del progreso: la
     * reversa al subir sale gratis.
     *
     * @param {number} p Progreso [0,1] de la sección.
     * @param {boolean} secundario true para el segundo renglón, el remate.
     * @returns {object}
     */
    estilo_puente(p, secundario) {
      if (this.reduced_motion) {
        return {}
      }

      const desfase = secundario ? DESFASE_PIEZA : 0
      const entrada = ease_out(this.normalizar(p, desfase, ENTRADA_FIN + desfase))
      const salida = ease_out(this.normalizar(p, SALIDA_INICIO + desfase, 1))

      return {
        opacity: String(entrada - salida * (1 - SALIDA_OPACIDAD)),
        transform: 'translateY(' + ((1 - entrada) * ENTRADA_Y_PUENTE + salida * SALIDA_Y) + 'px)',
      }
    },

    /**
     * true si el bloque tiene su composición dada vuelta (pieza a la izquierda,
     * texto a la derecha). Lo decide el `direction: rtl` que el <style> de este
     * mismo archivo le pone a las variantes bloque-2 y bloque-4 del wrapper -- o
     * sea, a los de índice impar del v-for, que es lo que se replica acá. Si algún
     * día cambia la alternancia allá abajo, hay que cambiarla acá también: son las
     * dos caras del mismo dato y no hay forma de leer el `direction` computado sin
     * ir al DOM, que es justo lo que estos métodos no hacen (son funciones puras
     * del progreso).
     *
     * @param {number} indice Índice 0-based del bloque en el v-for.
     * @returns {boolean}
     */
    bloque_invertido(indice) {
      return Number(indice) % 2 === 1
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
     * Retira la animación CSS de carga cuando la entrada TERMINÓ de correr, y no
     * antes. A partir de ahí el `:style` por progreso es el único que manda --
     * mientras la animación viva, sus valores le ganan a cualquier estilo inline (las
     * animaciones pisan al inline en la cascada), así que las dos cosas no pueden
     * convivir sobre los mismos elementos: primero una, después el otro.
     *
     * Lo dispara el animationend del subtítulo, que es el último en terminar. Por qué
     * el evento y no un temporizador: el reloj de una animación CSS no avanza mientras
     * la pestaña no se está renderizando, pero un setTimeout sí -- una página abierta
     * en una pestaña de fondo se comería la entrada igual que antes. El evento llega
     * cuando la animación terminó de verdad, esté la pestaña donde esté.
     *
     * No hace falta filtrar por animationName: el handler está en el subtítulo, que
     * tiene una sola animación y ningún hijo del cual pudiera burbujear otra.
     *
     * @returns {void}
     */
    on_entrada_apertura_terminada() {
      this.apertura_entrada_terminada = true
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
     * Tracking del bloque de cierre (grupo 322, prompt 05): no tiene observador
     * propio -- lo dispara InterludioPortal cuando su progreso llega a 0.94.
     * Mismo evento y forma que los bloques 1-5, para no perder cobertura.
     *
     * Desde el grupo 355 (prompt 06) el cierre ya no está adentro del interludio:
     * es la sección siguiente. El 0.94 quedó como proxy -- es el mismo punto del
     * recorrido en el que antes empezaba a asomar la tarjeta, pero ahora se
     * adelanta ~30vh de scroll a que se vea de verdad. Si algún día el dato tiene
     * que ser exacto, lo correcto es un IntersectionObserver sobre .demo-cierre,
     * que ahora existe como sección propia.
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
  /* Fluido y no los 16px fijos de antes (grupo 369, prompt 01, pedido de Lucas: "que
     el título y el subtítulo estén un poco más separados verticalmente"): en una
     pantalla alta hay respiro de verdad y en una baja no se come el aire de los
     costados. En un viewport de 720 da 28,8px; el techo de 48 llega recién a 1200. */
  gap: clamp(24px, 4vh, 48px);
}

/* Animación de entrada de la apertura (grupo 336, revierte la escena cinematográfica
   del grupo 325): corre UNA sola vez al cargar, no atada al scroll -- la apertura ya
   está en pantalla cuando el lead llega. Desde el grupo 348 (prompt 03) vive detrás
   del modificador --carga: una animación en curso le gana en la cascada a cualquier
   estilo inline, así que la animación de carga y el `:style` por progreso no pueden
   convivir sobre los mismos elementos -- primero una, después el otro.

   🔴 QUIÉN retira ese modificador es la corrección del grupo 369 (prompt 01): lo
   retira el FIN de la animación (animationend del subtítulo), no el primer scroll.
   Hasta acá lo retiraba `p > 0.001`, y con el scroll-snap del grupo 355 eso se cumplía
   en el primer frame -- 2px de scroll aterrizan en el punto de snap de la sección, o
   sea progreso 0.28 --, así que la entrada de 3s se veía un cuadro y desaparecía ("no
   lo hace con ningún efecto, simplemente aparece", Lucas, 5/8/2026). Ver el comentario
   de apertura_entrada_terminada en el <script>.

   CSS puro, sin librerías: es lo primero que carga la página. Los @keyframes
   (demo-apertura-zoom para el titular, demo-apertura-bounce para el subtítulo) viven en
   demo-experiencia.scss y no acá, igual que demo-apertura-entrada, que sigue en uso en
   la pantalla de confirmación (ConfirmacionArmandoDemo.vue): un @keyframes definido
   dentro de un <style scoped> NO queda acotado a ese componente (Vue no le agrega el
   atributo data-v-*, solo a los selectores), así que declararlo acá pisaría/sería
   pisado por el de ese otro archivo según qué bundle cargue último -- mismo motivo por
   el que el override del título del cierre del interludio vive en el archivo compartido
   y no en un scoped style (ver comentario en demo-experiencia.scss). */

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

/* "both": sin esto el subtítulo (con delay) parpadea visible antes de tiempo, y sin él
   tampoco quedaría retenido el estado final hasta que ScrollDolor retire la clase.

   Dos tiempos, no uno (grupo 355, prompt 02; pedido de Lucas del 5/8/2026): con 1.2s
   para el titular y 0.22s de retraso para el subtítulo, los dos entraban casi juntos y
   se leían como un solo bloque que aparece de golpe.

   Grupo 369, prompt 01: el titular pasa de demo-apertura-entrada (fade + zoom + blur,
   3s) a demo-apertura-zoom (zoom limpio desde 0.86, 2s) y el subtítulo a un rebote.
   El retraso del subtítulo son los 2s que tarda el titular más los 2s de pausa que
   pidió Lucas ("que espere unos dos segundos y recién ahí aparezca el subtítulo").

   MEDIDO, para el día que alguien quiera ajustar esa pausa: con la curva de la página
   -- cubic-bezier(0.16, 1, 0.3, 1), que es casi todo movimiento al principio -- el zoom
   de 2s ya está al 97% al primer segundo. O sea que la pausa PERCIBIDA es de ~3s, no de
   2. Se deja así porque es lo que declara la especificación del prompt; si Lucas la
   quiere más corta, lo único que se toca es este retraso (4s -> 3s), no la curva ni la
   duración.

   La duración se declara acá, en el `animation` de cada uso, y no en el @keyframes: los
   de demo-experiencia.scss se comparten con otras pantallas. */
.demo-scroll-dolor__apertura--carga .demo-scroll-dolor__apertura-titulo {
  animation: demo-apertura-zoom 2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.demo-scroll-dolor__apertura--carga .demo-scroll-dolor__apertura-subtitulo {
  animation: demo-apertura-bounce 0.9s cubic-bezier(0.16, 1, 0.3, 1) 4s both;
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

/* El degradé recortado en texto se come a sí mismo cuando el título va sobre una
   tarjeta clara -- pasa a color sólido. Nació para el cierre superpuesto sobre la
   escena animada del portal (grupo 322, prompt 05); desde el grupo 355 (prompt 06) el
   cierre es su propia pantalla y la clase que lo identifica es .demo-cierre__tarjeta,
   pero el motivo es el mismo y el selector sigue siendo de 3 clases a propósito: más
   específico que la regla base de arriba (2 clases), así gana siempre dentro de este
   mismo archivo, sin depender del orden de carga entre bundles. */
.demo-scroll-dolor__cierre.demo-cierre__tarjeta .demo-scroll-dolor__cierre-titulo {
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

/* El puente ocupa su propia pantalla (grupo 348, prompt 05). Antes eran dos
   renglones con 24px de padding: entre el momento de marca de toda la página --el
   anillo cerrado con el nombre-- y un formulario de nueve preguntas quedaban menos
   de 100px de aire, y el cambio de registro se sentía abrupto ("ni bien bajo,
   aparece enseguida el título del formulario", Lucas, 4/8/2026). 100dvh preferido con
   100vh de fallback, y el orden importa: un navegador sin soporte de dvh ignora esa
   declaración entera y se queda con la de arriba (mismo criterio que
   ConfirmacionArmandoDemo.vue).

   Desde el grupo 355 (prompt 08) vive dentro de un FondoSeccionSticky, y eso cambia
   dos cosas de esta regla, las dos por la misma razón: la pantalla completa ahora la
   garantiza el pin de la sección (100vh) y el ancho legible lo da
   .demo-fondo-seccion__contenido > * (max-width 1080 + padding lateral). El
   min-height pasa de 100dvh a 100% -- un 100dvh acá adentro mide MÁS que la caja del
   pin, que ya le descuenta su padding vertical, y el overflow:hidden del pin lo
   recortaría; y el max-width/padding propios se retiran para no duplicar los del
   contenedor. El efecto que buscaba el grupo 348 (el puente ocupa su propia pantalla)
   se conserva entero. */
.demo-scroll-dolor__puente {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: var(--demo-color-texto);
}

.demo-scroll-dolor__puente-linea {
  margin: 0;
  will-change: opacity, transform;
}

/* Primer renglón: el protagonista (grupo 355, prompt 08, pedido de Lucas). Un escalón
   más grande y con más peso que el remate, sin llegar al titular de la apertura --
   sigue siendo una frase de paso, no un encabezado. */
.demo-scroll-dolor__puente-linea--protagonista {
  font-size: clamp(1.6rem, 3.4vw, 2.3rem);
  font-weight: 700;
  line-height: 1.2;
  /* Tracking negativo en texto display grande (§15 de apple-design/SKILL.md). */
  letter-spacing: -0.015em;
}

/* Segundo renglón: el remate, en el tono suave y con aire respecto del primero. */
.demo-scroll-dolor__puente-linea--remate {
  margin-top: clamp(14px, 2.4vh, 26px);
  font-size: clamp(1.15rem, 2.2vw, 1.45rem);
  font-weight: 400;
  line-height: 1.45;
  color: var(--demo-color-texto-suave);
}

@media (max-width: 767.98px) {
  .demo-scroll-dolor__bloque,
  .demo-scroll-dolor__cierre {
    grid-template-columns: 1fr;
    direction: ltr !important;
  }

  /* Apertura más grande y más separada en teléfono (grupo 369, prompt 01, pedido de
     Lucas: "en teléfono los dos sean un poco más grandes y estén más separados").

     El problema no era el clamp en sí sino cuál de sus tres valores manda: con
     `clamp(2rem, 5vw, 3.25rem)`, en un teléfono de 390px el 5vw da 19,5px, muy por
     debajo del mínimo, así que el titular quedaba fijo en 2rem -- chico para la
     primera pantalla de la página. Acá el término central se recalibra a la escala del
     teléfono (9,8vw sobre 390px = 38,2px) y el mínimo baja apenas para que los
     teléfonos angostos sigan reduciendo en vez de desbordar.

     Medido en un banco con el mismo markup y el meta viewport de index.html, con los
     dos titulares (dueño y campeón): 390px -> 38,3px / 19,5px, 360px -> 35,3px en tres
     renglones, 320px -> 34,4px, y en ninguno de los tres el titular desborda
     (scrollWidth == clientWidth). Los tamaños de desktop no se tocan: estas reglas
     viven dentro de la media query. */
  .demo-scroll-dolor__apertura {
    gap: clamp(30px, 5vh, 52px);
  }

  .demo-scroll-dolor__apertura-titulo {
    font-size: clamp(2.15rem, 9.8vw, 2.55rem);
  }

  .demo-scroll-dolor__apertura-subtitulo {
    font-size: clamp(1.2rem, 5vw, 1.4rem);
  }

  /* RETIRADO (grupo 355, prompt 08): acá el puente bajaba a 70vh en teléfono, para
     que una pantalla entera de puente más el aire del formulario no fueran dos
     gestos largos hasta la primera pregunta. Desde que vive dentro de un
     FondoSeccionSticky el alto lo manda el pin (100vh) y esta excepción no puede
     cumplirse achicando el hijo: el pin sigue midiendo lo mismo y solo quedaría
     texto centrado en una caja más chica. El costo de scroll que buscaba evitar lo
     resuelve ahora el avance guiado del prompt 07: un gesto lleva del puente al
     formulario, sin importar cuánto mida la sección. */
}
</style>
