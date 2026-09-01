<template>
  <!-- Formulario de configuración de la demo: diseño propio, inmersivo, NO usa
       componentes de formulario del admin (son de interfaz interna y rompen el
       clima de esta página pública). Controles grandes, pensados para el pulgar
       (contexto/demo_experiencia.md §3.16 B: la mayoría entra desde el teléfono). -->
  <section class="demo-formulario">
    <!-- Encabezado, texto de demo_pagina.md §3: se transcribe, no se reescribe -->
    <header class="demo-formulario__encabezado">
      <h2 class="demo-formulario__titulo">Contanos cómo trabajás</h2>
      <p class="demo-formulario__subtitulo">
        Ya marcamos lo más habitual. Cambiá solo lo que no coincida con tu negocio.
      </p>
    </header>

    <!-- Una pregunta por bloque: texto + opciones grandes. Todo llega
         preseleccionado (local_respuestas se arma desde el prop `respuestas`) -->
    <div
      v-for="pregunta in preguntas"
      :key="pregunta.clave"
      class="demo-formulario__pregunta"
    >
      <p class="demo-formulario__pregunta-texto">{{ pregunta.pregunta }}</p>
      <p v-if="pregunta.descripcion" class="demo-formulario__pregunta-descripcion">
        {{ pregunta.descripcion }}
      </p>
      <!-- Un solo control con dos posiciones, no dos botones sueltos (grupo 355,
           prompt 09). El indicador es un elemento aparte que se DESPLAZA con
           transform: que se mueva, y no que aparezca del otro lado, es lo que
           comunica "esto es un interruptor" -- el gesto del IosToggle de empresa-spa,
           tomado como referencia de forma (otro repo, otro proyecto: no se importa).
           Cada mitad sigue siendo un <button> y no un checkbox oculto, porque son dos
           valores con etiqueta y no un booleano: en tipo_precios valen 'unico' y
           'listas'. -->
      <div
        class="demo-formulario__opciones"
        :class="{
          'demo-formulario__opciones--sin-transicion': sin_transicion,
          'demo-formulario__opciones--deshabilitado': enviando,
        }"
        role="radiogroup"
        :aria-label="pregunta.pregunta"
      >
        <!-- Se oculta si la respuesta guardada no coincide con ninguna opción: es
             preferible un control sin posición marcada que uno apuntando a la
             opción equivocada. -->
        <span
          class="demo-formulario__indicador"
          :style="estilo_indicador(pregunta)"
          aria-hidden="true"
        ></span>

        <button
          v-for="opcion in pregunta.opciones"
          :key="String(opcion.valor)"
          type="button"
          class="demo-formulario__opcion"
          :class="{ 'demo-formulario__opcion--activa': local_respuestas[pregunta.clave] === opcion.valor }"
          role="radio"
          :aria-checked="local_respuestas[pregunta.clave] === opcion.valor ? 'true' : 'false'"
          :disabled="enviando"
          @click="seleccionar(pregunta.clave, opcion.valor)"
        >
          {{ opcion.texto }}
        </button>
      </div>
    </div>

    <!-- Mensaje sobrio si el envío falla: el lead puede reintentar sin perder lo marcado -->
    <p v-if="error" class="demo-formulario__error">{{ error }}</p>

    <!-- El botón de confirmar es el final de la primera página (grupo 336, prompt 03):
         nada debajo. El mensaje de cierre ("Listo, armamos tu demo...") se retiró --
         quedó obsoleto cuando se creó la pantalla de confirmación (grupo 322, prompt 03):
         decía lo mismo que dice esa pantalla siguiente, y anticipaba un resultado antes
         de que el lead hubiera confirmado nada. -->
    <button
      type="button"
      class="demo-formulario__enviar"
      :disabled="enviando"
      @click="enviar()"
    >
      {{ enviando ? 'Guardando…' : 'Confirmar' }}
    </button>
  </section>
</template>

<script>
/* Las nueve preguntas, sus opciones y sus defaults viven en un módulo aparte: los necesita también
   la tarjeta del modal del lead (`components/lead/DemoFormRespuestas.vue`), donde Lucas revisa y
   corrige estas mismas respuestas. Ver el docblock de `preguntas-formulario.js`. */
import { PREGUNTAS, DEFAULTS } from './preguntas-formulario'

/* Tolerancia para decidir "ya estoy adentro del formulario": mismo criterio y mismo valor que
   FondoSeccionSticky.vue y avance-guiado.js (Chrome redondea el offset de scroll a píxeles de
   dispositivo). Ver el comentario largo de mounted() más abajo. */
const TOLERANCIA_SNAP_PX = 2

/**
 * Formulario de configuración de la demo (Grupo 300 · pagina-inmersiva-demo,
 * prompt 05). Nueve preguntas, todas preseleccionadas con lo que trae el
 * payload del GET -- el lead confirma, no completa
 * (contexto/demo_catalogo.md §2, marca/identidad.md).
 *
 * El envío real (POST /demo-experiencia/{uuid}/formulario) NO lo hace este
 * componente: lo hace el contenedor (ExperienciaDemo.vue) a través de la
 * función `enviar_formulario` inyectada por prop -- mismo patrón que
 * `emitir_evento` en ScrollDolor.vue -- para mantener centralizado en el
 * contenedor todo el conocimiento del uuid y del cliente HTTP público. Este
 * componente solo arma el body y maneja su propio estado de UI (enviando,
 * error).
 */
export default {
  name: 'FormularioConfiguracion',

  props: {
    /**
     * Respuestas actuales del lead, tal como llegan en `formulario` del
     * payload (las nueve claves + `completado`). Todo viene preseleccionado.
     * Si el lead ya había completado el formulario antes, igual se muestra
     * con sus respuestas cargadas y puede cambiarlas (no se esconde ni se
     * bloquea).
     */
    respuestas: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /**
     * Función inyectada por el contenedor que hace el POST real y actualiza
     * el estado global de la página. Firma:
     * enviar_formulario(respuestas: object) -> Promise. Se resuelve con el
     * payload refrescado; se rechaza si el request falla (red o 4xx/5xx).
     */
    enviar_formulario: {
      type: Function,
      default: function () {
        return Promise.resolve({})
      },
    },
  },

  data() {
    return {
      /**
       * Copia local editable de las nueve respuestas (booleanos JS nativos
       * para las ocho preguntas sí/no, string para tipo_precios). Se
       * reconstruye desde el prop `respuestas` al montar y cada vez que ese
       * prop cambia (ej. después de un envío exitoso, que refresca el
       * payload completo en el contenedor).
       */
      local_respuestas: this.construir_respuestas_iniciales(),
      /** true mientras el POST está en vuelo: deshabilita todos los controles. */
      enviando: false,
      /** Mensaje sobrio de error si el último envío falló; vacío si no hay error. */
      error: '',
      /**
       * true durante el primer render (grupo 355, prompt 09): el indicador del
       * control segmentado tiene que aparecer YA del lado que corresponde, sin
       * deslizarse desde la izquierda. Una transición al montar se lee como si el
       * sistema hubiera elegido solo delante del lead, y las nueve preguntas llegan
       * preseleccionadas. Se apaga en el primer nextTick, cuando el navegador ya
       * pintó la posición inicial.
       */
      sin_transicion: true,
      /**
       * El ancestro con scroll real (Element) o `window`, mientras este
       * componente está montado -- se guarda para poder desuscribirse en
       * beforeUnmount. Mismo criterio que ExperienciaDemo.vue/FondoSeccionSticky.vue.
       */
      scroll_target: null,
    }
  },

  mounted() {
    const self = this
    this.$nextTick(function () {
      self.sin_transicion = false
    })

    /**
     * Suspende el scroll-snap mandatory del recorrido mientras el lead está
     * DENTRO del formulario (31/8/2026, reporte de Lucas: en iPhone, Chrome
     * devolvía el scroll al título justo antes de llegar al botón de enviar,
     * y ningún lead podía completar el formulario desde ese navegador).
     *
     * `.demo-formulario` mide bastante más que una pantalla (nueve preguntas +
     * botón) y es el ÚLTIMO punto de enganche del recorrido -- el controlador
     * de avance-guiado.js ya suelta el gesto correctamente cerca del final
     * (hay_contenido_sin_ver + hay_a_donde_ir), pero eso solo apaga la
     * INTERCEPCIÓN por JS. `scroll-snap-type: y mandatory` sigue vivo en el
     * CSS por debajo, sin pasar por ningún JS, y con un solo punto de enganche
     * en todo el tramo (el título del formulario) algunos navegadores -- medido
     * por Lucas en Chrome de iPhone, no en Safari -- reenganchan ahí apenas el
     * gesto nativo termina, justo cuando el borde inferior del formulario
     * entra en pantalla. Es la misma familia de bug que ya tiene su arreglo
     * para el interludio (FondoSeccionSticky.revisar_snap_libre/
     * alternar_snap_libre, sobre la misma clase compartida
     * demo-scroll-guiado--libre, ya leída por avance-guiado.js vía
     * scroll_libre()) -- acá se replica con una sola condición porque no hay
     * nada después del formulario a lo que reengancharse.
     */
    this.scroll_target = this.encontrar_ancestro_scroll()
    this.scroll_target.addEventListener('scroll', this.revisar_snap_libre, { passive: true })
    this.revisar_snap_libre()
  },

  beforeUnmount() {
    if (this.scroll_target) {
      this.scroll_target.removeEventListener('scroll', this.revisar_snap_libre)
    }
    /* El formulario puede desmontarse con el snap todavía suspendido (el lead
       confirmó estando adentro): si esta clase quedara puesta, el resto del
       recorrido -- o el próximo lead que reabra la página -- se quedaría sin
       encuadre. */
    this.alternar_snap_libre(false)
  },

  computed: {
    /**
     * Lista de preguntas a renderizar, en el orden fijo de demo_pagina.md §3.
     *
     * @returns {Array<object>}
     */
    preguntas() {
      return PREGUNTAS
    },
  },

  watch: {
    /**
     * Si el contenedor refresca `respuestas` (tras un envío exitoso, o si el
     * lead reabre la página con el formulario ya completado), se reconstruye
     * la copia local para reflejar el estado real del servidor.
     */
    respuestas: {
      deep: true,
      handler: function () {
        this.local_respuestas = this.construir_respuestas_iniciales()
      },
    },
  },

  methods: {
    /**
     * Arma la copia local de las nueve respuestas a partir del prop
     * `respuestas`, cayendo a DEFAULTS solo si alguna clave no llegara. No
     * hace NINGUNA conversión de tipo: el valor se toma tal cual llega
     * (booleano o string), para que la comparación de preselección
     * (`=== opcion.valor`) funcione sin normalizar nada -- si hiciera falta
     * normalizar para que preseleccione, el tipo de dato estaría mal
     * elegido (ver 1-bis del prompt).
     *
     * @returns {object} Las nueve respuestas.
     */
    construir_respuestas_iniciales: function () {
      const self = this
      const base = {}
      PREGUNTAS.forEach(function (pregunta) {
        const clave = pregunta.clave
        const tiene_valor = self.respuestas && Object.prototype.hasOwnProperty.call(self.respuestas, clave)
        base[clave] = tiene_valor ? self.respuestas[clave] : DEFAULTS[clave]
      })
      return base
    },

    /**
     * Posición del indicador deslizante de una pregunta (grupo 355, prompt 09).
     * El ancho es siempre la mitad del control -- dos opciones -- así que basta con
     * correrlo un 100% de sí mismo para la segunda. Si la respuesta guardada no
     * coincide con ninguna opción, el indicador se oculta en vez de quedar
     * apuntando a la primera: mejor sin posición marcada que marcando la
     * equivocada.
     *
     * @param {object} pregunta Una entrada de PREGUNTAS.
     * @returns {object} Estilo inline para el indicador.
     */
    estilo_indicador: function (pregunta) {
      const elegido = this.local_respuestas[pregunta.clave]
      let indice = -1
      pregunta.opciones.forEach(function (opcion, i) {
        if (opcion.valor === elegido) {
          indice = i
        }
      })

      if (indice < 0) {
        return { opacity: '0' }
      }

      return { transform: 'translateX(' + indice * 100 + '%)' }
    },

    /**
     * Marca la opción elegida para una pregunta. `valor` llega tal cual la
     * opción lo define (booleano nativo para las ocho sí/no, string para
     * tipo_precios) -- nunca se traduce a otro tipo acá ni en ningún otro
     * punto del componente.
     *
     * @param {string} clave Clave de la pregunta (ej. "usa_ecommerce").
     * @param {boolean|string} valor Valor de la opción elegida.
     * @returns {void}
     */
    seleccionar: function (clave, valor) {
      if (this.enviando) {
        return
      }
      this.local_respuestas[clave] = valor
    },

    /**
     * Envía las nueve respuestas actuales al contenedor (que hace el POST
     * real). Deshabilita los controles mientras está en vuelo; si falla,
     * muestra un mensaje sobrio y deja las respuestas tal como estaban para
     * que el lead pueda reintentar sin perder lo que marcó.
     *
     * @returns {void}
     */
    enviar: function () {
      const self = this

      self.enviando = true
      self.error = ''

      self
        .enviar_formulario(self.local_respuestas)
        .catch(function () {
          self.error = 'No pudimos guardar tus respuestas. Probá de nuevo en un momento.'
        })
        .then(function () {
          self.enviando = false
        })
    },

    /**
     * Sube por los ancestros hasta el contenedor que realmente scrollea. Mismo
     * criterio que ExperienciaDemo.vue/FondoSeccionSticky.vue: en este admin es
     * <main class="app-main-scroll">, pero no se hardcodea ese selector.
     *
     * @returns {Window|Element}
     */
    encontrar_ancestro_scroll: function () {
      let nodo = this.$el ? this.$el.parentElement : null
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
     * Suspende (o repone) el scroll-snap del scroller según si el lead ya
     * entró al formulario. Ver el comentario largo de mounted().
     *
     * @returns {void}
     */
    revisar_snap_libre: function () {
      if (!this.$el || typeof this.$el.getBoundingClientRect !== 'function') {
        return
      }
      const rect = this.$el.getBoundingClientRect()
      this.alternar_snap_libre(rect.top <= TOLERANCIA_SNAP_PX)
    },

    /**
     * Prende o apaga la clase que suspende el snap en el scroller compartido.
     *
     * @param {boolean} libre
     * @returns {void}
     */
    alternar_snap_libre: function (libre) {
      if (!this.scroll_target || !this.scroll_target.classList) {
        return
      }
      this.scroll_target.classList.toggle('demo-scroll-guiado--libre', !!libre)
    },
  },
}
</script>

<style scoped>
.demo-formulario {
  max-width: 640px;
  margin: 0 auto;
  /* padding-top generoso (grupo 348, prompt 05): el encabezado del formulario no
     tiene que entrar en cuadro junto con el final del puente, que ahora ocupa su
     propia pantalla (ver .demo-scroll-dolor__puente). max() y no un 12vh a secas:
     en una pantalla baja -- un portátil de 768px de alto, o un teléfono apaisado --
     el 12vh se achica justo donde más falta hace, así que el mínimo en píxeles es
     el que manda ahí. */
  padding: max(12vh, 96px) 20px 48px;
  display: flex;
  flex-direction: column;
  /* Más aire ENTRE preguntas (grupo 322, prompt 02; subido de 44 a 64 en el grupo
     355, prompt 09, a pedido de Lucas) -- el gap de 12px interno de
     .demo-formulario__pregunta (texto+descripción+opciones) no se toca. */
  gap: 64px;
}

.demo-formulario__encabezado {
  text-align: center;
}

.demo-formulario__titulo {
  font-size: clamp(1.6rem, 3.4vw, 2.2rem);
  font-weight: 700;
  margin: 0 0 8px;
}

.demo-formulario__subtitulo {
  color: var(--demo-color-texto-suave);
  font-size: 1.05rem;
  margin: 0;
}

.demo-formulario__pregunta {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.demo-formulario__pregunta-texto {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

/* Texto secundario opcional debajo de la pregunta (grupo 322, prompt 02): más
   chico y suave, no compite con la pregunta. */
.demo-formulario__pregunta-descripcion {
  font-size: 0.9rem;
  color: var(--demo-color-texto-suave);
  margin: -6px 0 0;
  line-height: 1.4;
}

/* Control segmentado (grupo 355, prompt 09): UNA pista con dos posiciones, en vez de
   los dos botones sueltos separados por un gap que había hasta acá -- "que se note
   que ambas opciones son un interruptor: puede estar una activada o la otra", Lucas,
   5/8/2026. Grande igual que antes: la mayoría entra desde el teléfono
   (contexto/demo_experiencia.md §3.16 B).

   La pista es la que lleva el fondo apagado y el borde; las mitades quedan
   transparentes por encima del indicador. Sin flex-wrap: si las dos mitades se
   apilaran, el indicador --que mide la mitad del ANCHO-- quedaría a mitad de camino
   entre las dos y el control dejaría de leerse. Con el ancho completo del formulario
   y dos etiquetas cortas, entran siempre. */
.demo-formulario__opciones {
  position: relative;
  display: flex;
  border-radius: 14px;
  border: 2px solid rgba(28, 35, 51, 0.08);
  background: #fff;
  overflow: hidden;
}

/* El indicador: mitad del ancho, con el mismo degradé de marca que tenía la opción
   activa. Se DESPLAZA (transform) en vez de aparecer del otro lado -- ese movimiento
   es lo que comunica que es un interruptor y no dos botones. */
.demo-formulario__indicador {
  position: absolute;
  top: 0;
  left: 0;
  width: 50%;
  height: 100%;
  border-radius: 12px;
  background: var(--demo-gradient-marca);
  box-shadow: 0 6px 16px -8px rgba(11, 132, 248, 0.55);
  transition: transform 0.2s ease, opacity 0.2s ease;
  pointer-events: none;
}

/* Primer render: el indicador ya arranca del lado correcto, sin deslizarse desde la
   izquierda (ver `sin_transicion` en el componente). */
.demo-formulario__opciones--sin-transicion .demo-formulario__indicador {
  transition: none;
}

.demo-formulario__opciones--deshabilitado {
  opacity: 0.6;
}

.demo-formulario__opcion {
  position: relative;
  z-index: 1;
  flex: 1 1 50%;
  min-width: 0;
  min-height: 56px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--demo-color-texto-suave);
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease;
}

.demo-formulario__opcion:disabled {
  cursor: not-allowed;
}

.demo-formulario__opcion--activa {
  color: #fff;
}

/* Foco visible por teclado y solo por teclado: el control se opera con Tab y flechas
   y el usuario tiene que ver dónde está parado. Va por dentro (inset) porque la pista
   recorta con overflow: hidden. */
.demo-formulario__opcion:focus-visible {
  outline: 2px solid var(--demo-color-azul);
  outline-offset: -4px;
  border-radius: 12px;
}

.demo-formulario__error {
  color: #b3261e;
  font-size: 0.95rem;
  text-align: center;
  margin: 0;
}

.demo-formulario__enviar {
  min-height: 56px;
  padding: 14px 24px;
  border-radius: 14px;
  border: none;
  background: var(--demo-gradient-marca);
  color: #fff;
  font-family: inherit;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
}

.demo-formulario__enviar:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

/* En teléfono el aire de arriba va a la mitad (grupo 348, prompt 05): el lead no
   tiene que scrollear dos pantallas para llegar a la primera pregunta. 767.98px es el
   breakpoint que ya usa el resto de la página (ScrollDolor.vue y el scss compartido),
   no uno nuevo. */
@media (max-width: 767.98px) {
  .demo-formulario {
    padding-top: max(6vh, 48px);
  }
}

/* RETIRADO (grupo 355, prompt 09): en pantallas angostas las dos opciones pasaban a
   columna. Con el control segmentado eso no puede ser: el indicador mide la mitad del
   ANCHO, así que apiladas quedaría cruzado entre las dos y el control dejaría de
   leerse. Las dos etiquetas entran horizontales incluso a 375px -- la más larga,
   "Varias listas", mide bastante menos que la mitad disponible. */
</style>
