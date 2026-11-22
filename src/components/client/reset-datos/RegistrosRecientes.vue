<template>
  <div>
    <div class="d-flex align-items-center gap-2 mb-2">
      <h6 class="reset-registros__titulo mb-0 flex-grow-1">Últimos reinicios</h6>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="cargando"
        @click="cargar"
      >
        <span v-if="cargando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        Actualizar
      </button>
    </div>

    <div v-if="error_carga" class="alert alert-danger py-2 small mb-2">{{ error_carga }}</div>

    <!-- Cuando el último registro del admin quedó sin cierre claro, se muestra el del cliente para saber si el borrado terminó -->
    <div v-if="aviso_ultimo_del_cliente" class="alert alert-warning py-2 small mb-2">
      {{ aviso_ultimo_del_cliente }}
    </div>

    <!-- Dos secciones: lo que guardó el admin y lo que registró el sistema del cliente -->
    <div v-for="seccion in secciones" :key="seccion.clave" class="mb-3">
      <div class="reset-registros__subtitulo mb-1">{{ seccion.titulo }}</div>

      <p v-if="seccion.sin_respuesta" class="small fst-italic mb-0">
        El sistema del cliente no respondió.
      </p>

      <!-- Tabla ancha: scroll horizontal dentro de su contenedor -->
      <div v-else class="reset-registros__scroll">
        <table class="table table-sm table-striped align-middle mb-0 reset-registros__tabla">
          <thead>
            <tr>
              <th class="text-nowrap">Fecha</th>
              <th class="text-nowrap">Tipo</th>
              <th class="text-nowrap">Estado</th>
              <th class="text-end text-nowrap">Filas</th>
              <th class="text-nowrap">Quién</th>
              <th class="reset-registros__motivo">Motivo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(registro, indice) in seccion.lista" :key="registro.id || indice">
              <td class="text-nowrap">{{ formatear_fecha(registro.fecha) }}</td>
              <td class="text-nowrap">{{ registro.dry_run ? 'Simulación' : 'Borrado' }}</td>
              <td class="text-nowrap">
                <span class="badge" :class="clase_del_estado(registro.estado)">{{ registro.estado || '-' }}</span>
                <!-- Sin text-muted: sobre fondos de color no llega al contraste mínimo -->
                <span v-if="registro.codigo" class="small ms-1">{{ registro.codigo }}</span>
              </td>
              <td class="text-end text-nowrap">{{ formatear_filas(registro.total_filas) }}</td>
              <td class="text-nowrap">{{ registro.solicitante || '-' }}</td>
              <td class="reset-registros__motivo">{{ registro.motivo || '' }}</td>
            </tr>
            <tr v-if="!cargando && seccion.lista.length === 0 && !error_carga">
              <td colspan="6" class="text-muted fst-italic">
                {{ seccion.clave === 'admin' ? 'Todavía no hubo reinicios ni simulaciones.' : 'El sistema del cliente no tiene registros.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Lista "Últimos reinicios" de la solapa "Reiniciar datos".
 *
 * Lee GET admin/client/{id}/reset-datos/registros (los últimos 10 que guardó el admin y, en `cliente`, los que registró empresa-api) para ver
 * el resultado aunque el pedido largo haya vencido por tiempo en el navegador. Se recarga solo
 * cuando cambia la prop `refrescar`.
 */
export default {
  name: 'ResetDatosRegistrosRecientes',
  props: {
    /** Id del cliente. */
    client_id: { type: [Number, String], required: true },
    /** Contador que sube cada vez que hay que recargar la lista. */
    refrescar: { type: Number, default: 0 },
  },
  data() {
    return {
      // true mientras se pide la lista.
      cargando: false,
      // Mensaje de error de la carga (null = sin error).
      error_carga: null,
      // Registros del admin ya normalizados para la tabla.
      lista: [],
      // Registros que guardó el sistema del cliente (empresa-api), normalizados.
      lista_cliente: [],
      // true si el admin no pudo traer los registros del cliente (`cliente` null o ausente).
      cliente_sin_respuesta: false,
    }
  },
  computed: {
    /**
     * Las dos secciones que se muestran: lo del admin y lo registrado en el sistema del cliente.
     * @returns {Array<{clave: string, titulo: string, lista: Array, sin_respuesta: boolean}>}
     */
    secciones() {
      return [
        { clave: 'admin', titulo: 'Registrado en el admin', lista: this.lista, sin_respuesta: false },
        {
          clave: 'cliente',
          titulo: 'Registrado en el sistema del cliente',
          lista: this.lista_cliente,
          sin_respuesta: this.cliente_sin_respuesta,
        },
      ]
    },
    /**
     * Si el último registro del admin quedó en `sin_respuesta` o `error`, resume el último
     * registro del cliente (fecha, tipo, estado y filas) para saber si el borrado terminó.
     * @returns {string} Texto del aviso, o '' si no corresponde mostrarlo.
     */
    aviso_ultimo_del_cliente() {
      const ultimo_admin = this.lista[0]
      if (!ultimo_admin || ['sin_respuesta', 'error'].indexOf(ultimo_admin.estado) === -1) {
        return ''
      }
      if (this.cliente_sin_respuesta) {
        return 'El último pedido quedó sin cierre claro y el sistema del cliente no respondió: no se puede confirmar si el borrado terminó.'
      }
      const ultimo_cliente = this.lista_cliente[0]
      if (!ultimo_cliente) {
        return 'El último pedido quedó sin cierre claro y el sistema del cliente no tiene registros.'
      }
      return (
        'El último pedido quedó sin cierre claro. Último registro del sistema del cliente: ' +
        this.formatear_fecha(ultimo_cliente.fecha) +
        ', ' +
        (ultimo_cliente.dry_run ? 'simulación' : 'ejecución') +
        ', estado ' +
        (ultimo_cliente.estado || '-') +
        ', ' +
        this.formatear_filas(ultimo_cliente.total_filas) +
        ' filas.'
      )
    },
  },
  watch: {
    /** Recarga cuando el orquestador avisa que hubo una simulación o un borrado nuevo. */
    refrescar() {
      this.cargar()
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    /**
     * Pide los últimos registros al admin y los normaliza. Acepta tanto un arreglo directo como
     * {admin: [...]} / {registros: [...]}, para no depender de una forma exacta.
     * @returns {void}
     */
    cargar() {
      const self = this
      self.cargando = true
      self.error_carga = null
      api
        .get('/client/' + this.client_id + '/reset-datos/registros', { silent_error: true })
        .then(function (res) {
          const cuerpo = res.data || {}
          // Admin: arreglo directo o {admin|registros|data: [...]}.
          let filas_admin = []
          if (Array.isArray(cuerpo)) {
            filas_admin = cuerpo
          } else {
            filas_admin = self.extraer_arreglo(cuerpo.admin) || self.extraer_arreglo(cuerpo.registros) || self.extraer_arreglo(cuerpo.data) || []
          }
          self.lista = self.normalizar(filas_admin)
          // Cliente: null/ausente = el sistema del cliente no respondió; si no, arreglo u objeto con arreglo.
          const bloque_cliente = Array.isArray(cuerpo) ? null : cuerpo.cliente
          if (bloque_cliente === null || bloque_cliente === undefined) {
            self.cliente_sin_respuesta = !Array.isArray(cuerpo)
            self.lista_cliente = []
          } else {
            self.cliente_sin_respuesta = false
            self.lista_cliente = self.normalizar(self.extraer_arreglo(bloque_cliente) || [])
          }
          self.cargando = false
        })
        .catch(function (error) {
          self.error_carga = resolve_error_message(error)
          self.cargando = false
        })
    },
    /**
     * Saca un arreglo de registros de un valor que puede ser el arreglo mismo o un objeto con el
     * arreglo adentro (`registros`, `data` o `admin`).
     * @param {*} valor
     * @returns {Array|null} El arreglo, o null si no se encuentra.
     */
    extraer_arreglo(valor) {
      if (Array.isArray(valor)) {
        return valor
      }
      if (valor && typeof valor === 'object') {
        const claves = ['registros', 'data', 'admin']
        for (let i = 0; i < claves.length; i++) {
          if (Array.isArray(valor[claves[i]])) {
            return valor[claves[i]]
          }
        }
      }
      return null
    },
    /**
     * Normaliza filas del admin o del cliente a la forma que usa la tabla. El admin trae
     * `created_at`/`dry_run`; empresa-api trae `started_at`/`finished_at`/`modo`.
     * @param {Array<Object>} filas
     * @returns {Array<Object>}
     */
    normalizar(filas) {
      const normalizados = []
      filas.forEach(function (fila) {
        const resumen = fila.resumen || {}
        normalizados.push({
          id: fila.id,
          fecha: fila.created_at || fila.started_at || fila.finished_at || null,
          dry_run: Boolean(fila.dry_run) || fila.modo === 'simulacion',
          estado: fila.estado,
          codigo: fila.codigo,
          total_filas: fila.total_filas !== undefined ? fila.total_filas : resumen.total_filas,
          solicitante: fila.solicitante,
          motivo: fila.motivo,
        })
      })
      return normalizados
    },
    /**
     * Cantidad de filas con separador de miles, o "-" si no hay dato.
     * @param {number|null|undefined} valor
     * @returns {string}
     */
    formatear_filas(valor) {
      return valor !== null && valor !== undefined ? Number(valor).toLocaleString('es-AR') : '-'
    },
    /**
     * Clase del badge según el estado del registro.
     * @param {string} estado
     * @returns {string}
     */
    clase_del_estado(estado) {
      if (estado === 'ok') {
        return 'bg-success'
      }
      if (estado === 'ok_con_advertencias') {
        return 'bg-warning text-dark'
      }
      if (estado === 'sin_respuesta') {
        return 'bg-warning text-dark'
      }
      if (estado === 'rechazado') {
        return 'bg-secondary'
      }
      return 'bg-danger'
    },
    /**
     * Formatea un instante ISO como dd/mm/yyyy HH:MM en hora local.
     * @param {string} instante_iso
     * @returns {string}
     */
    formatear_fecha(instante_iso) {
      if (!instante_iso) {
        return '-'
      }
      const momento = new Date(instante_iso)
      if (isNaN(momento.getTime())) {
        return String(instante_iso)
      }
      const dd = String(momento.getDate()).padStart(2, '0')
      const mm = String(momento.getMonth() + 1).padStart(2, '0')
      const hh = String(momento.getHours()).padStart(2, '0')
      const mi = String(momento.getMinutes()).padStart(2, '0')
      return dd + '/' + mm + '/' + momento.getFullYear() + ' ' + hh + ':' + mi
    },
  },
}
</script>

<style scoped lang="scss">
.reset-registros__subtitulo {
	font-size: 0.8rem;
	font-weight: 600;
}

/* Ancho mínimo: si no entra, el contenedor scrollea en horizontal en vez de aplastar columnas. */
.reset-registros__tabla {
	min-width: 34rem;
	overflow-wrap: normal;
	word-break: normal;
}

/* El motivo es el único texto largo: envuelve por palabras con un ancho mínimo. */
.reset-registros__motivo {
	min-width: 12rem;
	white-space: normal;
}

.reset-registros__titulo {
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #6c757d;
}

/* Tabla ancha: scrollea horizontal adentro de su caja, sin desbordar la página. */
.reset-registros__scroll {
	overflow-x: auto;
	max-width: 100%;
	border: 1px solid var(--bs-border-color, #dee2e6);
	border-radius: 0.5rem;
}
</style>
