<template>
  <!-- `data-bloque-id="cta"` es lo que ScrollDolor observa para reportar que el lead llegó al
       final del recorrido (scroll_bloque_visible con bloque_id 'cta'), y lo que ExperienciaDemo
       traduce a `pagina_final_sin_turno`. Si se renombra, ese evento deja de salir sin que
       nada falle. -->
  <section class="demo-cta" data-bloque-id="cta">
    <h2 class="demo-cta__titulo" :style="estilo_entrada(0)">
      ¿Querés verlo funcionando con tu negocio?
    </h2>
    <p class="demo-cta__bajada" :style="estilo_entrada(1)">
      Te preparamos una demo con tu configuración en diez minutos. Sin usuario ni contraseña.
    </p>

    <!-- Sin URL no hay botón, y queda solo el texto: pasa contra una API que todavía no manda
         `cta` (ventana entre deploys) o cuando en Configuración de demos no hay un número
         válido. Un botón que abre WhatsApp hacia ninguna parte es peor que ningún botón. -->
    <div v-if="cta.whatsapp_url" class="demo-cta__accion" :style="estilo_entrada(2)">
      <!-- Es un <a> de verdad y no un <button> con window.open: el lead tiene que poder abrirlo
           con el teclado, con "abrir en pestaña nueva" y con el gesto largo del teléfono, y un
           bloqueador de ventanas emergentes no tiene nada que decir sobre un link. El click NO se
           frena: el evento sale en paralelo mientras el navegador abre WhatsApp. -->
      <a
        class="demo-cta__boton"
        :href="cta.whatsapp_url"
        target="_blank"
        rel="noopener noreferrer"
        @click="on_click"
      >
        <i class="bi bi-whatsapp demo-cta__icono" aria-hidden="true"></i>
        <span>{{ cta.texto_boton || 'Quiero probarlo' }}</span>
      </a>
      <p class="demo-cta__nota">Se abre WhatsApp, nos escribís y la dejamos lista.</p>
    </div>
  </section>
</template>

<script>
/* Tramo de entrada, en unidades de progreso [0,1] de la sección. Los mismos números que usa
   estilo_puente() en ScrollDolor.vue para las dos líneas del puente, porque este componente
   ocupa exactamente su lugar (el mismo <fondo-seccion-sticky variante="puente">) y tiene que
   entrar igual: el 0.42 es además el `snap_progreso` en que el avance guiado deposita al
   lead, así que todo tiene que haber terminado de entrar ahí. Se escriben acá y no se importan
   porque viven en el <script> de un SFC que solo exporta el componente; si se mueven allá, se
   mueven acá. */
const ENTRADA_FIN = 0.42
/* Tres escalones (título, bajada, botón) en vez de los dos del puente. El desfase es más corto
   que el 0.075 de allá para que el ÚLTIMO también llegue entero al aterrizaje: con 0.10 de
   desfase total, el botón está al 98,6% de su entrada en 0.42. */
const DESFASE = 0.05
const ENTRADA_Y = 40

/**
 * La curva de toda la página: 1 - (1-t)³. Misma que ScrollDolor.vue y que el motor de la
 * animación del procesador. Dos curvas distintas en la misma página se notan.
 *
 * @param {number} t
 * @returns {number}
 */
function ease_out(t) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * El CTA de la página como landing (misión experiencia-landing, 11/9/2026).
 *
 * Cuando el lead abre su página SIN una demo asignada (`turno.estado === 'sin_turno'`), el
 * recorrido no termina en el formulario -- que es parte de la DEMO, no de la landing
 * (contexto/demo_experiencia.md §3.16 A) -- sino acá: una invitación a pedirla, que lo devuelve
 * al WhatsApp donde ya está hablando con Martín. El CTA no agenda nada por su cuenta: la
 * decisión de Lucas es que el pedido vuelva a la conversación, con el texto prearmado que el
 * agente reconoce como aceptación.
 *
 * Vive DENTRO del mismo <fondo-seccion-sticky variante="puente"> que ocupa el puente cuando sí
 * hay turno: mismo fondo, mismo punto de enganche del avance guiado, misma coreografía de
 * entrada por progreso. Lo único que cambia es qué texto hay adentro.
 *
 * Poco texto a propósito (marca/identidad.md: restricción y aire). Cada frase se ganó su lugar:
 * la pregunta, qué va a pasar, y qué pasa al tocar.
 */
export default {
  name: 'CtaDemo',

  props: {
    /**
     * `{ whatsapp_url, texto_boton }` tal como llega en `payload.cta` del backend. La URL la arma
     * el backend (`wa.me/<numero>?text=<texto>`) con el número y el texto de Configuración de
     * demos; esta página no la construye ni la valida. Objeto vacío = API vieja o sin número:
     * se dibuja sin botón.
     */
    cta: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /**
     * Progreso [0,1] de la sección que lo contiene (el slot escopeado de FondoSeccionSticky).
     * Gobierna la entrada; es función pura de él, así que la reversa al subir sale gratis.
     */
    progreso: {
      type: Number,
      default: 0,
    },
    /**
     * Método centralizado de tracking, inyectado desde ExperienciaDemo vía ScrollDolor.
     * Firma: emitir_evento(nombre: string, payload: object) -> void.
     */
    emitir_evento: {
      type: Function,
      default: function () {},
    },
  },

  data() {
    return {
      /**
       * true si el sistema pide reduced-motion. Se resuelve acá y no en mounted() a propósito,
       * igual que en ScrollDolor: estilo_entrada() corre en el PRIMER render, y un flag que
       * llega después dejaría un frame con todo en opacity 0. Y hace falta porque bajo
       * reduced-motion FondoSeccionSticky no mueve el progreso (queda en 0): sin esta salida
       * el CTA sería invisible para siempre justo para quien pidió menos movimiento.
       */
      movimiento_reducido: !!(
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ),
    }
  },

  methods: {
    /**
     * Normaliza `p` al rango [0,1] dentro de [inicio, fin]. Misma función que ScrollDolor.
     *
     * @param {number} p
     * @param {number} inicio
     * @param {number} fin
     * @returns {number}
     */
    normalizar(p, inicio, fin) {
      if (p <= inicio) {
        return 0
      }
      if (p >= fin) {
        return 1
      }
      return (p - inicio) / (fin - inicio)
    },

    /**
     * Estilo de entrada del escalón `orden` (0 el título, 1 la bajada, 2 el botón) para el
     * progreso actual: sube 40px y se hace visible, como los renglones del puente.
     *
     * 🔴 Sin tramo de SALIDA, y esto es distinto del puente a propósito. El puente se desvanece
     * al final de su sección para pasarle la posta al formulario que viene abajo; acá abajo no
     * hay nada -- el CTA es el final de la página -- así que si se desvaneciera, el lead que
     * scrollea hasta el fondo se encontraría el botón al 35% de opacidad justo cuando lo va a
     * tocar. Entra y se queda.
     *
     * @param {number} orden
     * @returns {object}
     */
    estilo_entrada(orden) {
      if (this.movimiento_reducido) {
        return {}
      }

      const desfase = orden * DESFASE
      const entrada = ease_out(this.normalizar(this.progreso, desfase, ENTRADA_FIN + desfase))

      return {
        opacity: String(entrada),
        transform: 'translateY(' + (1 - entrada) * ENTRADA_Y + 'px)',
      }
    },

    /**
     * El lead tocó el botón. Se reporta y NADA MÁS: no se frena la navegación ni se espera la
     * respuesta del backend -- el <a> sigue abriendo WhatsApp por su cuenta y el evento viaja
     * en paralelo (ExperienciaDemo lo manda fire-and-forget).
     *
     * @returns {void}
     */
    on_click() {
      this.emitir_evento('cta_demo_tocado', {})
    },
  },
}
</script>

<style scoped>
/* Ocupa el pin entero y centra, igual que .demo-scroll-dolor__puente: el alto lo garantiza el
   pin de la sección (100vh) y el ancho legible lo da .demo-fondo-seccion__contenido > *
   (max-width 1080 + padding lateral), así que acá no se repite ninguno de los dos. min-height
   100% y no 100dvh por el mismo motivo que allá: un 100dvh mide MÁS que la caja del pin (que ya
   descontó su padding vertical) y el overflow:hidden lo recortaría. */
.demo-cta {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: var(--demo-color-texto);
  gap: clamp(14px, 2.4vh, 26px);
}

/* Mismo escalón que la línea protagonista del puente: más grande y con más peso que el resto,
   sin llegar al titular de la apertura. Es una pregunta, no un encabezado. */
.demo-cta__titulo {
  margin: 0;
  max-width: 720px;
  font-size: clamp(1.6rem, 3.4vw, 2.3rem);
  font-weight: 700;
  line-height: 1.2;
  /* Tracking negativo en texto display grande (§15 de apple-design/SKILL.md). */
  letter-spacing: -0.015em;
  will-change: opacity, transform;
}

/* El remate, en el tono suave. */
.demo-cta__bajada {
  margin: 0;
  max-width: 560px;
  font-size: clamp(1.1rem, 2.1vw, 1.4rem);
  font-weight: 400;
  line-height: 1.45;
  color: var(--demo-color-texto-suave);
  will-change: opacity, transform;
}

.demo-cta__accion {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  /* Un poco más de aire arriba del botón que entre título y bajada: separa lo que se lee de lo
     que se toca. */
  margin-top: clamp(6px, 1.6vh, 16px);
  will-change: opacity, transform;
}

/* El botón, con el degradé azul→violeta de marca -- el mismo que "Entrar a mi demo" en
   BotonAcceso.vue, para que el lead que después sí tenga turno reconozca el gesto. Es un <a>,
   así que hay que sacarle el subrayado y darle caja: inline-flex para que el ícono y el texto
   queden centrados entre sí. 52px de alto mínimo: arriba de los 44 que pide el dedo. */
.demo-cta__boton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
  min-width: 220px;
  padding: 14px 30px;
  border-radius: 14px;
  background: var(--demo-gradient-marca);
  color: #fff;
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.2;
  text-decoration: none;
  box-shadow: 0 10px 28px rgba(11, 132, 248, 0.22);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.demo-cta__boton:hover {
  color: #fff;
  text-decoration: none;
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(11, 132, 248, 0.3);
}

.demo-cta__boton:active {
  transform: translateY(0);
}

/* El anillo de foco visible sobre los DOS fondos (la página puede ser clara u oscura): un halo
   blanco fino separa el anillo azul del botón, que también es azul. */
.demo-cta__boton:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--demo-color-azul);
}

.demo-cta__icono {
  font-size: 1.25em;
  line-height: 1;
}

.demo-cta__nota {
  margin: 0;
  font-size: 0.92rem;
  color: var(--demo-color-texto-suave);
}

/* En teléfono el botón toma el ancho de la columna: es el único elemento tocable de la
   pantalla y el pulgar no tiene que apuntar. Mismo breakpoint que el resto de la página. */
@media (max-width: 767.98px) {
  .demo-cta__titulo {
    font-size: clamp(1.7rem, 7.6vw, 2.1rem);
  }

  .demo-cta__boton {
    width: 100%;
    max-width: 360px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .demo-cta__boton {
    transition: none;
  }

  .demo-cta__boton:hover {
    transform: none;
  }
}
</style>
