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

    <!-- Tabla ancha: scroll horizontal dentro de su contenedor -->
    <div class="reset-registros__scroll">
      <table class="table table-sm table-striped align-middle mb-0">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th class="text-end">Filas</th>
            <th>Quién</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(registro, indice) in lista" :key="registro.id || indice">
            <td class="text-nowrap">{{ formatear_fecha(registro.fecha) }}</td>
            <td class="text-nowrap">{{ registro.dry_run ? 'Simulación' : 'Borrado' }}</td>
            <td class="text-nowrap">
              <span class="badge" :class="clase_del_estado(registro.estado)">{{ registro.estado || '-' }}</span>
              <span v-if="registro.codigo" class="text-muted small ms-1">{{ registro.codigo }}</span>
            </td>
            <td class="text-end">{{ registro.total_filas !== null && registro.total_filas !== undefined ? Number(registro.total_filas).toLocaleString('es-AR') : '-' }}</td>
            <td class="text-nowrap">{{ registro.solicitante || '-' }}</td>
            <td>{{ registro.motivo || '' }}</td>
          </tr>
          <tr v-if="!cargando && lista.length === 0 && !error_carga">
            <td colspan="6" class="text-muted fst-italic">Todavía no hubo reinicios ni simulaciones.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Lista "Últimos reinicios" de la solapa "Reiniciar datos".
 *
 * Lee GET admin/client/{id}/reset-datos/registros (los últimos 10 que guardó el admin) para ver
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
      // Registros ya normalizados para la tabla.
      lista: [],
    }
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
          let filas = []
          if (Array.isArray(cuerpo)) {
            filas = cuerpo
          } else if (Array.isArray(cuerpo.admin)) {
            filas = cuerpo.admin
          } else if (Array.isArray(cuerpo.registros)) {
            filas = cuerpo.registros
          } else if (Array.isArray(cuerpo.data)) {
            filas = cuerpo.data
          }
          const normalizados = []
          filas.forEach(function (fila) {
            const resumen = fila.resumen || {}
            normalizados.push({
              id: fila.id,
              fecha: fila.created_at || fila.started_at || null,
              dry_run: Boolean(fila.dry_run) || fila.modo === 'simulacion',
              estado: fila.estado,
              codigo: fila.codigo,
              total_filas:
                fila.total_filas !== undefined ? fila.total_filas : resumen.total_filas,
              solicitante: fila.solicitante,
              motivo: fila.motivo,
            })
          })
          self.lista = normalizados
          self.cargando = false
        })
        .catch(function (error) {
          self.error_carga = resolve_error_message(error)
          self.cargando = false
        })
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
