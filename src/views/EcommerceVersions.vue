<template>
  <resource-view
    model_name="ecommerce_version"
    resource_api_path="ecommerce-versions"
  >
    <!--
      Explicación fija arriba de la tabla: de dónde sale una versión de ecommerce y qué verifica el
      admin al publicarla. Sin esto la pantalla parece un ABM de textos, y el código de la versión
      es lo único que ata la fila con el release de GitHub.
    -->
    <template #header>
      <div class="alert alert-light border small mb-3 ecommerce-versions-help">
        <strong>Versiones del ecommerce</strong> (tienda-spa + tienda-api). Cada versión apunta al
        release <code>v{código}</code> que GitHub Actions publica en los dos repos cuando se hace el
        commit <code>[release:X.Y.Z]</code> en <code>master</code>. Al <strong>publicarla</strong>, el
        admin verifica que estén <code>tienda-spa-v{código}-dist.zip</code> y
        <code>tienda-api-v{código}.zip</code>; si falta alguno, no se publica. Instalar o actualizar
        una tienda despliega la versión elegida (por defecto, la última publicada) sin compilar nada en
        el VPS. El código no se edita, y sólo se puede borrar una versión que ninguna tienda use.
      </div>
    </template>
  </resource-view>
</template>

<script>
import ResourceView from '@/common-vue/components/view/Index.vue'

/**
 * Módulo "Versiones de ecommerce" (misión cruzada `versiones-tienda`, 1/10/2026).
 *
 * Usa el `resource-view` genérico, igual que Versions.vue (empresa): el modelo `ecommerce_version`
 * encaja limpio en él —sólo cuatro campos editables (código, título, descripción, estado), sin
 * relaciones ni pestañas extra—, el meta lo sirve `EcommerceVersionProperties` del backend y el
 * CRUD va contra `api/admin/ecommerce-versions` (store `ecommerce_version`, con
 * `api_resource_path`). Las reglas (verificar los assets al publicar, el código no se edita, no se
 * borra una versión en uso) viven en el backend, y sus 422 los muestra el toast del interceptor.
 */
export default {
  name: 'ViewEcommerceVersions',

  components: { ResourceView },
}
</script>
