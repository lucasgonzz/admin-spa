<template>
  <div class="p-3">
    <!-- Sin cliente guardado todavía: no hay id al que pedirle los horarios -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para cargar sus horarios.
    </p>

    <!-- Carga inicial de los horarios -->
    <div v-else-if="loading" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando horarios...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <div v-else>
      <!-- ============================================================ -->
      <!-- Ayuda: las tres reglas que hacen falta para no cargar mal    -->
      <!-- los horarios. No es decorativa: sin esto, "quitar el día" y  -->
      <!-- "cerrar el día" se confunden y el negocio queda mal cargado. -->
      <!-- ============================================================ -->
      <div class="alert alert-light border small mb-3">
        <p class="mb-1">
          <strong>Cómo funcionan los horarios</strong>
        </p>
        <ul class="mb-0 ps-3">
          <li>
            <strong>«Todos los días»</strong> rige para todos los días, <em>salvo</em> los días que
            tengan su propia tarjeta acá abajo: esos lo pisan.
          </li>
          <li>
            Un día <strong>sin ningún rango</strong> significa que ese día el negocio
            <strong>está cerrado</strong>. Un día nuevo nace con <em>un rango vacío</em> para
            completar: para cerrarlo hay que quitárselo a propósito.
          </li>
          <li>
            <strong>Quitar un día no es cerrarlo.</strong> Si lo quitás, ese día vuelve a regirse por
            «Todos los días». Para cerrarlo hay que <em>quitarle el rango</em> a la tarjeta del día y
            dejarla vacía.
          </li>
          <li>
            Un rango no puede cruzar la medianoche. Un negocio que cierra a las 00:00 o más tarde se
            carga hasta <strong>23:59</strong>.
          </li>
        </ul>
      </div>

      <!-- ============================================================ -->
      <!-- Estado de la sincronización de horarios al sistema del       -->
      <!-- cliente (empresa-api). Se persiste en admin (§16.d) y acá    -->
      <!-- solo se muestra: nunca se calcula en el front.               -->
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
            abrir la pestaña.
          </p>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Alta de un día: el select se arma con los `day_keys` que      -->
      <!-- manda el backend (nunca hardcodeados acá) menos los días que  -->
      <!-- ya tienen tarjeta.                                            -->
      <!-- ============================================================ -->
      <div class="card mb-3">
        <div class="card-body py-2">
          <div class="row g-2 align-items-end">
            <div class="col-12 col-sm">
              <label class="form-label small mb-1 fw-semibold" for="horarios-dia-a-agregar">
                Agregar día
              </label>
              <select
                id="horarios-dia-a-agregar"
                v-model="dia_a_agregar"
                class="form-select form-select-sm"
                :disabled="dias_disponibles.length === 0"
              >
                <option value="">
                  {{ dias_disponibles.length === 0 ? 'Ya están todos los días cargados' : 'Elegí un día...' }}
                </option>
                <option v-for="opcion in dias_disponibles" :key="opcion.key" :value="opcion.key">
                  {{ opcion.label }}
                </option>
              </select>
            </div>
            <div class="col-12 col-sm-auto">
              <button
                type="button"
                class="btn btn-outline-primary btn-sm w-100"
                :disabled="!dia_a_agregar"
                @click="agregar_dia"
              >
                Agregar día
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Todavía no hay ningún día cargado: no es lo mismo que "cerrado" -->
      <div v-if="dias_ordenados.length === 0" class="alert alert-warning py-2 small">
        Este cliente <strong>no tiene horarios configurados</strong>. Ojo: eso no significa que esté
        cerrado, significa que no se sabe. Agregá al menos «Todos los días».
      </div>

      <!-- ============================================================ -->
      <!-- Una tarjeta por día cargado, en el orden que manda el back   -->
      <!-- (Todos los días, Lunes … Domingo).                            -->
      <!-- ============================================================ -->
      <div v-for="dia in dias_ordenados" :key="dia.dia" class="card mb-3">
        <div class="card-header bg-white d-flex flex-wrap align-items-center justify-content-between gap-2">
          <strong>{{ dia.dia_label }}</strong>
          <button type="button" class="btn btn-outline-danger btn-sm" @click="quitar_dia(dia)">
            Quitar día
          </button>
        </div>
        <div class="card-body">
          <!-- Filas de rango: dos horas y el botón de borrar ese rango -->
          <div v-for="(rango, indice) in dia.rangos" :key="indice" class="row g-2 align-items-end mb-2">
            <div class="col-6 col-sm-4 col-lg-3">
              <label class="form-label small mb-1" :for="'horario-' + dia.dia + '-desde-' + indice">
                Desde
              </label>
              <input
                :id="'horario-' + dia.dia + '-desde-' + indice"
                v-model="rango.desde"
                type="time"
                class="form-control form-control-sm"
              />
            </div>
            <div class="col-6 col-sm-4 col-lg-3">
              <label class="form-label small mb-1" :for="'horario-' + dia.dia + '-hasta-' + indice">
                Hasta
              </label>
              <input
                :id="'horario-' + dia.dia + '-hasta-' + indice"
                v-model="rango.hasta"
                type="time"
                class="form-control form-control-sm"
              />
            </div>
            <div class="col-12 col-sm-auto">
              <button
                type="button"
                class="btn btn-outline-danger btn-sm w-100"
                @click="quitar_rango(dia, indice)"
              >
                Quitar rango
              </button>
            </div>
          </div>

          <!-- Sin rangos = cerrado. Es la regla traducida a la pantalla. -->
          <div v-if="dia.rangos.length === 0" class="alert alert-secondary py-2 small mb-2">
            Sin rangos: este día el negocio está <strong>cerrado</strong>.
          </div>

          <button type="button" class="btn btn-outline-primary btn-sm" @click="agregar_rango(dia)">
            Agregar rango
          </button>

          <!-- Errores locales de esta tarjeta (feedback inmediato; la validación que manda es la del backend) -->
          <ul v-if="errores_por_dia[dia.dia] && errores_por_dia[dia.dia].length" class="text-danger small mt-2 mb-0 ps-3">
            <li v-for="(error, indice_error) in errores_por_dia[dia.dia]" :key="indice_error">
              {{ error }}
            </li>
          </ul>

          <!-- 🔴 Aclaración obligatoria: quitar el día NO es cerrarlo. -->
          <p class="text-muted small mb-0 mt-2 fst-italic">
            <template v-if="dia.dia === 'todos'">
              Si quitás «Todos los días», los días que no tengan tarjeta propia quedan
              <strong>sin configurar</strong> (no cerrados: sin dato).
            </template>
            <template v-else>
              Quitar el día <strong>no lo cierra</strong>: vuelve a regirse por «Todos los días». Para
              cerrarlo, dejá esta tarjeta sin ningún rango.
            </template>
          </p>
        </div>
      </div>

      <!-- Error del guardado (422 del backend o falla de red) -->
      <div v-if="save_error" class="alert alert-danger py-2 small">
        {{ save_error }}
      </div>

      <div class="d-flex flex-wrap justify-content-end align-items-center gap-2 mb-3">
        <span v-if="hay_errores_locales" class="text-danger small">
          Revisá los rangos marcados en rojo antes de guardar.
        </span>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="saving || hay_errores_locales"
          @click="guardar"
        >
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>

      <!-- ============================================================ -->
      <!-- Cómo queda esta semana: SOLO LECTURA. Lo resuelve el backend  -->
      <!-- (`resueltos_proximos_7_dias`), acá no se reimplementa la      -->
      <!-- regla de precedencia de «Todos los días».                     -->
      <!-- ============================================================ -->
      <div class="card">
        <div class="card-header bg-white">
          <strong>Cómo queda esta semana</strong>
          <span class="text-muted small ms-2">({{ timezone }})</span>
        </div>
        <div class="card-body">
          <p v-if="resueltos.length === 0" class="text-muted small mb-0">
            El servidor todavía no devolvió la resolución de los próximos días.
          </p>
          <div v-else class="table-responsive">
            <table class="table table-sm table-bordered small mb-0">
              <thead>
                <tr class="table-light">
                  <th>Fecha</th>
                  <th>Día</th>
                  <th>Horario</th>
                  <th>De dónde sale</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(resuelto, indice) in resueltos" :key="indice">
                  <td>{{ formatear_fecha(resuelto.fecha) }}</td>
                  <td>{{ resuelto.dia_label || resuelto.dia }}</td>
                  <td>
                    <span v-if="resuelto.rangos && resuelto.rangos.length">
                      {{ texto_rangos(resuelto.rangos) }}
                    </span>
                    <span v-else-if="resuelto.origen === 'sin_configurar'" class="text-warning-emphasis">
                      Sin configurar
                    </span>
                    <span v-else>Cerrado</span>
                  </td>
                  <td>
                    <span class="badge" :class="badge_origen(resuelto.origen)">
                      {{ label_origen(resuelto.origen) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-muted small mb-0 mt-2">
            Lo calcula el servidor con lo <strong>último guardado</strong>: se actualiza recién cuando
            apretás Guardar.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Pestaña "Horarios" del detalle del cliente (admin-spa).
 *
 * Carga los horarios del cliente (GET admin/client/{id}/horarios), los edita en
 * local (una tarjeta por día, con N rangos cada uno) y los guarda como un
 * reemplazo completo del conjunto (PUT admin/client/{id}/horarios).
 *
 * Tres cosas que NO se hacen acá a propósito:
 *  1. No se hardcodea la lista de días: `day_keys` viaja desde el backend.
 *  2. No se reimplementa la regla de precedencia de «Todos los días»: el bloque
 *     "Cómo queda esta semana" lo alimenta `resueltos_proximos_7_dias` del backend.
 *  3. La validación local es solo feedback inmediato; la que manda es la del backend
 *     (422), que se muestra tal cual venga.
 *
 * Además muestra el estado de la sincronización de horarios al empresa-api del
 * cliente (persistido en admin) y permite reintentarla
 * (POST admin/client/{id}/horarios/sync), que encola el push en segundo plano.
 */
export default {
  name: 'ClientScheduleTab',
  props: {
    /** Cliente actualmente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // true mientras se cargan los horarios del cliente.
      loading: false,
      // Mensaje de error de la carga inicial (null = sin error).
      load_error: null,
      // Mensaje de error del guardado (null = sin error). Se muestra tal cual lo manda el backend.
      save_error: null,
      // true mientras se guarda (PUT horarios).
      saving: false,
      // true mientras se encola el reintento de sincronización (POST horarios/sync).
      sincronizando: false,
      // Timezone declarado por el backend en la respuesta (nunca se asume acá).
      timezone: '',
      // Enumeración de días [{ key, label }] tal como la manda el backend. Define también el orden.
      day_keys: [],
      // Días cargados y editables: [{ dia, dia_label, rangos: [{ desde, hasta }] }].
      dias: [],
      // Resolución de los próximos 7 días calculada por el backend (solo lectura).
      resueltos: [],
      // Día elegido en el select de alta (key vacía = ninguno).
      dia_a_agregar: '',
      // Estado persistido de la sincronización al sistema del cliente (§16.d).
      sync_status: null,
      sync_message: '',
      sync_synced_at: null,
    }
  },
  computed: {
    /**
     * Días cargados, ordenados según el orden que declara `day_keys` (Todos los
     * días, Lunes … Domingo). Devuelve las mismas referencias que `dias`, así que
     * los `v-model` de los rangos siguen editando el estado real.
     * @returns {Array<Object>}
     */
    dias_ordenados() {
      const self = this
      return this.dias.slice().sort(function (a, b) {
        return self.orden_de(a.dia) - self.orden_de(b.dia)
      })
    },
    /**
     * Días de `day_keys` que todavía no tienen tarjeta, para el select de alta.
     * @returns {Array<{key: string, label: string}>}
     */
    dias_disponibles() {
      const cargados = this.dias.map(function (dia) {
        return dia.dia
      })
      return this.day_keys.filter(function (opcion) {
        return cargados.indexOf(opcion.key) === -1
      })
    },
    /**
     * Errores locales por día (feedback inmediato, no reemplaza la validación del backend):
     * horas incompletas, `hasta` que no es posterior a `desde`, y rangos superpuestos.
     * @returns {Record<string, string[]>}
     */
    errores_por_dia() {
      const errores = {}
      this.dias.forEach(function (dia) {
        const del_dia = []
        dia.rangos.forEach(function (rango, indice) {
          const desde = String(rango.desde || '')
          const hasta = String(rango.hasta || '')
          if (desde === '' || hasta === '') {
            del_dia.push('Rango ' + (indice + 1) + ': completá las dos horas.')
            return
          }
          if (hasta <= desde) {
            del_dia.push(
              'Rango ' + (indice + 1) + ': la hora de cierre tiene que ser posterior a la de apertura ' +
                '(un rango no puede cruzar la medianoche: usá 23:59).'
            )
          }
        })
        /* Solapamiento: se ordenan por hora de apertura y se compara cada uno con el anterior. */
        const completos = dia.rangos
          .filter(function (rango) {
            return String(rango.desde || '') !== '' && String(rango.hasta || '') !== '' && rango.hasta > rango.desde
          })
          .slice()
          .sort(function (a, b) {
            return a.desde < b.desde ? -1 : 1
          })
        completos.forEach(function (rango, indice) {
          if (indice > 0 && rango.desde < completos[indice - 1].hasta) {
            del_dia.push(
              'Los rangos ' + completos[indice - 1].desde + '-' + completos[indice - 1].hasta +
                ' y ' + rango.desde + '-' + rango.hasta + ' se superponen.'
            )
          }
        })
        errores[dia.dia] = del_dia
      })
      return errores
    },
    /**
     * true si algún día tiene errores locales (deshabilita el botón Guardar).
     * @returns {boolean}
     */
    hay_errores_locales() {
      const errores = this.errores_por_dia
      const claves = Object.keys(errores)
      let hay = false
      claves.forEach(function (clave) {
        if (errores[clave].length > 0) {
          hay = true
        }
      })
      return hay
    },
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
    /** Si cambia el cliente abierto en el modal, recarga sus horarios. */
    'record.id': function (nuevo_id, viejo_id) {
      if (nuevo_id && nuevo_id !== viejo_id) {
        this.cargar_horarios()
      }
    },
  },
  mounted() {
    this.cargar_horarios()
  },
  methods: {
    /**
     * Posición de un día en el orden declarado por el backend (`day_keys`).
     * Los días desconocidos van al final, para no esconderlos.
     * @param {string} clave
     * @returns {number}
     */
    orden_de(clave) {
      let posicion = -1
      this.day_keys.forEach(function (opcion, indice) {
        if (opcion.key === clave) {
          posicion = indice
        }
      })
      return posicion === -1 ? 999 : posicion
    },
    /**
     * Etiqueta visible de un día según `day_keys`; si el backend no la manda,
     * se usa la propia clave (nunca se inventa una traducción acá).
     * @param {string} clave
     * @returns {string}
     */
    label_de(clave) {
      let etiqueta = clave
      this.day_keys.forEach(function (opcion) {
        if (opcion.key === clave) {
          etiqueta = opcion.label
        }
      })
      return etiqueta
    },
    /**
     * Carga los horarios del cliente (GET admin/client/{id}/horarios).
     * @returns {void}
     */
    cargar_horarios() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.loading = true
      self.load_error = null
      self.save_error = null
      api
        .get('/client/' + this.record.id + '/horarios', { silent_error: true })
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
     * Vuelca al estado local un payload de horarios (respuesta del GET o del PUT).
     * @param {Object} payload
     * @returns {void}
     */
    aplicar_payload(payload) {
      const self = this
      this.timezone = payload.timezone || ''
      this.day_keys = Array.isArray(payload.day_keys) ? payload.day_keys : []
      this.resueltos = Array.isArray(payload.resueltos_proximos_7_dias)
        ? payload.resueltos_proximos_7_dias
        : []
      this.dias = (Array.isArray(payload.dias) ? payload.dias : []).map(function (dia) {
        return {
          dia: dia.dia,
          dia_label: dia.dia_label || self.label_de(dia.dia),
          rangos: (Array.isArray(dia.rangos) ? dia.rangos : []).map(function (rango) {
            /* Las horas se recortan a HH:MM: el input type=time no acepta segundos. */
            return {
              desde: String(rango.desde || '').slice(0, 5),
              hasta: String(rango.hasta || '').slice(0, 5),
            }
          }),
        }
      })
      this.dia_a_agregar = ''
      this.aplicar_sync(payload)
    },
    /**
     * Toma el estado de sincronización del payload del backend.
     *
     * 🔴 La fuente es `payload.sincronizacion.{estado, mensaje, sincronizado_at}`, que es
     * exactamente lo que devuelven el GET, el PUT y el POST .../horarios/sync de
     * `ClientScheduleController`. El front se alinea al backend, no al revés: el backend
     * ya está commiteado y testeado.
     *
     * El respaldo `this.record.{schedule_sync_status, schedule_sync_message,
     * schedule_synced_at}` (las columnas persistidas en `clients`, que trae el listado)
     * queda solo para cuando el payload no traiga el bloque.
     *
     * ⚠️ El POST de sync devuelve 202 con el estado del intento ANTERIOR: encola, no
     * espera. Por eso acá no se inventa ningún "Sincronizado" optimista.
     * @param {Object} payload
     * @returns {void}
     */
    aplicar_sync(payload) {
      const cuerpo = payload || {}
      const fuente = cuerpo.sincronizacion || {}
      const respaldo = this.record || {}
      const status = fuente.estado !== undefined ? fuente.estado : respaldo.schedule_sync_status
      const mensaje = fuente.mensaje !== undefined ? fuente.mensaje : respaldo.schedule_sync_message
      const momento =
        fuente.sincronizado_at !== undefined ? fuente.sincronizado_at : respaldo.schedule_synced_at
      this.sync_status = status || null
      this.sync_message = mensaje || ''
      this.sync_synced_at = momento || null
    },
    /**
     * Agrega la tarjeta del día elegido en el select, con UN rango vacío listo para
     * completar.
     *
     * 🔴 Nace con un rango, no sin ninguno: Lucas dictó «cada día tiene por defecto un
     * rango horario, y yo puedo agregar todos los que quiera». Naciendo sin rangos, quien
     * agrega «Sábado» pensando 9–13 y guarda antes de cargar las horas deja los sábados
     * cerrados en silencio. Con el rango vacío, la validación local (horas incompletas →
     * Guardar deshabilitado) no lo deja guardar a medias.
     *
     * Para dejar un día CERRADO hay que quitarle el rango: sigue siendo la regla de Lucas
     * (día sin rangos = cerrado), pero ahora es un acto deliberado.
     * @returns {void}
     */
    agregar_dia() {
      if (!this.dia_a_agregar) {
        return
      }
      const clave = this.dia_a_agregar
      const ya_esta = this.dias.some(function (dia) {
        return dia.dia === clave
      })
      if (!ya_esta) {
        this.dias.push({
          dia: clave,
          dia_label: this.label_de(clave),
          rangos: [{ desde: '', hasta: '' }],
        })
      }
      this.dia_a_agregar = ''
    },
    /**
     * Quita la tarjeta de un día. OJO: no lo cierra — lo devuelve a lo que diga
     * «Todos los días» (o a "sin configurar" si no hay tal fila). Por eso se pide
     * confirmación con el texto completo.
     * @param {Object} dia
     * @returns {void}
     */
    quitar_dia(dia) {
      const mensaje =
        dia.dia === 'todos'
          ? '¿Quitar «Todos los días»? Los días sin tarjeta propia van a quedar SIN CONFIGURAR (no cerrados).'
          : '¿Quitar ' + dia.dia_label + '? No lo cierra: vuelve a regirse por «Todos los días». Para cerrarlo, quitale el rango y dejá la tarjeta sin rangos.'
      if (!window.confirm(mensaje)) {
        return
      }
      const indice = this.dias.indexOf(dia)
      if (indice !== -1) {
        this.dias.splice(indice, 1)
      }
    },
    /**
     * Agrega un rango vacío al día.
     * @param {Object} dia
     * @returns {void}
     */
    agregar_rango(dia) {
      dia.rangos.push({ desde: '', hasta: '' })
    },
    /**
     * Quita un rango del día. Dejar el día con cero rangos es la forma de cerrarlo.
     * @param {Object} dia
     * @param {number} indice
     * @returns {void}
     */
    quitar_rango(dia, indice) {
      dia.rangos.splice(indice, 1)
    },
    /**
     * Guarda el conjunto completo de horarios (PUT admin/client/{id}/horarios) y
     * refresca el estado desde la respuesta ya releída por el backend.
     * @returns {void}
     */
    guardar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.saving = true
      self.save_error = null
      const cuerpo = {
        dias: this.dias.map(function (dia) {
          return {
            dia: dia.dia,
            rangos: dia.rangos.map(function (rango) {
              return { desde: rango.desde, hasta: rango.hasta }
            }),
          }
        }),
      }
      api
        .put('/client/' + this.record.id + '/horarios', cuerpo, { silent_error: true })
        .then(function (res) {
          self.aplicar_payload(res.data || {})
          self.saving = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'Horarios guardados.', variant: 'success' },
          }))
        })
        .catch(function (error) {
          /* El backend es el que manda: su mensaje de validación se muestra tal cual. */
          self.save_error = resolve_error_message(error)
          self.saving = false
        })
    },
    /**
     * Reintenta a mano la sincronización de horarios al sistema del cliente
     * (POST admin/client/{id}/horarios/sync). El push va a un job, así que esto
     * encola: el estado definitivo se ve al recargar la pestaña.
     * @returns {void}
     */
    reintentar_sync() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.sincronizando = true
      api
        .post('/client/' + this.record.id + '/horarios/sync', {}, { silent_error: true })
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
     * Texto de los rangos de un día resuelto: "09:00 a 13:00 · 16:00 a 21:00".
     * @param {Array<{desde: string, hasta: string}>} rangos
     * @returns {string}
     */
    texto_rangos(rangos) {
      return rangos
        .map(function (rango) {
          return String(rango.desde || '').slice(0, 5) + ' a ' + String(rango.hasta || '').slice(0, 5)
        })
        .join(' · ')
    },
    /**
     * Etiqueta visible del origen que devolvió el backend.
     * @param {string} origen
     * @returns {string}
     */
    label_origen(origen) {
      if (origen === 'dia_propio') {
        return 'Día propio'
      }
      if (origen === 'todos_los_dias') {
        return 'Todos los días'
      }
      if (origen === 'sin_configurar') {
        return 'Sin configurar'
      }
      return origen || '—'
    },
    /**
     * Clase del badge según el origen; "sin configurar" va en amarillo porque no
     * es lo mismo que cerrado.
     * @param {string} origen
     * @returns {string}
     */
    badge_origen(origen) {
      if (origen === 'dia_propio') {
        return 'bg-primary'
      }
      if (origen === 'todos_los_dias') {
        return 'bg-info text-dark'
      }
      return 'bg-warning text-dark'
    },
    /**
     * Formatea una fecha `Y-m-d` (o ISO) como dd/mm/yyyy, sin pasar por Date()
     * para no correrla de día por timezone.
     * @param {string} fecha
     * @returns {string}
     */
    formatear_fecha(fecha) {
      if (!fecha) {
        return ''
      }
      const partes = String(fecha).slice(0, 10).split('-')
      if (partes.length !== 3) {
        return String(fecha)
      }
      return partes[2] + '/' + partes[1] + '/' + partes[0]
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
