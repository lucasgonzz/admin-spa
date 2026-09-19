<template>
  <div class="p-3">
    <!-- Sin cliente guardado todavía: no hay id al que pedirle el estado del candado -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para configurar el candado de sesión.
    </p>

    <!-- Carga inicial del estado -->
    <div v-else-if="loading" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <div v-else>
      <!-- ============================================================ -->
      <!-- El interruptor. Default apagado: pestañas del mismo          -->
      <!-- navegador conviven (fix candado-sesion-refresh, 9/9/2026);   -->
      <!-- prendido, cada pestaña nueva expulsa a la anterior, igual     -->
      <!-- que un dispositivo distinto.                                  -->
      <!-- ============================================================ -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="form-check form-switch">
            <input
              id="candado-sesion-bloquear"
              v-model="bloquear_pestanas_duplicadas"
              class="form-check-input"
              type="checkbox"
              role="switch"
            />
            <label class="form-check-label fw-semibold" for="candado-sesion-bloquear">
              Bloquear pestañas duplicadas del mismo navegador
            </label>
          </div>
          <p class="text-muted small mb-0 mt-2">
            Por defecto está <strong>apagado</strong>: dos pestañas del mismo navegador pueden tener
            la cuenta abierta a la vez, a propósito. Prendiéndolo, este cliente pasa a un modo más
            estricto: cada pestaña nueva que se abra expulsa a la anterior, igual que ya pasa hoy
            entre dos dispositivos distintos.
          </p>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Estado de la sincronización del candado al sistema del       -->
      <!-- cliente (empresa-api). Se persiste en admin y acá solo se    -->
      <!-- muestra: nunca se calcula en el front. Mismo patrón visual   -->
      <!-- que la pestaña Horarios.                                     -->
      <!-- ============================================================ -->
      <div class="card mb-3">
        <div class="card-body py-2">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div class="small">
              <span class="badge me-1" :class="sync_badge_class">{{ sync_badge_label }}</span>
              <span>{{ sync_texto }}</span>
              <!-- Motivo del backend cuando la sincronización no terminó en éxito -->
              <div v-if="sync_message" class="text-muted mt-1">{{ sync_message }}</div>
            </div>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              :disabled="sincronizando"
              @click="reintentar_sync"
            >
              {{ sincronizando ? 'Reintentando...' : 'Reintentar sincronización' }}
            </button>
          </div>
          <p class="text-muted small mb-0 mt-2">
            La sincronización corre en segundo plano; el estado de acá arriba se actualiza al volver a
            abrir la pestaña. Un cliente con una versión vieja del sistema (sin este endpoint) queda en
            "A mano": no es un error, es que todavía no se actualizó.
          </p>
        </div>
      </div>

      <!-- Error del guardado (422 del backend o falla de red) -->
      <div v-if="save_error" class="alert alert-danger py-2 small">
        {{ save_error }}
      </div>

      <div class="d-flex justify-content-end">
        <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="guardar">
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Pestaña "Candado de sesión" del detalle del cliente (admin-spa).
 *
 * Misión candado-sesion-por-pestana (19/9/2026): un interruptor que Lucas prende por cliente
 * para endurecer el candado de sesión de empresa-api, de forma que ni dos pestañas del MISMO
 * navegador puedan tener la cuenta abierta a la vez (hoy conviven a propósito).
 *
 * Mismo patrón que ClientScheduleTab (pestaña "Horarios"): carga el estado
 * (GET admin/client/{id}/candado-sesion), lo edita en local y lo guarda como un reemplazo del
 * booleano (PUT admin/client/{id}/candado-sesion), que además encola el push al empresa-api del
 * cliente en segundo plano. El estado de esa sincronización (persistido en admin) se muestra con
 * el mismo badge que usa Horarios, y se puede reintentar a mano
 * (POST admin/client/{id}/candado-sesion/sync).
 */
export default {
  name: 'ClientCandadoSesionTab',
  props: {
    /** Cliente actualmente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // true mientras se carga el estado del cliente.
      loading: false,
      // Mensaje de error de la carga inicial (null = sin error).
      load_error: null,
      // Mensaje de error del guardado (null = sin error). Se muestra tal cual lo manda el backend.
      save_error: null,
      // true mientras se guarda (PUT candado-sesion).
      saving: false,
      // true mientras se encola el reintento de sincronización (POST candado-sesion/sync).
      sincronizando: false,
      // Valor editable del interruptor.
      bloquear_pestanas_duplicadas: false,
      // Estado persistido de la sincronización al sistema del cliente.
      sync_status: null,
      sync_message: '',
      sync_synced_at: null,
    }
  },
  computed: {
    /**
     * Texto principal de la línea de estado de sincronización.
     * @returns {string}
     */
    sync_texto() {
      if (this.sync_status === 'success') {
        return this.sync_synced_at
          ? 'Sincronizado el ' + this.formatear_fecha_hora(this.sync_synced_at) + '.'
          : 'Sincronizado.'
      }
      if (this.sync_status === 'manual_required') {
        return 'No se pudo sincronizar automáticamente: hay que hacerlo a mano.'
      }
      if (this.sync_status === 'skipped') {
        return 'Sincronización salteada.'
      }
      if (this.sync_status === 'failed') {
        return 'La última sincronización falló.'
      }
      return 'Todavía no se sincronizó con el sistema del cliente.'
    },
    /**
     * Etiqueta corta del badge de estado de sincronización.
     * @returns {string}
     */
    sync_badge_label() {
      if (this.sync_status === 'success') {
        return 'Sincronizado'
      }
      if (this.sync_status === 'manual_required') {
        return 'A mano'
      }
      if (this.sync_status === 'skipped') {
        return 'Salteado'
      }
      if (this.sync_status === 'failed') {
        return 'Falló'
      }
      return 'Sin sincronizar'
    },
    /**
     * Clase Bootstrap del badge de estado de sincronización.
     * @returns {string}
     */
    sync_badge_class() {
      if (this.sync_status === 'success') {
        return 'bg-success'
      }
      if (this.sync_status === 'manual_required') {
        return 'bg-warning text-dark'
      }
      if (this.sync_status === 'failed') {
        return 'bg-danger'
      }
      return 'bg-secondary'
    },
  },
  watch: {
    /** Si cambia el cliente abierto en el modal, recarga su estado. */
    'record.id': function (nuevo_id, viejo_id) {
      if (nuevo_id && nuevo_id !== viejo_id) {
        this.cargar()
      }
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    /**
     * Carga el estado del candado de sesión del cliente (GET admin/client/{id}/candado-sesion).
     * @returns {void}
     */
    cargar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.loading = true
      self.load_error = null
      self.save_error = null
      api
        .get('/client/' + this.record.id + '/candado-sesion', { silent_error: true })
        .then(function (res) {
          self.aplicar_payload(res.data || {})
          self.loading = false
        })
        .catch(function (error) {
          self.load_error = resolve_error_message(error)
          self.loading = false
        })
    },
    /**
     * Vuelca al estado local un payload (respuesta del GET o del PUT).
     * @param {Object} payload
     * @returns {void}
     */
    aplicar_payload(payload) {
      const cuerpo = payload || {}
      this.bloquear_pestanas_duplicadas = Boolean(cuerpo.bloquear_pestanas_duplicadas)
      this.aplicar_sync(cuerpo)
    },
    /**
     * Toma el estado de sincronización del payload del backend.
     *
     * La fuente es `payload.sincronizacion.{estado, mensaje, sincronizado_at}`, que es lo que
     * devuelven el GET, el PUT y el POST .../candado-sesion/sync de `ClientSessionLockController`.
     *
     * El respaldo `this.record.{pestanas_sync_status, pestanas_sync_message,
     * pestanas_synced_at}` (las columnas persistidas en `clients`) queda solo para cuando el
     * payload no traiga el bloque.
     *
     * ⚠️ El POST de sync devuelve 202 con el estado del intento ANTERIOR: encola, no espera. Por
     * eso acá no se inventa ningún "Sincronizado" optimista.
     * @param {Object} payload
     * @returns {void}
     */
    aplicar_sync(payload) {
      const cuerpo = payload || {}
      const fuente = cuerpo.sincronizacion || {}
      const respaldo = this.record || {}
      const status = fuente.estado !== undefined ? fuente.estado : respaldo.pestanas_sync_status
      const mensaje = fuente.mensaje !== undefined ? fuente.mensaje : respaldo.pestanas_sync_message
      const momento =
        fuente.sincronizado_at !== undefined ? fuente.sincronizado_at : respaldo.pestanas_synced_at
      this.sync_status = status || null
      this.sync_message = mensaje || ''
      this.sync_synced_at = momento || null
    },
    /**
     * Guarda el interruptor (PUT admin/client/{id}/candado-sesion) y refresca el estado desde la
     * respuesta ya releída por el backend.
     * @returns {void}
     */
    guardar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.saving = true
      self.save_error = null
      api
        .put(
          '/client/' + this.record.id + '/candado-sesion',
          { bloquear_pestanas_duplicadas: this.bloquear_pestanas_duplicadas },
          { silent_error: true }
        )
        .then(function (res) {
          self.aplicar_payload(res.data || {})
          self.saving = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'Candado de sesión guardado.', variant: 'success' },
          }))
        })
        .catch(function (error) {
          self.save_error = resolve_error_message(error)
          self.saving = false
        })
    },
    /**
     * Reintenta a mano la sincronización del candado al sistema del cliente
     * (POST admin/client/{id}/candado-sesion/sync). El push va a un job, así que esto encola: el
     * estado definitivo se ve al recargar la pestaña.
     * @returns {void}
     */
    reintentar_sync() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.sincronizando = true
      api
        .post('/client/' + this.record.id + '/candado-sesion/sync', {}, { silent_error: true })
        .then(function (res) {
          self.aplicar_sync(res.data || {})
          self.sincronizando = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: {
              message: 'Sincronización encolada. Corre en segundo plano.',
              variant: 'success',
            },
          }))
        })
        .catch(function (error) {
          self.sincronizando = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: resolve_error_message(error), variant: 'danger' },
          }))
        })
    },
    /**
     * Formatea un instante ISO (con offset) como dd/mm/yyyy HH:MM en hora local.
     * @param {string} instante_iso
     * @returns {string}
     */
    formatear_fecha_hora(instante_iso) {
      if (!instante_iso) {
        return ''
      }
      const momento = new Date(instante_iso)
      if (isNaN(momento.getTime())) {
        return String(instante_iso)
      }
      const dd = String(momento.getDate()).padStart(2, '0')
      const mm = String(momento.getMonth() + 1).padStart(2, '0')
      const yyyy = momento.getFullYear()
      const hh = String(momento.getHours()).padStart(2, '0')
      const mi = String(momento.getMinutes()).padStart(2, '0')
      return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + mi
    },
  },
}
</script>
