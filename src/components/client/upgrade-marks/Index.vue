<template>
  <div class="p-2 p-sm-3 upgrade-marks">
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para ver sus actualizaciones pendientes.
    </p>

    <div v-else-if="cargando && !cargado_alguna_vez" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
    </div>

    <p v-else-if="no_disponible" class="text-muted small fst-italic mb-0">
      No disponible: el admin todavía no tiene las marcas de actualización.
    </p>

    <div v-else-if="error_carga" class="alert alert-danger py-2 small mb-0">
      {{ error_carga }}
      <button type="button" class="btn btn-sm btn-link p-0 ms-2 align-baseline" @click="cargar">Reintentar</button>
    </div>

    <p v-else-if="!filas.length" class="text-muted small fst-italic mb-0">
      Este cliente no tiene actualizaciones pendientes.
    </p>

    <template v-else>
      <!-- Versión instalada y qué conviene hacer: una sola frase, sin adornos. -->
      <p v-if="resumen" class="upgrade-marks__resumen mb-3">
        <span v-if="resumen.current_version" class="text-muted">Versión instalada {{ resumen.current_version }}.</span>
        <strong v-if="resumen.recomendacion_label" class="ms-1">{{ resumen.recomendacion_label }}.</strong>
      </p>

      <ul class="upgrade-marks__lista mb-0">
        <li v-for="fila in filas" :key="fila.id" class="upgrade-marks__fila">
          <div class="d-flex flex-wrap align-items-start gap-2">
            <div class="flex-grow-1 min-w-0">
              <div class="upgrade-marks__titulo">{{ fila.title }}</div>
              <div class="upgrade-marks__meta text-muted">
                <span>{{ fila.kind_label }}</span>
                <router-link
                  v-if="fila.support_ticket_id"
                  class="upgrade-marks__ticket"
                  :to="{ name: 'support_ticket_conversation', params: { ticket_id: fila.support_ticket_id } }"
                  target="_blank"
                  title="Abrir el ticket (se abre en otra pestaña)">{{ fila.ticket_label }}</router-link>
                <span v-if="fila.version_label">{{ fila.version_label }}</span>
              </div>
              <div v-if="fila.detail" class="upgrade-marks__detalle text-muted">{{ fila.detail }}</div>
            </div>
            <span class="badge text-bg-light border flex-shrink-0">{{ fila.estado_label }}</span>
            <div class="flex-shrink-0 d-flex gap-1">
              <template v-if="confirmando_id === fila.id">
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  :disabled="resolviendo_id === fila.id"
                  @click="marcar_resuelta(fila)">
                  <span v-if="resolviendo_id === fila.id" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  Confirmar
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  :disabled="resolviendo_id === fila.id"
                  @click="confirmando_id = null">Cancelar</button>
              </template>
              <button
                v-else
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="confirmando_id = fila.id">Marcar resuelta</button>
            </div>
          </div>
        </li>
      </ul>
      <div v-if="error_resolver" class="alert alert-danger py-2 px-2 small mt-2 mb-0">{{ error_resolver }}</div>
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'
import {
  UPGRADE_MARKS_CHANGED_EVENT,
  client_summary,
  is_unavailable_error,
  normalize_marks_response,
  resolve_request,
  rows_for_client,
  without_mark,
} from '@/utils/client_upgrade_marks'

/**
 * Pestaña «Actualización» del detalle del cliente (misión martin-descripcion-y-actualizaciones, 25/11/2026):
 * lo que ya está integrado (correcciones de soporte, funcionalidades) y todavía no está instalado en este
 * cliente, con su motivo, el ticket de origen, el estado y la versión que lo trae. «Marcar resuelta» lo saca
 * de la lista a mano (las marcas se resuelven solas al instalar la versión).
 *
 * Rutas del panel (admin-api, contrato C6):
 *   GET   client-upgrade-marks?client_id=N                 marcas abiertas del cliente
 *   PATCH client-upgrade-marks/{id}/resolve  {reason}      resolver una marca a mano
 */
export default {
  name: 'ClientUpgradeMarksTab',
  emits: ['record-updated'],
  props: {
    /** Cliente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      cargando: false,
      cargado_alguna_vez: false,
      error_carga: '',
      // true si el admin contestó 404 (todavía no tiene las rutas).
      no_disponible: false,
      // Respuesta normalizada del GET.
      respuesta: normalize_marks_response(null),
      // Marca con el «¿Confirmar?» abierto y marca con el PATCH en vuelo.
      confirmando_id: null,
      resolviendo_id: null,
      error_resolver: '',
    }
  },
  computed: {
    /**
     * Filas de la tabla de este cliente.
     *
     * @returns {Array<Object>}
     */
    filas() {
      return this.record && this.record.id ? rows_for_client(this.respuesta, this.record.id) : []
    },
    /**
     * Cabecera con la versión instalada y la recomendación.
     *
     * @returns {Object|null}
     */
    resumen() {
      return this.record && this.record.id ? client_summary(this.respuesta, this.record.id) : null
    },
  },
  watch: {
    'record.id'(nuevo, viejo) {
      if (nuevo && nuevo !== viejo) {
        this.cargado_alguna_vez = false
        this.cargar()
      }
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    /**
     * Pide las marcas abiertas de este cliente. 404 = el admin todavía no las tiene («No disponible»).
     *
     * @returns {void}
     */
    cargar() {
      const self = this
      if (!self.record || !self.record.id) {
        return
      }
      self.cargando = true
      self.error_carga = ''
      self.no_disponible = false
      api
        .get('client-upgrade-marks', { params: { client_id: self.record.id }, silent_error: true })
        .then(function (res) {
          self.respuesta = normalize_marks_response(res.data)
          self.cargando = false
          self.cargado_alguna_vez = true
        })
        .catch(function (err) {
          self.cargando = false
          self.cargado_alguna_vez = true
          if (is_unavailable_error(err)) {
            self.no_disponible = true
            return
          }
          self.error_carga = 'No se pudieron cargar las actualizaciones pendientes.'
        })
    },
    /**
     * «Marcar resuelta»: PATCH manual y la marca sale de la lista. Si era la última, avisa al listado que el
     * cliente ya no requiere actualización y al botón de la barra que recuente.
     *
     * @param {{id: number}} fila Fila elegida
     * @returns {void}
     */
    marcar_resuelta(fila) {
      const self = this
      const req = resolve_request(fila.id)
      self.resolviendo_id = fila.id
      self.error_resolver = ''
      api.patch(req.url, req.body, { silent_error: true })
        .then(function () {
          self.respuesta = without_mark(self.respuesta, fila.id)
          self.resolviendo_id = null
          self.confirmando_id = null
          if (self.filas.length === 0 && self.record) {
            self.$emit('record-updated', Object.assign({}, self.record, { requires_upgrade: false }))
          }
          window.dispatchEvent(new CustomEvent(UPGRADE_MARKS_CHANGED_EVENT))
        })
        .catch(function () {
          self.resolviendo_id = null
          self.error_resolver = 'No se pudo marcar como resuelta. Probá de nuevo.'
        })
    },
  },
}
</script>

<style scoped lang="scss">
.upgrade-marks__resumen {
	font-size: 0.9rem;
}

.upgrade-marks__lista {
	list-style: none;
	padding: 0;
}

.upgrade-marks__fila {
	padding: 0.65rem 0;
	border-bottom: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));
}

.upgrade-marks__fila:last-child {
	border-bottom: 0;
}

.upgrade-marks__titulo {
	font-size: 0.92rem;
	font-weight: 600;
	overflow-wrap: anywhere;
}

.upgrade-marks__meta {
	display: flex;
	flex-wrap: wrap;
	gap: 0.15rem 0.75rem;
	font-size: 0.78rem;
}

.upgrade-marks__ticket {
	color: inherit;
	text-decoration: underline;
}

.upgrade-marks__detalle {
	margin-top: 0.2rem;
	font-size: 0.78rem;
	white-space: pre-line;
	overflow-wrap: anywhere;
}
</style>
