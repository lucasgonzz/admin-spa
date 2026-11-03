<template>
  <!--
    El local (misión el-local, 3/11/2026): la vista solo le da el alto del área de contenido al
    componente, que trae su propio marco oscuro, el poleo y la escena.
  -->
  <div class="el-local-vista">
    <el-local-index />
  </div>
</template>

<script>
import ElLocalIndex from '@/components/local/Index.vue'

export default {
  name: 'ViewElLocal',
  components: { ElLocalIndex },
}
</script>

<style scoped>
/* Ocupa todo el alto del <main> (que ya trae su padding); con un mínimo por si el alto no se resuelve. */
.el-local-vista {
  height: 100%;
  min-height: 520px;
}

/* Teléfono: un mínimo más bajo, para no empujar un scroll de página cuando sobra espacio. */
@media (max-width: 767.98px) {
  .el-local-vista {
    min-height: 480px;
  }
}
</style>
