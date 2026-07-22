<template>
  <!-- Vista fina: solo monta el componente reutilizable con el scope "tienda" (Grupo 190, Prompt 02) -->
  <env-template-manager scope="tienda" title="Plantilla base .env del ecommerce" />
</template>

<script>
import EnvTemplateManager from '@/components/env-template/EnvTemplateManager.vue'

/**
 * Pantalla "Ecommerce" del submenú "Plantilla .env": gestiona la plantilla base
 * de tienda-api (sin flujo de "Manual al crear", con badge para las variables
 * que completa sola la instalación).
 */
export default {
  name: 'ViewEnvTemplateEcommerce',

  components: { EnvTemplateManager },
}
</script>
