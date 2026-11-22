<template>
  <BaseModal
    :show="show"
    title="Borrar datos de negocio"
    size="lg"
    @close="pedir_cierre"
  >
    <div class="reset-confirmacion">
      <!-- Aviso fuerte de lo que va a pasar -->
      <div class="alert alert-danger small">
        Borra para siempre <strong>{{ filas_texto }}</strong> filas de
        <strong class="text-break">{{ simulacion ? simulacion.base : '' }}</strong>. Se guarda un
        respaldo en el servidor del cliente. No se puede deshacer desde el panel.
      </div>

      <!-- Mientras corre: spinner y aviso de no cerrar la pestaña -->
      <div v-if="ejecutando" class="text-center py-4">
        <span class="spinner-border text-danger" role="status" aria-hidden="true"></span>
        <p class="fw-semibold mt-3 mb-1">Reiniciando los datos...</p>
        <p class="text-muted small mb-0">Puede tardar varios minutos; no cierres esta pestaña.</p>
      </div>

      <div v-else>
        <!-- Cuenta regresiva de la vigencia del token de la simulación -->
        <p class="small mb-3" :class="segundos_restantes <= 60 ? 'text-danger' : 'text-muted'">
          <template v-if="segundos_restantes > 0">
            La simulación vale por {{ cuenta_regresiva }}. Pasado ese tiempo hay que simular de nuevo.
          </template>
          <template v-else>
            La simulación venció. Cerrá esta ventana y simulá de nuevo.
          </template>
        </p>

        <label class="form-label small" for="reset-nombre-cliente">
          Escribí el nombre del cliente: <strong class="text-break">{{ client_name }}</strong>
        </label>
        <input
          id="reset-nombre-cliente"
          v-model="nombre_escrito"
          type="text"
          class="form-control mb-1"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :placeholder="client_name"
        />
        <p v-if="nombre_escrito !== '' && !nombre_coincide" class="text-muted small mb-2">
          Todavía no coincide.
        </p>

        <label class="form-label small mt-2" for="reset-motivo">Motivo (opcional)</label>
        <input
          id="reset-motivo"
          v-model="motivo"
          type="text"
          class="form-control"
          maxlength="120"
          placeholder="Ej: arrancar de cero después de la prueba"
        />
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn btn-secondary" :disabled="ejecutando" @click="pedir_cierre">
        Cancelar
      </button>
      <button
        type="button"
        class="btn btn-danger"
        :disabled="!puede_confirmar"
        @click="confirmar"
      >
        Borrar los datos
      </button>
    </template>
  </BaseModal>
</template>

<script>
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Modal de confirmación en dos pasos del reinicio de datos (paso 2 de la solapa).
 *
 * Paso A: leer el aviso. Paso B: escribir el nombre del cliente (compara con trim().toLowerCase())
 * y, si quiere, un motivo. El botón queda deshabilitado hasta que el nombre coincide, el token
 * sigue vigente y no hay un pedido en curso. No llama a la API: emite `confirmar` con el motivo.
 */
export default {
  name: 'ResetDatosConfirmacionModal',
  components: { BaseModal },
  props: {
    /** Si el modal está abierto. */
    show: { type: Boolean, default: false },
    /** Nombre del cliente que hay que escribir. */
    client_name: { type: String, default: '' },
    /** Simulación vigente (para mostrar base y total de filas). */
    simulacion: { type: Object, default: null },
    /** true mientras corre el borrado en el servidor. */
    ejecutando: { type: Boolean, default: false },
    /** Segundos que le quedan de vigencia al token de la simulación. */
    segundos_restantes: { type: Number, default: 0 },
  },
  emits: ['confirmar', 'close'],
  data() {
    return {
      // Lo que el usuario escribió en el campo de confirmación del nombre.
      nombre_escrito: '',
      // Motivo opcional que queda registrado (máx. 120 caracteres).
      motivo: '',
    }
  },
  computed: {
    /**
     * Total de filas formateado para el aviso.
     * @returns {string}
     */
    filas_texto() {
      const total = this.simulacion ? Number(this.simulacion.total_filas) || 0 : 0
      return total.toLocaleString('es-AR')
    },
    /**
     * true si el nombre escrito coincide con el del cliente (trim + minúsculas).
     * @returns {boolean}
     */
    nombre_coincide() {
      const esperado = String(this.client_name || '').trim().toLowerCase()
      return esperado !== '' && this.nombre_escrito.trim().toLowerCase() === esperado
    },
    /**
     * true si ya se puede apretar "Borrar los datos".
     * @returns {boolean}
     */
    puede_confirmar() {
      return this.nombre_coincide && this.segundos_restantes > 0 && !this.ejecutando
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
  },
  watch: {
    /** Al abrir el modal arranca con los campos limpios. */
    show(abierto) {
      if (abierto) {
        this.nombre_escrito = ''
        this.motivo = ''
      }
    },
  },
  methods: {
    /**
     * Pide cerrar el modal; no se puede cerrar mientras el borrado está corriendo.
     * @returns {void}
     */
    pedir_cierre() {
      if (this.ejecutando) {
        return
      }
      this.$emit('close')
    },
    /**
     * Confirma el borrado: avisa al orquestador con el motivo (si lo hay).
     * @returns {void}
     */
    confirmar() {
      if (!this.puede_confirmar) {
        return
      }
      this.$emit('confirmar', {
        confirm_client_name: this.nombre_escrito.trim(),
        motivo: this.motivo.trim(),
      })
    },
  },
}
</script>
