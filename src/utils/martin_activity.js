/**
 * Auditoría de Martín (misión auditoria-de-martin): lo que hizo con las herramientas del soporte en
 * el ticket abierto, por atención (una por ejecución del monitor), con el plan que declaró.
 *
 * El estado es uno solo y compartido: lo leen el indicador del encabezado y las tarjetas
 * «Recorrido de Martín» de la conversación, así un mismo ticket se pide una vez y los dos dicen lo
 * mismo. Sale de `GET /support-ticket/{id}/martin-activity`.
 *
 * Admin viejo (404): `disponible` queda en false y el panel dice «Sin actividad registrada», igual
 * que con un monitor viejo que todavía no manda nada.
 */
import { reactive } from 'vue'
import api from '@/utils/axios'

/** Espera antes de recargar cuando llega un mensaje: una ráfaga de mensajes es una sola consulta. */
const RECARGA_DEMORA_MS = 3000

/**
 * Segunda recarga después de un mensaje: el monitor manda la actividad al terminar cada comando,
 * así que puede llegar unos segundos después que la respuesta de Martín.
 */
const RECARGA_TARDIA_MS = 20000

/** Margen para ubicar la tarjeta bajo un mensaje que salió apenas después de cerrar la atención. */
const MARGEN_DESPUES_MS = 5 * 60 * 1000

/** Margen antes de `desde` (relojes del monitor y del admin no son idénticos). */
const MARGEN_ANTES_MS = 60 * 1000

/**
 * Estado compartido de la actividad del ticket abierto.
 */
export const martin_activity_state = reactive({
  /** Ticket al que corresponde lo cargado (o lo que se está cargando). */
  ticket_id: null,
  /** Atenciones, la más nueva primero (como las devuelve la API). */
  atenciones: [],
  /** Total de acciones del ticket. */
  total_acciones: 0,
  /** true mientras corre un GET. */
  cargando: false,
  /** true cuando ya hay respuesta para `ticket_id` (aunque sea vacía). */
  cargado: false,
  /** false si el admin todavía no tiene la ruta (404). */
  disponible: true,
  /** Mensaje de error del último GET, o vacío. */
  error: '',
})

/** Número de consulta: descarta respuestas de un ticket que ya no está abierto. */
let consulta = 0

/** Timers de las recargas programadas por mensajes nuevos. */
let timer_recarga = null
let timer_recarga_tardia = null

/**
 * Cancela las recargas programadas.
 *
 * @returns {void}
 */
function cancelar_recargas() {
  if (timer_recarga) {
    clearTimeout(timer_recarga)
    timer_recarga = null
  }
  if (timer_recarga_tardia) {
    clearTimeout(timer_recarga_tardia)
    timer_recarga_tardia = null
  }
}

/**
 * Pide la actividad de un ticket.
 *
 * Si cambia el ticket, lo del anterior se descarta en el acto (mejor nada que la actividad de
 * otro hilo). Si es el mismo, se recarga sin vaciar, para que el panel no parpadee.
 *
 * @param {number|string|null} ticket_id Ticket abierto.
 * @returns {Promise<void>}
 */
export function cargar_actividad_de_martin(ticket_id) {
  const estado = martin_activity_state
  if (ticket_id == null || ticket_id === '') {
    cancelar_recargas()
    consulta = consulta + 1
    estado.ticket_id = null
    estado.atenciones = []
    estado.total_acciones = 0
    estado.cargando = false
    estado.cargado = false
    estado.disponible = true
    estado.error = ''
    return Promise.resolve()
  }
  if (String(estado.ticket_id) !== String(ticket_id)) {
    cancelar_recargas()
    estado.ticket_id = ticket_id
    estado.atenciones = []
    estado.total_acciones = 0
    estado.cargado = false
    estado.disponible = true
  }
  const esta = consulta + 1
  consulta = esta
  estado.cargando = true
  estado.error = ''
  return api
    .get('/support-ticket/' + ticket_id + '/martin-activity', { silent_error_statuses: [404] })
    .then(function (response) {
      if (esta !== consulta) {
        return
      }
      const data = response && response.data ? response.data : {}
      estado.atenciones = Array.isArray(data.atenciones) ? data.atenciones : []
      estado.total_acciones = Number(data.total_acciones) || contar_acciones(estado.atenciones)
      estado.disponible = true
      estado.cargado = true
    })
    .catch(function (error) {
      if (esta !== consulta) {
        return
      }
      const status = error && error.response ? error.response.status : null
      if (status === 404) {
        estado.disponible = false
        estado.atenciones = []
        estado.total_acciones = 0
        estado.cargado = true
        return
      }
      estado.error = 'No pudimos consultar lo que hizo Martín en este ticket.'
    })
    .then(function () {
      if (esta === consulta) {
        estado.cargando = false
      }
    })
}

/**
 * Programa una recarga del ticket abierto (llegó un mensaje nuevo o cambió un contador).
 *
 * @param {number|string|null} ticket_id Ticket del mensaje.
 * @returns {void}
 */
export function programar_recarga_de_actividad(ticket_id) {
  if (ticket_id == null || String(martin_activity_state.ticket_id) !== String(ticket_id)) {
    return
  }
  cancelar_recargas()
  timer_recarga = setTimeout(function () {
    timer_recarga = null
    cargar_actividad_de_martin(ticket_id)
  }, RECARGA_DEMORA_MS)
  timer_recarga_tardia = setTimeout(function () {
    timer_recarga_tardia = null
    cargar_actividad_de_martin(ticket_id)
  }, RECARGA_TARDIA_MS)
}

/**
 * Total de acciones de una lista de atenciones (respaldo si la API no manda `total_acciones`).
 *
 * @param {Array<Object>} atenciones
 * @returns {number}
 */
export function contar_acciones(atenciones) {
  return (atenciones || []).reduce(function (total, atencion) {
    return total + (Array.isArray(atencion.acciones) ? atencion.acciones.length : 0)
  }, 0)
}

/**
 * Escrituras de una lista de atenciones (del resumen, o contando las acciones).
 *
 * @param {Array<Object>} atenciones
 * @returns {number}
 */
export function contar_escrituras(atenciones) {
  return (atenciones || []).reduce(function (total, atencion) {
    if (atencion.resumen && atencion.resumen.escrituras != null) {
      return total + (Number(atencion.resumen.escrituras) || 0)
    }
    const acciones = Array.isArray(atencion.acciones) ? atencion.acciones : []
    return total + acciones.filter(function (accion) { return accion.kind === 'escritura' }).length
  }, 0)
}

/** Ícono (bootstrap-icons) y rótulo de cada tipo de acción. */
const TIPOS = {
  lectura: { icono: 'bi-eye', rotulo: 'Lectura' },
  consulta: { icono: 'bi-journal-text', rotulo: 'Consulta' },
  escritura: { icono: 'bi-pencil-square', rotulo: 'Escritura' },
  envio: { icono: 'bi-send', rotulo: 'Envío' },
  plan: { icono: 'bi-list-check', rotulo: 'Plan' },
  error: { icono: 'bi-exclamation-triangle', rotulo: 'Error' },
}

/**
 * Ícono y rótulo de una acción. Una acción que salió mal (`ok: false`) se muestra como error,
 * sea del tipo que sea.
 *
 * @param {Object} accion
 * @returns {{icono: string, rotulo: string, tipo: string}}
 */
export function tipo_de_accion(accion) {
  const fallo = accion && (accion.ok === false || accion.ok === 0)
  const tipo = fallo ? 'error' : (accion && TIPOS[accion.kind] ? accion.kind : 'lectura')
  return Object.assign({ tipo: tipo }, TIPOS[tipo])
}

/** Ícono y rótulo de cada estado de un paso del plan. */
const ESTADOS_DE_PASO = {
  hecho: { icono: 'bi-check-circle-fill', rotulo: 'Hecho' },
  en_curso: { icono: 'bi-arrow-right-circle-fill', rotulo: 'En curso' },
  descartado: { icono: 'bi-dash-circle', rotulo: 'Descartado' },
  pendiente: { icono: 'bi-circle', rotulo: 'Pendiente' },
}

/**
 * Ícono y rótulo del estado de un paso.
 *
 * @param {Object} paso
 * @returns {{icono: string, rotulo: string, estado: string}}
 */
export function estado_de_paso(paso) {
  const estado = paso && ESTADOS_DE_PASO[paso.estado] ? paso.estado : 'pendiente'
  return Object.assign({ estado: estado }, ESTADOS_DE_PASO[estado])
}

const FECHA = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
})

const HORA = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
})

/**
 * Fecha y hora corta (es-AR, hora de Argentina).
 *
 * @param {string|null} valor
 * @returns {string}
 */
export function fecha_corta(valor) {
  const fecha = valor ? new Date(valor) : null
  return fecha && !isNaN(fecha.getTime()) ? FECHA.format(fecha) : '—'
}

/**
 * Hora sola (es-AR, hora de Argentina).
 *
 * @param {string|null} valor
 * @returns {string}
 */
export function hora_corta(valor) {
  const fecha = valor ? new Date(valor) : null
  return fecha && !isNaN(fecha.getTime()) ? HORA.format(fecha) : ''
}

/**
 * «11/11/26 14:02 a 14:20» de una atención (sin la segunda hora si es una sola acción).
 *
 * @param {Object} atencion
 * @returns {string}
 */
export function rango_de_atencion(atencion) {
  const desde = fecha_corta(atencion && atencion.desde)
  const hasta = hora_corta(atencion && atencion.hasta)
  if (!hasta || hasta === hora_corta(atencion && atencion.desde)) {
    return desde
  }
  return desde + ' a ' + hasta
}

/**
 * Datos chicos del `detail` de una acción, listos para mostrar («filas: 12»). Solo valores
 * simples: el monitor no manda datos crudos y acá tampoco se arma nada que lo parezca.
 *
 * @param {Object} accion
 * @returns {string}
 */
export function detalle_de_accion(accion) {
  const detalle = accion && accion.detail
  if (!detalle || typeof detalle !== 'object' || Array.isArray(detalle)) {
    return ''
  }
  return Object.keys(detalle)
    .filter(function (clave) {
      const valor = detalle[clave]
      return valor !== null && valor !== '' && ['string', 'number', 'boolean'].indexOf(typeof valor) !== -1
    })
    .slice(0, 6)
    .map(function (clave) {
      const valor = detalle[clave]
      const texto = typeof valor === 'boolean' ? (valor ? 'sí' : 'no') : String(valor)
      return clave.replace(/_/g, ' ') + ': ' + (texto.length > 80 ? texto.slice(0, 80) + '…' : texto)
    })
    .join(' · ')
}

/**
 * Milisegundos de una fecha, o NaN.
 *
 * @param {string|null} valor
 * @returns {number}
 */
function ms(valor) {
  return valor ? new Date(valor).getTime() : NaN
}

/**
 * Ubica cada atención en la conversación: bajo el último mensaje del soporte enviado dentro de su
 * rango (`desde` a `hasta`, con margen), o al pie si no hay ninguno.
 *
 * @param {Array<Object>} atenciones Atenciones (la más nueva primero).
 * @param {Array<Object>} mensajes Mensajes del hilo en orden.
 * @returns {{por_mensaje: Object<string, Array<Object>>, al_pie: Array<Object>}}
 */
export function ubicar_atenciones(atenciones, mensajes) {
  const por_mensaje = {}
  const al_pie = []
  const candidatos = (mensajes || []).filter(function (mensaje) {
    return mensaje && mensaje.id != null && mensaje.sender_type === 'admin' && !mensaje.is_ai_suggestion_draft && !isNaN(ms(mensaje.created_at))
  })
  /* De la más vieja a la más nueva: si dos caen bajo el mismo mensaje, quedan en orden. */
  const ordenadas = (atenciones || []).slice().reverse()
  ordenadas.forEach(function (atencion) {
    const desde = ms(atencion.desde)
    const hasta = isNaN(ms(atencion.hasta)) ? desde : ms(atencion.hasta)
    let elegido = null
    if (!isNaN(desde)) {
      for (let i = candidatos.length - 1; i >= 0; i--) {
        const t = ms(candidatos[i].created_at)
        if (t >= desde - MARGEN_ANTES_MS && t <= hasta + MARGEN_DESPUES_MS) {
          elegido = candidatos[i]
          break
        }
      }
    }
    if (elegido) {
      const clave = String(elegido.id)
      if (!por_mensaje[clave]) {
        por_mensaje[clave] = []
      }
      por_mensaje[clave].push(atencion)
    } else {
      al_pie.push(atencion)
    }
  })
  return { por_mensaje: por_mensaje, al_pie: al_pie }
}

/** Aclaración que acompaña al panel y a las tarjetas. */
export const ACLARACION_ACTIVIDAD = 'Registra lo que Martín hizo con las herramientas del soporte; lo que leyó del manual o del código no aparece.'
