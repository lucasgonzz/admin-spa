<template>
  <!-- Escena hero (grupo 369, prompt 05). Markup transcrito de
       marca/animacion-hero/escena.html del repo de conocimiento, con las clases
       prefijadas `hero-escena__` para no colisionar con nada del admin (el export usaba
       nombres genéricos como .stage, .side, .core, .field). El copy NO se toca acá:
       vive en contexto/demo_pagina.md desde este prompt, y de ahí se transcribe. -->
  <div ref="raiz" class="hero-escena" :data-eje="eje">
    <div class="hero-escena__haze" aria-hidden="true"></div>
    <div class="hero-escena__grid-bg" aria-hidden="true"></div>

    <!-- ===== IZQUIERDA: el caos ===== -->
    <section class="hero-escena__side hero-escena__side--left">
      <div class="hero-escena__side-head">
        <span class="hero-escena__eyebrow">Hoy</span>
        <span class="hero-escena__side-title">Un comercio desorganizado</span>
      </div>

      <div class="hero-escena__field">
        <p class="hero-escena__resolve">
          De la cabeza del dueño a un <b>sistema que lo ordena todo</b>.
        </p>
        <div
          v-for="(columna, indice_col) in problemas"
          :key="indice_col"
          class="hero-escena__chaos-col"
          :class="{ 'hero-escena__chaos-col--b': indice_col === 1 }"
        >
          <article
            v-for="tarjeta in columna"
            :key="tarjeta.titulo"
            class="hero-escena__p-card"
            :data-rot="tarjeta.rot"
            :data-beat="tarjeta.beat"
          >
            <span class="hero-escena__tag">{{ tarjeta.tag }}</span>
            <h3>{{ tarjeta.titulo }}</h3>
            <p v-if="tarjeta.detalle">{{ tarjeta.detalle }}</p>
          </article>
        </div>
      </div>

      <div class="hero-escena__person-row hero-escena__person-lift">
        <svg
          class="hero-escena__person"
          viewBox="0 0 200 200"
          role="img"
          aria-label="Comerciante agarrándose la cabeza"
        >
          <g fill="none" stroke="#E3BE9B" stroke-width="13" stroke-linecap="round">
            <path d="M74 138 C 46 128 42 88 64 70"></path>
            <path d="M126 138 C 154 128 158 88 136 70"></path>
          </g>
          <path d="M62 200 v-40 a38 38 0 0 1 76 0 v40 z" fill="#AEB8C7"></path>
          <circle cx="100" cy="90" r="37" fill="#EBC6A3"></circle>
          <g fill="#5A4A3C">
            <rect x="72" y="46" width="9" height="22" rx="4" transform="rotate(-24 76 57)"></rect>
            <rect x="95" y="40" width="9" height="24" rx="4" transform="rotate(-4 99 52)"></rect>
            <rect x="117" y="46" width="9" height="22" rx="4" transform="rotate(20 121 57)"></rect>
          </g>
          <circle cx="64" cy="70" r="12" fill="#EBC6A3"></circle>
          <circle cx="136" cy="70" r="12" fill="#EBC6A3"></circle>
          <g stroke="#4A3A2E" stroke-width="4.5" stroke-linecap="round">
            <path d="M80 84 l12 8 M92 84 l-12 8"></path>
            <path d="M108 84 l12 8 M120 84 l-12 8"></path>
            <path d="M86 112 q14 -11 28 0" fill="none"></path>
          </g>
          <g stroke="#FA7E06" stroke-width="5" stroke-linecap="round" opacity=".9">
            <path d="M34 54 l-9 -9"></path>
            <path d="M166 54 l9 -9"></path>
            <path d="M28 84 l-12 -3"></path>
            <path d="M172 84 l12 -3"></path>
          </g>
        </svg>
        <p class="hero-escena__person-note">
          Todo pasa por la cabeza del dueño. Nada queda registrado en un solo lugar.
        </p>
      </div>
    </section>

    <!-- ===== CENTRO: la máquina ===== -->
    <div class="hero-escena__core">
      <div class="hero-escena__core-anchor">
        <div class="hero-escena__core-glow" aria-hidden="true"></div>
        <!-- El <img> se monta siempre; si la máquina no se puede reproducir (404, el
             navegador no decodifica WebP animado) el @error la retira y en su lugar se ve
             el isotipo estático de abajo (ver `sin_maquina`). -->
        <img
          v-if="!sin_maquina"
          ref="maquina_img"
          class="hero-escena__maquina"
          alt=""
          aria-hidden="true"
          @error="sin_maquina = true"
        />
        <img
          v-else
          src="../../assets/isotipo-comerciocity.svg"
          alt=""
          aria-hidden="true"
          class="hero-escena__isotipo-respaldo"
        />
      </div>
      <!-- Banda donde aterriza el comerciante tranquilo al asentarse (grupo de la
           animación corregida, 31/8/2026): vacía en reposo, la ocupa
           escena-coreografia.js por DOM cuando el progreso pasa el 80%. Ausente del
           flujo (height:0 en el <style>) para no correr nada mientras está vacía. -->
      <div class="hero-escena__core-slot"></div>
      <div class="hero-escena__brand">
        <img src="../../assets/isotipo-comerciocity.svg" alt="ComercioCity" />
        <span class="hero-escena__name">Comercio<em>City</em></span>
      </div>
      <p class="hero-escena__core-sub">Plataforma de gestión</p>
    </div>

    <!-- ===== DERECHA: el orden ===== -->
    <section class="hero-escena__side hero-escena__side--right">
      <div class="hero-escena__side-head">
        <span class="hero-escena__eyebrow">Con ComercioCity</span>
        <span class="hero-escena__side-title">Un comercio que se maneja solo</span>
      </div>

      <div class="hero-escena__s-grid">
        <article v-for="tarjeta in soluciones" :key="tarjeta.titulo" class="hero-escena__s-card">
          <span class="hero-escena__tag">{{ tarjeta.tag }}</span>
          <h3>{{ tarjeta.titulo }}</h3>
          <p v-if="tarjeta.detalle">{{ tarjeta.detalle }}</p>
        </article>
      </div>

      <!-- .hero-escena__person-settle marca este bloque como el que
           escena-coreografia.js reubica junto a la máquina al final del recorrido
           (progreso 80%-90%). Apagado en teléfono -- ver el punto 5 del docblock de
           cabecera de ese módulo. -->
      <div class="hero-escena__person-row hero-escena__person-settle">
        <svg
          class="hero-escena__person"
          viewBox="0 0 200 200"
          role="img"
          aria-label="Comerciante tranquilo"
        >
          <path d="M62 200 v-44 a38 38 0 0 1 76 0 v44 z" fill="#1B6FF5"></path>
          <g fill="none" stroke="#EBC6A3" stroke-width="13" stroke-linecap="round">
            <path d="M72 148 C 60 166 58 178 60 190"></path>
            <path d="M128 148 C 140 166 142 178 140 190"></path>
          </g>
          <circle cx="100" cy="92" r="37" fill="#EBC6A3"></circle>
          <path d="M64 74 a36 36 0 0 1 72 0 z" fill="#5A4A3C"></path>
          <g fill="#4A3A2E">
            <circle cx="86" cy="90" r="4.2"></circle>
            <circle cx="114" cy="90" r="4.2"></circle>
          </g>
          <path
            d="M86 108 q14 11 28 0"
            fill="none"
            stroke="#4A3A2E"
            stroke-width="4.5"
            stroke-linecap="round"
          ></path>
          <rect x="86" y="156" width="28" height="20" rx="3" fill="#FFFFFF" opacity=".85"></rect>
        </svg>
        <p class="hero-escena__person-note">
          Toda la operación en un solo sistema. El dueño dirige, no apaga incendios.
        </p>
      </div>
    </section>

    <!-- Riel de progreso. Del footer del export queda sólo esto: el enlace "ver versión
         vertical" apuntaba a otro archivo HTML del export y no existe acá, y la leyenda
         "Scrolleá ↓" la reemplaza el botón de avance de la página (grupo 369, prompt 03),
         que además hace algo al pulsarlo. -->
    <div class="hero-escena__footer" aria-hidden="true">
      <div class="hero-escena__rail"></div>
    </div>
  </div>
</template>

<script>
import { crear_coreografia } from './escena-coreografia'
import { precargar_maquina, crear_reproductor, soltar_maquina } from './maquina-animacion'

/**
 * Copy de las trece tarjetas, transcrito de contexto/demo_pagina.md (sección del
 * interludio, agregada por este prompt) -- que a su vez lo tomó del export de Lucas. No
 * parafrasear ni ajustar acá: cualquier cambio de texto se hace en ese archivo, igual que
 * con el resto del copy de la página (mismo criterio que CONTENIDO_POR_PERFIL en
 * ScrollDolor.vue).
 *
 * `rot` y `beat` son datos de la coreografía, no del copy: la inclinación de cada tarjeta
 * y el orden en que entran. Vienen del export.
 */
const PROBLEMAS = [
  [
    { tag: 'Pedidos', titulo: 'Pedidos por WhatsApp', detalle: null, rot: -3.5, beat: 0 },
    { tag: 'Stock', titulo: 'Stock sin organizar', detalle: null, rot: -2, beat: 1 },
    {
      tag: 'Actualizar',
      titulo: 'Precios que cambian constantemente',
      detalle: 'Hay que hacerlo manualmente, uno por uno.',
      rot: -4,
      beat: 2,
    },
    {
      tag: 'Fotos',
      titulo: 'Cargar imágenes artículo por artículo',
      detalle: 'Buscándolas en internet o tomando las fotos con el celular.',
      rot: -1.6,
      beat: 4,
    },
  ],
  [
    { tag: 'Ventas', titulo: 'Ventas en papel', detalle: null, rot: 2.8, beat: 0 },
    { tag: 'Precios', titulo: 'Precios por todos lados', detalle: null, rot: 3.4, beat: 1 },
    {
      tag: 'Cuentas',
      titulo: 'Deudas de clientes y proveedores desorganizadas',
      detalle: 'Sin saber a qué comprobante corresponde cada saldo y cada pago.',
      rot: 2.2,
      beat: 3,
    },
  ],
]

const SOLUCIONES = [
  /* Los tres detalles de acá abajo se agregaron el 31/8/2026, transcritos literales del
     export corregido de Claude Design (contexto/demo_pagina.md §6) -- SIN corregir los
     acentos que faltan ("tenes", "informacion"): decisión explícita de Lucas, consultado,
     de dejarlos tal cual vinieron en vez de normalizarlos contra el resto de la tarjeta. */
  { tag: 'Venta', titulo: 'Tienda online', detalle: '100% automatizada, no tenes que mantener nada' },
  {
    tag: 'Atención',
    titulo: 'WhatsApp atendido con IA',
    detalle: 'Agente humanizado con informacion 100% actualizada, sin que tengas que mantener nada',
  },
  { tag: 'Admin', titulo: 'Ventas y facturación automatizadas', detalle: 'Ventas en negro y en blanco con un click' },
  {
    tag: 'Cuentas',
    titulo: 'Cuenta corriente organizada',
    detalle: 'Para cada cliente y cada proveedor, multimoneda.',
  },
  {
    tag: 'Catálogo',
    titulo: 'Imágenes automáticas con un click',
    detalle: 'El sistema las busca y las chequea con IA, para cientos de artículos.',
  },
  {
    tag: 'Precios',
    titulo: 'Actualización masiva por Excel',
    detalle: 'Miles de artículos actualizados de una sola vez.',
  },
]

/**
 * La escena central de la página inmersiva de demo (grupo 369, prompt 05): tres zonas
 * -- el caos a la izquierda, la máquina 3D al centro, el orden a la derecha -- movidas
 * por un único progreso [0,1].
 *
 * Reemplaza a la escena anterior -- el portal de arcos SVG que vivía en un componente
 * propio desde el grupo 325 y que el prompt 06 de este grupo borró. Lucas la rehízo desde
 * cero el 5/8/2026 y la exportó como HTML autocontenido; el export desempaquetado está
 * en `marca/animacion-hero/` del repo de conocimiento, con un README que explica qué NO
 * se copia tal cual.
 *
 * 🔴 LA MÁQUINA YA NO SE RENDERIZA EN VIVO (misión 12, piezas 1 y 2). Era una escena
 * de three.js que llegaba por un `import()` dinámico, y andaba lenta en la máquina de
 * Lucas; `three` se borró del proyecto entero. Primero pasó a ser una secuencia de
 * cuadros WebP dibujados en un canvas 2D, y desde la animación corregida del 31/8/2026
 * es un ÚNICO WebP animado con alfa en un `<img>` (`maquina-animacion.js`): el loop se
 * cerró a 24,75s (antes 12s), y a esa duración la tira de cuadros sueltos ya no entraba
 * en presupuesto sin bajar a un frame rate visible -- el WebP animado tiene compresión
 * entre cuadros y el mismo loop entero pesa unos pocos MB. El costo es la pausa exacta
 * del loop cuando la escena sale de pantalla: un `<img>` no tiene `pause()`. Ver el
 * docblock de cabecera de `maquina-animacion.js` para el resto del porqué.
 *
 * Por eso el import de la máquina es ESTÁTICO: el motivo de un dinámico habría sido no
 * arrastrar three al bundle inicial de una página pública que la mayoría de los leads
 * abre desde el teléfono, y acá no hay three. El módulo son unos pocos KB y lo pesado --
 * el WebP -- no está en el bundle: se pide por red cuando el lead entra al primer bloque
 * de dolor, cuatro pantallas antes de llegar acá.
 */
export default {
  name: 'EscenaHero',

  props: {
    /**
     * Progreso [0,1] de la escena. En este prompt lo pasa fijo el consumidor; el prompt
     * 06 lo ata al progreso de la sección.
     */
    progreso: {
      type: Number,
      default: 0,
    },
    /**
     * true si el que pasa el progreso YA lo amortiguó (FondoSeccionSticky lo hace).
     * Evita amortiguar dos veces, que se siente como retardo y no como suavidad.
     */
    progreso_amortiguado: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      /** Copy de las tarjetas, ver PROBLEMAS y SOLUCIONES arriba. */
      problemas: PROBLEMAS,
      soluciones: SOLUCIONES,
      /**
       * true si la máquina no se puede reproducir (el WebP no cargó, o el navegador no
       * tiene con qué decodificarlo), o si el sistema pide reduced-motion.
       * En los dos casos la escena muestra el isotipo estático en el centro y las
       * tarjetas quedan legibles: es una página pública, un hueco negro o un error en
       * consola no son opciones.
       */
      sin_maquina: false,
      /** Lo que devuelve crear_reproductor(), o null. */
      maquina: null,
      /** Lo que devuelve crear_coreografia(), o null. */
      coreografia: null,
      /** true cuando el componente se destruyó: el import dinámico puede resolver después. */
      desmontado: false,
      /** 'h' horizontal (desktop) | 'v' vertical (teléfono). */
      eje: 'h',
      /** true si el sistema pide reduced-motion. */
      reduced_motion: false,
      /** El IntersectionObserver que espera a que la sección se acerque, o null. */
      observador: null,
      /**
       * El IntersectionObserver PERMANENTE que pausa y reanuda los dos bucles según si
       * la escena está en pantalla (grupo 370, correctivo 8, prompt 04, criterio b). Es
       * uno distinto de `observador`: ese es de un solo uso (arranca la carga del chunk
       * y se desconecta), este vigila todo el tiempo que el componente vive.
       */
      observador_visibilidad: null,
      /**
       * true si la escena está dentro del viewport (según `observador_visibilidad`).
       * Arranca en true a propósito: hasta que el observer entregue su primera medición
       * no hay que pausar nada, y si el navegador no tiene IntersectionObserver esto se
       * queda en true para siempre -- se prefiere gastar batería de más a romper la
       * escena en un navegador viejo.
       */
      en_viewport: true,
    }
  },

  watch: {
    /**
     * @param {number} valor
     * @returns {void}
     */
    progreso(valor) {
      this.aplicar_progreso(valor)
    },
  },

  mounted() {
    this.reduced_motion = !!(
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    this.eje = window.innerWidth <= 767.98 ? 'v' : 'h'

    if (this.reduced_motion) {
      /* Ni canvas ni bucle: estado estático. El CSS de este archivo deja las trece
         tarjetas visibles y legibles bajo esta preferencia, así que la escena sigue
         contando lo mismo sin moverse. */
      this.sin_maquina = true
      return
    }

    /* El eje depende del ancho, así que una rotación de teléfono lo cambia y hay que
       recalcular: la grilla pasa de tres columnas a una y los viajes de cada tarjeta
       hasta el centro de la máquina son otros (grupo 369, prompt 06, criterio 4). La
       coreografía tiene además su propio listener de resize para las medidas; este es
       sólo para el eje. */
    window.addEventListener('resize', this.revisar_eje, { passive: true })

    /* Pestaña en segundo plano (grupo 370, correctivo 8, prompt 04, criterio b): se
       escucha acá y no adentro de cada bucle porque es UNA sola señal para los dos.
       `document.visibilitychange` existe en cualquier navegador con soporte de la Page
       Visibility API; donde no exista, `document.hidden` es siempre `undefined` (falsy)
       y `revisar_pausa()` nunca pausa por este motivo, que es el comportamiento de antes
       de este prompt. */
    document.addEventListener('visibilitychange', this.revisar_pausa)

    this.arrancar_cuando_se_acerque()
  },

  beforeUnmount() {
    this.desmontado = true
    window.removeEventListener('resize', this.revisar_eje)
    document.removeEventListener('visibilitychange', this.revisar_pausa)
    if (this.observador) {
      this.observador.disconnect()
      this.observador = null
    }
    if (this.observador_visibilidad) {
      this.observador_visibilidad.disconnect()
      this.observador_visibilidad = null
    }
    this.apagar()
  },

  methods: {
    /**
     * Monta la máquina recién cuando la sección se acerca, no al montar el componente.
     *
     * 🔴 Lo que se está difiriendo cambió de naturaleza dos veces (misión 12, pieza 1;
     * animación corregida, 31/8/2026) pero el motivo es el mismo. Primero era un chunk
     * de 538 kB con three adentro; después una tira de imágenes de ~1,3 MB; hoy un único
     * WebP animado de un par de MB. Esta es una página pública que la mayoría de los
     * leads abre desde el teléfono, y este componente vive dentro del slot de una
     * sección que se renderiza siempre: pedir eso en el `mounted()` sería pedirlo junto
     * con la primera pantalla.
     *
     * La diferencia con antes es que ahora la descarga arranca ANTES de este punto, no
     * acá: la dispara ScrollDolor cuando el lead entra al primer bloque de dolor, con
     * cuatro pantallas por delante. `precargar_maquina()` es idempotente, así que esta
     * llamada normalmente se engancha a esa descarga en curso en vez de empezar otra.
     * Sigue haciendo falta igual para el lead que llega con la escena ya a la vista.
     *
     * Si no hay IntersectionObserver, se arranca de una: es preferible el comportamiento
     * de antes a no tener escena.
     *
     * @returns {void}
     */
    arrancar_cuando_se_acerque() {
      if (typeof window === 'undefined' || !window.IntersectionObserver || !this.$refs.raiz) {
        this.arrancar()
        return
      }
      const self = this
      this.observador = new window.IntersectionObserver(
        function (entradas) {
          if (!entradas.length || !entradas[0].isIntersecting) {
            return
          }
          if (self.observador) {
            self.observador.disconnect()
            self.observador = null
          }
          self.arrancar()
        },
        { rootMargin: '100% 0px' }
      )
      this.observador.observe(this.$refs.raiz)
    },

    /**
     * Espera a que el WebP de la máquina esté decodificado, monta el reproductor y
     * arranca la coreografía.
     *
     * `precargar_maquina()` nunca rechaza -- devuelve null si no pudo -- así que el
     * `.catch()` es sólo la red de seguridad de un error inesperado. Se resuelve con
     * `.then()`/`.catch()` y no con async/await por la regla del workspace.
     *
     * @returns {void}
     */
    arrancar() {
      const self = this
      precargar_maquina()
        .then(function (datos) {
          if (self.desmontado || !self.$refs.maquina_img) {
            return
          }
          self.maquina = crear_reproductor(self.$refs.maquina_img, datos)
          if (!self.maquina) {
            /* Sin máquina que mostrar: el <img> se retira y queda el isotipo
               estático. */
            self.sin_maquina = true
          }
          self.arrancar_coreografia()
        })
        .catch(function () {
          if (self.desmontado) {
            return
          }
          self.sin_maquina = true
          /* La coreografía de las tarjetas no depende de la máquina: se arranca igual,
             así que la escena sigue teniendo su movimiento aunque el WebP no cargue. */
          self.arrancar_coreografia()
        })
    },

    /**
     * @returns {void}
     */
    arrancar_coreografia() {
      const self = this
      /* En nextTick: si sin_maquina acaba de cambiar, el <img> se retiró del DOM y las
         medidas de la coreografía tienen que tomarse sobre el layout ya actualizado. */
      this.$nextTick(function () {
        if (self.desmontado || !self.$refs.raiz || self.coreografia) {
          return
        }
        /* La coreografía es JS propio de unos pocos KB, igual que el reproductor de la
           máquina: desde la misión 12 no queda nada pesado en el bundle de esta escena. */
        self.coreografia = crear_coreografia(self.$refs.raiz, self.maquina, self.eje)
        self.aplicar_progreso(self.progreso)
        self.arrancar_observador_visibilidad()
      })
    },

    /**
     * Prende el vigía permanente de viewport (grupo 370, correctivo 8, prompt 04,
     * criterio b). Se arranca acá (no en `mounted()`) porque recién acá existen
     * `coreografia` y (si el WebP cargó) `maquina`, que son a quienes hay que pausar.
     *
     * Mismo margen generoso que `arrancar_cuando_se_acerque()` (una pantalla entera):
     * así los bucles ya están corriendo de nuevo antes de que la escena vuelva a
     * quedar realmente a la vista, y el lead nunca ve el primer cuadro "arrancando".
     *
     * @returns {void}
     */
    arrancar_observador_visibilidad() {
      if (typeof window === 'undefined' || !window.IntersectionObserver || !this.$refs.raiz) {
        /* Sin IntersectionObserver no hay señal de viewport: `en_viewport` se queda en
           su default (true) y los bucles corren siempre, que es el comportamiento de
           antes de este prompt -- preferible a pausar mal en un navegador que no puede
           avisar cuándo hay que reanudar. */
        return
      }
      const self = this
      this.observador_visibilidad = new window.IntersectionObserver(
        function (entradas) {
          self.en_viewport = !!(entradas.length && entradas[0].isIntersecting)
          self.revisar_pausa()
        },
        { rootMargin: '100% 0px' }
      )
      this.observador_visibilidad.observe(this.$refs.raiz)
    },

    /**
     * Pausa o reanuda los dos bucles según las dos señales combinadas: si la escena está
     * en el viewport (`en_viewport`, la mueve `observador_visibilidad`) Y la pestaña
     * está en primer plano (`!document.hidden`, la mueve el listener de
     * `visibilitychange` puesto en `mounted()`). Reanudar sin salto no exige ningún
     * estado especial acá: `coreografia.reanudar()` y `maquina.reanudar()` retoman
     * exactamente donde quedaron (ver el comentario largo de `pausar()` en cada módulo).
     *
     * @returns {void}
     */
    revisar_pausa() {
      const debe_correr = this.en_viewport && !document.hidden
      if (debe_correr) {
        if (this.coreografia) {
          this.coreografia.reanudar()
        }
        if (this.maquina) {
          this.maquina.reanudar()
        }
        return
      }
      if (this.coreografia) {
        this.coreografia.pausar()
      }
      if (this.maquina) {
        this.maquina.pausar()
      }
    },

    /**
     * @returns {void}
     */
    revisar_eje() {
      this.eje = window.innerWidth <= 767.98 ? 'v' : 'h'
      if (this.coreografia) {
        this.coreografia.set_eje(this.eje)
      }
    },

    /**
     * Aplica el progreso. Es PÚBLICO: lo llama el consumidor por `ref` en cada frame de
     * scroll, en vez de pasarlo como prop reactiva -- una prop que cambia 60 veces por
     * segundo hace re-renderizar los ~40 nodos de esta escena para nada, porque el
     * template no depende del progreso (lo que cambia son estilos que la coreografía
     * escribe a mano).
     *
     * @param {number} valor
     * @returns {void}
     */
    aplicar_progreso(valor) {
      if (this.coreografia) {
        this.coreografia.set_progreso(valor, this.progreso_amortiguado)
      }
    },

    /**
     * Apaga todo: el bucle de la coreografía (que además devuelve el comerciante
     * asentado a su lugar de origen si estaba reubicado) y el reproductor de la máquina.
     *
     * Antes lo que había que soltar acá con cuidado eran ~120 MB de `ImageBitmap`
     * crudos (la tira de cuadros) o, más atrás, un contexto WebGL. Un único `<img>` no
     * arrastra ese problema: el navegador libera sus píxeles decodificados solo, como
     * con cualquier otra imagen que sale del DOM. `maquina.destruir()` sigue existiendo
     * para llevar la cuenta de cuántos reproductores comparten la precarga, no porque
     * haga falta liberar memoria a mano.
     *
     * @returns {void}
     */
    apagar() {
      if (this.coreografia) {
        this.coreografia.destruir()
        this.coreografia = null
      }
      if (this.maquina) {
        this.maquina.destruir()
        this.maquina = null
        return
      }

      /* Sin reproductor montado y con la página yéndose: puede haber una precarga en
         vuelo que nadie va a reclamar (el lead entró a los bloques de dolor, la descarga
         arrancó, y se fue antes de llegar hasta acá). `destruir()` no cubre ese caso
         porque nunca hubo qué destruir. */
      soltar_maquina()
    },
  },
}
</script>

<style scoped>
/* Estilos transcritos de marca/animacion-hero/escena.css. Lo que NO se copió, porque era
   del export standalone: `body{overflow:hidden}`, `html{background}`, el `*{box-sizing}`
   global y los estilos de `a`. Lo que se adaptó:

   · TIPOGRAFÍA. El export usaba Manrope y JetBrains Mono. No se importan dos fuentes
     nuevas para una sección: todo pasa a `var(--demo-font-family)`, la de la página. Las
     etiquetas chicas que en el export eran monoespaciadas (eyebrow, tag, core-sub)
     conservan el tracking y las mayúsculas, que es lo que les daba el carácter, y suben
     de peso 500 a 600 -- sin el monoespaciado, a ese tamaño, el 500 se lee lavado.
   · COLOR. Los tres colores de marca del export (#1B6FF5, #3A31FC, #FA7E06) se quedan.
     Donde el export repetía un color que la página ya tiene como token, se usa el token
     (--demo-color-texto, --demo-color-texto-suave).

   Las variables --p, --suck, --out, --power, --calm, --stress y --settled son la interfaz
   entre la coreografía (JS) y estos estilos: las escribe escena-coreografia.js en el
   elemento raíz de este componente. Los valores de acá son los de reposo, para el primer
   frame y para el caso en que la coreografía no arranque. */
.hero-escena {
  --p: 0;
  --suck: 0;
  --out: 0;
  --power: 0;
  --calm: 0;
  --stress: 1;
  --settled: 0;
  --hero-ink: var(--demo-color-texto, #0e1b2e);
  --hero-ink-2: #3c4a5e;
  --hero-ink-dim: var(--demo-color-texto-suave, #76839a);
  --hero-blue: #1b6ff5;
  --hero-indigo: #3a31fc;
  --hero-orange: #fa7e06;
  --hero-line: rgba(14, 27, 46, 0.08);

  position: relative;
  height: 100%;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1.2fr 0.72fr 1.2fr;
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
  /* Subido un escalón (grupo 370, correctivo 8, prompt 03) para acompañar al resto de
     la página, que es más generosa. Hasta este prompt, este padding quedaba pisado en
     cero por FondoSeccionSticky.vue -- no había overflow real, era la cascada -- así
     que nunca se había visto en pantalla; ver el comentario largo de
     FondoSeccionSticky.vue (`.demo-fondo-seccion__contenido--full-bleed > *`) para la
     causa. Arriba y a los costados con el mismo clamp; abajo más, para que el logo y
     "PLATAFORMA DE GESTIÓN" respiren del borde. */
  padding: clamp(28px, 3.6vw, 64px) clamp(28px, 3.6vw, 64px) clamp(64px, 6vw, 88px);
  font-family: var(--demo-font-family);
  color: var(--hero-ink);
}

.hero-escena__haze {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(120% 90% at 6% 0%, #d5e6fb 0%, rgba(213, 230, 251, 0) 58%),
    radial-gradient(110% 90% at 96% 100%, #d8d3fb 0%, rgba(216, 211, 251, 0) 60%),
    linear-gradient(150deg, #f4f8fd 0%, #fbfcfe 46%, #f8f6fe 100%);
}

/* 🔴 SIN `filter: blur()` (grupo 370, correctivo 8, prompt 04, criterio a). `--out` se
   reescribe en CADA CUADRO desde escena-coreografia.js, y cambiar la opacidad de un
   elemento con blur(90px) obligaba al navegador a rehacer el desenfoque de una
   superficie de casi medio viewport sesenta veces por segundo -- el gasto más grande de
   toda la escena, según la lectura del código que motivó este prompt.
   `radial-gradient(closest-side, …, transparent 72%)` ya es una superficie suave por sí
   sola; el blur encima era casi redundante. Lo que el blur SÍ aportaba era una
   transición más gradual entre el color y el transparente final, así que acá se agrega
   una parada intermedia al 42% (mismo criterio que sugiere el prompt: "se ajustan las
   paradas del gradiente, que es gratis") para no perder esa gradualidad.
   🔴 NO se pudo hacer la comparación visual antes/después que pide el criterio 2 del
   prompt: el navegador de este entorno de medición no composita frames (no hay captura
   de pantalla posible), así que este ajuste queda MEDIDO en el sentido de "se sacó lo
   más caro y se compensó con lo que el propio prompt indica que es gratis", pero NO
   verificado con los ojos -- lo dice el reporte de este prompt explícitamente. */
.hero-escena__haze::before,
.hero-escena__haze::after {
  content: "";
  position: absolute;
  top: -10%;
  height: 120%;
  width: 48%;
}

.hero-escena__haze::before {
  left: -8%;
  background: radial-gradient(
    closest-side,
    rgba(250, 126, 6, 0.1) 0%,
    rgba(250, 126, 6, 0.055) 42%,
    transparent 72%
  );
  opacity: calc(1 - var(--out) * 0.8);
}

.hero-escena__haze::after {
  right: -8%;
  background: radial-gradient(
    closest-side,
    rgba(27, 111, 245, 0.16) 0%,
    rgba(27, 111, 245, 0.09) 42%,
    transparent 72%
  );
  opacity: calc(0.05 + var(--out) * 0.95);
}

.hero-escena__grid-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.5;
  background-image:
    linear-gradient(rgba(14, 27, 46, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 27, 46, 0.035) 1px, transparent 1px);
  background-size: 64px 64px;
  -webkit-mask-image: radial-gradient(ellipse 70% 62% at 50% 45%, #000 20%, transparent 78%);
  mask-image: radial-gradient(ellipse 70% 62% at 50% 45%, #000 20%, transparent 78%);
}

.hero-escena__side {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.2vh, 16px);
  min-width: 0;
  min-height: 0;
}

.hero-escena__side-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: none;
}

.hero-escena__side--right .hero-escena__side-head {
  align-items: flex-end;
  text-align: right;
}

.hero-escena__eyebrow {
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--hero-ink-dim);
}

.hero-escena__side-title {
  font-size: clamp(15px, 1.15vw, 19px);
  font-weight: 800;
  letter-spacing: -0.015em;
}

.hero-escena__side--left .hero-escena__side-title {
  color: var(--hero-ink-2);
}

.hero-escena__side--right .hero-escena__side-title {
  color: var(--hero-blue);
}

.hero-escena__field {
  position: relative;
  flex: 1;
  min-height: 0;
  padding-top: 10px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.hero-escena__chaos-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-escena__chaos-col--b {
  padding-top: 22px;
}

/* La frase que aparece cuando el caos ya se ordenó: vive encima de las tarjetas y sube
   con --calm. */
.hero-escena__resolve {
  position: absolute;
  left: 0;
  right: 14%;
  top: 26%;
  margin: 0;
  font-size: clamp(20px, 2vw, 34px);
  font-weight: 800;
  line-height: 1.16;
  letter-spacing: -0.03em;
  text-wrap: balance;
  opacity: var(--calm);
  transform: translateY(calc((1 - var(--calm)) * 14px));
}

.hero-escena__resolve b {
  font-weight: 800;
  background: linear-gradient(95deg, var(--hero-blue), var(--hero-indigo));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-escena__p-card {
  position: relative;
  width: 100%;
  padding: 8px 10px 9px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--hero-line);
  backdrop-filter: blur(6px);
  will-change: transform, opacity;
  opacity: 0;
  box-shadow: 0 4px 14px rgba(20, 44, 88, 0.05);
}

.hero-escena__p-card .hero-escena__tag {
  color: #93a0b2;
}

.hero-escena__p-card .hero-escena__tag::before {
  border-radius: 2px;
  background: #c3cbd8;
}

.hero-escena__p-card h3 {
  font-size: clamp(11.5px, 0.82vw, 13.5px);
  font-weight: 700;
  line-height: 1.22;
  letter-spacing: -0.01em;
  color: var(--hero-ink-2);
  text-wrap: pretty;
  overflow-wrap: anywhere;
  margin: 0;
}

.hero-escena__p-card p {
  margin: 3px 0 0;
  font-size: clamp(9.5px, 0.62vw, 11px);
  line-height: 1.3;
  color: var(--hero-ink-dim);
  text-wrap: pretty;
  overflow-wrap: anywhere;
}

.hero-escena__s-grid {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: 1fr;
  gap: clamp(8px, 0.9vw, 14px);
  align-content: center;
  min-height: 0;
}

.hero-escena__s-card {
  position: relative;
  padding: 12px 13px;
  border-radius: 14px;
  opacity: 0;
  will-change: transform, opacity;
  background: #ffffff;
  border: 1px solid rgba(27, 111, 245, 0.16);
  box-shadow: 0 10px 26px rgba(27, 111, 245, 0.09);
}

.hero-escena__s-card .hero-escena__tag {
  margin-bottom: 6px;
  color: var(--hero-blue);
}

.hero-escena__s-card .hero-escena__tag::before {
  border-radius: 50%;
  background: linear-gradient(140deg, var(--hero-blue), var(--hero-indigo));
}

.hero-escena__s-card h3 {
  font-size: clamp(12px, 0.9vw, 15px);
  font-weight: 700;
  line-height: 1.24;
  letter-spacing: -0.015em;
  color: var(--hero-ink);
  text-wrap: pretty;
  overflow-wrap: anywhere;
  margin: 0;
}

.hero-escena__s-card p {
  margin: 4px 0 0;
  font-size: clamp(10px, 0.7vw, 12px);
  line-height: 1.35;
  color: var(--hero-ink-dim);
  text-wrap: pretty;
}

/* La etiqueta de cada tarjeta: en el export era monoespaciada, acá es la familia de la
   página con el mismo tracking y un peso más. */
.hero-escena__tag {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 4px;
  font-size: 9.5px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero-escena__tag::before {
  content: "";
  width: 6px;
  height: 6px;
}

.hero-escena__person-row {
  flex: none;
  display: flex;
  align-items: flex-end;
  gap: 14px;
  height: clamp(78px, 15vh, 170px);
}

/* Altura propia desde la animación corregida (31/8/2026, antes compartía la de la
   izquierda): más baja porque este bloque se va a reubicar junto a la máquina al
   asentarse, y ahí ocupa mucho menos que en su fila de origen. */
.hero-escena__side--right .hero-escena__person-row {
  flex-direction: row-reverse;
  text-align: right;
  height: clamp(62px, 10.5vh, 118px);
}

.hero-escena__person {
  height: 100%;
  width: auto;
  flex: none;
}

.hero-escena__person-note {
  font-size: clamp(11px, 0.78vw, 13px);
  line-height: 1.4;
  color: var(--hero-ink-dim);
  max-width: 22ch;
  padding-bottom: 4px;
  text-wrap: pretty;
  margin: 0;
}

.hero-escena__side--left .hero-escena__person {
  opacity: var(--stress);
  animation: hero-escena-shake 1.05s ease-in-out infinite;
}

.hero-escena__side--left .hero-escena__person-note {
  opacity: var(--stress);
}

.hero-escena__side--right .hero-escena__person,
.hero-escena__side--right .hero-escena__person-note {
  opacity: var(--calm);
}

.hero-escena__person-lift {
  will-change: transform;
}

.hero-escena__person-settle {
  will-change: transform;
  position: relative;
  z-index: 6;
}

.hero-escena__core {
  position: relative;
  z-index: 3;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.hero-escena__core-anchor {
  position: relative;
  flex: 1;
  width: 112%;
  margin-inline: -6%;
  min-height: 0;
  display: grid;
  place-items: center;
  /* El hueco que deja el comerciante al asentarse no reflowea la columna: la máquina y
     la marca se separan con transform, así la caja del <img> nunca cambia y el WebP no
     reinicia su decodificación. Ver el comentario largo sobre .hero-escena__core-slot
     más abajo. */
  transform: translateY(calc(var(--settled, 0) * -38px));
}

.hero-escena__maquina {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* El WebP viene a aspecto 1,5 (Lucas ya aceptó el cambio respecto del 1,65306 anterior
     -- ver marca/animacion-hero/README.md, sección "Cuadros pre-renderizados"): con
     contain la máquina entra entera, centrada, con algo más de margen vertical que
     antes en pantallas anchas. */
  object-fit: contain;
}

/* Banda donde aterriza el comerciante tranquilo al asentarse (progreso 80%-90%),
   reubicado por DOM desde escena-coreografia.js. Vacía en reposo -- height:0 para no
   ocupar espacio ni empujar nada mientras no tiene contenido -- y el bloque que cae
   adentro se posiciona con --settle-top, que la coreografía calcula una vez que mide la
   banda real entre la máquina y la marca. Apagada en teléfono: ver el punto 5 del
   docblock de cabecera de escena-coreografia.js. */
.hero-escena__core-slot {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 0;
}

/* Selector de DOS clases a propósito, igual que `.person-settle.is-settled` en el
   export: `.hero-escena__person-row` (una sola clase) también fija `height` para el
   breakpoint de teléfono, y una regla de una sola clase acá perdería contra esa por
   orden de aparición si algún día se reordena la hoja. Con dos clases gana siempre,
   sin depender de dónde caiga cada bloque. */
.hero-escena__person-settle.hero-escena__person-row--asentado {
  position: absolute;
  left: 50%;
  top: var(--settle-top, 0px);
  width: 188px;
  margin-left: -94px;
  height: auto;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 7px;
  transform-origin: center;
}

.hero-escena__person-settle.hero-escena__person-row--asentado .hero-escena__person {
  height: 78px;
}

.hero-escena__person-settle.hero-escena__person-row--asentado .hero-escena__person-note {
  max-width: 20ch;
  padding-bottom: 0;
  font-weight: 700;
  color: var(--hero-ink-2);
  font-size: clamp(14px, 1.1vw, 18px);
  line-height: 1.32;
  letter-spacing: -0.015em;
}

/* Respaldo cuando la máquina no se puede reproducir y bajo reduced-motion: el isotipo
   quieto en el centro, del tamaño que ocuparía la máquina. */
.hero-escena__isotipo-respaldo {
  position: relative;
  width: min(46%, 180px);
  height: auto;
  opacity: 0.92;
}

/* Mismo criterio que .hero-escena__haze de arriba: sin filter:blur(), con una parada
   intermedia en el gradiente para conservar la gradualidad (a menor escala -- este es
   el blur chico que el prompt marca como "de menor escala" dentro del mismo punto a). */
.hero-escena__core-glow {
  position: absolute;
  width: 120%;
  height: 120%;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(
    closest-side,
    rgba(27, 111, 245, 0.16) 0%,
    rgba(27, 111, 245, 0.085) 44%,
    transparent 70%
  );
  opacity: calc(0.1 + var(--power) * 0.9);
}

.hero-escena__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  /* Se corre hacia abajo en espejo del -38px de .hero-escena__core-anchor, para que el
     hueco que deja el comerciante al asentarse se reparta entre los dos sin reflow. */
  transform: translateY(calc(var(--settled, 0) * 18px));
}

.hero-escena__brand img {
  width: 34px;
  height: 34px;
}

.hero-escena__name {
  font-size: clamp(17px, 1.35vw, 23px);
  font-weight: 800;
  letter-spacing: -0.025em;
}

.hero-escena__name em {
  font-style: normal;
  color: var(--hero-blue);
}

.hero-escena__core-sub {
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--hero-ink-dim);
  text-align: center;
  margin: 0;
  transform: translateY(calc(var(--settled, 0) * 18px));
}

.hero-escena__footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  /* El padding inferior deja libre la zona donde vive el botón de avance de la sección
     (grupo 369, prompt 03), que está abajo al centro. */
  padding: 0 clamp(20px, 3.2vw, 56px) clamp(74px, 9vh, 96px);
  pointer-events: none;
}

.hero-escena__rail {
  position: relative;
  flex: 1;
  max-width: 340px;
  height: 2px;
  background: rgba(14, 27, 46, 0.1);
  border-radius: 2px;
}

.hero-escena__rail::after {
  content: "";
  position: absolute;
  inset: 0;
  transform-origin: left;
  transform: scaleX(var(--p));
  background: linear-gradient(90deg, #c3cbd8, var(--hero-blue), var(--hero-indigo));
  border-radius: 2px;
}

@keyframes hero-escena-shake {
  0%,
  100% {
    transform: translate(0, 0) rotate(-1.2deg);
  }
  25% {
    transform: translate(1.5px, -1px) rotate(1deg);
  }
  50% {
    transform: translate(-1px, 1px) rotate(-0.6deg);
  }
  75% {
    transform: translate(1px, 1.5px) rotate(1.4deg);
  }
}

/* Teléfono: las tres zonas se apilan. El export tenía una variante vertical aparte (otro
   archivo HTML); acá es la misma escena con el eje 'v' de la coreografía, que hace entrar
   las tarjetas desde abajo en vez de desde el costado. */
@media (max-width: 767.98px) {
  /* 🔴 Las tres filas van con TAMAÑO EXPLÍCITO y `minmax(0, ...)`, y esto no es
     cosmético: la primera versión de este bloque usaba `auto minmax(0,1fr) auto` y el
     checker midió el resultado -- la máquina (fila `auto`, 28vh) y las soluciones (fila
     `auto`, 511px de seis tarjetas) se comían el viewport entero y a la fila del medio,
     la del caos, le quedaban 10px de alto. Con dos `auto` peleando contra un `1fr`, el
     `1fr` pierde siempre. Acá la máquina tiene techo y las dos zonas de tarjetas se
     reparten lo que sobra en partes iguales. */
  .hero-escena {
    grid-template-columns: 1fr;
    /* 20vh para la máquina y el resto en partes iguales. Medido a 390x844 con el CSS
       compilado: la escena entra en los 844 exactos y las cuatro filas de tarjetas del
       caos (240px) caben en su zona sin pisar la de las soluciones. */
    grid-template-rows: minmax(0, 20vh) minmax(0, 1fr) minmax(0, 1fr);
    gap: clamp(6px, 1vh, 12px);
    padding: clamp(12px, 2.5vh, 24px) 16px clamp(60px, 9vh, 80px);
  }

  .hero-escena__core {
    order: -1;
    min-height: 0;
    gap: 6px;
  }

  .hero-escena__side {
    min-height: 0;
  }

  /* 🔴 El campo del caos pasa de flex a GRID de dos columnas. En flex, las dos columnas
     (`flex: 1; min-width: 0`) se achicaban a 0 en cuanto otro ítem del contenedor pedía
     ancho -- que es exactamente lo que pasaba con la frase de abajo -- y las siete
     tarjetas quedaban de 22px de ancho, con el texto apilado de a un carácter por línea
     (medido por el checker a 390 y a 767 de ancho). Con `1fr 1fr` el ancho de cada
     columna no depende de qué más haya adentro. */
  .hero-escena__field {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
    gap: 8px;
    padding-top: 4px;
  }

  /* Y la frase sigue FUERA DE FLUJO, como en desktop. Volverla `position: static` acá
     era la otra mitad del bug: pasaba a ser un ítem más del contenedor y se llevaba 326
     de los 350px de ancho. Tiene que superponerse a las tarjetas a propósito -- aparece
     cuando el caos ya fue succionado y ya no hay nada abajo que tapar. */
  .hero-escena__resolve {
    right: 4%;
    top: 18%;
    font-size: clamp(19px, 5.6vw, 26px);
  }

  .hero-escena__chaos-col--b {
    padding-top: 0;
  }

  .hero-escena__chaos-col {
    gap: 6px;
  }

  .hero-escena__p-card {
    padding: 6px 8px 7px;
  }

  /* En teléfono las tarjetas se quedan con la etiqueta y el título: el renglón de
     detalle no entra sin achicar la tipografía a un tamaño en el que no se lee. El
     detalle no es información nueva, es una aclaración de la misma idea. */
  .hero-escena__p-card p,
  .hero-escena__s-card p {
    display: none;
  }

  .hero-escena__p-card h3 {
    font-size: 12px;
  }

  .hero-escena__s-card h3 {
    font-size: 13px;
  }

  .hero-escena__s-card {
    padding: 8px 10px;
  }

  .hero-escena__s-grid {
    gap: 8px;
    align-content: start;
  }

  .hero-escena__side--right .hero-escena__side-head {
    align-items: flex-start;
    text-align: left;
  }

  .hero-escena__side--right .hero-escena__person-row {
    flex-direction: row;
    text-align: left;
    /* Pisa el clamp(62px,10.5vh,118px) de escritorio: esa altura más baja existe para
       cuando el bloque se reubica al asentarse, y acá el asentamiento está apagado (ver
       set_eje() en escena-coreografia.js), así que este lado vuelve a valer lo mismo que
       el de la izquierda. Mismo selector de dos clases que la regla de escritorio -- si
       fuera de una sola, la especificidad de esa regla ganaría igual estando antes en la
       hoja. */
    height: clamp(44px, 6.5vh, 64px);
  }

  /* El comerciante se queda (es medio mensaje de cada lado) pero chico, y su nota se va:
     a este ancho competiría por el lugar de las tarjetas, que son lo que hay que leer. */
  .hero-escena__person-row {
    height: clamp(44px, 6.5vh, 64px);
  }

  .hero-escena__person-note {
    display: none;
  }

  /* El asentamiento está apagado en este ancho (ver el punto 5 del docblock de cabecera
     de escena-coreografia.js): --settled nunca deja de ser 0 acá, pero por las dudas
     -- por ejemplo si alguien entra ya con progreso avanzado y después achica la
     ventana -- se neutralizan los corrimientos igual, en vez de confiar en que el JS
     llegue a tiempo. */
  .hero-escena__core-anchor,
  .hero-escena__brand,
  .hero-escena__core-sub {
    transform: none;
  }

  .hero-escena__footer {
    padding-bottom: clamp(70px, 8vh, 84px);
  }
}

/* Sin animación: las trece tarjetas visibles y legibles, el comerciante quieto y la
   escena contando lo mismo sin moverse. La coreografía ni se monta en este modo (ver el
   mounted del componente), así que las variables se quedan en sus valores de reposo y
   estas reglas son las que mandan. */
@media (prefers-reduced-motion: reduce) {
  .hero-escena__p-card,
  .hero-escena__s-card {
    opacity: 1;
    transform: none;
  }

  /* 🔴 La frase se ESCONDE, no se muestra. La primera versión la ponía a opacidad 1 junto
     con las tarjetas y el checker midió el resultado: el titular de 34px se dibujaba
     encima del texto de tres tarjetas de problema, que también estaban a opacidad 1. Y no
     es un problema de posición sino de sentido: la frase existe para aparecer DESPUÉS de
     que el caos se ordenó (`opacity: var(--calm)`), o sea cuando abajo ya no hay nada.
     En un estado estático las dos cosas no pueden convivir, y lo que el prompt pide que
     quede legible son las tarjetas. */
  .hero-escena__resolve {
    display: none;
  }

  .hero-escena__side--left .hero-escena__person,
  .hero-escena__side--left .hero-escena__person-note,
  .hero-escena__side--right .hero-escena__person,
  .hero-escena__side--right .hero-escena__person-note {
    opacity: 1;
    animation: none;
  }
}
</style>
