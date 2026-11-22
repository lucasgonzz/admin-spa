/*
  Prueba de aceptación CA39 de la misión embudo-whatsapp-precios (etapa E5):
  perfil «Sólo Leads» en el admin-spa.

  Se corre con `node pruebas/solo-leads.cjs`. No necesita dependencias: `admin-spa` no tiene
  corredor de tests (misma convención que pruebas/precios-vigentes.cjs).

  Qué fija:
    1. La lógica pura de `src/utils/solo_leads.js` (se extrae del ARCHIVO REAL, no de una copia),
       que es la ÚNICA fuente de la decisión de qué ve el perfil:
       - `es_solo_leads` (true sólo con la clave en true; `undefined` = false: un SPA nuevo contra
         una API vieja);
       - `ruta_permitida` (leads, lead_conversation y account sí; clients, tasks e inicio no);
       - `secciones_de_cuenta` (el perfil ve sólo «Instalar aplicación» y «Notificaciones push»;
         un admin normal ve todas, sin cambios);
       - `seccion_de_cuenta_por_defecto` (push-notifications para el perfil; preferences para el resto);
       - `destino_del_aviso` (un aviso con lead abre la conversación; un admin normal sigue a /tareas);
       - `redireccion_solo_leads` (a dónde manda el guard una ruta no permitida);
       - `es_error_solo_leads` (el 403 de fondo que el interceptor de axios no muestra como aviso).
    2. Que los demás archivos sólo LLAMEN a esa lógica (nav, guard, axios, Cuenta, aviso de tareas,
       conversación, ficha del lead y Usuarios admin), sin repetirla.

  La verificación visual (menú, redirección, conversación sin redacción, modal sin solapas, Cuenta,
  0 toasts de error) la hace el Coordinador en el navegador: acá no se levanta nada.
*/
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const FUENTE = path.join(RAIZ, 'src', 'utils', 'solo_leads.js')

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

/** Afirma que una condición sea verdadera y cuenta el resultado. */
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

/* ---- Existencia de la lógica pura: sin ella no hay nada que probar ---- */
let texto = leer('src', 'utils', 'solo_leads.js')
if (texto === null) {
  console.log('FALLA  no existe src/utils/solo_leads.js: el perfil «Sólo Leads» todavía no se construyó en el SPA')
  fallos++
  corridas++
}

if (texto !== null) {
  /* Sacar el `export` de cada declaración: Node no los entiende dentro de un `new Function`. */
  texto = texto.replace(/^export /gm, '')

  const nombres = [
    'es_solo_leads', 'RUTAS_SOLO_LEADS', 'ruta_permitida', 'secciones_de_cuenta',
    'seccion_de_cuenta_por_defecto', 'destino_del_aviso', 'redireccion_solo_leads', 'es_error_solo_leads',
  ]
  const modulo = new Function(texto + '\nreturn { ' + nombres.join(', ') + ' }')()

  const perfil = { id: 5, name: 'Juan', solo_leads: true }
  const normal = { id: 1, name: 'Lucas', solo_leads: false }

  /* ---- es_solo_leads ---- */
  igual('es_solo_leads({solo_leads: true}) es true', modulo.es_solo_leads({ solo_leads: true }), true)
  igual('es_solo_leads({solo_leads: false}) es false', modulo.es_solo_leads({ solo_leads: false }), false)
  igual('es_solo_leads sin la clave (API vieja) es false', modulo.es_solo_leads({ id: 1 }), false)
  igual('es_solo_leads(undefined) es false', modulo.es_solo_leads(undefined), false)
  igual('es_solo_leads(null) es false', modulo.es_solo_leads(null), false)

  /* ---- Rutas permitidas ---- */
  igual('RUTAS_SOLO_LEADS son leads, lead_conversation y account',
    modulo.RUTAS_SOLO_LEADS.slice().sort(), ['account', 'lead_conversation', 'leads'])
  igual('«leads» es una ruta permitida', modulo.ruta_permitida('leads'), true)
  igual('«lead_conversation» es una ruta permitida', modulo.ruta_permitida('lead_conversation'), true)
  igual('«account» es una ruta permitida', modulo.ruta_permitida('account'), true)
  igual('«clients» no es una ruta permitida', modulo.ruta_permitida('clients'), false)
  igual('«tasks» no es una ruta permitida', modulo.ruta_permitida('tasks'), false)
  igual('«inicio» no es una ruta permitida', modulo.ruta_permitida('inicio'), false)
  igual('una ruta sin nombre no es una ruta permitida', modulo.ruta_permitida(undefined), false)

  /* ---- Secciones de Cuenta ---- */
  const secciones = [
    { id: 'preferences', label: 'Preferencias' },
    { id: 'pwa-install', label: 'Instalar aplicación' },
    { id: 'push-notifications', label: 'Notificaciones push' },
    { id: 'whatsapp-numeros', label: 'Números de WhatsApp' },
    { id: 'precios-vigentes', label: 'Precios vigentes' },
  ]
  igual('el perfil ve sólo Instalar aplicación y Notificaciones push',
    modulo.secciones_de_cuenta(perfil, secciones).map(function (s) { return s.id }), ['pwa-install', 'push-notifications'])
  igual('«Preferencias» no se muestra al perfil (toca PUT me)',
    modulo.secciones_de_cuenta(perfil, secciones).some(function (s) { return s.id === 'preferences' }), false)
  igual('un admin normal ve todas las secciones, en el mismo orden',
    modulo.secciones_de_cuenta(normal, secciones).map(function (s) { return s.id }), secciones.map(function (s) { return s.id }))
  igual('un perfil sin sesión (null) ve todas, como hoy',
    modulo.secciones_de_cuenta(null, secciones).length, secciones.length)
  igual('la sección por defecto del perfil es push-notifications', modulo.seccion_de_cuenta_por_defecto(perfil), 'push-notifications')
  igual('la sección por defecto de un admin normal sigue siendo preferences', modulo.seccion_de_cuenta_por_defecto(normal), 'preferences')

  /* ---- Destino del aviso de una tarea ---- */
  igual('el aviso con lead abre la conversación de ese lead (perfil)',
    modulo.destino_del_aviso({ task: { lead_id: 7 } }, perfil), { name: 'lead_conversation', params: { lead_id: 7 } })
  igual('el aviso sin lead no tiene destino propio (perfil)', modulo.destino_del_aviso({ task: { lead_id: null } }, perfil), null)
  igual('el aviso sin tarea no rompe (perfil)', modulo.destino_del_aviso({}, perfil), null)
  igual('un admin normal sigue yendo a /tareas (destino null)', modulo.destino_del_aviso({ task: { lead_id: 7 } }, normal), null)

  /* ---- Redirección del guard ---- */
  igual('el perfil que entra a «clients» va a Leads', modulo.redireccion_solo_leads(perfil, 'clients'), { name: 'leads' })
  igual('el perfil que entra a una ruta sin nombre va a Leads', modulo.redireccion_solo_leads(perfil, undefined), { name: 'leads' })
  igual('el perfil que entra a «account» no se redirige', modulo.redireccion_solo_leads(perfil, 'account'), null)
  igual('el perfil que entra a «lead_conversation» no se redirige', modulo.redireccion_solo_leads(perfil, 'lead_conversation'), null)
  igual('un admin normal nunca se redirige', modulo.redireccion_solo_leads(normal, 'clients'), null)

  /* ---- El 403 de fondo que no se avisa ---- */
  igual('403 con code solo_leads se reconoce',
    modulo.es_error_solo_leads({ response: { status: 403, data: { code: 'solo_leads' } } }), true)
  igual('403 con otro code no se silencia',
    modulo.es_error_solo_leads({ response: { status: 403, data: { code: 'otro' } } }), false)
  igual('403 sin cuerpo no se silencia', modulo.es_error_solo_leads({ response: { status: 403 } }), false)
  igual('un 500 con code solo_leads no se silencia',
    modulo.es_error_solo_leads({ response: { status: 500, data: { code: 'solo_leads' } } }), false)
  igual('un error de red (sin response) no se silencia', modulo.es_error_solo_leads({ message: 'Network Error' }), false)
  igual('un error nulo no rompe', modulo.es_error_solo_leads(null), false)
}

/* ---- Los demás archivos sólo llaman a la lógica de solo_leads.js ---- */
/** Afirma que un archivo existe y contiene el patrón. */
function contiene(descripcion, archivo, patron) {
  const contenido = leer(...archivo)
  cierto(descripcion, contenido !== null && patron.test(contenido))
}

contiene('nav.js filtra el menú del perfil con solo_leads.js', ['src', 'router', 'nav.js'], /utils\/solo_leads/)
contiene('nav.js manda al perfil a Leads al entrar', ['src', 'router', 'nav.js'], /es_solo_leads\(/)
contiene('guard.js redirige al perfil con solo_leads.js', ['src', 'router', 'guard.js'], /redireccion_solo_leads/)
contiene('axios.js no avisa el 403 solo_leads', ['src', 'utils', 'axios.js'], /es_error_solo_leads/)
contiene('account_sections.js resuelve la sección por defecto del perfil', ['src', 'components', 'account', 'account_sections.js'], /seccion_de_cuenta_por_defecto/)
contiene('AccountSectionNav.vue usa secciones_de_cuenta', ['src', 'components', 'account', 'AccountSectionNav.vue'], /secciones_de_cuenta/)
contiene('Account.vue usa la sección por defecto del perfil', ['src', 'views', 'Account.vue'], /seccion_de_cuenta_por_defecto|resolve_account_section_from_hash\([^)]*admin/)
contiene('TaskNotificationStack.vue usa destino_del_aviso', ['src', 'components', 'task', 'TaskNotificationStack.vue'], /destino_del_aviso/)
contiene('AdminUsers.vue tiene el tilde «Sólo Leads» ligado a form.solo_leads', ['src', 'views', 'AdminUsers.vue'], /v-model="form\.solo_leads"/)
contiene('AdminUsers.vue lo manda en el payload', ['src', 'views', 'AdminUsers.vue'], /solo_leads:\s*self\.form\.solo_leads/)
contiene('LeadConversationView.vue define el computed solo_lectura', ['src', 'views', 'LeadConversationView.vue'], /solo_lectura\s*\(\)/)
contiene('LeadConversationView.vue le pasa solo_lectura a message-bubble', ['src', 'views', 'LeadConversationView.vue'], /:solo_lectura="solo_lectura"/)
contiene('MessageBubble.vue recibe la prop solo_lectura', ['src', 'components', 'lead', 'conversation', 'MessageBubble.vue'], /solo_lectura:\s*\{/)
contiene('Leads.vue deja sin solapas extra al perfil', ['src', 'views', 'Leads.vue'], /es_solo_leads/)

/* La lógica del perfil no se repite: ningún otro archivo del SPA compara el flag a mano. */
const lectura_de_flag = []
;(function recorrer(carpeta) {
  fs.readdirSync(carpeta, { withFileTypes: true }).forEach(function (entrada) {
    const ruta = path.join(carpeta, entrada.name)
    if (entrada.isDirectory()) {
      recorrer(ruta)
      return
    }
    if (!/\.(js|vue)$/.test(entrada.name) || entrada.name === 'solo_leads.js') {
      return
    }
    const contenido = fs.readFileSync(ruta, 'utf8')
    /* `form.solo_leads` y `solo_leads:` del alta de Usuarios admin son datos del formulario, no decisión. */
    if (/(admin|profile|perfil)\.solo_leads/.test(contenido)) {
      lectura_de_flag.push(path.relative(RAIZ, ruta))
    }
  })
})(path.join(RAIZ, 'src'))
igual('ningún archivo fuera de solo_leads.js lee admin.solo_leads a mano (salvo la fila de Usuarios admin)',
  lectura_de_flag.filter(function (archivo) { return archivo !== path.join('src', 'views', 'AdminUsers.vue') }), [])

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
