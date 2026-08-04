<template>
  <section class="demo-scroll-dolor">
    <!-- Apertura: escena cinematográfica animada por scroll (grupo 325, prompt
         03, reemplaza al prompt 06 del grupo 322 -- descartado en su momento
         porque los SVG todavía no existían). Arma su propio FondoSeccionSticky
         adentro, igual que InterludioConvergencia -- no lleva uno acá afuera. -->
    <apertura-cinematografica :titulo="contenido.apertura.titulo" :subtitulo="contenido.apertura.subtitulo" />

    <!-- Bloques 1 a 5: párrafo(s) de dolor + línea de alivio resaltada + pieza multimedia -->
    <fondo-seccion-sticky
      v-for="(bloque, indice) in contenido.bloques"
      :key="bloque.id"
      :variante="'bloque-' + (indice + 1)"
    >
      <article
        :ref="registrar_bloque_ref"
        class="demo-bloque demo-scroll-dolor__bloque"
        :data-bloque-id="bloque.id"
      >
        <div class="demo-scroll-dolor__bloque-texto">
          <p v-for="(linea, indice2) in bloque.texto" :key="indice2" class="demo-scroll-dolor__parrafo">
            {{ linea }}
          </p>
          <p class="demo-scroll-dolor__resaltado">{{ bloque.resaltado }}</p>
        </div>

        <div class="demo-scroll-dolor__bloque-pieza">
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

    <!-- Interludio de convergencia + cierre superpuesto (grupo 322, prompt 05).
         El cierre ya NO va en su propio FondoSeccionSticky: se renderiza por
         encima de la escena del interludio (slot #cierre), mientras la
         convergencia queda atenuada y desaturada detrás. Estructura de texto
         del cierre sin cambios respecto de los bloques 1-5 (título(s) + hitos
         temporales + frase o párrafo de cierre), misma pieza multimedia con
         marco teléfono. -->
    <interludio-convergencia @cierre-visible="emitir_evento_cierre">
      <template #cierre>
        <!-- Sin la clase demo-bloque ni registrar_bloque_ref a propósito: ese
             sistema (IntersectionObserver + opacity:0 base + demo-bloque-entrada)
             es para bloques que aparecen en su posición normal de flujo. Este
             cierre ahora vive dentro de un wrapper posicionado (translateY 100%
             -> 0%) cuya opacidad y entrada ya las controla por completo el
             progreso de scroll de InterludioConvergencia -- combinar los dos
             sistemas haría que el contenido interno animara una segunda vez,
             de forma descoordinada, apenas el wrapper se vuelve geométricamente
             visible para el observer. -->
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
    </interludio-convergencia>

    <!-- Puente al formulario: el formulario en sí lo agrega el prompt 05 (ver
         armazón en ExperienciaDemo.vue, que renderiza esta sección justo antes) -->
    <footer class="demo-bloque demo-scroll-dolor__puente" :ref="registrar_bloque_ref" data-bloque-id="puente">
      <p v-for="(linea, indice) in contenido.puente" :key="indice">{{ linea }}</p>
    </footer>
  </section>
</template>

<script>
import MarcoDispositivo from './MarcoDispositivo.vue'
import PiezaMultimedia from './PiezaMultimedia.vue'
import FondoSeccionSticky from './FondoSeccionSticky.vue'
import InterludioConvergencia from './InterludioConvergencia.vue'
import AperturaCinematografica from './AperturaCinematografica.vue'

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

/**
 * Scroll de dolor de la página inmersiva de demo: seis bloques de dolor +
 * alivio, cada uno con su pieza multimedia dentro de un marco de dispositivo,
 * más apertura y puente al formulario. Renderiza la versión dueño o campeón
 * según `perfil` (contexto/demo_experiencia.md §3.17).
 *
 * Instrumentación mínima (§6 del prompt): cada bloque, al entrar en viewport,
 * dispara `emitir_evento` -- método centralizado en el contenedor
 * (ExperienciaDemo.vue) que hoy solo hace console.debug y mañana se conecta
 * al bus de eventos real sin tener que volver a tocar este componente.
 */
export default {
  name: 'ScrollDolor',

  components: {
    MarcoDispositivo,
    PiezaMultimedia,
    FondoSeccionSticky,
    InterludioConvergencia,
    AperturaCinematografica,
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
       * Referencias a los elementos DOM de cada bloque animable (bloques 1-6
       * + puente; la apertura queda afuera porque nunca se anima). Se
       * reconstruye en cada render vía registrar_bloque_ref para no acumular
       * referencias obsoletas entre updates.
       */
      bloque_refs: [],
      /** Instancia de IntersectionObserver que dispara la animación de entrada. */
      observer: null,
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
    /* Espera al render inicial para tener todos los bloque_refs poblados. */
    this.$nextTick(this.iniciar_observador)
  },

  beforeUpdate() {
    /* Limpia refs antes de cada re-render (cambio de perfil): registrar_bloque_ref
       las vuelve a poblar durante el render siguiente. */
    this.bloque_refs = []
  },

  beforeUnmount() {
    if (this.observer) {
      this.observer.disconnect()
    }
  },

  methods: {
    /**
     * Function ref usada en el template para juntar, en un array propio, los
     * elementos DOM de cada bloque animable (patrón estándar de Vue 3 para
     * refs dentro de v-for).
     *
     * @param {Element|null} el
     * @returns {void}
     */
    registrar_bloque_ref(el) {
      if (el) {
        this.bloque_refs.push(el)
      }
    },

    /**
     * Tracking del bloque de cierre (grupo 322, prompt 05): ya no tiene
     * IntersectionObserver propio -- el cierre vive dentro de
     * InterludioConvergencia, que emite 'cierre-visible' apenas arranca a
     * entrar por encima de la escena. Mismo evento y forma que los bloques
     * 1-5 en iniciar_observador, para no perder cobertura de tracking.
     *
     * @returns {void}
     */
    emitir_evento_cierre() {
      this.emitir_evento('scroll_bloque_visible', { bloque_id: this.contenido.cierre.id, perfil: this.perfil })
    },

    /**
     * Arma el IntersectionObserver que agrega la clase de animación de
     * entrada apenas cada bloque aparece en viewport, y emite el evento de
     * tracking mínimo. Con fallback sin animación si el navegador no soporta
     * IntersectionObserver (todo queda visible directamente).
     *
     * @returns {void}
     */
    iniciar_observador() {
      const self = this

      if (typeof IntersectionObserver === 'undefined') {
        self.bloque_refs.forEach(function (el) {
          el.classList.add('demo-bloque--visible')
        })
        return
      }

      self.observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) {
              return
            }
            entry.target.classList.add('demo-bloque--visible')
            self.limpiar_will_change_al_terminar(entry.target)
            const bloque_id = entry.target.dataset.bloqueId
            if (bloque_id) {
              self.emitir_evento('scroll_bloque_visible', { bloque_id: bloque_id, perfil: self.perfil })
            }
            /* Una vez animado, no hace falta seguir observando ese bloque. */
            self.observer.unobserve(entry.target)
          })
        },
        /* threshold bajo + rootMargin negativo abajo (grupo 325, prompt 01): con el
           contenido pinneado y centrado en el viewport (FondoSeccionSticky), un
           threshold de 0.2 disparaba cuando el bloque ya estaba prácticamente puesto
           en pantalla -- la animación de entrada corría cuando el lead ya lo estaba
           mirando y se perdía. Con 0.01 + rootMargin, el disparo ocurre apenas el
           bloque empieza a entrar. */
        { threshold: 0.01, rootMargin: '0px 0px -25% 0px' }
      )

      self.bloque_refs.forEach(function (el) {
        self.observer.observe(el)
      })
    },

    /**
     * Saca will-change de los elementos que animan la entrada de un bloque apenas
     * termina su animación (grupo 322, prompt 01): la animación real vive en
     * .demo-scroll-dolor__bloque-texto / -pieza (bloques 1-5 y cierre) o en el propio
     * bloque (puente, sin esa estructura interna) -- ver demo-experiencia.scss. Sin
     * esto, will-change quedaría acumulado en las siete secciones del scroll incluso
     * después de terminar de animar.
     *
     * @param {Element} bloque_el
     * @returns {void}
     */
    limpiar_will_change_al_terminar(bloque_el) {
      const tiene_texto_pieza = bloque_el.classList.contains('demo-scroll-dolor__bloque')
      const animados = tiene_texto_pieza
        ? bloque_el.querySelectorAll('.demo-scroll-dolor__bloque-texto, .demo-scroll-dolor__bloque-pieza')
        : [bloque_el]

      animados.forEach(function (el) {
        el.addEventListener('animationend', function limpiar() {
          el.style.willChange = 'auto'
          el.removeEventListener('animationend', limpiar)
        })
      })
    },
  },
}
</script>

<style scoped>
.demo-scroll-dolor {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  /* Mucho aire entre bloques: "poco texto, minimalista, mucho aire" (marca/identidad.md) */
  gap: clamp(96px, 14vw, 160px);
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

/* Puente al formulario: transición sobria, el formulario en sí va justo debajo (prompt 05) */
.demo-scroll-dolor__puente {
  text-align: center;
  font-size: clamp(1.1rem, 2vw, 1.35rem);
  color: var(--demo-color-texto);
  padding-bottom: 24px;
}

.demo-scroll-dolor__puente p {
  margin: 0 0 6px;
}

@media (max-width: 767.98px) {
  .demo-scroll-dolor {
    gap: 72px;
  }

  .demo-scroll-dolor__bloque,
  .demo-scroll-dolor__cierre {
    grid-template-columns: 1fr;
    direction: ltr !important;
  }
}
</style>
