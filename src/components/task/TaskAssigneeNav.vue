<template>
  <!--
    Barra de navegación por responsable (estilo pills/segmented control).
    Muestra "Todos", un ítem por cada admin y "Sin asignar" al final, cada uno
    con un badge de tareas pendientes. Al hacer click se emite 'select' con el
    valor elegido ('all', 'unassigned' o el id del admin) para que el padre
    filtre las listas de tareas.
  -->
  <div class="task-assignee-nav">
    <div class="task-assignee-nav__scroll">

      <!-- Ítem "Todos": siempre primero, seleccionado por defecto en cada entrada a la vista -->
      <button
        type="button"
        class="task-assignee-nav__pill"
        :class="{ 'task-assignee-nav__pill--active': selected === 'all' }"
        @click="$emit('select', 'all')"
      >
        <span>Todos</span>
        <span v-if="counts.all > 0" class="task-assignee-nav__badge">{{ counts.all }}</span>
      </button>

      <!-- Un ítem por cada admin, con su contador de pendientes -->
      <button
        v-for="admin in admins"
        :key="admin.id"
        type="button"
        class="task-assignee-nav__pill"
        :class="{ 'task-assignee-nav__pill--active': is_selected_admin(admin.id) }"
        @click="$emit('select', admin.id)"
      >
        <span>{{ admin.name }}</span>
        <span v-if="admin_count(admin.id) > 0" class="task-assignee-nav__badge">{{ admin_count(admin.id) }}</span>
      </button>

      <!-- Ítem "Sin asignar": al final, no suma al conteo de ningún admin -->
      <button
        type="button"
        class="task-assignee-nav__pill"
        :class="{ 'task-assignee-nav__pill--active': selected === 'unassigned' }"
        @click="$emit('select', 'unassigned')"
      >
        <span>Sin asignar</span>
        <span v-if="counts.unassigned > 0" class="task-assignee-nav__badge">{{ counts.unassigned }}</span>
      </button>

    </div>
  </div>
</template>

<script>
/**
 * Barra de pills para filtrar la vista de tareas por responsable.
 * Es un componente puramente presentacional: no conoce el store, recibe todo
 * por props y delega la decisión de qué filtrar al componente padre (Tasks.vue).
 */
export default {
  name: 'TaskAssigneeNav',

  props: {
    /**
     * Lista de admins disponibles (id, name), la misma que usa el modal de tareas.
     */
    admins: {
      type: Array,
      default: function () { return [] },
    },
    /**
     * Valor actualmente seleccionado: 'all', 'unassigned' o el id del admin.
     */
    selected: {
      type: [String, Number],
      default: 'all',
    },
    /**
     * Contadores de tareas pendientes: { all, unassigned, by_admin: { [id]: n } }.
     * Se calculan siempre sobre el total, sin aplicar el filtro activo.
     */
    counts: {
      type: Object,
      default: function () { return { all: 0, unassigned: 0, by_admin: {} } },
    },
  },

  emits: ['select'],

  methods: {
    /**
     * Determina si el pill de un admin puntual es el seleccionado actualmente.
     * Compara por valor numérico para no fallar por diferencias de tipo (string vs number).
     *
     * @param {number} admin_id  Id del admin del pill.
     * @returns {boolean}
     */
    is_selected_admin(admin_id) {
      if (this.selected === 'all' || this.selected === 'unassigned') {
        return false
      }
      return Number(this.selected) === Number(admin_id)
    },

    /**
     * Devuelve el contador de pendientes de un admin puntual, con fallback a 0
     * si todavía no llegó el dato (carga inicial).
     *
     * @param {number} admin_id  Id del admin.
     * @returns {number}
     */
    admin_count(admin_id) {
      return this.counts.by_admin && this.counts.by_admin[admin_id] ? this.counts.by_admin[admin_id] : 0
    },
  },
}
</script>

<style scoped>
/* Contenedor con scroll horizontal sin barra visible, para mobile. */
.task-assignee-nav {
  margin-bottom: 1rem;
}

.task-assignee-nav__scroll {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: none;
}

.task-assignee-nav__scroll::-webkit-scrollbar {
  display: none;
}

/* Pill individual: borde suave por defecto, minimalismo estilo Apple. */
.task-assignee-nav__pill {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  border: 1px solid #dee2e6;
  background: #fff;
  color: #495057;
  font-size: 0.85rem;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.task-assignee-nav__pill:hover {
  border-color: #adb5bd;
}

/* Pill activo: fondo sólido, para distinguirlo del resto. */
.task-assignee-nav__pill--active {
  background: #212529;
  border-color: #212529;
  color: #fff;
}

/* Badge de conteo: se oculta directamente con v-if cuando el contador es 0. */
.task-assignee-nav__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  font-size: 0.7rem;
  font-weight: 600;
}

/* En pills inactivos el badge usa un gris sutil en vez del overlay blanco. */
.task-assignee-nav__pill:not(.task-assignee-nav__pill--active) .task-assignee-nav__badge {
  background: #e9ecef;
  color: #495057;
}
</style>
