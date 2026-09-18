<template>
  <div class="p-3 client-contract-tab">
    <!-- Sin cliente guardado todavía: no hay id al que pedirle el contrato -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para gestionar su contrato.
    </p>

    <div v-else-if="loading" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando contrato...</p>
    </div>

    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <template v-else>
      <!-- Origen del contrato: si se copió del lead al promoverlo (o con el backfill), se dice
           de cuál y cuándo; si el cliente no tiene nada cargado, se avisa para que no se genere
           un PDF vacío creyendo que el contrato existe. -->
      <div v-if="form.contract_copiado_desde_lead_at" class="alert alert-light border mb-3">
        <p class="small text-muted mb-0">
          <i class="bi bi-arrow-return-right me-1"></i>
          Copiado del lead <strong v-if="lead_id">#{{ lead_id }}</strong><span v-else>de origen</span>
          el {{ formatear_fecha(form.contract_copiado_desde_lead_at) }}.
          Los cambios que hagas acá quedan en el cliente; el lead no se toca.
        </p>
      </div>
      <div v-else-if="!tiene_contrato" class="alert alert-warning py-2 small mb-3">
        Este cliente no tiene contrato cargado. Completá los datos y guardalos, o generá el PDF una vez cargados.
      </div>
      <div v-else class="alert alert-light border mb-3">
        <p class="small text-muted mb-0">
          Completá los datos del contrato y guardalos en el cliente. Luego podés generar y descargar el PDF.
        </p>
      </div>

      <h6 class="text-primary mb-2">Datos del cliente</h6>
      <div class="alert alert-light border mb-3">
        <div class="row g-2">
          <div class="col-md-4">
            <label class="form-label">Nombre comercial / empresa</label>
            <input v-model="form.contract_client_name" type="text" class="form-control" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Razón social</label>
            <input v-model="form.contract_client_razon_social" type="text" class="form-control" />
          </div>
          <div class="col-md-4">
            <label class="form-label">CUIT</label>
            <input v-model="form.contract_client_cuit" type="text" class="form-control" />
          </div>
        </div>
      </div>

      <h6 class="text-primary mb-2">Pago único</h6>
      <div class="alert alert-light border mb-3">
        <div class="row g-2">
          <div class="col-md-3">
            <label class="form-label">Moneda</label>
            <select v-model="form.contract_currency" class="form-select">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Precio total (licencia + implementación)</label>
            <input v-model="form.contract_precio_licencia" type="text" class="form-control" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Fecha de emisión</label>
            <input v-model="form.contract_fecha_emision" type="date" class="form-control" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Fecha primer pago</label>
            <input v-model="form.contract_fecha_primer_pago_unico" type="date" class="form-control" />
          </div>
        </div>
      </div>

      <h6 class="text-primary mb-2">Financiación (cuotas)</h6>
      <div class="alert alert-light border mb-3">
        <div
          v-for="(cuota, cuota_index) in form.contract_financiacion"
          :key="'cuota-' + cuota_index"
          class="row g-2 align-items-end mb-2"
        >
          <div class="col-md-5">
            <label class="form-label">Importe</label>
            <input v-model="cuota.monto" type="text" class="form-control" />
          </div>
          <div class="col-md-5">
            <label class="form-label">Fecha de vencimiento</label>
            <input v-model="cuota.fecha" type="date" class="form-control" />
          </div>
          <div class="col-md-2 d-flex">
            <button
              type="button"
              class="btn btn-outline-danger btn-sm w-100"
              title="Eliminar cuota"
              @click="remove_cuota(cuota_index)"
            >
              ×
            </button>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-primary" @click="add_cuota">
          Agregar cuota
        </button>
        <p class="small text-muted mb-0 mt-2">
          Las cuotas de la licencia que efectivamente se cobran se gestionan en la pestaña Licencias;
          esto es lo que dice el contrato.
        </p>
      </div>

      <h6 class="text-primary mb-2">Mensualidad</h6>
      <div class="alert alert-light border mb-3">
        <div class="row g-2">
          <div class="col-md-3">
            <label class="form-label">Moneda mensualidad</label>
            <select v-model="form.contract_mensualidad_moneda" class="form-select">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Mensualidad base</label>
            <input v-model="form.contract_mensualidad_base" type="text" class="form-control" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Usuarios incluidos en la base</label>
            <input v-model.number="form.contract_usuarios_incluidos" type="number" min="0" class="form-control" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Usuarios adicionales</label>
            <input v-model.number="form.contract_usuarios_extra" type="number" min="0" class="form-control" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Precio por usuario extra</label>
            <input v-model="form.contract_precio_usuario_extra" type="text" class="form-control" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Perfiles de ecommerce</label>
            <input v-model.number="form.contract_perfiles_ecommerce" type="number" min="0" class="form-control" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Precio por perfil de ecommerce</label>
            <input v-model="form.contract_precio_perfil_ecommerce" type="text" class="form-control" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Fecha primer pago mensual</label>
            <input v-model="form.contract_fecha_primer_pago_mensual" type="date" class="form-control" />
          </div>
          <!-- Cada cuántos meses se actualiza el precio (IPC). Sale en el PDF y es el N con el
               que la pestaña Mensualidad y el módulo Cobranzas calculan la próxima actualización
               oficial. -->
          <div class="col-md-4">
            <label class="form-label">Meses entre actualizaciones de precio (IPC)</label>
            <input v-model.number="form.contract_meses_actualizacion" type="number" min="1" max="60" step="1" class="form-control" />
          </div>
        </div>
      </div>

      <h6 class="text-primary mb-2">Cláusulas particulares</h6>
      <div class="alert alert-light border mb-3">
        <p class="small text-muted">
          Salen en el contrato como sección 8, numeradas, y aclarando que prevalecen sobre las
          condiciones generales. Si no cargás ninguna, el contrato sale igual que siempre.
        </p>
        <div
          v-for="(clausula, clausula_index) in form.contract_clausulas_particulares"
          :key="'clausula-' + clausula_index"
          class="row g-2 align-items-start mb-3"
        >
          <div class="col-md-11">
            <label class="form-label">Título (opcional)</label>
            <input v-model="clausula.titulo" type="text" class="form-control mb-2" />
            <label class="form-label">Texto de la cláusula</label>
            <textarea v-model="clausula.texto" rows="6" class="form-control"></textarea>
          </div>
          <div class="col-md-1 d-flex">
            <button
              type="button"
              class="btn btn-outline-danger btn-sm w-100"
              title="Eliminar cláusula"
              @click="remove_clausula(clausula_index)"
            >
              ×
            </button>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-primary" @click="add_clausula">
          Agregar cláusula
        </button>
        <select
          v-model="clausula_template_key"
          class="form-select form-select-sm d-inline-block w-auto ms-2"
          @change="add_clausula_from_template"
        >
          <option value="">Agregar desde biblioteca...</option>
          <option
            v-for="template in clause_templates"
            :key="template.key"
            :value="template.key"
          >
            {{ template.label }}
          </option>
        </select>
      </div>

      <!-- El id va atado a record.id: la pestaña se monta por cliente, y dos labels con el mismo
           `for` en el DOM hacen que el click en una tilde la casilla de la otra. -->
      <div class="form-check mb-2">
        <input
          :id="'incluir_firma_cliente_' + record.id"
          v-model="incluir_firma"
          class="form-check-input"
          type="checkbox"
        />
        <label class="form-check-label" :for="'incluir_firma_cliente_' + record.id">
          Incluir mi firma en el PDF
        </label>
      </div>

      <div class="d-flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading_save || loading_pdf"
          @click="save_contract"
        >
          <span v-if="loading_save" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
          {{ loading_save ? 'Guardando...' : 'Guardar contrato' }}
        </button>
        <button
          type="button"
          class="btn btn-outline-primary"
          :disabled="loading_save || loading_pdf"
          @click="generate_pdf"
        >
          <span v-if="loading_pdf" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
          {{ loading_pdf ? 'Generando...' : 'Generar contrato PDF' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import clause_templates from '@/utils/contract_clause_templates'
import { formatear_fecha } from '@/components/cobranzas/meses'

/**
 * Pestaña "Contrato" del cliente (misión modulo-cobranzas, 18/9/2026).
 *
 * Hasta ahora el contrato vivía solo en el lead; al promoverlo se copia al cliente (y el
 * backfill `cobranzas:copiar-contratos-de-leads` hace lo mismo con los ya promovidos), y desde
 * acá se edita y se genera el PDF del cliente. Son los mismos campos que
 * `components/lead/contract/Index.vue`, más "Meses entre actualizaciones de precio (IPC)".
 *
 * 🔴 Trabaja sobre un `form` propio cargado de `GET client/{id}/contrato`, no sobre `record`:
 * el `record` del modal genérico de Clientes es el borrador del formulario principal y las
 * columnas `contract_*` no forman parte de sus propiedades; mutarlo dejaría datos que el PUT
 * genérico del cliente no sabe guardar.
 */
export default {
  name: 'ClientContratoTab',
  props: {
    /** Cliente abierto en el modal; solo se usa `id`. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      /** true mientras carga el GET inicial. */
      loading: false,
      /** Mensaje de error del GET inicial (null = sin error). */
      load_error: null,
      /** Spinner del PUT de guardado. */
      loading_save: false,
      /** Spinner del POST de generación de PDF. */
      loading_pdf: false,
      /** Clave del template elegido en el selector; se resetea a '' tras agregar la cláusula. */
      clausula_template_key: '',
      /**
       * Si el PDF sale con la firma del PRESTADOR estampada sobre la línea. Es una opción de ESTA
       * generación, no un dato del contrato: no se guarda ni viaja en el PUT.
       */
      incluir_firma: true,
      /** Id del lead del que salió este cliente (`leads.promoted_client_id`), para el aviso de arriba. */
      lead_id: null,
      /** Datos del contrato del cliente, con los mismos nombres que las columnas `contract_*`. */
      form: this.form_vacio(),
    }
  },
  computed: {
    /**
     * Biblioteca de cláusulas modelo, compartida con el lead.
     * @returns {Array<{key: string, label: string, titulo: string, texto: string}>}
     */
    clause_templates() {
      return clause_templates
    },
    /**
     * true si hay algo cargado en el contrato (los campos que definen que exista: nombre, precio
     * de licencia, mensualidad base o alguna cuota de financiación).
     * @returns {boolean}
     */
    tiene_contrato() {
      const f = this.form
      const con_texto = function (valor) {
        return valor !== null && valor !== undefined && String(valor).trim() !== ''
      }
      return (
        con_texto(f.contract_client_name) ||
        con_texto(f.contract_precio_licencia) ||
        con_texto(f.contract_mensualidad_base) ||
        (Array.isArray(f.contract_financiacion) && f.contract_financiacion.length > 0)
      )
    },
  },
  watch: {
    /** Si cambia el cliente abierto, se recarga el contrato de ese. */
    'record.id': function (new_id, old_id) {
      if (new_id && new_id !== old_id) {
        this.cargar()
      }
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    formatear_fecha,
    /**
     * Toast global del admin.
     * @param {string} message
     * @param {string} [variant] variante Bootstrap (success por defecto)
     */
    open_feedback(message, variant) {
      window.dispatchEvent(new CustomEvent('admin-spa-toast', {
        detail: { message: String(message), variant: variant || 'success' },
      }))
    },
    /**
     * Formulario en blanco, con los mismos defaults que el contrato del lead.
     * @returns {Object}
     */
    form_vacio() {
      return {
        contract_client_name: '',
        contract_client_razon_social: '',
        contract_client_cuit: '',
        contract_currency: 'USD',
        contract_precio_licencia: '',
        contract_fecha_emision: '',
        contract_fecha_primer_pago_unico: '',
        contract_financiacion: [],
        contract_mensualidad_moneda: 'ARS',
        contract_mensualidad_base: '',
        contract_usuarios_incluidos: 1,
        contract_usuarios_extra: 0,
        contract_precio_usuario_extra: '',
        contract_perfiles_ecommerce: 0,
        contract_precio_perfil_ecommerce: '',
        contract_fecha_primer_pago_mensual: '',
        contract_clausulas_particulares: [],
        contract_meses_actualizacion: 6,
        contract_copiado_desde_lead_at: null,
      }
    },
    /**
     * Fecha del backend (date o ISO con hora) a `YYYY-MM-DD` para los inputs type="date".
     * @param {string|null|undefined} value
     * @returns {string}
     */
    to_date_only(value) {
      if (value == null || value === '') {
        return ''
      }
      return String(value).substring(0, 10)
    },
    /**
     * Vuelca el objeto `contrato` del backend al form, normalizando defaults y arrays.
     * @param {Object} contrato
     */
    aplicar_contrato(contrato) {
      const base = this.form_vacio()
      const c = contrato || {}
      const texto = function (valor, fallback) {
        return valor === null || valor === undefined ? fallback : valor
      }
      /* Cuotas y cláusulas se copian por valor: si se enlazara el array del response, editar
         una fila mutaría el objeto original sin que se note y complicaría el descarte. */
      const financiacion = Array.isArray(c.contract_financiacion)
        ? c.contract_financiacion.map(function (cuota) {
            return { monto: texto(cuota && cuota.monto, ''), fecha: cuota && cuota.fecha ? String(cuota.fecha).substring(0, 10) : '' }
          })
        : []
      const clausulas = Array.isArray(c.contract_clausulas_particulares)
        ? c.contract_clausulas_particulares.map(function (clausula) {
            return { titulo: texto(clausula && clausula.titulo, ''), texto: texto(clausula && clausula.texto, '') }
          })
        : []
      this.form = {
        contract_client_name: texto(c.contract_client_name, base.contract_client_name),
        contract_client_razon_social: texto(c.contract_client_razon_social, base.contract_client_razon_social),
        contract_client_cuit: texto(c.contract_client_cuit, base.contract_client_cuit),
        contract_currency: c.contract_currency || base.contract_currency,
        contract_precio_licencia: texto(c.contract_precio_licencia, base.contract_precio_licencia),
        contract_fecha_emision: this.to_date_only(c.contract_fecha_emision),
        contract_fecha_primer_pago_unico: this.to_date_only(c.contract_fecha_primer_pago_unico),
        contract_financiacion: financiacion,
        contract_mensualidad_moneda: c.contract_mensualidad_moneda || base.contract_mensualidad_moneda,
        contract_mensualidad_base: texto(c.contract_mensualidad_base, base.contract_mensualidad_base),
        contract_usuarios_incluidos: c.contract_usuarios_incluidos == null || c.contract_usuarios_incluidos === '' ? base.contract_usuarios_incluidos : c.contract_usuarios_incluidos,
        contract_usuarios_extra: c.contract_usuarios_extra == null || c.contract_usuarios_extra === '' ? base.contract_usuarios_extra : c.contract_usuarios_extra,
        contract_precio_usuario_extra: texto(c.contract_precio_usuario_extra, base.contract_precio_usuario_extra),
        contract_perfiles_ecommerce: c.contract_perfiles_ecommerce == null || c.contract_perfiles_ecommerce === '' ? base.contract_perfiles_ecommerce : c.contract_perfiles_ecommerce,
        contract_precio_perfil_ecommerce: texto(c.contract_precio_perfil_ecommerce, base.contract_precio_perfil_ecommerce),
        contract_fecha_primer_pago_mensual: this.to_date_only(c.contract_fecha_primer_pago_mensual),
        contract_clausulas_particulares: clausulas,
        /* Default 6: es lo que el PDF decía fijo hasta ahora. */
        contract_meses_actualizacion: c.contract_meses_actualizacion == null || c.contract_meses_actualizacion === '' ? 6 : Number(c.contract_meses_actualizacion),
        contract_copiado_desde_lead_at: c.contract_copiado_desde_lead_at || null,
      }
    },
    /**
     * GET client/{id}/contrato → `{contrato, lead_id, resumen_actualizacion}`.
     */
    cargar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      const client_id = this.record.id
      self.loading = true
      self.load_error = null
      api
        .get('/client/' + client_id + '/contrato', { silent_error: true })
        .then(function (res) {
          self.loading = false
          if (!self.record || self.record.id !== client_id) {
            return
          }
          const data = res.data || {}
          self.aplicar_contrato(data.contrato || {})
          self.lead_id = data.lead_id || null
        })
        .catch(function (error) {
          self.loading = false
          self.load_error = resolve_error_message(error)
        })
    },
    /**
     * Agrega una cuota vacía al plan de financiación.
     */
    add_cuota() {
      this.form.contract_financiacion.push({ monto: '', fecha: '' })
    },
    /**
     * Elimina una cuota por índice.
     * @param {number} cuota_index
     */
    remove_cuota(cuota_index) {
      this.form.contract_financiacion.splice(cuota_index, 1)
    },
    /**
     * Agrega una cláusula vacía.
     */
    add_clausula() {
      this.form.contract_clausulas_particulares.push({ titulo: '', texto: '' })
    },
    /**
     * Elimina una cláusula por índice.
     * @param {number} clausula_index
     */
    remove_clausula(clausula_index) {
      this.form.contract_clausulas_particulares.splice(clausula_index, 1)
    },
    /**
     * Agrega una cláusula precargada desde la biblioteca y resetea el selector.
     */
    add_clausula_from_template() {
      const self = this
      if (!self.clausula_template_key) {
        return
      }
      let elegido = null
      self.clause_templates.forEach(function (template) {
        if (template.key === self.clausula_template_key) {
          elegido = template
        }
      })
      if (elegido) {
        // Copia por valor: si se empujara el objeto del template, editar la cláusula en pantalla
        // mutaría la biblioteca y el próximo contrato arrancaría con el texto ya modificado.
        self.form.contract_clausulas_particulares.push({
          titulo: elegido.titulo,
          texto: elegido.texto,
        })
      }
      self.clausula_template_key = ''
    },
    /**
     * Normaliza fechas `YYYY-MM-DD` para el payload (null si están vacías).
     * @param {string|null|undefined} value
     * @returns {string|null}
     */
    to_date_only_for_payload(value) {
      if (value == null || value === '') {
        return null
      }
      const text = String(value)
      return text.length >= 10 ? text.substring(0, 10) : text
    },
    /**
     * Cuerpo del PUT: las mismas claves que `build_contract_payload()` del lead, más
     * `contract_meses_actualizacion`.
     * @returns {Object}
     */
    build_contract_payload() {
      const f = this.form
      return {
        contract_client_name: f.contract_client_name || null,
        contract_client_razon_social: f.contract_client_razon_social || null,
        contract_client_cuit: f.contract_client_cuit || null,
        contract_currency: f.contract_currency || null,
        contract_precio_licencia: f.contract_precio_licencia || null,
        contract_fecha_emision: this.to_date_only_for_payload(f.contract_fecha_emision),
        contract_fecha_primer_pago_unico: this.to_date_only_for_payload(f.contract_fecha_primer_pago_unico),
        contract_financiacion: f.contract_financiacion || [],
        contract_clausulas_particulares: f.contract_clausulas_particulares || [],
        contract_mensualidad_moneda: f.contract_mensualidad_moneda || null,
        contract_mensualidad_base: f.contract_mensualidad_base || null,
        contract_usuarios_incluidos: f.contract_usuarios_incluidos,
        contract_usuarios_extra: f.contract_usuarios_extra,
        contract_precio_usuario_extra: f.contract_precio_usuario_extra || null,
        contract_perfiles_ecommerce: f.contract_perfiles_ecommerce,
        contract_precio_perfil_ecommerce: f.contract_precio_perfil_ecommerce || null,
        contract_fecha_primer_pago_mensual: this.to_date_only_for_payload(f.contract_fecha_primer_pago_mensual),
        contract_meses_actualizacion: f.contract_meses_actualizacion === '' || f.contract_meses_actualizacion === null || f.contract_meses_actualizacion === undefined
          ? null
          : Number(f.contract_meses_actualizacion),
      }
    },
    /**
     * PUT client/{id}/contrato → mismo shape que el GET; se vuelve a aplicar para quedar en
     * sincronía con lo que el backend normalizó.
     */
    save_contract() {
      const self = this
      if (!self.record || !self.record.id) {
        return
      }
      self.loading_save = true
      api
        .put('/client/' + self.record.id + '/contrato', self.build_contract_payload(), { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          if (data.contrato) {
            self.aplicar_contrato(data.contrato)
          }
          if (data.lead_id !== undefined) {
            self.lead_id = data.lead_id || null
          }
          self.open_feedback('Contrato guardado.')
        })
        .catch(function (error) {
          self.open_feedback(resolve_error_message(error), 'danger')
        })
        .then(function () {
          self.loading_save = false
        })
    },
    /**
     * POST client/{id}/contrato/pdf (blob) y descarga en el navegador, mismo código que el lead.
     */
    generate_pdf() {
      const self = this
      if (!self.record || !self.record.id) {
        return
      }
      self.loading_pdf = true
      api
        .post(
          '/client/' + self.record.id + '/contrato/pdf',
          { incluir_firma: self.incluir_firma },
          { responseType: 'blob', silent_error: true }
        )
        .then(function (response) {
          const url = window.URL.createObjectURL(new Blob([response.data]))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', 'contrato_cliente_' + self.record.id + '.pdf')
          document.body.appendChild(link)
          link.click()
          link.remove()
          window.URL.revokeObjectURL(url)
        })
        .catch(function (error) {
          self.handle_pdf_error(error)
        })
        .then(function () {
          self.loading_pdf = false
        })
    },
    /**
     * Errores del endpoint PDF pueden venir como JSON dentro de un Blob (422).
     * @param {any} error
     */
    handle_pdf_error(error) {
      const self = this
      const response = error && error.response ? error.response : null
      if (response && response.data instanceof Blob) {
        const reader = new FileReader()
        reader.onload = function () {
          let message = 'No se pudo generar el contrato.'
          try {
            const parsed = JSON.parse(reader.result)
            if (parsed && parsed.message) {
              message = parsed.message
            }
          } catch (parse_error) {
            message = resolve_error_message(error)
          }
          self.open_feedback(message, 'danger')
        }
        reader.readAsText(response.data)
        return
      }
      self.open_feedback(resolve_error_message(error), 'danger')
    },
  },
}
</script>
