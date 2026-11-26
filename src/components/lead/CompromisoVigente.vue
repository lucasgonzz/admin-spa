<template>
  <!--
    El próximo contacto acordado con el lead (misión leads-referidos-compromisos, E2).

    Muestra el compromiso vigente del lead —cuándo toca, qué se acordó (llamar, escribir o esperar que avise), de dónde salió
    y el resumen— y deja moverlo («Cambiar fecha») o cancelarlo («Cancelar»). Mientras hay uno vigente, el lead no recibe los
    seguimientos automáticos genéricos; a la hora, el sistema revisa si cambió algo y ejecuta lo acordado.

    Lo usan Lucas y Juan (perfil «Sólo Leads»): Juan ve, reprograma y cancela los compromisos de sus leads, por eso NO se
    esconde según el perfil. Ninguna de sus acciones le escribe al lead. Viene de GET /lead/{id}/compromisos; si la API es
    vieja o el pedido falla, el bloque no se muestra y no se avisa. Se monta en la barra lateral de la conversación y en la
    ficha del tablero.
  -->
  <div v-if="compromiso" class="compromiso-vigente" :class="{ 'compromiso-vigente--revisar': es_para_revisar }">
    <div class="compromiso-vigente__head">
      <span class="compromiso-vigente__titulo">{{ es_para_revisar ? 'Compromiso para revisar' : 'Próximo contacto acordado' }}</span>
      <span class="compromiso-vigente__accion">{{ accion_label }}</span>
    </div>

    <p class="compromiso-vigente__cuando">{{ cuando_en_palabras }}</p>
    <p v-if="compromiso.resumen" class="compromiso-vigente__resumen">{{ compromiso.resumen }}</p>
    <p v-if="compromiso.cita_del_lead" class="compromiso-vigente__cita">«{{ compromiso.cita_del_lead }}»</p>
    <p class="compromiso-vigente__origen">{{ origen_label }}</p>

    <!-- Cambiar fecha: un selector de fecha y hora y dos botones. -->
    <div v-if="editando" class="compromiso-vigente__edicion">
      <input v-model="nueva_fecha" type="datetime-local" class="form-control form-control-sm" :disabled="saving" />
      <div class="compromiso-vigente__botones">
        <button type="button" class="btn btn-sm btn-primary" :disabled="saving || !nueva_fecha" @click="guardar_fecha">Guardar</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="saving" @click="editando = false">Volver</button>
      </div>
    </div>
    <div v-else-if="!es_para_revisar" class="compromiso-vigente__botones">
      <button type="button" class="btn btn-sm btn-outline-primary" :disabled="saving" @click="empezar_a_editar">Cambiar fecha</button>
      <button type="button" class="btn btn-sm btn-outline-danger" :disabled="saving" @click="cancelar">Cancelar</button>
    </div>
    <div v-else class="compromiso-vigente__botones">
      <button type="button" class="btn btn-sm btn-outline-danger" :disabled="saving" @click="cancelar">Cancelar</button>
    </div>

    <p v-if="error_message" class="compromiso-vigente__error">{{ error_message }}</p>
  </div>
</template>

<script>
import api from '@/utils/axios'

/** Nombres de los días, indexados como `Date.getDay()` (0 = domingo). */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** Qué hay que hacer, por acción. */
const ACCIONES = {
  llamar: 'Juan lo llama',
  escribir: 'Martín le escribe',
  esperar: 'Espera que avise el lead',
}

/** De dónde salió el compromiso. */
const ORIGENES = {
  llamada: 'Lo dejó una llamada registrada',
  ia_mensaje: 'Lo dijo el lead por WhatsApp',
  transcripcion: 'Salió de la grabación de una llamada',
  manual: 'Cargado a mano',
  agente: 'Cargado por un agente',
  reevaluacion: 'Reprogramado al revisar el contexto',
}

/**
 * Pasa `AAAA-MM-DD HH:MM:SS` (hora local de Argentina, como la devuelve la API) a un Date local.
 *
 * @param {string} texto Fecha de la API.
 * @returns {Date|null}
 */
export function fecha_de_la_api(texto) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(texto || ''))
  if (!partes) {
    return null
  }
  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]), Number(partes[4]), Number(partes[5]))
}

/**
 * La fecha en palabras: «el viernes 27/11 a las 10:00».
 *
 * @param {Date|null} fecha
 * @returns {string}
 */
export function fecha_en_palabras(fecha) {
  if (!fecha) {
    return ''
  }
  const dos = function (n) {
    return String(n).padStart(2, '0')
  }
  return 'el ' + DIAS[fecha.getDay()] + ' ' + dos(fecha.getDate()) + '/' + dos(fecha.getMonth() + 1) + ' a las ' + dos(fecha.getHours()) + ':' + dos(fecha.getMinutes())
}

export default {
  name: 'CompromisoVigente',

  props: {
    /** Lead del que se muestra el compromiso. */
    lead_id: {
      type: [Number, String],
      default: null,
    },
  },

  data() {
    return {
      /** Compromiso abierto del lead (vigente o para revisar), o null. */
      compromiso: null,
      /** Si se está eligiendo una fecha nueva. */
      editando: false,
      /** Valor del selector de fecha (`AAAA-MM-DDTHH:MM`). */
      nueva_fecha: '',
      /** Pedido en curso. */
      saving: false,
      /** Último error de un pedido. */
      error_message: '',
    }
  },

  computed: {
    /** El compromiso quedó para revisar (la IA no pudo decidir sola). */
    es_para_revisar() {
      return !!this.compromiso && this.compromiso.status === 'revisar'
    },

    /** Qué se acordó, en palabras. */
    accion_label() {
      return this.compromiso ? ACCIONES[this.compromiso.accion] || this.compromiso.accion : ''
    },

    /** Cuándo toca, en palabras. */
    cuando_en_palabras() {
      return this.compromiso ? fecha_en_palabras(fecha_de_la_api(this.compromiso.vence_at)) : ''
    },

    /** De dónde salió. */
    origen_label() {
      return this.compromiso ? ORIGENES[this.compromiso.origen] || '' : ''
    },
  },

  watch: {
    lead_id() {
      this.cargar()
    },
  },

  mounted() {
    this.cargar()
  },

  methods: {
    /**
     * Pide los compromisos del lead y se queda con el abierto (el primero de la lista, si está vigente, procesando o para revisar).
     *
     * @returns {void}
     */
    cargar() {
      const self = this
      const id = self.lead_id
      self.compromiso = null
      self.editando = false
      self.error_message = ''
      if (!id) {
        return
      }
      api
        .get('/lead/' + id + '/compromisos', { silent_error_statuses: [403, 404, 405] })
        .then(function (res) {
          if (String(self.lead_id) !== String(id)) {
            return
          }
          const lista = (res.data && res.data.compromisos) || []
          const abierto = lista.find(function (c) {
            return c.status === 'vigente' || c.status === 'procesando' || c.status === 'revisar'
          })
          self.compromiso = abierto || null
        })
        .catch(function () {
          self.compromiso = null
        })
    },

    /**
     * Abre el selector con la fecha actual del compromiso.
     *
     * @returns {void}
     */
    empezar_a_editar() {
      const fecha = fecha_de_la_api(this.compromiso.vence_at)
      const dos = function (n) {
        return String(n).padStart(2, '0')
      }
      this.nueva_fecha = fecha
        ? fecha.getFullYear() + '-' + dos(fecha.getMonth() + 1) + '-' + dos(fecha.getDate()) + 'T' + dos(fecha.getHours()) + ':' + dos(fecha.getMinutes())
        : ''
      this.error_message = ''
      this.editando = true
    },

    /**
     * Guarda la fecha nueva (PUT /lead-compromisos/{id}).
     *
     * @returns {void}
     */
    guardar_fecha() {
      const self = this
      self.saving = true
      self.error_message = ''
      api
        .put('/lead-compromisos/' + self.compromiso.id, { vence_at: self.nueva_fecha.replace('T', ' ') })
        .then(function (res) {
          self.compromiso = (res.data && res.data.model) || self.compromiso
          self.editando = false
        })
        .catch(function (err) {
          const errores = err.response && err.response.data && err.response.data.errors
          self.error_message =
            (errores && errores.vence_at && errores.vence_at[0]) || (err.response && err.response.data && err.response.data.message) || 'No se pudo cambiar la fecha.'
        })
        .then(function () {
          self.saving = false
        })
    },

    /**
     * Cancela el compromiso (POST /lead-compromisos/{id}/cancelar), con confirmación.
     *
     * @returns {void}
     */
    cancelar() {
      const self = this
      if (!window.confirm('¿Cancelar el próximo contacto acordado? El lead vuelve a recibir los seguimientos de siempre.')) {
        return
      }
      self.saving = true
      self.error_message = ''
      api
        .post('/lead-compromisos/' + self.compromiso.id + '/cancelar', {})
        .then(function () {
          self.compromiso = null
        })
        .catch(function (err) {
          self.error_message = (err.response && err.response.data && err.response.data.message) || 'No se pudo cancelar.'
        })
        .then(function () {
          self.saving = false
        })
    },
  },
}
</script>

<style scoped>
.compromiso-vigente {
	border: 1px solid var(--bs-border-color, #dee2e6);
	border-left: 3px solid var(--bs-primary, #0d6efd);
	border-radius: 0.5rem;
	margin: 0.5rem 1rem;
	padding: 0.625rem 0.75rem;
	min-width: 0;
}

.compromiso-vigente--revisar {
	border-left-color: var(--bs-warning, #ffc107);
}

.compromiso-vigente__head {
	align-items: baseline;
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	justify-content: space-between;
}

.compromiso-vigente__titulo {
	font-size: 0.75rem;
	font-weight: 600;
	letter-spacing: 0.02em;
	text-transform: uppercase;
}

.compromiso-vigente__accion {
	font-size: 0.75rem;
	opacity: 0.75;
}

.compromiso-vigente__cuando {
	font-size: 0.95rem;
	font-weight: 600;
	margin: 0.25rem 0 0.125rem;
}

.compromiso-vigente__resumen,
.compromiso-vigente__cita,
.compromiso-vigente__origen {
	font-size: 0.8125rem;
	margin: 0 0 0.25rem;
	overflow-wrap: anywhere;
}

.compromiso-vigente__cita,
.compromiso-vigente__origen {
	opacity: 0.7;
}

.compromiso-vigente__edicion {
	margin-top: 0.5rem;
}

.compromiso-vigente__botones {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	margin-top: 0.5rem;
}

.compromiso-vigente__error {
	color: var(--bs-danger, #dc3545);
	font-size: 0.8125rem;
	margin: 0.5rem 0 0;
}
</style>
