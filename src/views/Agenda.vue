<template>
  <!--
    Agenda a pantalla completa (misión agenda-admin, 31/10/2026): la copia de Structured con las
    tareas personales del admin logueado. Toda la pantalla es el componente; esta vista solo le
    da el alto del área de contenido.
  -->
  <div class="agenda-vista">
    <agenda-index />
  </div>
</template>

<script>
import AgendaIndex from '@/components/agenda/Index.vue'

export default {
  name: 'ViewAgenda',
  components: { AgendaIndex },
}
</script>

<style scoped>
/* Ocupa todo el alto del <main> (que ya trae su padding); con un mínimo por si el alto no se resuelve. */
.agenda-vista {
  height: 100%;
  min-height: 560px;
}

/* Teléfono: un mínimo más bajo, para que la agenda no empuje un scroll de página. */
@media (max-width: 767.98px) {
  .agenda-vista {
    min-height: 480px;
  }
}
</style>
