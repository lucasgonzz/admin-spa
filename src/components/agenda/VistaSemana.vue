<template>
  <!--
    Vista Semana: los 7 días (de domingo a sábado) en columnas sobre la grilla horaria elástica,
    con solo el círculo y el ícono de cada tarea, como en Structured. Toda la lógica (posiciones,
    clic en un lugar vacío, drag & drop con snap de 15 min) vive en GrillaHoras: esta vista solo
    fija el modo. Las props y los eventos que le pasa el orquestador caen tal cual en la grilla
    (atributos heredados de Vue: un solo nodo raíz, sin `props` ni `emits` propios).
  -->
  <grilla-horas modo="semana" />
</template>

<script>
import GrillaHoras from './GrillaHoras.vue'

export default {
  name: 'AgendaVistaSemana',
  components: { GrillaHoras },
}
</script>
