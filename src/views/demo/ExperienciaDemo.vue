<template>
  <!-- Página pública sin login, sin sidebar ni ningún elemento de la interfaz del
       admin (App.vue oculta el layout completo vía meta.public de la ruta) -->
  <div class="demo-experiencia-page">
    <!-- Estado: cargando el payload inicial (grupo 322, prompt 04). Antes era un
         spinner-border de Bootstrap genérico -- reemplazado por el mismo
         lenguaje visual de marca del resto de la página (EscenaMarca.vue,
         compartida con la confirmación del prompt 03), para que loader y
         apertura no se sientan como dos pantallas distintas. -->
    <escena-marca v-if="loading" role="status" aria-live="polite" aria-busy="true">
      <span class="visually-hidden">Cargando tu demo…</span>
    </escena-marca>

    <!-- Estado: uuid inválido o vencido -- nunca el error crudo ni redirección al login -->
    <div v-else-if="invalido" class="demo-experiencia-page__invalido">
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
        <!-- El mensaje queda arriba para siempre (no se desmonta a los 5s):
             lo único que se apaga es el shimmer del título, vía
             shimmer_activo. Un lead que ya había completado el formulario en
             una visita anterior nunca tiene shimmer_activo en true -- no hay
             ningún proceso en curso que anunciarle. -->
        <!-- Sin ref: el scroll ya no la busca para hacerle scrollIntoView, ahora
             va directo al tope de la página (grupo 348, prompt 07). -->
        <confirmacion-armando-demo :turno="turno" :shimmer_activo="shimmer_activo" />

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
  </div>
</template>

<script>
import api_public from '@/utils/axios_public'
import ScrollDolor from '@/components/demo/ScrollDolor.vue'
import FormularioConfiguracion from '@/components/demo/FormularioConfiguracion.vue'
import ConfirmacionArmandoDemo from '@/components/demo/ConfirmacionArmandoDemo.vue'
import EscenaMarca from '@/components/demo/EscenaMarca.vue'
import BotonAcceso from '@/components/demo/BotonAcceso.vue'
import MarcoDispositivo from '@/components/demo/MarcoDispositivo.vue'
import PiezaMultimedia from '@/components/demo/PiezaMultimedia.vue'
// Hoja de estilos acotada a esta página (variables de marca, marcos de
// dispositivo, placeholder, animación de scroll). Al importarse solo acá,
// queda dentro del chunk lazy de la ruta /experiencia/:uuid y nunca se
// carga en el resto del admin.
import '@/assets/scss/demo-experiencia.scss'

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
    EscenaMarca,
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
       * true mientras dura el armado (~5s tras un envío exitoso del
       * formulario): controla el shimmer del título de
       * ConfirmacionArmandoDemo, no si esta se muestra (eso ya lo decide
       * intro_desbloqueada, correctivo grupo 331 -- el mensaje queda montado
       * para siempre una vez que aparece). La apaga sola
       * mostrar_confirmacion_armando_demo() a los ~5s.
       */
      shimmer_activo: false,
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
    }
  },

  created() {
    /* Carga inicial: el uuid identifica el turno/lead en la URL pública. */
    this.cargar_experiencia()
  },

  beforeUnmount() {
    /* Si el lead navega a mitad de la animación de "armando tu demo", el
       body no puede quedar con el scroll bloqueado para siempre (grupo 325,
       prompt 02). Restaurar el overflow acá es seguro incluso si nunca se
       llegó a bloquear: asignar '' a una propiedad de estilo que ya estaba
       en '' no hace nada. */
    if (this.confirmacion_timeout) {
      clearTimeout(this.confirmacion_timeout)
    }
    document.body.style.overflow = ''
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
          self.intro_desbloqueada = !!self.formulario.completado
        })
        .catch(function () {
          self.invalido = true
        })
        .then(function () {
          self.loading = false
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
     * que existir en el DOM desde el primer momento para que el lead la vea
     * (con el shimmer prendido) mientras el armado está en curso. Lo único
     * que cambia a los 5s es shimmer_activo (el título pasa a color sólido:
     * el proceso ya terminó) y el scroll, que se libera y se mueve solo
     * hasta el video. El mensaje en sí nunca se desmonta.
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

      self.intro_desbloqueada = true
      self.shimmer_activo = true
      document.body.style.overflow = 'hidden'

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
        self.shimmer_activo = false
        document.body.style.overflow = ''

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

      let nodo = this.$el ? this.$el.parentElement : null
      while (nodo && nodo !== document.body) {
        const overflow_y = window.getComputedStyle(nodo).overflowY
        if (overflow_y === 'auto' || overflow_y === 'scroll') {
          nodo.scrollTo(opciones)
          return
        }
        nodo = nodo.parentElement
      }

      window.scrollTo(opciones)
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
