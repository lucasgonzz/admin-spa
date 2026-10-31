/**
 * Utilidades de la Agenda (misión agenda-admin, 31/10/2026).
 *
 * Todo lo que es cálculo puro y lo comparten varios componentes de `components/agenda/`: fechas
 * (siempre como texto `YYYY-MM-DD`, que es lo que manda y recibe admin-api), horas (texto `HH:MM`
 * y minutos desde la medianoche), la paleta de colores de las tareas y el catálogo de íconos de
 * Bootstrap Icons agrupado por categoría. Sin Vue ni axios: así se puede razonar (y probar) solo.
 *
 * Por qué fechas como texto y no `Date`: un `Date` lleva hora y zona, y un `new Date('2026-10-31')`
 * se interpreta en UTC y en Argentina cae el 30 a las 21:00. Acá cada fecha se arma con el
 * constructor local `new Date(anio, mes, dia)` y se devuelve enseguida a texto.
 */

/** Nombres cortos de los días, empezando por el domingo (la semana arranca el domingo, como Structured). */
export const NOMBRES_DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Iniciales de los días para la vista de mes en teléfono. */
export const INICIALES_DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

/** Nombres completos de los meses (título "Octubre 2026"). */
export const NOMBRES_MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

/** Nombres cortos de los meses, en minúscula, para "Jue, 29 oct". */
export const NOMBRES_MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

/** Minutos de un día completo. */
export const MINUTOS_DIA = 1440

/** Duración por defecto de una tarea nueva, en minutos (la misma que el default de la API). */
export const DURACION_POR_DEFECTO = 15

/** Duraciones que se ofrecen en el selector de duración del panel, en minutos. */
export const DURACIONES = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480]

/** Duraciones rápidas (chips) debajo de la hora en el panel de una tarea con horario. */
export const DURACIONES_RAPIDAS = [15, 30, 45, 60, 90, 120]

/** Opciones de repetición: clave que entiende la API y rótulo en criollo. */
export const OPCIONES_REPETIR = [
  { clave: 'none', rotulo: 'Una vez' },
  { clave: 'daily', rotulo: 'Diaria' },
  { clave: 'weekly', rotulo: 'Semanal' },
  { clave: 'monthly', rotulo: 'Mensual' },
]

/**
 * Paleta de colores de las tareas: la clave es lo que guarda la API (`color`), el hex es el que se
 * pinta. Es la MISMA lista que valida admin-api; una clave fuera de acá le da 422.
 */
export const PALETA = [
  { clave: 'salmon', hex: '#f88e87', nombre: 'Salmón' },
  { clave: 'orange', hex: '#f5a05a', nombre: 'Naranja' },
  { clave: 'yellow', hex: '#f7c948', nombre: 'Amarillo' },
  { clave: 'green', hex: '#7cc35c', nombre: 'Verde' },
  { clave: 'sky', hex: '#7fb2e5', nombre: 'Celeste' },
  { clave: 'emerald', hex: '#2e9e6b', nombre: 'Esmeralda' },
  { clave: 'red', hex: '#e5534b', nombre: 'Rojo' },
  { clave: 'blue', hex: '#2f7fe0', nombre: 'Azul' },
  { clave: 'white', hex: '#f2f2f2', nombre: 'Blanco' },
]

/** Ícono por defecto de una tarea nueva (el mismo default que la API). */
export const ICONO_POR_DEFECTO = 'check2-square'

/** Color por defecto de una tarea nueva (el mismo default que la API). */
export const COLOR_POR_DEFECTO = 'salmon'

/**
 * Catálogo de íconos por categoría. Cada ícono es `[nombre de Bootstrap Icon sin "bi-", palabras
 * en castellano para el buscador]`. Los nombres se validaron contra el `bootstrap-icons.json`
 * 1.13.1 que trae el proyecto: si se agrega uno, tiene que existir ahí o se ve un hueco.
 */
export const CATEGORIAS_ICONOS = [
  {
    clave: 'trabajo',
    nombre: 'Trabajo',
    icono: 'briefcase',
    iconos: [
      ['check2-square', 'tarea hecha tilde'],
      ['briefcase', 'trabajo valija oficina'],
      ['clipboard-check', 'lista control revisar'],
      ['clipboard-data', 'datos informe reporte'],
      ['card-checklist', 'lista pasos checklist'],
      ['list-check', 'lista tareas pendientes'],
      ['list-task', 'lista tareas'],
      ['kanban', 'tablero kanban'],
      ['calendar-event', 'calendario evento fecha'],
      ['calendar-check', 'calendario turno cita'],
      ['alarm', 'alarma despertador'],
      ['clock', 'reloj hora'],
      ['hourglass-split', 'reloj arena espera'],
      ['stopwatch', 'cronometro tiempo'],
      ['flag', 'bandera objetivo meta'],
      ['pin-angle', 'pin fijar importante'],
      ['bookmark', 'marcador guardar'],
      ['journal-text', 'cuaderno notas diario'],
      ['file-earmark-text', 'archivo documento'],
      ['folder2-open', 'carpeta archivos'],
      ['paperclip', 'adjunto clip'],
      ['pencil', 'lapiz editar escribir'],
      ['pen', 'lapicera firmar'],
      ['lightbulb', 'idea foco'],
      ['rocket-takeoff', 'cohete lanzamiento'],
      ['trophy', 'trofeo logro'],
      ['award', 'premio medalla'],
      ['bullseye', 'objetivo blanco diana'],
      ['graph-up-arrow', 'grafico crecimiento'],
      ['bar-chart-line', 'grafico barras metricas'],
      ['pie-chart', 'grafico torta'],
      ['building', 'edificio empresa oficina'],
      ['person-workspace', 'escritorio puesto'],
      ['diagram-3', 'diagrama organigrama'],
      ['gear', 'configuracion ajustes'],
      ['tools', 'herramientas arreglar'],
      ['wrench-adjustable', 'llave arreglo'],
      ['hammer', 'martillo construir'],
      ['box-seam', 'caja paquete envio'],
      ['archive', 'archivo guardar'],
      ['printer', 'impresora imprimir'],
      ['megaphone', 'megafono anuncio marketing'],
    ],
  },
  {
    clave: 'tecnologia',
    nombre: 'Tecnología',
    icono: 'laptop',
    iconos: [
      ['laptop', 'notebook computadora'],
      ['display', 'monitor pantalla'],
      ['pc-display', 'pc computadora'],
      ['phone', 'celular telefono'],
      ['tablet', 'tablet'],
      ['keyboard', 'teclado'],
      ['mouse', 'mouse'],
      ['headset', 'auriculares soporte'],
      ['cpu', 'procesador cpu'],
      ['hdd-stack', 'disco servidor'],
      ['server', 'servidor vps'],
      ['database', 'base de datos'],
      ['cloud-upload', 'nube subir deploy'],
      ['cloud-download', 'nube bajar descargar'],
      ['cloud-check', 'nube ok'],
      ['wifi', 'wifi internet red'],
      ['router', 'router red'],
      ['plug', 'enchufe conectar integracion'],
      ['battery-charging', 'bateria cargar'],
      ['code-slash', 'codigo programar'],
      ['terminal', 'terminal consola'],
      ['braces', 'llaves codigo json'],
      ['git', 'git rama version'],
      ['github', 'github repositorio'],
      ['bug', 'bug error falla'],
      ['robot', 'robot bot agente ia'],
      ['stars', 'estrellas ia magia'],
      ['magic', 'varita magia automatico'],
      ['shield-lock', 'seguridad escudo'],
      ['key', 'llave clave contraseña'],
      ['lock', 'candado bloquear'],
      ['unlock', 'desbloquear abrir'],
      ['fingerprint', 'huella acceso'],
      ['qr-code', 'codigo qr'],
      ['upc-scan', 'codigo de barras escanear'],
      ['link-45deg', 'link enlace'],
      ['globe', 'web mundo internet'],
      ['window', 'ventana web'],
      ['puzzle', 'rompecabezas extension'],
      ['bricks', 'ladrillos construir'],
    ],
  },
  {
    clave: 'comunicacion',
    nombre: 'Comunicación',
    icono: 'chat-dots',
    iconos: [
      ['chat-dots', 'chat mensaje'],
      ['chat-left-text', 'chat conversacion'],
      ['chat-square-quote', 'cita comentario'],
      ['whatsapp', 'whatsapp mensaje'],
      ['envelope', 'mail correo email'],
      ['envelope-paper', 'carta correo'],
      ['envelope-open', 'mail abierto leido'],
      ['send', 'enviar mandar'],
      ['inbox', 'bandeja entrada'],
      ['telephone', 'telefono llamar'],
      ['telephone-outbound', 'llamada saliente'],
      ['telephone-inbound', 'llamada entrante'],
      ['phone-vibrate', 'celular vibrar'],
      ['mic', 'microfono audio'],
      ['camera-video', 'videollamada reunion meet'],
      ['broadcast', 'transmision en vivo'],
      ['bell', 'campana aviso notificacion'],
      ['at', 'arroba mail'],
      ['share', 'compartir'],
      ['reply', 'responder'],
      ['person', 'persona usuario'],
      ['person-plus', 'agregar persona alta'],
      ['person-check', 'persona confirmada'],
      ['people', 'personas equipo grupo'],
      ['person-hearts', 'persona querida cliente'],
      ['emoji-smile', 'cara feliz'],
      ['hand-thumbs-up', 'me gusta ok'],
      ['instagram', 'instagram redes'],
      ['facebook', 'facebook redes'],
      ['youtube', 'youtube video'],
      ['linkedin', 'linkedin redes'],
      ['tiktok', 'tiktok redes'],
      ['meta', 'meta anuncios'],
    ],
  },
  {
    clave: 'dinero',
    nombre: 'Dinero y ventas',
    icono: 'cash-coin',
    iconos: [
      ['cash-coin', 'plata dinero cobro'],
      ['cash-stack', 'efectivo billetes'],
      ['currency-dollar', 'dolar precio'],
      ['coin', 'moneda'],
      ['piggy-bank', 'ahorro chanchito'],
      ['wallet2', 'billetera'],
      ['credit-card', 'tarjeta pago'],
      ['bank', 'banco'],
      ['receipt', 'factura recibo comprobante'],
      ['receipt-cutoff', 'ticket comprobante'],
      ['calculator', 'calculadora cuenta'],
      ['percent', 'porcentaje descuento'],
      ['graph-down-arrow', 'baja caida'],
      ['cart', 'carrito compra'],
      ['cart-check', 'compra hecha'],
      ['bag', 'bolsa compra'],
      ['bag-check', 'pedido listo'],
      ['basket', 'canasta compras'],
      ['shop', 'negocio local tienda'],
      ['shop-window', 'vidriera tienda'],
      ['tag', 'etiqueta precio'],
      ['tags', 'etiquetas precios'],
      ['ticket-perforated', 'ticket entrada'],
      ['gift', 'regalo'],
      ['truck', 'camion envio entrega'],
      ['box2', 'caja deposito'],
      ['boxes', 'cajas stock inventario'],
      ['safe', 'caja fuerte'],
      ['file-earmark-spreadsheet', 'planilla excel'],
      ['clipboard2-data', 'datos ventas'],
    ],
  },
  {
    clave: 'casa',
    nombre: 'Casa',
    icono: 'house',
    iconos: [
      ['house', 'casa hogar'],
      ['house-heart', 'casa familia'],
      ['house-door', 'puerta casa'],
      ['house-gear', 'casa arreglo mantenimiento'],
      ['door-open', 'puerta abrir salir'],
      ['lamp', 'lampara luz'],
      ['lightning-charge', 'luz electricidad'],
      ['droplet', 'agua gota'],
      ['fire', 'fuego gas'],
      ['thermometer-half', 'temperatura calefaccion'],
      ['snow', 'aire frio'],
      ['fan', 'ventilador'],
      ['outlet', 'enchufe toma'],
      ['trash', 'basura tacho'],
      ['recycle', 'reciclar'],
      ['bucket', 'balde limpiar'],
      ['brush', 'pincel pintar'],
      ['paint-bucket', 'pintura'],
      ['scissors', 'tijera cortar'],
      ['flower1', 'flor plantas'],
      ['flower2', 'flor jardin'],
      ['tree', 'arbol jardin'],
      ['sun', 'sol dia'],
      ['moon', 'luna noche'],
      ['cloud-sun', 'clima tiempo'],
      ['umbrella', 'paraguas lluvia'],
      ['basket2', 'canasto ropa'],
      ['key-fill', 'llave casa'],
    ],
  },
  {
    clave: 'salud',
    nombre: 'Salud y deporte',
    icono: 'heart-pulse',
    iconos: [
      ['heart', 'corazon amor'],
      ['heart-pulse', 'salud pulso'],
      ['activity', 'actividad ritmo'],
      ['capsule', 'pastilla remedio'],
      ['capsule-pill', 'medicamento'],
      ['bandaid', 'curita'],
      ['hospital', 'hospital medico'],
      ['prescription2', 'receta'],
      ['thermometer', 'fiebre termometro'],
      ['lungs', 'pulmones respirar'],
      ['eye', 'ojo vista'],
      ['eyeglasses', 'anteojos'],
      ['ear', 'oido'],
      ['person-walking', 'caminar'],
      ['person-arms-up', 'gimnasio ejercicio'],
      ['bicycle', 'bici bicicleta'],
      ['dribbble', 'pelota deporte'],
      ['apple', 'manzana dieta'],
      ['cup-straw', 'jugo bebida'],
      ['moon-stars', 'dormir sueño'],
      ['sunrise', 'amanecer mañana'],
      ['clipboard2-pulse', 'chequeo medico estudio'],
      ['universal-access', 'accesibilidad'],
      ['yin-yang', 'meditar calma'],
    ],
  },
  {
    clave: 'estudio',
    nombre: 'Estudio',
    icono: 'mortarboard',
    iconos: [
      ['mortarboard', 'estudio graduacion curso'],
      ['book', 'libro leer'],
      ['book-half', 'libro lectura'],
      ['journal-bookmark', 'cuaderno apuntes'],
      ['journal-richtext', 'apuntes'],
      ['bookmark-star', 'favorito'],
      ['pencil-square', 'escribir redactar'],
      ['highlighter', 'resaltador subrayar'],
      ['translate', 'idioma traducir ingles'],
      ['globe2', 'mundo geografia'],
      ['easel', 'pizarra clase'],
      ['easel2', 'presentacion'],
      ['backpack', 'mochila escuela'],
      ['backpack2', 'mochila'],
      ['file-earmark-pdf', 'pdf documento'],
      ['file-earmark-play', 'video archivo'],
      ['collection-play', 'videos tutoriales'],
      ['play-btn', 'video play tutorial'],
      ['headphones', 'auriculares escuchar'],
      ['rulers', 'regla medir'],
      ['vector-pen', 'diseño pluma'],
      ['calendar3', 'cursada calendario'],
    ],
  },
  {
    clave: 'viajes',
    nombre: 'Viajes y traslados',
    icono: 'airplane',
    iconos: [
      ['airplane', 'avion viaje vuelo'],
      ['airplane-engines', 'avion'],
      ['suitcase', 'valija viaje'],
      ['suitcase-lg', 'valija grande'],
      ['luggage', 'equipaje'],
      ['car-front', 'auto coche'],
      ['car-front-fill', 'auto'],
      ['taxi-front', 'taxi remis'],
      ['bus-front', 'colectivo bus'],
      ['train-front', 'tren'],
      ['truck-front', 'camion flete'],
      ['fuel-pump', 'nafta combustible'],
      ['ev-station', 'carga electrica'],
      ['scooter', 'moto scooter'],
      ['signpost', 'cartel direccion'],
      ['signpost-split', 'camino decision'],
      ['sign-turn-right', 'girar ruta'],
      ['geo-alt', 'ubicacion lugar direccion'],
      ['pin-map', 'mapa ubicacion'],
      ['map', 'mapa'],
      ['compass', 'brujula orientacion'],
      ['globe-americas', 'america mundo'],
      ['buildings', 'ciudad edificios'],
      ['sunset', 'atardecer'],
      ['passport', 'pasaporte tramite'],
      ['ticket', 'pasaje boleto'],
    ],
  },
  {
    clave: 'ocio',
    nombre: 'Ocio',
    icono: 'controller',
    iconos: [
      ['controller', 'juego joystick'],
      ['joystick', 'juego'],
      ['dice-5', 'dado juego'],
      ['music-note-beamed', 'musica'],
      ['music-note-list', 'playlist musica'],
      ['film', 'pelicula cine'],
      ['camera', 'foto camara'],
      ['camera-reels', 'filmar video reel'],
      ['tv', 'tele television serie'],
      ['palette', 'paleta arte color'],
      ['balloon', 'globo fiesta'],
      ['balloon-heart', 'cumpleaños festejo'],
      ['cake2', 'torta cumpleaños'],
      ['emoji-laughing', 'risa diversion'],
      ['emoji-sunglasses', 'vacaciones relax'],
      ['star', 'estrella favorito'],
      ['suit-heart', 'corazon carta'],
      ['water', 'agua mar pileta'],
      ['snow2', 'nieve invierno'],
      ['spotify', 'spotify musica'],
      ['twitch', 'twitch stream'],
      ['discord', 'discord'],
    ],
  },
  {
    clave: 'comida',
    nombre: 'Comida',
    icono: 'cup-hot',
    iconos: [
      ['cup-hot', 'cafe te mate'],
      ['cup', 'taza'],
      ['egg-fried', 'desayuno huevo'],
      ['egg', 'huevo'],
      ['cake', 'torta postre'],
      ['cookie', 'galletita'],
      ['fork-knife', 'comida almuerzo cena restaurante'],
      ['basket3', 'canasta super'],
      ['cart3', 'super mercado compras'],
      ['bag-heart', 'compras'],
      ['cup-hot-fill', 'cafe'],
      ['droplet-half', 'bebida'],
    ],
  },
]

/**
 * Agrega un cero adelante a un número de una cifra.
 *
 * @param {number} numero
 * @returns {string} "07", "12"…
 */
export function dos_digitos(numero) {
  const texto = String(numero)
  return texto.length === 1 ? '0' + texto : texto
}

/**
 * Convierte un `Date` local a texto `YYYY-MM-DD`.
 *
 * @param {Date} fecha
 * @returns {string}
 */
export function fecha_a_texto(fecha) {
  return (
    fecha.getFullYear() + '-' + dos_digitos(fecha.getMonth() + 1) + '-' + dos_digitos(fecha.getDate())
  )
}

/**
 * Convierte texto `YYYY-MM-DD` a un `Date` local a las 00:00 (o null si no es una fecha).
 *
 * @param {string|null|undefined} texto
 * @returns {Date|null}
 */
export function texto_a_fecha(texto) {
  if (!texto || typeof texto !== 'string') {
    return null
  }
  const partes = texto.substring(0, 10).split('-')
  if (partes.length !== 3) {
    return null
  }
  const anio = parseInt(partes[0], 10)
  const mes = parseInt(partes[1], 10)
  const dia = parseInt(partes[2], 10)
  if (isNaN(anio) || isNaN(mes) || isNaN(dia)) {
    return null
  }
  return new Date(anio, mes - 1, dia)
}

/**
 * Fecha de hoy según el reloj del navegador.
 *
 * @returns {string} `YYYY-MM-DD`
 */
export function hoy_texto() {
  return fecha_a_texto(new Date())
}

/**
 * Suma (o resta) días a una fecha.
 *
 * @param {string} texto Fecha base `YYYY-MM-DD`.
 * @param {number} dias Días a sumar (negativo para restar).
 * @returns {string}
 */
export function sumar_dias(texto, dias) {
  const fecha = texto_a_fecha(texto)
  if (!fecha) {
    return texto
  }
  fecha.setDate(fecha.getDate() + dias)
  return fecha_a_texto(fecha)
}

/**
 * Días entre dos fechas (`hasta - desde`). Se calcula en UTC para que el cambio de horario de
 * verano (si alguna vez vuelve) no deje un día de 23 horas que redondee mal.
 *
 * @param {string} desde
 * @param {string} hasta
 * @returns {number}
 */
export function diferencia_dias(desde, hasta) {
  const a = texto_a_fecha(desde)
  const b = texto_a_fecha(hasta)
  if (!a || !b) {
    return 0
  }
  const utc_a = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utc_b = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utc_b - utc_a) / 86400000)
}

/**
 * Día de la semana de una fecha (0 = domingo).
 *
 * @param {string} texto
 * @returns {number}
 */
export function dia_semana(texto) {
  const fecha = texto_a_fecha(texto)
  return fecha ? fecha.getDay() : 0
}

/**
 * Domingo de la semana de una fecha (la semana arranca el domingo, como en Structured).
 *
 * @param {string} texto
 * @returns {string}
 */
export function inicio_semana(texto) {
  return sumar_dias(texto, -dia_semana(texto))
}

/**
 * Lista de fechas consecutivas.
 *
 * @param {string} desde Primera fecha.
 * @param {number} cantidad Cuántas fechas.
 * @returns {string[]}
 */
export function dias_desde(desde, cantidad) {
  const dias = []
  for (let i = 0; i < cantidad; i++) {
    dias.push(sumar_dias(desde, i))
  }
  return dias
}

/**
 * Primer día del mes de una fecha.
 *
 * @param {string} texto
 * @returns {string}
 */
export function primer_dia_mes(texto) {
  return texto.substring(0, 8) + '01'
}

/**
 * Primer día del mes que queda `meses` meses después (o antes) del mes de una fecha.
 *
 * @param {string} texto
 * @param {number} meses
 * @returns {string}
 */
export function sumar_meses(texto, meses) {
  const fecha = texto_a_fecha(primer_dia_mes(texto))
  if (!fecha) {
    return texto
  }
  fecha.setMonth(fecha.getMonth() + meses)
  return fecha_a_texto(fecha)
}

/**
 * Las 42 fechas (6 semanas, de domingo a sábado) de la grilla del mes de una fecha.
 *
 * @param {string} texto Cualquier fecha del mes.
 * @returns {string[]}
 */
export function grilla_mes(texto) {
  return dias_desde(inicio_semana(primer_dia_mes(texto)), 42)
}

/**
 * Indica si dos fechas caen en el mismo mes.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function mismo_mes(a, b) {
  return !!a && !!b && a.substring(0, 7) === b.substring(0, 7)
}

/**
 * Número del día del mes de una fecha ("29").
 *
 * @param {string} texto
 * @returns {number}
 */
export function numero_dia(texto) {
  return parseInt(String(texto).substring(8, 10), 10)
}

/**
 * Nombre corto del día de la semana ("Jue").
 *
 * @param {string} texto
 * @returns {string}
 */
export function nombre_dia_corto(texto) {
  return NOMBRES_DIAS_CORTOS[dia_semana(texto)]
}

/**
 * Fecha corta como la escribe el panel: "Jue, 29 oct" (y el año si no es el de hoy).
 *
 * @param {string} texto
 * @param {string} [hoy] Fecha de hoy, para decidir si se muestra el año.
 * @returns {string}
 */
export function fecha_corta(texto, hoy) {
  const fecha = texto_a_fecha(texto)
  if (!fecha) {
    return ''
  }
  let resultado =
    NOMBRES_DIAS_CORTOS[fecha.getDay()] +
    ', ' +
    fecha.getDate() +
    ' ' +
    NOMBRES_MESES_CORTOS[fecha.getMonth()]
  if (hoy && texto.substring(0, 4) !== hoy.substring(0, 4)) {
    resultado = resultado + ' ' + fecha.getFullYear()
  }
  return resultado
}

/**
 * Minutos desde la medianoche de una hora `HH:MM` (acepta `HH:MM:SS`).
 *
 * @param {string|null|undefined} hora
 * @returns {number|null}
 */
export function minutos_de_hora(hora) {
  if (!hora || typeof hora !== 'string') {
    return null
  }
  const partes = hora.split(':')
  if (partes.length < 2) {
    return null
  }
  const hh = parseInt(partes[0], 10)
  const mm = parseInt(partes[1], 10)
  if (isNaN(hh) || isNaN(mm)) {
    return null
  }
  return hh * 60 + mm
}

/**
 * Hora `HH:MM` de una cantidad de minutos desde la medianoche. Pasada la medianoche da la vuelta
 * ("24:15" se escribe "00:15", igual que el `end_time` de la API).
 *
 * @param {number} minutos
 * @returns {string}
 */
export function hora_de_minutos(minutos) {
  let normalizados = Math.round(minutos) % MINUTOS_DIA
  if (normalizados < 0) {
    normalizados = normalizados + MINUTOS_DIA
  }
  return dos_digitos(Math.floor(normalizados / 60)) + ':' + dos_digitos(normalizados % 60)
}

/**
 * Duración en palabras: "15 min", "1 h", "1 h 30 min".
 *
 * @param {number} minutos
 * @returns {string}
 */
export function texto_duracion(minutos) {
  const total = parseInt(minutos, 10) || 0
  if (total < 60) {
    return total + ' min'
  }
  const horas = Math.floor(total / 60)
  const resto = total % 60
  return resto === 0 ? horas + ' h' : horas + ' h ' + resto + ' min'
}

/**
 * Duración compacta para los chips: "15m", "1h", "1h 30m".
 *
 * @param {number} minutos
 * @returns {string}
 */
export function texto_duracion_corta(minutos) {
  const total = parseInt(minutos, 10) || 0
  if (total < 60) {
    return total + 'm'
  }
  const horas = Math.floor(total / 60)
  const resto = total % 60
  return resto === 0 ? horas + 'h' : horas + 'h ' + resto + 'm'
}

/**
 * Hora de inicio de una tarea en minutos (null si es de todo el día o está en la bandeja).
 *
 * @param {Object} tarea Tarea con la forma de la API.
 * @returns {number|null}
 */
export function inicio_de(tarea) {
  if (!tarea || tarea.all_day || !tarea.start_time) {
    return null
  }
  return minutos_de_hora(tarea.start_time)
}

/**
 * Hora de fin de una tarea en minutos desde la medianoche de SU día (puede pasar de 1440 si
 * termina al día siguiente). Null si no tiene horario.
 *
 * @param {Object} tarea
 * @returns {number|null}
 */
export function fin_de(tarea) {
  const inicio = inicio_de(tarea)
  if (inicio === null) {
    return null
  }
  return inicio + (parseInt(tarea.duration_minutes, 10) || DURACION_POR_DEFECTO)
}

/**
 * Rango horario como lo muestra la línea de tiempo: "10:30 - 10:45 (15 min)". Para una de todo
 * el día devuelve "Todo el día" y para una de la bandeja solo la duración.
 *
 * @param {Object} tarea
 * @returns {string}
 */
export function texto_horario(tarea) {
  if (!tarea) {
    return ''
  }
  const duracion = parseInt(tarea.duration_minutes, 10) || DURACION_POR_DEFECTO
  if (!tarea.date && !tarea.occurrence_date) {
    return texto_duracion(duracion)
  }
  if (tarea.all_day || !tarea.start_time) {
    return 'Todo el día'
  }
  const inicio = minutos_de_hora(tarea.start_time)
  return (
    hora_de_minutos(inicio) +
    ' - ' +
    hora_de_minutos(inicio + duracion) +
    ' (' +
    texto_duracion(duracion) +
    ')'
  )
}

/**
 * Redondea minutos hacia arriba al cuarto de hora siguiente (10:07 → 10:15).
 *
 * @param {number} minutos
 * @returns {number}
 */
export function redondear_a_cuarto(minutos) {
  return Math.ceil(minutos / 15) * 15
}

/**
 * Clave única de una ocurrencia (una tarea repetida aparece varias veces con el mismo id).
 *
 * @param {Object} tarea
 * @returns {string}
 */
export function clave_ocurrencia(tarea) {
  return String(tarea.id) + '|' + (tarea.occurrence_date || tarea.date || 'bandeja')
}

/**
 * Clave con la que se guarda una tarea en la selección múltiple. Una tarea simple se elige por id
 * (así sigue elegida aunque cambie de fecha); una repetida, por ocurrencia, porque marcar hecha
 * es por ocurrencia.
 *
 * @param {Object} tarea
 * @returns {string}
 */
export function clave_seleccion(tarea) {
  if (tarea.is_recurring && tarea.occurrence_date) {
    return String(tarea.id) + '|' + tarea.occurrence_date
  }
  return String(tarea.id)
}

/**
 * Ordena ocurrencias como la API: por fecha, todo-el-día primero, después hora, después id.
 * Devuelve una copia.
 *
 * @param {Object[]} lista
 * @returns {Object[]}
 */
export function ordenar_ocurrencias(lista) {
  return lista.slice().sort(function (a, b) {
    const fecha_a = a.occurrence_date || a.date || ''
    const fecha_b = b.occurrence_date || b.date || ''
    if (fecha_a !== fecha_b) {
      return fecha_a < fecha_b ? -1 : 1
    }
    const todo_a = a.all_day || !a.start_time ? 0 : 1
    const todo_b = b.all_day || !b.start_time ? 0 : 1
    if (todo_a !== todo_b) {
      return todo_a - todo_b
    }
    const inicio_a = inicio_de(a) || 0
    const inicio_b = inicio_de(b) || 0
    if (inicio_a !== inicio_b) {
      return inicio_a - inicio_b
    }
    return a.id - b.id
  })
}

/**
 * Hex de una clave de la paleta (salmón si la clave no existe, para no pintar nada de negro).
 *
 * @param {string} clave
 * @returns {string}
 */
export function color_hex(clave) {
  let hex = PALETA[0].hex
  PALETA.forEach(function (color) {
    if (color.clave === clave) {
      hex = color.hex
    }
  })
  return hex
}

/**
 * Oscurece un color hex multiplicando cada canal (la cabecera del panel usa el color un poco más
 * apagado, como en Structured).
 *
 * @param {string} hex `#rrggbb`
 * @param {number} factor 0..1 (0.85 = 15 % más oscuro)
 * @returns {string} `rgb(r, g, b)`
 */
export function oscurecer(hex, factor) {
  const canales = canales_de(hex)
  return (
    'rgb(' +
    Math.round(canales[0] * factor) +
    ', ' +
    Math.round(canales[1] * factor) +
    ', ' +
    Math.round(canales[2] * factor) +
    ')'
  )
}

/**
 * Color hex con transparencia.
 *
 * @param {string} hex `#rrggbb`
 * @param {number} alfa 0..1
 * @returns {string} `rgba(r, g, b, a)`
 */
export function con_alfa(hex, alfa) {
  const canales = canales_de(hex)
  return 'rgba(' + canales[0] + ', ' + canales[1] + ', ' + canales[2] + ', ' + alfa + ')'
}

/**
 * Indica si sobre un color conviene texto/ícono oscuro (el blanco y el amarillo de la paleta).
 *
 * @param {string} hex
 * @returns {boolean}
 */
export function es_color_claro(hex) {
  const canales = canales_de(hex)
  const luminancia = (0.299 * canales[0] + 0.587 * canales[1] + 0.114 * canales[2]) / 255
  return luminancia > 0.72
}

/**
 * Separa un hex `#rrggbb` en sus tres canales.
 *
 * @param {string} hex
 * @returns {number[]} [r, g, b]
 */
function canales_de(hex) {
  const limpio = String(hex || '').replace('#', '')
  if (limpio.length !== 6) {
    return [248, 142, 135]
  }
  return [
    parseInt(limpio.substring(0, 2), 16),
    parseInt(limpio.substring(2, 4), 16),
    parseInt(limpio.substring(4, 6), 16),
  ]
}

/**
 * Pasa un texto a minúsculas y sin tildes, para buscar sin que importe cómo se escribió.
 *
 * @param {string} texto
 * @returns {string}
 */
export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Busca íconos del catálogo por nombre (inglés, el de Bootstrap) o por las palabras en castellano.
 * Sin repetidos y con tope, para que la grilla no se haga eterna.
 *
 * @param {string} texto
 * @returns {string[]} Nombres de íconos.
 */
export function buscar_iconos(texto) {
  const buscado = normalizar(texto)
  const encontrados = []
  if (buscado === '') {
    return encontrados
  }
  CATEGORIAS_ICONOS.forEach(function (categoria) {
    const categoria_coincide = normalizar(categoria.nombre).indexOf(buscado) !== -1
    categoria.iconos.forEach(function (icono) {
      const nombre = icono[0]
      const palabras = normalizar(icono[1])
      const coincide =
        categoria_coincide || nombre.indexOf(buscado) !== -1 || palabras.indexOf(buscado) !== -1
      if (coincide && encontrados.indexOf(nombre) === -1) {
        encontrados.push(nombre)
      }
    })
  })
  return encontrados.slice(0, 120)
}

/**
 * Normaliza un texto de búsqueda de la API a número o null (para leer ids y cantidades sueltas).
 *
 * @param {*} valor
 * @returns {number|null}
 */
export function numero_o_null(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return null
  }
  const numero = parseInt(valor, 10)
  return isNaN(numero) ? null : numero
}
