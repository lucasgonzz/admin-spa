<template>
  <div>
    <label class="form-label mb-0">Tienda online (ecommerce)</label>
    <small class="form-text text-muted d-block mt-1 mb-2">
      Direcciones públicas de la tienda del cliente. Normalmente la API vive dentro del mismo
      dominio, en la carpeta <code>/api</code>. Si la tienda está instalada en otra carpeta del
      hosting, cargá los paths de abajo.
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

    <div class="row g-3 mt-1">
      <div class="col-md-6">
        <label class="form-label mb-0">Path de instalación del SPA (opcional)</label>
        <input
          v-model="record.ecommerce_spa_path"
          type="text"
          class="form-control"
          placeholder="comerciocity.store/public_html/tienda/spa"
        />
        <small class="form-text text-muted">Relativo a <code>domains/</code>. Vacío = se deriva del dominio.</small>
      </div>
      <div class="col-md-6">
        <label class="form-label mb-0">Path de instalación de la API (opcional)</label>
        <input
          v-model="record.ecommerce_api_path"
          type="text"
          class="form-control"
          placeholder="comerciocity.store/public_html/tienda/api"
        />
        <small class="form-text text-muted">Relativo a <code>domains/</code>. Vacío = se deriva del dominio.</small>
      </div>
    </div>

    <!-- Línea informativa: solo ayuda visual, calculada con la misma lógica que el backend. -->
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
 * No tiene guardado propio: los cuatro campos viven en el borrador del modal
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
    // Si el borrador todavía no tiene alguna de estas claves (cliente nuevo, o valor
    // undefined/null llegado del meta), se inicializa en string vacío para que exista en el
    // borrador desde el arranque y viaje igual en el guardado.
    /** Claves que tienen que existir en el borrador desde el arranque para viajar en el guardado. */
    var seeded_keys = ['ecommerce_api_url', 'ecommerce_spa_path', 'ecommerce_api_path']
    var self = this
    if (this.record) {
      seeded_keys.forEach(function (key) {
        if (self.record[key] === undefined || self.record[key] === null) {
          self.record[key] = ''
        }
      })
    }
  },
  computed: {
    /**
     * Path efectivo del SPA (sin el prefijo `domains/`): el cargado a mano si hay, y si no el
     * derivado del dominio de la URL. Réplica en JS de ClientEcommerce::resolve_spa_path().
     * @returns {string}
     */
    effective_spa_path() {
      var manual = this.normalize_hosting_path(this.record ? this.record.ecommerce_spa_path : '')
      if (manual) {
        return manual
      }
      var domain = this.domain_from_url(this.record ? this.record.ecommerce_spa_url : '')
      return domain ? domain + '/public_html' : ''
    },
    /** Idem para la API: manual si hay, si no `{dominio}/public_html/api`. @returns {string} */
    effective_api_path() {
      var manual = this.normalize_hosting_path(this.record ? this.record.ecommerce_api_path : '')
      if (manual) {
        return manual
      }
      var domain = this.domain_from_url(this.record ? this.record.ecommerce_spa_url : '')
      return domain ? domain + '/public_html/api' : ''
    },
    /** Si al menos uno de los dos paths está cargado a mano. @returns {boolean} */
    has_manual_path() {
      var spa = this.normalize_hosting_path(this.record ? this.record.ecommerce_spa_path : '')
      var api = this.normalize_hosting_path(this.record ? this.record.ecommerce_api_path : '')
      return Boolean(spa || api)
    },
    /**
     * Texto informativo con la ruta EFECTIVA de instalación en el hosting.
     *
     * Antes de la misión ecommerce-paths-subcarpeta este texto afirmaba siempre
     * "domains/{dominio}/public_html", que es mentira en cuanto hay un path cargado a mano.
     * Muestra lo mismo que va a usar el pipeline de deploy, no la convención.
     * @returns {string}
     */
    installation_path_hint() {
      var spa = this.effective_spa_path
      var api = this.effective_api_path
      if (!spa && !api) {
        return 'Cargá la URL de la tienda (o los paths de instalación) para ver dónde se va a instalar.'
      }
      var hint =
        'Se va a instalar en domains/' + (spa || '(sin resolver)') + ' (tienda) y domains/' +
        (api || '(sin resolver)') + ' (API).'
      if (this.has_manual_path) {
        hint += ' Los paths cargados a mano mandan sobre el dominio: no se recalculan si cambiás la URL.'
      }
      return hint
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
     * Normaliza un path de instalación del hosting. Réplica en JS, solo para el texto informativo,
     * de `ClientEcommerce::normalize_hosting_path()` (admin-api). Si cambia una, cambia la otra.
     * @param {string} path Valor crudo del campo.
     * @returns {string} Path relativo a `domains/`, o cadena vacía si no queda nada usable.
     */
    normalize_hosting_path(path) {
      var value = (path || '').toString().trim()
      if (!value) {
        return ''
      }
      value = value.split('\\').join('/')
      var segments = value.split('/')
      var i = 0
      var last_domains_index = -1
      for (i = 0; i < segments.length; i++) {
        if (segments[i] === 'domains') {
          last_domains_index = i
        }
      }
      if (last_domains_index >= 0) {
        segments = segments.slice(last_domains_index + 1)
      }
      var clean_segments = []
      for (i = 0; i < segments.length; i++) {
        var segment = segments[i].trim()
        if (segment === '' || segment === '.') {
          continue
        }
        if (segment === '..') {
          return ''
        }
        clean_segments.push(segment)
      }
      return clean_segments.join('/')
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
