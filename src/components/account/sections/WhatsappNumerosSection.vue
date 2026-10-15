<template>
  <div class="whatsapp-numeros-section">
    <p class="text-muted small mb-3">
      El admin escucha dos números de WhatsApp y decide a dónde va cada mensaje por el
      <code>phone_number_id</code> con el que Kapso lo entrega. El de <strong>leads y clientes</strong> es el de
      siempre. El del <strong>agente personal</strong> es el que usan los dueños de los sistemas para hablarle a su
      asistente de IA. Los datos de cada número salen de <code>app.kapso.ai</code>, y se guardan por separado: cada
      tarjeta tiene su propio botón.
    </p>

    <p v-if="loading" class="text-muted small mb-0">Cargando…</p>

    <template v-else>
      <div v-if="error_carga" class="alert alert-danger py-2 small">
        {{ error_carga }}
      </div>

      <div v-if="api_sin_segundo_numero" class="alert alert-warning py-2 small">
        Este admin todavía corre la versión de la API que maneja <strong>un solo</strong> número: devolvió una
        configuración sola, sin distinguir propósitos. Lo que ves abajo es ese número, tratado como el de leads y
        clientes. La tarjeta del agente personal queda en modo lectura hasta que se despliegue la API nueva, porque
        si se guardara contra esta versión escribiría encima del número de leads y clientes.
      </div>

      <div
        v-for="tarjeta in tarjetas"
        :key="tarjeta.proposito"
        class="card mb-3"
      >
        <div class="card-body">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
            <h3 class="h6 card-title mb-0">{{ tarjeta.titulo }}</h3>
            <span class="badge" :class="estados[tarjeta.proposito].clase">
              {{ estados[tarjeta.proposito].etiqueta }}
            </span>
          </div>
          <p class="text-muted small mb-2">{{ tarjeta.descripcion }}</p>

          <p
            v-if="estados[tarjeta.proposito].detalle"
            class="small mb-3"
            :class="estados[tarjeta.proposito].tono === 'falta' ? 'text-warning-emphasis' : 'text-muted'"
          >
            {{ estados[tarjeta.proposito].detalle }}
          </p>

          <div v-if="!tarjeta.existe && !error_carga" class="alert alert-warning py-2 small">
            {{ tarjeta.aviso_sin_fila }}
          </div>

          <div class="row g-2">
            <template v-for="campo in campos_de_texto" :key="campo.key">
              <div v-if="campo.key === 'kapso_api_key' && ofrece_casilla_clave(tarjeta)" class="col-12">
                <div class="form-check">
                  <input
                    :id="'whatsapp_numero_' + tarjeta.proposito + '_usar_clave_del_principal'"
                    v-model="tarjeta.form.usar_clave_del_principal"
                    class="form-check-input"
                    type="checkbox"
                    :disabled="tarjeta.saving || !tarjeta.editable || !clave_guardada_del_principal()"
                    @change="on_input_change(tarjeta)"
                  />
                  <label
                    class="form-check-label small"
                    :for="'whatsapp_numero_' + tarjeta.proposito + '_usar_clave_del_principal'"
                  >
                    Usar la misma clave de Kapso que el número de leads y clientes
                  </label>
                </div>
                <p v-if="clave_guardada_del_principal()" class="form-text small text-muted mb-0">
                  Se copia la clave que el número de leads y clientes tiene guardada. Es una copia, no un vínculo:
                  si más adelante cambiás esa clave, volvé a guardar esta tarjeta para que la tome.
                </p>
                <p v-else class="form-text small text-warning mb-0">
                  El número de leads y clientes todavía no tiene una clave guardada, así que no hay cuál copiar.
                  Cargá la clave propia de este número.
                </p>
              </div>

              <div v-if="!oculta_campo(tarjeta, campo)" class="col-md-6">
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
                    :placeholder="texto_de_campo(tarjeta, campo, 'placeholder')"
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
                  :placeholder="texto_de_campo(tarjeta, campo, 'placeholder')"
                  :disabled="tarjeta.saving || !tarjeta.editable"
                  @input="on_input_change(tarjeta)"
                />

                <p v-if="texto_de_campo(tarjeta, campo, 'ayuda')" class="form-text small text-muted mb-0">
                  {{ texto_de_campo(tarjeta, campo, 'ayuda') }}
                </p>
                <p v-if="avisa_secreto_pendiente(tarjeta, campo)" class="form-text small text-warning mb-0">
                  Sin secreto, este número todavía no recibe nada: lo que entre por él se rechaza. Lo genera el
                  comando que da de alta el webhook en Kapso y lo guarda acá solo. Guardar la tarjeta así es
                  parte del alta, no un error.
                </p>
              </div>
            </template>
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

/** Propósito de la fila del número de leads y clientes (debe coincidir con admin-api). */
const PROPOSITO_PRINCIPAL = 'principal'

/** Propósito de la fila del número del agente personal de los dueños (debe coincidir con admin-api). */
const PROPOSITO_ASISTENTE = 'asistente'

/** Dígitos mínimos del número visible del asistente (la API devuelve 422 con menos). */
const MINIMO_DIGITOS_NUMERO_VISIBLE = 8

/**
 * Datos que hacen que un número esté «listo», por propósito.
 *
 * La regla de verdad vive en el servidor, que la manda en la clave `estado` del GET. Esto es solo el
 * respaldo para cuando la API no la trae (la versión vieja), y sirve además para saber cuándo una fila
 * existente está tan vacía que conviene decir «Sin cargar» y no «Falta…».
 */
const DATOS_PARA_ESTAR_LISTO = {
  [PROPOSITO_PRINCIPAL]: ['phone_number_id', 'kapso_api_key', 'webhook_secret'],
  [PROPOSITO_ASISTENTE]: ['phone_number_id', 'kapso_api_key', 'display_phone', 'webhook_secret'],
}

/**
 * Qué se avisa primero cuando falta más de un dato.
 *
 * Primero lo que se carga primero: el phone number ID, la clave, el número visible y, al final, el
 * secreto del webhook, que en el asistente no lo carga una persona sino el comando de alta.
 */
const PRIORIDAD_DE_FALTANTES = ['phone_number_id', 'kapso_api_key', 'display_phone', 'webhook_secret']

/** Lo que se agrega al detalle del asistente mientras no esté listo: nada cambió para nadie. */
const ASISTENTE_TODAVIA_NO_FUNCIONA =
  ' Mientras tanto el agente personal no funciona: todo sigue saliendo por el número de leads y clientes y ' +
  'los dueños siguen como hasta ahora.'

/**
 * Etiqueta y explicación de cada dato que puede faltar, por propósito.
 *
 * Los textos del asistente aclaran que todavía no funciona; los del principal dicen qué se pierde.
 */
const FALTANTES = {
  phone_number_id: {
    etiqueta: 'Falta el phone number ID',
    [PROPOSITO_PRINCIPAL]: 'Sin el phone number ID no se puede enrutar lo que entra por este número.',
    [PROPOSITO_ASISTENTE]:
      'Sin el phone number ID no se puede enrutar lo que entra por este número.' + ASISTENTE_TODAVIA_NO_FUNCIONA,
  },
  kapso_api_key: {
    etiqueta: 'Falta la clave',
    [PROPOSITO_PRINCIPAL]: 'Sin la API key de Kapso no puede salir ningún mensaje por este número.',
    [PROPOSITO_ASISTENTE]:
      'Sin la API key de Kapso no puede salir ningún mensaje por este número.' + ASISTENTE_TODAVIA_NO_FUNCIONA,
  },
  display_phone: {
    etiqueta: 'Falta el número visible',
    [PROPOSITO_PRINCIPAL]: 'Falta el número visible.',
    [PROPOSITO_ASISTENTE]:
      'Es el número que se le indica a un dueño que escribe por el número equivocado, así que tiene que estar ' +
      'cargado y tener al menos ' + MINIMO_DIGITOS_NUMERO_VISIBLE + ' dígitos.' + ASISTENTE_TODAVIA_NO_FUNCIONA,
  },
  webhook_secret: {
    etiqueta: 'Falta el secreto del webhook',
    [PROPOSITO_PRINCIPAL]: 'Sin el secreto no se puede validar la firma de lo que entra: el admin lo rechaza.',
    [PROPOSITO_ASISTENTE]:
      'El secreto lo genera el comando que da de alta el webhook en Kapso; hasta entonces, lo que entre por ' +
      'este número se rechaza.' + ASISTENTE_TODAVIA_NO_FUNCIONA,
  },
}

/**
 * Campos de texto de cada número, en el orden en que se muestran.
 *
 * `obligatorio_en` es una lista de propósitos y no un booleano porque la API no pide lo mismo en los dos
 * números. `phone_number_id` y `kapso_api_key` son `required` en los dos. `display_phone` solo en el
 * asistente: es el número que se le dice a un dueño que escribe por el número equivocado. `webhook_secret`
 * es `required` solo en la principal: 🔴 el secreto del asistente NO lo elige una persona — lo genera
 * `whatsapp:registrar-webhook` cuando da de alta el webhook en Kapso y lo guarda en la fila recién
 * después. Si acá lo pidiéramos obligatorio, para crear la fila del asistente habría que inventar un
 * secreto de descarte, y un secreto inventado que queda puesto **parece configurado** mientras el webhook
 * rechaza todo con 401 sin que nada lo explique. Por eso la asimetría, y por eso no se "empareja".
 *
 * `por_proposito` pisa el `placeholder` o la `ayuda` del campo en un propósito puntual.
 */
const CAMPOS_DE_TEXTO = [
  {
    key: 'display_phone',
    label: 'Número visible',
    placeholder: 'Ej.: +54 9 3444 54-4199',
    ayuda: 'Solo para que se lea en el panel y en los mensajes; no se usa para enrutar.',
    es_secreto: false,
    obligatorio_en: [PROPOSITO_ASISTENTE],
    por_proposito: {
      [PROPOSITO_ASISTENTE]: {
        placeholder: 'Ej.: +54 9 11 1234-5678',
        ayuda:
          'Obligatorio, con al menos ' + MINIMO_DIGITOS_NUMERO_VISIBLE + ' dígitos. Es el número que se le ' +
          'indica a un dueño que escribe por el número equivocado; no se usa para enrutar.',
      },
    },
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
 * Lleva la respuesta del GET a la forma `{ principal, asistente, forma_nueva, estado }`.
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
 * `estado` es la clave `estado` que trae la API nueva (`{ principal: {listo, faltan}, asistente: {...} }`,
 * solo nombres de campos, nunca valores) o `null` si no vino: con la API vieja, o con una respuesta de PUT
 * que contesta solo la fila escrita.
 *
 * @param {object|null|undefined} data Cuerpo de la respuesta del GET.
 * @returns {{principal: object|null, asistente: object|null, forma_nueva: boolean, estado: object|null}}
 */
function normalizar_respuesta(data) {
  if (!data || typeof data !== 'object') {
    // `null` del GET: la API vieja cuando todavía no hay ninguna config guardada.
    return { principal: null, asistente: null, forma_nueva: false, estado: null }
  }
  const forma_nueva =
    Object.prototype.hasOwnProperty.call(data, PROPOSITO_PRINCIPAL) ||
    Object.prototype.hasOwnProperty.call(data, PROPOSITO_ASISTENTE)
  if (forma_nueva) {
    return {
      principal: tiene_datos(data[PROPOSITO_PRINCIPAL]) ? data[PROPOSITO_PRINCIPAL] : null,
      asistente: tiene_datos(data[PROPOSITO_ASISTENTE]) ? data[PROPOSITO_ASISTENTE] : null,
      forma_nueva: true,
      estado: data.estado && typeof data.estado === 'object' ? data.estado : null,
    }
  }
  return {
    principal: tiene_datos(data) ? data : null,
    asistente: null,
    forma_nueva: false,
    estado: null,
  }
}

/**
 * Arma el formulario de una tarjeta a partir de la fila de la API.
 *
 * @param {object|null} fila Config de ese propósito, o null si no existe.
 * @param {boolean|undefined} usar_clave_del_principal Solo para la tarjeta del asistente: si usa la clave
 *   del número de leads y clientes. Con `undefined` el formulario no lleva esa casilla (la principal).
 * @returns {object} Valores del formulario, con strings vacíos en lugar de null.
 */
function form_desde_fila(fila, usar_clave_del_principal) {
  const form = { test_mode: !!(fila && fila.test_mode) }
  CAMPOS_DE_TEXTO.forEach(function (campo) {
    const valor = fila ? fila[campo.key] : ''
    form[campo.key] = valor === undefined || valor === null ? '' : String(valor)
  })
  if (usar_clave_del_principal !== undefined) {
    form.usar_clave_del_principal = !!usar_clave_del_principal
  }
  return form
}

/**
 * Decide si la casilla «usar la misma clave» arranca tildada.
 *
 * Tildada cuando no hay nada propio que perder: la fila no existe, o existe sin clave, o su clave es la
 * misma que la del número de leads y clientes. Destildada si la fila ya tiene una clave propia distinta, y
 * también si el número de leads y clientes no tiene clave guardada, porque no habría qué copiar.
 *
 * @param {object|null} fila Fila del asistente, o null si no existe.
 * @param {string} clave_del_principal Clave guardada del número de leads y clientes, o ''.
 * @returns {boolean}
 */
function usar_clave_por_defecto(fila, clave_del_principal) {
  if (clave_del_principal === '') {
    return false
  }
  if (!fila) {
    return true
  }
  const clave = fila.kapso_api_key
  const propia = clave === undefined || clave === null ? '' : String(clave).trim()
  return propia === '' || propia === clave_del_principal
}

/**
 * Cuenta los dígitos de un texto, ignorando espacios, signos y guiones.
 *
 * @param {string|null|undefined} texto Número tal como lo tipeó una persona.
 * @returns {number}
 */
function contar_digitos(texto) {
  return String(texto === undefined || texto === null ? '' : texto).replace(/\D/g, '').length
}

/**
 * Qué datos le faltan a una tarjeta según lo que hay guardado, con la regla local.
 *
 * Es el respaldo de la clave `estado` de la API y devuelve la misma forma: `{ listo, faltan }` con los
 * nombres de campo que faltan (o `['fila']` si la fila no existe). La regla de verdad es la del servidor;
 * esta solo se usa cuando la API no la manda.
 *
 * @param {object} tarjeta Tarjeta del propósito.
 * @returns {{listo: boolean, faltan: string[]}}
 */
function faltan_con_la_regla_local(tarjeta) {
  if (!tarjeta.existe) {
    return { listo: false, faltan: ['fila'] }
  }
  const guardado = tarjeta.stored
  const faltan = []
  DATOS_PARA_ESTAR_LISTO[tarjeta.proposito].forEach(function (nombre) {
    if (nombre === 'display_phone') {
      if (contar_digitos(guardado.display_phone) < MINIMO_DIGITOS_NUMERO_VISIBLE) {
        faltan.push(nombre)
      }
      return
    }
    if (String(guardado[nombre] || '').trim() === '') {
      faltan.push(nombre)
    }
  })
  return { listo: faltan.length === 0, faltan: faltan }
}

/**
 * Convierte «qué falta» en lo que se muestra en el encabezado de la tarjeta.
 *
 * @param {string} proposito 'principal' o 'asistente'.
 * @param {boolean} listo El número está listo.
 * @param {string[]} faltan Nombres de campo que faltan (o 'fila').
 * @param {boolean} modo_de_prueba El número está en modo de prueba.
 * @returns {{etiqueta: string, clase: string, tono: string, detalle: string}}
 */
function describir_estado(proposito, listo, faltan, modo_de_prueba) {
  const es_asistente = proposito === PROPOSITO_ASISTENTE
  if (listo) {
    let detalle = es_asistente
      ? 'Los dueños que le escriban al número de leads y clientes reciben un aviso con este número.'
      : ''
    if (modo_de_prueba) {
      detalle += (detalle === '' ? '' : ' ') + 'Ojo: está en modo de prueba, así que los mensajes no salen de verdad.'
    }
    return { etiqueta: 'Listo', clase: 'text-bg-success', tono: 'ok', detalle: detalle }
  }
  const que_faltan = Array.isArray(faltan) ? faltan : []
  const todo_falta =
    que_faltan.indexOf('fila') !== -1 ||
    DATOS_PARA_ESTAR_LISTO[proposito].every(function (nombre) {
      return que_faltan.indexOf(nombre) !== -1
    })
  if (todo_falta) {
    return { etiqueta: 'Sin cargar', clase: 'text-bg-secondary', tono: 'neutro', detalle: '' }
  }
  let primero = ''
  PRIORIDAD_DE_FALTANTES.forEach(function (nombre) {
    if (primero === '' && que_faltan.indexOf(nombre) !== -1) {
      primero = nombre
    }
  })
  if (primero === '') {
    // La API avisó que no está listo con un dato que esta pantalla no conoce: se dice sin inventar cuál.
    return {
      etiqueta: 'Incompleto',
      clase: 'text-bg-warning',
      tono: 'falta',
      detalle: es_asistente ? 'Falta algún dato.' + ASISTENTE_TODAVIA_NO_FUNCIONA : 'Falta algún dato.',
    }
  }
  return {
    etiqueta: FALTANTES[primero].etiqueta,
    clase: 'text-bg-warning',
    tono: 'falta',
    detalle: FALTANTES[primero][proposito],
  }
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
      /**
       * Clave `estado` del último GET (`{ principal: {listo, faltan}, asistente: {...} }`), o null si la API
       * no la trae. Con null la etiqueta de cada tarjeta se calcula con la regla local.
       */
      estado_servidor: null,
      /** GET inicial en curso. */
      loading: true,
      /** Error de la carga inicial. */
      error_carga: '',
      /** Estado de cada tarjeta. El orden del array es el orden en pantalla. */
      tarjetas: [
        {
          proposito: PROPOSITO_PRINCIPAL,
          titulo: 'Leads y clientes',
          titulo_corto: 'leads y clientes',
          descripcion:
            'Es el número de siempre de ComercioCity. Por acá salen y entran los mensajes de leads, clientes e ' +
            'implementaciones, y salen los avisos institucionales.',
          aviso_sin_fila:
            'No hay ninguna configuración guardada para el número de leads y clientes. Mientras esté vacía, el ' +
            'admin no puede ni recibir ni enviar WhatsApp: ni leads, ni clientes, ni avisos.',
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
          titulo: 'Agente personal de los dueños',
          titulo_corto: 'el agente personal',
          descripcion:
            'Por acá salen las respuestas del asistente, los informes de la mañana y el aviso de actualización a ' +
            'los dueños, y entran los mensajes de los dueños al asistente. Quien no es dueño recibe un texto ' +
            'corto que lo manda al otro número.',
          aviso_sin_fila:
            'Todavía no hay número cargado para el agente personal. Mientras esta tarjeta esté vacía no cambia ' +
            'nada para nadie: todo sigue saliendo y entrando por el número de leads y clientes. Cuando el número ' +
            'esté listo, el dueño que le escriba al número de leads y clientes va a recibir un aviso con el ' +
            'número del asistente. Para prenderlo, cargá acá el número visible, el phone number ID tal como ' +
            'figura en Kapso y la API key (o tildá usar la misma clave que el número de leads y clientes), y ' +
            'guardá. El secreto del webhook no se completa a mano: lo genera el comando que da de alta el ' +
            'webhook en Kapso, y recién con él el número queda listo.',
          form: form_desde_fila(null, false),
          stored: form_desde_fila(null, false),
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
  computed: {
    /**
     * Etiqueta, color y explicación del estado de cada número, por propósito.
     *
     * Se calcula sobre lo GUARDADO, no sobre lo que se está tipeando: el estado dice si el número funciona,
     * y un formulario a medio llenar no lo hace funcionar. Usa la clave `estado` del servidor cuando vino y,
     * solo si no (API vieja), la regla local: así «listo» tiene una sola definición.
     *
     * @returns {object} `{ principal: {...}, asistente: {...} }` con `etiqueta`, `clase`, `tono` y `detalle`.
     */
    estados() {
      const self = this
      const resultado = {}
      self.tarjetas.forEach(function (tarjeta) {
        if (self.error_carga) {
          // Sin respuesta no se sabe nada: decir «Sin cargar» sería afirmar algo que no se midió.
          resultado[tarjeta.proposito] = {
            etiqueta: 'No se pudo leer',
            clase: 'text-bg-secondary',
            tono: 'neutro',
            detalle: '',
          }
          return
        }
        const base = self.estado_del_servidor(tarjeta.proposito) || faltan_con_la_regla_local(tarjeta)
        resultado[tarjeta.proposito] = describir_estado(
          tarjeta.proposito,
          base.listo,
          base.faltan,
          !!tarjeta.stored.test_mode
        )
      })
      return resultado
    },
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
     * Placeholder o ayuda de un campo en esta tarjeta, con el override del propósito si lo hay.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @param {object} campo Metadato del campo.
     * @param {string} atributo 'placeholder' o 'ayuda'.
     * @returns {string}
     */
    texto_de_campo(tarjeta, campo, atributo) {
      const propio = campo.por_proposito && campo.por_proposito[tarjeta.proposito]
      if (propio && propio[atributo] !== undefined) {
        return propio[atributo]
      }
      return campo[atributo]
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
     * Estado de un número según el servidor (clave `estado` del GET), o null si no vino o vino mal formado.
     *
     * @param {string} proposito 'principal' o 'asistente'.
     * @returns {{listo: boolean, faltan: string[]}|null}
     */
    estado_del_servidor(proposito) {
      const estado = this.estado_servidor
      if (!estado || typeof estado !== 'object') {
        return null
      }
      const fila = estado[proposito]
      if (!fila || typeof fila !== 'object' || typeof fila.listo !== 'boolean') {
        return null
      }
      return { listo: fila.listo, faltan: Array.isArray(fila.faltan) ? fila.faltan : [] }
    },

    /**
     * Clave de Kapso que tiene GUARDADA el número de leads y clientes, o '' si no tiene.
     *
     * Es la que el servidor copia al asistente cuando la casilla «usar la misma clave» va tildada, así que
     * se mira lo guardado y no lo que se esté tipeando en la tarjeta del principal.
     *
     * @returns {string}
     */
    clave_guardada_del_principal() {
      const principal = this.tarjeta_de(PROPOSITO_PRINCIPAL)
      return principal ? String(principal.stored.kapso_api_key || '').trim() : ''
    },

    /**
     * Indica si se ofrece la casilla «usar la misma clave» en esta tarjeta.
     *
     * Solo en la del asistente y solo contra la API nueva: la vieja ignora `usar_clave_del_principal` y
     * exigiría la clave, así que ahí la casilla prometería algo que el servidor no cumple (y la tarjeta
     * está en lectura de todos modos). Tampoco se ofrece si la carga falló.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @returns {boolean}
     */
    ofrece_casilla_clave(tarjeta) {
      return tarjeta.proposito === PROPOSITO_ASISTENTE && !this.api_sin_segundo_numero && !this.error_carga
    },

    /**
     * Indica si esta tarjeta usa la clave del número de leads y clientes (casilla ofrecida y tildada).
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @returns {boolean}
     */
    usa_clave_del_principal(tarjeta) {
      return this.ofrece_casilla_clave(tarjeta) && !!tarjeta.form.usar_clave_del_principal
    },

    /**
     * Indica si un campo se esconde: la clave propia, mientras se usa la del número de leads y clientes.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @param {object} campo Metadato del campo.
     * @returns {boolean}
     */
    oculta_campo(tarjeta, campo) {
      return campo.key === 'kapso_api_key' && this.usa_clave_del_principal(tarjeta)
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
          self.estado_servidor = normalizada.estado
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
     * Vuelve a pedir solo la clave `estado` al servidor, sin tocar los formularios.
     *
     * Hace falta cuando un PUT contesta únicamente la fila que escribió: el estado que se mostraba ya no
     * vale y recalcularlo acá sería tener la regla de «listo» en dos lugares. No recarga las tarjetas
     * porque eso borraría lo que se esté tipeando en la otra. Si falla, se vuelve a la regla local.
     *
     * @returns {void}
     */
    refrescar_estado() {
      const self = this
      api
        .get('/whatsapp-config')
        .then(function (res) {
          self.estado_servidor = normalizar_respuesta(res.data).estado
        })
        .catch(function () {
          self.estado_servidor = null
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
      const usar_clave =
        proposito === PROPOSITO_ASISTENTE
          ? usar_clave_por_defecto(fila, this.clave_guardada_del_principal())
          : undefined
      const form = form_desde_fila(fila, usar_clave)
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
     * La casilla «usar la misma clave» viaja dentro del formulario, así que tildarla o destildarla cuenta
     * como un cambio.
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
     * La API key no se pide mientras la tarjeta use la clave del número de leads y clientes: la copia el
     * servidor.
     *
     * @param {object} tarjeta Tarjeta del propósito.
     * @returns {string} Etiqueta del campo faltante.
     */
    primer_obligatorio_vacio(tarjeta) {
      const self = this
      let faltante = ''
      CAMPOS_DE_TEXTO.forEach(function (campo) {
        if (faltante !== '' || campo.obligatorio_en.indexOf(tarjeta.proposito) === -1) {
          return
        }
        if (self.oculta_campo(tarjeta, campo)) {
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
      if (
        tarjeta.proposito === PROPOSITO_ASISTENTE &&
        contar_digitos(tarjeta.form.display_phone) < MINIMO_DIGITOS_NUMERO_VISIBLE
      ) {
        tarjeta.error_message =
          'El «Número visible» tiene que tener al menos ' + MINIMO_DIGITOS_NUMERO_VISIBLE + ' dígitos: es el ' +
          'número que se le indica a un dueño que escribe por el número equivocado.'
        return
      }
      tarjeta.saving = true
      tarjeta.saved_message = ''
      tarjeta.error_message = ''
      const usa_clave_del_principal = self.usa_clave_del_principal(tarjeta)
      // Las credenciales viajan siempre, aunque no se hayan tocado: la API las valida como `required` y un
      // PUT sin ellas da 422. Por eso el formulario arranca con lo que devolvió el GET. La única que se
      // omite es la API key cuando se usa la del número de leads y clientes: ahí viaja
      // `usar_clave_del_principal` y el servidor la copia.
      const payload = { proposito: tarjeta.proposito, test_mode: !!tarjeta.form.test_mode }
      CAMPOS_DE_TEXTO.forEach(function (campo) {
        if (campo.key === 'kapso_api_key' && usa_clave_del_principal) {
          return
        }
        payload[campo.key] = String(tarjeta.form[campo.key] || '').trim()
      })
      if (usa_clave_del_principal) {
        payload.usar_clave_del_principal = true
      }
      // El secreto del asistente lo escribe el comando de alta del webhook, no esta pantalla. Si el
      // formulario lo tiene vacío es porque se cargó antes de que el comando corriera: mandarlo vacío lo
      // pisaría. Omitido, el servidor deja el que ya tiene.
      if (tarjeta.proposito === PROPOSITO_ASISTENTE && payload.webhook_secret === '') {
        delete payload.webhook_secret
      }
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
            // Respuesta sin cuerpo útil: se queda con lo tipeado como nuevo punto de comparación. Si se
            // usó la clave del principal, esa es la que el servidor dejó en la fila.
            if (usa_clave_del_principal) {
              tarjeta.form.kapso_api_key = self.clave_guardada_del_principal()
            }
            tarjeta.stored = JSON.parse(JSON.stringify(tarjeta.form))
            tarjeta.existe = true
          }
          // El estado también viene del servidor: si este PUT no lo trajo, se vuelve a pedir (solo si la
          // API lo manda; con la vieja no hay nada que pedir y se sigue con la regla local).
          if (normalizada.estado) {
            self.estado_servidor = normalizada.estado
          } else if (self.estado_servidor !== null) {
            self.refrescar_estado()
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
