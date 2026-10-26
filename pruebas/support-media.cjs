/*
  Prueba de src/utils/support_media.js (multimedia de la conversación de soporte).

  Se corre con `node pruebas/support-media.cjs`. No necesita dependencias: `admin-spa` no tiene
  corredor de tests (misma convención que pruebas/rescate-ogg.cjs).

  Extrae las funciones del ARCHIVO REAL en vez de tener una copia pegada acá: una copia se
  desincroniza y la prueba pasa a probar código que ya no existe. Lo único que se simula es
  `import.meta.env` (que solo existe dentro de Vite) y los `export`, que Node no entiende en un
  `new Function`.
*/
const fs = require('fs')
const path = require('path')

const FUENTE = path.join(__dirname, '..', 'src', 'utils', 'support_media.js')
let texto = fs.readFileSync(FUENTE, 'utf8')

/* Sacar el `export` de cada declaración y simular import.meta.env con un objeto controlable. */
texto = texto.replace(/^export /gm, '')
texto = texto.replace(/import\.meta\.env/g, 'entorno_simulado')

const nombres = [
  'normalize_mime', 'extension_of', 'media_type_of', 'attachment_open_url', 'attachment_download_url',
  'attachment_playback_url', 'attachment_display_name', 'browser_can_play_ogg_opus',
  'attachment_audio_src', 'attachment_icon_class',
]
const entorno_simulado = {}
const modulo = new Function(
  'entorno_simulado',
  texto + '\nreturn { ' + nombres.join(', ') + ' }'
)(entorno_simulado)

let fallos = 0
let corridas = 0

/** Compara con igualdad estricta y cuenta el resultado. */
function igual(descripcion, obtenido, esperado) {
  corridas++
  if (obtenido !== esperado) {
    fallos++
    console.log('FALLA  ' + descripcion + '\n         obtenido: ' + JSON.stringify(obtenido) + '\n         esperado: ' + JSON.stringify(esperado))
  } else {
    console.log('ok     ' + descripcion)
  }
}

/* ---- normalize_mime ---- */
igual('mime con parámetros se normaliza', modulo.normalize_mime('audio/ogg; codecs=opus'), 'audio/ogg')
igual('mime en mayúsculas', modulo.normalize_mime('Audio/OGG'), 'audio/ogg')
igual('mime nulo', modulo.normalize_mime(null), '')

/* ---- extension_of ---- */
igual('extensión de una ruta', modulo.extension_of('support_messages/12/wa_abc.OGG'), 'ogg')
igual('extensión ignora query', modulo.extension_of('https://x/y/archivo.mp4?sig=1.2.3'), 'mp4')
igual('sin extensión', modulo.extension_of('support_messages/12/wa_abc'), '')
igual('punto en una carpeta, no en el archivo', modulo.extension_of('a.b/c'), '')

/* ---- media_type_of: el mime manda ---- */
igual('mime audio/ogg con parámetros -> audio', modulo.media_type_of({ kind: 'text' }, { mime: 'audio/ogg; codecs=opus', path: 'x/wa_1.bin' }), 'audio')
igual('mime image/jpeg -> image aunque el kind sea text', modulo.media_type_of({ kind: 'text' }, { mime: 'image/jpeg', path: 'x/a.bin' }), 'image')
igual('mime video/mp4 -> video', modulo.media_type_of({ kind: 'file' }, { mime: 'video/mp4', path: 'x/a.bin' }), 'video')
igual('mime pdf -> file aunque la extensión sea de video', modulo.media_type_of({ kind: 'document' }, { mime: 'application/pdf', path: 'x/a.mp4' }), 'file')
igual('sticker webp -> image', modulo.media_type_of({ kind: 'sticker' }, { mime: 'image/webp', path: 'x/a.webp' }), 'image')

/* ---- media_type_of: sin mime o genérico, manda la extensión ---- */
igual('octet-stream + .ogg -> audio', modulo.media_type_of({ kind: 'text' }, { mime: 'application/octet-stream', path: 'x/a.ogg' }), 'audio')
igual('sin mime + .m4a -> audio', modulo.media_type_of({ kind: 'file' }, { path: 'x/a.m4a' }), 'audio')
igual('sin mime + .mp4 -> video', modulo.media_type_of({ kind: 'text' }, { path: 'x/a.MP4' }), 'video')
igual('sin mime + .HEIC -> image', modulo.media_type_of({ kind: 'text' }, { path: 'x/a.HEIC' }), 'image')
igual('la extensión sale del display_filename si el path es .bin', modulo.media_type_of({ kind: 'text' }, { path: 'x/wa_1.bin', display_filename: 'nota.opus' }), 'audio')

/* ---- media_type_of: último recurso, el kind ---- */
igual('.bin sin mime + kind audio -> audio', modulo.media_type_of({ kind: 'audio' }, { path: 'x/wa_1.bin' }), 'audio')
igual('.bin sin mime + kind video -> video', modulo.media_type_of({ kind: 'video' }, { path: 'x/wa_1.bin' }), 'video')
igual('.bin sin mime + kind image -> image', modulo.media_type_of({ kind: 'image' }, { path: 'x/wa_1.bin' }), 'image')
igual('.bin sin mime + kind document -> file', modulo.media_type_of({ kind: 'document' }, { path: 'x/wa_1.bin' }), 'file')
igual('.bin sin mime + kind text -> file', modulo.media_type_of({ kind: 'text' }, { path: 'x/wa_1.bin' }), 'file')
igual('sin adjunto ni kind -> file', modulo.media_type_of(null, null), 'file')

/* ---- media_type_of: contenedor que se declara video pero es una nota de voz ---- */
igual('video/webm en un mensaje de audio -> audio', modulo.media_type_of({ kind: 'audio' }, { mime: 'video/webm', path: 'x/a.webm' }), 'audio')
igual('video/webm en un mensaje de video -> video', modulo.media_type_of({ kind: 'video' }, { mime: 'video/webm', path: 'x/a.webm' }), 'video')
igual('.webm sin mime en un mensaje de audio -> audio', modulo.media_type_of({ kind: 'audio' }, { path: 'x/a.webm' }), 'audio')

/* ---- URLs: con la API nueva ---- */
const nuevo = {
  path: 'support_messages/9/wa_1.ogg',
  public_url: 'https://admin.test/api/admin/support-message-attachment/5/file?signature=a',
  download_url: 'https://admin.test/api/admin/support-message-attachment/5/file?disposition=attachment&signature=b',
  playback_url: 'https://admin.test/api/admin/support-message-attachment/5/file?playable=1&signature=c',
  display_filename: 'wa_1.ogg',
}
igual('open_url usa public_url', modulo.attachment_open_url(nuevo), nuevo.public_url)
igual('download_url usa download_url', modulo.attachment_download_url(nuevo), nuevo.download_url)
igual('playback_url usa playback_url', modulo.attachment_playback_url(nuevo), nuevo.playback_url)
igual('display_name usa display_filename', modulo.attachment_display_name(nuevo), 'wa_1.ogg')

/* ---- URLs: con la API vieja (sin los campos nuevos) -> /storage ---- */
const viejo = { path: 'support_messages/9/wa_1.bin', mime: 'audio/ogg' }
entorno_simulado.VITE_BACKEND_BASE_URL = 'https://admin.test/'
igual('sin public_url cae a /storage con VITE_BACKEND_BASE_URL', modulo.attachment_open_url(viejo), 'https://admin.test/storage/support_messages/9/wa_1.bin')
igual('sin download_url cae a la URL de apertura', modulo.attachment_download_url(viejo), 'https://admin.test/storage/support_messages/9/wa_1.bin')
igual('sin playback_url devuelve null', modulo.attachment_playback_url(viejo), null)
igual('sin display_filename usa el basename del path', modulo.attachment_display_name(viejo), 'wa_1.bin')
igual('sin nada, "Archivo"', modulo.attachment_display_name({}), 'Archivo')
delete entorno_simulado.VITE_BACKEND_BASE_URL
entorno_simulado.VITE_API_URL = 'https://admin.test/api/admin'
igual('sin VITE_BACKEND_BASE_URL se deriva de VITE_API_URL', modulo.attachment_open_url(viejo), 'https://admin.test/storage/support_messages/9/wa_1.bin')
igual('adjunto sin path ni public_url -> cadena vacía', modulo.attachment_open_url({}), '')

/* ---- Audio: qué URL carga el reproductor ---- */
igual('navegador que reproduce ogg/opus -> URL normal', modulo.attachment_audio_src(nuevo, true), nuevo.public_url)
igual('Safari viejo + ogg -> playback_url', modulo.attachment_audio_src(nuevo, false), nuevo.playback_url)
igual('Safari viejo + API vieja (sin playback_url) -> URL normal', modulo.attachment_audio_src(viejo, false), 'https://admin.test/storage/support_messages/9/wa_1.bin')
const mp3 = { path: 'support_messages/9/a.mp3', mime: 'audio/mpeg', public_url: 'https://x/pub', playback_url: 'https://x/play' }
igual('Safari viejo + mp3 -> no hace falta transcodificar', modulo.attachment_audio_src(mp3, false), 'https://x/pub')
igual('en node (sin document) se asume que reproduce ogg/opus', modulo.browser_can_play_ogg_opus(), true)

/* ---- Íconos ---- */
igual('ícono de pdf', modulo.attachment_icon_class({ mime: 'application/pdf' }), 'bi-file-earmark-pdf-fill text-danger')
igual('ícono de xlsx por extensión', modulo.attachment_icon_class({ display_filename: 'lista.xlsx' }), 'bi-file-earmark-excel-fill text-success')
igual('ícono genérico', modulo.attachment_icon_class({ path: 'x/a.bin' }), 'bi-file-earmark-fill text-secondary')

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
