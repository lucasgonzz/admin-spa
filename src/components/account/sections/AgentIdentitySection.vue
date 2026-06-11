<template>
  <div class="agent-identity-section">
    <!-- Estado: cargando datos iniciales -->
    <p v-if="loading" class="text-muted small mb-0">Cargando…</p>

    <!-- Formulario: visible una vez cargado -->
    <template v-else>
      <!-- Campo: nombre del agente -->
      <div class="mb-3">
        <label class="form-label small" for="agent_identity_name">Nombre del agente</label>
        <!-- Input de texto con el nombre visible del agente (ej: "Martín") -->
        <input
          id="agent_identity_name"
          v-model="local_name"
          type="text"
          class="form-control form-control-sm"
          maxlength="100"
          :disabled="saving"
        />
      </div>

      <!-- Campo: descripción del perfil del agente -->
      <div class="mb-3">
        <label class="form-label small" for="agent_identity_description">Descripción del perfil</label>
        <!-- Textarea con el perfil completo inyectado en el system prompt de Claude -->
        <textarea
          id="agent_identity_description"
          v-model="local_description"
          class="form-control form-control-sm"
          rows="6"
          :disabled="saving"
        />
      </div>

      <!-- Botón guardar: solo habilitado si hubo cambios respecto a los valores guardados -->
      <div class="d-flex align-items-center gap-2">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="saving || !can_save"
          @click="on_save"
        >
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>

      <!-- Mensajes de resultado inline -->
      <p v-if="saved_message" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
      <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Sección en Cuenta: identidad editable del agente Martín.
 *
 * Carga el nombre y descripción del agente desde GET /settings/agent-identity
 * y permite actualizarlos mediante PUT. Los cambios se inyectan automáticamente
 * en el system prompt de Claude al generar sugerencias de WhatsApp.
 */
export default {
  name: 'AgentIdentitySection',
  data() {
    return {
      /** Nombre editable del agente (ej: "Martín"). */
      local_name: '',
      /** Descripción editable del perfil del agente. */
      local_description: '',
      /** Nombre persistido en servidor (para detectar cambios). */
      stored_name: '',
      /** Descripción persistida en servidor (para detectar cambios). */
      stored_description: '',
      /** Carga inicial GET settings. */
      loading: true,
      /** PUT en curso. */
      saving: false,
      /** Mensaje de éxito tras guardar. */
      saved_message: '',
      /** Error de validación o API. */
      error_message: '',
    }
  },
  computed: {
    /**
     * Habilita el botón guardar solo si alguno de los campos cambió respecto al valor guardado.
     *
     * @returns {boolean}
     */
    can_save() {
      /* Verificar que los campos no estén vacíos y que haya algún cambio respecto al servidor. */
      var name_changed = this.local_name.trim() !== this.stored_name
      var description_changed = this.local_description.trim() !== this.stored_description
      return (
        this.local_name.trim() !== '' &&
        this.local_description.trim() !== '' &&
        (name_changed || description_changed)
      )
    },
  },
  mounted() {
    this.load_identity()
  },
  methods: {
    /**
     * GET /settings/agent-identity — carga nombre y descripción del agente activo.
     *
     * @returns {void}
     */
    load_identity() {
      var self = this
      self.loading = true
      self.error_message = ''
      api
        .get('/settings/agent-identity')
        .then(function (res) {
          /* Poblar campos locales y almacenar los valores de referencia del servidor. */
          self.local_name = res.data.name || ''
          self.local_description = res.data.description || ''
          self.stored_name = res.data.name || ''
          self.stored_description = res.data.description || ''
        })
        .catch(function () {
          self.error_message = 'No se pudo cargar la identidad del agente.'
        })
        .then(function () {
          self.loading = false
        })
    },
    /**
     * PUT /settings/agent-identity — persiste nombre y descripción editados.
     *
     * @returns {void}
     */
    on_save() {
      var self = this
      if (!self.can_save) {
        return
      }
      self.saving = true
      self.saved_message = ''
      self.error_message = ''
      api
        .put('/settings/agent-identity', {
          name: self.local_name.trim(),
          description: self.local_description.trim(),
        })
        .then(function (res) {
          /* Actualizar los valores de referencia para que can_save vuelva a false. */
          self.stored_name = res.data.name || ''
          self.stored_description = res.data.description || ''
          self.local_name = res.data.name || ''
          self.local_description = res.data.description || ''
          self.saved_message = 'Identidad del agente guardada.'
        })
        .catch(function (err) {
          /* Mostrar mensaje del servidor si está disponible, o genérico. */
          var msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar la identidad del agente.'
          self.error_message = msg
        })
        .then(function () {
          self.saving = false
        })
    },
  },
}
</script>
