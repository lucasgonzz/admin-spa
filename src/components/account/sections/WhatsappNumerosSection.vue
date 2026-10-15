<template>
  <div class="whatsapp-numeros-section">
    <p class="text-muted small mb-3">
      El admin escucha dos números de WhatsApp y decide a dónde va cada mensaje por el
      <code>phone_number_id</code> con el que Kapso lo entrega. El <strong>principal</strong> es el de siempre:
      ahí llegan los leads nuevos y los tickets de soporte de los clientes. El del <strong>asistente</strong> es el
      asistente personal de cada dueño que ya usa el sistema. Los datos de cada número salen de
      <code>app.kapso.ai</code>, y se guardan por separado: cada tarjeta tiene su propio botón.
    </p>

    <p v-if="loading" class="text-muted small mb-0">Cargando…</p>

    <template v-else>
      <div v-if="error_carga" class="alert alert-danger py-2 small">
        {{ error_carga }}
      </div>

      <div v-if="api_sin_segundo_numero" class="alert alert-warning py-2 small">
        Este admin todavía corre la versión de la API que maneja <strong>un solo</strong> número: devolvió una
        configuración sola, sin distinguir propósitos. Lo que ves abajo es ese número, tratado como el principal.
        La tarjeta del asistente queda en modo lectura hasta que se despliegue la API nueva, porque si se guardara
        contra esta versión escribiría encima del número principal.
      </div>

      <div
        v-for="tarjeta in tarjetas"
        :key="tarjeta.proposito"
        class="card mb-3"
      >
        <div class="card-body">
          <h3 class="h6 card-title mb-1">{{ tarjeta.titulo }}</h3>
          <p class="text-muted small mb-3">{{ tarjeta.descripcion }}</p>

          <div v-if="!tarjeta.existe" class="alert alert-warning py-2 small">
            {{ tarjeta.aviso_sin_fila }}
          </div>

          <div class="row g-2">
            <div
              v-for="campo in campos_de_texto"
              :key="campo.key"
              class="col-md-6"
            >
              <label class="form-label small fw-semibold mb-1" :for="id_de_campo(tarjeta, campo)">
                {{ campo.label }}
              </label>

              <div v-if="campo.es_secreto" class="input-group input-group-sm">
                <input
                  :id="id_de_campo(tarjeta, campo)"
                  v-model="tarjeta.form[campo.key]"
                  :type="tarjeta.secretos_visibles[campo.key] ? 'text' : 'password'"
                  class="form-control form-control-sm"
                  autocomplete="off"
                  :placeholder="campo.placeholder"
                  :disabled="tarjeta.saving || !tarjeta.editable"
                  @input="on_input_change(tarjeta)"
                />
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :title="tarjeta.secretos_visibles[campo.key] ? 'Ocultar' : 'Mostrar'"
                  @click="toggle_secreto_visible(tarjeta, campo.key)"
                >
                  <i
                    class="bi"
                    :class="tarjeta.secretos_visibles[campo.key] ? 'bi-eye-slash' : 'bi-eye'"
                    aria-hidden="true"
                  ></i>
                </button>
              </div>

              <input
                v-else
                :id="id_de_campo(tarjeta, campo)"
                v-model="tarjeta.form[campo.key]"
                type="text"
                class="form-control form-control-sm"
                autocomplete="off"
                :placeholder="campo.placeholder"
                :disabled="tarjeta.saving || !tarjeta.editable"
                @input="on_input_change(tarjeta)"
              />

              <p v-if="campo.ayuda" class="form-text small text-muted mb-0">{{ campo.ayuda }}</p>
              <p v-if="avisa_secreto_pendiente(tarjeta, campo)" class="form-text small text-warning mb-0">
                Sin secreto, este número todavía no recibe nada: lo que entre por él se rechaza. Lo genera el
                comando que da de alta el webhook en Kapso y lo guarda acá solo. Guardar la tarjeta así es
                parte del alta, no un error.
              </p>
            </div>
          </div>

          <div class="form-check mt-3">
            <input
              :id="'whatsapp_numero_' + tarjeta.proposito + '_test_mode'"
              v-model="tarjeta.form.test_mode"
              class="form-check-input"
              type="checkbox"
              :disabled="tarjeta.saving || !tarjeta.editable"
              @change="on_input_change(tarjeta)"
            />
            <label class="form-check-label small" :for="'whatsapp_numero_' + tarjeta.proposito + '_test_mode'">
              Modo de prueba
            </label>
            <p class="form-text small text-muted mb-0">
              Tildado, los mensajes de este número no salen de verdad: quedan registrados y nada más. Es para
              probar sin escribirle a nadie.
            </p>
          </div>

          <div class="mt-3">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="tarjeta.saving || !puede_guardar(tarjeta)"
              @click="on_save(tarjeta)"
            >
              {{ tarjeta.saving ? 'Guardando…' : 'Guardar ' + tarjeta.titulo_corto }}
            </button>

            <p v-if="tarjeta.saved_message" class="text-success small mt-2 mb-0">{{ tarjeta.saved_message }}</p>
            <p v-else-if="tarjeta.error_message" class="text-danger small mt-2 mb-0">{{ tarjeta.error_message }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'

/** Propósito de la fila del número de leads y soporte (debe coincidir con admin-api). */
const PROPOSITO_PRINCIPAL = 'principal'

/** Propósito de la fila del número del asistente personal (debe coincidir con admin-api). */
const PROPOSITO_ASISTENTE = 'asistente'

/**
 * Campos de texto de cada número, en el orden en que se muestran.
 *
 * `obligatorio_en` es una lista de propósitos y no un booleano porque la API no pide lo mismo en los dos
 * números. `phone_number_id` y `kapso_api_key` son `required` en los dos. `webhook_secret` es `required`
 * solo en la principal: 🔴 el secreto del asistente NO lo elige una persona — lo genera
 * `whatsapp:registrar-webhook` cuando da de alta el webhook en Kapso y lo guarda en la fila recién
 * después. Si acá lo pidiéramos obligatorio, para crear la fila del asistente habría que inventar un
 * secreto de descarte, y un secreto inventado que queda puesto **parece configurado** mientras el webhook
 * rechaza todo con 401 sin que nada lo explique. Por eso la asimetría, y por eso no se "empareja".
 */
const CAMPOS_DE_TEXTO = [
  {
    key: 'display_phone',
    label: 'Número visible',
    placeholder: 'Ej.: +54 9 3444 54-4199',
    ayuda: 'Solo para que se lea en el panel y en los mensajes; no se usa para enrutar.',
    es_secreto: false,
    obligatorio_en: [],
  },
  {
    key: 'nombre',
    label: 'Nombre',
    placeholder: 'Ej.: ComercioCity',
    ayuda: 'Cómo se llama este número acá adentro.',
    es_secreto: false,
    obligatorio_en: [],
  },
  {
    key: 'phone_number_id',
    label: 'Phone number ID (Kapso)',
    placeholder: '',
    ayuda: 'Es el dato con el que se enruta cada mensaje entrante. Se copia tal cual de Kapso.',
    es_secreto: false,
    obligatorio_en: [PROPOSITO_PRINCIPAL, PROPOSITO_ASISTENTE],
  },
  {
    key: 'waba_id',
    label: 'WABA ID',
    placeholder: '',
    ayuda: 'La cuenta de WhatsApp Business a la que pertenece el número.',
    es_secreto: false,
    obligatorio_en: [],
  },
  {
    key: 'kapso_api_key',
    label: 'API key de Kapso',
    placeholder: '',
    ayuda: 'Con esta credencial salen los mensajes de este número.',
    es_secreto: true,
    obligatorio_en: [PROPOSITO_PRINCIPAL, PROPOSITO_ASISTENTE],
  },
  {
    key: 'webhook_secret',
    label: 'Secreto del webhook',
    placeholder: '',
    ayuda: 'Con este secreto se valida la firma de lo que entra por este número.',
    es_secreto: true,
    obligatorio_en: [PROPOSITO_PRINCIPAL],
  },
]

/**
 * Indica si una respuesta de la API trae algo cargado, o es una fila que no existe.
 *
 * `show()` puede devolver `null` (nunca se configuró) y también un objeto vacío, así que no alcanza con
 * mirar que no sea nulo.
 *
 * @param {object|null|undefined} fila Config devuelta por la API.
 * @returns {boolean}
 */
function tiene_datos(fila) {
  if (!fila || typeof fila !== 'object') {
    return false
  }
  if (fila.id) {
    return true
  }
  let alguno = false
  CAMPOS_DE_TEXTO.forEach(function (campo) {
    if (fila[campo.key] !== undefined && fila[campo.key] !== null && String(fila[campo.key]) !== '') {
      alguno = true
    }
  })
  return alguno
}

/**
 * Lleva la respuesta del GET a la forma `{ principal, asistente, forma_nueva }`.
 *
 * 🔴 Esto NO es defensa decorativa: `admin-api` y `admin-spa` no llegan a producción al mismo tiempo, así
 * que esta pantalla se va a estrenar contra la API vieja, la que devuelve **una sola** config plana
 * (`kapso_api_key`, `phone_number_id`, `webhook_secret` y `test_mode` en la raíz, sin las claves
 * `principal` ni `asistente`) o directamente `null`. En ese caso la fila plana ES la principal y del
 * asistente no se sabe nada, así que su tarjeta se muestra vacía y en modo lectura.
 *
 * `forma_nueva` es lo que decide si la tarjeta del asistente se puede guardar, y por eso vuelve de acá: el
 * `update()` viejo ignora `proposito` y escribe SIEMPRE la principal. Guardar el asistente contra esa
 * versión no fallaría con un error — pisaría las credenciales del número de leads en silencio. Si alguien
 * quiere "simplificar" este archivo, este es el camino que no se puede borrar hasta que la API nueva esté
 * desplegada en producción.
 *
 * @param {object|null|undefined} data Cuerpo de la respuesta del GET.
 * @returns {{principal: object|null, asistente: object|null, forma_nueva: boolean}}
 */
function normalizar_respuesta(data) {
  if (!data || typeof data !== 'object') {
    // `null` del GET: la API vieja cuando todavía no hay ninguna config guardada.
    return { principal: null, asistente: null, forma_nueva: false }
  }
  const forma_nueva =
    Object.prototype.hasOwnProperty.call(data, PROPOSITO_PRINCIPAL) ||
    Object.prototype.hasOwnProperty.call(data, PROPOSITO_ASISTENTE)
  if (forma_nueva) {
    return {
      principal: tiene_datos(data[PROPOSITO_PRINCIPAL]) ? data[PROPOSITO_PRINCIPAL] : null,
      asistente: tiene_datos(data[PROPOSITO_ASISTENTE]) ? data[PROPOSITO_ASISTENTE] : null,
      forma_nueva: true,
    }
  }
  return {
    principal: tiene_datos(data) ? data : null,
    asistente: null,
    forma_nueva: false,
  }
}

/**
 * Arma el formulario de una tarjeta a partir de la fila de la API.
 *
 * @param {object|null} fila Config de ese propósito, o null si no existe.
 * @returns {object} Valores del formulario, con strings vacíos en lugar de null.
 */
function form_desde_fila(fila) {
  const form = { test_mode: !!(fila && fila.test_mode) }
  CAMPOS_DE_TEXTO.forEach(function (campo) {
    const valor = fila ? fila[campo.key] : ''
    form[campo.key] = valor === undefined || valor === null ? '' : String(valor)
  })
  return form
}

/**
 * Sección de cuenta: los dos números de WhatsApp que escucha el admin, uno por tarjeta.
 */
export default {
  name: 'WhatsappNumerosSection',
  data() {
    return {
      /** Metadatos de los campos de texto, para el v-for de la plantilla. */
      campos_de_texto: CAMPOS_DE_TEXTO,
      /**
       * La API contestó con la forma vieja (una sola config plana).
       *
       * Arranca en false para no mostrar el aviso antes de saberlo.
       */
      api_sin_segundo_numero: false,
      /** GET inicial en curso. */
      loading: true,
      /** Error de la carga inicial. */
      error_carga: '',
      /** Estado de cada tarjeta. El orden del array es el orden en pantalla. */
      tarjetas: [
        {
          proposito: PROPOSITO_PRINCIPAL,
          titulo: 'Número principal (leads y soporte)',
          titulo_corto: 'el principal',
          descripcion:
            'Es el número histórico de ComercioCity. Por acá entran los leads nuevos, los tickets de soporte de ' +
            'los clientes y las implementaciones. Los avisos institucionales (como el de sistema actualizado) ' +
            'también salen de acá.',
          aviso_sin_fila:
            'No hay ninguna configuración guardada para el número principal. Mientras esté vacía, el admin no ' +
            'puede ni recibir ni enviar WhatsApp: ni leads, ni soporte, ni avisos.',
          form: form_desde_fila(null),
          stored: form_desde_fila(null),
          /** La fila existe en la base. Si es false, guardar la crea. */
          existe: false,
          /** Se puede guardar contra esta versión de la API (ver `normalizar_respuesta`). */
          editable: true,
          /** Qué secretos están a la vista, por clave de campo. */
          secretos_visibles: {},
          saving: false,
          saved_message: '',
          error_message: '',
        },
        {
          proposito: PROPOSITO_ASISTENTE,
          titulo: 'Número del asistente',
          titulo_corto: 'el del asistente',
          descripcion:
            'Es el número del asistente personal de los dueños que ya usan el sistema. Solo atiende al dueño ' +
            'registrado: cualquier otro remitente recibe un texto fijo y no abre lead ni ticket.',
          aviso_sin_fila:
            'Todavía no hay número cargado para el asistente. Mientras esta tarjeta esté vacía el asistente no ' +
            'tiene número propio, y el dueño que le escriba al número principal va a abrir un ticket de soporte ' +
            'en lugar de hablar con su asistente. Para prenderlo, cargá acá el phone number ID del número del ' +
            'asistente tal como figura en Kapso y su API key, y guardá. El secreto del webhook no se completa ' +
            'a mano: lo genera el comando que da de alta el webhook en Kapso.',
          form: form_desde_fila(null),
          stored: form_desde_fila(null),
          existe: false,
          editable: true,
          secretos_visibles: {},
          saving: false,
          saved_message: '',
          error_message: '',
        },
      ],
    }
  },
  mounted() {
    this.load_configs()
  },
  methods: {
    /**
     * Id del input de un campo, único entre las dos tarjetas.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @param {object} campo Metadato del campo.
     * @returns {string}
     */
    id_de_campo(tarjeta, campo) {
      return 'whatsapp_numero_' + tarjeta.proposito + '_' + campo.key
    },

    /**
     * Indica si hay que avisar que este número se guarda sin secreto de webhook.
     *
     * Es el estado normal del alta del asistente, no un error: la fila se crea, el webhook de ese número
     * falla cerrado hasta que `whatsapp:registrar-webhook` escriba el secreto, y ese es el lado correcto
     * para fallar. Por eso se avisa en vez de bloquear el Guardar.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @param {object} campo Metadato del campo.
     * @returns {boolean}
     */
    avisa_secreto_pendiente(tarjeta, campo) {
      if (campo.key !== 'webhook_secret') {
        return false
      }
      if (campo.obligatorio_en.indexOf(tarjeta.proposito) !== -1) {
        return false
      }
      return String(tarjeta.form[campo.key] || '').trim() === ''
    },

    /**
     * Busca la tarjeta de un propósito.
     *
     * @param {string} proposito 'principal' o 'asistente'.
     * @returns {object|null}
     */
    tarjeta_de(proposito) {
      let encontrada = null
      this.tarjetas.forEach(function (tarjeta) {
        if (tarjeta.proposito === proposito) {
          encontrada = tarjeta
        }
      })
      return encontrada
    },

    /**
     * Carga las dos configuraciones.
     *
     * @returns {void}
     */
    load_configs() {
      const self = this
      self.loading = true
      self.error_carga = ''
      api
        .get('/whatsapp-config')
        .then(function (res) {
          const normalizada = normalizar_respuesta(res.data)
          self.api_sin_segundo_numero = !normalizada.forma_nueva
          self.aplicar_fila(PROPOSITO_PRINCIPAL, normalizada.principal, true)
          // Contra la API vieja la tarjeta del asistente queda en lectura: su `update()` ignora
          // `proposito` y escribiría la principal.
          self.aplicar_fila(PROPOSITO_ASISTENTE, normalizada.asistente, normalizada.forma_nueva)
        })
        .catch(function () {
          self.error_carga = 'No se pudo cargar la configuración de los números de WhatsApp.'
          // Sin respuesta no hay con qué comparar: guardar desde acá mandaría los defaults del data()
          // como si fueran lo guardado, y eso borra credenciales de producción.
          self.tarjetas.forEach(function (tarjeta) {
            tarjeta.editable = false
          })
        })
        .then(function () {
          self.loading = false
        })
    },

    /**
     * Vuelca una fila de la API en su tarjeta.
     *
     * @param {string} proposito 'principal' o 'asistente'.
     * @param {object|null} fila Config devuelta por la API, o null si no existe.
     * @param {boolean} editable Si esta tarjeta se puede guardar contra la API que contestó.
     * @returns {void}
     */
    aplicar_fila(proposito, fila, editable) {
      const tarjeta = this.tarjeta_de(proposito)
      if (!tarjeta) {
        return
      }
      const form = form_desde_fila(fila)
      tarjeta.form = JSON.parse(JSON.stringify(form))
      tarjeta.stored = JSON.parse(JSON.stringify(form))
      tarjeta.existe = !!fila
      tarjeta.editable = editable
      // Los secretos vuelven a quedar tapados cada vez que se recarga la fila.
      tarjeta.secretos_visibles = {}
    },

    /**
     * Muestra u oculta un secreto de una tarjeta.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @param {string} key Clave del campo secreto.
     * @returns {void}
     */
    toggle_secreto_visible(tarjeta, key) {
      const visibles = Object.assign({}, tarjeta.secretos_visibles)
      visibles[key] = !visibles[key]
      tarjeta.secretos_visibles = visibles
    },

    /**
     * Limpia los mensajes de estado de una tarjeta al editarla.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @returns {void}
     */
    on_input_change(tarjeta) {
      tarjeta.saved_message = ''
      tarjeta.error_message = ''
    },

    /**
     * Indica si una tarjeta tiene cambios guardables.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @returns {boolean}
     */
    puede_guardar(tarjeta) {
      if (!tarjeta.editable) {
        return false
      }
      return JSON.stringify(tarjeta.form) !== JSON.stringify(tarjeta.stored)
    },

    /**
     * Primer campo obligatorio que quedó vacío, o cadena vacía si están todos.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @returns {string} Etiqueta del campo faltante.
     */
    primer_obligatorio_vacio(tarjeta) {
      let faltante = ''
      CAMPOS_DE_TEXTO.forEach(function (campo) {
        if (faltante !== '' || campo.obligatorio_en.indexOf(tarjeta.proposito) === -1) {
          return
        }
        if (String(tarjeta.form[campo.key] || '').trim() === '') {
          faltante = campo.label
        }
      })
      return faltante
    },

    /**
     * PUT /whatsapp-config con el propósito de esa tarjeta.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @returns {void}
     */
    on_save(tarjeta) {
      const self = this
      if (!tarjeta.editable) {
        return
      }
      const faltante = self.primer_obligatorio_vacio(tarjeta)
      if (faltante !== '') {
        tarjeta.error_message = 'Falta completar «' + faltante + '»: la API lo pide obligatorio.'
        return
      }
      tarjeta.saving = true
      tarjeta.saved_message = ''
      tarjeta.error_message = ''
      // Las tres credenciales viajan siempre, aunque no se hayan tocado: la API las valida como
      // `required` y un PUT sin ellas da 422. Por eso el formulario arranca con lo que devolvió el GET.
      const payload = { proposito: tarjeta.proposito, test_mode: !!tarjeta.form.test_mode }
      CAMPOS_DE_TEXTO.forEach(function (campo) {
        payload[campo.key] = String(tarjeta.form[campo.key] || '').trim()
      })
      api
        .put('/whatsapp-config', payload)
        .then(function (res) {
          const normalizada = normalizar_respuesta(res.data)
          // La API nueva puede contestar con las dos configs o con la fila que acaba de escribir: en los
          // dos casos lo que interesa es la de este propósito.
          let fila = normalizada[tarjeta.proposito]
          if (!fila && !normalizada.forma_nueva) {
            fila = normalizada.principal
          }
          if (fila) {
            self.aplicar_fila(tarjeta.proposito, fila, tarjeta.editable)
          } else {
            // Respuesta sin cuerpo útil: se queda con lo tipeado como nuevo punto de comparación.
            tarjeta.stored = JSON.parse(JSON.stringify(tarjeta.form))
            tarjeta.existe = true
          }
          tarjeta.saved_message = 'Número guardado.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && (err.response.data.message || err.response.data.error)) ||
            'No se pudo guardar.'
          tarjeta.error_message = typeof msg === 'string' ? msg : 'No se pudo guardar.'
        })
        .then(function () {
          tarjeta.saving = false
        })
    },
  },
}
</script>
