/**
 * Lógica pura del alta de un lead que llegó por OTRO medio (misión leads-referidos-compromisos, E1).
 *
 * Un referido, alguien que le escribió a Lucas por su WhatsApp personal o que ya habló por teléfono no pasó por
 * el circuito de los leads. El modal «Nuevo lead de otro medio» lo da de alta con `POST lead/externo`. La que
 * manda es la API (`LeadAltaExternaService`): acá se replican sus reglas SÓLO para avisar en la pantalla antes de
 * mandar y para armar el cuerpo del pedido. Si la API cambia una regla, su 422 sigue siendo la última palabra.
 *
 * Es JavaScript sin imports a propósito: `pruebas/leads-referidos-compromisos.cjs` lo lee tal cual y lo ejecuta
 * en Node, así que no puede depender de Vue ni de axios (misma convención que `utils/registrar_llamada.js`).
 *
 * Forma del formulario que recibe cada función:
 *   {
 *     origen: string,                  // clave de ORIGENES
 *     contact_name: string,            // obligatorio
 *     phone: string,                   // obligatorio, en cualquier formato
 *     company_name: string,
 *     business_type: string,
 *     email: string,
 *     referido_por_client_id: number | null,  // cliente de ComercioCity que lo recomendó
 *     referido_por_texto: string,      // quien lo recomendó cuando no es un cliente cargado (hasta 120)
 *     contexto_previo: string,         // lo que ya se habló (hasta 60.000)
 *     estado_inicial: string,          // clave de ESTADOS
 *     entrar_al_tablero: boolean,      // da de alta la tarjeta en «Interesados» del tablero de Juan
 *     primer_contacto: string,         // 'ninguno' | 'plantilla_referido'
 *   }
 */

/**
 * Orígenes externos, en el orden en que se muestran. Las claves son las de `LeadOrigenService::ORIGENES_EXTERNOS`.
 *
 * @type {Array<{value: string, label: string}>}
 */
export const ORIGENES = [
  { value: 'referido', label: 'Referido' },
  { value: 'whatsapp_personal', label: 'WhatsApp de Lucas' },
  { value: 'llamada', label: 'Llamada' },
  { value: 'otro', label: 'Otro medio' },
]

/**
 * Estados en los que puede nacer el lead. «Nuevo» va primero porque es el default (Martín le explica los paquetes
 * y el lead elige cómo arrancar); «Quiere probar» lo deja directo en el tablero de Juan.
 *
 * @type {Array<{value: string, label: string}>}
 */
export const ESTADOS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'link_enviado', label: 'Quiere probar' },
]

/** Máximo de caracteres de lo que ya se habló (el mismo tope que la API). */
export const MAX_CONTEXTO = 60000

/** Máximo de caracteres de «referido por» cuando no es un cliente cargado. */
export const MAX_REFERIDO_TEXTO = 120

/**
 * Texto recortado de un valor del formulario ('' si no es texto).
 *
 * @param {*} valor
 * @returns {string}
 */
function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : ''
}

/**
 * Valida el formulario y devuelve un mensaje por campo con problema (objeto vacío = todo bien).
 *
 * @param {Object} form
 * @returns {Object<string, string>}
 */
export function validar(form) {
  const errores = {}
  const datos = form || {}

  if (texto(datos.phone) === '') {
    errores.phone = 'Cargá el teléfono.'
  }
  if (texto(datos.contact_name) === '') {
    errores.contact_name = 'Cargá el nombre.'
  }
  const origenes = ORIGENES.map(function (origen) {
    return origen.value
  })
  if (origenes.indexOf(datos.origen) === -1) {
    errores.origen = 'Elegí por qué medio llegó.'
  }
  const estados = ESTADOS.map(function (estado) {
    return estado.value
  })
  if (estados.indexOf(datos.estado_inicial) === -1) {
    errores.estado_inicial = 'Elegí en qué estado entra.'
  }
  if (typeof datos.contexto_previo === 'string' && datos.contexto_previo.length > MAX_CONTEXTO) {
    errores.contexto_previo = 'Lo que ya se habló no puede pasar de ' + MAX_CONTEXTO + ' caracteres.'
  }
  if (typeof datos.referido_por_texto === 'string' && datos.referido_por_texto.length > MAX_REFERIDO_TEXTO) {
    errores.referido_por_texto = 'Quien lo refirió no puede pasar de ' + MAX_REFERIDO_TEXTO + ' caracteres.'
  }

  return errores
}

/**
 * Arma el cuerpo del pedido: descarta los campos vacíos (null, undefined o sólo espacios) y manda
 * `entrar_al_tablero` SIEMPRE como booleano. No agrega `completar_existente`: eso lo decide el modal si el
 * operador acepta completar el lead que ya existía.
 *
 * @param {Object} form
 * @returns {Object}
 */
export function payload(form) {
  const datos = form || {}
  const cuerpo = {}
  const campos = [
    'origen', 'contact_name', 'phone', 'company_name', 'business_type', 'email',
    'referido_por_texto', 'contexto_previo', 'estado_inicial', 'primer_contacto',
  ]

  campos.forEach(function (campo) {
    const valor = texto(datos[campo])
    if (valor !== '') {
      cuerpo[campo] = valor
    }
  })

  if (datos.referido_por_client_id !== null && datos.referido_por_client_id !== undefined && datos.referido_por_client_id !== '') {
    cuerpo.referido_por_client_id = Number(datos.referido_por_client_id)
  }
  cuerpo.entrar_al_tablero = datos.entrar_al_tablero === true

  return cuerpo
}
