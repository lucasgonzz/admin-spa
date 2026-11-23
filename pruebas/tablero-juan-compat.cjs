/*
  Prueba de compatibilidad hacia atrás (ronda 2 de la misión embudo-juan-pipeline, E1).

  Se corre con `node pruebas/tablero-juan-compat.cjs`. El SPA y la API no llegan juntos a producción:
  contra un admin-api viejo los pedidos NUEVOS de lectura responden 404 y el interceptor de axios
  mostraría un aviso de error en cada ficha. Los que son información de apoyo tienen que declarar
  `silent_error_statuses` con 404 (silencia sólo ese status; un 500 sigue avisando). Y el pedido que
  escribe la llamada NO se silencia: un 422 tiene que verse.

  Es una comprobación sobre el texto de los archivos (axios y Vue no corren en Node), como las demás de pruebas/.
*/
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
let fallos = 0
let corridas = 0

/** Afirma una condición y la cuenta. */
function cierto(descripcion, condicion) {
  corridas++
  if (condicion) {
    console.log('ok     ' + descripcion)
  } else {
    fallos++
    console.log('FALLA  ' + descripcion)
  }
}

/** Lee un archivo del proyecto (texto vacío si no existe). */
function leer(...partes) {
  try {
    return fs.readFileSync(path.join(RAIZ, ...partes), 'utf8')
  } catch (error) {
    return ''
  }
}

/** Devuelve el texto de la llamada `api.<verbo>(` cuyo primer argumento contiene `fragmento`, hasta el cierre del primer `.then`. */
function pedido(texto, verbo, fragmento) {
  const inicio = texto.search(new RegExp('\\.' + verbo + '\\(\\s*[^)]*' + fragmento.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')))
  if (inicio === -1) {
    return ''
  }
  const fin = texto.indexOf('.then(', inicio)
  return texto.slice(inicio, fin === -1 ? inicio + 300 : fin)
}

const silencia_404 = /silent_error_statuses\s*:\s*\[[^\]]*\b404\b/

const ficha = leer('src', 'components', 'pipeline', 'OpportunityModal.vue')
cierto('OpportunityModal: GET lead/{id}/llamadas declara silent_error_statuses con 404',
  silencia_404.test(pedido(ficha, 'get', "'/llamadas'") || pedido(ficha, 'get', '/llamadas')))

const tareas = leer('src', 'components', 'pipeline', 'MisTareas.vue')
cierto('MisTareas: GET lead-tablero/mis-tareas declara silent_error_statuses con 404',
  silencia_404.test(pedido(tareas, 'get', 'lead-tablero/mis-tareas')))

const modal = leer('src', 'components', 'lead', 'RegistrarLlamadaModal.vue')
const envio = pedido(modal, 'post', '/llamadas')
cierto('RegistrarLlamadaModal: existe el POST de la llamada', envio !== '')
cierto('RegistrarLlamadaModal: el POST NO silencia errores (el 422 tiene que verse)', envio !== '' && !/silent_error/.test(envio))

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
