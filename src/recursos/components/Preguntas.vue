<template>
  <section class="tarjeta" aria-labelledby="titulo-preguntas">
    <h3 id="titulo-preguntas">Preguntas y comentarios ({{ lista.length }})</h3>
    <p class="intro">
      ¿Algo no quedó claro? Preguntá acá: te responde el equipo de ComercioCity y la respuesta les sirve a todos.
    </p>

    <!-- Modo soporte (login maestro, solo lectura): no se publica nada, la caja se reemplaza por un aviso. -->
    <p v-if="solo_lectura" class="nota-lectura caja" role="note">
      Modo soporte · solo lectura: desde acá no se pueden publicar preguntas ni comentarios.
    </p>
    <!-- Con sesión: la caja para preguntar. -->
    <div v-else-if="estado.usuario" class="comentar">
      <div class="avatar" aria-hidden="true">{{ inicial(nombre_pila) }}</div>
      <div class="lado">
        <textarea
          ref="caja"
          v-model="texto"
          maxlength="2000"
          aria-label="Tu pregunta o comentario"
          placeholder="Escribí tu pregunta o comentario sobre este video"
        />
        <div>
          <span>Se publica con tu nombre: {{ nombre_pila }}</span>
          <button type="button" class="verde" :disabled="publicando" @click="publicar">
            {{ publicando ? 'Publicando…' : 'Publicar' }}
          </button>
        </div>
      </div>
    </div>
    <!-- Sin sesión: la línea de invitado en lugar de la caja (§5.1). -->
    <p v-else class="linea-invitado">{{ LINEA_INVITADO }}</p>

    <div v-if="lista.length" class="orden" role="group" aria-label="Ordenar preguntas">
      <button
        type="button"
        :class="{ activo: orden === 'utiles' }"
        :aria-pressed="orden === 'utiles' ? 'true' : 'false'"
        @click="orden = 'utiles'"
      >
        Más útiles
      </button>
      <button
        type="button"
        :class="{ activo: orden === 'nuevos' }"
        :aria-pressed="orden === 'nuevos' ? 'true' : 'false'"
        @click="orden = 'nuevos'"
      >
        Más nuevos
      </button>
    </div>

    <div v-for="c in ordenadas" :key="c.id" class="comentario">
      <div class="avatar" aria-hidden="true">{{ inicial(c.autor) }}</div>
      <div class="cuerpo">
        <div class="quien">
          {{ c.autor }}<small>{{ cuando(c.fecha) }}</small>
          <span v-if="!texto_respuesta(c)" class="insignia pend">Esperando respuesta</span>
        </div>
        <div class="texto">{{ c.texto }}</div>
        <div class="acciones">
          <button
            type="button"
            :class="{ dado: !!c.me_gusta_mio }"
            :disabled="!estado.usuario || solo_lectura"
            :aria-pressed="c.me_gusta_mio ? 'true' : 'false'"
            :aria-label="'A mí también me sirve (' + (Number(c.me_gusta) || 0) + ')'"
            :title="titulo_me_gusta"
            @click="me_gusta(c)"
          >
            👍 {{ Number(c.me_gusta) || 0 }}
          </button>
        </div>
        <!-- La respuesta de ComercioCity, destacada. -->
        <div v-if="texto_respuesta(c)" class="respuesta">
          <div class="quien">
            ComercioCity <span class="insignia cc">Equipo</span><small>{{ cuando(fecha_respuesta(c)) }}</small>
          </div>
          <div class="texto">{{ texto_respuesta(c) }}</div>
        </div>
      </div>
    </div>

    <p v-if="detalle.cargando && !lista.length" class="comentarios-estado">Cargando preguntas…</p>
    <p v-else-if="detalle.error" class="comentarios-estado">
      No se pudieron cargar las preguntas.
      <button type="button" @click="reintentar">Reintentar</button>
    </p>
  </section>
</template>

<script>
import { estado, es_solo_lectura, es_error_solo_lectura, publicar_pregunta, alternar_me_gusta, cargar_detalle, mostrar_toast } from '../estado'
import { cuando, inicial, a_milisegundos, LINEA_INVITADO } from '../utiles'

/**
 * Preguntas y comentarios de un video: publicar (con sesión), me gusta, orden por más útiles o
 * más nuevos, la respuesta de ComercioCity destacada y "Esperando respuesta" en las propias.
 *
 * Qué se ve lo decide el servidor (decisión 3 de Lucas): las respondidas, de todos, con nombre
 * de pila; las sin responder, solo su autor. Acá se muestra lo que viene en el detalle.
 */
export default {
  name: 'PreguntasVideo',
  props: {
    /** Video del catálogo. */
    video: { type: Object, required: true },
  },
  data() {
    return {
      /** Estado compartido de la página. */
      estado: estado,
      /** Texto para invitados. */
      LINEA_INVITADO: LINEA_INVITADO,
      /** Orden de la lista: 'utiles' | 'nuevos'. */
      orden: 'utiles',
      /** Texto de la pregunta nueva. */
      texto: '',
      /** true mientras se publica. */
      publicando: false,
    }
  },
  computed: {
    /**
     * true si la sesión es de soporte (solo lectura): no se publica ni se da me gusta.
     * @returns {boolean}
     */
    solo_lectura() {
      return es_solo_lectura()
    },
    /**
     * Texto del botón de me gusta según la sesión.
     * @returns {string}
     */
    titulo_me_gusta() {
      if (this.solo_lectura) {
        return 'Modo soporte: solo lectura, no se guarda'
      }
      return this.estado.usuario ? 'A mí también me sirve' : 'Entrá desde tu sistema para marcarla'
    },
    /**
     * Detalle del video (transcripción y preguntas), o uno vacío mientras no llegó.
     * @returns {Object}
     */
    detalle() {
      return this.estado.detalles[this.video.codigo] || { preguntas: [], cargando: true, error: false }
    },
    /**
     * Preguntas del video.
     * @returns {Array<Object>}
     */
    lista() {
      return Array.isArray(this.detalle.preguntas) ? this.detalle.preguntas : []
    },
    /**
     * Preguntas en el orden elegido (el del prototipo: más me gusta y, a igual cantidad, la más
     * nueva; o solo por fecha).
     * @returns {Array<Object>}
     */
    ordenadas() {
      /** Copia para no reordenar la lista del estado. */
      const lista = this.lista.slice()
      /**
       * Fecha en milisegundos (0 si no vino).
       * @param {Object} c
       * @returns {number}
       */
      const ms = function (c) {
        return a_milisegundos(c.fecha) || 0
      }
      if (this.orden === 'utiles') {
        lista.sort(function (a, b) {
          return (Number(b.me_gusta) || 0) - (Number(a.me_gusta) || 0) || ms(b) - ms(a)
        })
      } else {
        lista.sort(function (a, b) {
          return ms(b) - ms(a)
        })
      }
      return lista
    },
    /**
     * Nombre con el que se publica (el de pila: es el que ven los demás clientes).
     * @returns {string}
     */
    nombre_pila() {
      /** Usuario de la sesión. */
      const u = this.estado.usuario || {}
      return u.nombre_pila || u.nombre || ''
    },
  },
  methods: {
    cuando: cuando,
    inicial: inicial,
    /**
     * Texto de la respuesta (el contrato la manda como `{texto, fecha}`; se tolera un string).
     * @param {Object} c
     * @returns {string}
     */
    texto_respuesta(c) {
      if (!c.respuesta) {
        return ''
      }
      return typeof c.respuesta === 'string' ? c.respuesta : c.respuesta.texto || ''
    },
    /**
     * Fecha de la respuesta.
     * @param {Object} c
     * @returns {string|null}
     */
    fecha_respuesta(c) {
      return c.respuesta && typeof c.respuesta === 'object' ? c.respuesta.fecha : null
    },
    /**
     * Publica la pregunta escrita.
     * @returns {void}
     */
    publicar() {
      if (this.solo_lectura) {
        return
      }
      /** Texto sin espacios de más. */
      const t = this.texto.trim()
      if (!t) {
        if (this.$refs.caja) {
          this.$refs.caja.focus()
        }
        return
      }
      this.publicando = true
      publicar_pregunta(this.video.codigo, t)
        .then(() => {
          this.texto = ''
          this.orden = 'nuevos'
          mostrar_toast('Publicado. Cuando te respondamos lo vas a ver acá, y te avisamos al volver a entrar.')
        })
        .catch((error) => {
          if (es_error_solo_lectura(error)) {
            /* Modo soporte: el formulario no se muestra; si el servidor lo avisara, sin cartel. */
          } else if (error && error.status === 401) {
            mostrar_toast('Tu sesión se cerró: la pregunta no se publicó.')
          } else if (error && error.status === 422) {
            mostrar_toast('Revisá el texto: tiene que tener entre 1 y 2000 caracteres.')
          } else if (error && error.status === 429) {
            mostrar_toast('Mandaste muchas cosas seguidas. Esperá un minuto y probá de nuevo.')
          } else {
            mostrar_toast('No se pudo publicar. Probá de nuevo.')
          }
        })
        .then(() => {
          this.publicando = false
        })
    },
    /**
     * Alterna el me gusta de una pregunta (solo con sesión).
     * @param {Object} c
     * @returns {void}
     */
    me_gusta(c) {
      if (!this.estado.usuario || this.solo_lectura) {
        return
      }
      alternar_me_gusta(c)
    },
    /**
     * Vuelve a pedir el detalle del video.
     * @returns {void}
     */
    reintentar() {
      cargar_detalle(this.video.codigo)
    },
  },
}
</script>
