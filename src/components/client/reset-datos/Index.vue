<template>
  <div class="p-2 p-sm-3 reset-datos">
    <!-- Sin cliente guardado todavía: no hay id al que pedirle nada -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para poder reiniciar sus datos.
    </p>

    <div v-else>
      <div class="alert alert-warning small">
        <strong>Herramienta delicada.</strong> Borra los datos de negocio del sistema de este cliente
        (artículos, ventas, clientes, cuentas corrientes, stock, etc.) y deja los IDs en 1. Se
        conserva la configuración: usuarios, permisos, ARCA, listas de precios y cajas (en cero).
        Siempre se simula antes, y antes de borrar el sistema del cliente guarda un respaldo.
      </div>

      <!-- Error del último pedido (simular o ejecutar) -->
      <div v-if="error_mensaje" class="alert alert-danger py-2 small">
        <div>{{ error_mensaje }}</div>
        <!-- Hereda el color oscuro de la alerta (text-muted sobre fondo rosa no llega a 4,5:1) -->
        <div v-if="error_codigo" class="small">Código: {{ error_codigo }}</div>
        <!-- Pedido de ejecución que quedó sin respuesta clara: el borrado pudo terminar igual -->
        <div v-if="error_puede_haber_terminado" class="mt-1 fw-semibold">
          El borrado puede haber terminado igual: mirá "Últimos reinicios" (incluido lo registrado en
          el sistema del cliente) antes de volver a intentar.
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Resultado del borrado (aparece al terminar la ejecución)     -->
      <!-- ============================================================ -->
      <div v-if="resultado" class="card mb-3">
        <div class="card-body">
          <h6 class="mb-2">
            <span class="badge me-1" :class="resultado.estado === 'ok' ? 'bg-success' : 'bg-warning text-dark'">
              {{ resultado.estado === 'ok' ? 'Listo' : 'Listo, con advertencias' }}
            </span>
            Datos reiniciados
          </h6>
          <ul class="small ps-3 mb-2">
            <li>
              Filas vaciadas: <strong>{{ formatear_numero(resultado.total_filas) }}</strong> en
              {{ cantidad_de_tablas_vaciadas }} tablas con datos de <span class="text-break">{{ resultado.base }}</span>.
            </li>
            <li v-if="resultado.respaldo">
              Respaldo: <span class="text-break">{{ resultado.respaldo.ruta_relativa }}</span>
              ({{ formatear_bytes(resultado.respaldo.bytes) }}) en el servidor del cliente.
            </li>
            <li v-if="resultado.archivos">
              Archivos movidos al respaldo: {{ formatear_numero(resultado.archivos.movidos) }}.
            </li>
            <li v-if="resultado.duracion_ms">
              Duración: {{ Math.round(resultado.duracion_ms / 1000) }} s.
            </li>
          </ul>
          <div v-if="advertencias_del_resultado.length > 0" class="alert alert-warning py-2 small mb-0">
            <div class="fw-semibold">Advertencias</div>
            <div v-for="(aviso, indice) in advertencias_del_resultado" :key="indice" class="text-break">
              {{ aviso }}
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Paso 1: simular                                               -->
      <!-- ============================================================ -->
      <section class="reset-datos__panel mb-3">
        <h6 class="reset-datos__titulo">Paso 1 · Simular</h6>
        <p class="small text-muted">
          Cuenta lo que se borraría, sin tocar nada. El resultado vale 15 minutos.
        </p>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="simulando || ejecutando"
          @click="simular"
        >
          <span v-if="simulando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
          {{ simulando ? 'Simulando...' : (simulacion ? 'Simular de nuevo' : 'Simular') }}
        </button>

        <div v-if="simulacion" class="mt-3">
          <SimulacionResumen
            :simulacion="simulacion"
            :incluir_comprobantes_con_cae="incluir_comprobantes_con_cae"
            :incluir_integraciones_conectadas="incluir_integraciones_conectadas"
            :deshabilitado="simulando || ejecutando"
            @update:incluir_comprobantes_con_cae="incluir_comprobantes_con_cae = $event"
            @update:incluir_integraciones_conectadas="incluir_integraciones_conectadas = $event"
            @resimular="simular"
          />
        </div>
      </section>

      <!-- ============================================================ -->
      <!-- Paso 2: borrar (sólo con simulación ejecutable y token vivo)  -->
      <!-- ============================================================ -->
      <section v-if="simulacion" class="reset-datos__panel mb-3">
        <h6 class="reset-datos__titulo">Paso 2 · Borrar datos de negocio</h6>
        <p v-if="!simulacion.ejecutable" class="small text-muted mb-0">
          La simulación tiene bloqueos: resolvelos o tildá lo que corresponda y simulá de nuevo.
        </p>
        <p v-else-if="!token_vigente" class="small text-danger mb-0">
          La simulación venció (pasaron más de 15 minutos). Simulá de nuevo para poder borrar.
        </p>
        <div v-else>
          <p class="small text-muted">
            Quedan {{ cuenta_regresiva }} de vigencia. Vas a tener que escribir el nombre del cliente
            para confirmar.
          </p>
          <button type="button" class="btn btn-danger btn-sm" :disabled="ejecutando" @click="abrir_modal">
            Borrar datos de negocio...
          </button>
        </div>
      </section>

      <!-- ============================================================ -->
      <!-- Últimos reinicios                                             -->
      <!-- ============================================================ -->
      <section class="reset-datos__panel">
        <RegistrosRecientes :client_id="record.id" :refrescar="refrescar_registros" />
      </section>

      <ConfirmacionModal
        :show="modal_abierto"
        :client_name="nombre_del_cliente"
        :simulacion="simulacion"
        :ejecutando="ejecutando"
        :segundos_restantes="segundos_restantes"
        @close="modal_abierto = false"
        @confirmar="ejecutar"
      />
    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'
import SimulacionResumen from './SimulacionResumen.vue'
import ConfirmacionModal from './ConfirmacionModal.vue'
import RegistrosRecientes from './RegistrosRecientes.vue'

/**
 * Solapa "Reiniciar datos" de la ficha del cliente (misión reset-datos-cliente).
 *
 * Orquesta el flujo de dos pasos contra el admin-api (que reenvía al sistema del cliente):
 *   1. POST admin/client/{id}/reset-datos/simular   (no toca nada, devuelve un token de 15 min)
 *   2. POST admin/client/{id}/reset-datos/ejecutar  (borra; exige nombre del cliente + token)
 * y lista los últimos reinicios (GET admin/client/{id}/reset-datos/registros).
 *
 * Los errores se muestran con el `mensaje` del cuerpo (silent_error: true, como CandadoSesionTab).
 */
export default {
  name: 'ClientResetDatosTab',
  components: { SimulacionResumen, ConfirmacionModal, RegistrosRecientes },
  props: {
    /** Cliente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // Última simulación recibida (cuerpo C1 + client_id y frente); null si no hay.
      simulacion: null,
      // true mientras se pide la simulación.
      simulando: false,
      // true mientras corre el borrado en el servidor (puede tardar minutos).
      ejecutando: false,
      // Freno levantable: incluir comprobantes con CAE.
      incluir_comprobantes_con_cae: false,
      // Freno levantable: seguir aunque haya integraciones conectadas.
      incluir_integraciones_conectadas: false,
      // true cuando el modal de confirmación está abierto.
      modal_abierto: false,
      // Texto del error del último pedido y su código (si lo trae).
      error_mensaje: null,
      error_codigo: null,
      // true si el último error fue de la ejecución y el borrado pudo haber terminado igual.
      error_puede_haber_terminado: false,
      // Cuerpo de la ejecución terminada (C1); null hasta que termina una.
      resultado: null,
      // Instante actual en ms; se actualiza cada segundo para la cuenta regresiva.
      ahora: Date.now(),
      // Handle del setInterval del reloj de la cuenta regresiva.
      reloj: null,
      // Contador que le avisa a la lista de registros que se recargue.
      refrescar_registros: 0,
    }
  },
  computed: {
    /**
     * Nombre del cliente que hay que escribir para confirmar (campo `name`, el mismo que compara
     * el backend).
     * @returns {string}
     */
    nombre_del_cliente() {
      return this.record && this.record.name ? String(this.record.name) : ''
    },
    /**
     * Segundos que le quedan al token de la simulación (0 si no hay o ya venció).
     * @returns {number}
     */
    segundos_restantes() {
      if (!this.simulacion || !this.simulacion.token_vence_en) {
        return 0
      }
      const vence = new Date(this.simulacion.token_vence_en).getTime()
      if (isNaN(vence)) {
        return 0
      }
      return Math.max(0, Math.floor((vence - this.ahora) / 1000))
    },
    /**
     * true si hay token de simulación y todavía no venció.
     * @returns {boolean}
     */
    token_vigente() {
      return Boolean(this.simulacion && this.simulacion.token_de_simulacion) && this.segundos_restantes > 0
    },
    /**
     * Cuenta regresiva en formato m:ss.
     * @returns {string}
     */
    cuenta_regresiva() {
      const minutos = Math.floor(this.segundos_restantes / 60)
      const segundos = this.segundos_restantes % 60
      return minutos + ':' + String(segundos).padStart(2, '0')
    },
    /**
     * Cantidad de tablas que tenían filas y quedaron vaciadas en la ejecución (misma regla que
     * "con datos" de la simulación: las que ya estaban en 0 no cuentan).
     * @returns {number}
     */
    cantidad_de_tablas_vaciadas() {
      const vaciadas = this.resultado && this.resultado.vaciadas ? this.resultado.vaciadas : {}
      let cantidad = 0
      Object.keys(vaciadas).forEach(function (tabla) {
        if ((Number(vaciadas[tabla]) || 0) > 0) {
          cantidad++
        }
      })
      return cantidad
    },
    /**
     * Advertencias de la ejecución en una sola lista de textos: ajustes salteados, errores al
     * mover archivos, tablas que quedaron con filas, IDs sin reiniciar y las que traiga el backend.
     * @returns {Array<string>}
     */
    advertencias_del_resultado() {
      const self = this
      const r = this.resultado
      const lista = []
      if (!r) {
        return lista
      }
      if (Array.isArray(r.advertencias)) {
        r.advertencias.forEach(function (aviso) {
          lista.push(self.texto_legible(aviso))
        })
      }
      if (Array.isArray(r.ajustes_salteados) && r.ajustes_salteados.length > 0) {
        lista.push('Ajustes salteados: ' + this.texto_legible(r.ajustes_salteados))
      }
      if (r.archivos && Array.isArray(r.archivos.errores) && r.archivos.errores.length > 0) {
        lista.push('No se pudieron mover algunos archivos: ' + this.texto_legible(r.archivos.errores))
      }
      const verificacion = r.verificacion || {}
      if (Array.isArray(verificacion.tablas_con_filas) && verificacion.tablas_con_filas.length > 0) {
        lista.push('Tablas que quedaron con filas: ' + verificacion.tablas_con_filas.join(', '))
      }
      if (
        Array.isArray(verificacion.auto_increment_sin_reiniciar) &&
        verificacion.auto_increment_sin_reiniciar.length > 0
      ) {
        lista.push('IDs sin reiniciar en: ' + verificacion.auto_increment_sin_reiniciar.join(', '))
      }
      return lista
    },
  },
  watch: {
    /** Si se abre otro cliente en el mismo modal, se descarta todo el estado del anterior. */
    'record.id': function (nuevo_id, viejo_id) {
      if (nuevo_id !== viejo_id) {
        this.limpiar_todo()
      }
    },
  },
  mounted() {
    // Reloj de un segundo para la cuenta regresiva del token.
    const self = this
    this.reloj = setInterval(function () {
      self.ahora = Date.now()
    }, 1000)
  },
  beforeUnmount() {
    if (this.reloj) {
      clearInterval(this.reloj)
      this.reloj = null
    }
  },
  methods: {
    /**
     * Descarta simulación, resultado, errores y checkboxes (cambio de cliente).
     * @returns {void}
     */
    limpiar_todo() {
      this.simulacion = null
      this.resultado = null
      this.error_mensaje = null
      this.error_codigo = null
      this.error_puede_haber_terminado = false
      this.modal_abierto = false
      this.incluir_comprobantes_con_cae = false
      this.incluir_integraciones_conectadas = false
    },
    /**
     * Guarda en el estado el error de un pedido: usa el `mensaje` del cuerpo (contrato C2/C3) y,
     * si no está, el `message`; sin respuesta (timeout, red) usa un texto propio.
     * Si el pedido era la EJECUCIÓN y no hubo respuesta (timeout, red) o la puerta de enlace
     * contestó 502/503/504, marca `error_puede_haber_terminado`: el borrado pudo completarse igual.
     * @param {Object} error Error de axios.
     * @param {boolean} durante_ejecucion true si el pedido fallido fue el de ejecutar.
     * @returns {void}
     */
    registrar_error(error, durante_ejecucion) {
      const estado_http = error && error.response ? error.response.status : null
      this.error_puede_haber_terminado =
        Boolean(durante_ejecucion) && (!error || !error.response || [502, 503, 504].indexOf(estado_http) !== -1)
      const cuerpo = error && error.response && error.response.data ? error.response.data : null
      if (cuerpo && (cuerpo.mensaje || cuerpo.message)) {
        this.error_mensaje = cuerpo.mensaje || cuerpo.message
        this.error_codigo = cuerpo.error || null
        return
      }
      this.error_codigo = null
      if (error && error.response) {
        this.error_mensaje = 'El servidor respondió con un error (código ' + error.response.status + ').'
      } else {
        this.error_mensaje =
          'No se recibió respuesta del servidor (tiempo de espera o corte de red).'
      }
    },
    /**
     * Paso 1: pide la simulación (POST .../reset-datos/simular) con los flags tildados.
     * @returns {void}
     */
    simular() {
      const self = this
      if (!this.record || !this.record.id || this.simulando || this.ejecutando) {
        return
      }
      self.simulando = true
      self.error_mensaje = null
      self.error_codigo = null
      self.error_puede_haber_terminado = false
      self.resultado = null
      api
        .post(
          '/client/' + this.record.id + '/reset-datos/simular',
          {
            incluir_comprobantes_con_cae: this.incluir_comprobantes_con_cae,
            incluir_integraciones_conectadas: this.incluir_integraciones_conectadas,
          },
          { silent_error: true }
        )
        .then(function (res) {
          self.simulacion = res.data || null
          self.ahora = Date.now()
          self.simulando = false
          self.refrescar_registros++
        })
        .catch(function (error) {
          self.simulacion = null
          self.registrar_error(error)
          self.simulando = false
          self.refrescar_registros++
        })
    },
    /**
     * Abre el modal de confirmación (sólo si la simulación es ejecutable y el token está vivo).
     * @returns {void}
     */
    abrir_modal() {
      if (this.simulacion && this.simulacion.ejecutable && this.token_vigente) {
        this.error_mensaje = null
        this.error_codigo = null
        this.error_puede_haber_terminado = false
        this.modal_abierto = true
      }
    },
    /**
     * Paso 2: ejecuta el borrado (POST .../reset-datos/ejecutar). Sin timeout de axios: el
     * borrado puede tardar varios minutos (el admin-api espera hasta 15 min).
     * @param {{confirm_client_name: string, motivo: string}} datos Lo que escribió el usuario.
     * @returns {void}
     */
    ejecutar(datos) {
      const self = this
      if (!this.simulacion || this.ejecutando) {
        return
      }
      const cuerpo = {
        confirm_client_name: datos.confirm_client_name,
        confirmar_base_de_datos: this.simulacion.base,
        token_de_simulacion: this.simulacion.token_de_simulacion,
        incluir_comprobantes_con_cae: this.incluir_comprobantes_con_cae,
        incluir_integraciones_conectadas: this.incluir_integraciones_conectadas,
      }
      if (datos.motivo) {
        cuerpo.motivo = datos.motivo
      }
      self.ejecutando = true
      self.error_mensaje = null
      self.error_codigo = null
      self.error_puede_haber_terminado = false
      api
        .post('/client/' + this.record.id + '/reset-datos/ejecutar', cuerpo, {
          silent_error: true,
          timeout: 0,
        })
        .then(function (res) {
          self.resultado = res.data || null
          // El token es de un solo uso: la simulación ya no sirve.
          self.simulacion = null
          self.ejecutando = false
          self.modal_abierto = false
          self.refrescar_registros++
        })
        .catch(function (error) {
          self.registrar_error(error, true)
          self.ejecutando = false
          self.modal_abierto = false
          self.refrescar_registros++
        })
    },
    /**
     * Formatea un entero con separador de miles en es-AR.
     * @param {number} valor
     * @returns {string}
     */
    formatear_numero(valor) {
      return (Number(valor) || 0).toLocaleString('es-AR')
    },
    /**
     * Convierte un valor del backend (texto, número, arreglo u objeto) en texto legible, sin
     * corchetes ni comillas: los textos van tal cual, los objetos como "clave: valor" y los
     * arreglos con sus elementos separados por coma.
     * @param {*} valor
     * @returns {string}
     */
    texto_legible(valor) {
      const self = this
      if (valor === null || valor === undefined) {
        return ''
      }
      if (Array.isArray(valor)) {
        return valor
          .map(function (elemento) {
            return self.texto_legible(elemento)
          })
          .join(', ')
      }
      if (typeof valor === 'object') {
        return Object.keys(valor)
          .map(function (clave) {
            return clave + ': ' + self.texto_legible(valor[clave])
          })
          .join(', ')
      }
      return String(valor)
    },
    /**
     * Formatea bytes en B / KB / MB / GB.
     * @param {number} bytes
     * @returns {string}
     */
    formatear_bytes(bytes) {
      let valor = Number(bytes) || 0
      const unidades = ['B', 'KB', 'MB', 'GB']
      let indice = 0
      while (valor >= 1024 && indice < unidades.length - 1) {
        valor = valor / 1024
        indice++
      }
      return (indice === 0 ? valor : valor.toFixed(1)) + ' ' + unidades[indice]
    },
  },
}
</script>

<style scoped lang="scss">
/* Misma familia visual que Ficha de soporte: paneles claros sin borde pesado. */
.reset-datos {
	max-width: 100%;
	overflow-wrap: anywhere;
}

/* Las tablas no parten palabras ni números letra por letra: el scroll horizontal vive en su contenedor. */
.reset-datos :deep(table) {
	overflow-wrap: normal;
	word-break: normal;
}

.reset-datos__panel {
	background: #f7f7f8;
	border-radius: 0.75rem;
	padding: 0.85rem 1rem;
}

.reset-datos__titulo {
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #6c757d;
}
</style>
