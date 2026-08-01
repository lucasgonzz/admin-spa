<template>
  <!-- Con URL cargada: video corto en loop silencioso (se ve como GIF, sin controles
       ni sonido) por default, o -- cuando `controles` es true (ej. el video de
       introducción, prompt 05) -- video completo con controles y sonido, sin
       autoplay ni loop -- o imagen estática, según la extensión -->
  <video
    v-if="url && es_video"
    class="demo-pieza-media"
    :src="url"
    :autoplay="!controles"
    :muted="!controles"
    :loop="!controles"
    :controls="controles"
    playsinline
  />
  <img
    v-else-if="url && es_imagen"
    class="demo-pieza-media"
    :src="url"
    :alt="titulo"
  />

  <!-- Sin URL: placeholder de marca, con las mismas proporciones que va a tener
       la pieza real (queda dentro del mismo .demo-marco__pantalla-*-inner) -->
  <div v-else class="demo-pieza-placeholder">
    <span class="demo-pieza-placeholder__titulo">{{ titulo }}</span>
    <span class="demo-pieza-placeholder__badge">Sin cargar</span>
  </div>
</template>

<script>
/**
 * Pieza multimedia de un bloque del scroll de dolor: video corto, imagen, o
 * placeholder de marca cuando todavía no hay URL cargada para ese slot.
 *
 * Las URLs de cada pieza se configuran desde admin-spa (fuera del scope de
 * este prompt) y viajan en el mapa `media` del payload de
 * GET /demo-experiencia/{uuid}, keyeadas por slot_id (ej. "scroll.3"). Este
 * componente es puramente de presentación: no hace fetch propio.
 *
 * El placeholder ocupa el 100% del ancho/alto disponible (el tamaño real lo
 * fija MarcoDispositivo) para que el diseño se pueda juzgar completo incluso
 * sin ningún video cargado (contexto/demo_experiencia.md §3.18, criterio de
 * éxito 4 del prompt).
 */
export default {
  name: 'PiezaMultimedia',

  props: {
    /** Identificador de la pieza dentro del catálogo de la demo (ej. "scroll.3"). */
    slot_id: {
      type: String,
      required: true,
    },
    /** Título del slot: se muestra en el placeholder cuando no hay URL. */
    titulo: {
      type: String,
      required: true,
    },
    /** Mapa { slot_id: url } tal como llega en `media` en el payload del endpoint público. */
    media: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /**
     * false (default, compatible con los seis clips del scroll de dolor): video
     * en loop silencioso sin controles, autoplay, se ve como un GIF.
     * true (usado por el video de introducción, prompt 05): video completo con
     * controles y sonido, sin autoplay ni loop -- es de varios minutos y el
     * lead lo mira, no lo ojea (contexto/demo_experiencia.md, prompt 05 §2).
     */
    controles: {
      type: Boolean,
      default: false,
    },
  },

  computed: {
    /**
     * URL de la pieza para este slot_id, o cadena vacía si todavía no se cargó.
     *
     * @returns {string}
     */
    url() {
      if (!this.media || !this.media[this.slot_id]) {
        return ''
      }
      return this.media[this.slot_id]
    },

    /**
     * true si la extensión de la URL corresponde a un clip de video corto.
     *
     * @returns {boolean}
     */
    es_video() {
      return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(this.url)
    },

    /**
     * true si la extensión de la URL corresponde a una imagen estática.
     *
     * @returns {boolean}
     */
    es_imagen() {
      return /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(this.url)
    },
  },
}
</script>
