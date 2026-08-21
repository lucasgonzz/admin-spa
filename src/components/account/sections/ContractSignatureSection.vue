<template>
  <div class="contract-signature-section">
    <p class="text-muted small mb-3">
      Esta es la firma del PRESTADOR que se estampa sobre la línea de firma del PDF de contrato.
      Se carga una sola vez y sale en cada contrato que generes, salvo que destildes la casilla
      al generarlo.
    </p>

    <p v-if="cargando" class="text-muted small mb-0">Cargando…</p>

    <div v-else>
      <!-- Estado actual + vista previa -->
      <div class="mb-3">
        <div v-if="estado.cargada" class="d-flex flex-wrap align-items-start gap-3">
          <!--
            El fondo a cuadros no es adorno: es lo único que muestra de un vistazo si el archivo
            tiene fondo transparente o si es un JPG con fondo blanco. Ese recuadro blanco en el
            PDF tapa la línea de firma del contrato, y sin este fondo no se nota hasta generarlo.
          -->
          <div class="firma-preview border rounded">
            <img
              v-if="preview_url"
              :src="preview_url"
              alt="Vista previa de la firma del prestador"
              class="firma-preview__img" />
            <span v-else class="text-muted small">Sin vista previa</span>
          </div>

          <div class="small text-muted">
            <div>
              <span class="badge bg-success">Cargada</span>
            </div>
            <div class="mt-1">{{ estado.ancho }} × {{ estado.alto }} px · {{ estado.bytes }} bytes</div>
            <div v-if="estado.actualizada_en">Actualizada el {{ formato_fecha(estado.actualizada_en) }}</div>
            <button
              type="button"
              class="btn btn-outline-danger btn-sm mt-2"
              :disabled="subiendo || borrando"
              @click="borrar">
              {{ borrando ? 'Borrando…' : 'Borrar firma' }}
            </button>
          </div>
        </div>

        <div v-else class="alert alert-warning py-2 small mb-0">
          Todavía no hay ninguna firma cargada. Los contratos salen con la línea vacía, igual que siempre.
        </div>
      </div>

      <!-- Subida de una firma nueva (o reemplazo de la actual) -->
      <div class="row g-2 align-items-end">
        <div class="col-sm-7">
          <label class="form-label small" for="contract_signature_file">
            {{ estado.cargada ? 'Reemplazar la firma' : 'Subir la firma' }}
          </label>
          <input
            id="contract_signature_file"
            ref="archivo_input"
            type="file"
            accept="image/png,image/jpeg"
            class="form-control form-control-sm"
            :disabled="subiendo || borrando"
            @change="on_archivo_change" />
        </div>
        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="subiendo || borrando || !archivo"
            @click="subir">
            {{ subiendo ? 'Subiendo…' : 'Subir firma' }}
          </button>
        </div>
      </div>

      <div class="form-text">
        Lo mejor es un PNG con fondo transparente. El JPG se acepta, pero no tiene transparencia:
        deja un recuadro blanco que en el PDF tapa la línea de firma. Máximo 2 MB.
      </div>

      <p v-if="mensaje" class="text-success small mt-2 mb-0">{{ mensaje }}</p>
      <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Sección en Cuenta: firma del PRESTADOR que se estampa en el PDF de contrato de los leads.
 *
 * Consume GET/POST/DELETE settings/contract-signature y GET settings/contract-signature/file.
 * La vista previa se arma con responseType 'blob' + URL.createObjectURL porque el endpoint del
 * archivo va con auth:sanctum: no se puede poner la URL derecho en un <img>, que iría sin el
 * header Authorization y volvería 401.
 */
export default {
  name: 'ContractSignatureSection',
  data() {
    return {
      /** Estado devuelto por GET settings/contract-signature. */
      estado: {
        cargada: false,
        actualizada_en: null,
        ancho: null,
        alto: null,
        bytes: null,
      },
      /** Carga inicial del estado. */
      cargando: true,
      /** POST multipart en curso. */
      subiendo: false,
      /** DELETE en curso. */
      borrando: false,
      /** Archivo elegido en el input, pendiente de subir (null = ninguno). */
      archivo: null,
      /** Object URL del blob de la vista previa (null = no hay). Hay que revocarlo a mano. */
      preview_url: null,
      /** Mensaje de éxito de la última operación. */
      mensaje: '',
      /** Error de validación o de API. */
      error_message: '',
    }
  },
  mounted() {
    this.cargar_estado()
  },
  beforeUnmount() {
    /* Sin esto el blob de la vista previa queda colgado en memoria hasta que se recargue la
       página entera: el navegador no libera un object URL solo porque el <img> desapareció. */
    this.set_preview_url(null)
  },
  methods: {
    /**
     * GET settings/contract-signature y, si hay firma cargada, trae también la vista previa.
     *
     * @returns {void}
     */
    cargar_estado() {
      const self = this
      self.cargando = true
      self.error_message = ''
      api
        .get('/settings/contract-signature')
        .then(function (res) {
          const data = res.data || {}
          self.estado = {
            cargada: !!data.cargada,
            actualizada_en: data.actualizada_en || null,
            ancho: data.ancho != null ? data.ancho : null,
            alto: data.alto != null ? data.alto : null,
            bytes: data.bytes != null ? data.bytes : null,
          }
          if (self.estado.cargada) {
            self.cargar_preview()
          } else {
            self.set_preview_url(null)
          }
        })
        .catch(function (error) {
          self.error_message = resolve_error_message(error)
        })
        .then(function () {
          self.cargando = false
        })
    },

    /**
     * GET settings/contract-signature/file como blob y arma el object URL de la vista previa.
     *
     * @returns {void}
     */
    cargar_preview() {
      const self = this
      api
        .get('/settings/contract-signature/file', { responseType: 'blob' })
        .then(function (res) {
          self.set_preview_url(window.URL.createObjectURL(res.data))
        })
        .catch(function () {
          /* La vista previa es un extra: si falla, el resto de la sección sigue usable y el
             interceptor de axios ya avisó por toast. No pisamos error_message acá para no tapar
             el mensaje de la operación que el usuario acaba de hacer. */
          self.set_preview_url(null)
        })
    },

    /**
     * Reemplaza el object URL de la vista previa revocando el anterior.
     *
     * @param {string|null} nueva_url Object URL nuevo, o null para dejar la sección sin preview.
     * @returns {void}
     */
    set_preview_url(nueva_url) {
      /* Se revoca ANTES de reemplazar: si solo se revocara al desmontar, cada firma nueva que se
         suba dejaría el blob de la anterior colgado en memoria durante toda la sesión. */
      if (this.preview_url) {
        window.URL.revokeObjectURL(this.preview_url)
      }
      this.preview_url = nueva_url
    },

    /**
     * Handler del input de archivo: deja el elegido pendiente de subir.
     *
     * @param {Event} event Evento `change` del `<input type="file">`.
     * @returns {void}
     */
    on_archivo_change(event) {
      /** Archivo elegido por el usuario (undefined si canceló el selector). */
      const elegido = event.target.files && event.target.files[0]
      this.archivo = elegido || null
      this.mensaje = ''
      this.error_message = ''
    },

    /**
     * POST multipart settings/contract-signature con el archivo elegido.
     *
     * @returns {void}
     */
    subir() {
      const self = this
      if (!self.archivo) {
        return
      }
      self.subiendo = true
      self.mensaje = ''
      self.error_message = ''

      /** FormData con el archivo bajo la clave `firma`, tal como espera el backend. */
      const form_data = new FormData()
      form_data.append('firma', self.archivo)

      api
        .post('/settings/contract-signature', form_data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(function () {
          self.archivo = null
          self.limpiar_input()
          /* Se relee el estado del servidor en vez de armarlo con la respuesta del POST: las
             medidas y los bytes los calcula el backend sobre el archivo ya guardado, que es la
             única fuente que no puede quedar desincronizada del disco. */
          self.cargar_estado()
          self.mensaje = 'Firma actualizada.'
        })
        .catch(function (error) {
          self.error_message = resolve_error_message(error)
        })
        .then(function () {
          self.subiendo = false
        })
    },

    /**
     * DELETE settings/contract-signature, con confirmación previa.
     *
     * @returns {void}
     */
    borrar() {
      const self = this
      if (!window.confirm('¿Borrar la firma? Los contratos nuevos van a salir con la línea vacía.')) {
        return
      }
      self.borrando = true
      self.mensaje = ''
      self.error_message = ''
      api
        .delete('/settings/contract-signature')
        .then(function () {
          self.set_preview_url(null)
          self.estado = {
            cargada: false,
            actualizada_en: null,
            ancho: null,
            alto: null,
            bytes: null,
          }
          self.archivo = null
          self.limpiar_input()
          self.mensaje = 'Firma borrada.'
        })
        .catch(function (error) {
          self.error_message = resolve_error_message(error)
        })
        .then(function () {
          self.borrando = false
        })
    },

    /**
     * Vacía el `<input type="file">` para que se pueda volver a elegir el mismo archivo.
     *
     * @returns {void}
     */
    limpiar_input() {
      if (this.$refs.archivo_input) {
        this.$refs.archivo_input.value = ''
      }
    },

    /**
     * Formatea una fecha ISO para mostrarla en es-AR.
     *
     * @param {string|null|undefined} iso
     * @returns {string}
     */
    formato_fecha(iso) {
      if (!iso) {
        return ''
      }
      const fecha = new Date(iso)
      if (isNaN(fecha.getTime())) {
        return ''
      }
      return fecha.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    },
  },
}
</script>

<style scoped>
/*
  Fondo a cuadros de la vista previa: dos gradientes de 45° desfasados media celda, que es la
  forma clásica de dibujar un damero sin imagen. Muestra la transparencia real del archivo —
  un JPG se ve como un rectángulo blanco tapando los cuadros, y eso es exactamente lo que va a
  hacer en el PDF sobre la línea de firma.
*/
.firma-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  min-height: 120px;
  padding: 0.5rem;
  background-color: #ffffff;
  background-image:
    linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%),
    linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}

.firma-preview__img {
  max-width: 100%;
  max-height: 160px;
  object-fit: contain;
}
</style>
