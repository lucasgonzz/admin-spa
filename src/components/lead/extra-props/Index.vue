<template>
  <div v-if="record && record.id">
    <div class="alert alert-light border mb-3">
      <div class="row g-2">
        <div class="col-md-12">
          <small class="text-muted d-block">Cliente / producción</small>
          <strong>{{ production_client_label }}</strong>
        </div>
      </div>
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <!-- <button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading_action !== ''" @click="send_presentation_mail">
        {{ loading_action === 'presentation' ? 'Enviando...' : 'Enviar presentación' }}
      </button> -->
      <button type="button" class="btn btn-sm btn-primary" :disabled="loading_action !== ''" @click="send_demo_mail" :title="demo_mail_validation_message || 'Enviar mail de acceso a la demo'">
        {{ loading_action === 'demo_mail' ? 'Enviando...' : 'Enviar mail 1 - DEMO' }}
      </button>
      <button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading_action !== ''" @click="run_demo_setup">
        {{ loading_action === 'demo' ? 'Ejecutando...' : 'Correr demo setup' }}
      </button>
      <button type="button" class="btn btn-sm btn-outline-success" :disabled="loading_action !== ''" @click="send_followup_mail">
        {{ loading_action === 'followup' ? 'Enviando...' : 'Enviar Mail 2 - Propuesta' }}
      </button>
      <!-- Promover a cliente: crea el Client en admin-api, marca el lead como cerrado_ganado
           y genera automáticamente las tareas del proceso 'lead_a_cliente'. -->
      <button
        type="button"
        class="btn btn-sm btn-success"
        :disabled="loading_action !== '' || !can_promote_to_client"
        @click="request_promote_to_client"
        :title="promote_to_client_title"
      >
        <i class="bi bi-person-check-fill me-1" />
        {{ loading_action === 'fetching_subdomain' ? 'Sugiriendo...' : 'Promover a cliente' }}
      </button>
      <button type="button" class="btn btn-sm btn-outline-success" :disabled="loading_action !== '' || !can_run_user_setup" @click="run_user_setup">
        {{ loading_action === 'user_setup' ? 'Ejecutando...' : 'Correr user setup' }}
      </button>
    </div>

    <!-- Confirmación de subdominio antes de promover a cliente -->
    <div v-if="showing_subdomain_confirm" class="alert alert-light border mb-3">
      <div class="mb-2">
        <strong>Subdominio sugerido</strong>
        <small class="text-muted ms-1">(podés editarlo antes de confirmar)</small>
      </div>
      <!-- Input editable: el operador puede cambiar el subdominio sugerido -->
      <div class="mb-3">
        <input
          type="text"
          class="form-control form-control-sm"
          v-model="subdomain_preview"
          maxlength="20"
          placeholder="ej: hb, lamartina, galvan"
        />
        <small class="text-muted">Solo letras, números y guiones. Máximo 20 caracteres.</small>
      </div>
      <!-- Preview de las URLs que se van a crear -->
      <div v-if="subdomain_preview" class="small text-muted mb-3">
        <div class="mb-1"><strong>URLs a crear:</strong></div>
        <div>SPA 1: https://{{ subdomain_preview }}.comerciocity.com</div>
        <div>API 1: https://api-{{ subdomain_preview }}.comerciocity.com</div>
        <div>SPA 2: https://{{ subdomain_preview }}2.comerciocity.com</div>
        <div>API 2: https://api-{{ subdomain_preview }}2.comerciocity.com</div>
      </div>
      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-sm btn-success"
          :disabled="!subdomain_preview || loading_action !== ''"
          @click="confirm_promote_to_client"
        >
          <i class="bi bi-check-lg me-1" />
          {{ loading_action === 'promote_to_client' ? 'Promoviendo...' : 'Confirmar y promover' }}
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="loading_action !== ''"
          @click="cancel_subdomain_confirm"
        >
          Cancelar
        </button>
      </div>
    </div>

    <!-- Advertencia de campos faltantes para el mail de demo -->
    <div v-if="demo_mail_validation_message" class="alert alert-warning py-2 mb-2 small">
      <strong>Mail 1 - DEMO:</strong> {{ demo_mail_validation_message }}
    </div>

    <div class="alert alert-light border mb-3">
      <div class="small text-muted mb-2">Correos comerciales</div>
      <div class="row g-2">
        <div v-for="mail_status in mail_status_cards" :key="mail_status.key" class="col-md-6">
          <small class="text-muted d-block">{{ mail_status.title }}</small>
          <span class="badge" :class="mail_status.badge_class">{{ mail_status.status_text }}</span>
          <div class="small mt-1">
            <strong>{{ mail_status.time_label }}:</strong> {{ mail_status.last_sent_at_text }}
          </div>
          <div v-if="mail_status.last_error" class="small text-danger mt-1">
            <strong>Último error:</strong> {{ mail_status.last_error }}
          </div>
        </div>
      </div>
    </div>

    <div class="alert alert-light border mb-3">
      <div class="small text-muted mb-2">Setup remoto (ERP demo / productiva)</div>
      <div class="row g-2">
        <div v-for="setup_row in setup_status_cards" :key="setup_row.key" class="col-md-6">
          <small class="text-muted d-block">{{ setup_row.title }}</small>
          <span class="badge" :class="setup_row.badge_class">{{ setup_row.status_text }}</span>
          <div class="small mt-1">
            <strong>{{ setup_row.time_label }}:</strong> {{ setup_row.last_sent_at_text }}
          </div>
          <div v-if="setup_row.last_error" class="small text-danger mt-1">
            <strong>Último error:</strong> {{ setup_row.last_error }}
          </div>
        </div>
      </div>
    </div>

    <!-- Resumen del lead generado por Claude antes del fin de la demo -->
    <div
      v-if="record.demo_summary"
      class="alert alert-light border mb-3"
    >
      <div class="small text-muted mb-1">
        <i class="bi bi-stars me-1" />
        Resumen del lead (generado por IA antes del fin de la demo)
      </div>
      <!-- Texto en prosa generado por Claude; se muestra solo cuando existe -->
      <p class="mb-0 small" style="white-space: pre-line;">{{ record.demo_summary }}</p>
    </div>

    <div v-if="record.presentation_mail_last_error" class="alert alert-warning py-2">
      <strong>Error mail presentación:</strong> {{ record.presentation_mail_last_error }}
    </div>
    <div
      v-if="!record.promoted_client_id"
      class="alert alert-info py-2 small mb-0"
    >
      Usá <strong>Promover a cliente</strong> para crear el perfil del cliente y generar las tareas automáticas del equipo.
      Después cargá la <strong>API URL</strong> en el perfil del cliente (Clientes) y ejecutá <strong>Correr user setup</strong>.
    </div>
    <div
      v-if="record.promoted_client_id && !client_production_api_url"
      class="alert alert-info py-2 small mb-0"
    >
      Cargá la <strong>API URL</strong> en el perfil del cliente (Clientes) para habilitar «Correr user setup».
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

export default {
  name: 'LeadExtraProps',
  props: {
    /**
     * Lead en edición: en el modal CRUD es el borrador (`draft`) del ModelModal,
     * no la fila original de la tabla, para reflejar al instante mails y setups.
     */
    record: { type: Object, default: null },
  },
  emits: ['record-updated'],
  data() {
    return {
      /**
       * Acción actualmente en ejecución para bloquear botones y feedback visual.
       */
      loading_action: '',
      /**
       * URL candidata para promover un lead a cliente.
       */
      promotion_api_url: '',
      /**
       * Controla si se muestra el panel de confirmación de subdominio antes de promover.
       */
      showing_subdomain_confirm: false,
      /**
       * Subdominio sugerido por Claude o editado por el operador antes de confirmar la promoción.
       */
      subdomain_preview: '',
    }
  },
  computed: {
    /**
     * Valida que el lead tenga todos los datos necesarios para enviar el mail de demo.
     * Devuelve un mensaje con los campos faltantes o null si todo está completo.
     * Campos requeridos: nombre, email, documento, nombre empresa, demo asignada,
     * fecha demo, hora inicio y hora fin.
     * @returns {string|null}
     */
    demo_mail_validation_message() {
      if (!this.record) {
        return null
      }
      /** Campos faltantes para habilitar el envío del mail de demo. */
      var missing = []
      if (!(this.record.contact_name || '').trim())    { missing.push('nombre') }
      if (!(this.record.email || '').trim())            { missing.push('email') }
      if (!(this.record.doc_number || '').trim())       { missing.push('documento') }
      if (!(this.record.company_name || '').trim())     { missing.push('nombre empresa') }
      if (!this.record.demo_id)                         { missing.push('demo asignada') }
      if (!this.record.demo_date)                       { missing.push('fecha demo') }
      if (!(this.record.demo_start_time || '').trim())  { missing.push('hora inicio') }
      if (!(this.record.demo_end_time || '').trim())    { missing.push('hora fin') }
      if (missing.length === 0) {
        return null
      }
      return 'Faltan: ' + missing.join(', ') + '.'
    },
    /**
     * API URL del sistema productivo según el perfil Client vinculado (no el lead).
     * @returns {string}
     */
    client_production_api_url() {
      if (!this.record || !this.record.promoted_client) {
        return ''
      }
      return (this.record.promoted_client.api_url || '').trim()
    },

    /**
     * Habilita "Promover a cliente" si el lead aún no tiene Client vinculado.
     * @returns {boolean}
     */
    can_promote_to_client() {
      if (!this.record) {
        return false
      }
      return !this.record.promoted_client_id
    },

    /**
     * Texto del tooltip del botón "Promover a cliente" según el estado del lead.
     * @returns {string}
     */
    promote_to_client_title() {
      if (!this.record) {
        return ''
      }
      if (this.record.promoted_client_id) {
        return 'Este lead ya tiene un Client de producción vinculado.'
      }
      return 'Crear el perfil de cliente en admin-api y generar las tareas automáticas del equipo.'
    },

    /**
     * Habilita user setup cuando el lead está cerrado ganado, tiene Client vinculado
     * y ese Client tiene API URL cargada en su perfil.
     * @returns {boolean}
     */
    can_run_user_setup() {
      if (!this.record || this.record.status !== 'cerrado_ganado') {
        return false
      }
      if (!this.record.promoted_client_id) {
        return false
      }
      return this.client_production_api_url.length > 0
    },
    /**
     * Etiqueta del Client vinculado o estado de producción (admin-spa es la fuente de verdad).
     * @returns {string}
     */
    production_client_label() {
      if (!this.record) {
        return '—'
      }
      if (this.record.promoted_client_id && this.record.promoted_client) {
        var c = this.record.promoted_client
        var label = c.name || '#' + this.record.promoted_client_id
        if (c.company_name) {
          label += ' — ' + c.company_name
        }
        return label
      }
      if (this.record.status === 'cerrado_ganado') {
        return 'Cerrado ganado — pendiente Client / user setup'
      }
      return 'No promovido'
    },
    /**
     * Tarjetas de estado de los envíos de mail comercial.
     * Mail 1 = demo, Mail 2 = seguimiento.
     * @returns {Array<Object>}
     */
    mail_status_cards() {
      if (!this.record) {
        return []
      }
      /** Arreglo final de tarjetas a renderizar en la UI. */
      var cards = []
      cards.push(
        this.build_mail_status_card(
          'mail_1_demo',
          'Mail 1 - DEMO',
          this.record.demo_mail_sent_at,
          this.record.demo_mail_last_error
        )
      )
      cards.push(
        this.build_mail_status_card(
          'mail_2_followup',
          'Mail 2 - Seguimiento',
          this.record.followup_mail_sent_at,
          this.record.followup_mail_last_error
        )
      )
      return cards
    },
    /**
     * Tarjetas de trazabilidad de demo-setup y user-setup (estado, última corrida, error).
     * @returns {Array<Object>}
     */
    setup_status_cards() {
      if (!this.record) {
        return []
      }
      /** Filas de UI alineadas al formato de mail_status_cards. */
      var rows = []
      rows.push(
        this.build_setup_status_card(
          'demo_setup_remote',
          'Demo setup (ERP demo)',
          this.record.demo_setup_status,
          this.record.demo_setup_last_run_at,
          this.record.demo_setup_last_error
        )
      )
      rows.push(
        this.build_setup_status_card(
          'user_setup_remote',
          'User setup (ERP productiva)',
          this.record.user_setup_status,
          this.record.user_setup_last_run_at,
          this.record.user_setup_last_error
        )
      )
      return rows
    },
  },
  watch: {
    /**
     * Mantiene el input de promoción alineado con api_url del lead tras guardar / recargar.
     */
    record: {
      deep: true,
      handler: function (new_record) {
        if (new_record && new_record.api_url) {
          this.promotion_api_url = new_record.api_url
        }
      },
    },
  },
  methods: {
    /**
     * Muestra un toast global si existe, con fallback a alert.
     * @param {string} message mensaje de feedback para el usuario.
     * @returns {void}
     */
    open_feedback(message) {
      if (this.$root && this.$root.$emit) {
        this.$root.$emit('open_toast', message)
        return
      }
      alert(message)
    },
    /**
     * Normaliza el mensaje de error de axios para mostrar en UI.
     * @param {any} error error capturado.
     * @returns {string}
     */
    get_error_message(error) {
      return resolve_error_message(error)
    },
    /**
     * Formatea una fecha/hora a texto legible en español.
     * @param {string|null} date_value fecha recibida del backend.
     * @returns {string}
     */
    format_datetime(date_value) {
      if (!date_value) {
        return 'Nunca'
      }
      /** Instancia Date para formatear la fecha local. */
      var local_date = new Date(date_value)
      if (isNaN(local_date.getTime())) {
        return date_value
      }
      return local_date.toLocaleString('es-AR')
    },
    /**
     * Construye una tarjeta de estado de envío para un mail del lead.
     * @param {string} key clave única para v-for.
     * @param {string} title título visible de la tarjeta.
     * @param {string|null} sent_at fecha de último envío exitoso.
     * @param {string|null} last_error último error registrado al enviar.
     * @returns {Object}
     */
    build_mail_status_card(key, title, sent_at, last_error) {
      /** Objeto base con información común del estado. */
      var card = {
        key: key,
        title: title,
        status_text: 'Pendiente',
        badge_class: 'bg-secondary',
        last_sent_at_text: this.format_datetime(sent_at),
        last_error: last_error || '',
        time_label: 'Último envío',
      }
      // Si hay error guardado, el último intento fue fallido.
      if (card.last_error) {
        card.status_text = 'Fallido'
        card.badge_class = 'bg-danger'
        return card
      }
      // Si no hay error y hay fecha de envío, el estado actual es exitoso.
      if (sent_at) {
        card.status_text = 'Exitoso'
        card.badge_class = 'bg-success'
      }
      return card
    },
    /**
     * Construye tarjeta de estado para una corrida remota (demo setup / user setup).
     *
     * @param {string} key clave única para v-for.
     * @param {string} title título visible.
     * @param {string|null} status valor persistido (pendiente, ejecutandose, exitoso, fallido).
     * @param {string|null} last_run_at fecha/hora de último intento registrado en servidor.
     * @param {string|null} last_error mensaje de fallo si existe.
     * @returns {Object}
     */
    build_setup_status_card(key, title, status, last_run_at, last_error) {
      /** Estado normalizado en minúsculas para comparar con valores del backend. */
      var normalized_status = (status || 'pendiente').toString().toLowerCase()
      /** Objeto de presentación homogéneo con mail_status_cards. */
      var card = {
        key: key,
        title: title,
        status_text: 'Pendiente',
        badge_class: 'bg-secondary',
        last_sent_at_text: this.format_datetime(last_run_at),
        last_error: last_error || '',
        time_label: 'Última corrida',
      }
      if (card.last_error) {
        card.status_text = 'Fallido'
        card.badge_class = 'bg-danger'
        return card
      }
      if (normalized_status === 'ejecutandose') {
        card.status_text = 'En ejecución'
        card.badge_class = 'bg-warning text-dark'
        return card
      }
      if (normalized_status === 'exitoso') {
        card.status_text = 'Exitoso'
        card.badge_class = 'bg-success'
        return card
      }
      if (normalized_status === 'fallido') {
        card.status_text = 'Fallido'
        card.badge_class = 'bg-danger'
        return card
      }
      return card
    },
    /**
     * Actualiza store y padre con el modelo devuelto por el backend.
     * @param {Object} model lead actualizado.
     * @returns {void}
     */
    sync_model(model) {
      this.$store.dispatch('lead/upsert_model_in_lists', model)
      this.$emit('record-updated', model)
    },
    /**
     * Ejecuta una acción remota del lead con manejo uniforme de estado/errores.
     * @param {string} action_name nombre de acción para spinner.
     * @param {Function} callback función que retorna promise con modelo.
     * @param {string} success_message mensaje de éxito.
     * @returns {void}
     */
    run_action(action_name, callback, success_message) {
      const self = this
      self.loading_action = action_name
      callback()
        .then(function (model) {
          self.sync_model(model)
          self.open_feedback(success_message)
        })
        .catch(function (error) {
          /** Muchas acciones devuelven 422 con `model` actualizado (p. ej. mail fallido o setup fallido). */
          var payload = error && error.response && error.response.data ? error.response.data : null
          if (payload && payload.model) {
            self.sync_model(payload.model)
          }
          self.open_feedback(self.get_error_message(error))
        })
        .then(function () {
          self.loading_action = ''
        })
    },
    /**
     * Envía el mail de presentación del lead.
     * @returns {void}
     */
    send_presentation_mail() {
      const self = this
      self.run_action(
        'presentation',
        function () {
          return self.$store.dispatch('lead/send_presentation_mail', self.record.id)
        },
        'Mail de presentación enviado.'
      )
    },
    /**
     * Envía el mail de seguimiento del lead.
     * @returns {void}
     */
    send_followup_mail() {
      const self = this
      self.run_action(
        'followup',
        function () {
          return self.$store.dispatch('lead/send_followup_mail', self.record.id)
        },
        'Mail de seguimiento enviado.'
      )
    },
    /**
     * Envía el "Mail 1 - DEMO" al prospecto con su acceso y horario de demo.
     * Valida localmente los campos obligatorios antes de llamar al backend.
     * @returns {void}
     */
    send_demo_mail() {
      const self = this
      /** Mensaje de validación local: si hay campos faltantes se interrumpe. */
      const validation_message = self.demo_mail_validation_message
      if (validation_message) {
        self.open_feedback(validation_message)
        return
      }
      self.run_action(
        'demo_mail',
        function () {
          return self.$store.dispatch('lead/send_demo_mail', self.record.id)
        },
        'Mail 1 - DEMO enviado correctamente.'
      )
    },
    /**
     * Ejecuta el demo setup remoto.
     * @returns {void}
     */
    run_demo_setup() {
      const self = this
      self.run_action(
        'demo',
        function () {
          return self.$store.dispatch('lead/run_demo_setup', self.record.id)
        },
        'Demo setup ejecutado.'
      )
    },
    /**
     * Promueve el lead a cliente usando la URL ingresada.
     * @returns {void}
     */
    promote_lead() {
      const self = this
      /**
       * URL normalizada de promoción para evitar espacios en blanco.
       */
      const api_url = (self.promotion_api_url || '').trim()
      if (!api_url) {
        self.open_feedback('Debés ingresar la URL del sistema.')
        return
      }
      self.run_action(
        'promote',
        function () {
          return self.$store.dispatch('lead/promote_lead', { lead_id: self.record.id, api_url })
        },
        'Lead promovido correctamente.'
      )
    },

    /**
     * Primer paso de la promoción: pide subdominio sugerido a la API y muestra el panel de confirmación.
     * Llama a POST /client/suggest-subdomain con el company_name del lead.
     * @returns {void}
     */
    request_promote_to_client() {
      const self = this
      if (!self.can_promote_to_client) {
        self.open_feedback(self.promote_to_client_title || 'No se puede promover en este momento.')
        return
      }

      /* Nombre de empresa del lead para la sugerencia. */
      var company_name = (self.record.company_name || self.record.contact_name || '').trim()

      /* Mostrar spinner en el botón mientras se consulta Claude. */
      self.loading_action = 'fetching_subdomain'

      api.post('/client/suggest-subdomain', { company_name })
        .then(function (res) {
          /* Claude respondió: mostrar su sugerencia en el input editable. */
          self.subdomain_preview = (res.data.subdomain || '').trim()
          self.showing_subdomain_confirm = true
        })
        .catch(function () {
          /* Si la API falla, usar un slug simple del nombre como fallback local. */
          var fallback = company_name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 20)
          self.subdomain_preview = fallback || 'cliente'
          self.showing_subdomain_confirm = true
        })
        .then(function () {
          self.loading_action = ''
        })
    },

    /**
     * Segundo paso: confirma la promoción enviando el subdominio editado al backend.
     * @returns {void}
     */
    confirm_promote_to_client() {
      const self = this
      var subdomain = (self.subdomain_preview || '').trim()
      if (!subdomain) {
        self.open_feedback('El subdominio no puede estar vacío.')
        return
      }

      self.run_action(
        'promote_to_client',
        function () {
          return self.$store.dispatch('lead/promote_to_client', {
            lead_id:            self.record.id,
            suggested_subdomain: subdomain,
          })
        },
        'Lead promovido a cliente. Se crearon las tareas automáticas para el equipo.'
      )
      /* Ocultar el panel de confirmación una vez iniciada la acción. */
      self.showing_subdomain_confirm = false
    },

    /**
     * Cancela el panel de confirmación de subdominio y resetea el estado.
     * @returns {void}
     */
    cancel_subdomain_confirm() {
      this.showing_subdomain_confirm = false
      this.subdomain_preview = ''
    },

    /**
     * Ejecuta el user setup del sistema real.
     * @returns {void}
     */
    run_user_setup() {
      const self = this
      if (!self.can_run_user_setup) {
        if (!self.record.promoted_client_id) {
          self.open_feedback('Primero promové el lead a cliente.')
          return
        }
        self.open_feedback('Cargá la API URL en el perfil del cliente (Clientes) antes de ejecutar user setup.')
        return
      }
      self.run_action(
        'user_setup',
        function () {
          return self.$store.dispatch('lead/run_user_setup', self.record.id)
        },
        'User setup ejecutado.'
      )
    },
  },
}
</script>
