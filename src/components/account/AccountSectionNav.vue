<template>
  <nav class="account-section-nav" aria-label="Secciones de cuenta">
    <div
      v-for="group in nav_groups"
      :key="group.key"
      class="account-section-nav__group"
    >
      <p v-if="group.label" class="account-section-nav__group-label">
        {{ group.label }}
      </p>
      <ul class="nav nav-pills account-section-nav__list">
        <li v-for="item in group.items" :key="item.id" class="nav-item">
          <button
            type="button"
            class="nav-link text-start account-section-nav__link"
            :class="{ active: active_section === item.id }"
            :aria-current="active_section === item.id ? 'page' : null"
            @click="on_select(item.id)"
          >
            {{ item.label }}
          </button>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script>
import { ACCOUNT_SECTIONS } from '@/components/account/account_sections'

/**
 * Barra lateral de navegación de la vista Cuenta.
 * Agrupa las secciones por categoría y emite el id seleccionado al padre.
 */
export default {
  name: 'AccountSectionNav',
  props: {
    /** Id de la sección activa (sincronizado con hash de URL). */
    active_section: {
      type: String,
      required: true,
    },
  },
  emits: ['select'],
  computed: {
    /**
     * Secciones agrupadas para renderizar títulos de grupo y sus ítems.
     *
     * @returns {Array<{ key: string, label: string|null, items: Array }>}
     */
    nav_groups() {
      /** Mapa grupo → ítems para preservar el orden definido en ACCOUNT_SECTIONS. */
      const groups_by_key = {}
      /** Orden de aparición de grupos en la barra. */
      const group_order = []

      ACCOUNT_SECTIONS.forEach(function (section) {
        /** Clave interna del grupo; null se trata como preferencias sin título. */
        const group_key = section.group || '__root__'
        if (!groups_by_key[group_key]) {
          groups_by_key[group_key] = {
            key: group_key,
            label: section.group,
            items: [],
          }
          group_order.push(group_key)
        }
        groups_by_key[group_key].items.push(section)
      })

      const result = []
      group_order.forEach(function (group_key) {
        result.push(groups_by_key[group_key])
      })
      return result
    },
  },
  methods: {
    /**
     * Notifica al padre la sección elegida por el operador.
     *
     * @param {string} section_id Id de la sección (hash sin #).
     * @returns {void}
     */
    on_select(section_id) {
      this.$emit('select', section_id)
    },
  },
}
</script>

<style scoped>
.account-section-nav {
  width: 100%;
}

.account-section-nav__group + .account-section-nav__group {
  margin-top: 1rem;
}

.account-section-nav__group-label {
  margin: 0 0 0.35rem;
  padding: 0 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6c757d;
}

.account-section-nav__list {
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 0.25rem;
}

.account-section-nav__link {
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  color: #495057;
  border-radius: 0.375rem;
  white-space: nowrap;
}

.account-section-nav__link:hover {
  background-color: rgba(13, 110, 253, 0.08);
  color: #0d6efd;
}

.account-section-nav__link.active {
  font-weight: 600;
}

@media (max-width: 767.98px) {
  .account-section-nav {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 1rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .account-section-nav__group {
    flex-shrink: 0;
  }

  .account-section-nav__group + .account-section-nav__group {
    margin-top: 0;
    padding-left: 0.75rem;
    border-left: 1px solid #dee2e6;
  }
}

@media (min-width: 768px) {
  .account-section-nav {
    position: sticky;
    top: 0.75rem;
    max-width: 14rem;
  }

  .account-section-nav__list {
    flex-direction: column;
    flex-wrap: wrap;
    gap: 0;
  }

  .account-section-nav__link {
    width: 100%;
  }
}
</style>
