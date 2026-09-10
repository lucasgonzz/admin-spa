<template>
  <section class="demo-scroll-dolor">
    <!-- Apertura: revertida a solo titular + subtítulo (grupo 336, correctivo 3;
         decisión de Lucas tras ver la escena cinematográfica implementada -- ver nota
         de reversión en demo_experiencia.md §3.18-bis). Ya no arma su propia
         FondoSeccionSticky: la de acá abajo hace todo el trabajo de pin/fondo. -->
    <!-- LA ANIMACIÓN DEL PROCESADOR (misión experiencia-nueva, 10/9/2026). Es lo primero
         que ve el lead. Portada del export de Claude Design a Vue nativo -- la fuente
         desempaquetada y el porqué del port (contra embeber el bundle o filmarlo a WebP)
         están en marca/animacion-procesador/ del repo de conocimiento.

         Reemplaza a <escena-hero>, que contaba lo mismo -- problemas sueltos, procesador,
         solución -- y se borró con sus 2,8 MB de WebP animado (decisión de Lucas, 10/9).

         Las cuatro props del FondoSeccionSticky son las que tenía el interludio, por los
         mismos motivos: snap_progreso 0 para que el lead aterrice con la animación SIN
         empezar; snap_libre_mientras_ocupa para que el avance por gesto no la intercepte;
         boton_avance false porque un botón que se la saltea contradice lo anterior; y
         contenido_full_bleed true porque sin eso el max-width: 1080px que el padre le pone
         a cualquier hijo "de columna" le come el fondo a sangre.

         🔴 El progreso NO va por el slot escopeado: va por el evento y de ahí a un método
         del hijo, vía ref. Atarlo al template ata cada frame de scroll a un render de Vue,
         y acá lo único que cambia son estilos que el reloj escribe a mano.

         🔴 Y solo ADELANTA: la animación corre sola a su ritmo (24,4 s) y el scroll la
         empuja hacia adelante, nunca hacia atrás. Es lo que pidió Lucas -- el que tiene
         paciencia la ve entera, el que no, llega al mensaje sin frustrarse. -->
    <!-- 🔴 Bajo reduced-motion la sección NO se pinnea, y no es una sutileza: el
         `min-height: 320vh` que FondoSeccionSticky escribe como estilo inline no lo
         puede sacar ninguna regla CSS (un inline gana), así que el bloque de
         reduced-motion de demo-experiencia.scss despinea el contenido pero deja 220vh
         de fondo NEGRO VACÍO que el lead tiene que scrollear a mano. El cubo esquivó
         este mismo problema no usando FondoSeccionSticky; acá se esquiva con el v-if.
         Sin pista tampoco hay progreso de scroll que aplicar, que es justo lo que
         reduced-motion pide: la animación muestra su cuadro final y punto. -->
    <fondo-seccion-sticky
      v-if="!reduced_motion"
      variante="animacion"
      :recorrido_vh="320"
      :snap_progreso="0"
      :snap_libre_mientras_ocupa="true"
      :boton_avance="false"
      :contenido_full_bleed="true"
      @progreso="on_progreso_animacion"
    >
      <animacion-procesador ref="animacion" />
    </fondo-seccion-sticky>
    <div v-else class="demo-animacion-estatica">
      <animacion-procesador />
    </div>


    <fondo-seccion-sticky variante="apertura" :contenido_full_bleed="true" v-slot="{ progreso }">
      <!-- 🔴 --espera retiene la entrada hasta que la apertura SE VE. Sin eso, los ~2,4s
           de la animación (zoom del titular + bounce del subtítulo) corren al montar --
           o sea, mientras el lead todavía está mirando la animación del procesador, que
           ocupa 320vh antes que esto -- y para cuando scrollea hasta acá el titular ya
           está en su estado final. Es exactamente el sintoma que Lucas reportó en el
           grupo 369 ("no lo hace con ningún efecto, simplemente aparece"), revivido por
           haber puesto una sección larga delante. Detectado el 10/9/2026 por el chequeo
           independiente de la misión experiencia-nueva.

           Sigue siendo el TIEMPO el que decide cuándo TERMINA (el animationend del
           subtítulo); lo único que cambió es cuándo EMPIEZA. Una condición de scroll
           sobre el final es la que revivía el bug viejo, y esa no está. -->
      <header
        class="demo-scroll-dolor__apertura"
        :class="{
          'demo-scroll-dolor__apertura--espera': !apertura_vista,
          'demo-scroll-dolor__apertura--carga': apertura_vista && !apertura_entrada_terminada,
        }"
      >
        <h1 class="demo-scroll-dolor__apertura-titulo" :style="estilo_apertura(progreso)">
          {{ contenido.apertura.titulo }}
        </h1>
        <!-- El animationend va en el SUBTÍTULO porque es el último en terminar (entra
             con retraso): cuando este termina, la entrada completa terminó.
             El retraso no se repite acá a propósito -- el número vive en el <style>, y
             una segunda copia se desincroniza en el primer ajuste de tiempos (pasó: el
             grupo 370 bajó el retraso a 3,5s y este comentario quedó diciendo 4s). -->
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

    <!-- LOS CLIENTES (misión experiencia-nueva, 10/9/2026). Reemplaza a los cinco
         bloques de dolor, que se sacaron enteros con sus piezas multimedia por pedido
         de Lucas: "las secciones de dolores las sacaría, quiero en lugar de eso hacer
         una animación estilo la página de Apple y mostrar sobre los clientes que
         tenemos".

         🔴 Va SUELTA en el scroll, NO dentro de un <fondo-seccion-sticky>: trae su
         propio pin. Dos sticky anidados es el bug de los grupos 322/325. -->
    <seccion-clientes />

    <!-- EL CUBO (misión experiencia-nueva, 10/9/2026). Portado del export de Claude
         Design que hizo Lucas; la fuente desempaquetada y el análisis están en
         marca/animacion-cubo/ del repo de conocimiento.

         Trae adentro su propia portada con "Nada de esto es sobre el sistema. Es sobre
         dejar de ser el único que sabe." -- el mensaje que Lucas pidió conservar. Por
         eso ese titular ya NO vive acá: si se repone en esta plantilla, se dice dos
         veces seguidas.

         🔴 Igual que la sección de clientes: trae su propio pin, no lo envuelvas. -->
    <cubo-procesador :titulos="contenido.hitos.titulo_portada" />

    <!-- LOS HITOS. Vivían dentro del cierre, debajo del titular que ahora abre el cubo.
         Lucas pidió sacar los DOLORES, no estos: son copy validado (marca/cliente_ideal.md)
         y siguen siendo por perfil. Quedan acá, como línea de tiempo del valor y entrada
         a "Bienvenido a la nueva era".

         En flujo normal y sin techo de alto, igual que estaba el cierre: no vive dentro
         de un FondoSeccionSticky, así que no hay progreso de sección del que colgarse. -->
    <section class="demo-hitos">
      <div class="demo-hitos__tarjeta">
        <ul class="demo-scroll-dolor__hitos">
          <li v-for="(hito, indice) in contenido.hitos.lista" :key="indice">
            <strong>{{ hito.momento }}</strong> {{ hito.texto }}
          </li>
        </ul>

        <!-- Versión dueño: frase corta de cierre -->
        <p v-if="contenido.hitos.frase_final" class="demo-scroll-dolor__frase-final">
          {{ contenido.hitos.frase_final }}
        </p>
        <!-- Versión campeón: párrafo largo ya validado por Lucas (marca/cliente_ideal.md) -->
        <p v-if="contenido.hitos.parrafo_final" class="demo-scroll-dolor__parrafo-final">
          {{ contenido.hitos.parrafo_final }}
        </p>
      </div>
    </section>

    <!-- "Bienvenido a la nueva era" + los tres pilares de la implementación. -->
    <seccion-nueva-era />

    <!-- Las reseñas de Google. 🔴 HOY NO RENDERIZA NADA: el array está vacío a propósito
         porque no hay ninguna fuente de reseñas todavía (se le pidió a Lucas el link de
         su perfil el 10/9/2026 y no llegó). No se inventan reseñas ni promedio. -->
    <seccion-resenas />


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
import FondoSeccionSticky from './FondoSeccionSticky.vue'
import AnimacionProcesador from './animacion/AnimacionProcesador.vue'
import SeccionClientes from './SeccionClientes.vue'
import CuboProcesador from './CuboProcesador.vue'
import SeccionNuevaEra from './SeccionNuevaEra.vue'
import SeccionResenas from './SeccionResenas.vue'

/**
 * Copy por perfil de la página, transcripto palabra por palabra desde
 * contexto/demo_pagina.md §1 (versión dueño) y §2 (versión campeón) del repo
 * claude-comerciocity. No parafrasear ni ajustar acá: cualquier cambio de
 * texto se hace en ese archivo, no en este componente.
 *
 * 🔴 De los cinco bloques de dolor y sus siete slots multimedia (`scroll.1` a
 * `scroll.6` más `scroll.2-tel`) NO queda nada: se sacaron enteros el 10/9/2026
 * (misión experiencia-nueva) por pedido de Lucas, y las piezas se descartaron.
 * Siguen cargadas en el admin y en R2, sin nadie que las consuma. Si alguna vez
 * vuelven, salen de ahí; no hace falta volver a filmarlas.
 *
 * Lo que queda por perfil son tres cosas: la `apertura`, los `hitos` -- que
 * incluyen el `titulo_portada` con el que abre el cubo, y que NO es el mismo texto
 * en los dos perfiles -- y el `puente` al formulario.
 */
const CONTENIDO_POR_PERFIL = {
  dueno: {
    apertura: {
      titulo: 'Tu negocio funciona porque vos te acordás.',
      subtitulo: 'Y eso tiene un límite.',
    },
    hitos: {
      titulo_portada: [
        'Nada de esto es sobre el sistema.',
        'Es sobre dejar de ser el único que sabe.',
      ],
      lista: [
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
    hitos: {
      /* 🔴 MISMO texto que el perfil dueño, y es una decisión de Lucas del 10/9/2026:
         "poné la animación del cubo que hice en ambos casos". Hasta ese día el campeón
         abría con "No hace falta que lo expliques vos." -- una diferencia por perfil que
         venía de §3.17 y que la portada del cubo, tal como Lucas la diseñó en Claude
         Design, no contempla. Si alguien quiere volver a diferenciarlos, que sea con él:
         esto no es un descuido de copiar y pegar. */
      titulo_portada: [
        'Nada de esto es sobre el sistema.',
        'Es sobre dejar de ser el único que sabe.',
      ],
      lista: [
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
   348, prompt 03). El desfasaje de la pieza respecto del texto es el mismo que daba el
   animation-delay de 0.18s del sistema anterior, traducido a progreso.

   ⚠️ Hasta el grupo 369 esto decía "entrada corta, meseta larga, salida corta". Con la
   entrada estirada a 0.42 dejó de ser cierto y hay que decirlo con números: sobre
   secciones de 160vh son 25,2vh de entrada, 18vh de meseta y 16,8vh de salida, o sea que
   el tramo más largo pasó a ser la ENTRADA. La meseta sigue alcanzando para leer porque
   con el avance guiado el lead queda estacionado justo en su comienzo y la sección no se
   mueve hasta el gesto siguiente.

   Grupo 369, prompt 04 (Lucas: "que la animación de cómo están apareciendo los dolores
   sea un poco más lenta para que se aprecie mejor"): la entrada pasa de 0.28 a 0.42, y
   el desfase de la pieza acompaña en la misma proporción (0.05/0.28 = 0.075/0.42) o la
   pieza entraría pegada al texto. La SALIDA no se toca: Lucas dijo explícitamente que
   el fundido de salida le gusta como está.

   🔴 LA CUENTA, QUE NO ES LA OBVIA. En vh de scroll, la entrada ocupa
   `ENTRADA_FIN × (recorrido_vh − 100)`: con 160vh de sección y 0.28 eran 16,8vh y con
   0.42 son 25,2vh, o sea la mitad más de scroll para el mismo desplazamiento. El
   `− 100` es porque el alto PINNEABLE es el alto de la sección menos la pantalla que
   ocupa el pin -- el mismo 🔴 que documentaba la escena vieja del interludio en su nota de
   `progreso × (recorrido_vh − 100)`, que ya se había hecho mal una vez (grupo 348).

   Y con el avance guiado del prompt 02 hay una cuenta más, que es la que importa para lo
   que pidió Lucas: cada gesto es un desplazamiento programado de un punto de enganche al
   siguiente, o sea de `recorrido_vh` de distancia, y la entrada ocupa de ese gesto la
   fracción `ENTRADA_FIN × (1 − 100/recorrido_vh)`. Con 0.28 era el 10,5% del gesto; con
   0.42 es el 15,7%. El resto del gesto la sección viene subiendo desde abajo de la
   pantalla con su progreso clavado en 0 (`calcular_objetivo` recorta en 0), así que no
   se ve nada de la entrada hasta el último tramo.

   ⚠️ Dos cosas que parecen ciertas y NO lo son -- las dos las escribí acá y las midió el
   checker, así que quedan anotadas para que nadie las repita:
     · "estirar la entrada y mover el enganche en la misma proporción se cancela": falso,
       la velocidad no depende del enganche. Va de 10,5% a 15,7% del gesto.
     · "poner el enganche en ENTRADA_FIN + DESFASE_PIEZA (0.495) haría la entrada más
       rápida (85% del gesto)": falso, ocupa exactamente la misma fracción. Lo que cambia
       es CUÁNDO termina dentro del gesto, no cuánto dura. Ese 85% salía de dividir
       progresos como si fueran tiempos.
   El enganche igual se queda en ENTRADA_FIN, por el criterio 2 del prompt: la pieza llega
   al 99,43% de su entrada en el aterrizaje, exactamente el mismo número que daba
   0.28/0.05, así que no se cambia nada que Lucas ya aceptó.

   ⚠️ Y lo que NO se hace, aunque el prompt lo ofrezca: subir el `recorrido_vh` de estas
   secciones. Se probó con 200 y se revirtió, porque el tramo de SALIDA se mide con la
   misma regla y pasaba de 16,8vh a 28vh -- un 67% más lento --, y Lucas dijo
   explícitamente que la salida le gusta como está. Estirar solo ENTRADA_FIN deja la
   salida intacta: 0.72→1 sobre 60vh pinneables sigue siendo 16,8vh.

   Si Lucas lo sigue viendo rápido, el lever que queda es la duración del desplazamiento
   del avance guiado, o sea animarlo nosotros en avance-guiado.js en vez de delegarlo a
   `behavior: 'smooth'`. Eso es cambiar el mecanismo del prompt 02 y no se hizo por cuenta
   propia. */
const ENTRADA_FIN = 0.42
const SALIDA_INICIO = 0.72
const DESFASE_PIEZA = 0.075
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
/* La salida no llega a 0: un bloque que se va del todo deja un hueco blanco en medio
   del recorrido. Lo usa estilo_puente(). */
const SALIDA_OPACIDAD = 0.35

/**
 * La curva de toda la página: 1 - (1-t)³. La misma que usaba la escena del interludio,
 * y la misma familia que el easeOutCubic del motor de la animación del procesador
 * (animacion/motor-tiempo.js). Dos curvas distintas en la misma página se notan.
 *
 * @param {number} t
 * @returns {number}
 */
function ease_out(t) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * El recorrido de la página inmersiva de demo, rehecho el 10/9/2026 (misión
 * experiencia-nueva): la animación del procesador, la apertura, los clientes, el
 * cubo, los hitos, "Bienvenido a la nueva era", las reseñas y el puente al
 * formulario. Renderiza la versión dueño o campeón según `perfil`
 * (contexto/demo_experiencia.md §3.17).
 *
 * ⚠️ El nombre del componente quedó viejo: ya no hay ningún "scroll de dolor". Se
 * conserva porque renombrarlo toca la ruta, el SCSS compartido y una docena de
 * selectores `demo-scroll-dolor__*` que siguen siendo los correctos para lo que sí
 * sobrevivió (apertura, hitos y puente).
 *
 * Instrumentación mínima (§6 del prompt): al terminar de entrar, una sección
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
    FondoSeccionSticky,
    AnimacionProcesador,
    SeccionClientes,
    CuboProcesador,
    SeccionNuevaEra,
    SeccionResenas,
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
       * el punto de snap de la sección -- 121px en un viewport de 720, que con el
       * snap_progreso de ese momento (0.28; hoy es 0.42) era progreso 0.28 -- así que
       * la clase se retiraba en el primer frame siguiente, la
       * animación desaparecía y el titular quedaba en su estado final. Es exactamente
       * lo que Lucas describió: "no lo hace con ningún efecto, simplemente aparece".
       * Cualquier reintroducción de una condición de scroll acá revive ese bug.
       */
      apertura_entrada_terminada: false,
      /**
       * false hasta que la apertura entró al viewport por primera vez. Retiene el
       * arranque de la entrada: ver el comentario del <header> en el template.
       */
      apertura_vista: false,
      /** true una vez emitido el evento de que el lead vio la animación entera. */
      animacion_trackeada: false,
      /** El IntersectionObserver que reporta qué secciones vio el lead, o null. */
      observador_secciones: null,
      /** El IntersectionObserver que dispara la entrada de la apertura, o null. */
      observador_apertura: null,
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
     *
     * 🔴 Y desde el 10/9/2026 esta red NO corre en mounted, sino en cuanto la apertura
     * se ve y la clase --carga entra (ver red_de_seguridad_apertura()). Corriéndola en
     * mounted quedaba SIEMPRE en el caso "no hay animación" --porque sin --carga no hay
     * ninguna que encontrar--, marcaba la entrada como terminada y entonces --carga no
     * se aplicaba nunca: la entrada desaparecía del todo, en vez de llegar tarde.
     */
    this.observar_secciones()
  },

  beforeUnmount() {
    if (this.observador_secciones) {
      this.observador_secciones.disconnect()
      this.observador_secciones = null
    }
    if (this.observador_apertura) {
      this.observador_apertura.disconnect()
      this.observador_apertura = null
    }
  },

  methods: {
    /**
     * Arranca el reporte de qué secciones vio el lead.
     *
     * 🔴 Existe porque la instrumentación se rompía en silencio. Hasta el 10/9/2026 la
     * página tenía seis puntos de medición -- uno por bloque de dolor, más el cierre --
     * y todos se fueron con los bloques. Sin esto queda UN solo evento en toda la página
     * (el de la animación), así que el brief del closer no puede decir dónde abandonó el
     * lead: la señal desaparece sin que nada falle ni quede en ningún log.
     *
     * Un observador para todas las secciones, y no uno por componente: las cuatro
     * secciones nuevas son componentes independientes que no reciben `emitir_evento`, y
     * pasárselo a cada una sería cablear la instrumentación en cuatro APIs para siempre.
     * Acá se observan sus nodos raíz desde afuera y los componentes no se enteran.
     *
     * Se emite UNA vez por sección (unobserve al disparar), con el mismo nombre de
     * evento que usaban los bloques -- `scroll_bloque_visible` -- para que lo que ya lee
     * esos eventos del otro lado no tenga que cambiar.
     *
     * @returns {void}
     */
    observar_secciones() {
      if (typeof IntersectionObserver === 'undefined') {
        return
      }

      const self = this
      const secciones = [
        ['.demo-clientes', 'clientes'],
        ['.demo-cubo', 'cubo'],
        ['.demo-hitos', 'hitos'],
        ['.demo-nueva-era', 'nueva_era'],
        ['.demo-resenas', 'resenas'],
      ]

      self.observador_secciones = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) {
            return
          }
          const id = entrada.target.getAttribute('data-seccion-id')
          self.observador_secciones.unobserve(entrada.target)
          self.emitir_evento('scroll_bloque_visible', { bloque_id: id, perfil: self.perfil })
        })
      /* 0.5 y no 0: que el borde asome no es haberla visto. Es el mismo criterio que
         usaba on_progreso_bloque(), que esperaba a que la entrada terminara. */
      }, { threshold: 0.5 })

      /* La apertura no emite evento: lo que se observa acá es CUÁNDO ARRANCA su
         animación de entrada. Umbral bajo y no 0.5: la entrada tiene que estar corriendo
         cuando el lead termina de llegar, no empezar recién con la sección centrada. */
      const apertura = self.$el && self.$el.querySelector('.demo-scroll-dolor__apertura')
      if (apertura) {
        self.observador_apertura = new IntersectionObserver(function (entradas) {
          if (!entradas[entradas.length - 1].isIntersecting) {
            return
          }
          self.observador_apertura.disconnect()
          self.observador_apertura = null
          self.apertura_vista = true
          self.red_de_seguridad_apertura()
        }, { threshold: 0.15 })
        self.observador_apertura.observe(apertura)
      }

      secciones.forEach(function (par) {
        const nodo = self.$el && self.$el.querySelector(par[0])
        if (!nodo) {
          /* `.demo-resenas` hoy no renderiza ningún nodo (el array de reseñas está
             vacío a propósito). No es un error: cuando tenga datos, entra sola. */
          return
        }
        nodo.setAttribute('data-seccion-id', par[1])
        self.observador_secciones.observe(nodo)
      })
    },

    /**
     * Si la entrada de la apertura no llegó a existir como animación, la da por
     * terminada a mano. Sin esto la apertura se quedaría clavada en su estado de carga
     * para siempre, sin la reversa por progreso al subir. El caso real y previsible es
     * reduced-motion, donde el CSS deja las animaciones en `none`.
     *
     * Corre en el tick siguiente a que --carga entra, no en mounted: ver el comentario
     * largo de mounted().
     *
     * @returns {void}
     */
    red_de_seguridad_apertura() {
      const self = this
      this.$nextTick(function () {
        const subtitulo = self.$refs.apertura_subtitulo
        if (!subtitulo || !subtitulo.getAnimations || subtitulo.getAnimations().length === 0) {
          self.apertura_entrada_terminada = true
        }
      })
    },

    /**
     * Progreso de la sección de la animación de apertura.
     *
     * 🔴 Solo ADELANTA. La animación corre sola a su ritmo (24,4 s) y esto la empuja
     * hacia adelante; nunca la rebobina. Es la decisión de Lucas del 10/9/2026: el lead
     * con paciencia la ve entera, y el que no la tiene llega al mensaje sin frustrarse.
     * `adelantar_desde_scroll()` ya ignora un progreso menor al del reloj, así que acá
     * no hace falta compararlo.
     *
     * Va por `ref` y no por el slot escopeado a propósito, igual que hacía el interludio:
     * consumir el progreso desde el template ata cada frame de scroll a un render de Vue,
     * y lo único que cambia acá son estilos que el reloj del hijo escribe a mano.
     *
     * @param {number} p Progreso [0,1] de la sección, ya amortiguado por el componente.
     * @returns {void}
     */
    on_progreso_animacion(p) {
      const animacion = this.$refs.animacion
      if (animacion) {
        animacion.adelantar_desde_scroll(p)
      }
      if (p >= 0.94 && !this.animacion_trackeada) {
        this.animacion_trackeada = true
        this.emitir_evento('scroll_bloque_visible', {
          bloque_id: 'animacion.procesador',
          perfil: this.perfil,
        })
      }
    },

    /**
     * Normaliza `p` al rango [0,1] dentro de [inicio, fin] -- misma función que
     * usa la coreografía de la escena central, para no tener dos formas de recortar tramos.
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
     * Estilo de un renglón del puente para el progreso `p` de su sección (grupo 355,
     * prompt 08). Mismos tramos, misma curva y mismo desfase que los bloques, pero
     * con desplazamiento VERTICAL: los dos renglones están centrados uno debajo del
     * otro, así que hacerlos entrar de costados opuestos como a un bloque los
     * cruzaría en el aire. Es función pura del progreso: la
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
   en el primer frame -- 2px de scroll aterrizan en el punto de snap de la sección, o sea
   el progreso de `snap_progreso` --, así que la entrada de 3s se veía un cuadro y
   desaparecía ("no
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
   El retraso del subtítulo son los 2s que tarda el titular más la pausa que pidió
   Lucas después.

   Grupo 370, prompt 01: esa pausa baja de 2s a 1,5s ("me gusta lo que agregaste de
   que aparezca el subtítulo a los tres segundos, pero quiero cambiarlo para que
   aparezca a los dos segundos, o al segundo y medio, mejor", 6/8/2026). O sea el
   retraso pasa de 4s a 3,5s = 2s de titular + 1,5s de pausa.

   🔴 Grupo 374, prompt 01: ese 3,5s era la lectura EQUIVOCADA del pedido. Lucas cuenta
   el segundo y medio desde que el titular APARECE, no desde que TERMINA su zoom ("la
   primera sección me sigue mostrando el subtítulo recién a los tres segundos de que
   aparece el título, y te había pedido que sea al segundo y medio", 7/8/2026). El
   retraso es entonces 1,5s a secas, medido desde el arranque de la entrada, y NO se
   suma nada por el titular. Si en algún momento el solapamiento con el final del zoom
   molesta, lo que se acorta es el zoom del titular -- este 1,5s es el número que pidió
   Lucas y no se vuelve a correr para acomodar otra cosa.

   Y por eso el subtítulo SIGUE siendo el último en terminar, que es de lo que cuelga el
   @animationend que retira --carga: 1,5s + 0,9s = 2,4s contra los 2s del titular. El
   margen quedó en 0,4s: si alguien acorta este retraso por debajo de 1,1s o alarga el
   zoom del titular, el animationend hay que mudarlo al titular o la apertura se queda
   con la clase de carga puesta para siempre y el progreso nunca toma el control.

   MEDIDO, para el día que alguien quiera ajustar esa pausa: con la curva de la página
   -- cubic-bezier(0.16, 1, 0.3, 1), que es casi todo movimiento al principio -- el zoom
   de 2s ya está al 97% al primer segundo. O sea que a los 1,5s el titular está
   prácticamente quieto y el solapamiento no se lee como dos cosas moviéndose a la vez.
   Lo único que se toca para ajustar la pausa es este retraso, no la curva ni la
   duración del zoom.

   La duración se declara acá, en el `animation` de cada uso, y no en el @keyframes: los
   de demo-experiencia.scss se comparten con otras pantallas. */
.demo-scroll-dolor__apertura--carga .demo-scroll-dolor__apertura-titulo {
  animation: demo-apertura-zoom 2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.demo-scroll-dolor__apertura--carga .demo-scroll-dolor__apertura-subtitulo {
  animation: demo-apertura-bounce 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.5s both;
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

/* La tarjeta de los hitos. Antes esto era el CIERRE: mismo lugar en la página, pero
   con el titular arriba ("Nada de esto es sobre el sistema...") y una pieza multimedia
   al lado, en una grilla de dos columnas. Desde el 10/9/2026 el titular abre el cubo y
   la pieza se descartó, así que queda una sola columna centrada -- no una grilla de dos
   con una celda vacía. */
.demo-hitos__tarjeta {
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 28px;
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

/* La apertura, retenida hasta que se ve (ver el comentario del <header>). Es el mismo
   estado del que arranca la animación --opacidad 0-- para que al entrar --carga no haya
   ningún salto: el primer cuadro del keyframe es exactamente esto.

   🔴 El `!important` NO es prolijidad, y sacarlo devuelve el destello: los dos elementos
   llevan `:style="estilo_apertura(...)"`, un estilo INLINE, y un inline le gana a
   cualquier selector por especificidad. Medido el 10/9/2026 sin el !important: la
   opacidad computada en --espera daba 1, así que el titular quedaba plenamente visible
   hasta que el observador lo veía y recién ahí la animación arrancaba desde 0 -- un
   parpadeo justo cuando el lead llega. Es el mismo motivo por el que el bloque de
   reduced-motion de demo-experiencia.scss usa !important, y ahí está documentado igual. */
.demo-scroll-dolor__apertura--espera .demo-scroll-dolor__apertura-titulo,
.demo-scroll-dolor__apertura--espera .demo-scroll-dolor__apertura-subtitulo {
  opacity: 0 !important;
}

/* Bajo reduced-motion la animación del procesador va en flujo normal y ocupa UNA
   pantalla, no las 320vh de la pista que no se renderiza. Ver el v-else del template. */
.demo-animacion-estatica {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100svh;
  background: #04060b;
}
</style>
