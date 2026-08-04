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

      <!-- Confirmación "armando tu demo" (grupo 322, prompt 03): aparece ~5s
           tras un envío exitoso del formulario y pasa sola al video de
           introducción. armando_demo la controla este contenedor. -->
      <confirmacion-armando-demo :visible="armando_demo" :turno="turno" />

      <!-- Video de introducción: pieza "intro" del catálogo. A diferencia de
           los clips del scroll, va con controles y sonido, sin autoplay (son
           5 minutos y el lead lo mira, no lo ojea). Sin URL cargada todavía
           (se graba post-merge), PiezaMultimedia muestra el placeholder de
           marca con las proporciones reales dentro del mismo marco. ref
           video_intro: destino del scroll automático al cerrarse la
           confirmación de arriba. -->
      <section ref="video_intro" class="demo-experiencia-page__video-intro">
        <marco-dispositivo tipo="computadora">
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
       * true mientras se muestra la confirmación "armando tu demo" (grupo 322,
       * prompt 03), justo después de un envío exitoso del formulario. La
       * apaga sola mostrar_confirmacion_armando_demo() a los ~5s.
       */
      armando_demo: false,
    }
  },

  created() {
    /* Carga inicial: el uuid identifica el turno/lead en la URL pública. */
    this.cargar_experiencia()
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
     * nunca se ejecuta y armando_demo nunca se activa (criterio de éxito 4).
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
     * Muestra la confirmación "armando tu demo" durante ~5s y, al vencer, la
     * oculta y scrollea suave hasta el video de introducción -- sin que el
     * lead tenga que hacer nada (grupo 322, prompt 03, criterios 1-3).
     *
     * @returns {void}
     */
    mostrar_confirmacion_armando_demo() {
      const self = this

      self.armando_demo = true

      setTimeout(function () {
        self.armando_demo = false

        self.$nextTick(function () {
          if (self.$refs.video_intro) {
            self.$refs.video_intro.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        })
      }, 5000)
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
/* Video de introducción: mismo contenedor centrado y acotado que el resto de
   la página (coherente con .demo-scroll-dolor), con aire antes del botón de
   acceso que va justo debajo. */
.demo-experiencia-page__video-intro {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 20px 64px;
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
