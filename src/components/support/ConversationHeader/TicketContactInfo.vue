<template>
  <!--
    Primera fila del header del ticket: con quién se está hablando. Avatar con la inicial, nombre
    del contacto (empleado o dueño), su teléfono como link tel: y, chico, el negocio si es otro
    nombre. En teléfono suma a la izquierda la flecha para volver a la lista de tickets.
  -->
  <div class="ticket-contact-info d-flex align-items-center gap-2 min-w-0 w-100">
    <button
      v-if="show_back"
      type="button"
      class="btn btn-link p-0 ticket-contact-back flex-shrink-0"
      title="Volver a los tickets"
      aria-label="Volver a los tickets"
      @click="$emit('back')">
      <i class="bi bi-arrow-left" aria-hidden="true"></i>
    </button>
    <span class="ticket-contact-avatar flex-shrink-0" aria-hidden="true">{{ inicial }}</span>
    <div class="ticket-contact-text min-w-0">
      <div class="ticket-contact-line d-flex align-items-center gap-2 min-w-0">
        <span class="ticket-contact-name text-truncate" :title="nombre">{{ nombre }}</span>
        <a
          v-if="telefono"
          class="ticket-contact-phone flex-shrink-0"
          :href="'tel:' + telefono_para_link"
          :title="'Llamar a ' + telefono">
          <i class="bi bi-telephone" aria-hidden="true"></i>
          {{ telefono }}
        </a>
      </div>
      <div v-if="negocio" class="ticket-contact-company text-truncate" :title="negocio">{{ negocio }}</div>
    </div>
  </div>
</template>

<script>
/**
 * Datos del contacto del ticket para el header de la conversación.
 *
 * Todo sale de la fila del ticket que ya trae la bandeja (`client`, `client_employee`,
 * `client_user_name`, `whatsapp_phone`): no pide nada a la API.
 *
 * Eventos:
 *   back - flecha de volver (solo se muestra con `show_back`, en teléfono).
 */
export default {
  name: 'TicketContactInfo',
  emits: ['back'],
  props: {
    /**
     * Ticket abierto (fila de la bandeja).
     */
    ticket: {
      type: Object,
      required: true,
    },
    /**
     * Muestra la flecha de volver a la lista (vista de teléfono).
     */
    show_back: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    /**
     * Nombre del contacto: empleado del ticket, o el nombre de usuario del ERP, o el del cliente.
     *
     * @returns {string}
     */
    nombre() {
      const t = this.ticket
      if (t.client_employee && String(t.client_employee.name || '').trim()) {
        return String(t.client_employee.name).trim()
      }
      if (String(t.client_user_name || '').trim()) {
        return String(t.client_user_name).trim()
      }
      if (t.client) {
        const del_cliente = String(t.client.name || t.client.company_name || '').trim()
        if (del_cliente) {
          return del_cliente
        }
      }
      if (this.telefono) {
        return this.telefono
      }
      return 'Ticket #' + t.id
    },
    /**
     * Teléfono del contacto: el del empleado, o el número del hilo de WhatsApp, o el del cliente.
     *
     * @returns {string}
     */
    telefono() {
      const t = this.ticket
      if (t.client_employee && String(t.client_employee.phone || '').trim()) {
        return String(t.client_employee.phone).trim()
      }
      if (String(t.whatsapp_phone || '').trim()) {
        const wa = String(t.whatsapp_phone).trim()
        /* `whatsapp_phone` se guarda en dígitos pelados (5493416123456): con el + se lee como
           número internacional y el tel: marca bien desde el celular. */
        return /^\d{10,}$/.test(wa) ? '+' + wa : wa
      }
      if (t.client && String(t.client.phone || '').trim()) {
        return String(t.client.phone).trim()
      }
      return ''
    },
    /**
     * Teléfono sin espacios ni guiones para el href tel: (conserva el + del internacional).
     *
     * @returns {string}
     */
    telefono_para_link() {
      return this.telefono.replace(/[^\d+]/g, '')
    },
    /**
     * Nombre del negocio (razón social o nombre del cliente), solo si es distinto del contacto.
     *
     * @returns {string}
     */
    negocio() {
      const c = this.ticket.client
      if (!c) {
        return ''
      }
      const negocio = String(c.company_name || c.name || '').trim()
      if (!negocio || negocio.toLowerCase() === this.nombre.toLowerCase()) {
        return ''
      }
      return negocio
    },
    /**
     * Inicial del avatar; un nombre que arranca con número (un teléfono) muestra "#".
     *
     * @returns {string}
     */
    inicial() {
      const primera = this.nombre.trim().charAt(0)
      if (!primera || /\d/.test(primera)) {
        return '#'
      }
      return primera.toUpperCase()
    },
  },
}
</script>

<style scoped>
.ticket-contact-back {
  font-size: 1.35rem;
  line-height: 1;
  color: var(--bs-body-color);
  text-decoration: none;
}

/* Mismo avatar redondo que las filas de la bandeja. */
.ticket-contact-avatar {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  background: #ced4da;
  color: #212529;
}

.ticket-contact-text {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.ticket-contact-name {
  font-weight: 600;
  font-size: 0.98rem;
  min-width: 0;
}

.ticket-contact-phone {
  font-size: 0.85rem;
  white-space: nowrap;
  text-decoration: none;
}

.ticket-contact-company {
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
}
</style>
