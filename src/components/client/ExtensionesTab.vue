<template>
  <div class="p-3">
    <!-- Sin cliente guardado todavía: no hay id al que pedirle el acceso -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para gestionar sus extensiones.
    </p>

    <div v-else>
      <div class="card mb-3">
        <div class="card-body">
          <p class="mb-2">
            Abre el configurador de extensiones del sistema de este cliente en una pestaña nueva, sin
            necesidad de la clave maestra. El pedido va al sistema del cliente (su frente activo) y el
            acceso se canjea una sola vez.
          </p>
          <p class="text-muted small mb-3">
            El acceso dura <strong>2 horas</strong> y es solo para el configurador de extensiones: no
            habilita ninguna otra pantalla de mantenimiento del sistema.
          </p>

          <!-- Aviso cuando el cliente no pudo dar el acceso (versión vieja, sin conexión, etc.) -->
          <div v-if="aviso" class="alert alert-warning py-2 small" role="alert">
            {{ aviso }}
          </div>

          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="pidiendo"
            @click="gestionar_extensiones"
          >
            <span
              v-if="pidiendo"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
            {{ pidiendo ? 'Pidiendo acceso...' : 'Gestionar extensiones' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Pestaña "Extensiones" del detalle del cliente (admin-spa).
 *
 * Misión extensiones-desde-el-admin (15/10/2026): el configurador de extensiones de empresa está
 * detrás de la clave maestra y devuelve 404 a cualquiera sin ella. Este botón le pide al admin un
 * acceso de un solo uso (POST admin/client/{id}/extensiones/acceso), que a su vez lo pide al
 * empresa-api del cliente, y abre el configurador con esa URL.
 *
 * Respuesta del backend (siempre HTTP 200): `{ estado, mensaje, url }`. `estado === 'ok'` trae la
 * `url` de canje; cualquier otro estado trae el `mensaje` para mostrar.
 */
export default {
  name: 'ClientExtensionesTab',
  props: {
    /** Cliente actualmente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // true mientras se pide el acceso (deshabilita el botón y muestra el spinner).
      pidiendo: false,
      // Mensaje de aviso cuando el estado no fue ok (null = sin aviso).
      aviso: null,
    }
  },
  methods: {
    /**
     * Abre el configurador de extensiones del cliente.
     *
     * 🔴 La ventana se abre SINCRÓNICAMENTE dentro del click, antes de pedir nada: abrirla después
     * de la respuesta async la bloquearía el bloqueador de ventanas. Se abre sin `noopener` para
     * poder asignarle la URL después; antes de navegar se corta el vínculo con `opener = null`.
     * @returns {void}
     */
    gestionar_extensiones() {
      const self = this
      if (!this.record || !this.record.id || this.pidiendo) {
        return
      }
      const ventana = window.open('', '_blank')
      self.pidiendo = true
      self.aviso = null
      api
        .post('/client/' + this.record.id + '/extensiones/acceso', {}, { silent_error: true })
        .then(function (res) {
          const cuerpo = res.data || {}
          if (cuerpo.estado === 'ok' && cuerpo.url && ventana) {
            ventana.opener = null
            ventana.location.href = cuerpo.url
          } else {
            self.cerrar_ventana(ventana)
            self.aviso = cuerpo.estado === 'ok'
              ? 'El navegador bloqueó la ventana nueva. Permití las ventanas emergentes para este sitio y probá de nuevo.'
              : cuerpo.mensaje || 'No se pudo abrir el configurador de extensiones.'
          }
          self.pidiendo = false
        })
        .catch(function (error) {
          self.cerrar_ventana(ventana)
          self.aviso = resolve_error_message(error)
          self.pidiendo = false
        })
    },
    /**
     * Cierra la ventana en blanco que se abrió en el click, si existe.
     * @param {Window|null} ventana
     * @returns {void}
     */
    cerrar_ventana(ventana) {
      if (ventana && !ventana.closed) {
        ventana.close()
      }
    },
  },
}
</script>
