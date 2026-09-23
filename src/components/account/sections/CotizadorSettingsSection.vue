<template>
  <div class="cotizador-settings-section">
    <!-- Estado: cargando datos iniciales -->
    <p v-if="loading" class="text-muted small mb-0">Cargando…</p>

    <!-- Formulario: visible una vez cargado -->
    <template v-else>
      <!-- Estado de la credencial de Mercado Pago. Es de solo lectura y no se puede cambiar
           desde acá a propósito: el access token vive en el `.env` del admin y no pasa nunca
           por el navegador. Se muestra igual porque es lo primero que hay que mirar cuando el
           botón de generar el link aparece deshabilitado en la ficha de un lead. -->
      <div
        class="alert py-2 px-3 small mb-3"
        :class="mercado_pago_configurado ? 'alert-success' : 'alert-warning'"
        role="status"
      >
        <template v-if="mercado_pago_configurado">
          <strong>Mercado Pago está configurado.</strong>
          Se pueden generar links de pago desde la solapa Contrato de un lead.
        </template>
        <template v-else>
          <strong>Falta la credencial de Mercado Pago.</strong>
          Mientras <code>MP_ADMIN_ACCESS_TOKEN</code> no esté cargada en el <code>.env</code> del
          admin, la cotización se calcula pero el link de pago no se puede generar.
        </template>
      </div>

      <!-- Precios por defecto de los tres sistemas. Son los que aparecen precargados al abrir el
           cotizador de un lead; ahí se pueden cambiar para ese lead puntual sin tocar estos. -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-12 col-md-4">
          <label class="form-label small" for="cotizador_precio_gestion">
            Precio de ComercioCity Gestión (USD)
          </label>
          <div class="input-group input-group-sm">
            <span class="input-group-text">USD</span>
            <input
              id="cotizador_precio_gestion"
              v-model.number="local.precio_gestion"
              type="number"
              class="form-control"
              min="0"
              :max="MAX_PRECIO_USD"
              step="0.01"
              :disabled="saving"
            />
          </div>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label small" for="cotizador_precio_ecommerce">
            Precio de ComercioCity E-Commerce (USD)
          </label>
          <div class="input-group input-group-sm">
            <span class="input-group-text">USD</span>
            <input
              id="cotizador_precio_ecommerce"
              v-model.number="local.precio_ecommerce"
              type="number"
              class="form-control"
              min="0"
              :max="MAX_PRECIO_USD"
              step="0.01"
              :disabled="saving"
            />
          </div>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label small" for="cotizador_precio_agentes">
            Precio de ComercioCity Agentes (USD)
          </label>
          <div class="input-group input-group-sm">
            <span class="input-group-text">USD</span>
            <input
              id="cotizador_precio_agentes"
              v-model.number="local.precio_agentes"
              type="number"
              class="form-control"
              min="0"
              :max="MAX_PRECIO_USD"
              step="0.01"
              :disabled="saving"
            />
          </div>
        </div>
      </div>
      <p class="text-muted small mb-3">
        Son pago único (licencia + implementación) y están en dólares. El valor del dólar se carga
        a mano en cada cotización: el sistema no consulta ninguna cotización automática.
      </p>

      <!-- Descuento por transferencia directa y vencimiento del link. -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-12 col-md-6">
          <label class="form-label small" for="cotizador_descuento_transferencia">
            Descuento por pagar con transferencia directa (%)
          </label>
          <div class="input-group input-group-sm">
            <input
              id="cotizador_descuento_transferencia"
              v-model.number="local.descuento_transferencia"
              type="number"
              class="form-control"
              min="0"
              max="100"
              step="0.01"
              :disabled="saving"
            />
            <span class="input-group-text">%</span>
          </div>
          <p class="text-muted small mb-0 mt-1">
            El cotizador muestra cuánto sale pagando por transferencia con este descuento, en
            dólares y en pesos.
          </p>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label small" for="cotizador_link_vence_dias">
            Días hasta que vence el link de pago
          </label>
          <input
            id="cotizador_link_vence_dias"
            v-model.number="local.link_vence_dias"
            type="number"
            class="form-control form-control-sm"
            min="1"
            max="365"
            step="1"
            :disabled="saving"
          />
          <p class="text-muted small mb-0 mt-1">
            Una cotización hecha con el dólar de hoy no puede seguir cobrando dentro de dos meses:
            pasados estos días, el link deja de servir y hay que generar uno nuevo.
          </p>
        </div>
      </div>

      <!-- Botón guardar: único para todos los campos -->
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
import api, { resolve_error_message } from '@/utils/axios'

/** Techo de precio por sistema que valida el backend (plan, §4 decisión 1). */
const MAX_PRECIO_USD = 100000

/**
 * Sección en Cuenta: configuración del cotizador de sistemas (misión
 * cotizador-lead-mercado-pago, 22/9/2026).
 *
 * Son los valores por defecto del cotizador que se abre desde la solapa Contrato de un lead:
 * el precio de cada uno de los tres sistemas, el descuento por transferencia directa y a los
 * cuántos días vence el link de pago de Mercado Pago.
 *
 * 🔴 El access token de Mercado Pago NO se edita acá ni en ninguna otra pantalla: vive en el
 * `.env` del admin y no pasa nunca por el navegador. Lo único que esta sección muestra de él es
 * un booleano derivado que dice si está cargado o no.
 */
export default {
  name: 'CotizadorSettingsSection',
  data() {
    return {
      /** Techo del backend, expuesto al template para los `max` de los inputs de precio. */
      MAX_PRECIO_USD: MAX_PRECIO_USD,
      /** Valores editables en el formulario. */
      local: {
        /** Precio por defecto de ComercioCity Gestión, en dólares (pago único). */
        precio_gestion: 1500,
        /** Precio por defecto de ComercioCity E-Commerce, en dólares (pago único). */
        precio_ecommerce: 600,
        /** Precio por defecto de ComercioCity Agentes, en dólares (pago único). */
        precio_agentes: 600,
        /** Porcentaje de descuento por pagar con transferencia directa en vez del link. */
        descuento_transferencia: 10,
        /** Días hasta que vence el link de pago generado. */
        link_vence_dias: 7,
      },
      /** Valores persistidos en servidor (para detectar cambios). */
      stored: {
        /** Espejo del servidor: precio de Gestión. */
        precio_gestion: 1500,
        /** Espejo del servidor: precio de E-Commerce. */
        precio_ecommerce: 600,
        /** Espejo del servidor: precio de Agentes. */
        precio_agentes: 600,
        /** Espejo del servidor: descuento por transferencia. */
        descuento_transferencia: 10,
        /** Espejo del servidor: días de vencimiento del link. */
        link_vence_dias: 7,
      },
      /**
       * Derivado del servidor: si el access token de Mercado Pago está cargado en el `.env`.
       * Es de solo lectura y no viaja en el guardado.
       */
      mercado_pago_configurado: false,
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
     * Habilita el botón guardar solo si algún campo cambió respecto al valor guardado en servidor.
     *
     * @returns {boolean}
     */
    can_save() {
      const fields = Object.keys(this.local)
      for (let i = 0; i < fields.length; i++) {
        const key = fields[i]
        if (this.local[key] !== this.stored[key]) {
          return true
        }
      }
      return false
    },
  },
  mounted() {
    this.load_settings()
  },
  methods: {
    /**
     * Vuelca la respuesta del servidor en `local` y `stored`.
     *
     * Solo toca las claves que el servidor efectivamente mandó: una API vieja que todavía no
     * devuelva alguna deja el default local en pie en vez de pisarlo con `undefined`.
     *
     * @param {Object} data payload del GET o del PUT
     * @returns {void}
     */
    apply_from_api(data) {
      const self = this
      const payload = data || {}
      Object.keys(self.local).forEach(function (key) {
        if (payload[key] !== undefined) {
          self.local[key] = Number(payload[key])
          self.stored[key] = Number(payload[key])
        }
      })
      if (payload.mercado_pago_configurado !== undefined) {
        self.mercado_pago_configurado = payload.mercado_pago_configurado === true
      }
    },
    /**
     * GET /settings/cotizador — carga la configuración actual del cotizador.
     *
     * Sin caché a propósito: es la sección que GUARDA estos valores, así que siempre lee del
     * servidor —un valor cacheado acá sería guardar encima de lo que otro operador cambió— y
     * además `mercado_pago_configurado` cambia en cuanto Lucas carga la credencial.
     *
     * @returns {void}
     */
    load_settings() {
      const self = this
      self.loading = true
      self.error_message = ''
      api
        .get('/settings/cotizador')
        .then(function (response) {
          self.apply_from_api(response.data)
        })
        .catch(function () {
          self.error_message = 'No se pudo cargar la configuración del cotizador.'
        })
        .then(function () {
          self.loading = false
        })
    },
    /**
     * PUT /settings/cotizador — persiste los cinco valores editables.
     *
     * @returns {void}
     */
    on_save() {
      const self = this
      if (!self.can_save || self.saving) {
        return
      }
      self.saved_message = ''
      self.error_message = ''
      self.saving = true
      api
        .put(
          '/settings/cotizador',
          {
            precio_gestion: self.local.precio_gestion,
            precio_ecommerce: self.local.precio_ecommerce,
            precio_agentes: self.local.precio_agentes,
            descuento_transferencia: self.local.descuento_transferencia,
            link_vence_dias: self.local.link_vence_dias,
          },
          /* El error se muestra inline debajo del botón, igual que en el resto de las secciones
             de esta pantalla; sin esto el interceptor global sacaría además una toast. */
          { silent_error: true }
        )
        .then(function (response) {
          self.apply_from_api(response.data)
          self.saved_message = 'Configuración del cotizador guardada.'
        })
        .catch(function (error) {
          self.error_message = resolve_error_message(error)
        })
        .then(function () {
          self.saving = false
        })
    },
  },
}
</script>
