/*
  Prueba de aceptación CA27 de la misión embudo-juan-pipeline (etapa E2): implementación contratada en el admin-spa.

  Se corre con `node pruebas/implementacion-contratada.cjs`. No necesita dependencias (misma convención que
  pruebas/tablero-juan.cjs).

  Qué fija:
    1. `src/utils/registrar_llamada.js`: con «Pagó la mitad» el modal pide los paquetes (gestión, tienda y/o
       agentes; Agentes Lite no tiene implementación). `validar_paquetes` exige al menos uno y que sean de la lista;
       `payload` los manda sólo con ese resultado.
       OJO: `validar()` NO cambia. pruebas/tablero-juan.cjs (E1, intocable) fija que «pagó la mitad» sin paquetes es
       válido para `validar()`; la exigencia de E2 va en `validar_paquetes()`, que el modal suma a `validar()`.
    2. La ficha del cliente: el bloque «Implementación contratada» (estado, paquetes, fechas, «Artículos importados OK»
       y «Reanudar prueba» con confirmación) con los endpoints del contrato §2.5 del plan, registrado en
       `extra-props/Index.vue`, y que no aparezca contra un admin-api que todavía no manda el campo.
    3. Lo que Juan ve en la nota de la tarjeta: con el perfil Sólo Leads la API no manda las etiquetas de
       `activity_types`, y la tarjeta mostraba «Juan: stage_change». El SPA tiene que caer a la etiqueta legible.

  La verificación visual (ficha del cliente y modal con paquetes) la hace el Coordinador en el navegador.
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

/** Afirma una condición y la cuenta. */
function cierto(descripcion, condicion) {
  igual(descripcion, !!condicion, true)
}

/** Lee un archivo del proyecto; devuelve null si no existe. */
function leer(...partes) {
  try {
    return fs.readFileSync(path.join(RAIZ, ...partes), 'utf8')
  } catch (error) {
    return null
  }
}

/** Afirma que un archivo existe y contiene el patrón. */
function contiene(descripcion, archivo, patron) {
  const contenido = leer(...archivo)
  cierto(descripcion, contenido !== null && patron.test(contenido))
}

/* ================================================================================================
   1. Paquetes en «Registrar llamada» (src/utils/registrar_llamada.js)
   ================================================================================================ */
let texto = leer('src', 'utils', 'registrar_llamada.js')
if (texto === null) {
  console.log('FALLA  no existe src/utils/registrar_llamada.js')
  fallos++
  corridas++
} else {
  texto = texto.replace(/^export /gm, '')
  const nombres = ['PAQUETES', 'requiere_paquetes', 'validar_paquetes', 'validar', 'payload']
  const devolver = nombres.map(function (n) { return n + ': (typeof ' + n + " === 'undefined' ? undefined : " + n + ')' })
  const m = new Function(texto + '\nreturn { ' + devolver.join(', ') + ' }')()

  /** Formulario base de una llamada atendida. */
  function formulario(campos) {
    return Object.assign({
      atendio: true, resultado: '', motivo: '', proxima_llamada_at: '', cotizado: '', notas: '', paquetes: [],
    }, campos)
  }
  const mitad = function (paquetes) { return formulario({ resultado: 'pago_la_mitad', paquetes: paquetes }) }
  /** Campos con error de validar_paquetes (función ausente = falla sola). */
  const errores_de = function (form) {
    return typeof m.validar_paquetes === 'function' ? Object.keys(m.validar_paquetes(form) || {}).sort() : null
  }

  igual('los paquetes son gestión, tienda y agentes (Agentes Lite no tiene implementación)',
    (m.PAQUETES || []).map(function (p) { return p.value }), ['gestion', 'tienda', 'agentes'])
  igual('las etiquetas de los paquetes', (m.PAQUETES || []).map(function (p) { return p.label }), ['Gestión', 'Tienda', 'Agentes'])

  igual('«Pagó la mitad» pide paquetes', typeof m.requiere_paquetes === 'function' ? m.requiere_paquetes(mitad([])) : null, true)
  igual('«Sigue solo» no pide paquetes',
    typeof m.requiere_paquetes === 'function' ? m.requiere_paquetes(formulario({ resultado: 'sigue_solo' })) : null, false)
  igual('«Pagó la mitad» sin haber atendido no pide paquetes (el resultado se ignora)',
    typeof m.requiere_paquetes === 'function' ? m.requiere_paquetes(formulario({ atendio: false, resultado: 'pago_la_mitad' })) : null, false)

  igual('«Pagó la mitad» sin ningún paquete: error en paquetes', errores_de(mitad([])), ['paquetes'])
  igual('«Pagó la mitad» sin la clave paquetes: error en paquetes', errores_de(formulario({ resultado: 'pago_la_mitad', paquetes: undefined })), ['paquetes'])
  igual('«Pagó la mitad» con un paquete que no existe (agentes_lite): error en paquetes', errores_de(mitad(['agentes_lite'])), ['paquetes'])
  igual('«Pagó la mitad» con gestión: sin errores', errores_de(mitad(['gestion'])), [])
  igual('«Pagó la mitad» con gestión y tienda: sin errores', errores_de(mitad(['gestion', 'tienda'])), [])
  igual('otro resultado sin paquetes: sin errores', errores_de(formulario({ resultado: 'sigue_solo' })), [])
  igual('el mensaje del error está en castellano',
    typeof m.validar_paquetes === 'function' ? typeof (m.validar_paquetes(mitad([])) || {}).paquetes : null, 'string')

  igual('validar() no cambia: «pagó la mitad» sin paquetes sigue sin error acá (lo fija pruebas/tablero-juan.cjs)',
    Object.keys(m.validar(mitad([]), { ahora: new Date(2026, 10, 23, 12, 0, 0) })), [])

  igual('payload de «pagó la mitad»: lleva los paquetes',
    m.payload(mitad(['gestion', 'tienda'])), { atendio: true, resultado: 'pago_la_mitad', paquetes: ['gestion', 'tienda'] })
  igual('payload de otro resultado: no arrastra paquetes que quedaron tildados',
    m.payload(formulario({ resultado: 'sigue_solo', paquetes: ['gestion'] })), { atendio: true, resultado: 'sigue_solo' })
  igual('payload de «no atendió»: no lleva paquetes',
    m.payload(formulario({ atendio: false, resultado: 'pago_la_mitad', paquetes: ['gestion'], proxima_llamada_at: '2026-11-25T11:00' })),
    { atendio: false, proxima_llamada_at: '2026-11-25 11:00' })
}

/* ---- El modal usa esa lógica ---- */
const modal = ['src', 'components', 'lead', 'RegistrarLlamadaModal.vue']
contiene('RegistrarLlamadaModal.vue importa validar_paquetes y PAQUETES de registrar_llamada.js', modal, /import \{[^}]*validar_paquetes[^}]*\} from '@\/utils\/registrar_llamada'/)
contiene('RegistrarLlamadaModal.vue importa PAQUETES', modal, /import \{[^}]*PAQUETES[^}]*\} from '@\/utils\/registrar_llamada'/)
contiene('RegistrarLlamadaModal.vue muestra las casillas de paquetes sólo si el resultado los pide', modal, /v-if="pide_paquetes"/)

/* ================================================================================================
   2. Ficha del cliente: bloque «Implementación contratada»
   ================================================================================================ */
const bloque = ['src', 'components', 'client', 'extra-props', 'ImplementacionContratada.vue']
contiene('existe ImplementacionContratada.vue con el título «Implementación contratada»', bloque, /Implementación contratada/)
contiene('guarda con PUT client/{id}/implementacion-contratada', bloque, /\.put\([\s\S]{0,120}implementacion-contratada/)
contiene('«Artículos importados OK» hace POST client/{id}/implementacion/articulos-importados', bloque, /\.post\([\s\S]{0,120}implementacion\/articulos-importados/)
contiene('«Reanudar prueba» hace POST client/{id}/prueba/reanudar', bloque, /\.post\([\s\S]{0,120}prueba\/reanudar/)
contiene('tiene el botón «Artículos importados OK»', bloque, /Artículos importados OK/)
contiene('tiene el botón «Reanudar prueba»', bloque, /Reanudar prueba/)
contiene('confirma antes de reanudar', bloque, /confirm\([^)]*[Rr]eanud/)
contiene('confirma antes de pausar la prueba al pasar a «mitad» o «completa»', bloque, /confirm\([^)]*paus/)
contiene('los cuatro estados del contrato: no, mitad, completa e incluida', bloque, /'no'[\s\S]*'mitad'[\s\S]*'completa'[\s\S]*'incluida'/)
contiene('las fechas se muestran en sólo lectura (mitad pagada, artículos recibidos, artículos OK, pausa y reanudación)', bloque,
  /implementacion_mitad_pagada_at[\s\S]*implementacion_articulos_recibidos_at[\s\S]*implementacion_articulos_ok_at[\s\S]*prueba_pausada_at[\s\S]*prueba_reanudada_at/)
contiene('contra un admin-api que no manda el campo, el bloque no se muestra (compatibilidad hacia atrás)', bloque, /implementacion_contratada\s*(===|!==)\s*undefined/)
contiene('los paquetes salen de la lista de registrar_llamada.js (una sola fuente)', bloque, /PAQUETES[\s\S]*@\/utils\/registrar_llamada|@\/utils\/registrar_llamada[\s\S]*PAQUETES/)
contiene('extra-props/Index.vue registra y usa el bloque',
  ['src', 'components', 'client', 'extra-props', 'Index.vue'], /ImplementacionContratada\.vue[\s\S]*<client-implementacion-contratada/)

/* ================================================================================================
   3. La nota de la tarjeta de Juan no muestra el tipo crudo
   ================================================================================================ */
const tarjeta = ['src', 'components', 'pipeline', 'OpportunityCard.vue']
contiene('OpportunityCard.vue cae a «Cambio de etapa» si la API no manda las etiquetas', tarjeta, /stage_change[\s\S]{0,40}Cambio de etapa/)
contiene('OpportunityCard.vue conoce las cinco etiquetas de actividad (Alta, Cambio de etapa, Nota, Próxima acción y Responsable)', tarjeta,
  /Alta[\s\S]*Cambio de etapa[\s\S]*Nota[\s\S]*Próxima acción[\s\S]*Responsable/)
contiene('OpportunityModal.vue (historial) también cae a la etiqueta legible',
  ['src', 'components', 'pipeline', 'OpportunityModal.vue'], /stage_change[\s\S]{0,60}Cambio de etapa|Cambio de etapa[\s\S]{0,60}stage_change/)

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
