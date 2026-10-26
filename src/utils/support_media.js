/*
  Utilidades de multimedia de la conversación de soporte (JS puro, sin Vue y sin async/await).

  Qué resuelve: decidir QUÉ es un adjunto (imagen, audio, video o archivo) y DE DÓNDE se lo pide
  el navegador, de forma que la pantalla ande igual con la API nueva y con la vieja.

  - El tipo NO se puede sacar solo de `message.kind`: en mensajes viejos el kind no es confiable
    (un video guardado como `file`, una nota de voz como `text`). Por eso se decide por, en este
    orden: mime del adjunto -> extensión del nombre -> kind del mensaje.
  - La API nueva agrega a cada adjunto `public_url`, `download_url`, `playback_url` (solo audio)
    y `display_filename`. Con una API vieja esos campos NO vienen: el SPA cae a `/storage/<path>`,
    que es lo que se usaba antes.

  Se prueba con `node pruebas/support-media.cjs`, que extrae las funciones de ESTE archivo.
*/

/* Mimes que no dicen nada sobre el contenido: se mira la extensión cuando aparecen. */
const GENERIC_MIMES = ['application/octet-stream', 'binary/octet-stream', 'application/x-binary', 'application/unknown']

/* Extensiones por tipo de media. */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'bmp', 'avif']
const AUDIO_EXTENSIONS = ['ogg', 'oga', 'opus', 'mp3', 'm4a', 'aac', 'amr', 'wav', 'weba', 'mpga', '3ga']
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', '3gp', '3gpp', 'mkv', 'avi']

/* Contenedores que se declaran como video pero cuando el mensaje es de audio son audio solo. */
const AMBIGUOUS_VIDEO_MIMES = ['video/webm', 'video/mp4', 'video/ogg', 'video/3gpp']

/* Extensiones de audio que Safari/iOS reproduce de siempre: no necesitan la versión transcodificada. */
const SAFARI_SAFE_AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'mp4', 'wav']

/**
 * Normaliza un mime: minúsculas y sin parámetros (`audio/ogg; codecs=opus` -> `audio/ogg`).
 *
 * @param {string|null|undefined} mime Mime tal como lo guardó o lo mandó el origen.
 * @returns {string} Mime normalizado o cadena vacía.
 */
export function normalize_mime(mime) {
  if (!mime) {
    return ''
  }
  return String(mime).split(';')[0].trim().toLowerCase()
}

/**
 * Extensión (sin punto y en minúsculas) de un nombre o ruta. Ignora query string y fragmento.
 *
 * @param {string|null|undefined} name Nombre de archivo, ruta o URL.
 * @returns {string} Extensión o cadena vacía si no tiene.
 */
export function extension_of(name) {
  if (!name) {
    return ''
  }
  const clean = String(name).split('#')[0].split('?')[0]
  const last_segment = clean.split('/').pop()
  const dot_index = last_segment.lastIndexOf('.')
  if (dot_index < 0 || dot_index === last_segment.length - 1) {
    return ''
  }
  return last_segment.substring(dot_index + 1).toLowerCase()
}

/**
 * Traduce un mime ya normalizado a tipo de media.
 *
 * @param {string} mime Mime normalizado.
 * @returns {string|null} 'image' | 'audio' | 'video' | 'file', o null si el mime no alcanza para decidir.
 */
function type_from_mime(mime) {
  if (!mime || GENERIC_MIMES.indexOf(mime) !== -1) {
    return null
  }
  if (mime.indexOf('image/') === 0) {
    return 'image'
  }
  if (mime.indexOf('audio/') === 0 || mime === 'application/ogg') {
    return 'audio'
  }
  if (mime.indexOf('video/') === 0) {
    return 'video'
  }
  // Mime conocido y que no es multimedia (pdf, office, zip, texto...).
  return 'file'
}

/**
 * Traduce una extensión a tipo de media.
 *
 * @param {string} extension Extensión sin punto, en minúsculas.
 * @returns {string|null} 'image' | 'audio' | 'video', o null si no es una extensión multimedia conocida.
 */
function type_from_extension(extension) {
  if (!extension) {
    return null
  }
  if (IMAGE_EXTENSIONS.indexOf(extension) !== -1) {
    return 'image'
  }
  if (AUDIO_EXTENSIONS.indexOf(extension) !== -1) {
    return 'audio'
  }
  if (VIDEO_EXTENSIONS.indexOf(extension) !== -1) {
    return 'video'
  }
  return null
}

/**
 * Traduce el `kind` del mensaje a tipo de media.
 *
 * @param {string|null|undefined} kind Kind del mensaje (text|image|audio|video|document|sticker|file|ptt|voice...).
 * @returns {string|null} 'image' | 'audio' | 'video' | 'file', o null si el kind no es multimedia.
 */
function type_from_kind(kind) {
  const value = String(kind || '').toLowerCase()
  if (value === 'image' || value === 'sticker') {
    return 'image'
  }
  if (value === 'audio' || value === 'ptt' || value === 'voice') {
    return 'audio'
  }
  if (value === 'video') {
    return 'video'
  }
  if (value === 'document' || value === 'file') {
    return 'file'
  }
  return null
}

/**
 * Decide qué clase de media es un adjunto de un mensaje de soporte.
 *
 * Orden: mime del adjunto (sin parámetros) -> extensión del nombre o de la ruta -> kind del mensaje.
 * Un mime genérico (octet-stream) o ausente deja pasar a la extensión. Caso especial: un contenedor
 * que se declara como video (webm, mp4, ogg, 3gpp) en un mensaje cuyo kind dice audio es una nota de
 * voz, no un video (los grabadores de navegador y WhatsApp lo etiquetan así).
 *
 * @param {Object|null} message Mensaje de soporte (se usa su `kind`).
 * @param {Object|null} attachment Adjunto (se usan `mime`, `display_filename` y `path`).
 * @returns {string} 'image' | 'audio' | 'video' | 'file'
 */
export function media_type_of(message, attachment) {
  const kind_type = type_from_kind(message && message.kind)
  const mime = normalize_mime(attachment && attachment.mime)

  const mime_type = type_from_mime(mime)
  if (mime_type) {
    if (mime_type === 'video' && kind_type === 'audio' && AMBIGUOUS_VIDEO_MIMES.indexOf(mime) !== -1) {
      return 'audio'
    }
    return mime_type
  }

  const name_extension = extension_of(attachment && attachment.display_filename)
  const path_extension = extension_of(attachment && attachment.path)
  const extension_type = type_from_extension(name_extension) || type_from_extension(path_extension)
  if (extension_type) {
    if (extension_type === 'video' && kind_type === 'audio' && (name_extension === 'webm' || path_extension === 'webm')) {
      return 'audio'
    }
    return extension_type
  }

  return kind_type || 'file'
}

/**
 * Origen del backend para armar URLs de /storage: VITE_BACKEND_BASE_URL o, si no está, VITE_API_URL
 * sin el sufijo /api/admin. No se usa el origen del dev server (Vite): sin base correcta el
 * navegador recibe index.html (text/html) en vez del archivo.
 *
 * @returns {string} Base sin barra final (puede ser cadena vacía).
 */
function backend_base_url() {
  let base_url = import.meta.env.VITE_BACKEND_BASE_URL || ''
  if (!base_url) {
    const api_url = import.meta.env.VITE_API_URL || ''
    if (api_url) {
      base_url = api_url.replace(/\/api\/admin\/?$/i, '')
    }
  }
  return base_url.replace(/\/$/, '')
}

/**
 * URL de /storage del adjunto: es lo que se usaba antes de la ruta firmada y queda de respaldo.
 *
 * @param {Object|null} attachment Adjunto con `path` relativo al disco public.
 * @returns {string} URL o cadena vacía si el adjunto no tiene path.
 */
function storage_url(attachment) {
  if (!attachment || !attachment.path) {
    return ''
  }
  return backend_base_url() + '/storage/' + attachment.path
}

/**
 * URL para MOSTRAR el adjunto inline (miniatura, <audio>, <video>, visor).
 *
 * @param {Object|null} attachment Adjunto del mensaje.
 * @returns {string} `public_url` firmada si la API la mandó; si no, /storage/<path>.
 */
export function attachment_open_url(attachment) {
  if (attachment && attachment.public_url) {
    return attachment.public_url
  }
  return storage_url(attachment)
}

/**
 * URL para DESCARGAR el adjunto (Content-Disposition: attachment).
 *
 * @param {Object|null} attachment Adjunto del mensaje.
 * @returns {string} `download_url` si la API la mandó; si no, la URL de apertura.
 */
export function attachment_download_url(attachment) {
  if (attachment && attachment.download_url) {
    return attachment.download_url
  }
  return attachment_open_url(attachment)
}

/**
 * URL de reproducción compatible con Safari/iOS (audio transcodificado a AAC), solo si la API la dio.
 *
 * @param {Object|null} attachment Adjunto del mensaje.
 * @returns {string|null} `playback_url` o null si no hay.
 */
export function attachment_playback_url(attachment) {
  if (attachment && attachment.playback_url) {
    return attachment.playback_url
  }
  return null
}

/**
 * Nombre legible del adjunto para mostrar y para el atributo `download`.
 *
 * @param {Object|null} attachment Adjunto del mensaje.
 * @returns {string} `display_filename`, o el basename del path, o 'Archivo'.
 */
export function attachment_display_name(attachment) {
  if (attachment && attachment.display_filename) {
    return String(attachment.display_filename)
  }
  if (attachment && attachment.path) {
    const base_name = String(attachment.path).split('/').pop()
    if (base_name) {
      return base_name
    }
  }
  return 'Archivo'
}

/**
 * Indica si el navegador reproduce Ogg/Opus de forma nativa. Safari/iOS viejos devuelven ''.
 * Fuera de un navegador (por ejemplo en la prueba de node) se asume que sí.
 *
 * @returns {boolean}
 */
export function browser_can_play_ogg_opus() {
  if (typeof document === 'undefined' || !document.createElement) {
    return true
  }
  try {
    return document.createElement('audio').canPlayType('audio/ogg; codecs=opus') !== ''
  } catch (e) {
    return true
  }
}

/**
 * URL que debe cargar el reproductor de audio.
 *
 * Usa la versión de reproducción (`playback_url`) solo cuando el navegador NO puede con Ogg/Opus y el
 * adjunto no es de un formato que Safari ya reproduce (mp3, m4a, aac, mp4, wav). En el resto de los
 * casos, la URL de apertura normal.
 *
 * @param {Object|null} attachment Adjunto de audio.
 * @param {boolean} can_play_ogg_opus Resultado de browser_can_play_ogg_opus() (se pasa para poder probarlo).
 * @returns {string}
 */
export function attachment_audio_src(attachment, can_play_ogg_opus) {
  const playback_url = attachment_playback_url(attachment)
  if (can_play_ogg_opus || !playback_url) {
    return attachment_open_url(attachment)
  }
  const extension = extension_of(attachment && attachment.display_filename) || extension_of(attachment && attachment.path)
  const mime = normalize_mime(attachment && attachment.mime)
  const is_safari_safe = SAFARI_SAFE_AUDIO_EXTENSIONS.indexOf(extension) !== -1 ||
    mime === 'audio/mpeg' || mime === 'audio/mp4' || mime === 'audio/aac' || mime === 'audio/x-m4a'
  return is_safari_safe ? attachment_open_url(attachment) : playback_url
}

/**
 * Clase de ícono Bootstrap (con color) para una tarjeta de archivo.
 *
 * @param {Object|null} attachment Adjunto del mensaje.
 * @returns {string} Clases `bi-...` y de color.
 */
export function attachment_icon_class(attachment) {
  const mime = normalize_mime(attachment && attachment.mime)
  const extension = extension_of(attachment && attachment.display_filename) || extension_of(attachment && attachment.path)

  if (extension === 'pdf' || mime.indexOf('pdf') >= 0) {
    return 'bi-file-earmark-pdf-fill text-danger'
  }
  if (extension === 'xls' || extension === 'xlsx' || extension === 'csv' || mime.indexOf('spreadsheet') >= 0 || mime.indexOf('excel') >= 0) {
    return 'bi-file-earmark-excel-fill text-success'
  }
  if (extension === 'doc' || extension === 'docx' || mime.indexOf('word') >= 0) {
    return 'bi-file-earmark-word-fill text-primary'
  }
  if (extension === 'ppt' || extension === 'pptx' || mime.indexOf('presentation') >= 0 || mime.indexOf('powerpoint') >= 0) {
    return 'bi-file-earmark-ppt-fill text-warning'
  }
  if (extension === 'zip' || extension === 'rar' || extension === '7z' || mime.indexOf('zip') >= 0) {
    return 'bi-file-earmark-zip-fill text-secondary'
  }
  if (mime.indexOf('video/') === 0 || VIDEO_EXTENSIONS.indexOf(extension) !== -1) {
    return 'bi-file-earmark-play-fill text-info'
  }
  if (mime.indexOf('audio/') === 0 || AUDIO_EXTENSIONS.indexOf(extension) !== -1) {
    return 'bi-file-earmark-music-fill text-secondary'
  }
  if (mime.indexOf('image/') === 0 || IMAGE_EXTENSIONS.indexOf(extension) !== -1) {
    return 'bi-file-earmark-image-fill text-info'
  }
  return 'bi-file-earmark-fill text-secondary'
}
