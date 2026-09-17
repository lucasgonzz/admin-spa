<template>
  <div
    ref="horizontal_nav"
    class="horizontal-nav"
    :class="{ 'has_horizontal_scroll': has_horizontal_scroll, 'horizontal-nav--stretch': stretch }"
    role="tablist"
  >
    <button
      v-for="(item, i) in items"
      :key="item_value(item) !== null ? item_value(item) : i"
      type="button"
      role="tab"
      class="horizontal-nav__item"
      :class="{ active: is_active(item) }"
      :aria-selected="is_active(item) ? 'true' : 'false'"
      :data-testid="testid(item)"
      @click="select(item)"
    >
      {{ item_label(item) }}
      <span
        v-if="item.alert"
        class="badge rounded-pill text-bg-danger ms-1"
      >{{ item.alert }}</span>
    </button>
  </div>
</template>

<script>
/**
 * Nav horizontal segmentado: pista gris con la pestaña activa en azul sólido.
 *
 * Es el mismo diseño que ya se había elegido dos veces a mano dentro del admin
 * (`impl-detail-tab-bar` en Implementations / EcommerceImplementations) y el mismo que usa
 * `empresa-spa` en `common-vue/components/horizontal-nav`: la API de props y el nombre del evento
 * se copian de ahí a propósito, para que una pestaña se lea igual en los dos sistemas.
 *
 * 🔴 El componente SOLO pinta y avisa: no rutea, no toca el store y no decide qué es lo activo.
 * El ítem activo lo manda el padre por `selected_item_value` y el componente emite `setSelected`.
 *
 * `data-testid` de cada pestaña: `nav-item-<item.testid || label>` (convención de empresa).
 */
export default {
  name: 'HorizontalNav',
  props: {
    /**
     * Pestañas a pintar.
     * @type {Array<{ key: string|number, label: string, alert?: string|number, testid?: string }>}
     */
    items: { type: Array, default: () => [] },
    /** Valor (`key`) del ítem activo. Controlado desde afuera. */
    selected_item_value: { type: [String, Number], default: null },
    /**
     * true = cada pestaña ocupa el mismo ancho (`flex: 1 1 0`) y la pista toma el ancho completo
     * del contenedor. Es lo que necesitan las barras que viven en una columna angosta.
     */
    stretch: { type: Boolean, default: false },
  },
  emits: ['setSelected'],
  data() {
    return {
      /** true cuando los ítems no entran y el contenedor necesita scroll horizontal. */
      has_horizontal_scroll: false,
      /** Timeout del debounce del resize de ventana. */
      horizontal_scroll_check_timeout: null,
      /** ResizeObserver del contenedor, si el navegador lo soporta. */
      horizontal_nav_resize_observer: null,
    }
  },
  watch: {
    /**
     * Recalcula el overflow cuando cambian la cantidad o el texto de las pestañas.
     */
    items: {
      handler() {
        this.schedule_horizontal_scroll_check()
      },
      deep: true,
    },
  },
  mounted() {
    this.schedule_horizontal_scroll_check()
    window.addEventListener('resize', this.on_window_resize)
    this.init_resize_observer()
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.on_window_resize)
    if (this.horizontal_scroll_check_timeout) {
      clearTimeout(this.horizontal_scroll_check_timeout)
      this.horizontal_scroll_check_timeout = null
    }
    this.destroy_resize_observer()
  },
  methods: {
    /**
     * Valor con el que se compara `selected_item_value`. Si el ítem no trae `key`, se cae al label.
     * @param {Object} item
     * @returns {string|number|null}
     */
    item_value(item) {
      if (!item) {
        return null
      }
      if (item.key !== undefined && item.key !== null) {
        return item.key
      }
      if (item.label !== undefined && item.label !== null) {
        return item.label
      }
      return null
    },
    /**
     * Texto visible de la pestaña.
     * @param {Object} item
     * @returns {string}
     */
    item_label(item) {
      if (!item) {
        return ''
      }
      if (item.label !== undefined && item.label !== null) {
        return item.label
      }
      return String(this.item_value(item) === null ? '' : this.item_value(item))
    },
    /**
     * @param {Object} item
     * @returns {boolean}
     */
    is_active(item) {
      const value = this.item_value(item)
      if (value === null || this.selected_item_value === null) {
        return false
      }
      return value === this.selected_item_value
    },
    /**
     * `data-testid` de la pestaña, con la convención de empresa (`nav-item-<valor>`).
     *
     * Un ítem puede traer su propio `testid` y, cuando lo trae, MANDA sobre el texto visible:
     * hay labels que incluyen datos que cambian (contadores, nombres de clientes) y un testid
     * que cambia con los datos no sirve para nada.
     *
     * @param {Object} item
     * @returns {string|null}
     */
    testid(item) {
      if (item && typeof item.testid === 'string' && item.testid.length) {
        return 'nav-item-' + item.testid
      }
      const label = this.item_label(item)
      if (typeof label !== 'string' || !label.length) {
        return null
      }
      return 'nav-item-' + label
    },
    /**
     * Avisa al padre; el componente no cambia nada por su cuenta.
     * @param {Object} item
     */
    select(item) {
      this.$emit('setSelected', item)
    },
    /**
     * Verifica el overflow después del próximo render.
     */
    schedule_horizontal_scroll_check() {
      this.$nextTick(() => {
        this.update_horizontal_scroll_state()
      })
    },
    /**
     * Revalida el overflow al cambiar el tamaño de la ventana (debounce de 100ms).
     */
    on_window_resize() {
      if (this.horizontal_scroll_check_timeout) {
        clearTimeout(this.horizontal_scroll_check_timeout)
      }
      this.horizontal_scroll_check_timeout = setTimeout(() => {
        this.update_horizontal_scroll_state()
      }, 100)
    },
    /**
     * Prende `has_horizontal_scroll` cuando los ítems desbordan el contenedor, para reservar
     * espacio a la barra de scroll al hacer hover/focus y que no tape el texto de las pestañas.
     */
    update_horizontal_scroll_state() {
      const nav = this.$refs.horizontal_nav
      if (!nav) {
        this.has_horizontal_scroll = false
        return
      }
      /* Tolerancia de 1px por redondeos de subpíxeles entre navegadores. */
      this.has_horizontal_scroll = nav.scrollWidth > (nav.clientWidth + 1)
    },
    /**
     * Observa el tamaño del contenedor (el modal cambia de ancho sin que cambie la ventana).
     */
    init_resize_observer() {
      if (typeof ResizeObserver === 'undefined') {
        return
      }
      const nav = this.$refs.horizontal_nav
      if (!nav) {
        return
      }
      const self = this
      this.horizontal_nav_resize_observer = new ResizeObserver(function () {
        self.update_horizontal_scroll_state()
      })
      this.horizontal_nav_resize_observer.observe(nav)
    },
    /**
     * Libera el observer al destruir el componente.
     */
    destroy_resize_observer() {
      if (this.horizontal_nav_resize_observer) {
        this.horizontal_nav_resize_observer.disconnect()
        this.horizontal_nav_resize_observer = null
      }
    },
  },
}
</script>

<style scoped>
/*
  Pista gris segmentada. Los colores van como token con el literal viejo de fallback: la hoja de
  tokens puede no existir todavía y el componente tiene que verse bien igual; cuando exista, toma
  el token solo. El fondo usa su propio token (--bg-nav) y no uno genérico de sección.
*/
.horizontal-nav {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  gap: 6px;
  padding: 4px;
  overflow-x: auto;
  overflow-y: hidden;
  background-color: var(--bg-nav, #E3E3E3);
  border-radius: 10px;
  transition: padding-bottom 0.12s ease;
}

/*
  Con scroll horizontal, la barra del navegador se dibuja encima de los ítems. Al interactuar se
  agrega espacio abajo para que la barra no tape el texto.
*/
.horizontal-nav.has_horizontal_scroll:hover,
.horizontal-nav.has_horizontal_scroll:focus-within {
  padding-bottom: 14px;
}

/*
  `stretch`: además de repartir el ancho parejo entre las pestañas, la pista toma el ancho completo
  del contenedor. Sin esto, `width: fit-content` la dejaría más angosta que la columna y el reparto
  parejo no se notaría (es el ancho que ya tenían las barras de implementaciones).
*/
.horizontal-nav--stretch {
  display: flex;
  width: 100%;
}

.horizontal-nav--stretch .horizontal-nav__item {
  flex: 1 1 0;
}

/* Pestaña inactiva: texto secundario sobre fondo transparente. */
.horizontal-nav__item {
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  color: var(--color-text-secondary, #6c757d);
  background-color: transparent;
  white-space: nowrap;
  transition: color 0.12s ease, background-color 0.12s ease, box-shadow 0.12s ease;
}

.horizontal-nav__item:hover:not(.active) {
  color: var(--color-primary, #0d6efd);
  /* Token propio: este celeste es un hover AZULADO a propósito, no el gris de hover genérico. */
  background-color: var(--bg-nav-hover, #e7f1ff);
}

.horizontal-nav__item:focus,
.horizontal-nav__item:focus-visible {
  box-shadow: none;
  outline: none;
}

.horizontal-nav__item:focus-visible {
  outline: 2px solid var(--color-primary, #0d6efd);
  outline-offset: 2px;
}

/* Pestaña activa: relleno azul sólido, como el btn-primary. */
.horizontal-nav__item.active {
  color: #fff;
  background-color: var(--color-primary, #0d6efd);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(13, 110, 253, 0.28);
}

.horizontal-nav__item.active:hover {
  color: #fff;
  /* Queda literal: es el primario OSCURECIDO para el hover, no el primario. */
  background-color: #0b5ed7;
}
</style>
