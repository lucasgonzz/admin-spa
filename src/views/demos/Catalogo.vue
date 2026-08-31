<template>
  <div class="demos-catalogo-view container-fluid px-0 py-4">

    <!-- Encabezado del submódulo, mismo formato que EcommerceUpdates.vue -->
    <div class="d-flex align-items-center flex-wrap gap-2 mb-4">
      <div>
        <h4 class="mb-0">Catálogo de demos</h4>
        <p class="text-muted small mb-0 mt-1">
          Las instancias de demo que se le asignan a un lead, con las URLs y el tipo de hosting
          del ERP y de la tienda de cada una. Es de acá que salen las demos que aparecen en
          Instalaciones y en Actualizaciones.
        </p>
      </div>
    </div>

    <resource-view model_name="demo" />

  </div>
</template>

<script>
import ResourceView from '@/common-vue/components/view/Index.vue'

/**
 * Demos > Catálogo: el CRUD del catálogo de demos, ahora con ruta propia.
 *
 * Hasta la misión demos-instalacion-y-ecommerce (31/8/2026) esta pantalla existía solo como un
 * `<resource-view model_name="demo" />` adentro de un modal de `Leads.vue` (el botón "Gestionar
 * catálogo de demos"). Es el mismo componente y el mismo recurso: lo único que cambió es que
 * ahora se llega por `/demos/catalogo` y no por un modal escondido en otro módulo. Ese botón de
 * Leads sigue existiendo, pero navega para acá.
 */
export default {
  name: 'ViewDemosCatalogo',

  components: { ResourceView },
}
</script>
