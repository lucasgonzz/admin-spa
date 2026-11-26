/*
  Ronda 2 de revisión de E2 (misión leads-referidos-compromisos), admin-spa. Se corre con
  `node pruebas/leads-referidos-compromisos-ronda2.cjs`; no necesita dependencias.

    - A2: después de «Registrar llamada» la ficha recarga el compromiso vigente (si no, muestra el viejo y «Cambiar fecha» /
      «Cancelar» dan 422).
    - Menor: con el motor apagado (la API manda `motor_activo: false`) el compromiso no se muestra como si se fuera a ejecutar.
*/
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
let fallos = 0
let corridas = 0

/** Afirma una condición y cuenta el resultado. */
function cierto(descripcion, condicion) {
  corridas++
  if (!condicion) {
    fallos++
    console.log('FALLA  ' + descripcion)
  } else {
    console.log('ok     ' + descripcion)
  }
}

/** Lee un archivo del proyecto ('' si no existe). */
function leer(...partes) {
  try {
    return fs.readFileSync(path.join(RAIZ, ...partes), 'utf8')
  } catch (error) {
    return ''
  }
}

const FICHA = leer('src', 'components', 'pipeline', 'OpportunityModal.vue')
const COMPROMISO = leer('src', 'components', 'lead', 'CompromisoVigente.vue')

cierto('OpportunityModal.vue le pone un ref al compromiso vigente', /<compromiso-vigente[^>]*\bref="compromiso_vigente"/.test(FICHA))
cierto('OpportunityModal.vue lo recarga al registrar una llamada (on_call_registered llama a cargar)',
  /on_call_registered\([^)]*\)\s*\{[\s\S]*?\$refs\.compromiso_vigente[\s\S]*?\.cargar\(\)[\s\S]*?\n    \},/.test(FICHA))
cierto('CompromisoVigente.vue lee `motor_activo` de la respuesta', /motor_activo/.test(COMPROMISO))
cierto('CompromisoVigente.vue no muestra el compromiso con el motor apagado', /v-if="compromiso\s*&&\s*motor_activo"/.test(COMPROMISO))
cierto('CompromisoVigente.vue expone `cargar` para recargarlo desde afuera (está entre sus métodos)', /methods:\s*\{[\s\S]*\bcargar\(\)\s*\{/.test(COMPROMISO))

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
