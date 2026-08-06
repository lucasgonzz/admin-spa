<template>
  <!-- Página pública sin login, sin sidebar ni ningún elemento de la interfaz del
       admin (App.vue oculta el layout completo vía meta.public de la ruta) -->
  <div class="demo-experiencia-page">
    <!-- Estado: cargando el payload inicial. Desde el grupo 355 (prompt 01) es una
         pantalla de marca de verdad -- fondo de la apertura + isotipo con el shimmer
         del armado -- y no la EscenaMarca de la confirmación, que no mostraba nada
         visible: solo el texto para lectores de pantalla sobre las formas pulsantes.
         Se va con un fundido de 400ms sobre la página ya montada abajo (ver el
         <style scoped>): el fondo de las dos es el mismo, así que lo único que se
         cruza es el isotipo saliendo y el titular entrando -- nunca un corte ni un
         cuadro de fondo vacío. -->
    <transition name="demo-carga-marca-fundido">
      <pantalla-carga-marca v-if="loading" />
    </transition>

    <!-- Todo lo demás espera a que la pantalla de carga se dé por terminada (el piso
         de 2s incluido): mientras loading sea true no se monta nada, ni siquiera la
         pantalla de link inválido. -->
    <template v-if="!loading">
    <!-- Estado: uuid inválido o vencido -- nunca el error crudo ni redirección al login -->
    <div v-if="invalido" class="demo-experiencia-page__invalido">
      <img src="@/assets/logo.jpg" alt="ComercioCity" class="demo-experiencia-page__logo" />
      <h1>Este link no es válido</h1>
      <p>Puede que haya vencido o esté mal escrito. Escribinos y te pasamos uno nuevo.</p>
    </div>

    <!-- Estado: payload cargado -- arma la secuencia completa definida en
         contexto/demo_experiencia.md §3.16 A: scroll -> formulario -> video de
         introducción -> botón de acceso. Una sola carga de payload al abrir
         (cargar_experiencia) y un refresco después de enviar el formulario
         (enviar_formulario) o al vencer la cuenta regresiva (BotonAcceso). -->
    <template v-else>
      <!-- El RECORRIDO (scroll de dolor + formulario) y la VISTA POSTERIOR
           (confirmación + video + botón) son excluyentes: las dos caras del
           mismo intro_desbloqueada (grupo 348, prompt 07). Antes el recorrido
           quedaba montado para siempre, así que un lead que ya había completado
           el formulario en otra visita entraba con la vista posterior
           desbloqueada Y el recorrido todavía arriba -- podía scrollear hasta el
           video sin haber confirmado nada en esta sesión. Y al revés: confirmar
           dejaba de ser un punto sin retorno, porque el formulario seguía ahí
           arriba. Excluirlas resuelve las dos cosas sin repetirle el formulario
           a quien ya lo completó (criterio 5 del grupo 325). -->
      <template v-if="!intro_desbloqueada">
        <scroll-dolor
          :perfil="lead.perfil"
          :media="media"
          :emitir_evento="emitir_evento"
        />

        <!-- Formulario de configuración: preseleccionado con las respuestas del
             payload. El envío real (POST + refresco de todo el payload) lo hace
             este contenedor vía enviar_formulario, inyectado por prop. -->
        <formulario-configuracion
          :respuestas="formulario"
          :enviar_formulario="enviar_formulario"
        />
      </template>

      <!-- Confirmación "armando tu demo" + video de introducción + botón de
           acceso: vista POSTERIOR a la confirmación del formulario (grupo 325,
           prompt 02; correctivo grupo 331 -- la confirmación pasó a ser el
           primer tramo de esta misma vista, ya no un overlay que se
           desmonta solo). Antes estaban siempre renderizados, justo debajo
           del formulario, y el lead los veía apenas terminaba el scroll de
           dolor, sin haber confirmado nada. v-if (no v-show): con v-show el
           elemento seguiría en el documento ocupando lugar y, sobre todo,
           PiezaMultimedia seguiría montada y podría precargar el video antes
           de tiempo. -->
      <template v-if="intro_desbloqueada">
        <!-- El mensaje queda arriba para siempre. Y desde el grupo 355 (prompt 10)
             el shimmer del título tampoco se apaga: ya no hay un prop que lo prenda
             y lo apague, es parte fija del título mientras la pantalla está a la
             vista ("quiero que ese efecto no deje de hacerse, que continúe").
             Un lead que vuelve con el formulario ya completado ve exactamente la
             misma secuencia, porque el contenedor se la corre igual. -->
        <!-- Sin ref: el scroll ya no la busca para hacerle scrollIntoView, ahora
             va directo al tope de la página (grupo 348, prompt 07). -->
        <confirmacion-armando-demo :turno="turno" />

        <!-- Video de introducción: pieza "intro" del catálogo. A diferencia de
             los clips del scroll, va con controles y sonido, sin autoplay (son
             5 minutos y el lead lo mira, no lo ojea). Sin URL cargada todavía
             (se graba post-merge), PiezaMultimedia muestra el placeholder de
             marca con las proporciones reales dentro del mismo marco. ref
             video_intro: destino del scroll automático al cerrarse la
             confirmación de arriba. -->
        <section ref="video_intro" class="demo-experiencia-page__video-intro">
          <marco-dispositivo tipo="computadora" class="demo-marco--protagonista">
            <pieza-multimedia
              slot_id="intro"
              titulo="Video de introducción (Lucas a cámara, 5:15)"
              :media="media"
              :controles="true"
            />
          </marco-dispositivo>
        </section>

        <!-- Botón de acceso: el estado (sin_turno/antes/activo/vencido) lo
             decide siempre el backend (turno.estado); este componente solo
             agrega la cuenta regresiva visual, dispara el ingreso real
             (prompt 01 de este grupo) y pide refrescar el payload
             (cargar_experiencia) cuando esa cuenta llega a cero o el estado
             quedó viejo. -->
        <boton-acceso :turno="turno" :refrescar="cargar_experiencia" :ingresar="ingresar" />
      </template>
    </template>
    </template>
  </div>
</template>

<script>
import api_public from '@/utils/axios_public'
import ScrollDolor from '@/components/demo/ScrollDolor.vue'
import FormularioConfiguracion from '@/components/demo/FormularioConfiguracion.vue'
import ConfirmacionArmandoDemo from '@/components/demo/ConfirmacionArmandoDemo.vue'
import PantallaCargaMarca from '@/components/demo/PantallaCargaMarca.vue'
import BotonAcceso from '@/components/demo/BotonAcceso.vue'
import MarcoDispositivo from '@/components/demo/MarcoDispositivo.vue'
import PiezaMultimedia from '@/components/demo/PiezaMultimedia.vue'
import crear_avance_guiado from '@/components/demo/avance-guiado'
// Hoja de estilos acotada a esta página (variables de marca, marcos de
// dispositivo, placeholder, animación de scroll). Al importarse solo acá,
// queda dentro del chunk lazy de la ruta /experiencia/:uuid y nunca se
// carga en el resto del admin.
import '@/assets/scss/demo-experiencia.scss'

/**
 * Piso de la pantalla de carga, en ms (grupo 355, prompt 01). Es un PISO, no una
 * espera fija: si el payload tarda más, la pantalla se queda hasta que llegue; si
 * vuelve en 300ms, se sostiene lo que falte para llegar acá. Un destello de medio
 * segundo se lee como un parpadeo, no como una entrada.
 */
const PISO_PANTALLA_CARGA_MS = 2000

/**
 * Página inmersiva de demo (Grupo 300 · pagina-inmersiva-demo, prompts 04 y
 * 05). Contenedor de la ruta pública /experiencia/:uuid: carga el payload del
 * endpoint público (prompt 03 de este mismo grupo) y arma el armazón completo
 * de la experiencia en el orden definido en contexto/demo_experiencia.md
 * §3.16 A:
 *
 *   scroll de dolor -> formulario -> video de introducción -> botón de acceso
 *
 * El prompt 04 construyó la ruta, el contenedor y el scroll. Este prompt (05)
 * agrega el formulario, el video de introducción y el botón de acceso, sin
 * tocar la ruta ni el fetch inicial del payload.
 */
export default {
  name: 'ExperienciaDemo',

  components: {
    ScrollDolor,
    FormularioConfiguracion,
    ConfirmacionArmandoDemo,
    PantallaCargaMarca,
    BotonAcceso,
    MarcoDispositivo,
    PiezaMultimedia,
  },

  data() {
    return {
      /** true mientras se resuelve la carga inicial del payload. */
      loading: true,
      /** true cuando el uuid no resolvió un turno válido (404 o error de red). */
      invalido: false,
      /** { contact_name, company_name, perfil } del lead, tal como llega del payload. */
      lead: {},
      /** { fecha, hora_inicio, hora_fin, estado, ingreso } del turno agendado. */
      turno: {},
      /** Respuestas del formulario de configuración + flag `completado`, tal como llega del payload. */
      formulario: {},
      /** Mapa { slot_id: url } de todas las piezas multimedia configuradas para este turno. */
      media: {},
      /**
       * true cuando la carga inicial encontró el formulario ya completado y hay
       * que correr la secuencia de la confirmación al retirar la pantalla de
       * carga (grupo 355, prompt 10). Ver revelar_pagina().
       */
      secuencia_pendiente: false,
      /**
       * true una vez que el lead confirmó el formulario y terminó la
       * animación de "armando tu demo" -- o ya lo había hecho en una visita
       * anterior (ver cargar_experiencia). Antes de eso, el video de
       * introducción y el botón de acceso no existen en el DOM: el video es
       * una pantalla posterior, no un bloque más del scroll de dolor
       * (grupo 325, prompt 02).
       */
      intro_desbloqueada: false,
      /**
       * Handle del setTimeout de mostrar_confirmacion_armando_demo(), para
       * poder cancelarlo si el lead navega y este componente se destruye a
       * mitad de los 5s (si no, el callback correría igual sobre un
       * componente ya desmontado).
       */
      confirmacion_timeout: null,
      /**
       * Handle del setTimeout que sostiene la pantalla de carga hasta completar el
       * piso de PISO_PANTALLA_CARGA_MS, para poder cancelarlo si el lead navega
       * antes (mismo criterio que confirmacion_timeout).
       */
      carga_timeout: null,
      /**
       * true una vez que terminó la PRIMERA carga del payload. El piso de la
       * pantalla de carga vale solo para esa: cargar_experiencia() también la llama
       * BotonAcceso para refrescar el estado del turno, y ahí sostener la pantalla
       * dos segundos sería una interrupción en medio de la experiencia, no una
       * entrada.
       */
      carga_inicial_hecha: false,
      /**
       * true una vez que el componente se destruyó. La respuesta del payload puede
       * llegar después (el lead cierra la pestaña con la request en vuelo): sin
       * esto, ese .then programaría el setTimeout del piso cuando beforeUnmount ya
       * pasó y nadie lo va a limpiar.
       */
      desmontado: false,
      /** El contenedor con scroll real del admin, mientras esta página está montada. */
      scroller: null,
      /**
       * El controlador de avance por gesto (grupo 369, prompt 02), o null cuando el
       * recorrido no está en pantalla. Ver crear_avance() y el comentario de
       * recorrido_visible: vive SOLO mientras hay secciones con punto de enganche.
       */
      avance: null,
      /**
       * Valor de overflow-y que tenía el scroller antes de que la secuencia de la
       * confirmación lo bloqueara; null cuando no hay bloqueo puesto. Ver
       * bloquear_scroll().
       */
      overflow_previo: null,
    }
  },

  created() {
    /* Carga inicial: el uuid identifica el turno/lead en la URL pública. */
    this.cargar_experiencia()
  },

  /**
   * El avance guiado, para los descendientes que lo necesitan (grupo 369, prompt 03: el
   * botón de "siguiente sección" que vive dentro de cada FondoSeccionSticky).
   *
   * Se provee un envoltorio y no `this.avance` directo por dos razones: el controlador
   * se crea y se destruye con la vista, así que un valor provisto una sola vez quedaría
   * viejo o nulo; y así el botón depende de dos métodos con nombre en vez de del objeto
   * entero. Lo importante es que el botón entra por el MISMO avance que un gesto -- con
   * su cerrojo y su cola --, no por una implementación paralela.
   *
   * @returns {object}
   */
  provide() {
    const self = this
    return {
      avance_guiado: {
        /**
         * @param {number} direccion 1 hacia abajo, -1 hacia arriba.
         * @returns {void}
         */
        avanzar(direccion) {
          if (self.avance) {
            self.avance.avanzar(direccion)
          }
        },

        /**
         * @returns {boolean}
         */
        hay_siguiente() {
          return self.avance ? self.avance.hay_siguiente() : false
        },
      },
    }
  },

  computed: {
    /**
     * true cuando lo que está en pantalla es el RECORRIDO (scroll de dolor +
     * formulario), que es lo único que tiene secciones con punto de enganche.
     *
     * 🔴 De esto depende que el avance por gesto exista o no, y no es un detalle: el
     * controlador intercepta el `wheel` con `preventDefault()`, así que si estuviera
     * vivo en la vista POSTERIOR al formulario -- confirmación + video + botón de
     * acceso, que no tiene ninguna sección con enganche -- el lead se quedaría sin
     * poder scrollear nada. Las dos vistas son excluyentes (ver el template), así que
     * la condición es exactamente esta.
     *
     * @returns {boolean}
     */
    recorrido_visible() {
      return !this.loading && !this.invalido && !this.intro_desbloqueada
    },
  },

  watch: {
    /**
     * El controlador se crea y se destruye con el recorrido, no con la página: el
     * formulario confirmado cambia de vista sin desmontar este componente.
     *
     * @param {boolean} visible
     * @returns {void}
     */
    recorrido_visible(visible) {
      if (visible) {
        /* 🔴 SINCRÓNICO, no en `$nextTick`, y esto lo encontró el checker del prompt 03.
           El controlador no necesita el DOM para nacer: sólo el scroller, que existe
           desde el mounted de esta vista -- los puntos de enganche los lee en cada
           gesto, no al crearse. Con el `$nextTick` que había acá, en cambio, el
           callback se engancha al flush en curso y los `mounted()` de las secciones
           corren ANTES, así que cada FondoSeccionSticky preguntaba "¿queda alguna
           sección más abajo?" cuando todavía no había controlador: la respuesta era
           false, quedaba cacheada, y el botón de avance no aparecía en la apertura
           hasta que el lead se iba a otra sección y volvía. O sea: no lo veía justo el
           lead que no sabe scrollear, que es para quien existe el botón.
           Este watcher es pre-flush, así que crear acá es crear antes de que las
           secciones se monten. */
        this.crear_avance()
        return
      }
      this.destruir_avance()
    },
  },

  mounted() {
    /* Scroll guiado sección por sección (grupo 355, prompt 07). La clase va sobre el
       CONTENEDOR CON SCROLL REAL, que en este admin es <main class="app-main-scroll">
       y NO el documento -- y ese main lo comparte toda la interfaz interna, así que
       se marca al montar esta página y se desmarca al salir. Los puntos de snap los
       ponen las secciones (FondoSeccionSticky y las reglas de demo-experiencia.scss);
       acá solo se habilita el mecanismo. */
    this.scroller = this.encontrar_scroller()
    if (this.scroller && this.scroller.classList) {
      this.scroller.classList.add('demo-scroll-guiado')
    }

    /* Si el payload ya estaba resuelto antes de este mounted (no pasa hoy, porque
       `loading` arranca en true y el piso de la pantalla de carga son 2s, pero no hay
       que depender de eso), el watch de recorrido_visible no se va a disparar nunca. */
    if (this.recorrido_visible) {
      this.crear_avance()
    }
  },

  beforeUnmount() {
    this.desmontado = true

    /* Antes de soltar el scroller: los listeners del avance por gesto están puestos
       sobre él (y el de teclado sobre el documento). Si quedaran, el resto del admin
       se quedaría con el scroll secuestrado -- la peor herencia posible de esta
       página. */
    this.destruir_avance()

    /* El scroller es del admin entero: si esta clase quedara puesta, el resto de la
       interfaz se quedaría con scroll-snap y scroll-behavior:smooth. */
    if (this.scroller && this.scroller.classList) {
      this.scroller.classList.remove('demo-scroll-guiado')
    }
    this.scroller = null

    /* Si el lead navega a mitad de la animación de "armando tu demo", el
       scroller no puede quedar bloqueado para siempre (grupo 325, prompt 02).
       Restaurarlo acá es seguro incluso si nunca se llegó a bloquear: devolver
       su valor original a una propiedad que ya lo tenía no hace nada. */
    if (this.confirmacion_timeout) {
      clearTimeout(this.confirmacion_timeout)
    }
    if (this.carga_timeout) {
      clearTimeout(this.carga_timeout)
    }
    this.bloquear_scroll(false)
  },

  methods: {
    /**
     * Carga el payload de la página inmersiva desde el endpoint público
     * (GET /demo-experiencia/{uuid}, admin-api). Ante cualquier error
     * (404, uuid mal formado, red caída) muestra la pantalla sobria de link
     * inválido -- nunca el error crudo ni una redirección al login del admin.
     *
     * @returns {void}
     */
    cargar_experiencia() {
      const self = this
      const uuid = self.$route.params.uuid
      /* Momento de arranque de ESTA carga: contra esto se mide lo que falta del piso. */
      const iniciada_en = Date.now()
      const es_carga_inicial = !self.carga_inicial_hecha

      self.loading = true
      self.invalido = false

      api_public
        .get('/demo-experiencia/' + uuid)
        .then(function (response) {
          const data = response.data || {}
          self.lead = data.lead || {}
          self.turno = data.turno || {}
          self.formulario = data.formulario || {}
          self.media = data.media || {}
          // El backend ya resuelve si el lead completó el formulario en una
          // visita anterior (Lead::demo_form_completado_at, expuesto acá
          // como formulario.completado) -- si es así, no tiene sentido
          // hacerlo pasar de nuevo por la confirmación para ver el video
          // (grupo 325, prompt 02, criterio de éxito 5).
          //
          // Y desde el grupo 355 (prompt 10) no solo se le desbloquea la vista:
          // se le corre la MISMA secuencia que al confirmar -- shimmer, la
          // invitación a los 3s, el scroll al video a los 5s. Antes la pantalla
          // aparecía ya armada y quieta. El copy sigue eligiéndose por
          // turno.estado, así que lo que se repite es la secuencia, no el texto.
          //
          // Solo en la carga inicial: cargar_experiencia() también la llama
          // BotonAcceso para refrescar el estado del turno, y ahí volver a
          // bloquear el scroll cinco segundos sería una interrupción.
          //
          // No se dispara acá sino cuando la pantalla de carga se retira (ver
          // revelar_pagina): mientras el loader está encima, la confirmación ni
          // siquiera está montada, y los 3s de la invitación y los 5s del scroll
          // correrían tapados y descoordinados entre sí.
          self.intro_desbloqueada = !!self.formulario.completado
          self.secuencia_pendiente = !!(self.formulario.completado && !self.carga_inicial_hecha)
        })
        .catch(function () {
          self.invalido = true
        })
        .then(function () {
          /* La respuesta llegó tarde, con el componente ya destruido: no queda
             ningún timer por programar. */
          if (self.desmontado) {
            return
          }

          self.carga_inicial_hecha = true

          /* Refrescos posteriores (BotonAcceso): sin piso, se apaga apenas llega. */
          if (!es_carga_inicial) {
            self.revelar_pagina()
            return
          }

          /* Piso, no espera fija: solo se espera lo que falte para los 2s. Si el
             payload tardó más, restante es negativo y se revela de una. */
          const restante = PISO_PANTALLA_CARGA_MS - (Date.now() - iniciada_en)
          if (restante <= 0) {
            self.revelar_pagina()
            return
          }

          self.carga_timeout = window.setTimeout(function () {
            self.carga_timeout = null
            self.revelar_pagina()
          }, restante)
        })
    },

    /**
     * Monta el avance guiado: un gesto, una sección (grupo 369, prompt 02).
     *
     * POR QUÉ HACE FALTA, más allá del CSS. El grupo 355 (prompt 07) resolvió el
     * encuadre con `scroll-snap-type: y mandatory`, y con la rueda del mouse alcanza.
     * Pero el snap encuadra y NO limita la distancia: un gesto de trackpad o un swipe
     * fuerte desplazan cientos de píxeles más el momentum, el navegador los aplica y
     * recién después engancha en el punto más cercano a donde quedó -- dos o tres
     * secciones más abajo ("con el pad de la computadora se saltea varias", Lucas,
     * 5/8/2026). No existe un "snap de a uno" en CSS.
     *
     * Y EL SNAP DE CSS SE QUEDA IGUAL, no se retira. Son dos cosas distintas y las dos
     * hacen falta: el controlador limita el gesto, y el snap sigue siendo la red de
     * todo lo que el controlador no intercepta a propósito -- el re-enganche del
     * navegador después de un resize o una rotación de teléfono, y el tramo de scroll
     * libre del interludio, cuya maquinaria (`snap_libre_mientras_ocupa` en
     * FondoSeccionSticky, que prende y apaga `demo-scroll-guiado--libre`) es
     * justamente lo que el controlador consulta para saber cuándo no meterse.
     *
     * @returns {void}
     */
    crear_avance() {
      if (this.avance || !this.scroller || this.scroller === window) {
        return
      }
      this.avance = crear_avance_guiado(this.scroller)
    },

    /**
     * Retira el avance guiado y todos sus listeners. Idempotente: se llama desde el
     * watch y desde beforeUnmount, y llamarlo dos veces no hace nada.
     *
     * @returns {void}
     */
    destruir_avance() {
      if (!this.avance) {
        return
      }
      this.avance.destruir()
      this.avance = null
    },

    /**
     * Bloquea o libera el scroll mientras dura el armado de la confirmación.
     *
     * 🔴 Sobre el SCROLLER REAL, no sobre el body. Hasta el grupo 355 (prompt 10)
     * esto era `document.body.style.overflow = 'hidden'`, y no bloqueaba nada: en
     * este admin html, body y #app ya son overflow:hidden a propósito
     * (src/sass/_app.sass, "comportamiento tipo app nativa") y el que scrollea es
     * <main class="app-main-scroll">. Es el mismo hallazgo
     * (20260804-admin-spa-scroll-real-vive-en-main-no-en-window) que este archivo
     * ya citaba dos veces para el scroll automático, pero que nunca se le había
     * aplicado al bloqueo. Lo detectó el checker del prompt 10.
     *
     * Se guarda el valor previo en vez de asumir '': el scroller es del admin
     * entero y no le corresponde a esta página decidir cómo queda.
     *
     * @param {boolean} bloquear
     * @returns {void}
     */
    bloquear_scroll(bloquear) {
      const scroller = this.scroller || this.encontrar_scroller()
      if (!scroller || scroller === window || !scroller.style) {
        return
      }

      if (bloquear) {
        if (this.overflow_previo === null) {
          this.overflow_previo = scroller.style.overflowY || ''
        }
        scroller.style.overflowY = 'hidden'
        return
      }

      if (this.overflow_previo !== null) {
        scroller.style.overflowY = this.overflow_previo
        this.overflow_previo = null
      }
    },

    /**
     * Retira la pantalla de carga y, si el lead llega con el formulario ya
     * completado, arranca ahí la secuencia de la confirmación (grupo 355, prompt
     * 10). Acá y no al resolver el payload: mientras el loader está encima, la
     * confirmación ni siquiera está montada -- todo el contenido vive bajo
     * `v-if="!loading"` -- así que los 3s de la invitación y los 5s del scroll
     * correrían tapados, y encima descoordinados entre sí (los 3 los cuenta el
     * componente desde que se ve; los 5, este método desde que arranca).
     *
     * @returns {void}
     */
    revelar_pagina() {
      this.loading = false

      if (!this.secuencia_pendiente) {
        return
      }
      this.secuencia_pendiente = false

      const self = this
      /* nextTick: la confirmación no existe en el DOM hasta que este cambio de
         `loading` se renderiza, y la secuencia le busca refs. */
      this.$nextTick(function () {
        self.mostrar_confirmacion_armando_demo()
      })
    },

    /**
     * Tracking mínimo centralizado (contexto/demo_experiencia.md §6 del
     * prompt): hoy solo deja rastro en consola; el día que exista el bus de
     * eventos real, se enchufa acá sin tener que tocar ScrollDolor ni las
     * piezas del scroll.
     *
     * @param {string} nombre Nombre del evento (ej. "scroll_bloque_visible").
     * @param {object} payload Datos asociados al evento.
     * @returns {void}
     */
    emitir_evento(nombre, payload) {
      console.debug('[demo-experiencia]', nombre, payload)
    },

    /**
     * Envía las respuestas del formulario de configuración
     * (POST /demo-experiencia/{uuid}/formulario, api_public) y refresca todo
     * el estado de la página con el payload que devuelve el backend -- mismo
     * formato que el GET inicial. Inyectada como prop en
     * FormularioConfiguracion (mismo patrón que emitir_evento en
     * ScrollDolor), para que ese componente no necesite conocer el uuid ni
     * el cliente HTTP público.
     *
     * No hace catch acá a propósito: FormularioConfiguracion necesita que el
     * rechazo le llegue para mostrar su propio mensaje de error sobrio y
     * dejar las respuestas tal como estaban, sin perder lo que el lead marcó.
     * Por el mismo motivo, este .then SOLO corre en éxito (axios rechaza la
     * promesa ante 4xx/5xx): es el lugar correcto para disparar la
     * confirmación "armando tu demo" (grupo 322, prompt 03) sin necesitar
     * distinguir éxito de fallo por separado -- si el POST falla, este bloque
     * nunca se ejecuta y la confirmación nunca se activa (criterio de éxito 4).
     *
     * @param {object} respuestas Las nueve respuestas del formulario.
     * @returns {Promise<object>} El payload refrescado.
     */
    enviar_formulario(respuestas) {
      const self = this
      const uuid = self.$route.params.uuid

      return api_public.post('/demo-experiencia/' + uuid + '/formulario', respuestas).then(function (response) {
        const data = response.data || {}
        self.lead = data.lead || {}
        self.turno = data.turno || {}
        self.formulario = data.formulario || {}
        self.media = data.media || {}
        self.mostrar_confirmacion_armando_demo()
        return data
      })
    },

    /**
     * Muestra la confirmación "armando tu demo" durante ~5s y, al vencer,
     * scrollea sola hasta el video de introducción -- sin que el lead tenga
     * que hacer nada (grupo 322, prompt 03, criterios 1-3).
     *
     * CORRECTIVO (grupo 331): intro_desbloqueada se activa ACÁ, al arrancar
     * (no al vencer el timeout) -- la confirmación pasó a ser el primer
     * tramo de la vista posterior, ya no un overlay separado, así que tiene
     * que existir en el DOM desde el primer momento. El mensaje nunca se
     * desmonta.
     *
     * GRUPO 355, PROMPT 10. Tres cambios, todos pedidos de Lucas del 5/8/2026:
     * el shimmer del título ya NO se apaga a los 5s (queda en loop mientras la
     * pantalla esté a la vista, así que dejó de necesitar un prop que lo
     * prenda y apague); la invitación al video entra a los 3s en vez de a los
     * 900ms (eso lo cuenta ConfirmacionArmandoDemo, desde que la pantalla se
     * ve); y lo único que sigue pasando a los 5s es el scroll al video más la
     * liberación del scroll del documento. Los 3 y los 5 se cuentan desde el
     * mismo punto, no encadenados.
     *
     * Este método es el ÚNICO lugar donde vive la secuencia: lo llaman
     * enviar_formulario() (el lead acaba de confirmar) y cargar_experiencia()
     * (el lead recarga con el formulario ya completado). Antes ese segundo
     * caso solo prendía intro_desbloqueada y el lead se encontraba la pantalla
     * ya armada, estática -- "estaría bueno que cuando recargo se desencadenen
     * todas las acciones que se desencadenan cuando le doy al botón".
     *
     * Bloquea el scroll del documento mientras dura el armado (grupo 325,
     * prompt 02): sin esto el lead podría scrollear más allá del mensaje
     * antes de que termine. Se restaura acá al vencer el timeout, y también
     * en beforeUnmount si el lead navega antes.
     *
     * @returns {void}
     */
    mostrar_confirmacion_armando_demo() {
      const self = this

      /* Idempotente: la secuencia se dispara desde dos lados (al confirmar y al
       * recargar con el formulario ya completado) y no puede encimarse consigo
       * misma si los dos caminos se cruzaran. */
      if (self.confirmacion_timeout) {
        clearTimeout(self.confirmacion_timeout)
        self.confirmacion_timeout = null
      }

      self.intro_desbloqueada = true
      self.bloquear_scroll(true)

      /* Al confirmar, el recorrido anterior se DESMONTA (las dos vistas son
       * excluyentes desde el grupo 348, prompt 07), así que la confirmación pasa a
       * ser el tope de la página: corresponde llevar el scroll a 0 y no hacer
       * scrollIntoView sobre ella, que es lo que se hacía cuando quedaba a miles de
       * píxeles del formulario (grupo 336, prompt 03).
       *
       * Y no alcanza con window.scrollTo: en este admin el scroll real vive en
       * <main class="app-main-scroll">, no en window (hallazgo
       * 20260804-admin-spa-scroll-real-vive-en-main-no-en-window). El ancestro se
       * busca igual que en FondoSeccionSticky.encontrar_ancestro_scroll(), sin
       * hardcodear el selector.
       *
       * $nextTick es necesario por partida doble: la sección no existe hasta el
       * re-render, y el desmontaje del recorrido cambia el alto del documento. */
      self.$nextTick(function () {
        self.llevar_scroll_al_tope()
      })

      self.confirmacion_timeout = setTimeout(function () {
        self.confirmacion_timeout = null
        self.bloquear_scroll(false)

        self.$nextTick(function () {
          if (self.$refs.video_intro) {
            const reduced_motion = !!(
              typeof window !== 'undefined' &&
              window.matchMedia &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches
            )
            self.$refs.video_intro.scrollIntoView({
              behavior: reduced_motion ? 'auto' : 'smooth',
              block: 'start',
            })
          }
        })
      }, 5000)
    },

    /**
     * Lleva el scroll al tope de la página, buscando el contenedor que realmente
     * scrollea (mismo criterio que FondoSeccionSticky.encontrar_ancestro_scroll):
     * en este admin es <main class="app-main-scroll">, porque html/body/#app son
     * height:100% + overflow:hidden a propósito, "comportamiento tipo app nativa"
     * (src/sass/_app.sass). Un window.scrollTo acá no mueve nada.
     *
     * No se hardcodea el selector: si algún día esta página se usa fuera de este
     * shell, cae a window como en cualquier página que sí scrollea el documento.
     *
     * @returns {void}
     */
    llevar_scroll_al_tope() {
      const reduced_motion = !!(
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
      const opciones = { top: 0, left: 0, behavior: reduced_motion ? 'auto' : 'smooth' }
      const scroller = this.encontrar_scroller()

      if (scroller && scroller !== window) {
        scroller.scrollTo(opciones)
        return
      }

      window.scrollTo(opciones)
    },

    /**
     * Sube por los ancestros hasta el contenedor que realmente scrollea. Mismo
     * criterio que FondoSeccionSticky.encontrar_ancestro_scroll(): en este admin es
     * <main class="app-main-scroll">, porque html/body/#app son height:100% +
     * overflow:hidden a propósito, "comportamiento tipo app nativa"
     * (src/sass/_app.sass). No se hardcodea el selector: si algún día esta página se
     * usa fuera de este shell, cae a `window` como en cualquier página que sí
     * scrollea el documento.
     *
     * @returns {Window|Element}
     */
    encontrar_scroller() {
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
     * Dispara el ingreso a la demo (POST /demo-experiencia/{uuid}/ingresar,
     * api_public, prompt 01 de este grupo) cuando el lead aprieta el botón de
     * acceso. No hace catch acá a propósito: BotonAcceso necesita leer
     * `motivo` del 409 para elegir el mensaje correcto o refrescar el
     * payload completo si el estado quedó viejo -- mismo patrón que
     * enviar_formulario.
     *
     * @returns {Promise<object>} Resuelve con `{ url }` en éxito (200).
     */
    ingresar() {
      const uuid = this.$route.params.uuid

      return api_public.post('/demo-experiencia/' + uuid + '/ingresar').then(function (response) {
        return response.data
      })
    },
  },
}
</script>

<style scoped>
/* Salida de la pantalla de carga (grupo 355, prompt 01): un fundido corto, no un
   corte. Solo la salida -- la entrada no existe: esa pantalla es lo primero que se
   ve, no aparece sobre nada. Mientras se desvanece, la página de abajo YA está
   montada y el titular de la apertura está haciendo su animación de entrada; como
   las dos comparten el fondo de la apertura, no hay ningún cuadro con el fondo
   vacío en el medio. Las clases de <transition> caen sobre el nodo raíz del
   componente hijo, que hereda el atributo de scope de esta vista. */
.demo-carga-marca-fundido-leave-active {
  transition: opacity 400ms ease;
}

.demo-carga-marca-fundido-leave-to {
  opacity: 0;
}

/* Estático de verdad bajo reduced-motion: la pantalla se retira sin fundido. */
@media (prefers-reduced-motion: reduce) {
  .demo-carga-marca-fundido-leave-active {
    transition: none;
  }
}

/* El video de introducción ocupa su propia pantalla (grupo 348, prompt 07). Antes
   era un bloque más del flujo, acotado a 720px y apretado entre la confirmación
   (que ocupa 100dvh) y el botón de acceso: la pieza principal de esta pantalla
   entraba en menos de la mitad del alto disponible. Ahora es una sección completa y
   el marco crece con la variante --protagonista (demo-experiencia.scss).
   100dvh preferido con 100vh de fallback, y el orden importa: un navegador sin
   soporte de dvh ignora esa declaración entera y se queda con la de arriba. */
.demo-experiencia-page__video-intro {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  box-sizing: border-box;
}

/* El marco no tiene ancho propio (es un div en flujo): dentro del flex de arriba
   se encogería al contenido. Con esto ocupa la columna y su pantalla queda
   centrada, mientras el alto lo sigue mandando el max-height de la variante. */
.demo-experiencia-page__video-intro :deep(.demo-marco) {
  width: 100%;
  display: flex;
  justify-content: center;
}

/* En teléfono el ancho es el único recurso que le queda al video para
   distinguirse de una pieza del scroll de dolor (ver el comentario largo de
   .demo-marco--protagonista en demo-experiencia.scss): la sección suelta su
   padding lateral y el marco llega a los bordes. Mismo breakpoint que el resto
   de la página. */
@media (max-width: 767.98px) {
  .demo-experiencia-page__video-intro {
    padding-left: 0;
    padding-right: 0;
  }
}

/* El estado de carga ya no usa esta clase (grupo 322, prompt 04): reemplazado
   por EscenaMarca.vue, que trae su propio layout de pantalla completa. */
.demo-experiencia-page__invalido {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 16px;
  padding: 24px;
}

.demo-experiencia-page__logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
  border-radius: 12px;
  margin-bottom: 8px;
}

.demo-experiencia-page__invalido h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.demo-experiencia-page__invalido p {
  color: var(--demo-color-texto-suave);
  max-width: 420px;
  margin: 0;
}
</style>
