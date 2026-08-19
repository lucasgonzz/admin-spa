/*
  Arma las dos páginas de diagnóstico de audio a partir de sus plantillas.

    node pruebas/banco-audio/armar.cjs

  Deja en pruebas/banco-audio/dist/ dos archivos autocontenidos, sin ninguna dependencia externa:

  - banco.html      El banco de pruebas para el teléfono. Graba con el mismo motor que la
                    conversación de leads y registra, con marca de tiempo, cuánto tarda el
                    grabador en arrancar, en qué estado estaba cuando se pidió el corte, cuánto
                    tarda el cierre y qué páginas acumuló el encoder. Tiene cuatro modos de corte
                    comparables. NO manda nada a WhatsApp.

  - decodifica.html Prueba de integración: graba sin micrófono (opus-recorder acepta un sourceNode
                    en lugar de getUserMedia) y verifica con decodeAudioData() que tanto el archivo
                    del camino normal como el del rescate se puedan reproducir de verdad.

  Por qué se arman en vez de estar listos: las dos embeben el worker del encoder de opus-recorder
  (385 KB) en base64 para poder correr solas desde cualquier lado, y la de decodificación extrae
  las funciones de src/utils/oggOpusRecorder.js EN EL MOMENTO, así que prueba el código que hay
  hoy en el archivo y no una copia pegada que se desincroniza en silencio.

  🔴 Para abrirlas en un iPhone hace falta HTTPS: getUserMedia no anda sobre http salvo en
  localhost. Servirlas por la red local no alcanza. En agosto de 2026 el banco se publicó como
  página web para que Lucas lo abriera en su teléfono; la URL quedó en el informe
  20260819-audio-whatsapp-detener-grabacion-ios.md del repo de contexto.
*/
const fs = require('fs')
const path = require('path')

const AQUI = __dirname
const RAIZ = path.join(AQUI, '..', '..')
const SALIDA = path.join(AQUI, 'dist')

const encoder = fs.readFileSync(
  path.join(RAIZ, 'node_modules', 'opus-recorder', 'dist', 'encoderWorker.min.js')
)
const recorder = fs.readFileSync(
  path.join(RAIZ, 'node_modules', 'opus-recorder', 'dist', 'recorder.min.js'),
  'utf8'
)

/** Devuelve el tramo de oggOpusRecorder.js anterior a la clase: son las funciones sueltas. */
function funciones_del_grabador() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src', 'utils', 'oggOpusRecorder.js'), 'utf8')
  const corte = fuente.indexOf('export class OggOpusRecorder')
  if (corte === -1) {
    throw new Error('no encontré la clase en src/utils/oggOpusRecorder.js')
  }
  return fuente
    .slice(0, corte)
    .split('\n')
    .filter(function (linea) {
      return !linea.startsWith('import ')
    })
    .join('\n')
}

function armar(plantilla, nombre_salida) {
  let html = fs.readFileSync(path.join(AQUI, plantilla), 'utf8')
  html = html
    .replace('/*ENCODER_B64*/', encoder.toString('base64'))
    .replace('/*RECORDER_JS*/', recorder)
    .replace('/*RESCATE_JS*/', funciones_del_grabador())
  fs.mkdirSync(SALIDA, { recursive: true })
  const destino = path.join(SALIDA, nombre_salida)
  fs.writeFileSync(destino, html)
  console.log('  ' + nombre_salida + '  ' + (fs.statSync(destino).size / 1024 / 1024).toFixed(2) + ' MB')
}

console.log('armando en pruebas/banco-audio/dist/')
armar('banco.plantilla.html', 'banco.html')
armar('decodifica.plantilla.html', 'decodifica.html')
console.log('listo')
