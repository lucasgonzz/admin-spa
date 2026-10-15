/**
 * Estado compartido y acciones de la página del centro de recursos.
 *
 * Es un `reactive()` de módulo en lugar de Vuex a propósito: la página es una entrada de Vite
 * aparte y no importa el store del admin (§5.1 del plan). Los componentes lo leen directo y
 * llaman a las acciones exportadas acá; ninguno le habla a la API por su cuenta.
 *
 * Lo que guarda cada cosa:
 * - catálogo (`carpetas`, `videos`): `GET recursos/catalogo`, público.
 * - sesión (`usuario`, `progreso`, `votos`, `encuestas`, `respuestas_nuevas`): `GET recursos/yo`.
 *   Sin sesión todo eso queda vacío y la página anda igual (decisión 2 de Lucas: sin sesión el
 *   video SE VE).
 * - detalle de cada video (`detalles`): `GET recursos/videos/{codigo}` — transcripción y
 *   preguntas visibles.
 *
 * El progreso sigue la regla del prototipo (`registrar()`): solo cuentan los segundos
 * reproducidos de verdad; saltar con la barra no suma. Acá se juntan los TRAMOS reproducidos
 * y se mandan al servidor cada ~10 s, al pausar, al cambiar de video y al cerrar (§5.1).
 *
 * Modo soporte (misión centro-recursos-soporte-y-tema, 14/10/2026): cuando soporte entra con un
 * login maestro, `usuario.solo_lectura` viene en `true`. Se VE el avance del dueño, pero la página
 * no escribe nada: todas las acciones que mandan algo al servidor (progreso, votos, encuesta,
 * preguntas, me gusta) quedan como no-op. El campo es opcional: ausente = sesión normal, así la
 * página anda igual contra un admin-api que todavía no lo manda.
 */
import { reactive, markRaw } from 'vue'
import { pedir, hay_sesion, guardar_token, borrar_token, sesion_guardada_es_soporte, cuando_se_pierda_la_sesion } from './api'
import { normalizar } from './utiles'

/** Fracción vista a partir de la cual un video cuenta como terminado (la misma regla del servidor). */
export const HECHO = 0.9

/**
 * Largo de los pedazos en que se parte un tramo largo. El servidor acepta hasta 30 s (§3.4),
 * pero se corta en 29,9: con 30 justos el redondeo de punto flotante (`32.2 - 2.2` da
 * `30.000000000000004`) hacía que el servidor rechazara el lote entero.
 */
const MAX_SEGUNDOS_POR_TRAMO = 29.9

/** Cantidad máxima de tramos por pedido (§3.4). */
const MAX_TRAMOS_POR_PEDIDO = 50

/** Cada cuánto se manda el progreso pendiente mientras se mira un video. */
const MS_ENTRE_ENVIOS = 10000

/** Clave de `localStorage` de las preferencias del visitante (velocidad y carpetas abiertas). */
const CLAVE_PREFERENCIAS = 'cc-recursos-preferencias'

/** Velocidades que ofrece el reproductor (las del prototipo). */
export const VELOCIDADES = [1, 1.25, 1.5, 2]

/** Estado reactivo de la página. */
export const estado = reactive({
  /** true hasta que se resuelve la primera carga del catálogo. */
  cargando: true,
  /** true si el catálogo no se pudo cargar (se ofrece reintentar). */
  error_carga: false,
  /** Carpetas del catálogo: [{ nro, nombre }]. */
  carpetas: [],
  /** Videos activos, en el orden del guion: [{ codigo, titulo, carpeta, seccion, ..., i }]. */
  videos: [],
  /** Usuario del centro (`{nombre, nombre_pila, es_dueno, negocio}`) o null = invitado. */
  usuario: null,
  /** Progreso por código: { porcentaje (0–100, del servidor), posicion, terminado, sesion_n }. */
  progreso: {},
  /** Voto por código: 1 (👍) | -1 (👎). Sin entrada = sin voto. */
  votos: {},
  /** Códigos con la encuesta ya respondida: { codigo: true }. */
  encuestas: {},
  /** Respuestas nuevas a preguntas propias: [{ codigo, pregunta_id }]. */
  respuestas_nuevas: [],
  /** Índice de búsqueda por transcripción (codigo → texto normalizado), o null si no se pidió. */
  indice: null,
  /** true mientras se baja el índice de búsqueda. */
  indice_cargando: false,
  /** Detalle por código: { transcripcion, preguntas, cargando, error }. */
  detalles: {},
  /** Código del video abierto. */
  actual: null,
  /** Carpetas desplegadas: { nro: true }. */
  abiertas: {},
  /** Velocidad de reproducción elegida. */
  vel: 1,
  /** true con el cajón de carpetas abierto (≤ 860 px). */
  cajon: false,
  /** Aviso de arriba (entrada fallida, sesión cerrada): { tipo: 'error' | 'info', texto } o null. */
  aviso: null,
  /** Texto del toast visible ('' = oculto). */
  toast: '',
})

/**
 * Indica si la sesión actual es de solo lectura (soporte con login maestro). Lee estado reactivo,
 * así sirve también dentro de `computed`.
 *
 * @returns {boolean}
 */
export function es_solo_lectura() {
  return !!(estado.usuario && estado.usuario.solo_lectura === true)
}

/**
 * Indica si un error de la API es el `403 {error: 'solo_lectura'}` que el servidor da a una
 * escritura de una sesión de soporte. Si llega sin que la página lo esperara, se ignora sin cartel.
 *
 * @param {import('./api').ErrorApi} error
 * @returns {boolean}
 */
export function es_error_solo_lectura(error) {
  return !!error && error.status === 403 && error.codigo === 'solo_lectura'
}

/** Videos por código (no reactivo: el catálogo no cambia mientras la página está abierta). */
let por_codigo = {}

/** Segundos vistos EN ESTA VISITA, por código: un Uint8Array con un 1 por segundo reproducido. */
const vistos_sesion = {}

/**
 * Progreso todavía no confirmado por el servidor, por código:
 * { tramos: [[desde, hasta], ...], abierto: [desde, hasta] | null, posicion }.
 * `abierto` es el tramo que se sigue estirando mientras el video corre sin saltos.
 */
const pendientes = {}

/** Códigos con un POST de progreso en vuelo (para no mandar dos a la vez del mismo video). */
const enviando = {}

/** Códigos que ya se festejaron como terminados (para el toast de "terminaste la carpeta"). */
const ya_terminados = {}

/** Timer del toast. */
let timer_toast = null

/* ------------------------------------------------------------------ */
/* Preferencias del visitante                                          */
/* ------------------------------------------------------------------ */

/**
 * Lee velocidad y carpetas abiertas de `localStorage`. Si no hay o falla, quedan los valores
 * por defecto: es una comodidad, no un dato que se pueda perder.
 *
 * @returns {void}
 */
function leer_preferencias() {
  try {
    /** Preferencias guardadas. */
    const p = JSON.parse(window.localStorage.getItem(CLAVE_PREFERENCIAS) || 'null')
    if (p && VELOCIDADES.indexOf(Number(p.vel)) !== -1) {
      estado.vel = Number(p.vel)
    }
    if (p && p.abiertas && typeof p.abiertas === 'object') {
      estado.abiertas = Object.assign({}, p.abiertas)
    }
  } catch (e) {
    /* Sin preferencias: valores por defecto. */
  }
}

/**
 * Guarda velocidad y carpetas abiertas.
 *
 * @returns {void}
 */
export function guardar_preferencias() {
  try {
    window.localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify({ vel: estado.vel, abiertas: estado.abiertas }))
  } catch (e) {
    /* Sin localStorage no se recuerdan: no es un error para el usuario. */
  }
}

/* ------------------------------------------------------------------ */
/* Lecturas                                                            */
/* ------------------------------------------------------------------ */

/**
 * Video del catálogo por código.
 *
 * @param {string} codigo
 * @returns {Object|null}
 */
export function video_por_codigo(codigo) {
  return por_codigo[codigo] || null
}

/**
 * Videos de una carpeta, en orden.
 *
 * @param {number} nro
 * @returns {Array<Object>}
 */
export function videos_de(nro) {
  return estado.videos.filter(function (v) {
    return v.carpeta === nro
  })
}

/**
 * Carpeta por número.
 *
 * @param {number} nro
 * @returns {Object|null}
 */
export function carpeta_por_nro(nro) {
  return (
    estado.carpetas.find(function (c) {
      return c.nro === nro
    }) || null
  )
}

/**
 * Fracción vista de un video (0–1). Es la mayor entre lo que ya confirmó el servidor y lo que
 * se vio en esta visita: nunca puede mostrar de más (el servidor es el que manda, y une lo de
 * todas las visitas) y avanza al instante mientras se mira (§5.1: "el estado local se
 * actualiza al instante").
 *
 * @param {Object} video
 * @returns {number}
 */
export function fraccion(video) {
  /** Progreso del video, si hay. */
  const p = estado.progreso[video.codigo]
  if (!p) {
    return 0
  }
  if (p.terminado) {
    return 1
  }
  /** Segundos del video, redondeados para arriba (la misma cuenta del servidor). */
  const total = Math.max(1, Math.ceil(video.duracion || 0))
  return Math.min(1, Math.max((p.porcentaje || 0) / 100, (p.sesion_n || 0) / total))
}

/**
 * Indica si un video cuenta como terminado.
 *
 * @param {Object} video
 * @returns {boolean}
 */
export function terminado(video) {
  /** Progreso del video, si hay. */
  const p = estado.progreso[video.codigo]
  return !!p && (p.terminado || fraccion(video) >= HECHO)
}

/**
 * Avance de una lista de videos, como en el prototipo: promedio de lo visto (un terminado
 * cuenta entero) y cuántos están terminados.
 *
 * @param {Array<Object>} lista
 * @returns {{ pct: number, hechos: number, n: number }}
 */
export function avance(lista) {
  if (!lista.length) {
    return { pct: 0, hechos: 0, n: 0 }
  }
  /** Suma de fracciones. */
  let suma = 0
  /** Cantidad de terminados. */
  let hechos = 0
  lista.forEach(function (v) {
    if (terminado(v)) {
      suma += 1
      hechos++
    } else {
      suma += fraccion(v)
    }
  })
  return { pct: suma / lista.length, hechos: hechos, n: lista.length }
}

/* ------------------------------------------------------------------ */
/* Avisos                                                              */
/* ------------------------------------------------------------------ */

/**
 * Muestra un toast abajo a la derecha (como el del prototipo).
 *
 * @param {string} texto
 * @returns {void}
 */
export function mostrar_toast(texto) {
  estado.toast = texto
  clearTimeout(timer_toast)
  timer_toast = setTimeout(function () {
    estado.toast = ''
  }, 2600)
}

/**
 * Muestra el aviso de arriba.
 *
 * @param {'error'|'info'} tipo
 * @param {string} texto
 * @returns {void}
 */
function mostrar_aviso(tipo, texto) {
  estado.aviso = { tipo: tipo, texto: texto }
}

/**
 * Cierra el aviso de arriba.
 *
 * @returns {void}
 */
export function cerrar_aviso() {
  estado.aviso = null
}

/* ------------------------------------------------------------------ */
/* URL                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Deja la URL con `?v=<codigo>` (o sin `v` si no hay video) y SIN el pase ni el token: un pase
 * o un link personal en la barra de direcciones terminan en el historial, en una captura o
 * reenviados por WhatsApp. Tampoco queda `tema`: ya se aplicó y se guardó (el script de
 * `recursos.html`), y un link copiado con `?tema=dark` le impondría el tema a quien lo abra. El
 * resto de los parámetros (utm, etc.) se respeta.
 *
 * @param {string|null} codigo
 * @returns {void}
 */
function poner_en_url(codigo) {
  try {
    /** URL actual. */
    const url = new URL(window.location.href)
    url.searchParams.delete('pase')
    url.searchParams.delete('api')
    url.searchParams.delete('t')
    url.searchParams.delete('tema')
    if (codigo) {
      url.searchParams.set('v', codigo)
    } else {
      url.searchParams.delete('v')
    }
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  } catch (e) {
    /* Navegador sin URL/history: la URL queda como vino. */
  }
}

/* ------------------------------------------------------------------ */
/* Arranque, sesión y catálogo                                         */
/* ------------------------------------------------------------------ */

/**
 * Texto para el visitante según el código de error de `sesion/pase` o `sesion/link`.
 *
 * @param {import('./api').ErrorApi} error
 * @returns {string}
 */
function texto_de_entrada_fallida(error) {
  /** Código del backend (§2, C2). */
  const codigo = error && error.codigo
  if (codigo === 'pase_invalido') {
    return 'El acceso desde tu sistema venció o ya se usó. Volvé a tocar «Tutoriales» en el menú de tu sistema para entrar con tu usuario. Mientras tanto podés ver todos los videos.'
  }
  if (codigo === 'cliente_no_encontrado') {
    return 'No pudimos reconocer tu sistema para iniciar tu sesión. Podés ver todos los videos igual; si querés guardar tu avance, avisanos por WhatsApp y lo revisamos.'
  }
  if (codigo === 'cliente_no_responde') {
    return 'Tu sistema no respondió a tiempo para iniciar tu sesión. Probá de nuevo en un rato desde el menú de tu sistema; mientras tanto podés ver los videos.'
  }
  if (codigo === 'link_invalido') {
    return 'Ese link venció o no es válido. Entrá desde tu sistema (menú → Tutoriales) o pedinos uno nuevo por WhatsApp. Mientras tanto podés ver todos los videos.'
  }
  if (error && error.status === 429) {
    return 'Hubo demasiados intentos seguidos. Esperá un minuto y volvé a entrar desde tu sistema.'
  }
  return 'No pudimos iniciar tu sesión. Podés ver todos los videos igual; probá entrar de nuevo en un rato.'
}

/**
 * Canjea un pase (`sesion/pase`) o un link personal (`sesion/link`) por una sesión del centro.
 * Si falla, la página sigue como estaba (invitada, o con la sesión que ya tenía guardada), con una
 * excepción: si la sesión guardada era de SOPORTE (solo lectura) se descarta y la página queda
 * invitada con el aviso de error. Soporte abre un cliente tras otro; si el pase del segundo falla y
 * quedara la sesión del primero, la pantalla mostraría el error y a la vez el nombre, el negocio y
 * la insignia del cliente de antes: confunde sobre a quién se está mirando.
 *
 * @param {string} ruta 'recursos/sesion/pase' | 'recursos/sesion/link'
 * @param {Object} cuerpo
 * @returns {Promise<void>}
 */
function entrar(ruta, cuerpo) {
  return pedir('POST', ruta, cuerpo, { sin_sesion: true })
    .then(function (r) {
      if (!r || !r.token) {
        throw new Error('respuesta sin token')
      }
      guardar_token(r.token, !!(r.usuario && r.usuario.solo_lectura === true))
      estado.usuario = r.usuario || null
    })
    .catch(function (error) {
      if (sesion_guardada_es_soporte()) {
        borrar_token()
        limpiar_sesion()
      }
      mostrar_aviso('error', texto_de_entrada_fallida(error))
    })
}

/**
 * Vacía todo lo que depende de la sesión. La usa `salir()` y el 401 de cualquier pedido.
 *
 * @returns {void}
 */
function limpiar_sesion() {
  estado.usuario = null
  estado.progreso = {}
  estado.votos = {}
  estado.encuestas = {}
  estado.respuestas_nuevas = []
  Object.keys(pendientes).forEach(function (codigo) {
    delete pendientes[codigo]
  })
  Object.keys(ya_terminados).forEach(function (codigo) {
    delete ya_terminados[codigo]
  })
}

/**
 * El servidor rechazó el token (venció o se cerró en otro lado): la página sigue como invitada.
 *
 * @returns {void}
 */
function pasar_a_invitado() {
  /** Había alguien adentro (para no avisar dos veces). */
  const habia_usuario = !!estado.usuario
  limpiar_sesion()
  if (habia_usuario) {
    mostrar_aviso('info', 'Tu sesión del centro se cerró. Podés seguir viendo los videos; para guardar tu avance, volvé a entrar desde tu sistema (menú → Tutoriales).')
  }
}

/**
 * Trae el usuario y todo su avance (`GET recursos/yo`), si hay sesión.
 *
 * @returns {Promise<void>}
 */
function cargar_yo() {
  if (!hay_sesion()) {
    return Promise.resolve()
  }
  return pedir('GET', 'recursos/yo')
    .then(function (r) {
      if (!r || !hay_sesion()) {
        return
      }
      estado.usuario = r.usuario || estado.usuario
      /** Progreso normalizado (el backend puede mandar decimales como string). */
      const progreso = {}
      Object.keys(r.progreso || {}).forEach(function (codigo) {
        /** Fila del backend. */
        const p = r.progreso[codigo] || {}
        progreso[codigo] = {
          porcentaje: Number(p.porcentaje) || 0,
          posicion: Number(p.posicion) || 0,
          terminado: !!p.terminado,
          sesion_n: 0,
        }
        if (p.terminado) {
          ya_terminados[codigo] = true
        }
      })
      estado.progreso = progreso
      /** Votos normalizados a 1 / -1. */
      const votos = {}
      Object.keys(r.votos || {}).forEach(function (codigo) {
        /** Valor del backend. */
        const valor = Number(r.votos[codigo])
        if (valor === 1 || valor === -1) {
          votos[codigo] = valor
        }
      })
      estado.votos = votos
      /** Encuestas respondidas como mapa. */
      const encuestas = {}
      ;(Array.isArray(r.encuestas) ? r.encuestas : []).forEach(function (codigo) {
        encuestas[codigo] = true
      })
      estado.encuestas = encuestas
      estado.respuestas_nuevas = Array.isArray(r.respuestas_nuevas) ? r.respuestas_nuevas : []
    })
    .catch(function () {
      /* 401: ya pasó a invitado en api.js. Otro error: se sigue con lo que haya. */
    })
}

/**
 * Baja el catálogo público.
 *
 * @returns {Promise<void>}
 */
export function cargar_catalogo() {
  estado.cargando = true
  estado.error_carga = false
  return pedir('GET', 'recursos/catalogo', undefined, { sin_sesion: true })
    .then(function (r) {
      /** Carpetas tal cual vienen (ya ordenadas por número). */
      const carpetas = (r && Array.isArray(r.carpetas) ? r.carpetas : []).map(function (c) {
        return { nro: Number(c.nro), nombre: c.nombre }
      })
      /** Videos con los números normalizados y su posición en la lista. */
      const videos = (r && Array.isArray(r.videos) ? r.videos : [])
        .map(function (v) {
          return {
            codigo: v.codigo,
            titulo: v.titulo || v.codigo,
            carpeta: Number(v.carpeta),
            seccion: v.seccion || null,
            orden: Number(v.orden) || 0,
            para_que: v.para_que || '',
            cuando_no: v.cuando_no || '',
            relacionados: Array.isArray(v.relacionados) ? v.relacionados : [],
            duracion: Number(v.duracion) || 0,
            url: v.url,
            miniatura_url: v.miniatura_url || null,
          }
        })
        .sort(function (a, b) {
          return a.orden - b.orden
        })
      /** Índice nuevo por código. */
      const indice = {}
      videos.forEach(function (v, i) {
        v.i = i
        indice[v.codigo] = v
      })
      por_codigo = indice
      estado.carpetas = markRaw(carpetas)
      estado.videos = markRaw(videos)
      estado.cargando = false
    })
    .catch(function () {
      estado.error_carga = true
      estado.cargando = false
    })
}

/**
 * Elige qué video abrir al entrar: el de `?v=`, o el primero empezado y sin terminar, o el
 * primero sin terminar, o el primero (la misma regla del prototipo).
 *
 * @param {string|null} pedido Código que vino en `?v=`.
 * @returns {void}
 */
function abrir_video_inicial(pedido) {
  if (!estado.videos.length) {
    return
  }
  if (pedido && por_codigo[pedido]) {
    abrir_video(pedido)
    return
  }
  if (pedido) {
    mostrar_toast('Ese video ya no está en el centro. Te dejamos en el siguiente para ver.')
  }
  /** Video elegido. */
  const v =
    estado.videos.find(function (x) {
      return estado.progreso[x.codigo] && !terminado(x)
    }) ||
    estado.videos.find(function (x) {
      return !terminado(x)
    }) ||
    estado.videos[0]
  abrir_video(v.codigo)
}

/**
 * Arranca la página: preferencias, entrada por `?pase=&api=` o `?t=`, catálogo y avance.
 *
 * @returns {Promise<void>}
 */
export function iniciar() {
  leer_preferencias()
  cuando_se_pierda_la_sesion(pasar_a_invitado)

  /** Parámetros con los que se abrió la página. */
  const params = new URLSearchParams(window.location.search)
  /** Pase de un solo uso que emitió el sistema del cliente (C1). */
  const pase = params.get('pase')
  /** Base de la API del cliente que emitió el pase. */
  const api_cliente = params.get('api')
  /** Link personal del dueño. */
  const link = params.get('t')
  /** Video pedido. */
  const pedido = params.get('v')

  /* El pase y el token salen de la URL antes que nada (§5.1). */
  poner_en_url(pedido)

  /** Promesa de la entrada, si vino algo para canjear. */
  let entrada = Promise.resolve()
  if (pase && api_cliente) {
    entrada = entrar('recursos/sesion/pase', { pase: pase, api: api_cliente })
  } else if (link) {
    entrada = entrar('recursos/sesion/link', { t: link })
  }

  setInterval(function () {
    enviar_progreso()
  }, MS_ENTRE_ENVIOS)

  return Promise.all([cargar_catalogo(), entrada.then(cargar_yo)]).then(function () {
    if (!estado.error_carga) {
      abrir_video_inicial(pedido)
    }
  })
}

/**
 * Vuelve a intentar la carga del catálogo (botón "Reintentar" cuando falló).
 *
 * @returns {Promise<void>}
 */
export function reintentar_carga() {
  return cargar_catalogo().then(function () {
    if (!estado.error_carga) {
      abrir_video_inicial(estado.actual)
    }
  })
}

/**
 * Cierra la sesión del centro en este navegador (`POST recursos/salir`).
 *
 * @returns {void}
 */
export function salir() {
  enviar_progreso()
  pedir('POST', 'recursos/salir', {}).catch(function () {
    /* Aunque el servidor no conteste, en este navegador se sale igual. */
  })
  borrar_token()
  limpiar_sesion()
  mostrar_toast('Saliste del centro de recursos.')
}

/* ------------------------------------------------------------------ */
/* Navegación                                                          */
/* ------------------------------------------------------------------ */

/**
 * Abre un video: lo marca como actual, despliega su carpeta, deja `?v=` en la URL y baja su
 * detalle (transcripción y preguntas).
 *
 * @param {string} codigo
 * @returns {void}
 */
export function abrir_video(codigo) {
  /** Video del catálogo. */
  const v = por_codigo[codigo]
  if (!v) {
    return
  }
  estado.actual = codigo
  estado.cajon = false
  if (!estado.abiertas[v.carpeta]) {
    estado.abiertas[v.carpeta] = true
    guardar_preferencias()
  }
  poner_en_url(codigo)
  cargar_detalle(codigo)
  /* Al abrir el video se ven las respuestas nuevas: el aviso de ese video se va. */
  if (estado.respuestas_nuevas.length) {
    estado.respuestas_nuevas = estado.respuestas_nuevas.filter(function (r) {
      return r.codigo !== codigo
    })
  }
}

/**
 * Despliega o pliega una carpeta.
 *
 * @param {number} nro
 * @returns {void}
 */
export function alternar_carpeta(nro) {
  estado.abiertas[nro] = !estado.abiertas[nro]
  guardar_preferencias()
}

/**
 * Cambia la velocidad de reproducción (se recuerda para los próximos videos).
 *
 * @param {number} vel
 * @returns {void}
 */
export function elegir_velocidad(vel) {
  estado.vel = vel
  guardar_preferencias()
}

/**
 * Baja (o refresca) el detalle de un video: transcripción y preguntas visibles. Mientras
 * tanto se muestra lo que ya hubiera.
 *
 * Forma de la respuesta: el contrato dice "video + transcripción + preguntas visibles" sin fijar
 * el envoltorio, así que se aceptan `{video: {..., transcripcion}, preguntas: [...]}` y el plano
 * `{..., transcripcion, preguntas: [...]}`.
 *
 * @param {string} codigo
 * @returns {void}
 */
export function cargar_detalle(codigo) {
  /** Detalle previo, si hay. */
  const previo = estado.detalles[codigo]
  estado.detalles[codigo] = {
    transcripcion: previo ? previo.transcripcion : '',
    preguntas: previo ? previo.preguntas : [],
    cargando: true,
    error: false,
  }
  pedir('GET', 'recursos/videos/' + encodeURIComponent(codigo))
    .then(function (r) {
      /** Objeto del video dentro de la respuesta. */
      const v = r && r.video ? r.video : r || {}
      /** Preguntas, estén donde estén. */
      const preguntas = (r && Array.isArray(r.preguntas) && r.preguntas) || (Array.isArray(v.preguntas) && v.preguntas) || []
      estado.detalles[codigo] = {
        transcripcion: v.transcripcion || (r && r.transcripcion) || '',
        preguntas: preguntas,
        cargando: false,
        error: false,
      }
    })
    .catch(function () {
      estado.detalles[codigo].cargando = false
      estado.detalles[codigo].error = true
    })
}

/**
 * Baja el índice de transcripciones para el buscador, la primera vez que se escribe (§2, C2).
 *
 * @returns {void}
 */
export function cargar_indice() {
  if (estado.indice || estado.indice_cargando) {
    return
  }
  estado.indice_cargando = true
  pedir('GET', 'recursos/buscar-indice', undefined, { sin_sesion: true })
    .then(function (r) {
      /** Transcripciones normalizadas por código. */
      const indice = {}
      Object.keys(r || {}).forEach(function (codigo) {
        indice[codigo] = normalizar(r[codigo])
      })
      estado.indice = markRaw(indice)
    })
    .catch(function () {
      /* Sin índice se busca igual por título y "para qué". */
    })
    .then(function () {
      estado.indice_cargando = false
    })
}

/* ------------------------------------------------------------------ */
/* Progreso                                                            */
/* ------------------------------------------------------------------ */

/**
 * Entrada de progreso de un código, creándola si no existe.
 *
 * @param {string} codigo
 * @returns {Object}
 */
function progreso_o_nuevo(codigo) {
  if (!estado.progreso[codigo]) {
    estado.progreso[codigo] = { porcentaje: 0, posicion: 0, terminado: false, sesion_n: 0 }
  }
  return estado.progreso[codigo]
}

/**
 * Pendientes de un código, creándolos si no existen.
 *
 * @param {string} codigo
 * @returns {Object}
 */
function pendientes_de(codigo) {
  if (!pendientes[codigo]) {
    pendientes[codigo] = { tramos: [], abierto: null, posicion: 0 }
  }
  return pendientes[codigo]
}

/**
 * Si el video acaba de quedar terminado, lo festeja una sola vez y avisa si con él se
 * completó la carpeta (el toast del prototipo).
 *
 * @param {Object} video
 * @returns {void}
 */
function revisar_terminado(video) {
  if (es_solo_lectura() || ya_terminados[video.codigo] || !terminado(video)) {
    return
  }
  ya_terminados[video.codigo] = true
  /** Videos de su carpeta. */
  const hermanos = videos_de(video.carpeta)
  if (hermanos.every(terminado)) {
    /** Carpeta del video. */
    const c = carpeta_por_nro(video.carpeta)
    mostrar_toast('¡Terminaste la carpeta "' + (c ? c.nombre : video.carpeta) + '"!')
  }
}

/**
 * Registra un tramo reproducido de verdad, de `desde` a `hasta` (segundos del video). Lo llama
 * el reproductor solo cuando el video avanzó sin saltos (la regla de `registrar()` del
 * prototipo). Marca los segundos de esta visita y estira el tramo pendiente.
 *
 * Sin sesión no hace nada: el avance pide sesión (decisión 2 de Lucas). En modo soporte tampoco:
 * mirar un video no suma ni al avance local ni al del dueño.
 *
 * @param {Object} video
 * @param {number} desde
 * @param {number} hasta
 * @returns {void}
 */
export function registrar_tramo(video, desde, hasta) {
  if (!estado.usuario || es_solo_lectura() || !(hasta >= desde)) {
    return
  }
  /** Segundos del video. */
  const n = Math.max(1, Math.ceil(video.duracion || 0))
  if (!vistos_sesion[video.codigo]) {
    vistos_sesion[video.codigo] = new Uint8Array(n)
  }
  /** Mapa de segundos vistos en esta visita. */
  const vistos = vistos_sesion[video.codigo]
  /** Segundos nuevos que se marcaron ahora. */
  let nuevos = 0
  for (let s = Math.floor(desde); s <= Math.floor(hasta) && s < n; s++) {
    if (!vistos[s]) {
      vistos[s] = 1
      nuevos++
    }
  }
  /** Progreso del video. */
  const p = progreso_o_nuevo(video.codigo)
  if (nuevos) {
    p.sesion_n = (p.sesion_n || 0) + nuevos
  }

  /** Pendientes del video. */
  const pend = pendientes_de(video.codigo)
  if (pend.abierto && Math.abs(pend.abierto[1] - desde) < 0.001) {
    pend.abierto[1] = hasta
  } else {
    if (pend.abierto) {
      pend.tramos.push(pend.abierto)
    }
    pend.abierto = [desde, hasta]
  }
  pend.posicion = hasta

  revisar_terminado(video)
}

/**
 * Anota la posición actual del video (para "seguís en m:ss" y el "Seguís desde" de la próxima
 * vez). Lo reactivo se toca a lo sumo una vez por segundo.
 *
 * @param {Object} video
 * @param {number} posicion
 * @returns {void}
 */
export function anotar_posicion(video, posicion) {
  if (!estado.usuario || es_solo_lectura()) {
    return
  }
  pendientes_de(video.codigo).posicion = posicion
  /** Progreso del video. */
  const p = progreso_o_nuevo(video.codigo)
  if (Math.floor(p.posicion) !== Math.floor(posicion)) {
    p.posicion = posicion
  }
}

/**
 * Redondea a una décima.
 *
 * @param {number} x
 * @returns {number}
 */
function decima(x) {
  return Math.round(x * 10) / 10
}

/**
 * Deja los tramos como los valida el servidor (§3.4): dentro de `[0, duración]`, `desde <=
 * hasta`, ninguno de más de 30 s (los largos se parten en pedazos de 29,9) y redondeados a la
 * décima.
 *
 * @param {Array<Array<number>>} tramos
 * @param {number} duracion
 * @returns {Array<Array<number>>}
 */
function preparar_tramos(tramos, duracion) {
  /** Tramos listos para mandar. */
  const salida = []
  tramos.forEach(function (t) {
    /** Inicio acotado. */
    let desde = Math.max(0, t[0])
    /** Fin acotado. */
    const hasta = Math.min(duracion, t[1])
    while (hasta - desde > 0.05) {
      /** Fin de este pedazo. */
      const fin = Math.min(hasta, desde + MAX_SEGUNDOS_POR_TRAMO)
      /** Pedazo redondeado. */
      const a = decima(desde)
      const b = Math.min(decima(fin), decima(duracion))
      if (b >= a) {
        salida.push([a, b])
      }
      desde = fin
    }
  })
  return salida
}

/**
 * Manda el progreso pendiente de un video (`POST recursos/progreso`). Si falla, los tramos
 * vuelven a la cola y salen con el próximo envío (§5.1). Un 422 no se reintenta: esos tramos
 * no van a pasar nunca la validación.
 *
 * @param {string} codigo
 * @param {boolean} keepalive true al cerrar la pestaña (el pedido tiene que sobrevivir a la página).
 * @returns {void}
 */
function enviar_progreso_de(codigo, keepalive) {
  /** Pendientes del video. */
  const pend = pendientes[codigo]
  /** Video del catálogo. */
  const video = por_codigo[codigo]
  if (!pend || !video || (enviando[codigo] && !keepalive)) {
    return
  }
  if (pend.abierto) {
    pend.tramos.push(pend.abierto)
    pend.abierto = null
  }
  /** Tramos válidos para el servidor. */
  const listos = preparar_tramos(pend.tramos, video.duracion)
  if (!listos.length) {
    pend.tramos = []
    return
  }
  /** Lo que sale en este pedido. */
  const lote = listos.slice(0, MAX_TRAMOS_POR_PEDIDO)
  pend.tramos = listos.slice(MAX_TRAMOS_POR_PEDIDO)
  enviando[codigo] = true
  pedir(
    'POST',
    'recursos/progreso',
    { codigo: codigo, posicion: decima(Math.min(video.duracion, Math.max(0, pend.posicion || 0))), tramos: lote },
    { keepalive: keepalive }
  )
    .then(function (r) {
      if (!r || !estado.usuario) {
        return
      }
      /** Progreso del video. */
      const p = progreso_o_nuevo(codigo)
      p.porcentaje = Math.max(p.porcentaje || 0, Number(r.porcentaje) || 0)
      p.terminado = p.terminado || !!r.terminado
      revisar_terminado(video)
    })
    .catch(function (error) {
      if (error && error.status !== 401 && error.status !== 422 && !es_error_solo_lectura(error) && pendientes[codigo]) {
        pendientes[codigo].tramos = lote.concat(pendientes[codigo].tramos)
      }
    })
    .then(function () {
      enviando[codigo] = false
    })
}

/**
 * Manda el progreso pendiente de todos los videos. Lo llaman el timer de ~10 s, el reproductor
 * al pausar / terminar / cambiar de video, y la página al ocultarse o cerrarse.
 *
 * @param {{ keepalive?: boolean }} [opciones]
 * @returns {void}
 */
export function enviar_progreso(opciones) {
  if (!estado.usuario || es_solo_lectura() || !hay_sesion()) {
    return
  }
  /** Si el pedido tiene que sobrevivir al cierre de la pestaña. */
  const keepalive = !!(opciones && opciones.keepalive)
  Object.keys(pendientes).forEach(function (codigo) {
    enviar_progreso_de(codigo, keepalive)
  })
}

/* ------------------------------------------------------------------ */
/* Votos, encuesta y preguntas                                          */
/* ------------------------------------------------------------------ */

/**
 * 👍 / 👎 sobre un video. Tocar el mismo voto otra vez lo saca (valor 0, §2).
 *
 * @param {string} codigo
 * @param {1|-1} valor
 * @returns {number} El voto que quedó (1, -1 o 0).
 */
export function votar(codigo, valor) {
  /** Voto anterior (para volver atrás si falla). */
  const anterior = estado.votos[codigo] || 0
  if (es_solo_lectura()) {
    return anterior
  }
  /** Voto nuevo. */
  const nuevo = anterior === valor ? 0 : valor
  if (nuevo) {
    estado.votos[codigo] = nuevo
  } else {
    delete estado.votos[codigo]
  }
  pedir('POST', 'recursos/votos', { codigo: codigo, valor: nuevo }).catch(function (error) {
    if (error && error.status === 401) {
      return
    }
    if (anterior) {
      estado.votos[codigo] = anterior
    } else {
      delete estado.votos[codigo]
    }
    if (es_error_solo_lectura(error)) {
      return
    }
    mostrar_toast('No se pudo guardar tu voto. Probá de nuevo.')
  })
  return nuevo
}

/**
 * Manda la encuesta de un video (`POST recursos/encuestas`). Mandarla otra vez la actualiza.
 *
 * @param {string} codigo
 * @param {{ util: string|null, entendio: string|null, mejora: string|null }} respuestas
 * @returns {Promise<void>}
 */
export function enviar_encuesta(codigo, respuestas) {
  if (es_solo_lectura()) {
    return Promise.resolve()
  }
  return pedir('POST', 'recursos/encuestas', {
    codigo: codigo,
    util: respuestas.util || null,
    entendio: respuestas.entendio || null,
    mejora: respuestas.mejora || null,
  }).then(function () {
    estado.encuestas[codigo] = true
  })
}

/**
 * Publica una pregunta y la suma a la lista del video.
 *
 * @param {string} codigo
 * @param {string} texto
 * @returns {Promise<Object>} La pregunta creada.
 */
export function publicar_pregunta(codigo, texto) {
  if (es_solo_lectura()) {
    return Promise.resolve(null)
  }
  return pedir('POST', 'recursos/preguntas', { codigo: codigo, texto: texto }).then(function (r) {
    /** La pregunta creada (el contrato no fija si viene envuelta). */
    const pregunta = (r && r.pregunta) || r
    if (pregunta && pregunta.id != null && estado.detalles[codigo]) {
      estado.detalles[codigo].preguntas = estado.detalles[codigo].preguntas.concat([pregunta])
    }
    return pregunta
  })
}

/**
 * Alterna el "me gusta" de una pregunta. Se muestra al instante y se corrige con lo que
 * conteste el servidor (`{me_gusta, total}`).
 *
 * @param {Object} pregunta Objeto reactivo de la lista del detalle.
 * @returns {void}
 */
export function alternar_me_gusta(pregunta) {
  if (es_solo_lectura()) {
    return
  }
  /** Estado anterior, para volver atrás si falla. */
  const antes = { mio: !!pregunta.me_gusta_mio, total: Number(pregunta.me_gusta) || 0 }
  pregunta.me_gusta_mio = !antes.mio
  pregunta.me_gusta = antes.total + (antes.mio ? -1 : 1)
  pedir('POST', 'recursos/preguntas/' + encodeURIComponent(pregunta.id) + '/me-gusta', {})
    .then(function (r) {
      if (r && typeof r.me_gusta === 'boolean') {
        pregunta.me_gusta_mio = r.me_gusta
      }
      if (r && r.total != null) {
        pregunta.me_gusta = Number(r.total) || 0
      }
    })
    .catch(function (error) {
      pregunta.me_gusta_mio = antes.mio
      pregunta.me_gusta = antes.total
      if (!error || (error.status !== 401 && !es_error_solo_lectura(error))) {
        mostrar_toast('No se pudo guardar tu me gusta. Probá de nuevo.')
      }
    })
}
