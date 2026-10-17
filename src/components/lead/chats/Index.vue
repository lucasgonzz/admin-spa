<template>
  <section class="lead-chats" aria-label="Chats de leads">
    <div class="lead-chats__search">
      <chat-search v-model="q" @search="on_search" />
    </div>

    <!-- API vieja: el admin-api de producción todavía no tiene GET lead/chats. Se dice y se deja
         al resto de la vista (tarjetas, modal, conversación por ?lead_id=) andando. -->
    <div v-if="chats_error === 'api_vieja'" class="lead-chats__estado lead-chats__estado--error" role="alert">
      <i class="bi bi-cloud-slash lead-chats__estado-icon" aria-hidden="true" />
      <p class="lead-chats__estado-title">Actualizá el admin</p>
      <p class="lead-chats__estado-text">
        La lista de chats necesita una versión más nueva de <code>admin-api</code> (la ruta
        <code>lead/chats</code> todavía no existe en este servidor). Las tarjetas, la ficha y la
        conversación de cada lead siguen funcionando.
      </p>
      <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="loading_chats" @click="recargar">
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true" />Reintentar
      </button>
    </div>

    <div v-else-if="chats_error === 'error'" class="lead-chats__estado lead-chats__estado--error" role="alert">
      <i class="bi bi-exclamation-triangle lead-chats__estado-icon" aria-hidden="true" />
      <p class="lead-chats__estado-title">No se pudo cargar la lista</p>
      <p class="lead-chats__estado-text">Revisá la conexión y volvé a intentar.</p>
      <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="loading_chats" @click="recargar">
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true" />Reintentar
      </button>
    </div>

    <!-- Primera carga: todavía no hay filas que mostrar. -->
    <div v-else-if="!chats.length && loading_chats" class="lead-chats__estado" role="status" aria-live="polite">
      <span class="spinner-border text-primary" aria-hidden="true" />
      <p class="lead-chats__estado-text mt-2">Cargando chats…</p>
    </div>

    <div v-else-if="!chats.length" class="lead-chats__estado">
      <i class="bi bi-chat-left-dots lead-chats__estado-icon" aria-hidden="true" />
      <p class="lead-chats__estado-title">Sin leads para este filtro</p>
      <p v-if="hay_filtros" class="lead-chats__estado-text">Probá con otro texto o sacá el filtro de estado.</p>
    </div>

    <div v-else class="lead-chats__list" role="list" :class="{ 'lead-chats__list--loading': loading_chats }">
      <chat-row
        v-for="row in chats"
        :key="'chat-' + row.id"
        :row="row"
        :active="is_active(row)"
        @open="on_open"
        @open-modal="on_open_modal"
        @context="on_context"
      />
    </div>

    <!-- Paginado: "Cargar más" al pie, con lo que ya hay sobre el total. -->
    <div v-if="puede_cargar_mas" class="lead-chats__more">
      <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="loading_chats" @click="cargar_mas">
        <span v-if="loading_chats" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
        Cargar más
        <span class="text-muted ms-1">({{ chats.length }} de {{ chats_meta.total }})</span>
      </button>
    </div>

    <chat-context-menu
      :visible="menu.visible"
      :x="menu.x"
      :y="menu.y"
      :row="menu.row"
      @close="cerrar_menu"
      @pin="on_menu_pin"
      @unread="on_menu_unread"
      @perfil="on_menu_perfil"
    />
  </section>
</template>

<script>
import ChatSearch from './ChatSearch.vue'
import ChatRow from './ChatRow.vue'
import ChatContextMenu from './ChatContextMenu.vue'

/**
 * Lista de chats de leads estilo WhatsApp (misión flujo-lead-landing-closer, 17/10/2026).
 *
 * Orquesta el buscador, las filas, los estados vacío / error / cargando, el "Cargar más" y el menú
 * contextual. Los datos viven en el store (`lead.chats`, `lead.chats_meta`, `lead.chats_filtros`):
 * acá se dispara `fetch_chats` cuando cambia el texto buscado o se pide otra página; el filtro de
 * estado y el de "solo atención" los maneja `Leads.vue`, que es quien tiene las tarjetas y la
 * query de la URL.
 *
 * Eventos:
 *   open-conversation - clic en una fila: `Leads.vue` abre el sidebar (≥768) o navega (<768).
 *   open-modal        - clic en el nombre o "Ver perfil": `Leads.vue` abre el modal del lead.
 */
export default {
  name: 'LeadChatsList',
  components: { ChatSearch, ChatRow, ChatContextMenu },
  props: {
    /** Id del lead cuya conversación está abierta en el sidebar, para resaltar su fila. */
    active_lead_id: { type: [Number, String], default: null },
  },
  emits: ['open-conversation', 'open-modal'],
  data() {
    return {
      /** Menú contextual: fila y punto donde se pidió. */
      menu: { visible: false, x: 0, y: 0, row: null },
      /** Id del lead con una acción del menú en vuelo (evita el doble toque). */
      accion_en_vuelo_id: null,
    }
  },
  computed: {
    /**
     * @returns {Array<Object>}
     */
    chats() {
      return this.$store.state.lead.chats || []
    },
    /**
     * @returns {{ current_page: number, last_page: number, per_page: number, total: number }}
     */
    chats_meta() {
      return this.$store.state.lead.chats_meta || { current_page: 1, last_page: 1, per_page: 50, total: 0 }
    },
    /**
     * @returns {boolean}
     */
    loading_chats() {
      return Boolean(this.$store.state.lead.loading_chats)
    },
    /**
     * @returns {null|'api_vieja'|'error'}
     */
    chats_error() {
      return this.$store.state.lead.chats_error || null
    },
    /**
     * Texto del buscador, espejado en el store para que un reset desde `Leads.vue` lo vacíe.
     */
    q: {
      get() {
        return (this.$store.state.lead.chats_filtros || {}).q || ''
      },
      set(valor) {
        this.$store.commit('lead/set_chats_filtros', { q: valor || '' })
      },
    },
    /**
     * @returns {boolean}
     */
    hay_filtros() {
      const f = this.$store.state.lead.chats_filtros || {}
      return Boolean((f.q || '').trim() || f.status || f.solo_atencion)
    },
    /**
     * @returns {boolean}
     */
    puede_cargar_mas() {
      if (this.chats_error || !this.chats.length) {
        return false
      }
      return (this.chats_meta.current_page || 1) < (this.chats_meta.last_page || 1)
    },
  },
  beforeUnmount() {
    this.cerrar_menu()
  },
  methods: {
    /**
     * @param {Object} row
     * @returns {boolean}
     */
    is_active(row) {
      if (this.active_lead_id == null || !row) {
        return false
      }
      return String(this.active_lead_id) === String(row.id)
    },
    /**
     * El buscador ya debounceó: se recarga desde la primera página con el texto nuevo.
     */
    on_search() {
      this.$store.dispatch('lead/fetch_chats', { page: 1 })
    },
    /**
     * Reintentar tras un error (o tras actualizar el admin en otra pestaña).
     */
    recargar() {
      this.$store.dispatch('lead/fetch_chats', { page: 1 })
    },
    /**
     * Siguiente página, agregada al final.
     */
    cargar_mas() {
      if (!this.puede_cargar_mas || this.loading_chats) {
        return
      }
      this.$store.dispatch('lead/fetch_chats', {
        page: (this.chats_meta.current_page || 1) + 1,
        append: true,
      })
    },
    /**
     * @param {Object} row
     */
    on_open(row) {
      this.cerrar_menu()
      this.$emit('open-conversation', row)
    },
    /**
     * @param {Object} row
     */
    on_open_modal(row) {
      this.cerrar_menu()
      this.$emit('open-modal', row)
    },
    /**
     * Clic derecho o long-press sobre una fila.
     * @param {{ row: Object, x: number, y: number }} payload
     */
    on_context(payload) {
      if (!payload || !payload.row) {
        return
      }
      this.menu = { visible: true, x: payload.x || 0, y: payload.y || 0, row: payload.row }
    },
    cerrar_menu() {
      if (this.menu.visible) {
        this.menu = { visible: false, x: 0, y: 0, row: null }
      }
    },
    /**
     * Corre una acción del menú contra el store y cierra el menú. El toast de error ya lo da el
     * interceptor de axios; acá solo se evita el doble toque.
     *
     * @param {Object} row
     * @param {string} action nombre del action del módulo lead
     */
    correr_accion(row, action) {
      if (!row || !row.id || this.accion_en_vuelo_id != null) {
        return
      }
      const self = this
      this.accion_en_vuelo_id = row.id
      this.cerrar_menu()
      this.$store.dispatch('lead/' + action, row.id)
        .catch(function () {
          return null
        })
        .then(function () {
          self.accion_en_vuelo_id = null
        })
    },
    /**
     * @param {Object} row
     */
    on_menu_pin(row) {
      this.correr_accion(row, 'toggle_chat_pinned')
    },
    /**
     * @param {Object} row
     */
    on_menu_unread(row) {
      this.correr_accion(row, 'toggle_chat_manual_unread')
    },
    /**
     * @param {Object} row
     */
    on_menu_perfil(row) {
      this.on_open_modal(row)
    },
  },
}
</script>

<style scoped>
.lead-chats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.lead-chats__list {
  border: 1px solid var(--bs-border-color);
  border-radius: 0.75rem;
  overflow: hidden;
  background: #fff;
  transition: opacity 0.15s ease;
}

/* Recarga con filas en pantalla: se atenúa, no se vacía (misma decisión que las tarjetas). */
.lead-chats__list--loading {
  opacity: 0.6;
}

/* La última fila no repite el borde del contenedor. */
.lead-chats__list :deep(.lead-chat-row:last-child) {
  border-bottom: none;
}

.lead-chats__estado {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2.5rem 1rem;
  border: 1px dashed var(--bs-border-color);
  border-radius: 0.75rem;
  color: var(--bs-secondary-color);
  background: #fff;
}

.lead-chats__estado--error {
  border-style: solid;
  border-color: rgba(220, 53, 69, 0.35);
}

.lead-chats__estado-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.lead-chats__estado-title {
  font-weight: 600;
  color: var(--bs-body-color);
  margin-bottom: 0.25rem;
}

.lead-chats__estado-text {
  font-size: 0.875rem;
  max-width: 34rem;
  margin-bottom: 0.75rem;
}

.lead-chats__more {
  display: flex;
  justify-content: center;
  padding-bottom: 0.5rem;
}
</style>
