<template>
  <div class="ldf-wrap">
    <label class="form-label mb-0">{{ field_label }}</label>
    <small class="form-text text-muted d-block mt-1 mb-2">
      Son las respuestas con las que el demo setup arma la instancia del lead. Se pueden corregir
      acá aunque el lead todavía no haya contestado el formulario.
    </small>

    <!-- Sin bloque del backend (admin-api viejo, o un lead que llegó desde un endpoint que no
         appendea `demo_form_panel`): estado vacío discreto y nada más. Esta tarjeta convive con
         el resto del modal del lead y no puede romperlo por un campo que no vino. -->
    <p v-if="!panel" class="text-muted small mb-0">
      <i class="bi bi-dash-circle me-1" aria-hidden="true" />
      Todavía no hay datos del formulario para este lead.
    </p>

    <template v-else>
      <!-- Dinámica de demo "actual": ese lead no recorre la página de experiencia, así que no
           hay formulario que editar. Se dice, en vez de mostrar nueve preguntas que no aplican. -->
      <p v-if="!panel.editable" class="text-muted small mb-0">
        <i class="bi bi-info-circle me-1" aria-hidden="true" />
        Este lead usa la dinámica de demo actual, no la página de experiencia: no tiene formulario
        de configuración.
      </p>

      <template v-else>
        <!-- Aviso de origen: de dónde salieron las respuestas que se están mostrando. -->
        <div class="alert small py-2 px-3 mb-2" :class="clase_aviso_origen">
          <i class="bi me-1" :class="icono_aviso_origen" aria-hidden="true" />
          {{ texto_aviso_origen }}
          <div v-if="texto_completado_previo" class="mt-1 opacity-75">
            {{ texto_completado_previo }}
          </div>
        </div>

        <!-- El recorrido ya se congeló y el setup dejó de estar pendiente: editar acá no lo
             cambia, porque puede haber hitos ya marcados. -->
        <div v-if="mostrar_aviso_roadmap" class="alert alert-warning small py-2 px-3 mb-2">
          <i class="bi bi-map me-1" aria-hidden="true" />
          El recorrido de la demo ya está congelado con las respuestas anteriores. Cambiar el
          formulario acá no lo vuelve a armar.
        </div>

        <!-- El setup ya corrió bien: la instancia está armada con las respuestas viejas. -->
        <div v-if="mostrar_aviso_setup" class="alert alert-warning small py-2 px-3 mb-2">
          <i class="bi bi-arrow-repeat me-1" aria-hidden="true" />
          La instancia de demo ya está armada. Volvé a correr el demo setup para que use estas
          respuestas.
        </div>

        <!-- Las nueve preguntas, con el mismo texto que lee el lead en la página inmersiva
             (módulo compartido `components/demo/preguntas-formulario.js`). La grilla se acomoda
             sola: dos o tres columnas en escritorio, una sola en teléfono, sin que el texto largo
             de las preguntas desborde en ningún ancho. -->
        <div class="ldf-grilla">
          <div
            v-for="pregunta in preguntas"
            :key="pregunta.clave"
            class="ldf-pregunta"
          >
            <p class="ldf-pregunta__texto">{{ pregunta.pregunta }}</p>
            <p v-if="pregunta.descripcion" class="ldf-pregunta__descripcion">
              {{ pregunta.descripcion }}
            </p>
            <!-- Dos opciones, un solo control: mismo par de botones que ve el lead, con la
                 lengua del admin (Bootstrap) en vez del diseño de la página pública. -->
            <div
              class="btn-group w-100 ldf-pregunta__opciones"
              role="group"
              :aria-label="pregunta.pregunta"
            >
              <button
                v-for="opcion in pregunta.opciones"
                :key="String(opcion.valor)"
                type="button"
                class="btn"
                :class="local_respuestas[pregunta.clave] === opcion.valor ? 'btn-primary' : 'btn-outline-secondary'"
                :aria-pressed="local_respuestas[pregunta.clave] === opcion.valor ? 'true' : 'false'"
                :disabled="guardando"
                @click="seleccionar(pregunta.clave, opcion.valor)"
              >
                {{ opcion.texto }}
              </button>
            </div>
          </div>
        </div>

        <p v-if="error" class="text-danger small mb-2 mt-3">{{ error }}</p>

        <div class="d-flex flex-wrap align-items-center gap-2 mt-3">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="!puede_guardar"
            @click="on_guardar"
          >
            <span
              v-if="guardando"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
            {{ guardando ? 'Guardando...' : 'Guardar respuestas' }}
          </button>
          <button
            v-if="hay_cambios && !guardando"
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="on_descartar"
          >
            Descartar cambios
          </button>
          <span v-if="!hay_cambios && !guardando" class="text-muted small">
            No hay cambios sin guardar.
          </span>
        </div>
      </template>
    </template>
  </div>
</template>

<script>
import moment from 'moment'
import { PREGUNTAS, DEFAULTS } from '@/components/demo/preguntas-formulario'

/**
 * Claves del lead que hay que refrescar en el borrador del modal después de un guardado.
 *
 * 🔴 NO ES COSMÉTICO. El modal manda el borrador ENTERO en su propio "Guardar"
 * (`model/Index.vue::on_save()` hace `JSON.parse(JSON.stringify(this.draft))`), y el borrador se
 * armó con el lead tal como estaba cuando se abrió el modal. Sin este refresco, la tarjeta
 * seguiría pintándose con el `demo_form_panel` de antes de guardar —"todavía no completó el
 * formulario", el origen y las fechas viejas— arriba de respuestas que ya se persistieron.
 *
 * Y con las columnas es peor todavía, porque el borrador viejo no sólo se ve: se manda. Dos de
 * las nueve —`use_deposits` y `use_price_lists`— son además checkboxes editables del mismo grupo
 * Demo (`LeadProperties`), así que viajan en el "Guardar" del modal. Si el PUT de esta tarjeta
 * cambia `use_price_lists` en la base y el borrador se queda con el valor viejo, el siguiente
 * "Guardar" del modal lo pisa de vuelta y la corrección de Lucas se pierde sin que nada avise.
 *
 * (Ese par estuvo un rato fuera del meta el 27/8/2026, para que la tarjeta fuera la única puerta
 * a esas columnas; se revirtió el mismo día — la tarjeta sólo es editable para la dinámica nueva
 * y esas dos columnas alimentan también el setup del cliente real. El "Guardar" general marca
 * ahora `demo_form_editado_admin_at` por su cuenta, así que las dos puertas cuentan.)
 *
 * Se refresca esta lista y no el modelo entero a propósito: copiar todas las claves pisaría lo
 * que Lucas esté editando en otros campos del modal sin haber apretado Guardar todavía.
 *
 * Los nombres son los de las COLUMNAS, no los de las nueve respuestas: la traducción entre unas y
 * otras vive en `LeadDemoFormMapper` de admin-api y no se replica acá (tres de las nueve preguntas
 * reusan columnas viejas, y una de ellas está invertida).
 */
const CLAVES_A_REFRESCAR = [
  /* El bloque del panel: es lo que alimenta esta misma tarjeta (avisos, fechas y origen). */
  'demo_form_panel',
  /* Las columnas que escribe LeadDemoFormMapper::to_lead(). */
  'use_price_lists',
  'use_deposits',
  'omitir_cuentas_corrientes',
  'costos_en_dolares',
  'descuentos_por_metodo_pago',
  'usa_cuentas_corrientes_proveedores',
  'usa_presupuestos',
  'registra_compras',
  'usa_ecommerce',
  /* Las dos marcas de quién contestó y cuándo. */
  'demo_form_completado_at',
  'demo_form_editado_admin_at',
  /* El roadmap, que el endpoint puede volver a congelar si el setup sigue pendiente. */
  'demo_plan',
  'demo_plan_congelado_at',
]

/**
 * Tarjeta de respuestas del formulario de la demo, dentro del grupo Demo del modal del lead
 * (misión del 27/8/2026).
 *
 * Muestra las nueve respuestas con las que el demo setup va a armar la instancia del lead —las
 * que contestó él, las que corrigió Lucas, o los defaults del catálogo si todavía no contestó
 * nadie— y deja editarlas y guardarlas sin salir del modal.
 *
 * Se renderiza desde el meta declarativo (`LeadProperties.php`) vía `type: 'custom'` +
 * `custom_component: 'lead_demo_form_respuestas'`, con el mismo patrón que
 * `client_ecommerce_urls` y `lead_demo_ingreso_link`: recibe `:record="form"`, o sea el borrador
 * del modal.
 *
 * 🔴 Las preguntas NO se escriben acá: salen de `components/demo/preguntas-formulario.js`, el
 * mismo módulo que usa la página inmersiva que ve el lead. Es la única forma de garantizar que
 * Lucas esté corrigiendo la respuesta a la pregunta que el lead efectivamente leyó.
 *
 * El estado (quién contestó, cuándo, si el plan está congelado, si el setup ya corrió) llega
 * entero en `record.demo_form_panel`, que arma `LeadDemoFormMapper::estado_para_panel()` en
 * admin-api. Esta tarjeta no lo recalcula ni lo deduce de otras columnas: si el bloque no viene,
 * muestra un estado vacío discreto y no rompe el modal.
 *
 * Eventos:
 *   record-updated - Se emite con el lead completo que devuelve el PUT, por si el padre quiere
 *                    hacer algo más. El borrador del modal ya se refresca acá mismo, con las
 *                    claves de CLAVES_A_REFRESCAR (ver el docblock de esa constante: no hacerlo
 *                    haría que el "Guardar" del modal pisara lo recién guardado).
 */
export default {
  name: 'DemoFormRespuestas',

  props: {
    /** Borrador del formulario del lead (el `form` del ModelForm). */
    record: { type: Object, default: null },
    /** Etiqueta declarada en el meta, para no duplicar el texto acá. */
    field_label: { type: String, default: 'Respuestas del formulario de la demo' },
  },

  emits: ['record-updated'],

  data() {
    return {
      /**
       * Copia local editable de las nueve respuestas. Se arma desde `record.demo_form_panel`
       * y cae a DEFAULTS solo si alguna clave no llegara.
       */
      local_respuestas: {},
      /**
       * Las mismas nueve respuestas tal como las trajo el backend la última vez. Es contra esto
       * —y no contra el panel, que puede venir incompleto— que se decide si hay cambios sin
       * guardar: el botón Guardar tiene que quedar apagado cuando lo que se ve es exactamente
       * lo que ya está persistido.
       */
      baseline_respuestas: {},
      /** true mientras el PUT está en vuelo: apaga los controles y el botón. */
      guardando: false,
      /** Mensaje sobrio si el último guardado falló; vacío si no hay error. */
      error: '',
    }
  },

  computed: {
    /**
     * Bloque de estado del formulario que arma admin-api. `null` si no vino.
     *
     * @returns {Object|null}
     */
    panel() {
      if (!this.record || !this.record.demo_form_panel) {
        return null
      }
      return this.record.demo_form_panel
    },

    /**
     * Las nueve preguntas, en el orden fijo del catálogo.
     *
     * @returns {Array<Object>}
     */
    preguntas() {
      return PREGUNTAS
    },

    /**
     * true si lo que está en pantalla difiere de lo último que trajo el backend.
     *
     * @returns {boolean}
     */
    hay_cambios() {
      const self = this
      let distinto = false
      PREGUNTAS.forEach(function (pregunta) {
        if (self.local_respuestas[pregunta.clave] !== self.baseline_respuestas[pregunta.clave]) {
          distinto = true
        }
      })
      return distinto
    },

    /**
     * true si el botón Guardar tiene que estar habilitado: hay algo que guardar, no hay un
     * request en vuelo y el lead existe en la base (un alta sin id todavía no tiene endpoint).
     *
     * @returns {boolean}
     */
    puede_guardar() {
      return this.hay_cambios && !this.guardando && Boolean(this.record && this.record.id)
    },

    /**
     * Texto del aviso de origen: quién escribió las respuestas que se están mostrando.
     *
     * 🔴 Los cuatro casos dicen SIEMPRE si el lead completó el formulario o no, que es el
     * requisito de Lucas y lo único que se puede afirmar con certeza en los cuatro. Lo que el
     * aviso NO hace es decir quién escribió último cuando escribieron los dos: el backend
     * manda `origen: 'ambos'` justamente porque no se puede saber
     * (`demo_form_completado_at` marca el PRIMER envío del lead y no se mueve en los reenvíos,
     * así que comparar las dos fechas daba ganadores falsos — ver el docblock de
     * `LeadDemoFormMapper::origen()`). Se muestran las dos fechas y se deja leer.
     *
     * Un `origen` que este front no conozca cae en el texto de los defaults, que es el más
     * conservador: no le atribuye la respuesta a nadie.
     *
     * @returns {string}
     */
    texto_aviso_origen() {
      const p = this.panel
      if (!p) {
        return ''
      }
      if (p.origen === 'ambos') {
        const fecha_lead_ambos = this.formatear_fecha(p.completado_at)
        const fecha_admin_ambos = this.formatear_fecha(p.editado_admin_at)
        return 'El lead completó el formulario' +
          (fecha_lead_ambos ? ' el ' + fecha_lead_ambos : '') +
          ' y también se editaron respuestas desde el panel' +
          (fecha_admin_ambos ? ' el ' + fecha_admin_ambos : '') + '.'
      }
      if (p.origen === 'admin') {
        const fecha_admin = this.formatear_fecha(p.editado_admin_at)
        return (fecha_admin
          ? 'Modificado por vos el ' + fecha_admin + '.'
          : 'Modificado por vos.') + ' El lead todavía no completó el formulario.'
      }
      if (p.origen === 'lead') {
        const fecha_lead = this.formatear_fecha(p.completado_at)
        return fecha_lead
          ? 'Completado por el lead el ' + fecha_lead + '.'
          : 'Completado por el lead.'
      }
      return 'El lead todavía no completó el formulario. Se muestran los valores por defecto.'
    },

    /**
     * Segunda línea del aviso, sólo cuando escribieron las dos puntas. Dice explícitamente que
     * las dos fechas no alcanzan para saber cuál de las dos escrituras quedó última, para que
     * nadie lea la primera línea como un orden de prioridad. Lo que se ve arriba, en cambio, sí
     * es siempre lo que está guardado hoy.
     *
     * @returns {string}
     */
    texto_completado_previo() {
      const p = this.panel
      if (!p || p.origen !== 'ambos') {
        return ''
      }
      return 'Las respuestas de arriba son las que están guardadas hoy. La fecha del lead marca ' +
        'su primer envío, así que las dos fechas no dicen cuál de las dos ediciones quedó última.'
    },

    /**
     * Clase Bootstrap del aviso de origen.
     *
     * @returns {string}
     */
    clase_aviso_origen() {
      const p = this.panel
      if (p && (p.origen === 'admin' || p.origen === 'ambos')) {
        return 'alert-info'
      }
      if (p && p.origen === 'lead') {
        return 'alert-success'
      }
      return 'alert-secondary'
    },

    /**
     * Icono del aviso de origen.
     *
     * @returns {string}
     */
    icono_aviso_origen() {
      const p = this.panel
      if (p && p.origen === 'ambos') {
        return 'bi-people'
      }
      if (p && p.origen === 'admin') {
        return 'bi-pencil-square'
      }
      if (p && p.origen === 'lead') {
        return 'bi-check-circle'
      }
      return 'bi-info-circle'
    },

    /**
     * true si hay que avisar que el recorrido ya quedó congelado con otras respuestas. Solo
     * aplica cuando el setup dejó de estar pendiente: mientras está pendiente, el backend
     * vuelve a congelar el plan en el mismo guardado y no hay nada que avisar.
     *
     * @returns {boolean}
     */
    mostrar_aviso_roadmap() {
      const p = this.panel
      return Boolean(p && p.plan_congelado && p.setup_estado !== 'pendiente')
    },

    /**
     * true si hay que recordar que la instancia ya está armada y hay que volver a correr el
     * demo setup para que use las respuestas nuevas.
     *
     * @returns {boolean}
     */
    mostrar_aviso_setup() {
      const p = this.panel
      return Boolean(p && p.setup_estado === 'exitoso')
    },
  },

  watch: {
    /**
     * Si el bloque del backend cambia (guardado propio, o el modal recargando el lead), se
     * reconstruyen la copia local y la línea base contra la que se decide si hay cambios.
     */
    panel: {
      deep: true,
      immediate: true,
      handler: function () {
        this.sincronizar_desde_backend()
      },
    },
  },

  methods: {
    /**
     * Rearma `local_respuestas` y `baseline_respuestas` desde el bloque del backend. Sin panel,
     * o con un panel al que le falten claves, se cae a los defaults del catálogo — los mismos
     * que muestra la página inmersiva.
     *
     * No convierte tipos: el valor se toma tal cual llega (booleano nativo en las ocho preguntas
     * sí/no, string en `tipo_precios`), para que la comparación de la opción marcada
     * (`=== opcion.valor`) funcione sin normalizar nada.
     *
     * @returns {void}
     */
    sincronizar_desde_backend: function () {
      const p = this.panel
      const respuestas = (p && p.respuestas) || {}
      const local = {}
      const baseline = {}
      PREGUNTAS.forEach(function (pregunta) {
        const clave = pregunta.clave
        const tiene_valor = Object.prototype.hasOwnProperty.call(respuestas, clave)
        const valor = tiene_valor ? respuestas[clave] : DEFAULTS[clave]
        local[clave] = valor
        baseline[clave] = valor
      })
      this.local_respuestas = local
      this.baseline_respuestas = baseline
      this.error = ''
    },

    /**
     * Marca la opción elegida para una pregunta. El valor se guarda tal cual lo define la
     * opción, sin traducirlo a otro tipo.
     *
     * @param {string} clave Clave de la pregunta (ej. "usa_ecommerce").
     * @param {boolean|string} valor Valor de la opción elegida.
     * @returns {void}
     */
    seleccionar: function (clave, valor) {
      if (this.guardando) {
        return
      }
      this.local_respuestas[clave] = valor
    },

    /**
     * Vuelve a lo último que trajo el backend, descartando lo marcado sin guardar.
     *
     * @returns {void}
     */
    on_descartar: function () {
      if (this.guardando) {
        return
      }
      this.sincronizar_desde_backend()
    },

    /**
     * Guarda las nueve respuestas contra `PUT /lead/{id}/demo-form`. Al volver, refresca el
     * borrador del modal con el lead actualizado y avisa al padre.
     *
     * @returns {void}
     */
    on_guardar: function () {
      const self = this
      if (!this.puede_guardar) {
        return
      }
      this.guardando = true
      this.error = ''
      this.$store
        .dispatch('lead/update_demo_form', {
          lead_id: this.record.id,
          respuestas: Object.assign({}, this.local_respuestas),
        })
        .then(function (model) {
          self.aplicar_modelo_al_record(model)
          self.sincronizar_desde_backend()
          self.$emit('record-updated', model)
        })
        .catch(function () {
          self.error = 'No se pudieron guardar las respuestas. Probá de nuevo en un momento.'
        })
        .then(function () {
          self.guardando = false
        })
    },

    /**
     * Copia al borrador del modal las claves del lead que el guardado pudo haber cambiado.
     * Ver el docblock de CLAVES_A_REFRESCAR: no es cosmético, es lo que evita que el "Guardar"
     * del modal mande valores viejos encima de lo recién persistido.
     *
     * @param {Object} model Lead completo devuelto por el PUT.
     * @returns {void}
     */
    aplicar_modelo_al_record: function (model) {
      const self = this
      if (!model || !this.record) {
        return
      }
      CLAVES_A_REFRESCAR.forEach(function (clave) {
        if (Object.prototype.hasOwnProperty.call(model, clave)) {
          self.record[clave] = model[clave]
        }
      })
    },

    /**
     * Fecha del backend ('Y-m-d H:i:s') a texto legible, en la zona horaria del navegador.
     * Cadena vacía si no hay fecha o si no se puede interpretar: es preferible una frase sin
     * fecha que una con "Invalid date" adentro.
     *
     * @param {string|null} valor
     * @returns {string}
     */
    formatear_fecha: function (valor) {
      if (!valor) {
        return ''
      }
      const m = moment(valor)
      if (!m.isValid()) {
        return ''
      }
      return m.format('DD/MM/YYYY HH:mm')
    },
  },
}
</script>

<style scoped>
.ldf-wrap {
  /* La tarjeta ocupa el ancho completo de la fila del formulario (`full_width` en el meta): las
     preguntas son largas y en una col-lg-3 quedaban ilegibles. */
  width: 100%;
}

/* Grilla elástica: tantas columnas como entren con al menos 280px cada una. En escritorio
   (>=1366px) dan tres, en tablet dos y en teléfono una sola. El `min(100%, 280px)` es lo que
   evita el desborde horizontal en el modal más angosto: sin él, un contenedor de menos de 280px
   dejaría la columna más ancha que su caja. */
.ldf-grilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 0.75rem;
}

.ldf-pregunta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.5rem;
  background: var(--bs-body-bg);
}

.ldf-pregunta__texto {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.35;
  margin: 0;
}

.ldf-pregunta__descripcion {
  font-size: 0.78rem;
  line-height: 1.35;
  color: var(--bs-secondary-color, rgba(17, 27, 33, 0.6));
  margin: 0;
}

/* margin-top: auto empuja el par de botones al pie de la celda, para que queden alineados entre
   preguntas de distinto largo dentro de una misma fila de la grilla. */
.ldf-pregunta__opciones {
  margin-top: auto;
  padding-top: 0.15rem;
}

/* Las dos opciones siempre en mitades iguales, incluso con etiquetas de distinto largo
   ("Un precio" / "Varias listas"). */
.ldf-pregunta__opciones .btn {
  flex: 1 1 50%;
  min-width: 0;
  min-height: 38px;
  font-size: 0.85rem;
  white-space: normal;
}
</style>
