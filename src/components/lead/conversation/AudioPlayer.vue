<template>
  <!-- Reproductor de audio propio, estética WhatsApp: play/pause + barra de progreso + tiempo + velocidad -->
  <div class="wa-audio-player">

    <!-- Elemento <audio> real, oculto: se controla por código vía $refs.audio_el -->
    <audio
      ref="audio_el"
      :src="src"
      preload="metadata"
      class="wa-audio-native"
    />

    <!-- Botón circular play/pause -->
    <button
      type="button"
      class="wa-audio-play-btn"
      :title="is_playing ? 'Pausar' : 'Reproducir'"
      @click="toggle_play"
    >
      <i class="bi" :class="is_playing ? 'bi-pause-fill' : 'bi-play-fill'" aria-hidden="true" />
    </button>

    <!-- Centro: barra de progreso clickeable + tiempo -->
    <div class="wa-audio-center">
      <!-- Barra de progreso: input range para permitir seek arrastrando o clickeando -->
      <input
        type="range"
        class="wa-audio-progress"
        min="0"
        :max="progress_max"
        step="0.1"
        :value="current_time"
        @input="on_seek"
      />
      <!-- Tiempo: transcurrido mientras reproduce, duración total en reposo -->
      <span class="wa-audio-time">{{ time_label }}</span>
    </div>

    <!-- Botón de velocidad: cicla 1x -> 1.5x -> 2x -->
    <button
      type="button"
      class="wa-audio-rate-btn"
      title="Velocidad de reproducción"
      @click="cycle_rate"
    >
      {{ playback_rate }}x
    </button>

  </div>
</template>

<script>
/**
 * Reproductor de audio propio con estética WhatsApp para las burbujas de audio del lead.
 *
 * Reemplaza al control nativo `<audio controls>` controlando un elemento `<audio>` oculto
 * por código. Soporta play/pause, seek por barra de progreso y cambio de velocidad.
 */
export default {
  name: 'LeadAudioPlayer',
  props: {
    /** URL del archivo de audio (URL firmada del adjunto). */
    src: { type: String, required: true },
  },
  data() {
    return {
      /** true mientras el audio se está reproduciendo. */
      is_playing: false,
      /** Segundo actual de reproducción. */
      current_time: 0,
      /** Duración total del audio en segundos (0 o Infinity si aún no se conoce). */
      duration: 0,
      /** Velocidad de reproducción actual (cicla entre los valores de rate_steps). */
      playback_rate: 1,
      /** Pasos de velocidad disponibles, en orden de ciclado. */
      rate_steps: [1, 1.5, 2],
    }
  },
  computed: {
    /**
     * true si la duración reportada por el navegador es un número finito y positivo.
     * Algunos audios webm/ogg de WhatsApp reportan Infinity hasta hacer seek.
     *
     * @returns {boolean}
     */
    has_valid_duration() {
      return typeof this.duration === 'number' && isFinite(this.duration) && this.duration > 0
    },
    /**
     * Máximo de la barra de progreso: la duración si es válida, sino un fallback
     * para que el slider siga siendo operable mientras no se conoce la duración real.
     *
     * @returns {number}
     */
    progress_max() {
      if (this.has_valid_duration) {
        return this.duration
      }
      /* Fallback: al menos el tiempo actual + 1 para que el slider no quede bloqueado en 0. */
      return Math.max(this.current_time + 1, 1)
    },
    /**
     * Etiqueta de tiempo: transcurrido mientras reproduce, duración total en reposo.
     *
     * @returns {string}
     */
    time_label() {
      if (this.is_playing || this.current_time > 0) {
        return this.format_time(this.current_time)
      }
      if (this.has_valid_duration) {
        return this.format_time(this.duration)
      }
      return '--:--'
    },
  },
  mounted() {
    /* Registrar listeners del elemento audio al montar el componente. */
    const el = this.$refs.audio_el
    if (!el) {
      return
    }
    el.addEventListener('loadedmetadata', this.on_loaded_metadata)
    el.addEventListener('timeupdate', this.on_time_update)
    el.addEventListener('play', this.on_play)
    el.addEventListener('pause', this.on_pause)
    el.addEventListener('ended', this.on_ended)
  },
  beforeUnmount() {
    /* Quitar listeners y frenar la reproducción para evitar fugas de memoria. */
    const el = this.$refs.audio_el
    if (!el) {
      return
    }
    el.removeEventListener('loadedmetadata', this.on_loaded_metadata)
    el.removeEventListener('timeupdate', this.on_time_update)
    el.removeEventListener('play', this.on_play)
    el.removeEventListener('pause', this.on_pause)
    el.removeEventListener('ended', this.on_ended)
    el.pause()
  },
  methods: {
    /**
     * Alterna entre reproducir y pausar el audio.
     *
     * @returns {void}
     */
    toggle_play() {
      const el = this.$refs.audio_el
      if (!el) {
        return
      }
      if (el.paused) {
        /* play() devuelve promesa: usar .catch para no romper si el navegador la rechaza. */
        const result = el.play()
        if (result && typeof result.catch === 'function') {
          result.catch(function () {
            /* Reproducción bloqueada (autoplay policy u otra causa): se ignora silenciosamente. */
          })
        }
      } else {
        el.pause()
      }
    },
    /**
     * Cicla la velocidad de reproducción entre los pasos configurados (1x -> 1.5x -> 2x).
     *
     * @returns {void}
     */
    cycle_rate() {
      const current_index = this.rate_steps.indexOf(this.playback_rate)
      const next_index = (current_index + 1) % this.rate_steps.length
      this.playback_rate = this.rate_steps[next_index]
      const el = this.$refs.audio_el
      if (el) {
        el.playbackRate = this.playback_rate
      }
    },
    /**
     * Mueve la reproducción a la posición indicada por la barra de progreso.
     *
     * @param {Event} event Evento input del slider.
     * @returns {void}
     */
    on_seek(event) {
      const el = this.$refs.audio_el
      if (!el) {
        return
      }
      const new_time = parseFloat(event.target.value)
      if (isNaN(new_time)) {
        return
      }
      el.currentTime = new_time
      this.current_time = new_time
    },
    /**
     * Al conocerse la metadata, guardar la duración del audio.
     *
     * @returns {void}
     */
    on_loaded_metadata() {
      const el = this.$refs.audio_el
      if (el) {
        this.duration = el.duration
      }
    },
    /**
     * Actualiza el segundo actual mientras avanza la reproducción.
     *
     * @returns {void}
     */
    on_time_update() {
      const el = this.$refs.audio_el
      if (el) {
        this.current_time = el.currentTime
        /* Si la duración recién ahora se vuelve finita (caso webm/ogg), tomarla. */
        if (!this.has_valid_duration && isFinite(el.duration) && el.duration > 0) {
          this.duration = el.duration
        }
      }
    },
    /**
     * Marca el estado como reproduciendo.
     *
     * @returns {void}
     */
    on_play() {
      this.is_playing = true
    },
    /**
     * Marca el estado como pausado.
     *
     * @returns {void}
     */
    on_pause() {
      this.is_playing = false
    },
    /**
     * Al terminar el audio: vuelve al inicio y marca pausado.
     *
     * @returns {void}
     */
    on_ended() {
      this.is_playing = false
      this.current_time = 0
    },
    /**
     * Formatea segundos a mm:ss.
     *
     * @param {number} seconds Segundos a formatear.
     * @returns {string}
     */
    format_time(seconds) {
      const total = Math.max(0, Math.floor(seconds || 0))
      const minutes = Math.floor(total / 60)
      const remaining = total % 60
      const padded = remaining < 10 ? '0' + remaining : '' + remaining
      return minutes + ':' + padded
    },
  },
}
</script>

<style scoped>
/* Contenedor del reproductor: fila horizontal compacta tipo WhatsApp. */
.wa-audio-player {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 220px;
  max-width: min(100%, 360px);
  margin-bottom: 0.25rem;
}

/* El <audio> real queda fuera de pantalla; se controla solo por código. */
.wa-audio-native {
  display: none;
}

/* Botón circular play/pause. */
.wa-audio-play-btn {
  flex-shrink: 0;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  border: none;
  background: var(--bs-primary, #0d6efd);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  cursor: pointer;
  padding: 0;
  transition: filter 0.15s;
}
.wa-audio-play-btn:hover {
  filter: brightness(1.08);
}

/* Centro: barra de progreso arriba, tiempo abajo. */
.wa-audio-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

/* Barra de progreso (input range) con apariencia fina tipo WhatsApp. */
.wa-audio-progress {
  width: 100%;
  height: 0.35rem;
  cursor: pointer;
  accent-color: var(--bs-primary, #0d6efd);
}

/* Tiempo transcurrido / duración. */
.wa-audio-time {
  font-size: 0.7rem;
  line-height: 1;
  color: var(--bs-secondary-color, #6c757d);
  font-variant-numeric: tabular-nums;
}

/* Botón de velocidad de reproducción. */
.wa-audio-rate-btn {
  flex-shrink: 0;
  border: 1px solid var(--bs-border-color, #dee2e6);
  background: rgba(255, 255, 255, 0.7);
  color: var(--bs-secondary-color, #6c757d);
  border-radius: 0.8rem;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
  padding: 0.2rem 0.4rem;
  cursor: pointer;
  min-width: 2.1rem;
  text-align: center;
}
.wa-audio-rate-btn:hover {
  background: #fff;
}
</style>
