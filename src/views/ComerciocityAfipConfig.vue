<template>
  <div class="container-fluid px-0 py-4" style="max-width: 720px">
    <h2 class="h4 mb-4">Configuración fiscal</h2>

    <!-- Indicador de carga inicial -->
    <div v-if="loading" class="text-center py-5">
      <span class="spinner-border text-primary" role="status" aria-hidden="true" />
      <p class="text-muted mt-2">Cargando configuración...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger">
      {{ load_error }}
    </div>

    <!-- Formulario principal: datos fiscales que consume la facturación de ComercioCity -->
    <div v-else class="card">
      <div class="card-body">
        <div class="row g-3">
          <!-- Condición IVA: único select validado por el backend (Monotributista / Responsable inscripto) -->
          <div class="col-md-6">
            <label class="form-label small mb-1 fw-semibold">Condición IVA</label>
            <select v-model="form.condicion_iva" class="form-select">
              <option value="Monotributista">Monotributista</option>
              <option value="Responsable inscripto">Responsable inscripto</option>
            </select>
          </div>

          <!-- Punto de venta: el que Lucas crea en su portal de AFIP para Web Services -->
          <div class="col-md-6">
            <label class="form-label small mb-1 fw-semibold">Punto de venta</label>
            <input
              v-model.number="form.punto_venta"
              type="number"
              min="1"
              class="form-control"
              placeholder="Ej: 1"
            />
          </div>

          <!-- CUIT del emisor -->
          <div class="col-md-6">
            <label class="form-label small mb-1 fw-semibold">CUIT</label>
            <input v-model="form.cuit" type="text" class="form-control" placeholder="20-12345678-9" />
          </div>

          <!-- Razón social -->
          <div class="col-md-6">
            <label class="form-label small mb-1 fw-semibold">Razón social</label>
            <input v-model="form.razon_social" type="text" class="form-control" />
          </div>

          <!-- Domicilio comercial -->
          <div class="col-12">
            <label class="form-label small mb-1 fw-semibold">Domicilio comercial</label>
            <input v-model="form.domicilio_comercial" type="text" class="form-control" />
          </div>

          <!-- Ingresos brutos -->
          <div class="col-md-6">
            <label class="form-label small mb-1 fw-semibold">Ingresos brutos</label>
            <input v-model="form.ingresos_brutos" type="text" class="form-control" />
          </div>

          <!-- Inicio de actividades -->
          <div class="col-md-6">
            <label class="form-label small mb-1 fw-semibold">Inicio de actividades</label>
            <input v-model="form.inicio_actividades" type="date" class="form-control" />
          </div>

          <!-- Toggle de entorno AFIP: producción (on) vs homologación (off, para pruebas) -->
          <div class="col-12">
            <div class="form-check form-switch">
              <input
                id="afip-produccion"
                v-model="form.afip_produccion"
                class="form-check-input"
                type="checkbox"
              />
              <label class="form-check-label fw-semibold" for="afip-produccion">
                {{ form.afip_produccion ? 'Producción' : 'Homologación' }}
              </label>
            </div>
            <div class="form-text">
              Homologación es el ambiente de pruebas de AFIP: las facturas emitidas ahí no tienen validez fiscal.
              Activar "Producción" solo cuando los datos estén confirmados.
            </div>
          </div>

          <!-- Logo de la factura de mensualidad: preview + subida de un archivo nuevo -->
          <div class="col-12">
            <label class="form-label small mb-1 fw-semibold">Logo de factura</label>
            <div class="d-flex align-items-center gap-3">
              <!-- Preview del logo actual (o el default si nunca se subió uno propio) -->
              <img
                v-if="!logo_load_error"
                :src="logo_preview_url"
                alt="Logo de factura"
                style="width: 120px; height: 120px; object-fit: contain"
                class="border rounded"
                @error="logo_load_error = true"
              />
              <!-- Placeholder cuando ni siquiera el logo default existe -->
              <div
                v-else
                class="border rounded d-flex align-items-center justify-content-center text-muted small"
                style="width: 120px; height: 120px"
              >
                Sin logo
              </div>

              <div>
                <input
                  ref="logo_input"
                  type="file"
                  accept="image/png,image/jpeg"
                  class="form-control form-control-sm mb-2"
                  @change="on_logo_file_change"
                />
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  :disabled="subiendo_logo || !logo_file"
                  @click="upload_logo"
                >
                  {{ subiendo_logo ? 'Subiendo...' : 'Subir logo' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-end mt-4">
          <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!--
      Certificados de AFIP. No son solo los de ComercioCity: son los que se instalan en el
      servidor de cada cliente cuando se instala o se actualiza su sistema, así que si acá
      falta alguno, hay clientes que no pueden facturar.
    -->
    <div v-if="!loading && !load_error" class="card mt-4">
      <div class="card-body">
        <h3 class="h6 fw-semibold mb-1">Certificados de AFIP</h3>
        <p class="form-text mt-0 mb-3">
          Son los mismos que usa ComercioCity para facturar sus mensualidades. Se instalan solos en el
          servidor de cada cliente al instalar o actualizar su sistema, y nunca pisan uno que el cliente
          ya tenga. Se guardan fuera del directorio público: no son descargables por web.
        </p>

        <div v-if="cargando_certificados" class="text-muted small py-2">
          Cargando estado de los certificados...
        </div>

        <div v-else>
          <div v-if="faltan_certificados" class="alert alert-warning py-2 small">
            Falta cargar {{ cantidad_faltantes }} de 4. Mientras tanto, las instalaciones nuevas van a
            fallar en la verificación final y los clientes que actualicen no van a recibirlos.
          </div>

          <div v-for="certificado in certificados" :key="certificado.clave" class="border rounded p-3 mb-2">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div class="fw-semibold small">{{ certificado.etiqueta }}</div>
                <code class="text-muted" style="font-size: 0.75rem">{{ certificado.destino }}</code>
              </div>
              <span class="badge" :class="certificado.cargado ? 'bg-success' : 'bg-danger'">
                {{ certificado.cargado ? 'Cargado' : 'Falta' }}
              </span>
            </div>

            <div v-if="certificado.cargado" class="text-muted mt-1" style="font-size: 0.75rem">
              {{ certificado.bytes }} bytes · actualizado el {{ formato_fecha(certificado.modificado_at) }}
            </div>

            <input
              type="file"
              class="form-control form-control-sm mt-2"
              @change="on_certificado_file_change(certificado.clave, $event)"
            />
          </div>

          <div class="d-flex justify-content-end mt-3">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              :disabled="subiendo_certificados || !hay_certificados_elegidos"
              @click="upload_certificados"
            >
              {{ subiendo_certificados ? 'Subiendo...' : 'Subir certificados' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api, { admin_api_origin } from '@/utils/axios'

/**
 * Vista de configuración fiscal (AFIP) propia de ComercioCity.
 *
 * Es una única fila global (no por cliente): guarda los datos que consumen los
 * servicios de facturación (AfipWsaaService / AfipWsfeService / AfipFacturacionService)
 * para que ComercioCity pueda emitir sus propias facturas de mensualidad.
 * Consume GET/PUT admin/comerciocity-afip-config.
 */
export default {
  name: 'ViewComerciocityAfipConfig',

  data() {
    return {
      /** Campos del formulario, precargados desde el backend al montar. */
      form: {
        condicion_iva: 'Monotributista',
        punto_venta: null,
        cuit: '',
        razon_social: '',
        domicilio_comercial: '',
        ingresos_brutos: '',
        inicio_actividades: '',
        afip_produccion: false,
        /** Ruta pública del logo actual (servida por admin-api fuera de /api/admin). */
        logo_path: '',
      },

      /** true mientras se carga la configuración inicial desde el backend. */
      loading: false,

      /** Mensaje de error si falla la carga inicial (null = sin error). */
      load_error: null,

      /** true mientras se ejecuta el guardado. */
      saving: false,

      /** true mientras se sube el logo nuevo al backend. */
      subiendo_logo: false,

      /** Timestamp (Date.now()) de la última subida exitosa; cache-busting del preview del logo. */
      logo_updated_at: null,

      /** Archivo elegido en el input de logo, pendiente de subir (null = ninguno seleccionado). */
      logo_file: null,

      /** true si el <img> del preview de logo falló al cargar (ni el logo default existe). */
      logo_load_error: false,

      /**
       * Estado de los cuatro certificados de AFIP en el servidor del admin, tal como lo devuelve
       * GET /comerciocity-afip-config/certificados: clave, etiqueta, destino, cargado, bytes,
       * modificado_at.
       */
      certificados: [],

      /** true mientras se consulta el estado de los certificados. */
      cargando_certificados: false,

      /** Archivos elegidos pendientes de subir, por clave ({ cert_production: File, ... }). */
      certificados_elegidos: {},

      /** true mientras se suben los certificados elegidos. */
      subiendo_certificados: false,
    }
  },

  computed: {
    /**
     * URL absoluta (o relativa al mismo origen) del preview del logo actual, con cache-busting
     * vía query param `?v=` para que el navegador no siga mostrando el logo viejo después de
     * subir uno nuevo con el mismo nombre de archivo.
     *
     * @returns {string}
     */
    logo_preview_url() {
      /** Ruta pública del logo (default si la config todavía no tiene uno propio). */
      const path = this.form.logo_path || '/afip/logo.jpg'
      return admin_api_origin() + path + '?v=' + (this.logo_updated_at || '')
    },

    /**
     * Cantidad de certificados que todavía no están cargados en el servidor del admin.
     *
     * @returns {number}
     */
    cantidad_faltantes() {
      return this.certificados.filter(function (certificado) {
        return !certificado.cargado
      }).length
    },

    /**
     * true si falta cargar al menos uno de los cuatro.
     *
     * @returns {boolean}
     */
    faltan_certificados() {
      return this.cantidad_faltantes > 0
    },

    /**
     * true si hay al menos un archivo elegido pendiente de subir.
     *
     * @returns {boolean}
     */
    hay_certificados_elegidos() {
      return Object.keys(this.certificados_elegidos).length > 0
    },
  },

  mounted() {
    this.load_config()
    this.load_certificados()
  },

  methods: {
    /**
     * Carga la configuración fiscal actual desde el backend y precarga el formulario.
     *
     * @returns {void}
     */
    load_config() {
      const self = this
      self.loading = true
      self.load_error = null

      api.get('/comerciocity-afip-config').then(function (res) {
        const config = res.data || {}
        self.form = {
          condicion_iva: config.condicion_iva || 'Monotributista',
          punto_venta: config.punto_venta ?? null,
          cuit: config.cuit || '',
          razon_social: config.razon_social || '',
          domicilio_comercial: config.domicilio_comercial || '',
          ingresos_brutos: config.ingresos_brutos || '',
          /* La fecha viene en formato ISO (con hora); nos quedamos solo con la parte de fecha para el input type=date. */
          inicio_actividades: config.inicio_actividades ? String(config.inicio_actividades).slice(0, 10) : '',
          afip_produccion: !!config.afip_produccion,
          logo_path: config.logo_path || '',
        }
        /* Nueva carga de config: reseteamos el flag de error de imagen para reintentar el preview. */
        self.logo_load_error = false
        self.loading = false
      }).catch(function () {
        self.load_error = 'No se pudo cargar la configuración fiscal. Intentá de nuevo.'
        self.loading = false
      })
    },

    /**
     * Envía el formulario al backend vía PUT /comerciocity-afip-config.
     * Muestra un toast de éxito o error según corresponda.
     *
     * @returns {void}
     */
    save() {
      const self = this
      self.saving = true

      api.put('/comerciocity-afip-config', self.form).then(function (res) {
        const config = res.data || {}
        self.form = {
          condicion_iva: config.condicion_iva || 'Monotributista',
          punto_venta: config.punto_venta ?? null,
          cuit: config.cuit || '',
          razon_social: config.razon_social || '',
          domicilio_comercial: config.domicilio_comercial || '',
          ingresos_brutos: config.ingresos_brutos || '',
          inicio_actividades: config.inicio_actividades ? String(config.inicio_actividades).slice(0, 10) : '',
          afip_produccion: !!config.afip_produccion,
          logo_path: config.logo_path || '',
        }
        self.saving = false

        /* Notifica al usuario con toast de éxito, siguiendo el patrón usado en EnvTemplate. */
        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: { message: 'Configuración fiscal guardada correctamente.', variant: 'success' },
        }))
      }).catch(function () {
        self.saving = false

        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: { message: 'No se pudo guardar la configuración fiscal.', variant: 'danger' },
        }))
      })
    },

    /**
     * Handler del input de archivo del logo: guarda el archivo elegido en `logo_file`
     * para que quede pendiente de subir con el botón "Subir logo".
     *
     * @param {Event} event - Evento `change` del `<input type="file">`.
     * @returns {void}
     */
    on_logo_file_change(event) {
      /** Archivo elegido por el usuario (undefined si canceló el selector). */
      const selected_file = event.target.files && event.target.files[0]
      this.logo_file = selected_file || null
    },

    /**
     * Sube el archivo elegido en `logo_file` vía POST /comerciocity-afip-config/logo
     * (multipart/form-data). Al terminar OK, actualiza el preview (logo_path + cache-busting)
     * y muestra un toast de éxito; al fallar, muestra un toast de error.
     *
     * @returns {void}
     */
    upload_logo() {
      if (!this.logo_file) {
        return
      }
      const self = this
      self.subiendo_logo = true

      /** FormData con el archivo de logo bajo la clave `logo`, tal como espera el backend. */
      const form_data = new FormData()
      form_data.append('logo', self.logo_file)

      api.post('/comerciocity-afip-config/logo', form_data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(function (res) {
        const config = res.data || {}
        self.form.logo_path = config.logo_path || self.form.logo_path
        /* Cache-busting: fuerza al navegador a recargar el <img> aunque el nombre de archivo no cambie. */
        self.logo_updated_at = Date.now()
        self.logo_load_error = false
        self.subiendo_logo = false
        self.logo_file = null
        if (self.$refs.logo_input) {
          self.$refs.logo_input.value = ''
        }

        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: { message: 'Logo actualizado correctamente.', variant: 'success' },
        }))
      }).catch(function () {
        self.subiendo_logo = false

        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: { message: 'No se pudo subir el logo.', variant: 'danger' },
        }))
      })
    },

    /**
     * Trae el estado de los cuatro certificados de AFIP desde el backend.
     *
     * @returns {void}
     */
    load_certificados() {
      const self = this
      self.cargando_certificados = true

      api.get('/comerciocity-afip-config/certificados').then(function (res) {
        self.certificados = (res.data && res.data.archivos) || []
        self.cargando_certificados = false
      }).catch(function () {
        self.certificados = []
        self.cargando_certificados = false

        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: { message: 'No se pudo leer el estado de los certificados de AFIP.', variant: 'danger' },
        }))
      })
    },

    /**
     * Handler del input de archivo de un certificado: lo deja pendiente de subir bajo su clave.
     * Si el usuario cancela el selector, saca la clave de los pendientes.
     *
     * @param {string} clave - Clave del certificado (cert_production, key_production, ...).
     * @param {Event} event - Evento `change` del `<input type="file">`.
     * @returns {void}
     */
    on_certificado_file_change(clave, event) {
      /** Archivo elegido por el usuario (undefined si canceló el selector). */
      const selected_file = event.target.files && event.target.files[0]

      if (selected_file) {
        this.certificados_elegidos[clave] = selected_file
      } else {
        delete this.certificados_elegidos[clave]
      }
    },

    /**
     * Sube todos los certificados elegidos en un solo POST multipart. El backend acepta de a uno
     * o los cuatro juntos, y devuelve el estado actualizado para refrescar la lista sin recargar.
     *
     * @returns {void}
     */
    upload_certificados() {
      if (!this.hay_certificados_elegidos) {
        return
      }

      const self = this
      self.subiendo_certificados = true

      /** FormData con cada archivo bajo su clave, tal como espera el backend. */
      const form_data = new FormData()
      Object.keys(self.certificados_elegidos).forEach(function (clave) {
        form_data.append(clave, self.certificados_elegidos[clave])
      })

      api.post('/comerciocity-afip-config/certificados', form_data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(function (res) {
        self.certificados = (res.data && res.data.archivos) || self.certificados
        self.certificados_elegidos = {}
        self.subiendo_certificados = false
        self.limpiar_inputs_de_certificados()

        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: { message: 'Certificados de AFIP actualizados.', variant: 'success' },
        }))
      }).catch(function (error) {
        self.subiendo_certificados = false

        /* El backend devuelve 422 con `rechazados` cuando un archivo no tiene forma de PEM: ese
           detalle es el que le sirve al usuario para saber qué archivo eligió mal. */
        const data = (error.response && error.response.data) || {}
        if (data.archivos) {
          self.certificados = data.archivos
        }

        const rechazados = data.rechazados || {}
        const claves_rechazadas = Object.keys(rechazados)
        const mensaje = claves_rechazadas.length > 0
          ? 'No se guardaron: ' + claves_rechazadas.join(', ') + '. ' + rechazados[claves_rechazadas[0]]
          : 'No se pudieron subir los certificados de AFIP.'

        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: { message: mensaje, variant: 'danger' },
        }))
      })
    },

    /**
     * Vacía los `<input type="file">` de los certificados después de una subida, para que no
     * quede el nombre del archivo viejo colgado en pantalla.
     *
     * @returns {void}
     */
    limpiar_inputs_de_certificados() {
      const inputs = this.$el ? this.$el.querySelectorAll('input[type="file"]') : []
      inputs.forEach(function (input) {
        input.value = ''
      })
    },

    /**
     * Formatea una fecha ISO a dd/mm/aaaa hh:mm para mostrarla en la lista de certificados.
     *
     * @param {string|null} iso - Fecha en formato ISO 8601.
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
