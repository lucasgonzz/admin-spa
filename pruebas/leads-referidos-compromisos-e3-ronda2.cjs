/*
  Ronda 2 de la revisión de E3 (misión leads-referidos-compromisos), admin-spa. Se corre con `node pruebas/leads-referidos-compromisos-e3-ronda2.cjs`.
  Se leen los archivos reales como texto (misma convención que `leads-referidos-compromisos-e3.cjs`).

    1. Subida cortada: la ficha de cada llamada ofrece «Subir la grabación» sobre ESA llamada (sin crear otra) cuando no tiene grabación, o
       está «subiendo» o con error; ya no manda a «volver a registrar». «Volver a resumir» cuando la IA no resumió.
    2. «Registrar llamada»: si la llamada ya se registró y la subida falla, cerrar por cualquier camino avisa `registrada` (la ficha y el
       tablero recargan); el texto de error manda a la ficha. Las partes y «completar» llevan el id de la grabación.
*/
const fs = require('fs')
const path = require('path')
const RAIZ = path.join(__dirname, '..')
let fallos = 0
let corridas = 0

function cierto(descripcion, condicion) {
  corridas++
  if (!condicion) {
    fallos++
    console.log('FALLA  ' + descripcion)
  } else {
    console.log('ok     ' + descripcion)
  }
}
function leer(...partes) {
  try {
    return fs.readFileSync(path.join(RAIZ, ...partes), 'utf8')
  } catch (error) {
    return ''
  }
}

const GRABACION = leer('src', 'components', 'lead', 'GrabacionDeLlamada.vue')
const MODAL = leer('src', 'components', 'lead', 'RegistrarLlamadaModal.vue')
const FICHA = leer('src', 'components', 'pipeline', 'OpportunityModal.vue')
const UTIL_DE_SUBIDA = leer('src', 'utils', 'subida_de_grabacion.js')

cierto('GrabacionDeLlamada.vue tiene el botón «Subir la grabación»', /Subir la grabación/.test(GRABACION))
cierto('GrabacionDeLlamada.vue tiene un input de archivo de audio', /<input[^>]*type="file"[^>]*accept="[^"]*audio\/\*/.test(GRABACION))
cierto('GrabacionDeLlamada.vue ya no manda a «volver a registrar»', GRABACION !== '' && !/volv[eé]\s+a\s+registrar/i.test(GRABACION))
cierto('GrabacionDeLlamada.vue ofrece subir cuando no hay grabación o está subiendo o con error', /puede_subir/.test(GRABACION))
cierto('GrabacionDeLlamada.vue tiene «Volver a resumir» y llama a …/grabacion/resumir', /Volver a resumir/.test(GRABACION) && /\.post\(\s*[`'"][\s\S]{0,120}\/grabacion\/resumir/.test(GRABACION))
cierto('GrabacionDeLlamada.vue se muestra aunque la llamada no tenga grabación (para ofrecer subirla)', /<div[^>]*class="grabacion"/.test(GRABACION) && !/<div v-if="grabacion" class="grabacion"/.test(GRABACION))
cierto('la subida de la ficha reutiliza las rutas de E3 con el id de la llamada existente',
  /\/llamadas\/['"`]\s*\+[\s\S]{0,80}\/grabacion['"`]/.test(UTIL_DE_SUBIDA) && /\/grabacion\/partes/.test(UTIL_DE_SUBIDA) && /\/grabacion\/completar/.test(UTIL_DE_SUBIDA))
cierto('la subida de la ficha manda el id de la grabación en las partes y en completar', /grabacion_id/.test(UTIL_DE_SUBIDA))
cierto('la ficha monta la grabación en cada llamada, también sin grabación', /<grabacion-de-llamada\s+:llamada="llamada"/.test(FICHA) && !/<grabacion-de-llamada[^>]*v-if="llamada\.grabacion"/.test(FICHA))

cierto('RegistrarLlamadaModal.vue: el texto de error manda a subir la grabación desde la ficha', /La llamada quedó registrada; subí la grabación desde la ficha cuando tengas señal/.test(MODAL))
cierto('RegistrarLlamadaModal.vue: no manda a volver a registrar', !/volv[eé]\s+a\s+registrar/i.test(MODAL))
const on_cancel = /on_cancel\(\) \{([\s\S]*?)\n    \},/.exec(MODAL)
cierto('RegistrarLlamadaModal.vue: cerrar con una llamada ya registrada emite `registrada` (X, Escape y fondo pasan por on_cancel)',
  !!on_cancel && /this\.registro/.test(on_cancel[1]) && /\$emit\(\s*'registrada'/.test(on_cancel[1]))
cierto('RegistrarLlamadaModal.vue: las partes y completar llevan grabacion_id', /append\(\s*['"]grabacion_id['"]/.test(MODAL) && /grabacion_id/.test(MODAL.slice(MODAL.indexOf('/grabacion/completar'))))

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
