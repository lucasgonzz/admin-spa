<template>
  <div class="version-client-selector">
    <!-- Buscador por razón social; al tipear se filtran clientes activos que aún no están seleccionados -->
    <input
      v-model="search_text"
      type="text"
      class="version-client-selector__input"
      placeholder="Buscar cliente..."
      @keydown.enter.prevent="select_first_match"
      @keydown.esc="clear_search"
    />
    <ul v-if="search_text.trim() !== '' && filtered_options.length" class="version-client-selector__dropdown">
      <li
        v-for="option in filtered_options"
        :key="option.id"
        class="version-client-selector__option"
        @click="add_client(option.id)"
      >
        {{ option_label(option) }}
      </li>
    </ul>
    <p v-if="search_text.trim() !== '' && !filtered_options.length" class="version-client-selector__empty">
      Sin resultados
    </p>

    <div v-if="selected_clients.length" class="version-client-selector__chips">
      <span v-for="client in selected_clients" :key="client.id" class="version-client-selector__chip">
        {{ option_label(client) }}
        <button type="button" class="version-client-selector__chip-remove" @click="remove_client(client.id)">×</button>
      </span>
      <button type="button" class="version-client-selector__reset" @click="reset_selection">
        Restablecer (todos)
      </button>
    </div>
    <small v-else class="version-client-selector__all-label">Aplica a todos los clientes</small>
  </div>
</template>

<script>
/**
 * Selector amigable de clientes para las filas del módulo de Versiones
 * (notificaciones, seeders, comandos, tareas manuales). Reemplaza el
 * <select multiple> nativo: buscador por razón social, chips de clientes
 * elegidos y botón para restablecer a "todos".
 *
 * Sin selección (client_ids vacío) = aplica a todos los clientes, igual
 * que el comportamiento previo del <select multiple>.
 */
export default {
  name: 'VersionClientSelector',
  props: {
    /** IDs de clientes ya elegidos para esta fila. Vacío = todos. */
    client_ids: { type: Array, default: () => [] },
    /** Catálogo de clientes activos disponibles (ya ordenado alfabéticamente por el padre). */
    options: { type: Array, default: () => [] },
  },
  emits: ['update:client_ids'],
  data() {
    return {
      /** Texto de búsqueda por razón social. */
      search_text: '',
    }
  },
  computed: {
    /**
     * Clientes ya seleccionados, resueltos contra el catálogo, en el orden en que fueron elegidos.
     * @returns {Array<Object>}
     */
    selected_clients() {
      var result = []
      var options = this.options
      this.client_ids.forEach(function (id) {
        var found = options.filter(function (o) { return o.id == id })[0]
        if (found) {
          result.push(found)
        }
      })
      return result
    },
    /**
     * Clientes que matchean el texto buscado y todavía no están seleccionados.
     * Comparación sin distinguir mayúsculas/acentos. Tope de 8 resultados para no saturar la fila.
     * @returns {Array<Object>}
     */
    filtered_options() {
      var query = this.normalize_text(this.search_text)
      if (query === '') {
        return []
      }
      var selected_ids = this.client_ids
      var self = this
      var matches = this.options.filter(function (option) {
        if (selected_ids.indexOf(option.id) !== -1) {
          return false
        }
        return self.normalize_text(self.option_label(option)).indexOf(query) !== -1
      })
      return matches.slice(0, 8)
    },
  },
  methods: {
    /**
     * Quita acentos y pasa a minúsculas para comparar texto sin distinguir tildes/mayúsculas.
     * @param {string} value
     * @returns {string}
     */
    normalize_text(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
    },
    /**
     * Etiqueta visible de un cliente: razón social si existe, si no nombre de contacto.
     * Mismo criterio que client_option_label() del padre (VersionExtraProps).
     * @param {Object} client
     * @returns {string}
     */
    option_label(client) {
      if (!client) {
        return '—'
      }
      var company_name = client.company_name ? String(client.company_name).trim() : ''
      if (company_name) {
        return company_name
      }
      var contact_name = client.name ? String(client.name).trim() : ''
      if (contact_name) {
        return contact_name
      }
      return 'Cliente #' + client.id
    },
    /**
     * Agrega un cliente a la selección y limpia el buscador para poder sumar otro.
     * @param {number|string} id
     * @returns {void}
     */
    add_client(id) {
      var next_ids = this.client_ids.slice()
      next_ids.push(id)
      this.$emit('update:client_ids', next_ids)
      this.search_text = ''
    },
    /**
     * Quita un cliente puntual de la selección (chip individual).
     * @param {number|string} id
     * @returns {void}
     */
    remove_client(id) {
      var next_ids = this.client_ids.filter(function (existing_id) { return existing_id != id })
      this.$emit('update:client_ids', next_ids)
    },
    /**
     * Selecciona el primer resultado filtrado al presionar Enter (atajo sin mouse).
     * @returns {void}
     */
    select_first_match() {
      if (this.filtered_options.length) {
        this.add_client(this.filtered_options[0].id)
      }
    },
    /**
     * Limpia el texto de búsqueda (Escape).
     * @returns {void}
     */
    clear_search() {
      this.search_text = ''
    },
    /**
     * Restablece la fila a "aplica a todos los clientes" (vacía la selección).
     * @returns {void}
     */
    reset_selection() {
      this.$emit('update:client_ids', [])
      this.search_text = ''
    },
  },
}
</script>

<style scoped>
.version-client-selector {
  min-width: 200px;
}
.version-client-selector__input {
  width: 100%;
  font-size: 0.8125rem;
  padding: 4px 8px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}
.version-client-selector__input:focus {
  outline: none;
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.15rem rgba(var(--bs-primary-rgb), 0.15);
}
.version-client-selector__dropdown {
  list-style: none;
  margin: 2px 0 0;
  padding: 4px 0;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  max-height: 160px;
  overflow-y: auto;
  position: relative;
  z-index: 5;
}
.version-client-selector__option {
  padding: 4px 10px;
  font-size: 0.8125rem;
  cursor: pointer;
}
.version-client-selector__option:hover {
  background: #f1f3f5;
}
.version-client-selector__empty {
  margin: 2px 0 0;
  font-size: 0.75rem;
  color: #adb5bd;
}
.version-client-selector__chips {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.version-client-selector__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f1f3f5;
  border-radius: 999px;
  padding: 2px 6px 2px 10px;
  font-size: 0.75rem;
}
.version-client-selector__chip-remove {
  border: none;
  background: transparent;
  color: #868e96;
  line-height: 1;
  padding: 0 2px;
  cursor: pointer;
}
.version-client-selector__chip-remove:hover {
  color: #e03131;
}
.version-client-selector__reset {
  border: none;
  background: transparent;
  color: var(--bs-primary);
  font-size: 0.75rem;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
}
.version-client-selector__all-label {
  display: block;
  margin-top: 4px;
  color: #adb5bd;
}
</style>
