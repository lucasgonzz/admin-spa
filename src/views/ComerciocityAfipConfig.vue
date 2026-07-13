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
  },

  mounted() {
    this.load_config()
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
  },
}
</script>
