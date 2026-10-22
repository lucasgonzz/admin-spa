<template>
  <div class="card mb-3 agentes-ia-card">
    <div class="card-body">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h6 class="mb-0">Agentes de IA</h6>

        <!-- Insignia de estado: se ve de un vistazo si el cliente la tiene -->
        <span v-if="cargando" class="badge text-bg-light border">Consultando...</span>
        <span v-else-if="activa === true" class="badge text-bg-success">Activa</span>
        <span v-else-if="activa === false" class="badge text-bg-secondary">No activa</span>
        <span v-else class="badge text-bg-warning">Sin dato</span>
      </div>

      <p class="mb-2 small">
        Una sola extensión que reúne toda la IA del sistema del cliente: el agente personal (chat y WhatsApp),
        la carga de facturas de compra desde una foto, el módulo de WhatsApp con el bot que atiende a sus
        clientes, la asignación automática de imágenes, las descripciones y fichas por código de barras, las
        categorías con IA, las sugerencias y la conexión al MCP. Quien no la tiene no accede a nada de eso.
        «Importar con IA» (Excel) no depende de esta extensión.
      </p>
      <p class="text-muted small mb-3">
        Se activa sola cuando le asignás un paquete de IA (solapa Tokens). Quitarle el paquete <strong>no</strong>
        la quita: eso se decide acá, con el botón.
      </p>

      <!-- Resultado de la última consulta o acción cuando no fue ok (versión vieja, sin clave, sin conexión...) -->
      <div v-if="aviso" class="alert py-2 small" :class="clase_del_aviso" role="alert">
        {{ aviso }}
      </div>

      <div class="d-flex flex-wrap gap-2 agentes-ia-card__acciones">
        <button
          v-if="activa === false"
          type="button"
          class="btn btn-primary"
          :disabled="ocupado"
          @click="cambiar(true)"
        >
          <span v-if="cambiando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
          {{ cambiando ? 'Activando...' : 'Activar Agentes de IA' }}
        </button>

        <button
          v-if="activa === true"
          type="button"
          class="btn btn-outline-danger"
          :disabled="ocupado"
          @click="quitar"
        >
          <span v-if="cambiando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
          {{ cambiando ? 'Quitando...' : 'Quitar Agentes de IA' }}
        </button>

        <!-- Volver a preguntar: útil si falló la conexión o si el cliente recién se actualizó -->
        <button
          type="button"
          class="btn btn-outline-secondary"
          :disabled="ocupado"
          @click="consultar"
        >
          Volver a consultar
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Bloque «Agentes de IA» de la ficha del cliente (admin-spa).
 *
 * Misión agentes-ia-extension-unica (22/10/2026): la IA del sistema del cliente quedó en una sola extensión
 * (`agentes_ia`). Este bloque lee si el cliente la tiene (GET admin/client/{id}/agentes-ia) y la activa o la quita
 * (POST con `{ activa: bool }`). El admin-api le habla al empresa-api del cliente y responde SIEMPRE HTTP 200 con
 * `{ estado, mensaje, activa }`; `estado` es uno de: ok | version_vieja | sin_clave | clave_rechazada |
 * sin_frente | sin_conexion. Solo con `ok` el campo `activa` es confiable.
 *
 * Quitarla pide confirmación (el cliente pierde de golpe todo lo de IA, incluido el bot que atiende a SUS
 * clientes por WhatsApp); activarla no.
 */
export default {
  name: 'ClientAgentesIaCard',
  props: {
    /** Id del cliente guardado (el padre no monta este bloque si todavía no hay id). */
    client_id: { type: [Number, String], required: true },
  },
  data() {
    return {
      // true mientras se hace la consulta inicial o "Volver a consultar".
      cargando: false,
      // true mientras se activa o se quita.
      cambiando: false,
      // true | false cuando el cliente confirmó su estado; null si no se pudo saber.
      activa: null,
      // Texto del último resultado que no fue ok (null = nada que avisar).
      aviso: null,
      // Estado del último resultado (para el color del aviso).
      estado: null,
    }
  },
  computed: {
    /** @returns {boolean} true si hay una llamada en curso. */
    ocupado() {
      return this.cargando || this.cambiando
    },
    /**
     * Clase de color del aviso: la versión vieja y la clave son cosas a resolver (amarillo / rojo); el resto
     * es un problema pasajero.
     * @returns {string}
     */
    clase_del_aviso() {
      if (this.estado === 'clave_rechazada' || this.estado === 'sin_frente' || this.estado === 'sin_clave') {
        return 'alert-danger'
      }
      return 'alert-warning'
    },
  },
  watch: {
    client_id() {
      this.consultar()
    },
  },
  mounted() {
    this.consultar()
  },
  methods: {
    /**
     * Pregunta al cliente si tiene la extensión.
     * @returns {void}
     */
    consultar() {
      const self = this
      self.cargando = true
      self.aviso = null
      // Se borra el valor viejo: si la consulta falla tiene que decir "Sin dato", no un estado desactualizado.
      self.activa = null
      api
        .get('/client/' + this.client_id + '/agentes-ia', { silent_error: true })
        .then(function (res) {
          self.aplicar_resultado(res.data || {})
          self.cargando = false
        })
        .catch(function (error) {
          self.estado = 'sin_conexion'
          self.aviso = resolve_error_message(error)
          self.cargando = false
        })
    },
    /**
     * Pide confirmación y la quita.
     * @returns {void}
     */
    quitar() {
      const confirmado = window.confirm(
        '¿Quitar Agentes de IA a este cliente? Pierde de inmediato el agente personal, el módulo de WhatsApp ' +
          '(incluido el bot que atiende a sus clientes), la carga de facturas con foto, la asignación automática ' +
          'de imágenes, las descripciones con IA, las categorías con IA y las sugerencias.'
      )
      if (!confirmado) {
        return
      }
      this.cambiar(false)
    },
    /**
     * Activa o quita la extensión en el sistema del cliente.
     * @param {boolean} activa true: activar; false: quitar.
     * @returns {void}
     */
    cambiar(activa) {
      const self = this
      self.cambiando = true
      self.aviso = null
      api
        .post('/client/' + this.client_id + '/agentes-ia', { activa: activa }, { silent_error: true })
        .then(function (res) {
          const cuerpo = res.data || {}
          self.aplicar_resultado(cuerpo)
          self.cambiando = false
          self.avisar(cuerpo, activa)
        })
        .catch(function (error) {
          self.cambiando = false
          self.aviso = resolve_error_message(error)
          self.estado = 'sin_conexion'
        })
    },
    /**
     * Vuelca la respuesta del backend al estado local. Solo con `ok` se confía en `activa`; si no, se deja el
     * último valor conocido sin tocar para no mostrar un "No activa" inventado por una falla de conexión.
     * @param {Object} cuerpo `{ estado, mensaje, activa }`.
     * @returns {void}
     */
    aplicar_resultado(cuerpo) {
      this.estado = cuerpo.estado || null
      if (cuerpo.estado === 'ok' && typeof cuerpo.activa === 'boolean') {
        this.activa = cuerpo.activa
        this.aviso = null
        return
      }
      // Sin confirmación del cliente no se cambia el valor que ya se tenía (una acción fallida no lo vuelve
      // "No activa"); la consulta lo borra antes de preguntar, así que ahí queda "Sin dato" con el motivo.
      this.aviso = cuerpo.mensaje || 'No se pudo consultar el estado de Agentes de IA.'
    },
    /**
     * Toast con el desenlace de activar o quitar.
     * @param {Object}  cuerpo  Respuesta del backend.
     * @param {boolean} activa  Lo que se pidió.
     * @returns {void}
     */
    avisar(cuerpo, activa) {
      const ok = cuerpo.estado === 'ok'
      window.dispatchEvent(
        new CustomEvent('admin-spa-toast', {
          detail: {
            message: ok
              ? (activa ? 'Agentes de IA activada.' : 'Agentes de IA quitada.')
              : cuerpo.mensaje || 'No se pudo cambiar Agentes de IA.',
            variant: ok ? 'success' : 'warning',
          },
        })
      )
    },
  },
}
</script>

<style scoped>
/* En teléfono los botones ocupan el ancho para tener un área de toque cómoda. */
@media (max-width: 575.98px) {
  .agentes-ia-card__acciones .btn {
    flex: 1 1 100%;
  }
}
</style>
