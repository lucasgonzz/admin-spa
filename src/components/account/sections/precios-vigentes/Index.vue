<template>
  <div class="precios-vigentes-section">
    <!-- Estado: cargando datos iniciales -->
    <p v-if="loading" class="text-muted small mb-0">Cargando…</p>

    <!-- Falla la carga: sin datos no se puede editar, se ofrece reintentar. -->
    <div v-else-if="!local" class="d-flex align-items-center gap-2">
      <p class="text-danger small mb-0">{{ error_message }}</p>
      <button type="button" class="btn btn-outline-secondary btn-sm" @click="load_settings">Reintentar</button>
    </div>

    <!-- Formulario: cuatro bloques, cada uno es un subcomponente que edita su parte del contrato. -->
    <template v-else>
      <div class="d-flex flex-column gap-4 mb-3">
        <planes-gestion :precios="local" :errors="all_errors" :disabled="saving" />
        <adicionales :precios="local" :errors="all_errors" :disabled="saving" />
        <implementaciones :precios="local" :errors="all_errors" :disabled="saving" />
        <costos-meta :precios="local" :errors="all_errors" :disabled="saving" />
      </div>

      <!-- Botón guardar: único para todos los bloques -->
      <div class="d-flex align-items-center flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="saving || !can_save"
          @click="on_save"
        >
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
        <!-- Un botón deshabilitado sin motivo se lee como pantalla rota. -->
        <span v-if="has_client_errors" class="text-danger small">
          Corregí los campos marcados para poder guardar.
        </span>
      </div>

      <!-- Mensajes de resultado inline -->
      <!-- El aviso de «guardado» sólo vale mientras la pantalla coincide con lo guardado. -->
      <p v-if="saved_message && !has_changes" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
      <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>

      <!-- Pie: quién y cuándo tocó los precios por última vez. -->
      <p v-if="updated_label" class="text-muted small mt-3 mb-0">{{ updated_label }}</p>
    </template>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import {
  build_save_payload,
  clone_precios,
  format_updated_at,
  validate_precios,
} from '@/utils/precios_vigentes'
import PlanesGestion from './PlanesGestion.vue'
import Adicionales from './Adicionales.vue'
import Implementaciones from './Implementaciones.vue'
import CostosMeta from './CostosMeta.vue'

/**
 * Sección en Cuenta: «Precios vigentes» (misión embudo-whatsapp-precios, E1).
 *
 * Es la fuente única y editable de los precios de ComercioCity: de acá leen Martín (el agente de
 * leads) y la landing. Este componente sólo orquesta: carga y guarda el contrato JSON contra
 * `settings/precios-vigentes` y reparte cada bloque a su subcomponente. La lógica pura (mitad de la
 * implementación, rangos encadenados, formato) está en `@/utils/precios_vigentes`.
 *
 * El backend valida todo y responde 422; acá se valida antes para que el operador vea el error
 * debajo del campo sin viajar al servidor.
 */
export default {
  name: 'PreciosVigentesSection',
  components: {
    PlanesGestion,
    Adicionales,
    Implementaciones,
    CostosMeta,
  },
  data() {
    return {
      /** Contrato editable (los subcomponentes lo modifican en el lugar). null hasta que carga. */
      local: null,
      /** Copia serializada de lo guardado en el servidor, para detectar cambios. */
      stored_json: '',
      /** Errores 422 del servidor por ruta de campo. */
      server_errors: {},
      /** Cuerpo serializado que provocó los errores del servidor: sólo valen mientras no se edite. */
      server_errors_payload_json: '',
      /** Carga inicial GET. */
      loading: true,
      /** PUT en curso. */
      saving: false,
      /** Mensaje de éxito tras guardar. */
      saved_message: '',
      /** Error de carga, de guardado o resumen de un 422. */
      error_message: '',
    }
  },
  computed: {
    /**
     * Errores de validación del lado cliente, por ruta de campo.
     *
     * @returns {Object<string, string>} Vacío si todo es válido.
     */
    client_errors() {
      return this.local ? validate_precios(this.local) : {}
    },
    /**
     * Errores que se pintan debajo de los campos: los del cliente mandan sobre los del servidor.
     *
     * @returns {Object<string, string>}
     */
    all_errors() {
      /* Un error del servidor habla del cuerpo que se mandó: si el operador ya editó algo, deja de
         valer y se oculta (el cliente sigue validando lo suyo). */
      const server_vigentes =
        this.local && JSON.stringify(build_save_payload(this.local)) === this.server_errors_payload_json
          ? this.server_errors
          : {}
      return Object.assign({}, server_vigentes, this.client_errors)
    },
    /**
     * true si hay algún error de validación del lado cliente.
     *
     * @returns {boolean}
     */
    has_client_errors() {
      return Object.keys(this.client_errors).length > 0
    },
    /**
     * true si el contrato editado difiere de lo guardado.
     *
     * @returns {boolean}
     */
    has_changes() {
      return !!this.local && JSON.stringify(build_save_payload(this.local)) !== this.stored_json
    },
    /**
     * Habilita Guardar sólo con cambios y sin errores de validación.
     *
     * @returns {boolean}
     */
    can_save() {
      return this.has_changes && !this.has_client_errors
    },
    /**
     * Pie «Actualizado el … por …» (vacío si nunca se guardó y no hay fecha).
     *
     * @returns {string}
     */
    updated_label() {
      if (!this.local || !this.local.actualizado_en) {
        return ''
      }
      const fecha = format_updated_at(this.local.actualizado_en)
      const quien = this.local.actualizado_por ? ' por ' + this.local.actualizado_por : ''
      return fecha ? 'Actualizado el ' + fecha + quien : ''
    },
  },
  mounted() {
    this.load_settings()
  },
  methods: {
    /**
     * Vuelca la respuesta del servidor en el contrato editable y en la copia de referencia.
     *
     * @param {Object} data Payload del GET o del PUT.
     * @returns {void}
     */
    apply_from_api(data) {
      this.local = clone_precios(data)
      this.stored_json = JSON.stringify(build_save_payload(data))
      this.server_errors = {}
    },
    /**
     * GET /settings/precios-vigentes — carga el contrato actual.
     *
     * Sin caché a propósito: es la pantalla que GUARDA estos valores, así que siempre lee del
     * servidor; un valor cacheado acá sería pisar lo que otro operador cambió.
     *
     * @returns {void}
     */
    load_settings() {
      const self = this
      self.loading = true
      self.error_message = ''
      api
        .get('/settings/precios-vigentes', { silent_error: true })
        .then(function (response) {
          self.apply_from_api(response.data)
        })
        .catch(function (error) {
          self.local = null
          self.error_message = 'No se pudieron cargar los precios vigentes. ' + resolve_error_message(error)
        })
        .then(function () {
          self.loading = false
        })
    },
    /**
     * Pasa los errores `errors` de un 422 de Laravel a un mapa «ruta → primer mensaje».
     *
     * @param {Object|undefined} errors Campo `errors` de la respuesta.
     * @returns {Object<string, string>}
     */
    map_server_errors(errors) {
      /** Mapa resultante. */
      const mapa = {}
      Object.keys(errors || {}).forEach(function (ruta) {
        const mensajes = errors[ruta]
        mapa[ruta] = Array.isArray(mensajes) ? mensajes[0] : String(mensajes)
      })
      return mapa
    },
    /**
     * PUT /settings/precios-vigentes — guarda el contrato entero y toma lo que devuelve el servidor
     * (con `actualizado_en` y `actualizado_por` sellados).
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
      self.server_errors = {}
      self.saving = true
      api
        .put('/settings/precios-vigentes', build_save_payload(self.local), {
          /* El error se muestra inline, igual que en el resto de las secciones de Cuenta; sin esto el
             interceptor global sacaría además una toast. */
          silent_error: true,
        })
        .then(function (response) {
          self.apply_from_api(response.data)
          self.saved_message = 'Precios vigentes guardados.'
        })
        .catch(function (error) {
          const response = error && error.response
          if (response && response.status === 422) {
            self.server_errors = self.map_server_errors(response.data && response.data.errors)
            self.server_errors_payload_json = JSON.stringify(build_save_payload(self.local))
          }
          self.error_message = resolve_error_message(error)
        })
        .then(function () {
          self.saving = false
        })
    },
  },
}
</script>
