<template>
  <!--
    Decisión que una misión le dejó planteada a Lucas (misión dotin-misiones-admin, 26/11/2026): la pregunta con sus
    opciones (cada una con lo que cambia si se elige) y la recomendada. Una pregunta ORDINARIA abierta se responde acá
    con un toque (POST /local/missions/{slug}/questions/{uid}/answer); una SENSIBLE (producción, clientes o terceros,
    gastos, borrados) no tiene botones: sólo avisa que necesita el OK personal de Lucas por Slack o Telegram.
    Es de ancho completo: en el teléfono los botones van en columna.
  -->
  <section class="pq" :class="{ 'pq--sensible': es_sensible }" aria-label="Decisión pendiente de la misión">
    <h4 class="pq__titulo">
      <i class="bi bi-question-circle" aria-hidden="true" />
      {{ es_sensible ? 'Decisión sensible' : 'Esperando tu decisión' }}
    </h4>
    <p class="pq__texto">{{ pregunta.pregunta }}</p>

    <ul class="pq__opciones">
      <li v-for="o in opciones" :key="'pq-o-' + pregunta.question_uid + o.clave" class="pq__opcion" :class="{ 'pq__opcion--recomendada': o.clave === pregunta.recomendada }">
        <div class="pq__cabecera">
          <b class="pq__clave">{{ o.clave }})</b>
          <span class="pq__nombre">{{ o.texto }}</span>
          <span v-if="o.clave === pregunta.recomendada" class="pq__recomendada">recomendada</span>
        </div>
        <div v-if="o.impacto" class="pq__impacto">Qué cambia: {{ o.impacto }}</div>
        <button v-if="habilitada" type="button" class="pq__boton" :disabled="enviando" @click="enviar(o.clave)">
          Elegir {{ o.clave }}
        </button>
      </li>
    </ul>

    <!-- Comentario opcional: sólo mientras se puede responder -->
    <div v-if="habilitada" class="pq__libre">
      <label class="pq__etiqueta" :for="id_texto">Comentario (opcional)</label>
      <textarea :id="id_texto" v-model="texto" class="pq__texto-libre" rows="2" maxlength="1000" :disabled="enviando" placeholder="Si querés, aclará algo para la misión" />
      <button v-if="texto.trim() !== ''" type="button" class="pq__boton pq__boton--texto" :disabled="enviando" @click="enviar(null)">
        Responder sólo con el comentario
      </button>
    </div>

    <p v-if="registrada || ya_respondida" class="pq__ok" role="status">
      <i class="bi bi-check-circle" aria-hidden="true" />
      Respuesta registrada: la misión se retoma sola<template v-if="opcion_registrada"> (elegiste {{ opcion_registrada }})</template>.
    </p>
    <p v-if="error" class="pq__error" role="alert">{{ error }}</p>
    <p v-if="es_sensible" class="pq__sensible">
      <i class="bi bi-shield-lock" aria-hidden="true" />
      Necesita tu OK personal por Slack o Telegram: no se responde desde el Admin.
    </p>
  </section>
</template>

<script>
import api from '@/utils/axios'
import { cuerpo_de_respuesta, puede_responder } from '@/utils/local_oficina'

export default {
  name: 'ElLocalPreguntaDeMision',
  props: {
    /** `mision.seguimiento.pregunta`: pregunta, opciones (con impacto), recomendada, tipo, estado y respuesta. */
    pregunta: { type: Object, required: true },
    /** Slug de la misión (la ruta del admin es por slug, sin el prefijo `cc:`). */
    slug: { type: String, required: true },
  },
  emits: ['respondida'],
  data() {
    return {
      /** Comentario libre que acompaña (o reemplaza) a la opción. */
      texto: '',
      /** true mientras el POST está en vuelo (evita el doble clic). */
      enviando: false,
      /** true cuando el admin registró la respuesta en esta sesión. */
      registrada: false,
      /** Mensaje del último error (vacío si no hubo). */
      error: '',
      /** Intento en curso: su clave (opción + texto) y el `answer_uid` que se conserva en los reintentos. */
      intento: { clave: null, answer_uid: null },
    }
  },
  computed: {
    /** Las opciones de la pregunta (siempre una lista). */
    opciones() {
      return Array.isArray(this.pregunta.opciones) ? this.pregunta.opciones : []
    },
    /** Una pregunta sensible nunca se responde desde el Admin. */
    es_sensible() {
      return this.pregunta.tipo === 'sensible'
    },
    /** ¿Se puede responder ahora? (ordinaria, abierta y todavía sin respuesta registrada acá). */
    habilitada() {
      return puede_responder(this.pregunta) && !this.registrada
    },
    /** La pregunta ya tenía una respuesta registrada antes de abrir el panel. */
    ya_respondida() {
      return this.pregunta.estado === 'respondida' && !this.registrada
    },
    /** La opción que quedó registrada (la de la respuesta que trae el admin o la que se acaba de mandar). */
    opcion_registrada() {
      if (this.pregunta.respuesta && this.pregunta.respuesta.opcion) {
        return this.pregunta.respuesta.opcion
      }
      return this.intento.opcion || ''
    },
    /** Id único del campo de comentario (accesibilidad). */
    id_texto() {
      return 'pq-texto-' + this.pregunta.question_uid
    },
  },
  watch: {
    /** Si la misión cambió de pregunta o de revisión, se empieza de cero. */
    'pregunta.question_uid'() {
      this.reiniciar()
    },
    'pregunta.revision'() {
      this.reiniciar()
    },
  },
  methods: {
    /** Vuelve al estado inicial (otra pregunta u otra revisión). */
    reiniciar() {
      this.texto = ''
      this.enviando = false
      this.registrada = false
      this.error = ''
      this.intento = { clave: null, answer_uid: null }
    },
    /**
     * Manda la respuesta. El `answer_uid` se genera una vez por intento y se conserva si hay que reintentar con lo
     * mismo; si Lucas cambia la opción o el comentario, es otro intento y otro uuid.
     *
     * @param {string|null} opcion Clave de la opción elegida (null = sólo comentario).
     */
    enviar(opcion) {
      if (this.enviando || !this.habilitada) {
        return
      }
      const self = this
      const clave = (opcion || '') + '|' + this.texto.trim()
      if (this.intento.clave !== clave) {
        this.intento = { clave: clave, answer_uid: null }
      }
      const cuerpo = cuerpo_de_respuesta(this.pregunta, opcion, this.texto, this.intento.answer_uid)
      this.intento = { clave: clave, answer_uid: cuerpo.answer_uid, opcion: opcion }

      this.enviando = true
      this.error = ''
      const url = '/local/missions/' + encodeURIComponent(this.slug) + '/questions/' + encodeURIComponent(this.pregunta.question_uid) + '/answer'
      api
        .post(url, cuerpo, { silent_error: true })
        .then(function () {
          self.enviando = false
          self.registrada = true
          self.$emit('respondida', { slug: self.slug, question_uid: self.pregunta.question_uid })
        })
        .catch(function (e) {
          self.enviando = false
          const datos = e && e.response && e.response.data ? e.response.data : null
          self.error = datos && datos.message ? datos.message : 'No se pudo registrar la respuesta. Probá de nuevo.'
        })
    },
  },
}
</script>

<style scoped>
.pq {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(250, 126, 6, 0.12);
  border: 1px solid rgba(250, 126, 6, 0.5);
}
.pq--sensible {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.5);
}
.pq__titulo {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fdba74;
}
.pq--sensible .pq__titulo {
  color: #fca5a5;
}
.pq__texto {
  margin: 0;
  color: #fff;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.pq__opciones {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.pq__opcion {
  display: grid;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid transparent;
}
.pq__opcion--recomendada {
  border-color: rgba(34, 197, 94, 0.6);
}
.pq__cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}
.pq__clave {
  color: #fff;
}
.pq__nombre {
  color: #e5edf8;
  overflow-wrap: anywhere;
}
.pq__recomendada {
  padding: 1px 8px;
  border-radius: 999px;
  background: #22c55e;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.pq__impacto {
  color: #b9c4d6;
  font-size: 12px;
}
.pq__boton {
  min-height: 40px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(90deg, #0b84f8, #3a31fc);
  color: #fff;
  font: inherit;
  font-weight: 700;
  justify-self: start;
}
.pq__boton:disabled {
  opacity: 0.55;
}
.pq__boton:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
.pq__boton--texto {
  background: transparent;
  border: 1px solid #50647d;
  color: #e5edf8;
}
.pq__libre {
  display: grid;
  gap: 4px;
}
.pq__etiqueta {
  color: #b9c4d6;
  font-size: 12px;
}
.pq__texto-libre {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #50647d;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font: inherit;
  padding: 6px 8px;
  resize: vertical;
}
.pq__ok {
  margin: 0;
  color: #86efac;
  font-weight: 600;
}
.pq__error {
  margin: 0;
  color: #fca5a5;
  font-weight: 600;
}
.pq__sensible {
  margin: 0;
  color: #fca5a5;
  font-weight: 600;
}

/* Teléfono: los botones van en columna, a ancho completo. */
@media (max-width: 599px) {
  .pq__boton {
    width: 100%;
    justify-self: stretch;
  }
}
</style>
