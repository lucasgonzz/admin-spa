<template>
  <div class="container-fluid px-0 py-4" style="max-width: 1080px">
    <!-- Encabezado -->
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
      <div>
        <h2 class="h4 mb-1">Paquetes de IA</h2>
        <p class="text-muted small mb-0">
          Los planes de suscripción de IA ($100 / $200 / $400, tentativos). Cada paquete define el
          tope de tokens por mes y de interacciones por día que se le envían al sistema del cliente
          cuando se le asigna. Un tope vacío significa <strong>sin límite</strong>: el cliente nunca
          corta.
        </p>
      </div>
      <button
        v-if="!loading && !load_error"
        type="button"
        class="btn btn-primary"
        @click="abrir_alta"
      >
        Nuevo paquete
      </button>
    </div>

    <!-- Carga inicial -->
    <div v-if="loading" class="text-center py-5">
      <span class="spinner-border text-primary" role="status" aria-hidden="true" />
      <p class="text-muted mt-2">Cargando paquetes…</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger">{{ load_error }}</div>

    <template v-else>
      <!-- ============================================================ -->
      <!-- Formulario de alta / edición. Aparece encima de la lista al   -->
      <!-- tocar "Nuevo paquete" o "Editar": sin modal, para no depender  -->
      <!-- del JS de Bootstrap.                                           -->
      <!-- ============================================================ -->
      <div v-if="mostrando_form" class="card mb-4">
        <div class="card-header bg-white">
          <strong>{{ editando_id ? 'Editar paquete' : 'Nuevo paquete' }}</strong>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <!-- Nombre: es lo que ve el dueño en el footer del panel de IA de su empresa. -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Nombre</label>
              <input
                v-model="form.nombre"
                type="text"
                class="form-control"
                placeholder="Ej: Básico, Intermedio, Pro"
              />
            </div>

            <!-- Precio mensual en dólares. -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Precio (USD/mes)</label>
              <div class="input-group">
                <span class="input-group-text">US$</span>
                <input
                  v-model="form.precio_usd"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control"
                  placeholder="0"
                />
              </div>
            </div>

            <!-- Tope de tokens del mes. Vacío = sin tope (el cliente no corta). -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Tope de tokens por mes</label>
              <input
                v-model="form.tope_tokens_mensual"
                type="number"
                min="0"
                step="1"
                class="form-control"
                placeholder="Sin tope"
              />
              <div class="form-text small">Dejalo vacío para no poner límite.</div>
            </div>

            <!-- Tope de interacciones del día. Vacío = sin tope. -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Tope de interacciones por día</label>
              <input
                v-model="form.tope_interacciones_diarias"
                type="number"
                min="0"
                step="1"
                class="form-control"
                placeholder="Sin tope"
              />
              <div class="form-text small">Dejalo vacío para no poner límite.</div>
            </div>

            <!-- Orden: define cómo se listan y aparecen en el select del cliente. -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Orden</label>
              <input
                v-model="form.orden"
                type="number"
                step="1"
                class="form-control"
                placeholder="0"
              />
              <div class="form-text small">Menor número, más arriba en la lista.</div>
            </div>

            <!-- Activo: un paquete inactivo no aparece para elegir en la ficha del cliente. -->
            <div class="col-md-6 d-flex align-items-end">
              <div class="form-check form-switch mb-2">
                <input
                  id="ai-plan-activo"
                  v-model="form.activo"
                  class="form-check-input"
                  type="checkbox"
                />
                <label class="form-check-label fw-semibold" for="ai-plan-activo">
                  {{ form.activo ? 'Activo' : 'Inactivo' }}
                </label>
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-end gap-2 mt-4">
            <button type="button" class="btn btn-outline-secondary" :disabled="saving" @click="cerrar_form">
              Cancelar
            </button>
            <button type="button" class="btn btn-primary" :disabled="saving" @click="guardar">
              {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Lista vacía -->
      <div v-if="paquetes.length === 0" class="alert alert-warning">
        Todavía no hay ningún paquete de IA cargado. Creá el primero con "Nuevo paquete".
      </div>

      <!-- ============================================================ -->
      <!-- Lista de paquetes.                                            -->
      <!-- ============================================================ -->
      <div v-else class="card">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Nombre</th>
                <th class="text-end">Precio</th>
                <th class="text-end">Tope tokens/mes</th>
                <th class="text-end">Tope interacciones/día</th>
                <th class="text-center">Estado</th>
                <th class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="paquete in paquetes_ordenados" :key="paquete.id" :class="{ 'text-muted': !paquete.activo }">
                <td class="fw-semibold">{{ paquete.nombre }}</td>
                <td class="text-end">{{ precio_visible(paquete.precio_usd) }}</td>
                <td class="text-end">{{ tope_visible(paquete.tope_tokens_mensual) }}</td>
                <td class="text-end">{{ tope_visible(paquete.tope_interacciones_diarias) }}</td>
                <td class="text-center">
                  <span class="badge" :class="paquete.activo ? 'bg-success' : 'bg-secondary'">
                    {{ paquete.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="text-end">
                  <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-outline-secondary" @click="abrir_edicion(paquete)">
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn"
                      :class="paquete.activo ? 'btn-outline-danger' : 'btn-outline-success'"
                      :disabled="cambiando_estado_id === paquete.id"
                      @click="alternar_activo(paquete)"
                    >
                      <span
                        v-if="cambiando_estado_id === paquete.id"
                        class="spinner-border spinner-border-sm me-1"
                        role="status"
                        aria-hidden="true"
                      />
                      {{ paquete.activo ? 'Dar de baja' : 'Reactivar' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Configuración de paquetes de IA (planes de suscripción) del admin.
 *
 * CRUD a mano contra el AiPlanController del admin-api (misión foto-sucursal-y-asistente-configurable,
 * 17/9/2026), imitando las otras pantallas de configuración a mano del admin (ComerciocityAfipConfig,
 * DemoMediaConfig) en vez del ResourceView genérico, porque este recurso expone endpoints JSON
 * directos y no pasa por el sistema de `meta` del modelo.
 *
 * Cada paquete define el nombre, el precio en dólares y los dos topes (tokens/mes e
 * interacciones/día) que después se le empujan a la instancia del cliente al asignárselo desde su
 * ficha (solapa Tokens). Un tope vacío/0 significa SIN tope: el sistema del cliente nunca corta.
 *
 * Rutas asumidas (el admin-api las construye en paralelo; confirmar contra routes/api.php):
 *   GET    /api/admin/ai-plan        -> lista
 *   POST   /api/admin/ai-plan        -> alta
 *   PUT    /api/admin/ai-plan/{id}   -> edición (y baja lógica: activo=false)
 * La baja es lógica vía `activo` (no se borra la fila), tal como pide el contrato: se resuelve con
 * un PUT que invierte `activo`, sin depender de un DELETE cuya semántica (soft delete vs marca) no
 * está especificada.
 */
export default {
  name: 'ViewAiPlansConfig',

  data() {
    return {
      /** Paquetes tal como los devuelve el backend. */
      paquetes: [],

      /** true mientras corre el GET inicial. */
      loading: false,

      /** Mensaje de error de la carga inicial (null = sin error). */
      load_error: null,

      /** true mientras se muestra el formulario de alta/edición. */
      mostrando_form: false,

      /** id del paquete en edición, o null cuando el form es un alta. */
      editando_id: null,

      /** true mientras se guarda (POST/PUT). */
      saving: false,

      /** id del paquete cuyo estado activo se está alternando (null = ninguno). */
      cambiando_estado_id: null,

      /** Campos del formulario de alta/edición. Los topes van como texto: '' = sin tope. */
      form: {
        nombre: '',
        precio_usd: '',
        tope_tokens_mensual: '',
        tope_interacciones_diarias: '',
        orden: 0,
        activo: true,
      },
    }
  },

  computed: {
    /**
     * Paquetes ordenados por `orden` y, a igualdad, por nombre. El backend probablemente ya los
     * ordena, pero ordenar acá también deja la lista estable tras una baja/reactivación sin
     * recargar en un orden distinto.
     * @returns {Array<Object>}
     */
    paquetes_ordenados() {
      return this.paquetes.slice().sort(function (a, b) {
        const orden_a = Number(a.orden || 0)
        const orden_b = Number(b.orden || 0)
        if (orden_a !== orden_b) {
          return orden_a - orden_b
        }
        return String(a.nombre || '').localeCompare(String(b.nombre || ''))
      })
    },
  },

  mounted() {
    this.cargar()
  },

  methods: {
    /**
     * Trae la lista de paquetes (GET /ai-plan), tolerando varias formas de envoltura de la
     * respuesta (array plano, {data}, {ai_plans}, {planes}).
     * @returns {void}
     */
    cargar() {
      const self = this
      self.loading = true
      self.load_error = null
      api
        .get('/ai-plan', { silent_error: true })
        .then(function (res) {
          self.paquetes = self.extraer_lista(res.data)
          self.loading = false
        })
        .catch(function (error) {
          self.load_error = resolve_error_message(error)
          self.loading = false
        })
    },

    /**
     * Normaliza la lista de paquetes desde el cuerpo de la respuesta, sea cual sea la envoltura
     * que elija el backend.
     * @param {*} cuerpo
     * @returns {Array<Object>}
     */
    extraer_lista(cuerpo) {
      if (Array.isArray(cuerpo)) {
        return cuerpo
      }
      if (cuerpo && Array.isArray(cuerpo.data)) {
        return cuerpo.data
      }
      if (cuerpo && Array.isArray(cuerpo.ai_plans)) {
        return cuerpo.ai_plans
      }
      if (cuerpo && Array.isArray(cuerpo.planes)) {
        return cuerpo.planes
      }
      return []
    },

    /**
     * Abre el formulario en modo alta, con los valores por defecto.
     * @returns {void}
     */
    abrir_alta() {
      this.editando_id = null
      this.form = {
        nombre: '',
        precio_usd: '',
        tope_tokens_mensual: '',
        tope_interacciones_diarias: '',
        orden: 0,
        activo: true,
      }
      this.mostrando_form = true
    },

    /**
     * Abre el formulario en modo edición, precargado con un paquete.
     * @param {Object} paquete
     * @returns {void}
     */
    abrir_edicion(paquete) {
      this.editando_id = paquete.id
      this.form = {
        nombre: paquete.nombre || '',
        precio_usd: paquete.precio_usd === null || paquete.precio_usd === undefined ? '' : String(paquete.precio_usd),
        tope_tokens_mensual: this.tope_a_input(paquete.tope_tokens_mensual),
        tope_interacciones_diarias: this.tope_a_input(paquete.tope_interacciones_diarias),
        orden: Number(paquete.orden || 0),
        activo: !!paquete.activo,
      }
      this.mostrando_form = true
    },

    /**
     * Cierra el formulario sin guardar.
     * @returns {void}
     */
    cerrar_form() {
      this.mostrando_form = false
      this.editando_id = null
    },

    /**
     * Convierte un tope del backend a lo que va en el input: null/0 se muestra vacío (sin tope).
     * @param {number|null} valor
     * @returns {string}
     */
    tope_a_input(valor) {
      if (valor === null || valor === undefined || Number(valor) === 0) {
        return ''
      }
      return String(valor)
    },

    /**
     * Convierte un input de tope al valor que viaja al backend: vacío -> null (sin tope).
     * @param {string} valor
     * @returns {number|null}
     */
    tope_a_payload(valor) {
      if (valor === '' || valor === null || valor === undefined) {
        return null
      }
      const numero = Number(valor)
      return isNaN(numero) ? null : numero
    },

    /**
     * Guarda el formulario: POST si es alta, PUT si es edición. Al terminar recarga la lista
     * completa (más simple y consistente que parsear la respuesta del store/update).
     * @returns {void}
     */
    guardar() {
      const self = this
      if (!String(this.form.nombre || '').trim()) {
        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: { message: 'El nombre del paquete es obligatorio.', variant: 'danger' },
        }))
        return
      }

      const payload = {
        nombre: String(this.form.nombre).trim(),
        precio_usd: this.form.precio_usd === '' || this.form.precio_usd === null ? 0 : Number(this.form.precio_usd),
        tope_tokens_mensual: this.tope_a_payload(this.form.tope_tokens_mensual),
        tope_interacciones_diarias: this.tope_a_payload(this.form.tope_interacciones_diarias),
        orden: Number(this.form.orden || 0),
        activo: !!this.form.activo,
      }

      self.saving = true
      const peticion = this.editando_id
        ? api.put('/ai-plan/' + this.editando_id, payload)
        : api.post('/ai-plan', payload)

      peticion
        .then(function () {
          self.saving = false
          self.mostrando_form = false
          self.editando_id = null
          self.cargar()
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'Paquete guardado.', variant: 'success' },
          }))
        })
        .catch(function (error) {
          self.saving = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: resolve_error_message(error), variant: 'danger' },
          }))
        })
    },

    /**
     * Baja lógica / reactivación: hace un PUT con el paquete y `activo` invertido, sin borrar la
     * fila (el contrato pide baja lógica vía `activo`). Al terminar recarga la lista.
     * @param {Object} paquete
     * @returns {void}
     */
    alternar_activo(paquete) {
      const self = this
      this.cambiando_estado_id = paquete.id
      const payload = {
        nombre: paquete.nombre,
        precio_usd: paquete.precio_usd === null || paquete.precio_usd === undefined ? 0 : Number(paquete.precio_usd),
        tope_tokens_mensual: this.tope_a_payload(this.tope_a_input(paquete.tope_tokens_mensual)),
        tope_interacciones_diarias: this.tope_a_payload(this.tope_a_input(paquete.tope_interacciones_diarias)),
        orden: Number(paquete.orden || 0),
        activo: !paquete.activo,
      }
      api
        .put('/ai-plan/' + paquete.id, payload)
        .then(function () {
          self.cambiando_estado_id = null
          self.cargar()
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: {
              message: payload.activo ? 'Paquete reactivado.' : 'Paquete dado de baja.',
              variant: 'success',
            },
          }))
        })
        .catch(function (error) {
          self.cambiando_estado_id = null
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: resolve_error_message(error), variant: 'danger' },
          }))
        })
    },

    /**
     * Precio en dólares, listo para mostrar.
     * @param {number|null} valor
     * @returns {string}
     */
    precio_visible(valor) {
      const numero = Number(valor || 0)
      return 'US$ ' + numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },

    /**
     * Tope, listo para mostrar. null/0 se lee como "Sin tope" (no como el número 0, que sería un
     * corte inmediato).
     * @param {number|null} valor
     * @returns {string}
     */
    tope_visible(valor) {
      if (valor === null || valor === undefined || Number(valor) === 0) {
        return 'Sin tope'
      }
      return Number(valor).toLocaleString('es-AR')
    },
  },
}
</script>
