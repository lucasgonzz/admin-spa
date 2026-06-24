<template>
  <!-- Vista raíz del formulario de configuración inicial del cliente -->
  <div class="formulario-view">
    <!-- Estado: cargando datos iniciales desde la API -->
    <div v-if="loading" class="formulario-view__loading">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Cargando...</span>
      </div>
      <p class="formulario-view__loading-text">Cargando tu formulario...</p>
    </div>

    <!-- Estado: error de carga (token inválido o problema de red) -->
    <div v-else-if="error" class="formulario-view__error">
      <div class="formulario-view__error-card">
        <i class="bi bi-exclamation-circle formulario-view__error-icon"></i>
        <p class="formulario-view__error-text">{{ error }}</p>
      </div>
    </div>

    <!-- Estado: formulario ya enviado (éxito) -->
    <formulario-success
      v-else-if="submitted"
      :client_name="client_name"
    />

    <!-- Estado: formulario activo -->
    <template v-else>
      <!-- Barra de progreso fija en el tope -->
      <formulario-progress
        :current_index="current_section"
        :total="sections.length"
        :current_title="active_section.title"
      />

      <!-- Indicador de guardado automático -->
      <formulario-save-status :save_status="save_status" />

      <!-- Área de contenido central con padding para barra de progreso y footer -->
      <div class="formulario-view__content">
        <!-- Sección activa con transición fade -->
        <transition name="formulario-fade" mode="out-in">
          <formulario-section
            :key="active_section.id"
            :section="active_section"
            :form_data="form_data"
            @update:form_data="on_field_update"
          />
        </transition>
      </div>

      <!-- Footer de navegación fijo al pie -->
      <formulario-navigation
        :is_first_section="current_section === 0"
        :is_last_section="current_section === sections.length - 1"
        :can_continue="can_continue"
        :submitting="submitting"
        @prev="go_prev"
        @next="go_next"
        @submit="on_submit"
      />
    </template>
  </div>
</template>

<script>
import api_public          from '@/utils/axios_public'
import { SECTIONS }        from './questions'
import FormularioProgress  from './FormularioProgress.vue'
import FormularioSaveStatus from './FormularioSaveStatus.vue'
import FormularioSection   from './FormularioSection.vue'
import FormularioNavigation from './FormularioNavigation.vue'
import FormularioSuccess   from './FormularioSuccess.vue'

/**
 * Vista raíz del formulario de configuración inicial del cliente.
 * Ruta pública: /configuracion/:token (sin autenticación requerida).
 *
 * Responsabilidades:
 * - Carga los datos del formulario desde GET /form/implementation/{token}.
 * - Gestiona la navegación entre secciones y el mapa de respuestas.
 * - Autoguarda con debounce de 2 segundos en PATCH /form/implementation/{token}.
 * - Envía el formulario definitivo con POST /form/implementation/{token}/submit.
 * - Muestra el componente de éxito al terminar o al volver al link enviado.
 */
export default {
  name: 'FormularioView',

  components: {
    FormularioProgress,
    FormularioSaveStatus,
    FormularioSection,
    FormularioNavigation,
    FormularioSuccess,
  },

  data() {
    return {
      /**
       * Indica que la carga inicial de datos está en curso.
       */
      loading: true,

      /**
       * Mensaje de error si la carga inicial falla (token inválido, error de red, etc.).
       * null cuando no hay error.
       */
      error: null,

      /**
       * True cuando el formulario ya fue enviado (por el cliente ahora o en sesión anterior).
       */
      submitted: false,

      /**
       * Nombre del cliente para personalizar mensajes en la UI.
       */
      client_name: '',

      /**
       * Mapa de respuestas del formulario: { [key]: value }.
       * Se carga desde la API al inicio y se actualiza con cada cambio del usuario.
       */
      form_data: {},

      /**
       * Índice 0-based de la sección actualmente visible.
       */
      current_section: 0,

      /**
       * Estado del guardado automático:
       * null = sin actividad, 'saving' = en curso, { saved_at: Date } = éxito.
       */
      save_status: null,

      /**
       * Referencia al setTimeout de debounce del autoguardado.
       * Se cancela y reinicia con cada cambio del usuario.
       */
      save_timer: null,

      /**
       * Previene doble envío mientras se procesa el submit.
       */
      submitting: false,

      /**
       * Definición de secciones importada de questions.js.
       */
      sections: SECTIONS,
    }
  },

  computed: {
    /**
     * Sección actualmente visible según el índice current_section.
     *
     * @returns {object}
     */
    active_section() {
      return this.sections[this.current_section]
    },

    /**
     * Determina si la sección activa permite avanzar.
     * Verifica que todas las preguntas requeridas y visibles tengan respuesta no vacía.
     *
     * @returns {boolean}
     */
    can_continue() {
      const self = this
      const visible_required = self.active_section.questions.filter(function (q) {
        if (!q.required) {
          return false
        }
        /* Las preguntas con show_if no evaluadas no bloquean el avance */
        if (q.show_if && self.form_data[q.show_if.key] !== q.show_if.value) {
          return false
        }
        return true
      })

      /* Verifica que cada pregunta requerida visible tenga un valor no vacío */
      let all_answered = true
      visible_required.forEach(function (q) {
        const answer = self.form_data[q.key]
        if (answer == null || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
          all_answered = false
        }
      })
      return all_answered
    },
  },

  mounted() {
    /* Carga inicial: recupera datos del formulario por token desde la URL */
    this.load_form_data()
  },

  beforeDestroy() {
    /* Limpiar el timer de debounce al destruir el componente */
    if (this.save_timer) {
      clearTimeout(this.save_timer)
    }
  },

  methods: {
    /**
     * Carga los datos del formulario desde GET /form/implementation/{token}.
     * Si el formulario ya fue enviado, activa la pantalla de éxito directamente.
     *
     * @returns {void}
     */
    load_form_data() {
      const self = this
      const token = self.$route.params.token

      self.loading = true
      self.error   = null

      api_public
        .get('/form/implementation/' + token)
        .then(function (res) {
          if (res.data.submitted) {
            /* El formulario ya fue enviado anteriormente: mostrar pantalla de éxito */
            self.submitted   = true
            self.client_name = res.data.client_name || ''
          } else {
            /* Cargar los datos guardados para continuar donde el cliente dejó */
            self.client_name = res.data.client_name || ''
            self.form_data   = res.data.form_data || {}
          }
        })
        .catch(function () {
          self.error = 'No pudimos encontrar tu formulario. Verificá el link.'
        })
        .then(function () {
          self.loading = false
        })
    },

    /**
     * Maneja la actualización de un campo individual.
     * Aplica el cambio en form_data y programa el autoguardado con debounce.
     *
     * @param {{ key: string, value: * }} payload
     * @returns {void}
     */
    on_field_update(payload) {
      /* Usar Vue.set para garantizar reactividad en objetos anidados */
      this.$set(this.form_data, payload.key, payload.value)
      this.schedule_autosave()
    },

    /**
     * Programa el autoguardado con debounce de 2 segundos.
     * Cancela cualquier timer anterior para reiniciar la espera.
     *
     * @returns {void}
     */
    schedule_autosave() {
      const self = this

      /* Cancelar el timer previo si existe */
      if (self.save_timer) {
        clearTimeout(self.save_timer)
      }

      /* Programar guardado en 2 segundos */
      self.save_timer = setTimeout(function () {
        self.do_autosave()
      }, 2000)
    },

    /**
     * Envía los datos actuales al servidor via PATCH /form/implementation/{token}.
     * Actualiza el estado de save_status durante y después de la petición.
     *
     * @returns {void}
     */
    do_autosave() {
      const self  = this
      const token = self.$route.params.token

      /* Indicar que el guardado está en progreso */
      self.save_status = 'saving'

      api_public
        .patch('/form/implementation/' + token, { form_data: self.form_data })
        .then(function () {
          /* Guardado exitoso: registrar hora */
          self.save_status = { saved_at: new Date() }
        })
        .catch(function () {
          /* Error silencioso: no interrumpir la experiencia del usuario */
          self.save_status = null
        })
    },

    /**
     * Navega a la sección anterior (decrementa current_section).
     *
     * @returns {void}
     */
    go_prev() {
      if (this.current_section > 0) {
        this.current_section -= 1
        /* Scroll al inicio del contenido al cambiar de sección */
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },

    /**
     * Navega a la siguiente sección (incrementa current_section).
     * Solo avanza si can_continue es true.
     *
     * @returns {void}
     */
    go_next() {
      if (this.can_continue && this.current_section < this.sections.length - 1) {
        this.current_section += 1
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },

    /**
     * Envía el formulario definitivo via POST /form/implementation/{token}/submit.
     * Previene doble envío con la bandera submitting.
     * Al terminar exitosamente, activa la pantalla de éxito.
     *
     * @returns {void}
     */
    on_submit() {
      const self = this

      if (self.submitting || !self.can_continue) {
        return
      }

      const token = self.$route.params.token

      self.submitting = true

      api_public
        .post('/form/implementation/' + token + '/submit', { form_data: self.form_data })
        .then(function () {
          /* Mostrar pantalla de éxito */
          self.submitted = true
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
        .catch(function () {
          /* Error al enviar: permitir reintento */
          self.submitting = false
        })
    },
  },
}
</script>

<style scoped>
/* Pantalla de carga centrada */
.formulario-view__loading {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  gap: 16px;
}

.formulario-view__loading-text {
  color: #6c757d;
  font-size: 0.95rem;
  margin: 0;
}

/* Pantalla de error centrada */
.formulario-view__error {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: #f8f9fa;
}

.formulario-view__error-card {
  max-width: 400px;
  text-align: center;
  padding: 32px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
}

.formulario-view__error-icon {
  font-size: 2.5rem;
  color: #dc3545;
  display: block;
  margin-bottom: 16px;
}

.formulario-view__error-text {
  color: #495057;
  font-size: 1rem;
  margin: 0;
}

/* Área de contenido: padding para compensar barra de progreso (top) y footer (bottom) */
.formulario-view__content {
  max-width: 640px;
  margin: 0 auto;
  padding: 100px 20px 100px;
  min-height: 100vh;
  background: #f8f9fa;
}

/* Transición fade entre secciones */
.formulario-fade-enter-active,
.formulario-fade-leave-active {
  transition: opacity 0.2s ease;
}

.formulario-fade-enter,
.formulario-fade-leave-to {
  opacity: 0;
}
</style>
