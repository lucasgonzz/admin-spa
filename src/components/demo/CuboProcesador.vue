<template>
  <div class="demo-cubo">
    <!-- ============================================================================
         PORTADA. Una pantalla completa antes del cubo: la marca, el titular y el
         "Seguí bajando". Va en flujo normal (no pinneada), así que se va hacia arriba
         con el scroll como cualquier sección de la página.
         ============================================================================ -->
    <section class="demo-cubo__portada">
      <!-- Punto de enganche del avance guiado. La clase `demo-fondo-seccion__snap` no
           es un copy&paste distraído: es el CONTRATO de destinos de esta página --
           avance-guiado.js resuelve a dónde llevar al lead con SELECTOR_DESTINOS, y
           esa clase es la entrada genérica de esa lista. Un marcador propio deja a
           este componente ENTERO por su cuenta: aunque nadie lo agregue a esa lista,
           la portada es un destino y el cubo no se puede saltear de un gesto.
           (Al 10/9/2026 `.demo-cubo` también está en la lista, agregada por la misma
           misión: son dos destinos en la MISMA posición, que es inofensivo --
           `destinos()` los ordena y `siguiente_destino()` toma el primero que supera
           al scroll actual.)
           El estilo del marcador lo pone ESTE archivo (ver el <style>), porque el de
           FondoSeccionSticky.vue es scoped y su atributo data-v-* no alcanza acá. -->
      <div class="demo-fondo-seccion__snap demo-cubo__ancla" aria-hidden="true"></div>

      <!-- 🔴 Logotipo con texto, no el isotipo solo -cambiado en la misión
           paleta-oscura-experiencia, 10/9/2026. Hasta esa misión iba el isotipo
           porque logotipo-comerciocity.png tiene la palabra "ComercioCity" en BLANCO
           puro (medido: promedio RGB 255,255,255 en la zona del texto) -pensado para
           el fondo oscuro de AnimacionProcesador.vue, invisible sobre el fondo claro
           que tenía esta página. Con el tema oscuro completo esa restricción se
           invierte: es el MISMO asset que ya usa la animación, 35,5 KB, ya en el
           repo -no hace falta un logotipo oscuro aparte. -->
      <img
        class="demo-cubo__marca"
        src="../../assets/logotipo-comerciocity.png"
        alt="ComercioCity"
      />

      <!-- Un <span> de bloque por renglón autoral, no un solo párrafo: el corte entre
           las dos frases lo decide el copy (ScrollDolor.vue lo pasa por `titulos`, y
           NO es el mismo texto en los dos perfiles), y adentro de cada frase el corte
           lo sigue decidiendo el ancho, como en el export. -->
      <h2 class="demo-cubo__titular">
        <span v-for="(linea, indice) in titulos" :key="indice" class="demo-cubo__titular-linea">
          {{ linea }}
        </span>
      </h2>

      <p class="demo-cubo__baja">
        <span>Seguí bajando</span>
        <!-- viewBox y no `sc-camel-view-box`: eso último es un artefacto del
             exportador de Claude Design, no un atributo de SVG. -->
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 4.5v15M6.5 13.5 12 19.5l5.5-6" />
        </svg>
      </p>
    </section>

    <!-- ============================================================================
         ESTADO ESTÁTICO (prefers-reduced-motion: reduce). Los cinco mensajes apilados
         y legibles. NO es "el cubo más lento": no hay cubo, no hay pista de 470vh y
         no se registra un solo listener de scroll -- un elemento que gira en tres
         dimensiones mientras el lead scrollea es exactamente lo que esta preferencia
         pide evitar, y dejar la pista larga con el contenido quieto sería media
         docena de pantallas de scroll en las que no pasa nada.
         ============================================================================ -->
    <section v-if="movimiento_reducido" class="demo-cubo__estatico">
      <article v-for="(cara, indice) in caras_con_texto" :key="indice" class="demo-cubo__ficha">
        <span class="demo-cubo__chip demo-cubo__chip--ficha" aria-hidden="true">
          <img src="../../assets/isotipo-comerciocity.svg" alt="" />
        </span>
        <h3 class="demo-cubo__ficha-titulo">{{ cara.titulo }}</h3>
        <p class="demo-cubo__ficha-texto">{{ cara.texto }}</p>
      </article>
    </section>

    <!-- ============================================================================
         LA PISTA. 470vh de recorrido con 100vh pinneados adentro: el mismo esquema
         del export (un solo position: sticky, ver la justificación del pin en el
         comentario de cabecera del <script>).
         ============================================================================ -->
    <section
      v-else
      ref="pista"
      class="demo-cubo__pista"
      :style="{ minHeight: recorrido_vh + 'vh' }"
    >
      <!-- Acá NO va otro marcador de enganche. La pista lleva `scroll-snap-align:
           start` sobre sí misma (ver el <style>): es una snap area MÁS ALTA que el
           snapport, y la especificación deja válida cualquier posición interna --
           que es justo lo que hace falta para recorrer el cubo. Un marcador de 1px
           acá sería un punto de enganche duro en el arranque de la pista, compitiendo
           con eso. -->
      <div class="demo-cubo__pin">
        <!-- Deriva vertical: el cubo SUBE 6vh a lo largo de todo el recorrido, de +3vh a
             -3vh (ver `translateY(3 - 6 · p/(PARADAS-1))` en el <script>). Hasta el
             10/9/2026 acá decía "baja ~6vh", que es el sentido contrario: el recorrido
             son 6vh, pero hacia arriba, y arranca por debajo del centro para terminar por
             encima. Es lo único que se mueve además de la rotación, y va en un envoltorio
             propio para no mezclar `translateY` con el `rotate*` acumulado del cubo. -->
        <div ref="deriva" class="demo-cubo__deriva">
          <div class="demo-cubo__sombra" aria-hidden="true"></div>

          <div ref="cubo" class="demo-cubo__cuerpo">
            <div
              v-for="(cara, indice) in caras"
              :key="indice"
              class="demo-cubo__cara"
              :class="{ 'demo-cubo__cara--ciega': !cara.titulo }"
              :style="{ transform: cara.transform }"
            >
              <template v-if="cara.titulo">
                <span class="demo-cubo__surco demo-cubo__surco--arriba" aria-hidden="true"></span>
                <span class="demo-cubo__surco demo-cubo__surco--abajo" aria-hidden="true"></span>
                <span class="demo-cubo__surco demo-cubo__surco--izquierda" aria-hidden="true"></span>
                <span class="demo-cubo__surco demo-cubo__surco--derecha" aria-hidden="true"></span>
                <span class="demo-cubo__brillo" aria-hidden="true"></span>

                <div class="demo-cubo__cara-contenido">
                  <span class="demo-cubo__chip" aria-hidden="true">
                    <img src="../../assets/isotipo-comerciocity.svg" alt="" />
                  </span>
                  <p class="demo-cubo__cara-titulo">{{ cara.titulo }}</p>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Los cinco párrafos, apilados en el mismo lugar: se cruzan por opacidad y
             desplazamiento vertical. El contenedor tiene alto fijo para que el bloque
             de abajo no salte de tamaño cuando cambia el texto. -->
        <div ref="temas" class="demo-cubo__temas">
          <p v-for="(cara, indice) in caras_con_texto" :key="indice" class="demo-cubo__tema">
            {{ cara.texto }}
          </p>
        </div>

        <div class="demo-cubo__riel" aria-hidden="true">
          <div ref="riel" class="demo-cubo__riel-avance"></div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
/**
 * El cubo del procesador, movido por scroll (grupo de la misión `experiencia-nueva`,
 * 10/9/2026).
 *
 * PORTADO, NO DISEÑADO. La fuente es el export de Claude Design que hizo Lucas:
 * `claude-comerciocity/marca/animacion-cubo/cubo.html`. Ese archivo ya viene resuelto
 * por scroll (no por línea de tiempo), así que acá no se inventó ninguna curva ni
 * ningún tiempo: PREFIJOS, PASOS, `tramo()`, la deriva, el riel y el cruce de los
 * párrafos son los mismos números del export. Si algo de esto hay que retocar, se
 * retoca en el export primero.
 *
 * ── QUÉ CAMBIÓ RESPECTO DEL EXPORT ──────────────────────────────────────────────
 *
 * 1. Ortografía. El export salió sin acentos y con "desiciones". Los textos de acá
 *    son los correctos y son los que mandan.
 * 2. El scroll no sale de `document`. El export hace
 *    `document.addEventListener('scroll', ..., true)` + `document.querySelector`.
 *    En este admin el scroll NO es el del documento: html/body/#app son height:100%
 *    + overflow:hidden ("comportamiento tipo app nativa", src/sass/_app.sass) y el
 *    contenedor con scroll real es <main class="app-main-scroll">. Un listener en
 *    `window` no recibe nunca ese evento -- no burbujea hasta ahí -- y el progreso
 *    quedaría congelado en el valor del montaje. Es el mismo hallazgo que ya está
 *    escrito en la cabecera de FondoSeccionSticky.vue, y se resuelve igual:
 *    encontrar_ancestro_scroll(). Todo lo que el export buscaba con
 *    `document.querySelector` acá sale de un `ref` de este componente.
 * 3. Amortiguación. El export lee el rect crudo en cada evento de scroll. Una rueda
 *    de mouse en Windows entrega escalones de ~100px, así que sin amortiguar el cubo
 *    salta de pose en pose ("parece que sucede todo en seis fps", Lucas, 4/8/2026).
 *    Acá el progreso se persigue con amortiguación exponencial en un bucle de rAF que
 *    CORTA cuando llega, igual que FondoSeccionSticky.vue y SeccionClientes.vue. No
 *    toca la curva: `tramo()` sigue siendo la del export, lo que se suaviza es la
 *    entrada, no la coreografía.
 * 4. Colores. El export está pintado sobre #f1f4f8 con texto #0e1420 / #29354a /
 *    #5b6879 y acento #2f7bff. Acá se usan las variables de la página
 *    (--demo-color-texto, --demo-color-texto-suave, --demo-color-azul) donde no
 *    cambia el diseño; lo que quedó literal es la chapa del cubo (los degradés
 *    claros, los surcos y el encapsulado oscuro del chip), que no es texto de página
 *    sino el material del objeto.
 *
 * ── EL PIN ──────────────────────────────────────────────────────────────────────
 *
 * 🔴 Este componente trae SU PROPIA pista sticky y NO va adentro de un
 * FondoSeccionSticky. Dos position:sticky anidados se despegan en momentos distintos
 * y dejan un tramo de scroll sin contenido: es un bug real que ya costó dos
 * correctivos en esta misma página (grupos 322/325). Se eligió la pista propia y no
 * el componente de la página por tres motivos, en este orden:
 *
 *   · La PORTADA tiene que pasar de largo antes de que el cubo se clave. Un
 *     FondoSeccionSticky pinnea 100vh y todo su contenido vive adentro del pin: la
 *     portada no podría irse hacia arriba, tendría que desvanecerse en el lugar y
 *     comerse parte del recorrido de rotación. Eso ya no sería el export.
 *   · `prefers-reduced-motion: reduce` pide un estado estático SIN la pista de 470vh.
 *     El `min-height` de FondoSeccionSticky se aplica siempre (es un `:style` atado a
 *     la prop), así que desde adentro no hay manera de sacarlo. Acá el `v-else` no
 *     renderiza la pista y punto.
 *   · Es lo mismo que hace SeccionClientes.vue en esta misma misión.
 *
 * ── CONVIVIR CON EL SCROLL GUIADO ───────────────────────────────────────────────
 *
 * El scroller de esta página lleva `scroll-snap-type: y mandatory` y encima un
 * controlador que intercepta la rueda (avance-guiado.js). Con mandatory, un tramo
 * largo SIN nada declarado no es un tramo libre: Chrome tira igual al punto más
 * cercano y el recorrido queda inalcanzable -- es lo que se midió en el grupo 355 con
 * el interludio. Esta sección mide ~5,7 pantallas, así que le pasaría eso mismo.
 *
 * Se resuelve con las dos cosas que la página ya sabe leer, sin tocar el scroller ni
 * suspender el enganche a mano:
 *
 *   · `scroll-snap-align: start` sobre la PISTA (ver el <style>). Es una snap area
 *     más alta que el snapport, y ahí la especificación deja válida cualquier
 *     posición interna -- el cubo se recorre entero. Es la misma propiedad que la
 *     página le pone a `.demo-cubo` en demo-experiencia.scss; acá se declara igual
 *     para que este componente no dependa de eso para poder recorrerse.
 *   · Un marcador `.demo-fondo-seccion__snap` en la portada, que es la entrada
 *     genérica de SELECTOR_DESTINOS en avance-guiado.js: hace que el gesto guiado
 *     aterrice en la portada en vez de saltearse la sección entera.
 *
 * Y el recorrido de adentro queda libre porque `hay_contenido_sin_ver()` del avance
 * guiado ve un destino MÁS ALTO que la pantalla (`.demo-cubo`) y le devuelve la rueda
 * al navegador. Por eso acá NO se prende `demo-scroll-guiado--libre`: la clase existe
 * para el caso contrario (una sección de una pantalla que igual quiere scroll libre),
 * y prenderla desde un segundo componente es tocar estado compartido de la página
 * para conseguir algo que ya está conseguido.
 */

/* `dwell` del export (su prop por defecto): la porción del tramo en la que el cubo
   NO gira, repartida en las dos puntas. Es lo único que hace que cada cara DESCANSE
   en vez de girar sin parar. 0 = rotación continua sin reposo. */
const DWELL = 0.4

/**
 * Las seis caras del cubo, con la transformación que las planta en su lugar. Salen
 * tal cual del export.
 *
 * Los `rotateZ` de las caras 4 y 5 no son decorativos: enderezan el texto para cuando
 * esa cara llega al frente con la rotación acumulada de PREFIJOS encima. Sacarlos deja
 * el título de "Cada cliente, su descuento" cabeza abajo y el de la cara 5 de costado
 * -- que es el defecto clásico de un cubo de CSS.
 *
 * La sexta (abajo) es ciega a propósito: el recorrido tiene cinco paradas, así que
 * esa cara no llega nunca al frente. Lleva su propio degradé, sin contenido.
 */
const CARAS = [
  {
    /* Frente */
    transform: 'translateZ(calc(var(--cubo-lado) / 2))',
    titulo: 'Un producto, todos los canales',
    texto:
      'El mismo producto que está cargado en el sistema se muestra en la tienda online, y lo tiene en cuenta tu agente de WhatsApp para responder y asesorar a tus clientes.',
  },
  {
    /* Derecha */
    transform: 'rotateY(90deg) translateZ(calc(var(--cubo-lado) / 2))',
    titulo: 'Foto a la factura del proveedor',
    texto:
      'Sacá foto a la factura de tu proveedor, y el sistema identifica ese mismo artículo para actualizar su precio y stock.',
  },
  {
    /* Atrás */
    transform: 'rotateY(180deg) translateZ(calc(var(--cubo-lado) / 2))',
    titulo: 'Del código de barras a la ficha',
    texto: 'Imágenes y descripciones automáticas en base al código de barras.',
  },
  {
    /* Arriba */
    transform: 'rotateX(90deg) rotateZ(180deg) translateZ(calc(var(--cubo-lado) / 2))',
    titulo: 'Cada cliente, su descuento',
    texto:
      'Perfilado de tus clientes en base a su actividad en la tienda online, para ofrecer descuentos oportunos súper personalizados a tus mejores clientes.',
  },
  {
    /* Izquierda. El export la titulaba "Reportes y tesorería", que es un rubro y no
       una escena como los otros cuatro títulos. Este está en el mismo registro: par
       nominal separado por coma, igual que "Cada cliente, su descuento". */
    transform: 'rotateY(-90deg) rotateZ(90deg) translateZ(calc(var(--cubo-lado) / 2))',
    titulo: 'Los números, antes de decidir',
    texto: 'Reportes y tesorería, para tomar decisiones informado.',
  },
  {
    /* Abajo: ciega. */
    transform: 'rotateX(-90deg) translateZ(calc(var(--cubo-lado) / 2))',
    titulo: '',
    texto: '',
  },
]

/**
 * El giro de cada uno de los cuatro tramos: eje y grados. Del export, sin tocar.
 */
const PASOS = [
  { eje: 'Y', grados: -90 },
  { eje: 'Y', grados: -90 },
  { eje: 'X', grados: -90 },
  { eje: 'Y', grados: -90 },
]

/**
 * Rotaciones ACUMULADAS en espacio de mundo, una por parada. Cada paso se antepone al
 * anterior (no se suma al final): por eso la lista crece hacia la izquierda. Las caras
 * que quedan de frente, en orden, son frente, derecha, atrás, arriba e izquierda.
 */
const PREFIJOS = [
  '',
  'rotateY(-90deg)',
  'rotateY(-180deg)',
  'rotateX(-90deg) rotateY(-180deg)',
  'rotateY(-90deg) rotateX(-90deg) rotateY(-180deg)',
]

/* Cinco paradas, cuatro tramos entre ellas. */
const PARADAS = PREFIJOS.length

/**
 * La curva de un tramo, con su descanso en las dos puntas.
 *
 * `hold` se reparte mitad y mitad al principio y al final del tramo: en esa porción el
 * cubo está quieto en su cara, y el giro entero ocurre en el medio con una cúbica de
 * entrada y salida. Es la función `seg()` del export, con los mismos números.
 *
 * @param {number} t Avance dentro del tramo, [0,1].
 * @returns {number} Fracción del giro ya aplicada, [0,1].
 */
function tramo(t) {
  const hold = Math.min(0.8, Math.max(0, DWELL))
  const m = hold * 0.5
  const u = Math.min(1, Math.max(0, (t - m) / Math.max(0.001, 1 - 2 * m)))

  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

export default {
  name: 'CuboProcesador',

  props: {
    /**
     * Alto total de la pista en vh: 100vh de pin + el resto de recorrido. 470 es el
     * número del export (370vh de recorrido para cuatro giros, ~92vh por cara). Es
     * prop y no constante para poder calibrarlo desde ScrollDolor.vue sin tocar este
     * archivo, igual que SeccionClientes.vue.
     */
    recorrido_vh: {
      type: Number,
      default: 470,
    },
    /**
     * El titular de la portada, un renglón autoral por entrada. Es prop y no texto
     * fijo porque CAMBIA POR PERFIL: el dueño lee "Nada de esto es sobre el sistema.
     * / Es sobre dejar de ser el único que sabe." y el campeón, "No hace falta que lo
     * expliques vos." (ScrollDolor.vue lo saca de CONTENIDO_POR_PERFIL). El default es
     * el del dueño, que es el texto del export, para que el componente se pueda montar
     * suelto sin quedar sin cabeza.
     */
    titulos: {
      type: Array,
      default() {
        return ['Nada de esto es sobre el sistema.', 'Es sobre dejar de ser el único que sabe.']
      },
    },
  },

  data() {
    return {
      /** true si el lead pidió menos movimiento. Se resuelve UNA vez, antes del primer
       *  render: de esto depende que la pista ni siquiera se renderice. */
      movimiento_reducido: !!(
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ),
      /** Progreso [0,1] RENDERIZADO. Persigue a progreso_objetivo con amortiguación. */
      progreso: 0,
      /** Progreso [0,1] CRUDO, leído del rect de la pista. */
      progreso_objetivo: 0,
      /** id del rAF en vuelo, o null. Es el candado del bucle. */
      raf_id: null,
      /** Timestamp del frame anterior, para escalar la amortiguación por el delta real. */
      ultimo_ts: 0,
      /** El ancestro con scroll real (o `window`). Se guarda para desuscribirse. */
      scroll_target: null,
      /** El observer que apaga el bucle cuando la pista no se ve. */
      observador: null,
      /** true mientras la pista está (cerca de estar) en pantalla. */
      a_la_vista: false,
    }
  },

  computed: {
    /* Los dos van por `computed` y no por `data` a propósito: lo que entra a data() lo
       convierte Vue en un proxy reactivo, y esto es una constante de módulo que no
       cambia nunca. Mismo criterio que SeccionClientes.vue con sus listas de logos. */

    /**
     * Las seis caras del cubo, tal como las declara la constante del módulo.
     *
     * @returns {Array<Object>}
     */
    caras() {
      return CARAS
    },

    /**
     * Las cinco caras con contenido: las que tienen título y párrafo. La sexta (abajo)
     * es ciega y no aparece ni en los párrafos ni en el estado estático.
     *
     * @returns {Array<Object>}
     */
    caras_con_texto() {
      return CARAS.filter(function (cara) {
        return !!cara.titulo
      })
    },
  },

  mounted() {
    /* Sin movimiento: no hay pista, no hay cubo y no se registra un solo listener.
       Todo lo que sigue existe únicamente para mover algo que acá no se mueve. */
    if (this.movimiento_reducido) {
      return
    }

    this.scroll_target = this.encontrar_ancestro_scroll()
    this.scroll_target.addEventListener('scroll', this.on_scroll, { passive: true })
    /* El alto pinneable se mide contra window.innerHeight (el pin es 100vh de
       VIEWPORT, no del contenedor con scroll), así que un resize invalida el cálculo
       igual que un scroll -- esto sí va en window. */
    window.addEventListener('resize', this.on_scroll, { passive: true })
    document.addEventListener('visibilitychange', this.on_visibilidad)

    if (typeof IntersectionObserver === 'function') {
      this.observador = new IntersectionObserver(this.on_interseccion, {
        /* Un poco de margen para que el bucle ya esté corriendo cuando el primer píxel
           de la pista entra: arrancarlo justo en el borde deja el primer frame en 0. */
        rootMargin: '15% 0px',
      })
      this.observador.observe(this.$refs.pista)
    } else {
      this.a_la_vista = true
    }

    /* Primer valor sin amortiguar: si la página se recarga con el scroll a mitad de la
       pista (o el lead vuelve con el botón de atrás), el cubo tiene que aparecer donde
       corresponde, no barrer desde la primera cara hasta ahí. La amortiguación existe
       para suavizar el gesto del lead, no la carga de la página. */
    this.calcular_objetivo()
    this.progreso = this.progreso_objetivo
    this.aplicar()
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
     * Sube por los ancestros hasta encontrar el que realmente scrollea
     * (overflow-y: auto/scroll). En este admin es <main class="app-main-scroll">, pero
     * el selector no se hardcodea: si este componente se usa en una página que sí
     * scrollea el documento, cae a `window` y funciona igual. Mismo método que
     * FondoSeccionSticky.vue y SeccionClientes.vue.
     *
     * @returns {Element|Window}
     */
    encontrar_ancestro_scroll() {
      let nodo = this.$refs.pista ? this.$refs.pista.parentElement : null

      while (nodo && nodo !== document.body) {
        const overflow_y = window.getComputedStyle(nodo).overflowY
        if (overflow_y === 'auto' || overflow_y === 'scroll') {
          return nodo
        }
        nodo = nodo.parentElement
      }

      return window
    },

    /**
     * Handler de scroll y de resize. No calcula el progreso: solo se asegura de que el
     * bucle esté corriendo y revisa si hay que suspender el enganche. El recálculo vive
     * adentro del bucle, porque el progreso se persigue frame a frame aunque el scroll
     * se haya quedado quieto.
     *
     * @returns {void}
     */
    on_scroll() {
      this.arrancar_bucle()
    },

    /**
     * Pestaña que se va al fondo o que vuelve. Ir al fondo apaga el bucle (un rAF en
     * una pestaña oculta no corre, pero el `raf_id` quedaría colgado y el primer frame
     * al volver traería un delta enorme); volver lo reanuda.
     *
     * @returns {void}
     */
    on_visibilidad() {
      if (document.hidden) {
        this.cancelar_bucle()
        return
      }
      this.arrancar_bucle()
    },

    /**
     * El observer: prende y apaga el bucle según si la pista está a la vista. Sin esto
     * quedaría un rAF girando durante toda la página -- es el error que ya se cometió
     * con la escena anterior y está documentado en demo_experiencia.md.
     *
     * @param {Array<IntersectionObserverEntry>} entradas
     * @returns {void}
     */
    on_interseccion(entradas) {
      const entrada = entradas[entradas.length - 1]
      if (!entrada) {
        return
      }

      this.a_la_vista = entrada.isIntersecting
      if (this.a_la_vista) {
        this.arrancar_bucle()
      } else {
        this.cancelar_bucle()
      }
    },

    /**
     * Arranca el bucle si no hay uno corriendo. `raf_id` es el candado: decenas de
     * eventos de scroll por segundo entran acá y todos menos el primero salen sin
     * hacer nada.
     *
     * @returns {void}
     */
    arrancar_bucle() {
      if (this.raf_id !== null || !this.a_la_vista || this.movimiento_reducido) {
        return
      }
      this.ultimo_ts = 0
      this.raf_id = window.requestAnimationFrame(this.animar)
    },

    /**
     * @returns {void}
     */
    cancelar_bucle() {
      if (this.raf_id !== null) {
        window.cancelAnimationFrame(this.raf_id)
        this.raf_id = null
      }
    },

    /**
     * Un frame: recalcula el objetivo desde el rect, acerca el progreso renderizado y
     * decide si sigue o corta.
     *
     * @param {number} ts Timestamp que pasa requestAnimationFrame.
     * @returns {void}
     */
    animar(ts) {
      this.raf_id = null

      if (!this.$refs.pista) {
        return
      }

      /* Primer frame: no hay delta previo, se asume uno de 60fps. Y el delta se topea
         en 100ms porque una pestaña que vuelve del fondo entrega un salto enorme, que
         con la fórmula de abajo daría un factor ~1 -- o sea, exactamente el salto que
         este bucle existe para evitar. */
      const delta_ms = this.ultimo_ts ? Math.min(100, ts - this.ultimo_ts) : 16.67
      this.ultimo_ts = ts

      this.calcular_objetivo()

      /* Amortiguación exponencial. El 0.14 es el factor por frame a 60fps: más bajo =
         más pesado, más alto = más pegado al dedo. Escalado por el delta REAL entre
         frames y no por frame a secas: en un monitor de 120Hz un factor fijo por frame
         corre la animación al doble de velocidad. Mismo número que
         FondoSeccionSticky.vue, para que toda la página se sienta igual. */
      const factor = 1 - Math.pow(1 - 0.14, delta_ms / 16.67)
      const diferencia = this.progreso_objetivo - this.progreso

      if (Math.abs(diferencia) < 0.0005) {
        /* Llegó: se asienta en el valor exacto y el bucle CORTA. Sin este corte
           quedaría un rAF girando para siempre con el scroll quieto. */
        if (this.progreso !== this.progreso_objetivo) {
          this.progreso = this.progreso_objetivo
          this.aplicar()
        }
        return
      }

      this.progreso = this.progreso + diferencia * factor
      this.aplicar()
      this.raf_id = window.requestAnimationFrame(this.animar)
    },

    /**
     * Progreso [0,1] CRUDO según cuánto del alto pinneable de la pista ya se scrolleó.
     * Se mide la <section> de la pista, que NO es la que queda pinneada (su hijo __pin
     * sí lo es) y por lo tanto sí se mueve con el scroll. Es la misma cuenta del
     * export: `-rect.top / (alto de la pista - alto del viewport)`.
     *
     * @returns {void}
     */
    calcular_objetivo() {
      if (!this.$refs.pista) {
        return
      }

      const rect = this.$refs.pista.getBoundingClientRect()
      const alto_pinneable = rect.height - window.innerHeight

      this.progreso_objetivo =
        alto_pinneable > 0
          ? Math.max(0, Math.min(1, -rect.top / alto_pinneable))
          : rect.top <= 0
            ? 1
            : 0
    },

    /**
     * Escribe la pose entera al DOM.
     *
     * 🔴 Escribe estilos A MANO sobre refs, no por `:style` ni por `data` reactivo, y
     * eso es deliberado: es lo que hace el export y es el criterio que ya usa esta
     * página para la escena grande. Colgar el progreso de un binding ata cada frame de
     * scroll a un render de Vue de ~40 nodos que no dependen del progreso para nada.
     *
     * @returns {void}
     */
    aplicar() {
      /* El export mapea el progreso [0,1] de la pista a `p = f * (PARADAS - 1)`: el
         número de parada, con parte decimal. El clamp es defensivo -- progreso ya
         viene acotado y la amortiguación exponencial no se pasa de largo -- pero
         Math.floor() de un valor fuera de rango elegiría un paso que no existe. */
      const p = Math.max(0, Math.min(PARADAS - 1, this.progreso * (PARADAS - 1)))

      const cubo = this.$refs.cubo
      if (cubo) {
        const k = Math.min(PARADAS - 2, Math.floor(p))
        const t = Math.min(1, Math.max(0, p - k))
        const paso = PASOS[k]

        cubo.style.transform =
          p >= PARADAS - 1
            ? PREFIJOS[PARADAS - 1]
            : ('rotate' +
                paso.eje +
                '(' +
                (paso.grados * tramo(t)).toFixed(2) +
                'deg) ' +
                PREFIJOS[k]).trim()
      }

      /* Deriva: de +3vh a -3vh a lo largo de todo el recorrido. */
      const deriva = this.$refs.deriva
      if (deriva) {
        deriva.style.transform =
          'translateY(' + (3 - 6 * (p / (PARADAS - 1))).toFixed(2) + 'vh)'
      }

      /* Riel: arranca ocupando una parada de cinco (20%) y termina lleno. */
      const riel = this.$refs.riel
      if (riel) {
        riel.style.height =
          (100 / PARADAS + (p / (PARADAS - 1)) * (100 - 100 / PARADAS)).toFixed(1) + '%'
      }

      /* Párrafos: se funden por distancia a su parada y se desplazan 26px por parada.
         El 2,1 del export es la pendiente del fundido -- a media parada de distancia
         un párrafo ya está casi apagado, así que nunca se leen dos a la vez. */
      const temas = this.$refs.temas
      if (temas) {
        const nodos = temas.children
        for (let i = 0; i < nodos.length; i++) {
          const distancia = Math.abs(p - i)
          nodos[i].style.opacity = Math.max(0, 1 - distancia * 2.1).toFixed(3)
          nodos[i].style.transform = 'translateY(' + ((p - i) * 26).toFixed(1) + 'px)'
        }
      }
    },
  },
}
</script>

<style scoped>
/* ---------------------------------------------------------------------------
   Envoltorio. `--cubo-lado` es la única medida de la que cuelga toda la geometría
   del cubo (el export la llamaba `--cube`): el translateZ de las seis caras y el
   cuerpo de letra del título salen de acá. clamp con vmin y no con vw: en teléfono
   apaisado el que manda es el alto, y un cubo dimensionado por ancho se sale de
   pantalla.
   --------------------------------------------------------------------------- */
.demo-cubo {
  --cubo-lado: clamp(200px, 31vmin, 250px);
  /* Acento del riel. El export usa #2f7bff; acá es el azul ancla de la marca, que es
     la variable que ya usa el resto de la página. */
  --cubo-acento: var(--demo-color-azul, #0b84f8);

  position: relative;
  width: 100%;
  font-family: var(--demo-font-family, 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  color: var(--demo-color-texto, #1c2333);
}

/* El marcador de enganche del avance guiado. Réplica del de FondoSeccionSticky.vue,
   que es scoped y por lo tanto no llega hasta acá: una marca de posición de 1px, sin
   caja visible y sin capturar el puntero. */
.demo-cubo__ancla {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
  scroll-snap-align: start;
}

/* ---------------------------------------------------------------------------
   Portada
   --------------------------------------------------------------------------- */
.demo-cubo__portada {
  position: relative;
  /* svh después de vh, mismo orden que el resto de la página (.demo-hitos, el video de
     intro, la animación): un navegador sin soporte ignora la segunda declaración entera y
     se queda con la primera. Sin esto, en teléfono con la barra del navegador a la vista
     el pin mide más que lo que se ve y el contenido centrado se corre hacia abajo. */
  min-height: 100vh;
  min-height: 100svh;
  box-sizing: border-box;
  padding: 14vh 7vw 12vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5vh;
  max-width: 1240px;
  margin: 0 auto;
}

.demo-cubo__marca {
  display: block;
  /* Ancho pensado para un logotipo HORIZONTAL (aspecto 4,34:1), no para el isotipo
     cuadrado que iba antes -ese clamp(56px,7vw,84px) daba un logotipo de ~19px de
     alto, ilegible. height:auto respeta el aspecto real del PNG (668×154). */
  width: clamp(160px, 20vw, 260px);
  height: auto;
}

.demo-cubo__titular {
  margin: 0;
  font-size: clamp(30px, 5.4vw, 68px);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.035em;
  text-wrap: pretty;
  /* 20ch sobre el cuerpo del titular: el corte del export, que es lo que le da las
     tres o cuatro líneas cortas en vez de un renglón largo. */
  max-width: 20ch;
  color: var(--demo-color-texto, #1c2333);
}

/* Cada frase autoral arranca en renglón nuevo; adentro sigue cortando por ancho. */
.demo-cubo__titular-linea {
  display: block;
}

.demo-cubo__baja {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--demo-color-texto-suave, #566078);
  font-size: clamp(14px, 1.6vw, 17px);
  font-weight: 500;
  letter-spacing: 0.01em;
}

.demo-cubo__baja svg {
  display: block;
}

/* ---------------------------------------------------------------------------
   Pista y pin
   --------------------------------------------------------------------------- */
/* El min-height lo escribe el componente con la prop recorrido_vh.

   🔴 `scroll-snap-align: start` no es para engancharse: es para PODER RECORRERSE. El
   scroller de la página lleva `scroll-snap-type: y mandatory`, y una snap area más
   alta que el snapport deja válida cualquier posición interna (lo pide la
   especificación, y es lo que ya hacía andar al cierre viejo). Sin esto, mandatory
   tira al punto de enganche más cercano y el recorrido del cubo queda inalcanzable.
   demo-experiencia.scss le declara lo mismo a `.demo-cubo`, un nivel más arriba; acá
   se repite para que este componente no dependa de esa regla para recorrerse. */
.demo-cubo__pista {
  position: relative;
  scroll-snap-align: start;
}

/* ÚNICO elemento pinneado de este componente. overflow: hidden no es prolijidad: un
   cubo con perspectiva proyecta hasta ~1,4 veces su lado cuando pasa por los 45°, y
   sin recorte eso abre scroll horizontal en teléfono. Acá se recorta y se ve en QA.
   width: 100vw + margin-left para llegar a los bordes: el riel de progreso vive
   pegado al borde derecho de la PANTALLA, no de la columna de texto. */
.demo-cubo__pin {
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100svh;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(64px, 9vh, 96px);
}

/* ---------------------------------------------------------------------------
   El cubo
   --------------------------------------------------------------------------- */
.demo-cubo__deriva {
  position: relative;
  flex: 0 0 auto;
  perspective: 1500px;
  /* El punto de fuga apenas por encima del centro: es lo que deja ver un hilo de la
     cara de arriba y hace que el cubo se lea como un objeto y no como un cuadrado. */
  perspective-origin: 50% 44%;
  /* Valor inicial; a partir del primer frame lo escribe aplicar(). */
  transform: translateY(3vh);
}

.demo-cubo__sombra {
  position: absolute;
  left: 6%;
  right: 6%;
  bottom: -5%;
  height: 11%;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(14, 20, 32, 0.22) 0%, rgba(14, 20, 32, 0) 100%);
  filter: blur(10px);
}

.demo-cubo__cuerpo {
  position: relative;
  width: var(--cubo-lado);
  height: var(--cubo-lado);
  transform-style: preserve-3d;
  /* Valor inicial; a partir del primer frame lo escribe aplicar(). */
  transform: rotateY(0deg);
}

/* La chapa: el mismo degradé claro para las cinco caras con contenido. Se deja
   literal y no se pasa a las variables de la página a propósito -- no es texto ni
   fondo de sección, es el material del objeto. */
.demo-cubo__cara {
  position: absolute;
  inset: 0;
  border-radius: 9%;
  overflow: hidden;
  background: linear-gradient(
    146deg,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(231, 239, 249, 0.95) 46%,
    rgba(199, 212, 231, 0.97) 100%
  );
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.8),
    inset 0 0 0 2px rgba(86, 116, 166, 0.16),
    inset 0 3px 18px rgba(255, 255, 255, 0.9);
  /* 🔴 Sin backface-visibility: hidden se ven las caras de atrás A TRAVÉS de las de
     adelante, con su texto espejado. Es el defecto clásico de un cubo de CSS. */
  backface-visibility: hidden;
}

/* La sexta cara (abajo). No llega nunca al frente: solo tapa el hueco. */
.demo-cubo__cara--ciega {
  background: linear-gradient(146deg, rgba(226, 234, 246, 0.97) 0%, rgba(196, 209, 228, 0.97) 100%);
}

/* Los cuatro surcos punteados del borde: el detalle que hace leer la cara como el
   encapsulado de un integrado y no como una tarjeta. */
.demo-cubo__surco {
  position: absolute;
  border-radius: 2px;
}

.demo-cubo__surco--arriba,
.demo-cubo__surco--abajo {
  left: 11%;
  right: 11%;
  height: 2.4%;
  background: repeating-linear-gradient(
    90deg,
    rgba(74, 102, 148, 0.5) 0 3px,
    rgba(0, 0, 0, 0) 3px 8px
  );
}

.demo-cubo__surco--arriba {
  top: 4%;
}

.demo-cubo__surco--abajo {
  bottom: 4%;
}

.demo-cubo__surco--izquierda,
.demo-cubo__surco--derecha {
  top: 11%;
  bottom: 11%;
  width: 2.4%;
  background: repeating-linear-gradient(
    0deg,
    rgba(74, 102, 148, 0.5) 0 3px,
    rgba(0, 0, 0, 0) 3px 8px
  );
}

.demo-cubo__surco--izquierda {
  left: 4%;
}

.demo-cubo__surco--derecha {
  right: 4%;
}

/* El reflejo diagonal sobre la chapa. */
.demo-cubo__brillo {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    128deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 255, 255, 0.1) 24%,
    rgba(255, 255, 255, 0) 44%,
    rgba(255, 255, 255, 0.3) 94%
  );
}

.demo-cubo__cara-contenido {
  position: absolute;
  inset: 12%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4%;
}

/* El procesador de la cara: el cuadrado oscuro con el isotipo adentro. Es el dibujo
   que trae el export y es el que Lucas aprobó, así que no se reemplaza por
   ChipProcesador.vue (que es otra cosa: 190px de encapsulado con 36 pines, halo y
   barrido, movido por un reloj en segundos, no por scroll). */
.demo-cubo__chip {
  width: 25%;
  aspect-ratio: 1;
  border-radius: 20%;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(150deg, #1c2b46 0%, #0b1322 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    0 2px 9px rgba(14, 20, 32, 0.34);
}

.demo-cubo__chip img {
  display: block;
  width: 66%;
  height: auto;
}

/* El título de la cara: el REMATE, a contraste pleno. La jerarquía tenue de esta
   página es deliberada -- cuerpo tenue, remate en contraste pleno -- y acá el cuerpo
   es el párrafo de abajo del cubo.

   🔴 NO usa var(--demo-color-texto). Encontrado en la verificación de la misión
   paleta-oscura-experiencia (10/9/2026): este título se pinta ENCIMA del bezel claro
   de la cara (el chip fotografiado, que no se invierte -- ver el comentario de la
   plantilla), no directamente sobre el fondo de la página. Con la variable, el tema
   oscuro nuevo lo pone en #f4f7fd -blanco- sobre un bezel claro: invisible. Es fijo a
   propósito, igual que el gradiente del propio bezel (.demo-cubo__cara) y el chip
   (.demo-cubo__chip) -ninguno de los dos participa del tema de la página tampoco. */
.demo-cubo__cara-titulo {
  margin: 0;
  font-size: calc(var(--cubo-lado) * 0.082);
  font-weight: 600;
  line-height: 1.13;
  letter-spacing: -0.028em;
  text-wrap: pretty;
  color: #1c2333;
}

/* ---------------------------------------------------------------------------
   Los párrafos
   --------------------------------------------------------------------------- */

/* Alto fijo y los cinco párrafos superpuestos en position: absolute: así el bloque no
   cambia de tamaño cuando cambia el texto y el cubo no se mueve al cruzar de cara. El
   alto está calibrado para el más largo (el de la cara 1, y el de la 4 le pisa los
   talones), medido en los tres anchos. */
.demo-cubo__temas {
  position: relative;
  width: min(88vw, 780px);
  height: clamp(150px, 24vh, 190px);
  flex: 0 0 auto;
}

.demo-cubo__tema {
  position: absolute;
  inset: 0;
  margin: 0;
  text-align: center;
  font-size: clamp(16px, 2.3vw, 27px);
  font-weight: 400;
  line-height: 1.42;
  letter-spacing: -0.016em;
  text-wrap: pretty;
  /* El CUERPO, tenue. El export usaba #29354a, más oscuro que la variable de la
     página; se pasó a la variable para no aplanar la jerarquía contra el título de la
     cara, que es el remate. */
  color: var(--demo-color-texto-suave, #566078);
  /* Valores iniciales: el primero visible, el resto apagados. A partir del primer
     frame los escribe aplicar(). */
  opacity: 0;
  transform: translateY(0);
}

.demo-cubo__tema:first-child {
  opacity: 1;
}

/* ---------------------------------------------------------------------------
   El riel de progreso
   --------------------------------------------------------------------------- */
.demo-cubo__riel {
  position: absolute;
  right: max(3vw, 20px);
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: min(180px, 22vh);
  border-radius: 2px;
  background: rgba(14, 20, 32, 0.1);
  overflow: hidden;
}

.demo-cubo__riel-avance {
  width: 100%;
  border-radius: 2px;
  background: var(--cubo-acento);
  /* Valor inicial (una parada de cinco); a partir del primer frame lo escribe
     aplicar(). */
  height: 20%;
}

/* ---------------------------------------------------------------------------
   Estado estático (prefers-reduced-motion)
   --------------------------------------------------------------------------- */
.demo-cubo__estatico {
  max-width: 780px;
  margin: 0 auto;
  padding: 0 7vw 12vh;
  display: flex;
  flex-direction: column;
  gap: clamp(32px, 6vh, 56px);
}

.demo-cubo__ficha {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'chip titulo'
    '.    texto';
  align-items: center;
  column-gap: 18px;
  row-gap: 10px;
}

/* El mismo procesador de la cara, en tamaño fijo: acá no hay cubo del cual sacar el
   porcentaje. */
.demo-cubo__chip--ficha {
  grid-area: chip;
  width: 44px;
  height: 44px;
}

.demo-cubo__ficha-titulo {
  grid-area: titulo;
  margin: 0;
  font-size: clamp(19px, 2.6vw, 26px);
  font-weight: 600;
  line-height: 1.16;
  letter-spacing: -0.028em;
  text-wrap: pretty;
  color: var(--demo-color-texto, #1c2333);
}

.demo-cubo__ficha-texto {
  grid-area: texto;
  margin: 0;
  font-size: clamp(16px, 2vw, 19px);
  line-height: 1.45;
  letter-spacing: -0.012em;
  text-wrap: pretty;
  color: var(--demo-color-texto-suave, #566078);
}

/* ---------------------------------------------------------------------------
   Teléfono: el cubo y el párrafo comparten 100vh y el párrafo largo (caras 1 y 4)
   es el que se desborda. Se le baja el aire entre los dos y se le da más caja al
   texto, que es lo que hay que leer.
   --------------------------------------------------------------------------- */
@media (max-width: 600px) {
  .demo-cubo {
    /* Por ancho y no por vmin: en teléfono vertical el vmin ES el ancho, pero un
       teléfono acostado tiene vmin chiquito y el cubo se achicaba de más. */
    --cubo-lado: clamp(176px, 46vw, 210px);
  }

  .demo-cubo__pin {
    gap: clamp(40px, 6vh, 64px);
  }

  /* La caja del párrafo se ajusta al peor caso REAL medido en 390x844: cuatro
     renglones = 89px (caras 1 y 4). Con la caja de escritorio (190px) el texto
     terminaba 138px por encima del borde de su caja y el bloque entero se leía
     corrido hacia arriba. */
  .demo-cubo__temas {
    width: min(86vw, 480px);
    height: clamp(128px, 17vh, 170px);
  }

  .demo-cubo__riel {
    right: 12px;
    height: min(120px, 16vh);
  }
}

/* Teléfono apaisado y pantallas bajas: el pin sigue siendo 100vh y ahí no entra un
   cubo grande más un párrafo de cuatro renglones. */
@media (max-height: 560px) {
  .demo-cubo {
    --cubo-lado: clamp(120px, 26vmin, 170px);
  }

  .demo-cubo__pin {
    gap: clamp(20px, 4vh, 36px);
  }

  .demo-cubo__temas {
    height: clamp(110px, 30vh, 160px);
  }

  .demo-cubo__portada {
    padding: 10vh 7vw 8vh;
    gap: 3vh;
  }
}

/* ---------------------------------------------------------------------------
   Movimiento reducido: acá no queda nada que apagar (la pista ni se renderiza),
   pero la portada se deja explícitamente quieta por si algún día alguien le agrega
   una entrada.
   --------------------------------------------------------------------------- */
@media (prefers-reduced-motion: reduce) {
  .demo-cubo__portada,
  .demo-cubo__ficha {
    animation: none !important;
    transform: none !important;
  }
}
</style>
