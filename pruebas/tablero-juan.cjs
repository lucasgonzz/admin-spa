/*
  Prueba de aceptación CA13 de la misión embudo-juan-pipeline (etapa E1): el tablero de Juan en el
  admin-spa (Pipelines, «Registrar llamada», «Mis tareas», acceso del perfil «Sólo Leads» y tarjetas
  de estado v2).

  Se corre con `node pruebas/tablero-juan.cjs`. No necesita dependencias: `admin-spa` no tiene
  corredor de tests (misma convención que pruebas/solo-leads.cjs).

  Qué fija:
    1. `src/utils/solo_leads.js` (se extrae del ARCHIVO REAL, no de una copia):
       - el perfil puede abrir `pipelines` y `pipelines_tablero`, y NO `pipelines_configuracion`
         ni `pipelines_agenda` (el backend las responde 403);
       - `RUTAS_SOLO_LEADS` NO cambia (lo fija pruebas/solo-leads.cjs): las rutas del tablero van en
         una lista aparte, `RUTAS_DEL_TABLERO_SOLO_LEADS`;
       - `ruta_de_entrada_al_tablero()` devuelve `{name: 'pipelines_tablero', query: {pipeline: 'lead'}}`;
       - el guard ya no redirige al perfil cuando entra al tablero, y sí cuando entra a Configuración.
    2. `src/utils/registrar_llamada.js` (lógica pura, sin imports, igual que solo_leads.js):
       - `RESULTADOS`, `requiere_fecha`, `admite_fecha`, `requiere_motivo`, `validar` y `payload`,
         que reflejan las validaciones de `POST lead/{id}/llamadas` (§2.1.3 del plan) para que la
         pantalla avise antes de mandar: sin atender exige fecha futura; «volver a llamar» exige
         fecha; «no le interesa» exige un motivo de la lista del pipeline.
    3. Que los archivos de la pantalla estén conectados entre sí (menú, tablero, tarjeta, ficha,
       conversación, store) y que el tablero siga desplazándose dentro de su contenedor.

  La verificación visual (tres anchos, perfil de Juan y de Lucas) la hace el Coordinador en el
  navegador: acá no se levanta nada.
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

/**
 * Carga un módulo de lógica pura (sin imports) y devuelve los nombres pedidos. Saca el `export` de
 * cada declaración porque Node no los entiende dentro de un `new Function`.
 * Devuelve null (y cuenta una falla) si el archivo no existe.
 */
function cargar_modulo(archivo, nombres) {
  let texto = leer(...archivo)
  if (texto === null) {
    console.log('FALLA  no existe ' + archivo.join('/'))
    fallos++
    corridas++
    return null
  }
  texto = texto.replace(/^export /gm, '')
  /* Un nombre que el archivo todavía no define queda undefined, y cada comprobación falla sola. */
  const devolver = nombres.map(function (nombre) {
    return nombre + ': (typeof ' + nombre + " === 'undefined' ? undefined : " + nombre + ')'
  })
  try {
    return new Function(texto + '\nreturn { ' + devolver.join(', ') + ' }')()
  } catch (error) {
    console.log('FALLA  ' + archivo.join('/') + ' no se puede evaluar: ' + error.message)
    fallos++
    corridas++
    return null
  }
}

/* ================================================================================================
   1. Acceso del perfil «Sólo Leads» al tablero (src/utils/solo_leads.js)
   ================================================================================================ */
const solo = cargar_modulo(['src', 'utils', 'solo_leads.js'], [
  'RUTAS_SOLO_LEADS', 'RUTAS_DEL_TABLERO_SOLO_LEADS', 'ruta_permitida', 'ruta_de_entrada_al_tablero',
  'redireccion_solo_leads',
])

if (solo !== null) {
  const perfil = { id: 5, name: 'Juan', solo_leads: true }
  const normal = { id: 1, name: 'Lucas', solo_leads: false }

  igual('«pipelines_tablero» es una ruta permitida', solo.ruta_permitida('pipelines_tablero'), true)
  igual('«pipelines» (el padre del menú) es una ruta permitida', solo.ruta_permitida('pipelines'), true)
  igual('«pipelines_configuracion» NO es una ruta permitida', solo.ruta_permitida('pipelines_configuracion'), false)
  igual('«pipelines_agenda» NO es una ruta permitida (el backend la niega)', solo.ruta_permitida('pipelines_agenda'), false)
  igual('las rutas de siempre siguen permitidas', ['leads', 'lead_conversation', 'account'].map(solo.ruta_permitida), [true, true, true])
  igual('«tasks» y «clients» siguen sin estar permitidas', [solo.ruta_permitida('tasks'), solo.ruta_permitida('clients')], [false, false])

  igual('RUTAS_SOLO_LEADS no cambia: sólo leads, lead_conversation y account',
    solo.RUTAS_SOLO_LEADS && solo.RUTAS_SOLO_LEADS.slice().sort(), ['account', 'lead_conversation', 'leads'])
  igual('RUTAS_DEL_TABLERO_SOLO_LEADS son pipelines y pipelines_tablero',
    solo.RUTAS_DEL_TABLERO_SOLO_LEADS && solo.RUTAS_DEL_TABLERO_SOLO_LEADS.slice().sort(), ['pipelines', 'pipelines_tablero'])

  igual('la entrada al tablero es el pipeline «lead»',
    typeof solo.ruta_de_entrada_al_tablero === 'function' ? solo.ruta_de_entrada_al_tablero() : null,
    { name: 'pipelines_tablero', query: { pipeline: 'lead' } })

  igual('el perfil que entra al tablero no se redirige', solo.redireccion_solo_leads(perfil, 'pipelines_tablero'), null)
  igual('el perfil que entra a Configuración de pipelines va a Leads',
    solo.redireccion_solo_leads(perfil, 'pipelines_configuracion'), { name: 'leads' })
  igual('el perfil que entra a la Agenda de pipelines va a Leads', solo.redireccion_solo_leads(perfil, 'pipelines_agenda'), { name: 'leads' })
  igual('un admin normal nunca se redirige', solo.redireccion_solo_leads(normal, 'pipelines_configuracion'), null)
}

/* ================================================================================================
   2. Lógica pura del modal «Registrar llamada» (src/utils/registrar_llamada.js)
   ================================================================================================ */
const llamada = cargar_modulo(['src', 'utils', 'registrar_llamada.js'], [
  'RESULTADOS', 'requiere_fecha', 'admite_fecha', 'requiere_motivo', 'validar', 'payload',
])

if (llamada !== null) {
  /* Lunes 23/11/2026, 12:00 (hora local): el «ahora» de todas las validaciones. */
  const ahora = new Date(2026, 10, 23, 12, 0, 0)
  const motivos = ['Precio', 'No lo necesita', 'Se fue con otro sistema', 'No es el momento', 'No contesta', 'Otro']
  const opciones = { ahora: ahora, motivos: motivos }

  /** Arma un formulario a partir de los campos que importan en cada caso. */
  function formulario(campos) {
    return Object.assign({
      atendio: null, resultado: '', motivo: '', proxima_llamada_at: '', cotizado: '', notas: '',
    }, campos)
  }

  /** Nombres de los campos con error, ordenados. */
  function campos_con_error(form) {
    return Object.keys(llamada.validar(form, opciones) || {}).sort()
  }

  /* ---- Resultados ---- */
  igual('los seis resultados, en el orden del plan',
    (llamada.RESULTADOS || []).map(function (r) { return r.value }),
    ['sigue_solo', 'implementacion_acordada', 'pago_la_mitad', 'volver_a_llamar', 'no_le_interesa', 'ya_contrato'])
  igual('las etiquetas son las del plan',
    (llamada.RESULTADOS || []).map(function (r) { return r.label }),
    ['Sigue solo con la prueba', 'Implementación acordada', 'Pagó la mitad', 'Volver a llamar', 'No le interesa', 'Ya contrató'])

  /* ---- Qué pide cada caso ---- */
  igual('no atendió pide fecha', llamada.requiere_fecha(formulario({ atendio: false })), true)
  igual('volver a llamar pide fecha', llamada.requiere_fecha(formulario({ atendio: true, resultado: 'volver_a_llamar' })), true)
  igual('sigue solo no pide fecha', llamada.requiere_fecha(formulario({ atendio: true, resultado: 'sigue_solo' })), false)
  igual('implementación acordada admite fecha pero no la exige',
    [llamada.admite_fecha(formulario({ atendio: true, resultado: 'implementacion_acordada' })),
      llamada.requiere_fecha(formulario({ atendio: true, resultado: 'implementacion_acordada' }))], [true, false])
  igual('«no le interesa» no admite fecha', llamada.admite_fecha(formulario({ atendio: true, resultado: 'no_le_interesa' })), false)
  igual('«no le interesa» pide motivo', llamada.requiere_motivo(formulario({ atendio: true, resultado: 'no_le_interesa' })), true)
  igual('«no le interesa» sin haber atendido no pide motivo (el resultado se ignora)',
    llamada.requiere_motivo(formulario({ atendio: false, resultado: 'no_le_interesa' })), false)
  igual('«sigue solo» no pide motivo', llamada.requiere_motivo(formulario({ atendio: true, resultado: 'sigue_solo' })), false)

  /* ---- validar: sin atender exige fecha futura ---- */
  igual('sin decir si atendió: error en atendio', campos_con_error(formulario({})), ['atendio'])
  igual('no atendió y sin fecha: error en proxima_llamada_at', campos_con_error(formulario({ atendio: false })), ['proxima_llamada_at'])
  igual('no atendió y fecha pasada: error en proxima_llamada_at',
    campos_con_error(formulario({ atendio: false, proxima_llamada_at: '2026-11-22T09:00' })), ['proxima_llamada_at'])
  igual('no atendió y fecha futura: sin errores',
    campos_con_error(formulario({ atendio: false, proxima_llamada_at: '2026-11-25T11:00' })), [])
  igual('no atendió ignora un resultado a medio elegir (aunque sea «no le interesa» sin motivo)',
    campos_con_error(formulario({ atendio: false, resultado: 'no_le_interesa', proxima_llamada_at: '2026-11-25T11:00' })), [])

  /* ---- validar: atendió ---- */
  igual('atendió y sin resultado: error en resultado', campos_con_error(formulario({ atendio: true })), ['resultado'])
  igual('atendió con un resultado que no existe: error en resultado',
    campos_con_error(formulario({ atendio: true, resultado: 'se_enamoro' })), ['resultado'])
  igual('«sigue solo»: sin errores', campos_con_error(formulario({ atendio: true, resultado: 'sigue_solo' })), [])
  igual('«ya contrató»: sin errores', campos_con_error(formulario({ atendio: true, resultado: 'ya_contrato' })), [])
  igual('«pagó la mitad»: sin errores', campos_con_error(formulario({ atendio: true, resultado: 'pago_la_mitad' })), [])
  igual('volver a llamar sin fecha: error en proxima_llamada_at',
    campos_con_error(formulario({ atendio: true, resultado: 'volver_a_llamar' })), ['proxima_llamada_at'])
  igual('volver a llamar con fecha pasada: error en proxima_llamada_at',
    campos_con_error(formulario({ atendio: true, resultado: 'volver_a_llamar', proxima_llamada_at: '2026-11-20T10:00' })), ['proxima_llamada_at'])
  igual('volver a llamar con fecha futura: sin errores',
    campos_con_error(formulario({ atendio: true, resultado: 'volver_a_llamar', proxima_llamada_at: '2026-12-01T10:00' })), [])
  igual('implementación acordada sin fecha: sin errores (el backend pone dos días)',
    campos_con_error(formulario({ atendio: true, resultado: 'implementacion_acordada' })), [])
  igual('«no le interesa» sin motivo: error en motivo',
    campos_con_error(formulario({ atendio: true, resultado: 'no_le_interesa' })), ['motivo'])
  igual('«no le interesa» con un motivo que no es de la lista: error en motivo',
    campos_con_error(formulario({ atendio: true, resultado: 'no_le_interesa', motivo: 'Porque sí' })), ['motivo'])
  igual('«no le interesa» con el motivo «Precio»: sin errores',
    campos_con_error(formulario({ atendio: true, resultado: 'no_le_interesa', motivo: 'Precio' })), [])
  igual('notas de más de 5000 caracteres: error en notas',
    campos_con_error(formulario({ atendio: true, resultado: 'sigue_solo', notas: 'a'.repeat(5001) })), ['notas'])
  igual('notas de exactamente 5000 caracteres: sin errores',
    campos_con_error(formulario({ atendio: true, resultado: 'sigue_solo', notas: 'a'.repeat(5000) })), [])
  igual('cotizado de más de 255 caracteres: error en cotizado',
    campos_con_error(formulario({ atendio: true, resultado: 'sigue_solo', cotizado: '9'.repeat(256) })), ['cotizado'])
  igual('los errores traen un mensaje en castellano',
    typeof (llamada.validar(formulario({ atendio: false }), opciones) || {}).proxima_llamada_at, 'string')

  /* ---- payload: lo que viaja a POST lead/{id}/llamadas ---- */
  igual('payload de no atendió: sólo atendio y la fecha en formato Y-m-d H:i, sin resultado ni motivo',
    llamada.payload(formulario({ atendio: false, resultado: 'no_le_interesa', motivo: 'Precio', proxima_llamada_at: '2026-11-25T11:00' })),
    { atendio: false, proxima_llamada_at: '2026-11-25 11:00' })
  igual('payload de «sigue solo»: sin motivo ni fecha, con notas y cotizado recortados',
    llamada.payload(formulario({ atendio: true, resultado: 'sigue_solo', motivo: 'Precio', proxima_llamada_at: '2026-11-25T11:00',
      cotizado: '  Gestión $628.400  ', notas: '  Quiere probar solo.  ' })),
    { atendio: true, resultado: 'sigue_solo', cotizado: 'Gestión $628.400', notas: 'Quiere probar solo.' })
  igual('payload de «no le interesa»: lleva el motivo',
    llamada.payload(formulario({ atendio: true, resultado: 'no_le_interesa', motivo: 'Precio' })),
    { atendio: true, resultado: 'no_le_interesa', motivo: 'Precio' })
  igual('payload de «volver a llamar»: lleva la fecha',
    llamada.payload(formulario({ atendio: true, resultado: 'volver_a_llamar', proxima_llamada_at: '2026-12-01T10:00' })),
    { atendio: true, resultado: 'volver_a_llamar', proxima_llamada_at: '2026-12-01 10:00' })
  igual('payload de implementación acordada con fecha opcional: la lleva si la hay',
    llamada.payload(formulario({ atendio: true, resultado: 'implementacion_acordada', proxima_llamada_at: '2026-11-26T15:00' })),
    { atendio: true, resultado: 'implementacion_acordada', proxima_llamada_at: '2026-11-26 15:00' })
  igual('payload de implementación acordada sin fecha: no manda la clave',
    llamada.payload(formulario({ atendio: true, resultado: 'implementacion_acordada' })),
    { atendio: true, resultado: 'implementacion_acordada' })
}

/* ================================================================================================
   3. Los archivos de la pantalla están conectados entre sí
   ================================================================================================ */
/** Afirma que un archivo existe y contiene el patrón. */
function contiene(descripcion, archivo, patron) {
  const contenido = leer(...archivo)
  cierto(descripcion, contenido !== null && patron.test(contenido))
}

/** Afirma que un archivo existe y NO contiene el patrón. */
function no_contiene(descripcion, archivo, patron) {
  const contenido = leer(...archivo)
  cierto(descripcion, contenido !== null && !patron.test(contenido))
}

/* ---- Menú ---- */
contiene('nav.js lleva el ítem «Pipelines» del perfil al tablero con ruta_de_entrada_al_tablero()',
  ['src', 'router', 'nav.js'], /ruta_de_entrada_al_tablero\(/)

/* ---- Componentes nuevos ---- */
contiene('RegistrarLlamadaModal.vue usa la lógica de registrar_llamada.js',
  ['src', 'components', 'lead', 'RegistrarLlamadaModal.vue'], /@\/utils\/registrar_llamada/)
contiene('RegistrarLlamadaModal.vue manda POST /lead/{id}/llamadas',
  ['src', 'components', 'lead', 'RegistrarLlamadaModal.vue'], /\/llamadas/)
contiene('RegistrarLlamadaModal.vue avisa con el evento «registrada»',
  ['src', 'components', 'lead', 'RegistrarLlamadaModal.vue'], /emits:\s*\[[^\]]*'registrada'/)
contiene('MisTareas.vue pide lead-tablero/mis-tareas',
  ['src', 'components', 'pipeline', 'MisTareas.vue'], /lead-tablero\/mis-tareas/)
contiene('MisTareas.vue marca hecha con POST lead-tablero/tareas/{id}/hecha',
  ['src', 'components', 'pipeline', 'MisTareas.vue'], /lead-tablero\/tareas\/.*\/hecha/)
contiene('MisTareas.vue tiene «Abrir conversación» y «Hecha»',
  ['src', 'components', 'pipeline', 'MisTareas.vue'], /Abrir conversación[\s\S]*Hecha|Hecha[\s\S]*Abrir conversación/)
contiene('MisTareas.vue no desborda la página (min-width: 0)',
  ['src', 'components', 'pipeline', 'MisTareas.vue'], /min-width:\s*0/)

/* ---- Tablero ---- */
contiene('Tablero.vue decide el perfil con es_solo_leads() de solo_leads.js',
  ['src', 'views', 'pipelines', 'Tablero.vue'], /es_solo_leads\(/)
contiene('Tablero.vue muestra <mis-tareas>', ['src', 'views', 'pipelines', 'Tablero.vue'], /<mis-tareas/)
contiene('Tablero.vue abre <registrar-llamada-modal>', ['src', 'views', 'pipelines', 'Tablero.vue'], /<registrar-llamada-modal/)
contiene('Tablero.vue escucha registrar-llamada del tablero', ['src', 'views', 'pipelines', 'Tablero.vue'], /@registrar-llamada=/)
contiene('Board.vue propaga registrar-llamada', ['src', 'components', 'pipeline', 'Board.vue'], /emits:\s*\[[^\]]*'registrar-llamada'/)
contiene('BoardColumn.vue propaga registrar-llamada', ['src', 'components', 'pipeline', 'BoardColumn.vue'], /emits:\s*\[[^\]]*'registrar-llamada'/)
contiene('el tablero sigue desplazándose dentro de su contenedor (overflow-x: auto)',
  ['src', 'components', 'pipeline', 'Board.vue'], /\.pl-board\s*\{[^}]*overflow-x:\s*auto/)
contiene('el tablero nunca es más ancho que su padre (max-width: 100%)',
  ['src', 'components', 'pipeline', 'Board.vue'], /\.pl-board\s*\{[^}]*max-width:\s*100%/)

/* ---- Tarjeta ---- */
contiene('OpportunityCard.vue tiene el botón «Registrar llamada»', ['src', 'components', 'pipeline', 'OpportunityCard.vue'], /Registrar llamada/)
contiene('OpportunityCard.vue emite registrar-llamada', ['src', 'components', 'pipeline', 'OpportunityCard.vue'], /emits:\s*\[[^\]]*'registrar-llamada'/)
contiene('OpportunityCard.vue muestra «Cotizado: …» con lo que trae la tarjeta',
  ['src', 'components', 'pipeline', 'OpportunityCard.vue'], /Cotizado:[\s\S]*opportunity\.cotizado|opportunity\.cotizado[\s\S]*Cotizado:/)

/* ---- Ficha ---- */
contiene('OpportunityModal.vue tiene «Registrar llamada»', ['src', 'components', 'pipeline', 'OpportunityModal.vue'], /Registrar llamada/)
contiene('OpportunityModal.vue lista las llamadas con GET /lead/{id}/llamadas',
  ['src', 'components', 'pipeline', 'OpportunityModal.vue'], /\/lead\/.*\/llamadas/)
contiene('OpportunityModal.vue muestra «por audio de Juan» y quién la cargó (E1b)',
  ['src', 'components', 'pipeline', 'OpportunityModal.vue'], /por audio de Juan[\s\S]*cargada_por|cargada_por[\s\S]*por audio de Juan/)
contiene('OpportunityModal.vue le saca borrar y responsable al perfil con es_solo_leads()',
  ['src', 'components', 'pipeline', 'OpportunityModal.vue'], /es_solo_leads\(/)

/* ---- Conversación del lead ---- */
contiene('LeadConversationView.vue abre <registrar-llamada-modal>',
  ['src', 'views', 'LeadConversationView.vue'], /<registrar-llamada-modal/)
{
  const vista = leer('src', 'views', 'LeadConversationView.vue')
  /* La etiqueta de apertura del botón: tiene que existir y NO colgar de solo_lectura (Juan lo ve). */
  const apertura = vista === null ? null : (vista.match(/<button[^>]*title="Registrar llamada"[^>]*>/) || [null])[0]
  cierto('LeadConversationView.vue tiene el botón «Registrar llamada» en el encabezado', apertura !== null)
  cierto('el botón «Registrar llamada» se ve también en sólo lectura (no cuelga de solo_lectura)',
    apertura !== null && !/solo_lectura/.test(apertura))
}

/* ---- Tarjetas de estado v2 ---- */
{
  const store = leer('src', 'store', 'lead.js')
  const accion = store === null ? '' : (store.match(/fetch_status_cards\(context\)\s*\{[\s\S]*?\n    \},/) || [''])[0]
  cierto('store/lead.js pide las tarjetas con version=2', /status-cards[\s\S]*version(=|:\s*)2/.test(accion))
}

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
