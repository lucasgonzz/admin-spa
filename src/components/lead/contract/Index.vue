<template>
  <div v-if="record && record.id" class="lead-contract-tab">
    <div class="alert alert-light border mb-3">
      <p class="small text-muted mb-0">
        Completá los datos del contrato y guardalos en el lead. Luego podés generar y descargar el PDF.
      </p>
    </div>

    <h6 class="text-primary mb-2">Datos del cliente</h6>
    <div class="alert alert-light border mb-3">
      <div class="row g-2">
        <div class="col-md-4">
          <label class="form-label">Nombre comercial / empresa</label>
          <input v-model="record.contract_client_name" type="text" class="form-control" />
        </div>
        <div class="col-md-4">
          <label class="form-label">Razón social</label>
          <input v-model="record.contract_client_razon_social" type="text" class="form-control" />
        </div>
        <div class="col-md-4">
          <label class="form-label">CUIT</label>
          <input v-model="record.contract_client_cuit" type="text" class="form-control" />
        </div>
      </div>
    </div>

    <h6 class="text-primary mb-2">Pago único</h6>
    <div class="alert alert-light border mb-3">
      <div class="row g-2">
        <div class="col-md-3">
          <label class="form-label">Moneda</label>
          <select v-model="record.contract_currency" class="form-select">
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">Precio total (licencia + implementación)</label>
          <input v-model="record.contract_precio_licencia" type="text" class="form-control" />
        </div>
        <div class="col-md-3">
          <label class="form-label">Fecha de emisión</label>
          <input v-model="record.contract_fecha_emision" type="date" class="form-control" />
        </div>
        <div class="col-md-3">
          <label class="form-label">Fecha primer pago</label>
          <input v-model="record.contract_fecha_primer_pago_unico" type="date" class="form-control" />
        </div>
      </div>
    </div>

    <h6 class="text-primary mb-2">Financiación (cuotas)</h6>
    <div class="alert alert-light border mb-3">
      <div
        v-for="(cuota, cuota_index) in financiacion_rows"
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
    </div>

    <h6 class="text-primary mb-2">Mensualidad</h6>
    <div class="alert alert-light border mb-3">
      <div class="row g-2">
        <div class="col-md-3">
          <label class="form-label">Moneda mensualidad</label>
          <select v-model="record.contract_mensualidad_moneda" class="form-select">
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">Mensualidad base</label>
          <input v-model="record.contract_mensualidad_base" type="text" class="form-control" />
        </div>
        <div class="col-md-3">
          <label class="form-label">Usuarios incluidos en la base</label>
          <input v-model.number="record.contract_usuarios_incluidos" type="number" min="0" class="form-control" />
        </div>
        <div class="col-md-3">
          <label class="form-label">Usuarios adicionales</label>
          <input v-model.number="record.contract_usuarios_extra" type="number" min="0" class="form-control" />
        </div>
        <div class="col-md-4">
          <label class="form-label">Precio por usuario extra</label>
          <input v-model="record.contract_precio_usuario_extra" type="text" class="form-control" />
        </div>
        <div class="col-md-4">
          <label class="form-label">Perfiles de ecommerce</label>
          <input v-model.number="record.contract_perfiles_ecommerce" type="number" min="0" class="form-control" />
        </div>
        <div class="col-md-4">
          <label class="form-label">Precio por perfil de ecommerce</label>
          <input v-model="record.contract_precio_perfil_ecommerce" type="text" class="form-control" />
        </div>
        <div class="col-md-4">
          <label class="form-label">Fecha primer pago mensual</label>
          <input v-model="record.contract_fecha_primer_pago_mensual" type="date" class="form-control" />
        </div>
        <!--
          Cada cuántos meses se actualiza el precio de la mensualidad (misión modulo-cobranzas,
          18/9/2026). Sale en el PDF reemplazando el "seis (6) meses" fijo y, cuando el lead se
          promueve, viaja al cliente para calcular la próxima actualización oficial. El índice
          sigue siendo el IPC: eso no se elige, es texto fijo del contrato.
        -->
        <div class="col-md-4">
          <label class="form-label">Meses entre actualizaciones de precio (IPC)</label>
          <input
            v-model.number="record.contract_meses_actualizacion"
            type="number"
            min="1"
            max="60"
            step="1"
            class="form-control"
          />
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
        v-for="(clausula, clausula_index) in clausulas_rows"
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

    <!--
      El id va atado a record.id y no fijo: la pestaña se monta por lead, y dos labels con el
      mismo `for` en el DOM hacen que el click en una tilde la casilla de la otra.
    -->
    <div class="form-check mb-2">
      <input
        :id="'incluir_firma_' + record.id"
        v-model="incluir_firma"
        class="form-check-input"
        type="checkbox"
      />
      <label class="form-check-label" :for="'incluir_firma_' + record.id">
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
        {{ loading_save ? 'Guardando...' : 'Guardar datos del contrato' }}
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
      <!--
        Cotizador del sistema (misión cotizador-lead-mercado-pago, 22/9/2026). Va en esta fila,
        abajo de todo, como lo pidió Lucas. `flex-wrap` ya estaba en el contenedor, así que en
        teléfono los tres botones se apilan solos.
      -->
      <button
        type="button"
        class="btn btn-outline-success"
        :disabled="loading_save || loading_pdf"
        @click="abrir_cotizador"
      >
        Cotizar el sistema
      </button>
    </div>

    <!--
      Modal del cotizador, apilado sobre el modal del lead (stack_level 1). Se monta una sola vez
      y se rearma en cada apertura (ver su watch de `show`).
    -->
    <cotizador-modal
      :show="cotizador_show"
      :lead="record"
      :stack_level="1"
      @update:show="cotizador_show = $event"
      @generada="on_cotizacion_generada"
      @close="on_cotizador_cerrado"
    />
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import clause_templates from '@/utils/contract_clause_templates'
import CotizadorModal from './CotizadorModal.vue'

export default {
  name: 'LeadContractTab',
  components: { CotizadorModal },
  props: {
    /**
     * Lead en edición (borrador del modal); se mutan los campos `contract_*` en el mismo objeto.
     */
    record: { type: Object, default: null },
  },
  emits: ['record-updated'],
  data() {
    return {
      /** Spinner del PUT de guardado de contrato. */
      loading_save: false,
      /** Spinner del POST de generación de PDF. */
      loading_pdf: false,
      /** Clave del template elegido en el selector; se resetea a '' tras agregar la clausula. */
      clausula_template_key: '',
      /**
       * Si el PDF sale con la firma del PRESTADOR estampada sobre la línea.
       * Es una opción de ESTA generación, no un dato del contrato: no se guarda en el lead ni
       * viaja en build_contract_payload(). Arranca en true porque el caso normal es firmarlo.
       */
      incluir_firma: true,
      /** Visibilidad del modal del cotizador (misión cotizador-lead-mercado-pago, 22/9/2026). */
      cotizador_show: false,
      /**
       * Última cotización generada en esta apertura del modal, tal como la devolvió el servidor.
       * Se guarda acá y no se aplica en el momento porque el total se copia al contrato recién
       * AL CERRAR el modal: mientras está abierto el operador puede generar más de un link
       * (cambió un precio, cambió el dólar) y el que vale es el último.
       *
       * @type {Object|null}
       */
      ultima_cotizacion: null,
    }
  },
  computed: {
    /**
     * Referencia al array de cuotas enlazado a `contract_financiacion` del lead.
     * @returns {Array<{monto: string, fecha: string}>}
     */
    financiacion_rows() {
      this.ensure_financiacion_on_record()
      return this.record.contract_financiacion
    },
    /**
     * Referencia al array de clausulas particulares enlazado a `contract_clausulas_particulares`.
     * @returns {Array<{titulo: string, texto: string}>}
     */
    clausulas_rows() {
      this.ensure_clausulas_on_record()
      return this.record.contract_clausulas_particulares
    },
    /**
     * Array de clausulas modelo disponibles para precarga rapida.
     * @returns {Array<{key: string, label: string, titulo: string, texto: string}>}
     */
    clause_templates() {
      return clause_templates
    },
  },
  watch: {
    /**
     * Al cambiar de lead en el modal, normaliza defaults y el array de cuotas.
     */
    record: {
      immediate: true,
      handler: function () {
        this.ensure_contract_defaults()
      },
    },
  },
  methods: {
    /**
     * Toast global (Vue 3: CustomEvent admin-spa-toast) o alert de respaldo.
     * @param {string} message
     * @param {string} [variant] variante Bootstrap del toast (success, danger, etc.).
     * @returns {void}
     */
    open_feedback(message, variant) {
      /** Variante visual; por defecto éxito en guardados manuales. */
      const toast_variant = variant || 'success'
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: {
            message: String(message),
            variant: toast_variant,
          },
        }))
        return
      }
      alert(message)
    },
    /**
     * @param {any} error
     * @returns {string}
     */
    get_error_message(error) {
      return resolve_error_message(error)
    },
    /**
     * Asegura que `contract_financiacion` sea un array mutable en el record.
     * @returns {void}
     */
    ensure_financiacion_on_record() {
      if (!this.record) {
        return
      }
      if (!this.record.contract_financiacion || !Array.isArray(this.record.contract_financiacion)) {
        this.record.contract_financiacion = []
      }
    },
    /**
     * Valores por defecto de monedas y contadores numéricos del contrato.
     * @returns {void}
     */
    ensure_contract_defaults() {
      if (!this.record) {
        return
      }
      if (!this.record.contract_currency) {
        this.record.contract_currency = 'USD'
      }
      if (!this.record.contract_mensualidad_moneda) {
        this.record.contract_mensualidad_moneda = 'ARS'
      }
      if (this.record.contract_usuarios_incluidos == null || this.record.contract_usuarios_incluidos === '') {
        this.record.contract_usuarios_incluidos = 1
      }
      if (this.record.contract_usuarios_extra == null || this.record.contract_usuarios_extra === '') {
        this.record.contract_usuarios_extra = 0
      }
      if (this.record.contract_perfiles_ecommerce == null || this.record.contract_perfiles_ecommerce === '') {
        this.record.contract_perfiles_ecommerce = 0
      }
      /* Default 15000: precio vigente de la cuenta/usuario extra (comercial/proceso_comercial.md).
         Brisa lo puede sobreescribir a mano si un cliente puntual negocia otro valor. */
      if (!this.record.contract_precio_usuario_extra) {
        this.record.contract_precio_usuario_extra = '15000'
      }
      /* Default 6: es lo que el contrato decía fijo hasta ahora ("seis (6) meses"), así un lead
         viejo sin el campo cargado sigue generando el mismo PDF de siempre. */
      if (this.record.contract_meses_actualizacion == null || this.record.contract_meses_actualizacion === '') {
        this.record.contract_meses_actualizacion = 6
      }
      this.ensure_financiacion_on_record()
      this.ensure_clausulas_on_record()
    },
    /**
     * Agrega una cuota vacía al plan de financiación.
     * @returns {void}
     */
    add_cuota() {
      this.ensure_financiacion_on_record()
      this.record.contract_financiacion.push({ monto: '', fecha: '' })
    },
    /**
     * Elimina una cuota por índice.
     * @param {number} cuota_index
     * @returns {void}
     */
    remove_cuota(cuota_index) {
      this.ensure_financiacion_on_record()
      this.record.contract_financiacion.splice(cuota_index, 1)
    },
    /**
     * Asegura que `contract_clausulas_particulares` sea un array mutable en el record.
     * @returns {void}
     */
    ensure_clausulas_on_record() {
      if (!this.record) {
        return
      }
      if (!this.record.contract_clausulas_particulares || !Array.isArray(this.record.contract_clausulas_particulares)) {
        this.record.contract_clausulas_particulares = []
      }
    },
    /**
     * Agrega una clausula vacia.
     * @returns {void}
     */
    add_clausula() {
      this.ensure_clausulas_on_record()
      this.record.contract_clausulas_particulares.push({ titulo: '', texto: '' })
    },
    /**
     * Elimina una clausula por indice.
     * @param {number} clausula_index
     * @returns {void}
     */
    remove_clausula(clausula_index) {
      this.ensure_clausulas_on_record()
      this.record.contract_clausulas_particulares.splice(clausula_index, 1)
    },
    /**
     * Agrega una clausula precargada desde la biblioteca y resetea el selector.
     * @returns {void}
     */
    add_clausula_from_template() {
      const self = this
      if (!self.clausula_template_key) {
        return
      }
      self.ensure_clausulas_on_record()
      /** Template elegido en el selector. */
      let elegido = null
      self.clause_templates.forEach(function (template) {
        if (template.key === self.clausula_template_key) {
          elegido = template
        }
      })
      if (elegido) {
        // Copia por valor: si se empujara el objeto del template, editar la clausula en pantalla
        // mutaria la biblioteca y el proximo contrato arrancaria con el texto ya modificado.
        self.record.contract_clausulas_particulares.push({
          titulo: elegido.titulo,
          texto: elegido.texto,
        })
      }
      self.clausula_template_key = ''
    },
    /**
     * Normaliza fechas `YYYY-MM-DD` para inputs type="date".
     * @param {string|null|undefined} value
     * @returns {string|null}
     */
    to_date_only_for_payload(value) {
      if (value == null || value === '') {
        return null
      }
      const text = String(value)
      if (text.length >= 10) {
        return text.substring(0, 10)
      }
      return text
    },
    /**
     * Arma el payload PUT con todos los campos `contract_*`.
     * @returns {Object}
     */
    build_contract_payload() {
      this.ensure_contract_defaults()
      return {
        contract_client_name: this.record.contract_client_name || null,
        contract_client_razon_social: this.record.contract_client_razon_social || null,
        contract_client_cuit: this.record.contract_client_cuit || null,
        contract_currency: this.record.contract_currency || null,
        contract_precio_licencia: this.record.contract_precio_licencia || null,
        contract_fecha_emision: this.to_date_only_for_payload(this.record.contract_fecha_emision),
        contract_fecha_primer_pago_unico: this.to_date_only_for_payload(this.record.contract_fecha_primer_pago_unico),
        contract_financiacion: this.record.contract_financiacion || [],
        contract_clausulas_particulares: this.record.contract_clausulas_particulares || [],
        contract_mensualidad_moneda: this.record.contract_mensualidad_moneda || null,
        contract_mensualidad_base: this.record.contract_mensualidad_base || null,
        contract_usuarios_incluidos: this.record.contract_usuarios_incluidos,
        contract_usuarios_extra: this.record.contract_usuarios_extra,
        contract_precio_usuario_extra: this.record.contract_precio_usuario_extra || null,
        contract_perfiles_ecommerce: this.record.contract_perfiles_ecommerce,
        contract_precio_perfil_ecommerce: this.record.contract_precio_perfil_ecommerce || null,
        contract_fecha_primer_pago_mensual: this.to_date_only_for_payload(this.record.contract_fecha_primer_pago_mensual),
        contract_meses_actualizacion: this.record.contract_meses_actualizacion,
      }
    },
    /**
     * Persiste los datos del contrato vía PUT /lead/{id}.
     * @returns {void}
     */
    save_contract() {
      const self = this
      if (!self.record || !self.record.id) {
        return
      }
      self.loading_save = true
      api
        .put('/lead/' + self.record.id, self.build_contract_payload())
        .then(function (response) {
          if (response.data && response.data.model) {
            self.$store.dispatch('lead/upsert_model_in_lists', response.data.model)
            self.$emit('record-updated', response.data.model)
          }
          self.open_feedback('Datos del contrato guardados.')
        })
        .catch(function (error) {
          self.open_feedback(self.get_error_message(error), 'danger')
        })
        .then(function () {
          self.loading_save = false
        })
    },
    /**
     * Genera el PDF en admin-api y lo descarga en el navegador.
     * @returns {void}
     */
    generate_pdf() {
      const self = this
      if (!self.record || !self.record.id) {
        return
      }
      self.loading_pdf = true
      api
        .post(
          '/lead/' + self.record.id + '/generate-contract',
          { incluir_firma: self.incluir_firma },
          { responseType: 'blob' }
        )
        .then(function (response) {
          const url = window.URL.createObjectURL(new Blob([response.data]))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', 'contrato_' + self.record.id + '.pdf')
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
     * @returns {void}
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
            message = self.get_error_message(error)
          }
          self.open_feedback(message)
        }
        reader.readAsText(response.data)
        return
      }
      self.open_feedback(self.get_error_message(error))
    },
    /**
     * Abre el cotizador del sistema.
     *
     * @returns {void}
     */
    abrir_cotizador() {
      if (!this.record || !this.record.id) {
        return
      }
      this.ultima_cotizacion = null
      this.cotizador_show = true
    },
    /**
     * El servidor generó el link y persistió la foto de la cotización en el lead.
     *
     * Sincroniza la tabla de leads con el modelo devuelto —igual que save_contract()— y se
     * queda con la cotización para copiarla al contrato cuando el modal se cierre.
     *
     * @param {Object} data respuesta del backend: `{model, cotizacion}`
     * @returns {void}
     */
    on_cotizacion_generada(data) {
      if (!data) {
        return
      }
      if (data.model) {
        this.$store.dispatch('lead/upsert_model_in_lists', data.model)
        this.$emit('record-updated', data.model)
      }
      this.ultima_cotizacion = data.cotizacion || null
    },
    /**
     * Al cerrarse el modal, copia el total de la cotización al campo "Precio total (licencia +
     * implementación)" del contrato para no tipearlo dos veces, y deja la moneda coherente.
     *
     * Se copia el total en DÓLARES con `contract_currency` en USD porque los tres precios del
     * cotizador son en dólares (decisión de Lucas en la Fase 2 del plan): copiar el total en
     * pesos dejaría el contrato atado al dólar del día que se cotizó.
     *
     * Mismo criterio que `ensure_contract_defaults()`: si el operador abrió el cotizador y lo
     * cerró sin generar ninguna cotización, no se pisa nada de lo que ya había cargado.
     *
     * @returns {void}
     */
    on_cotizador_cerrado() {
      if (!this.ultima_cotizacion || !this.record) {
        return
      }
      /** Total en dólares que devolvió el servidor. */
      const total_usd = this.ultima_cotizacion.total_usd
      if (total_usd == null) {
        this.ultima_cotizacion = null
        return
      }
      this.record.contract_precio_licencia = String(total_usd)
      this.record.contract_currency = 'USD'
      this.ultima_cotizacion = null
      this.open_feedback(
        'Se copió el total de la cotización al precio del contrato. Acordate de guardar los datos del contrato.'
      )
    },
  },
}
</script>
