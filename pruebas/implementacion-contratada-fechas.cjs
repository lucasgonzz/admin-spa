/*
  Prueba de la ronda 3 de E2 (misión embudo-juan-pipeline): las fechas del bloque «Implementación contratada».

  Se corre con `node pruebas/implementacion-contratada-fechas.cjs`.

  El problema: el bloque formateaba las cinco fechas con `format_datetime` de src/utils/pipeline_dates.js, que sólo
  acepta 'YYYY-MM-DD HH:mm:ss' estricto, y la API del cliente manda ISO con zona:
    - GET client (casts datetime de Laravel 8): '2026-11-23T15:00:00.000000Z'
    - rutas de la ficha (toIso8601String):       '2026-11-23T12:00:00-03:00'
  así que las cinco mostraban siempre «—». pipeline_dates.js lo usan otros módulos y NO se toca: el bloque usa un
  formateador propio, `formatear_fecha_argentina` de src/utils/fecha_argentina.js, que entiende los tres formatos y
  muestra SIEMPRE la hora de Argentina (America/Argentina/Buenos_Aires, UTC-3, sin horario de verano).

  Qué fija:
    1. La función pura (se extrae del ARCHIVO REAL, sin imports): los dos ISO y el formato viejo dan la MISMA fecha legible
       «DD/MM/YYYY HH:mm» en hora argentina; lo vacío o ilegible da '' (el bloque pone «—»); una hora UTC que cruza la
       medianoche cae en el día argentino.
    2. Que el bloque use esa función y no `format_datetime`.
*/
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
let fallos = 0
let corridas = 0

/** Compara con igualdad estricta (por JSON) y cuenta el resultado. */
function igual(descripcion, obtenido, esperado) {
  corridas++
  const a = JSON.stringify(obtenido)
  const b = JSON.stringify(esperado)
  if (a !== b) {
    fallos++
    console.log('FALLA  ' + descripcion + '\n         obtenido: ' + a + '\n         esperado: ' + b)
  } else {
    console.log('ok     ' + descripcion)
  }
}

/** Lee un archivo del proyecto; devuelve null si no existe. */
function leer(...partes) {
  try {
    return fs.readFileSync(path.join(RAIZ, ...partes), 'utf8')
  } catch (error) {
    return null
  }
}

/* ---- La función pura ---- */
let texto = leer('src', 'utils', 'fecha_argentina.js')
if (texto === null) {
  console.log('FALLA  no existe src/utils/fecha_argentina.js')
  fallos++
  corridas++
} else {
  texto = texto.replace(/^export /gm, '')
  const formatear = new Function(texto + "\nreturn typeof formatear_fecha_argentina === 'undefined' ? undefined : formatear_fecha_argentina")()
  if (typeof formatear !== 'function') {
    console.log('FALLA  src/utils/fecha_argentina.js no define formatear_fecha_argentina')
    fallos++
    corridas++
  } else {
    igual('ISO en UTC de GET client (con microsegundos) → hora argentina', formatear('2026-11-23T15:00:00.000000Z'), '23/11/2026 12:00')
    igual('ISO con -03:00 de las rutas de la ficha → misma hora', formatear('2026-11-23T12:00:00-03:00'), '23/11/2026 12:00')
    igual('formato viejo «Y-m-d H:i:s» (ya viene en hora local) → misma hora', formatear('2026-11-23 12:00:00'), '23/11/2026 12:00')
    igual('los tres formatos del mismo instante dan lo mismo',
      [formatear('2026-11-23T15:00:00.000000Z'), formatear('2026-11-23T12:00:00-03:00'), formatear('2026-11-23 12:00:00')]
        .filter(function (v, i, todos) { return v === todos[0] }).length, 3)
    igual('una zona distinta de la argentina se convierte (+01:00 → 4 horas menos)',
      formatear('2026-11-23T16:30:00+01:00'), '23/11/2026 12:30')
    igual('una hora UTC que cruza la medianoche cae en el día argentino', formatear('2026-11-24T01:30:00Z'), '23/11/2026 22:30')
    igual('la hora no usa 24 (medianoche argentina = 00:00)', formatear('2026-11-24T03:05:00.000000Z'), '24/11/2026 00:05')
    igual('sin segundos y con zona', formatear('2026-12-01T10:00-03:00'), '01/12/2026 10:00')
    igual('sólo fecha → la fecha', formatear('2026-11-23'), '23/11/2026')
    igual('vacío → vacío', formatear(''), '')
    igual('null → vacío', formatear(null), '')
    igual('undefined → vacío', formatear(undefined), '')
    igual('texto que no es fecha → vacío (el bloque pone «—»)', formatear('mañana'), '')
    igual('fecha imposible → vacío', formatear('2026-13-45T99:00:00Z'), '')
  }
}

/* ---- El bloque usa esa función ---- */
const bloque = leer('src', 'components', 'client', 'extra-props', 'ImplementacionContratada.vue')
igual('el bloque importa formatear_fecha_argentina de utils/fecha_argentina',
  bloque !== null && /import \{[^}]*formatear_fecha_argentina[^}]*\} from '@\/utils\/fecha_argentina'/.test(bloque), true)
igual('el bloque ya no formatea con format_datetime de pipeline_dates (sólo acepta el formato viejo)',
  bloque !== null && !/format_datetime/.test(bloque), true)

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
