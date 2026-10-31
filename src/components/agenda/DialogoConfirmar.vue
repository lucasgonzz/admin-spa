<template>
  <!--
    Diálogo oscuro de confirmación, el de "Discard changes?" de Structured: fondo desenfocado,
    título, explicación y dos botones (el de seguir, neutro; el de confirmar, en rojo si destruye
    algo). Lo usan el panel de la tarea (descartar cambios, borrar) y la selección múltiple
    (borrar varias).
  -->
  <div class="ag-dialogo" role="presentation" @mousedown.self="$emit('cancelar')">
    <div
      class="ag-dialogo__caja"
      role="alertdialog"
      aria-modal="true"
      :aria-labelledby="id_titulo"
      :aria-describedby="id_texto"
    >
      <div class="ag-dialogo__cuerpo">
        <p :id="id_titulo" class="ag-dialogo__titulo">{{ titulo }}</p>
        <p :id="id_texto" class="ag-dialogo__texto">{{ texto }}</p>
      </div>
      <div class="ag-dialogo__pie">
        <button ref="boton_cancelar" type="button" class="ag-dialogo__boton" :disabled="ocupado" @click="$emit('cancelar')">
          {{ texto_cancelar }}
        </button>
        <button
          type="button"
          class="ag-dialogo__boton"
          :class="peligroso ? 'ag-dialogo__boton--peligro' : 'ag-dialogo__boton--principal'"
          :disabled="ocupado"
          @click="$emit('confirmar')"
        >
          <span v-if="ocupado" class="ag-dialogo__girando" aria-hidden="true" />
          {{ texto_confirmar }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
/** Contador para que cada diálogo tenga ids únicos de título y texto (accesibilidad). */
let contador_dialogos = 0

export default {
  name: 'AgendaDialogoConfirmar',
  props: {
    /** Título en negrita ("¿Descartar cambios?"). */
    titulo: { type: String, required: true },
    /** Explicación debajo del título. */
    texto: { type: String, default: '' },
    /** Rótulo del botón que vuelve atrás. */
    texto_cancelar: { type: String, default: 'Cancelar' },
    /** Rótulo del botón que confirma. */
    texto_confirmar: { type: String, default: 'Confirmar' },
    /** true si confirmar destruye algo (botón en rojo). */
    peligroso: { type: Boolean, default: true },
    /** true mientras se ejecuta la acción confirmada (botones deshabilitados). */
    ocupado: { type: Boolean, default: false },
  },
  emits: ['cancelar', 'confirmar'],
  data() {
    contador_dialogos = contador_dialogos + 1
    return {
      /** Id del título para aria-labelledby. */
      id_titulo: 'ag-dialogo-titulo-' + contador_dialogos,
      /** Id del texto para aria-describedby. */
      id_texto: 'ag-dialogo-texto-' + contador_dialogos,
    }
  },
  mounted() {
    const self = this
    /* Escape vuelve atrás; se escucha en captura para ganarle al Escape del panel de atrás. */
    document.addEventListener('keydown', self.on_tecla, true)
    self.$nextTick(function () {
      if (self.$refs.boton_cancelar) {
        self.$refs.boton_cancelar.focus()
      }
    })
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.on_tecla, true)
  },
  methods: {
    /**
     * Escape cancela (y no deja que el evento llegue al panel, que lo tomaría como "cerrar").
     *
     * @param {KeyboardEvent} evento
     * @returns {void}
     */
    on_tecla(evento) {
      if (evento.key !== 'Escape') {
        return
      }
      evento.stopPropagation()
      evento.preventDefault()
      if (!this.ocupado) {
        this.$emit('cancelar')
      }
    },
  },
}
</script>

<style scoped>
.ag-dialogo {
  position: fixed;
  inset: 0;
  z-index: 1080;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

.ag-dialogo__caja {
  width: min(360px, 100%);
  overflow: hidden;
  border: 1px solid #3a3a3c;
  border-radius: 14px;
  background: #1c1c1e;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

.ag-dialogo__cuerpo {
  padding: 16px 16px 14px;
}

.ag-dialogo__titulo {
  margin: 0 0 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.ag-dialogo__texto {
  margin: 0;
  color: #9a9a9c;
  font-size: 14px;
  line-height: 1.4;
}

.ag-dialogo__pie {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 14px;
  border-top: 1px solid #3a3a3c;
}

.ag-dialogo__boton {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid #48484a;
  border-radius: 7px;
  background: #2c2c2e;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.ag-dialogo__boton:disabled {
  cursor: default;
  opacity: 0.6;
}

.ag-dialogo__boton--peligro {
  border-color: #6b2b2b;
  background: #5b2222;
  color: #ff6b6b;
}

.ag-dialogo__boton--principal {
  border-color: #f88e87;
  background: #f88e87;
  color: #fff;
}

.ag-dialogo__girando {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ag-dialogo-girar 0.8s linear infinite;
}

@keyframes ag-dialogo-girar {
  to {
    transform: rotate(360deg);
  }
}
</style>
