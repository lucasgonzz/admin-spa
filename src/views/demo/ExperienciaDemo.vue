<template>
  <!-- Página pública sin login, sin sidebar ni ningún elemento de la interfaz del
       admin (App.vue oculta el layout completo vía meta.public de la ruta) -->
  <div class="demo-experiencia-page">
    <!-- Estado: cargando el payload inicial -->
    <div v-if="loading" class="demo-experiencia-page__loading">
      <div class="spinner-border" role="status" style="color: var(--demo-color-azul)">
        <span class="visually-hidden">Cargando…</span>
      </div>
    </div>

    <!-- Estado: uuid inválido o vencido -- nunca el error crudo ni redirección al login -->
    <div v-else-if="invalido" class="demo-experiencia-page__invalido">
      <img src="@/assets/logo.jpg" alt="ComercioCity" class="demo-experiencia-page__logo" />
      <h1>Este link no es válido</h1>
      <p>Puede que haya vencido o esté mal escrito. Escribinos y te pasamos uno nuevo.</p>
    </div>

    <!-- Estado: payload cargado -- arma el scroll de dolor. El formulario, el
         video de introducción y el botón de acceso los agrega el prompt 05,
         en este mismo contenedor. -->
    <template v-else>
      <scroll-dolor
        :perfil="lead.perfil"
        :media="media"
        :emitir_evento="emitir_evento"
      />
    </template>
  </div>
</template>

<script>
import api_public from '@/utils/axios_public'
import ScrollDolor from '@/components/demo/ScrollDolor.vue'
// Hoja de estilos acotada a esta página (variables de marca, marcos de
// dispositivo, placeholder, animación de scroll). Al importarse solo acá,
// queda dentro del chunk lazy de la ruta /experiencia/:uuid y nunca se
// carga en el resto del admin.
import '@/assets/scss/demo-experiencia.scss'

/**
 * Página inmersiva de demo (Grupo 300 · pagina-inmersiva-demo, prompt 04).
 * Contenedor de la ruta pública /experiencia/:uuid: carga el payload del
 * endpoint público (prompt 03 de este mismo grupo) y arma el armazón de la
 * experiencia en el orden invertido definido en
 * contexto/demo_experiencia.md §3.16 A:
 *
 *   scroll de dolor -> formulario -> video de introducción -> botón de acceso
 *
 * Este prompt construye la ruta, el contenedor y el scroll. El formulario y
 * el botón de acceso se agregan en el prompt 05, dentro de este mismo
 * componente (no hace falta tocar la ruta ni el fetch del payload de nuevo).
 */
export default {
  name: 'ExperienciaDemo',

  components: {
    ScrollDolor,
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
      /** Respuestas del formulario de configuración + flag `completado` (lo consume el prompt 05). */
      formulario: {},
      /** Mapa { slot_id: url } de todas las piezas multimedia configuradas para este turno. */
      media: {},
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
  },
}
</script>

<style scoped>
.demo-experiencia-page__loading,
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
