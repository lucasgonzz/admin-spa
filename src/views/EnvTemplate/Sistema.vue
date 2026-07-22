<template>
  <!-- Vista fina: solo monta el componente reutilizable con el scope "empresa" (Grupo 190, Prompt 02) -->
  <env-template-manager scope="empresa" title="Plantilla base .env del sistema" />
</template>

<script>
import EnvTemplateManager from '@/components/env-template/EnvTemplateManager.vue'

/**
 * Pantalla "Sistema" del submenú "Plantilla .env": gestiona la plantilla base
 * de empresa-api. Equivale al comportamiento de la ex vista única EnvTemplate/Index.vue.
 */
export default {
  name: 'ViewEnvTemplateSistema',

  components: { EnvTemplateManager },
}
</script>
