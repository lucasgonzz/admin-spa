/*
  Pruebas de la ronda 2 de push-mensajes-por-aprobar (SPA-1): `focus_message_row` alinea al
  comienzo (block 'start') cuando la fila es más alta que el área visible del contenedor, y
  centra ('center') cuando entra o cuando el contenedor no da medidas.

  Se corre con `node pruebas/push-mensajes-por-aprobar-r2.cjs`. Carga el archivo REAL
  src/utils/conversation_focus.js (le saca import/export y lo evalúa). Exit code != 0 si falla.
*/
const fs = require('fs')
const path = require('path')

const FUENTE = path.join(__dirname, '..', 'src', 'utils', 'conversation_focus.js')
let ok = 0
let mal = 0

/** Registra e imprime el resultado de una comprobación. */
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; console.log('  OK    ' + nombre) } else { mal++; console.log('  FALLA ' + nombre + (detalle ? ' -> ' + detalle : '')) }
}

/** Carga el módulo real con setTimeout falso. */
function cargar() {
  const codigo = fs.readFileSync(FUENTE, 'utf8')
    .replace(/^\s*import .*$/gm, '')
    .replace(/\bexport\s+(function|const)/g, '$1') +
    '\nreturn { focus_message_row };'
  return new Function('setTimeout', codigo)(function () { return 1 })
}

/** Fila simulada con altura y registro de scrollIntoView. */
function fila(alto) {
  const clases = new Set()
  return {
    offsetHeight: alto,
    llamadas: [],
    classList: { add: function (c) { clases.add(c) }, remove: function (c) { clases.delete(c) }, has: function (c) { return clases.has(c) } },
    scrollIntoView: function (op) { this.llamadas.push(op) },
  }
}

/** Contenedor simulado que devuelve la fila para el selector del mensaje 7. */
function raiz(alto_visible, row) {
  return { clientHeight: alto_visible, querySelector: function (sel) { return sel === '[data-message-id="7"]' ? row : null } }
}

const foco = cargar()
console.log('SPA-1. block según el alto de la fila')

let f = fila(700)
comprobar('fila 700 en contenedor 600 -> found y block start', foco.focus_message_row(raiz(600, f), 7, 'x') === true && f.llamadas[0].block === 'start', JSON.stringify(f.llamadas))

f = fila(200)
comprobar('fila 200 en contenedor 600 -> block center', foco.focus_message_row(raiz(600, f), 7, 'x') === true && f.llamadas[0].block === 'center', JSON.stringify(f.llamadas))

f = fila(700)
comprobar('contenedor sin medidas (undefined) -> center', foco.focus_message_row(raiz(undefined, f), 7, 'x') === true && f.llamadas[0].block === 'center')

f = fila(700)
comprobar('contenedor clientHeight 0 -> center', foco.focus_message_row(raiz(0, f), 7, 'x') === true && f.llamadas[0].block === 'center')

f = fila(700)
foco.focus_message_row(raiz(600, f), 7, 'x', false)
comprobar('highlight=false reposiciona sin resaltar', f.llamadas.length === 1 && !f.classList.has('x'))

f = fila(700)
foco.focus_message_row(raiz(600, f), 7, 'x')
comprobar('por defecto resalta', f.classList.has('x'))

console.log('\n' + ok + ' OK, ' + mal + ' FALLAS')
process.exit(mal === 0 ? 0 : 1)
