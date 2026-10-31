<template>
  <!--
    Vista Varios días: 4 días seguidos desde el elegido (2 en teléfono) en columnas sobre la grilla
    horaria elástica, con el círculo, el horario y el título de cada tarea, como en Structured. La
    lógica vive en GrillaHoras; esta vista solo fija el modo. Las props y los eventos que le pasa
    el orquestador caen tal cual en la grilla (atributos heredados de Vue: un solo nodo raíz, sin
    `props` ni `emits` propios).
  -->
  <grilla-horas modo="varios" />
</template>

<script>
import GrillaHoras from './GrillaHoras.vue'

export default {
  name: 'AgendaVistaVariosDias',
  components: { GrillaHoras },
}
</script>
