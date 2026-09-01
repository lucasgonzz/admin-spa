<template>
  <div
    v-if="cards.length"
    class="lead-status-cards mb-3"
    :class="{ 'lead-status-cards--loading': loading }"
  >
    <!--
      Cada tarjeta es un <button>, no un <div @click>: es un control, así que tiene que ser
      tabulable y responder a Enter/Espacio sin código extra.
    -->
    <button
      v-for="card in cards"
      :key="'lead-status-card-' + card.value"
      type="button"
      class="lead-status-card"
      :class="{ 'lead-status-card--active': is_active(card) }"
      :style="card_style(card)"
      :aria-pressed="is_active(card) ? 'true' : 'false'"
      :title="card_title(card)"
      @click="$emit('select', card)"
    >
      <span class="lead-status-card__head">
        <span
          class="lead-status-nav-dot"
          aria-hidden="true"
          :style="{ backgroundColor: card_color(card) }"
        />
        <span class="lead-status-card__title">{{ card.text }}</span>
      </span>
      <span class="lead-status-card__total">{{ card.total }}</span>
      <span
        class="lead-status-card__sub"
        :class="card.sin_responder > 0 ? 'text-danger fw-semibold' : 'text-muted'"
      >
        <i class="bi bi-exclamation-circle-fill me-1" aria-hidden="true" />
        {{ card.sin_responder }} sin responder
      </span>
    </button>
  </div>
</template>

<script>
/** Gris de fallback: el mismo que ya usa el puntito de la barra de estados cuando no hay color. */
const COLOR_FALLBACK = '#ced4da'

/**
 * Convierte un hex (#rgb o #rrggbb) a rgba() con el alfa pedido.
 *
 * Se usa para el lavado de fondo de la tarjeta. Si el hex no es válido cae al gris de fallback,
 * porque la lista de tarjetas la define el backend y no queremos un estilo roto por un color mal
 * cargado en el catálogo.
 *
 * @param {string} hex Color en formato #rgb o #rrggbb.
 * @param {number} alfa Opacidad entre 0 y 1.
 * @returns {string} Color en formato rgba(...).
 */
function hex_a_rgba(hex, alfa) {
  var limpio = String(hex || '').trim().replace('#', '')
  var r = 206
  var g = 212
  var b = 218

  if (/^[0-9a-fA-F]{3}$/.test(limpio)) {
    r = parseInt(limpio.charAt(0) + limpio.charAt(0), 16)
    g = parseInt(limpio.charAt(1) + limpio.charAt(1), 16)
    b = parseInt(limpio.charAt(2) + limpio.charAt(2), 16)
  } else if (/^[0-9a-fA-F]{6}$/.test(limpio)) {
    r = parseInt(limpio.substring(0, 2), 16)
    g = parseInt(limpio.substring(2, 4), 16)
    b = parseInt(limpio.substring(4, 6), 16)
  }

  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alfa + ')'
}

/**
 * Grilla de tarjetas de estado arriba de la grilla de leads.
 *
 * No inventa tarjetas, no las ordena y no hardcodea ningún color: todo eso llega tal cual del
 * endpoint GET /lead/status-cards, que lo saca del catálogo LeadPipelineStatus. Lo único propio
 * es el gris de fallback cuando un estado no tiene color cargado.
 *
 * 🔴 El color del estado va SOLO al borde izquierdo, al puntito y al lavado de fondo. El número
 * grande queda con el color de texto del tema: el catálogo puede traer amarillos o grises claros,
 * ilegibles como color de texto sobre blanco.
 */
export default {
  name: 'LeadStatusCards',
  emits: ['select'],
  props: {
    /**
     * Tarjetas tal cual las devuelve GET /lead/status-cards.
     * @type {Array<{ value: string, text: string, color: string, group: string|null, total: number, sin_responder: number }>}
     */
    cards: {
      type: Array,
      default: function () { return [] },
    },
    /** Slug del estado filtrado ahora (null = ninguno). Marca la tarjeta activa. */
    active_status_slug: {
      type: String,
      default: null,
    },
    /** true mientras el GET está en vuelo: baja la opacidad, no vacía los números. */
    loading: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    /**
     * true si esta tarjeta corresponde al estado filtrado ahora.
     *
     * Se apoya en el mismo `active_status_slug` que usa la fila 2 de la barra de navegación,
     * así que no hace falta ningún código de sincronización propio.
     *
     * @param {{ value: string }} card
     * @returns {boolean}
     */
    is_active(card) {
      if (!card || this.active_status_slug == null) {
        return false
      }
      return String(this.active_status_slug) === String(card.value)
    },
    /**
     * Color del estado, con el gris de fallback si el catálogo no trajo ninguno.
     *
     * @param {{ color: string }} card
     * @returns {string}
     */
    card_color(card) {
      return (card && card.color) || COLOR_FALLBACK
    },
    /**
     * Estilo inline de la tarjeta: borde izquierdo, lavado de fondo y, si está activa, un
     * contorno interno del mismo color.
     *
     * @param {Object} card
     * @returns {Object} objeto de estilo para :style
     */
    card_style(card) {
      var color = this.card_color(card)
      var activa = this.is_active(card)
      return {
        borderLeftColor: color,
        backgroundColor: hex_a_rgba(color, activa ? 0.18 : 0.07),
        boxShadow: activa ? ('inset 0 0 0 1px ' + color) : 'none',
      }
    },
    /**
     * Texto del tooltip, con el mismo tono que status_nav_title() de la barra de estados.
     *
     * @param {{ text: string, total: number, sin_responder: number }} card
     * @returns {string}
     */
    card_title(card) {
      if (!card) {
        return ''
      }
      return 'Ver solo leads en ' + card.text + ' — ' + card.total + ' leads, ' +
        card.sin_responder + ' sin responder'
    },
  },
}
</script>
