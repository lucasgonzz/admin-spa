<template>
  <div>
    <label class="form-label mb-0">Tienda online (ecommerce)</label>
    <small class="form-text text-muted d-block mt-1 mb-2">
      Direcciones públicas de la tienda del cliente. La API vive dentro del mismo dominio, en la
      carpeta <code>/api</code>.
    </small>

    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label mb-0">URL de la tienda (SPA)</label>
        <input
          v-model="record.ecommerce_spa_url"
          type="text"
          class="form-control"
          placeholder="https://tiendadelcliente.com.ar"
          @blur="propose_api_url"
        />
      </div>
      <div class="col-md-6">
        <label class="form-label mb-0">URL de la API de la tienda</label>
        <input
          v-model="record.ecommerce_api_url"
          type="text"
          class="form-control"
          placeholder="https://tiendadelcliente.com.ar/api"
        />
      </div>
    </div>

    <!-- Línea informativa: solo ayuda visual, no se manda al backend (el backend deriva por su cuenta). -->
    <small class="text-muted d-block mt-2">{{ installation_path_hint }}</small>
  </div>
</template>

<script>
/**
 * Sección "Tienda online (ecommerce)" del modal del cliente.
 *
 * Renderizada desde el meta declarativo (`ClientProperties.php`) vía
 * `type: 'custom'` + `custom_component: 'client_ecommerce_urls'`, con el mismo
 * patrón que `client_implementation` en `common-vue/components/model/form/Index.vue`.
 *
 * No tiene guardado propio: los dos campos viven en el borrador del modal
 * (`record`, que es el `form` del `ModelForm`) y se persisten junto con el
 * resto del formulario al tocar el botón "Guardar" del modal.
 */
export default {
  name: 'ClientEcommerceUrls',
  props: {
    /**
     * Borrador del formulario del cliente (mismo contrato que usa
     * `client_implementation`, que recibe `:record="form"`).
     */
    record: { type: Object, default: null },
  },
  created() {
    // Si el borrador todavía no tiene la clave (cliente nuevo, o valor undefined/null
    // llegado del meta), se inicializa en string vacío para que exista en el borrador
    // desde el arranque y viaje igual en el guardado.
    if (this.record && (this.record.ecommerce_api_url === undefined || this.record.ecommerce_api_url === null)) {
      this.record.ecommerce_api_url = ''
    }
  },
  computed: {
    /**
     * Texto informativo con la ruta de instalación en el hosting, calculada en vivo
     * a partir de la URL del SPA. Es solo orientativo: el backend hace su propia
     * derivación (ver `ClientEcommerce::resolve_spa_path()` / `resolve_api_path()`).
     * @returns {string}
     */
    installation_path_hint() {
      /** Dominio extraído de la URL del SPA cargada (sin "www."), o cadena vacía. */
      var domain = this.domain_from_url(this.record ? this.record.ecommerce_spa_url : '')
      if (!domain) {
        return 'Cargá la URL de la tienda para ver dónde se va a instalar.'
      }
      return 'Se va a instalar en domains/' + domain + '/public_html (tienda) y domains/' + domain + '/public_html/api (API).'
    },
  },
  methods: {
    /**
     * Extrae el host (dominio) de una URL, sin el prefijo "www.". Réplica en JS,
     * solo para el texto informativo, de `ClientEcommerce::domain_from_url()` (admin-api).
     * @param {string} url URL o dominio suelto (con o sin esquema).
     * @returns {string} Dominio en minúsculas sin "www.", o cadena vacía si no se pudo resolver.
     */
    domain_from_url(url) {
      var value = (url || '').toString().trim()
      if (!value) {
        return ''
      }
      // Si no trae esquema, se le antepone "https://" para que el parser pueda resolver el host.
      if (value.indexOf('://') === -1) {
        value = 'https://' + value
      }
      var host = ''
      try {
        host = new URL(value).hostname.toLowerCase()
      } catch (error) {
        return ''
      }
      if (host.indexOf('www.') === 0) {
        host = host.substring(4)
      }
      return host
    },
    /**
     * Al salir del campo de URL del SPA, propone automáticamente la URL de la API
     * como "{spa_url}/api", solo si el campo de la API está vacío (nunca pisa un
     * valor que el usuario ya haya escrito a mano).
     * @returns {void}
     */
    propose_api_url() {
      if (!this.record) {
        return
      }
      /** URL del SPA sin espacios ni barra final, para armar la propuesta. */
      var spa_url = (this.record.ecommerce_spa_url || '').toString().trim().replace(/\/+$/, '')
      if (!spa_url) {
        return
      }
      if (this.record.ecommerce_api_url && this.record.ecommerce_api_url.toString().trim() !== '') {
        return
      }
      this.record.ecommerce_api_url = spa_url + '/api'
    },
  },
}
</script>
