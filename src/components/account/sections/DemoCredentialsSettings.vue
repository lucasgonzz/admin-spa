<template>
  <div class="demo-credentials-settings">
    <!-- Credenciales de prueba de Zipnova y de Mercado Pago para las demos (misión credenciales-demo-zipnova-mp) -->
    <h6 class="mt-3 mb-2">Credenciales de prueba de las demos</h6>

    <!-- Nota: qué son, cómo se guardan y qué hay que hacer después de cargarlas -->
    <small class="text-muted d-block mb-2">
      Son las credenciales de la cuenta de PRUEBA de Zipnova y de Mercado Pago que usan las demos y la tienda de cada demo.
      Se guardan cifradas y no se vuelven a mostrar: acá solo se ve si están cargadas y cómo terminan. Viajan solo en el demo-setup, nunca en el setup de un cliente real.
      Para que una demo las conecte hay que correrle un demo-setup (que vacía su base): hasta entonces sigue con lo que ya tenía.
    </small>

    <!-- Un bloque por integración, todos con la misma forma -->
    <div
      v-for="integracion in integraciones"
      :key="integracion.clave"
      class="demo-credentials-settings__bloque border rounded p-3 mb-3"
    >
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <strong class="small">{{ integracion.titulo }}</strong>

        <!-- Estado: cargada o no (nunca el valor) -->
        <span
          v-if="!estados[integracion.clave].cargando && !estados[integracion.clave].no_disponible"
          class="badge"
          :class="estados[integracion.clave].datos && estados[integracion.clave].datos.cargada ? 'bg-success' : 'bg-secondary'"
        >
          {{ estados[integracion.clave].datos && estados[integracion.clave].datos.cargada ? 'Cargada' : 'Sin cargar' }}
        </span>
      </div>

      <p v-if="estados[integracion.clave].cargando" class="text-muted small mb-0">Cargando…</p>

      <!-- Contra un admin-api anterior a esta función las rutas no existen -->
      <p v-else-if="estados[integracion.clave].no_disponible" class="text-muted small mb-0">
        Este admin-api todavía no tiene esta función. Aparece apenas se despliegue.
      </p>

      <template v-else>
        <!-- Detalle del estado: cómo terminan los valores cargados -->
        <p class="small text-muted mb-2" :data-testid="'estado-' + integracion.clave">{{ detalle_del_estado(integracion.clave) }}</p>

        <!-- Aviso: hay algo guardado que no se pudo descifrar -->
        <p v-if="estados[integracion.clave].datos && estados[integracion.clave].datos.ilegible" class="text-danger small mb-2">
          Hay credenciales guardadas que no se pueden leer (cambió la clave de cifrado del servidor). Volvé a cargarlas para que las demos las reciban.
        </p>

        <!-- Campos: NUNCA se rellenan con lo guardado; se escribe un valor nuevo para reemplazarlo -->
        <div class="row g-2 mb-2">
          <div
            v-for="campo in integracion.campos"
            :key="campo.clave"
            class="col-12 col-md-6"
          >
            <label class="form-label small" :for="'demo_cred_' + integracion.clave + '_' + campo.clave">
              {{ campo.etiqueta }}
            </label>
            <input
              :id="'demo_cred_' + integracion.clave + '_' + campo.clave"
              v-model="formularios[integracion.clave][campo.clave]"
              :type="campo.secreto ? 'password' : 'text'"
              class="form-control form-control-sm"
              autocomplete="off"
              spellcheck="false"
              :placeholder="campo.placeholder"
              :disabled="estados[integracion.clave].guardando || estados[integracion.clave].borrando"
            />
          </div>
        </div>

        <!-- Acciones: guardar solo lo escrito, probar lo cargado, borrar todo -->
        <div class="d-flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="!puede_guardar(integracion.clave)"
            @click="on_guardar(integracion.clave)"
          >
            {{ estados[integracion.clave].guardando ? 'Guardando…' : 'Guardar' }}
          </button>

          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            :disabled="!puede_probar(integracion.clave)"
            @click="on_probar(integracion.clave)"
          >
            {{ estados[integracion.clave].probando ? 'Probando…' : 'Probar' }}
          </button>

          <button
            type="button"
            class="btn btn-outline-danger btn-sm"
            :disabled="!puede_borrar(integracion.clave)"
            @click="on_borrar(integracion.clave)"
          >
            {{ estados[integracion.clave].borrando ? 'Borrando…' : 'Borrar' }}
          </button>
        </div>

        <!-- Mensajes: se limpian antes de cada acción para que uno viejo no tape al nuevo -->
        <p v-if="estados[integracion.clave].mensaje_ok" class="text-success small mt-2 mb-0">{{ estados[integracion.clave].mensaje_ok }}</p>
        <p v-if="estados[integracion.clave].mensaje_error" class="text-danger small mt-2 mb-0">{{ estados[integracion.clave].mensaje_error }}</p>

        <!-- Resultado de la prueba -->
        <div v-if="estados[integracion.clave].prueba" class="small mt-2" :data-testid="'prueba-' + integracion.clave">
          <span :class="estados[integracion.clave].prueba.autentica ? 'text-success' : 'text-danger'">
            Autentica: {{ estados[integracion.clave].prueba.autentica ? 'sí' : 'no' }}
          </span>
          <span v-if="estados[integracion.clave].prueba.cuenta" class="text-muted"> · Cuenta: {{ estados[integracion.clave].prueba.cuenta }}</span>
          <span v-if="estados[integracion.clave].prueba.motivo" class="text-muted"> · {{ texto_del_motivo(estados[integracion.clave].prueba.motivo) }}</span>
          <div v-if="estados[integracion.clave].prueba.aviso" class="text-warning-emphasis mt-1">{{ estados[integracion.clave].prueba.aviso }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Config de los GET de estado y de la prueba.
 *
 * Contra un admin-api anterior a esta función las rutas no existen: el lote no las trae, el GET de
 * respaldo da 404 y cada bloque muestra su propio aviso en línea. El toast global sumaba un segundo
 * aviso del mismo hecho, así que el 404/405 va callado (mismo criterio que las claves de Serper);
 * cualquier otro error (un 500) sigue avisando.
 *
 * @type {Object}
 */
const OPCIONES_SILENCIAR_RUTA_INEXISTENTE = { silent_error_statuses: [404, 405] }

/**
 * Descripción de las dos integraciones: ruta, textos y campos. Un solo lugar para que los dos
 * bloques tengan exactamente la misma forma, y para que agregar una tercera sea sumar una entrada.
 *
 * Cada campo lleva su regla de formato, que es la misma que aplica admin-api al guardar: así el
 * error aparece acá y no como un 422. `secreto` decide si el input es de tipo contraseña.
 *
 * @type {Array<Object>}
 */
const INTEGRACIONES = [
  {
    clave: 'zipnova',
    titulo: 'Zipnova (envíos)',
    ruta: '/settings/implementation-zipnova-demo',
    clave_del_lote: 'implementation-zipnova-demo',
    campos: [
      {
        clave: 'api_token',
        etiqueta: 'API Token',
        secreto: true,
        placeholder: '',
        formato: /^[^\s\x00-\x1F\x7F]{1,255}$/,
        mensaje_de_formato: 'El API Token no puede tener espacios ni saltos de línea (máx. 255 caracteres). Fijate que se haya copiado entero.',
      },
      {
        clave: 'api_secret',
        etiqueta: 'API Secret',
        secreto: true,
        placeholder: '',
        formato: /^[^\s\x00-\x1F\x7F]{1,255}$/,
        mensaje_de_formato: 'El API Secret no puede tener espacios ni saltos de línea (máx. 255 caracteres). Fijate que se haya copiado entero.',
      },
      {
        clave: 'account_id',
        etiqueta: 'ID de cuenta (opcional)',
        secreto: false,
        placeholder: 'Si no lo cargás, sale de Zipnova',
        formato: /^[0-9]{1,20}$/,
        mensaje_de_formato: 'El ID de cuenta de Zipnova es un número.',
      },
    ],
    // Con qué campos hay que contar para poder guardar por primera vez (el par obligatorio).
    par_obligatorio: ['api_token', 'api_secret'],
    mensaje_de_par: 'Zipnova necesita el API Token y el API Secret juntos: cargá los dos.',
    confirmacion_de_borrado: '¿Borrar las credenciales de Zipnova de las demos? Los próximos demo-setup dejan de conectarla y cada demo queda con lo que ya tenga.',
  },
  {
    clave: 'mercadopago',
    titulo: 'Mercado Pago (cobros)',
    ruta: '/settings/implementation-mercadopago-demo',
    clave_del_lote: 'implementation-mercadopago-demo',
    campos: [
      {
        clave: 'access_token',
        etiqueta: 'Access Token',
        secreto: true,
        placeholder: 'TEST-…',
        formato: /^(TEST|APP_USR)-[A-Za-z0-9_-]{20,}$/,
        mensaje_de_formato: 'El Access Token de Mercado Pago empieza con TEST- (de prueba) o APP_USR- y tiene al menos 20 caracteres más, sin espacios.',
      },
      {
        clave: 'public_key',
        etiqueta: 'Public Key',
        secreto: true,
        placeholder: 'TEST-…',
        formato: /^(TEST|APP_USR)-[A-Za-z0-9-]{20,}$/,
        mensaje_de_formato: 'La Public Key de Mercado Pago empieza con TEST- (de prueba) o APP_USR- y tiene al menos 20 caracteres más, sin espacios.',
      },
    ],
    par_obligatorio: ['access_token', 'public_key'],
    mensaje_de_par: 'Mercado Pago necesita el Access Token y la Public Key juntos: cargá los dos.',
    confirmacion_de_borrado: '¿Borrar las credenciales de Mercado Pago de las demos? Los próximos demo-setup dejan de conectarlo y cada demo queda con lo que ya tenga.',
  },
]

/**
 * Estado vacío de un bloque (lo que ve la pantalla antes de que llegue nada).
 *
 * @returns {Object}
 */
function estado_inicial() {
  return {
    /** Cuerpo del GET (estado y colas, nunca los valores); null hasta que llega. */
    datos: null,
    /** Hay un GET de estado en curso. */
    cargando: true,
    /** El admin-api no tiene esta función todavía (404/405). */
    no_disponible: false,
    guardando: false,
    probando: false,
    borrando: false,
    mensaje_ok: '',
    mensaje_error: '',
    /** Resultado de la última prueba: { autentica, cuenta, motivo, aviso } o null. */
    prueba: null,
  }
}

/**
 * Mensaje de error para mostrar cuando falla un PUT/POST: el primer error de campo del 422 (en
 * Laravel 8 el `message` es el genérico "The given data was invalid." y el motivo real viaja en
 * `errors`), si no el `message`, y si no un texto fijo.
 *
 * @param {Object} err Error de axios.
 * @returns {string}
 */
function mensaje_de_error(err) {
  const data = err && err.response && err.response.data

  if (data && data.errors) {
    const campos = Object.keys(data.errors)
    for (let i = 0; i < campos.length; i++) {
      const lista = data.errors[campos[i]]
      if (lista && lista.length) {
        return lista[0]
      }
    }
  }

  return (data && data.message) || 'No se pudo completar la operación.'
}

/**
 * Sección de Configuración → Implementación: credenciales de PRUEBA de Zipnova y de Mercado Pago
 * de las demos.
 *
 * 🔴 Reglas de este bloque, que no hay que "mejorar":
 *  - Los campos NUNCA se rellenan con el valor guardado (el servidor tampoco lo devuelve). Mostrar
 *    "termina en XXXX" es todo lo que se ve; para cambiar una credencial se escribe la nueva.
 *  - Guardar manda SOLO lo que se escribió. Un campo vacío significa "conservar lo guardado", no
 *    "borrar": borrar es el botón Borrar, con confirmación.
 *  - Después de guardar o borrar, los campos se vacían: el secreto no se queda en memoria del componente.
 *  - Todo mensaje viejo se limpia ANTES de validar, para que uno de éxito de un guardado anterior no
 *    tape un error de ahora (el template muestra los dos).
 *
 * Props: `initial_zipnova` e `initial_mercadopago` son el cuerpo de cada entrada del lote
 * (GET /settings/implementation) si el padre ya lo tiene; con null, el bloque hace su propio GET.
 */
export default {
  name: 'DemoCredentialsSettings',

  props: {
    /** Entrada 'implementation-zipnova-demo' del lote, o null. */
    initial_zipnova: { type: Object, default: null },
    /** Entrada 'implementation-mercadopago-demo' del lote, o null. */
    initial_mercadopago: { type: Object, default: null },
  },

  data() {
    const estados = {}
    const formularios = {}

    INTEGRACIONES.forEach(function (integracion) {
      estados[integracion.clave] = estado_inicial()
      formularios[integracion.clave] = {}
      integracion.campos.forEach(function (campo) {
        formularios[integracion.clave][campo.clave] = ''
      })
    })

    return {
      /** Descripción de los bloques (constante; va en data para usarla desde el template). */
      integraciones: INTEGRACIONES,
      /** Estado de cada bloque, por clave de integración. */
      estados: estados,
      /** Lo que se escribió en cada campo, por integración y por campo. Nunca viene del servidor. */
      formularios: formularios,
    }
  },

  mounted() {
    const self = this

    INTEGRACIONES.forEach(function (integracion) {
      self.cargar_estado(integracion, self['initial_' + integracion.clave])
    })
  },

  methods: {
    /**
     * Devuelve la descripción de una integración por su clave.
     *
     * @param {string} clave 'zipnova' o 'mercadopago'.
     * @returns {Object}
     */
    integracion_de(clave) {
      return INTEGRACIONES.filter(function (i) {
        return i.clave === clave
      })[0]
    },

    /**
     * Carga el estado de una integración: del lote si el padre lo trajo, o con su propio GET.
     *
     * @param {Object} integracion Descripción del bloque.
     * @param {Object|null} inicial Cuerpo de la entrada del lote, o null.
     * @returns {void}
     */
    cargar_estado(integracion, inicial) {
      const self = this
      const estado = self.estados[integracion.clave]

      if (inicial) {
        estado.datos = inicial
        estado.cargando = false
        return
      }

      api
        .get(integracion.ruta, OPCIONES_SILENCIAR_RUTA_INEXISTENTE)
        .then(function (res) {
          estado.datos = res.data
        })
        .catch(function (err) {
          const status = err && err.response && err.response.status
          if (status === 404 || status === 405) {
            estado.no_disponible = true
          } else {
            estado.mensaje_error = 'No se pudo cargar el estado de las credenciales.'
          }
        })
        .then(function () {
          estado.cargando = false
        })
    },

    /**
     * Texto de una línea que describe lo cargado, sin exponer ningún valor.
     *
     * @param {string} clave 'zipnova' o 'mercadopago'.
     * @returns {string}
     */
    detalle_del_estado(clave) {
      const datos = this.estados[clave].datos

      if (!datos || !datos.cargada) {
        return 'Sin cargar: las demos usan lo que tengan en su .env.'
      }

      const partes = []

      if (clave === 'zipnova') {
        partes.push(datos.api_token_cola ? 'API Token que termina en ' + datos.api_token_cola : 'API Token cargado')
        partes.push(datos.api_secret_cargado ? 'API Secret cargado' : 'sin API Secret')
        if (datos.account_id) {
          partes.push('cuenta ' + datos.account_id)
        }
      } else {
        const tipo = datos.tipo_access_token === 'TEST' ? ' de prueba' : (datos.tipo_access_token === 'APP_USR' ? ' de PRODUCCIÓN' : '')
        partes.push('Access Token' + tipo + (datos.access_token_cola ? ' que termina en ' + datos.access_token_cola : ' cargado'))
        partes.push(datos.public_key_cola ? 'Public Key que termina en ' + datos.public_key_cola : 'Public Key cargada')
      }

      return 'Cargada: ' + partes.join(' · ') + '.'
    },

    /**
     * Traduce el código de motivo de una prueba fallida a un texto para el operador.
     *
     * @param {string} motivo Código de admin-api (DemoCredentialsProbeService::MOTIVO_*).
     * @returns {string}
     */
    texto_del_motivo(motivo) {
      if (motivo === 'no_cargada') return 'No hay credenciales cargadas.'
      if (motivo === 'ilegible') return 'Las credenciales guardadas no se pueden leer: volvé a cargarlas.'
      if (motivo === 'credenciales_rechazadas') return 'El servicio rechazó las credenciales.'
      if (motivo === 'sin_respuesta') return 'El servicio no respondió a tiempo.'
      if (motivo === 'error_inesperado') return 'Falló algo inesperado al probar.'

      const http = /^error_http_(\d+)$/.exec(motivo || '')
      if (http) return 'El servicio respondió un error (HTTP ' + http[1] + ').'

      return 'No se pudo probar.'
    },

    /**
     * Campos de una integración que se escribieron (no vacíos), recortados. Es lo único que viaja.
     *
     * @param {string} clave 'zipnova' o 'mercadopago'.
     * @returns {Object} Mapa campo → valor escrito.
     */
    campos_escritos(clave) {
      const formulario = this.formularios[clave]
      const escritos = {}

      Object.keys(formulario).forEach(function (campo) {
        const valor = String(formulario[campo] || '').trim()
        if (valor !== '') {
          escritos[campo] = valor
        }
      })

      return escritos
    },

    /**
     * Guardar se habilita solo si se escribió algo y no hay otra operación en curso.
     *
     * @param {string} clave
     * @returns {boolean}
     */
    puede_guardar(clave) {
      const estado = this.estados[clave]
      return Object.keys(this.campos_escritos(clave)).length > 0 && !estado.guardando && !estado.borrando
    },

    /**
     * Probar se habilita solo si hay un par completo cargado en el servidor.
     *
     * @param {string} clave
     * @returns {boolean}
     */
    puede_probar(clave) {
      const estado = this.estados[clave]
      return !!(estado.datos && estado.datos.cargada) && !estado.probando && !estado.guardando && !estado.borrando
    },

    /**
     * Borrar se habilita solo si hay algo guardado (cargado o ilegible).
     *
     * @param {string} clave
     * @returns {boolean}
     */
    puede_borrar(clave) {
      const estado = this.estados[clave]
      const hay_algo = !!(estado.datos && (estado.datos.cargada || estado.datos.ilegible))
      return hay_algo && !estado.borrando && !estado.guardando
    },

    /**
     * Guarda lo escrito de una integración con PUT, validando antes en el navegador con las mismas
     * reglas que admin-api. Manda solo los campos escritos; vacía el formulario al terminar bien.
     *
     * @param {string} clave 'zipnova' o 'mercadopago'.
     * @returns {void}
     */
    on_guardar(clave) {
      const self = this
      const integracion = self.integracion_de(clave)
      const estado = self.estados[clave]

      // Antes de validar: un "guardado" anterior no puede tapar el error de abajo.
      estado.mensaje_ok = ''
      estado.mensaje_error = ''
      estado.prueba = null

      const escritos = self.campos_escritos(clave)

      // Formato de cada campo escrito, con el mensaje del campo.
      for (let i = 0; i < integracion.campos.length; i++) {
        const campo = integracion.campos[i]
        if (escritos[campo.clave] !== undefined && !campo.formato.test(escritos[campo.clave])) {
          estado.mensaje_error = campo.mensaje_de_formato
          return
        }
      }

      // El par obligatorio: si no hay uno completo ya guardado, hacen falta los dos campos.
      const ya_cargada = !!(estado.datos && estado.datos.cargada)
      const falta_del_par = integracion.par_obligatorio.some(function (campo) {
        return escritos[campo] === undefined
      })
      if (!ya_cargada && falta_del_par) {
        estado.mensaje_error = integracion.mensaje_de_par
        return
      }

      estado.guardando = true

      api
        .put(integracion.ruta, escritos)
        .then(function (res) {
          estado.datos = res.data
          // El secreto no se queda en memoria: se vacían todos los campos del bloque.
          self.vaciar_formulario(clave)
          estado.mensaje_ok = 'Credenciales guardadas.'
        })
        .catch(function (err) {
          estado.mensaje_error = mensaje_de_error(err)
        })
        .then(function () {
          estado.guardando = false
        })
    },

    /**
     * Prueba las credenciales cargadas contra el servicio real (POST .../probar) y muestra el resultado.
     *
     * @param {string} clave 'zipnova' o 'mercadopago'.
     * @returns {void}
     */
    on_probar(clave) {
      const self = this
      const integracion = self.integracion_de(clave)
      const estado = self.estados[clave]

      estado.mensaje_ok = ''
      estado.mensaje_error = ''
      estado.prueba = null
      estado.probando = true

      api
        .post(integracion.ruta + '/probar', {}, OPCIONES_SILENCIAR_RUTA_INEXISTENTE)
        .then(function (res) {
          estado.prueba = res.data
        })
        .catch(function (err) {
          const status = err && err.response && err.response.status
          estado.mensaje_error = (status === 404 || status === 405)
            ? 'Este admin-api todavía no tiene la prueba.'
            : mensaje_de_error(err)
        })
        .then(function () {
          estado.probando = false
        })
    },

    /**
     * Borra las credenciales de una integración (PUT con borrar: true), previa confirmación.
     *
     * @param {string} clave 'zipnova' o 'mercadopago'.
     * @returns {void}
     */
    on_borrar(clave) {
      const self = this
      const integracion = self.integracion_de(clave)
      const estado = self.estados[clave]

      estado.mensaje_ok = ''
      estado.mensaje_error = ''
      estado.prueba = null

      if (!window.confirm(integracion.confirmacion_de_borrado)) {
        return
      }

      estado.borrando = true

      api
        .put(integracion.ruta, { borrar: true })
        .then(function (res) {
          estado.datos = res.data
          self.vaciar_formulario(clave)
          estado.mensaje_ok = 'Credenciales borradas.'
        })
        .catch(function (err) {
          estado.mensaje_error = mensaje_de_error(err)
        })
        .then(function () {
          estado.borrando = false
        })
    },

    /**
     * Vacía los campos de un bloque.
     *
     * @param {string} clave 'zipnova' o 'mercadopago'.
     * @returns {void}
     */
    vaciar_formulario(clave) {
      const formulario = this.formularios[clave]

      Object.keys(formulario).forEach(function (campo) {
        formulario[campo] = ''
      })
    },
  },
}
</script>
