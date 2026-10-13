<template>
  <!-- Encuesta al terminar el video (o al votar 👎): la del prototipo, como diálogo. Se dibuja
       encima del reproductor. -->
  <div class="encuesta-fondo" @keydown.esc.stop="$emit('cerrar')">
    <div ref="dialogo" class="encuesta" role="dialog" aria-modal="true" :aria-labelledby="id + '-titulo'" tabindex="-1">
      <template v-if="!enviada">
        <h3 :id="id + '-titulo'">{{ por_voto ? '¿Qué no te gustó?' : '¡Terminaste el video!' }}</h3>
        <div class="sub">Tres preguntas rápidas para mejorar "{{ video.titulo }}".</div>

        <div :id="id + '-util'" class="preg">¿Te resultó útil?</div>
        <div class="opciones" role="group" :aria-labelledby="id + '-util'">
          <button
            v-for="op in OPCIONES_UTIL"
            :key="op.valor"
            ref="primera"
            type="button"
            :class="{ elegido: util === op.valor }"
            :aria-pressed="util === op.valor ? 'true' : 'false'"
            @click="util = op.valor"
          >
            {{ op.texto }}
          </button>
        </div>

        <div :id="id + '-entendio'" class="preg">¿Se entendió?</div>
        <div class="opciones" role="group" :aria-labelledby="id + '-entendio'">
          <button
            v-for="op in OPCIONES_ENTENDIO"
            :key="op.valor"
            type="button"
            :class="{ elegido: entendio === op.valor }"
            :aria-pressed="entendio === op.valor ? 'true' : 'false'"
            @click="entendio = op.valor"
          >
            {{ op.texto }}
          </button>
        </div>

        <label class="preg" :for="id + '-mejora'">
          ¿Qué te gustaría que mejoremos de este video? <span class="opcional">(opcional)</span>
        </label>
        <textarea
          :id="id + '-mejora'"
          v-model="mejora"
          maxlength="2000"
          placeholder="Por ejemplo: fue muy rápido en la parte de…; me faltó ver cómo…"
        />

        <div class="pie">
          <button type="button" @click="$emit('cerrar')">Ahora no</button>
          <button type="button" class="verde" :disabled="enviando" @click="enviar">
            {{ enviando ? 'Enviando…' : 'Enviar' }}
          </button>
        </div>
      </template>

      <template v-else>
        <h3 :id="id + '-titulo'">¡Gracias!</h3>
        <div class="sub">
          Con tu respuesta mejoramos el video.
          <template v-if="entendio && entendio !== 'si'">
            Si te quedó una duda puntual, dejala abajo en <b>Preguntas</b> y te respondemos.
          </template>
        </div>
        <div class="pie">
          <button ref="cerrar" type="button" @click="$emit('cerrar')">Cerrar</button>
          <button v-if="siguiente" type="button" class="verde" @click="$emit('ver-siguiente')">
            Ver el siguiente: {{ recortar(siguiente.titulo, 34) }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { enviar_encuesta, mostrar_toast } from '../estado'
import { recortar } from '../utiles'

/** Contador para ids únicos de los rótulos (aria-labelledby). */
let siguiente_id = 0

/**
 * Encuesta de un video: ¿útil? / ¿se entendió? / qué mejorar. Se responde una vez por video
 * (mandarla de nuevo la actualiza en el servidor) y al menos una de las tres tiene que venir
 * (§2, C2: `POST recursos/encuestas`).
 */
export default {
  name: 'EncuestaVideo',
  props: {
    /** Video del catálogo. */
    video: { type: Object, required: true },
    /** Video siguiente (para "Ver el siguiente"), o null si es el último. */
    siguiente: { type: Object, default: null },
    /** true si la abrió un 👎 (cambia el título). */
    por_voto: { type: Boolean, default: false },
  },
  emits: ['cerrar', 'ver-siguiente'],
  data() {
    siguiente_id++
    return {
      /** Prefijo de ids de este diálogo. */
      id: 'encuesta-' + siguiente_id,
      /** Respuesta a "¿Te resultó útil?": 'si' | 'no' | null. */
      util: null,
      /** Respuesta a "¿Se entendió?": 'si' | 'mas_o_menos' | 'no' | null. */
      entendio: null,
      /** "Qué mejorar", texto libre. */
      mejora: '',
      /** true mientras se manda. */
      enviando: false,
      /** true después de mandarla bien (se muestra el "¡Gracias!"). */
      enviada: false,
      /** Opciones de "¿Te resultó útil?". */
      OPCIONES_UTIL: [
        { valor: 'si', texto: 'Sí' },
        { valor: 'no', texto: 'No' },
      ],
      /** Opciones de "¿Se entendió?". */
      OPCIONES_ENTENDIO: [
        { valor: 'si', texto: 'Sí, todo' },
        { valor: 'mas_o_menos', texto: 'Más o menos' },
        { valor: 'no', texto: 'No' },
      ],
    }
  },
  mounted() {
    /* El foco entra al diálogo: la primera opción. */
    this.$nextTick(() => {
      /** Botones de la primera pregunta (ref dentro de v-for = array). */
      const primeros = this.$refs.primera
      if (primeros && primeros[0]) {
        primeros[0].focus({ preventScroll: true })
      } else if (this.$refs.dialogo) {
        this.$refs.dialogo.focus({ preventScroll: true })
      }
    })
  },
  methods: {
    recortar: recortar,
    /**
     * Manda la encuesta. Sin ninguna respuesta no sale (la misma regla del prototipo y del
     * servidor).
     * @returns {void}
     */
    enviar() {
      /** Texto de "qué mejorar" sin espacios de más. */
      const mejora = this.mejora.trim()
      if (!this.util && !this.entendio && !mejora) {
        mostrar_toast('Elegí al menos una respuesta')
        return
      }
      this.enviando = true
      enviar_encuesta(this.video.codigo, { util: this.util, entendio: this.entendio, mejora: mejora || null })
        .then(() => {
          this.enviada = true
          this.$nextTick(() => {
            if (this.$refs.cerrar) {
              this.$refs.cerrar.focus({ preventScroll: true })
            }
          })
        })
        .catch((error) => {
          if (error && error.status === 401) {
            mostrar_toast('Tu sesión se cerró: la encuesta no se pudo guardar.')
            this.$emit('cerrar')
            return
          }
          mostrar_toast('No se pudo mandar la encuesta. Probá de nuevo.')
        })
        .then(() => {
          this.enviando = false
        })
    },
  },
}
</script>
