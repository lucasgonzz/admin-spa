<template>
  <!-- Formulario de configuración de la demo: diseño propio, inmersivo, NO usa
       componentes de formulario del admin (son de interfaz interna y rompen el
       clima de esta página pública). Controles grandes, pensados para el pulgar
       (contexto/demo_experiencia.md §3.16 B: la mayoría entra desde el teléfono). -->
  <section class="demo-formulario">
    <!-- Encabezado, texto de demo_pagina.md §3: se transcribe, no se reescribe -->
    <header class="demo-formulario__encabezado">
      <h2 class="demo-formulario__titulo">Contanos cómo trabajás</h2>
      <p class="demo-formulario__subtitulo">
        Ya marcamos lo más habitual. Cambiá solo lo que no coincida con tu negocio.
      </p>
    </header>

    <!-- Una pregunta por bloque: texto + opciones grandes. Todo llega
         preseleccionado (local_respuestas se arma desde el prop `respuestas`) -->
    <div
      v-for="pregunta in preguntas"
      :key="pregunta.clave"
      class="demo-formulario__pregunta"
    >
      <p class="demo-formulario__pregunta-texto">{{ pregunta.pregunta }}</p>
      <p v-if="pregunta.descripcion" class="demo-formulario__pregunta-descripcion">
        {{ pregunta.descripcion }}
      </p>
      <div class="demo-formulario__opciones">
        <button
          v-for="opcion in pregunta.opciones"
          :key="String(opcion.valor)"
          type="button"
          class="demo-formulario__opcion"
          :class="{ 'demo-formulario__opcion--activa': local_respuestas[pregunta.clave] === opcion.valor }"
          :disabled="enviando"
          @click="seleccionar(pregunta.clave, opcion.valor)"
        >
          {{ opcion.texto }}
        </button>
      </div>
    </div>

    <!-- Mensaje sobrio si el envío falla: el lead puede reintentar sin perder lo marcado -->
    <p v-if="error" class="demo-formulario__error">{{ error }}</p>

    <!-- El botón de confirmar es el final de la primera página (grupo 336, prompt 03):
         nada debajo. El mensaje de cierre ("Listo, armamos tu demo...") se retiró --
         quedó obsoleto cuando se creó la pantalla de confirmación (grupo 322, prompt 03):
         decía lo mismo que dice esa pantalla siguiente, y anticipaba un resultado antes
         de que el lead hubiera confirmado nada. -->
    <button
      type="button"
      class="demo-formulario__enviar"
      :disabled="enviando"
      @click="enviar()"
    >
      {{ enviando ? 'Guardando…' : 'Confirmar' }}
    </button>
  </section>
</template>

<script>
/**
 * Las dos opciones de cada pregunta sí/no del formulario, con booleanos JS
 * NATIVOS como valor -- nunca strings 'si'/'no'.
 *
 * Contrato con el backend (contexto/demo_experiencia.md, prompt 05 §1-bis,
 * ya verificado contra el código mergeado de admin-api): las ocho preguntas
 * sí/no se validan con `sometimes|boolean` de Laravel, que acepta
 * true/false/1/0/"1"/"0" y NADA MÁS. Un intento anterior de este prompt usó
 * strings 'si'/'no' acá y el POST moría siempre con 422 -- y además las ocho
 * preguntas quedaban sin preseleccionar, porque `false === 'no'` da `false`.
 * Se comparte la misma referencia entre las ocho preguntas booleanas.
 */
const OPCIONES_SI_NO = [
  { texto: 'Sí', valor: true },
  { texto: 'No', valor: false },
]

/**
 * Única pregunta no booleana del formulario: `tipo_precios` sigue siendo
 * string ('unico' | 'listas'), tal como lo valida el backend
 * (`sometimes|string|in:unico,listas`) y lo devuelve LeadDemoFormMapper.
 */
const OPCIONES_TIPO_PRECIOS = [
  { texto: 'Un precio', valor: 'unico' },
  { texto: 'Varias listas', valor: 'listas' },
]

/**
 * Las nueve preguntas del formulario, en el mismo orden y con el mismo texto
 * que contexto/demo_pagina.md §3 (repo claude-comerciocity) -- se transcribe,
 * no se reescribe. Cada `clave` coincide exactamente con la clave que usa el
 * payload del GET/POST del backend (`LeadDemoFormMapper`).
 *
 * `descripcion` (grupo 322, prompt 02): texto secundario opcional, debajo de
 * la pregunta -- `null` en las seis que no lo llevan. Es solo texto visible,
 * no viaja en el POST ni tiene nada que ver con `clave`/`opciones`/`default`.
 */
const PREGUNTAS = [
  {
    clave: 'tipo_precios',
    pregunta: '¿Tenés un precio por producto, o distintas listas según el cliente?',
    descripcion: null,
    opciones: OPCIONES_TIPO_PRECIOS,
  },
  {
    clave: 'costos_en_dolares',
    pregunta: '¿Manejás costos en dólares?',
    descripcion: 'Es para saber si el sistema tiene que cotizar tus costos en dólares con una cotización global o con una cotización propia de cada proveedor.',
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'descuentos_por_metodo_pago',
    pregunta: '¿Aplicás descuentos o recargos según el método de pago?',
    descripcion: null,
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'usa_cuentas_corrientes_clientes',
    pregunta: '¿Tenés clientes que se llevan la mercadería y te pagan después?',
    descripcion: 'Es para saber si vas a necesitar mover pagos y comprobantes entre las cuentas corrientes de tus clientes.',
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'usa_cuentas_corrientes_proveedores',
    pregunta: '¿Le comprás a proveedores y les pagás después?',
    descripcion: 'Es para saber si vas a necesitar mover pagos y comprobantes entre las cuentas corrientes de tus proveedores.',
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'usa_presupuestos',
    pregunta: '¿Pasás presupuestos antes de cerrar una venta?',
    descripcion: null,
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'registra_compras',
    pregunta: '¿Querés llevar el registro de lo que le comprás a tus proveedores?',
    descripcion: null,
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'usa_ecommerce',
    pregunta: '¿Vendés por internet, o te gustaría?',
    descripcion: null,
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'usa_depositos',
    pregunta: '¿Tenés más de un depósito o sucursal?',
    descripcion: null,
    opciones: OPCIONES_SI_NO,
  },
]

/**
 * Defaults locales de cada pregunta -- SOLO como respaldo si `respuestas`
 * llegara sin alguna clave (no debería pasar: el GET siempre trae las nueve,
 * con los defaults del catálogo ya aplicados por
 * `LeadDemoFormMapper::from_lead()`). Booleanos JS nativos para las ocho
 * preguntas sí/no (mismos valores de la tabla de demo_pagina.md §3);
 * `tipo_precios` sigue siendo string.
 */
const DEFAULTS = {
  tipo_precios: 'unico',
  costos_en_dolares: false,
  descuentos_por_metodo_pago: true,
  usa_cuentas_corrientes_clientes: true,
  usa_cuentas_corrientes_proveedores: true,
  usa_presupuestos: false,
  registra_compras: true,
  usa_ecommerce: true,
  usa_depositos: false,
}

/**
 * Formulario de configuración de la demo (Grupo 300 · pagina-inmersiva-demo,
 * prompt 05). Nueve preguntas, todas preseleccionadas con lo que trae el
 * payload del GET -- el lead confirma, no completa
 * (contexto/demo_catalogo.md §2, marca/identidad.md).
 *
 * El envío real (POST /demo-experiencia/{uuid}/formulario) NO lo hace este
 * componente: lo hace el contenedor (ExperienciaDemo.vue) a través de la
 * función `enviar_formulario` inyectada por prop -- mismo patrón que
 * `emitir_evento` en ScrollDolor.vue -- para mantener centralizado en el
 * contenedor todo el conocimiento del uuid y del cliente HTTP público. Este
 * componente solo arma el body y maneja su propio estado de UI (enviando,
 * error).
 */
export default {
  name: 'FormularioConfiguracion',

  props: {
    /**
     * Respuestas actuales del lead, tal como llegan en `formulario` del
     * payload (las nueve claves + `completado`). Todo viene preseleccionado.
     * Si el lead ya había completado el formulario antes, igual se muestra
     * con sus respuestas cargadas y puede cambiarlas (no se esconde ni se
     * bloquea).
     */
    respuestas: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /**
     * Función inyectada por el contenedor que hace el POST real y actualiza
     * el estado global de la página. Firma:
     * enviar_formulario(respuestas: object) -> Promise. Se resuelve con el
     * payload refrescado; se rechaza si el request falla (red o 4xx/5xx).
     */
    enviar_formulario: {
      type: Function,
      default: function () {
        return Promise.resolve({})
      },
    },
  },

  data() {
    return {
      /**
       * Copia local editable de las nueve respuestas (booleanos JS nativos
       * para las ocho preguntas sí/no, string para tipo_precios). Se
       * reconstruye desde el prop `respuestas` al montar y cada vez que ese
       * prop cambia (ej. después de un envío exitoso, que refresca el
       * payload completo en el contenedor).
       */
      local_respuestas: this.construir_respuestas_iniciales(),
      /** true mientras el POST está en vuelo: deshabilita todos los controles. */
      enviando: false,
      /** Mensaje sobrio de error si el último envío falló; vacío si no hay error. */
      error: '',
    }
  },

  computed: {
    /**
     * Lista de preguntas a renderizar, en el orden fijo de demo_pagina.md §3.
     *
     * @returns {Array<object>}
     */
    preguntas() {
      return PREGUNTAS
    },
  },

  watch: {
    /**
     * Si el contenedor refresca `respuestas` (tras un envío exitoso, o si el
     * lead reabre la página con el formulario ya completado), se reconstruye
     * la copia local para reflejar el estado real del servidor.
     */
    respuestas: {
      deep: true,
      handler: function () {
        this.local_respuestas = this.construir_respuestas_iniciales()
      },
    },
  },

  methods: {
    /**
     * Arma la copia local de las nueve respuestas a partir del prop
     * `respuestas`, cayendo a DEFAULTS solo si alguna clave no llegara. No
     * hace NINGUNA conversión de tipo: el valor se toma tal cual llega
     * (booleano o string), para que la comparación de preselección
     * (`=== opcion.valor`) funcione sin normalizar nada -- si hiciera falta
     * normalizar para que preseleccione, el tipo de dato estaría mal
     * elegido (ver 1-bis del prompt).
     *
     * @returns {object} Las nueve respuestas.
     */
    construir_respuestas_iniciales: function () {
      const self = this
      const base = {}
      PREGUNTAS.forEach(function (pregunta) {
        const clave = pregunta.clave
        const tiene_valor = self.respuestas && Object.prototype.hasOwnProperty.call(self.respuestas, clave)
        base[clave] = tiene_valor ? self.respuestas[clave] : DEFAULTS[clave]
      })
      return base
    },

    /**
     * Marca la opción elegida para una pregunta. `valor` llega tal cual la
     * opción lo define (booleano nativo para las ocho sí/no, string para
     * tipo_precios) -- nunca se traduce a otro tipo acá ni en ningún otro
     * punto del componente.
     *
     * @param {string} clave Clave de la pregunta (ej. "usa_ecommerce").
     * @param {boolean|string} valor Valor de la opción elegida.
     * @returns {void}
     */
    seleccionar: function (clave, valor) {
      if (this.enviando) {
        return
      }
      this.local_respuestas[clave] = valor
    },

    /**
     * Envía las nueve respuestas actuales al contenedor (que hace el POST
     * real). Deshabilita los controles mientras está en vuelo; si falla,
     * muestra un mensaje sobrio y deja las respuestas tal como estaban para
     * que el lead pueda reintentar sin perder lo que marcó.
     *
     * @returns {void}
     */
    enviar: function () {
      const self = this

      self.enviando = true
      self.error = ''

      self
        .enviar_formulario(self.local_respuestas)
        .catch(function () {
          self.error = 'No pudimos guardar tus respuestas. Probá de nuevo en un momento.'
        })
        .then(function () {
          self.enviando = false
        })
    },
  },
}
</script>

<style scoped>
.demo-formulario {
  max-width: 640px;
  margin: 0 auto;
  /* padding-top generoso (grupo 348, prompt 05): el encabezado del formulario no
     tiene que entrar en cuadro junto con el final del puente, que ahora ocupa su
     propia pantalla (ver .demo-scroll-dolor__puente). max() y no un 12vh a secas:
     en una pantalla baja -- un portátil de 768px de alto, o un teléfono apaisado --
     el 12vh se achica justo donde más falta hace, así que el mínimo en píxeles es
     el que manda ahí. */
  padding: max(12vh, 96px) 20px 48px;
  display: flex;
  flex-direction: column;
  /* Más aire ENTRE preguntas (grupo 322, prompt 02) -- el gap de 12px interno de
     .demo-formulario__pregunta (texto+descripción+opciones) no se toca. */
  gap: 44px;
}

.demo-formulario__encabezado {
  text-align: center;
}

.demo-formulario__titulo {
  font-size: clamp(1.6rem, 3.4vw, 2.2rem);
  font-weight: 700;
  margin: 0 0 8px;
}

.demo-formulario__subtitulo {
  color: var(--demo-color-texto-suave);
  font-size: 1.05rem;
  margin: 0;
}

.demo-formulario__pregunta {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.demo-formulario__pregunta-texto {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

/* Texto secundario opcional debajo de la pregunta (grupo 322, prompt 02): más
   chico y suave, no compite con la pregunta. */
.demo-formulario__pregunta-descripcion {
  font-size: 0.9rem;
  color: var(--demo-color-texto-suave);
  margin: -6px 0 0;
  line-height: 1.4;
}

/* Controles grandes, pensados para el pulgar: la mayoría entra desde el
   teléfono (contexto/demo_experiencia.md §3.16 B). */
.demo-formulario__opciones {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.demo-formulario__opcion {
  flex: 1 1 140px;
  min-height: 56px;
  padding: 12px 20px;
  border-radius: 14px;
  /* No elegida, visualmente apagada (grupo 322, prompt 02): antes solo se
     distinguía por el fondo (blanco vs degradé); ahora además baja de opacidad
     y el texto/borde pasan al tono suave, para que se lea como "no elegida" sin
     dejar de ser legible ni de leerse como clickeable. */
  border: 2px solid rgba(28, 35, 51, 0.08);
  background: #fff;
  color: var(--demo-color-texto-suave);
  opacity: 0.7;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.demo-formulario__opcion:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.demo-formulario__opcion--activa {
  border-color: transparent;
  background: var(--demo-gradient-marca);
  color: #fff;
  opacity: 1;
}

.demo-formulario__error {
  color: #b3261e;
  font-size: 0.95rem;
  text-align: center;
  margin: 0;
}

.demo-formulario__enviar {
  min-height: 56px;
  padding: 14px 24px;
  border-radius: 14px;
  border: none;
  background: var(--demo-gradient-marca);
  color: #fff;
  font-family: inherit;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
}

.demo-formulario__enviar:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

/* En teléfono el aire de arriba va a la mitad (grupo 348, prompt 05): el puente ya
   baja a 70vh ahí, y entre las dos cosas el lead no tiene que scrollear dos
   pantallas para llegar a la primera pregunta. 767.98px es el breakpoint que ya usa
   el resto de la página (ScrollDolor.vue y el scss compartido), no uno nuevo. */
@media (max-width: 767.98px) {
  .demo-formulario {
    padding-top: max(6vh, 48px);
  }
}

@media (max-width: 575.98px) {
  .demo-formulario__opciones {
    flex-direction: column;
  }

  .demo-formulario__opcion {
    flex: 1 1 auto;
  }
}
</style>
