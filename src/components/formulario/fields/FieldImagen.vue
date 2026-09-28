<template>
  <!-- Campo de imagen: sube el archivo apenas se elige, sin esperar al submit del formulario -->
  <div class="field-imagen">
    <!-- Preview de la imagen ya cargada (si value trae una URL) -->
    <div v-if="value" class="field-imagen__preview-wrap">
      <img :src="value" alt="Logo cargado" class="field-imagen__preview" />
    </div>

    <input
      ref="input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="form-control field-imagen__input"
      :disabled="uploading"
      @change="on_file_change"
    />

    <!-- Estado de carga: sube en cuanto se elige el archivo -->
    <p v-if="uploading" class="field-imagen__status field-imagen__status--uploading">
      <span class="spinner-border spinner-border-sm me-2" role="status"></span>
      Subiendo...
    </p>

    <!-- Error de subida: se muestra pero no bloquea el resto del formulario -->
    <p v-if="error" class="field-imagen__status field-imagen__status--error">
      {{ error }}
    </p>
  </div>
</template>

<script>
import api_public from '@/utils/axios_public'

/**
 * Campo de imagen (usado hoy para el logo del negocio).
 *
 * A diferencia del resto de los Field*, no espera al autoguardado ni al submit del
 * formulario: sube el archivo de inmediato al elegirlo, vía POST
 * /form/implementation/{token}/logo (multipart/form-data), y recién al terminar emite
 * update:value con la URL pública que devuelve el backend — mismo contrato de evento
 * que el resto de los campos, para que FormularioSection no lo trate distinto.
 *
 * @prop {object} question - Definición de la pregunta.
 * @prop {string} value - URL pública de la imagen ya cargada, o '' si no hay ninguna.
 * @prop {string} token - Token del formulario (form_token), necesario para el endpoint de subida.
 * @emits update:value - Emite la URL pública devuelta por el backend al terminar de subir.
 */
export default {
  name: 'FieldImagen',

  props: {
    /**
     * Definición de la pregunta.
     */
    question: {
      type: Object,
      required: true,
    },

    /**
     * URL pública de la imagen ya cargada, o cadena vacía si todavía no se cargó ninguna.
     */
    value: {
      type: String,
      default: '',
    },

    /**
     * Token del formulario, para armar la URL del endpoint de subida.
     * No es obligatorio a nivel de prop (otras pantallas todavía no lo pasan), pero sin él
     * la subida no tiene a dónde ir: se avisa por el estado de error, no se rompe el resto.
     */
    token: {
      type: String,
      default: '',
    },
  },

  data() {
    return {
      /**
       * True mientras el archivo elegido se está subiendo al backend.
       */
      uploading: false,

      /**
       * Mensaje de error de la última subida, o null si no hubo ninguno.
       */
      error: null,
    }
  },

  methods: {
    /**
     * Handler del input de archivo: dispara la subida apenas el usuario elige uno.
     *
     * @param {Event} event - Evento `change` del `<input type="file">`.
     * @returns {void}
     */
    on_file_change(event) {
      const file = event.target.files && event.target.files[0]

      if (!file) {
        return
      }

      this.error = null
      this.upload_file(file)
    },

    /**
     * Sube el archivo elegido vía POST /form/implementation/{token}/logo (multipart/form-data)
     * y emite update:value con la URL pública que devuelve el backend.
     *
     * @param {File} file
     * @returns {void}
     */
    upload_file(file) {
      const self = this

      if (!self.token) {
        self.error = 'No se pudo subir la imagen: falta el token del formulario.'
        return
      }

      self.uploading = true

      const form_data = new FormData()
      form_data.append('logo', file)

      api_public
        .post('/form/implementation/' + self.token + '/logo', form_data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(function (res) {
          self.uploading = false
          self.$emit('update:value', (res.data && res.data.logo_url) || '')
        })
        .catch(function (err) {
          self.uploading = false
          const backend_message = err && err.response && err.response.data && err.response.data.message
          self.error = backend_message || 'No se pudo subir la imagen. Probá de nuevo.'

          /* Limpiar el input para permitir reintentar con el mismo archivo */
          if (self.$refs.input) {
            self.$refs.input.value = ''
          }
        })
    },
  },
}
</script>

<style scoped>
.field-imagen {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-imagen__preview-wrap {
  display: flex;
  justify-content: flex-start;
}

.field-imagen__preview {
  max-width: 180px;
  max-height: 180px;
  border-radius: 10px;
  border: 1px solid #dee2e6;
  object-fit: contain;
  background: #fff;
  padding: 6px;
}

.field-imagen__input {
  border-radius: 10px;
  border: 1px solid #dee2e6;
  font-size: 0.9rem;
}

.field-imagen__status {
  font-size: 0.85rem;
  margin: 0;
}

.field-imagen__status--uploading {
  color: #6c757d;
}

.field-imagen__status--error {
  color: #dc3545;
}
</style>
