/*
  Prueba de aceptación de la misión leads-referidos-compromisos en el admin-spa.

  Se corre con `node pruebas/leads-referidos-compromisos.cjs`. No necesita dependencias: `admin-spa` no
  tiene corredor de tests (misma convención que pruebas/tablero-juan.cjs y pruebas/solo-leads.cjs). Las
  funciones se extraen de los ARCHIVOS REALES de `src/`, no de copias, así que si el archivo cambia la
  prueba lo ve.

  Etapa E1 (leads de otros medios), criterio CA8 del PLAN:
    1. `src/utils/alta_externa.js` (lógica pura, sin imports):
       - `ORIGENES`: los cuatro orígenes externos con su etiqueta; `ESTADOS`: los tres estados iniciales.
       - `validar()`: teléfono y nombre obligatorios; origen fuera de la lista, estado inicial fuera de la
         lista, contexto de más de 60.000 caracteres y «referido por» de más de 120, con error por campo.
       - `payload()`: descarta los campos vacíos y manda `entrar_al_tablero` SIEMPRE como booleano.
    2. Que los archivos de la pantalla estén conectados entre sí: `Leads.vue` importa y monta
       `AltaExternaModal` (botón «Nuevo lead de otro medio»); el modal llama a `POST /lead/externo`, maneja el
       409 ofreciendo completar el lead existente y navega a la conversación del lead.

  Etapas siguientes (NO se prueban todavía; se suman en sus propios commits de tests, sin tocar lo de acá):
    - E2, CA18: interruptores y nombres de plantilla en `LeadWhatsappOnboardingSection.vue`, y
      `CompromisoVigente.vue` montado en la barra lateral y en la ficha.
    - E3, CA22: `grabacion_de_llamada.js` (partes de 4 MB, formatos y tope) y la subida en
      `RegistrarLlamadaModal.vue`.

  La verificación visual (tres anchos, perfil de Juan y de Lucas) la hace el Coordinador en el navegador:
  acá no se levanta nada.
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

/** Devuelve una copia del objeto con las claves ordenadas, para comparar sin depender del orden. */
function ordenado(objeto) {
  if (objeto === null || typeof objeto !== 'object' || Array.isArray(objeto)) {
    return objeto
  }
  const copia = {}
  Object.keys(objeto).sort().forEach(function (clave) {
    copia[clave] = objeto[clave]
  })
  return copia
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
 * Carga un módulo de lógica pura (sin imports) y devuelve los nombres pedidos. Saca el `export` de cada
 * declaración porque Node no los entiende dentro de un `new Function`. Devuelve null (y cuenta una falla)
 * si el archivo no existe.
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

/** Afirma que un archivo existe y contiene el patrón. */
function contiene(descripcion, archivo, patron) {
  const contenido = leer(...archivo)
  cierto(descripcion, contenido !== null && patron.test(contenido))
}

/* ================================================================================================
   1. Lógica pura del alta de un lead de otro medio (src/utils/alta_externa.js)
   ================================================================================================ */
const alta = cargar_modulo(['src', 'utils', 'alta_externa.js'], ['ORIGENES', 'ESTADOS', 'validar', 'payload'])

if (alta !== null) {
  /** Formulario válido (el caso de Ro) con lo que se quiera pisar. */
  function formulario(campos) {
    return Object.assign({
      origen: 'referido',
      contact_name: 'Ro',
      phone: '+54 9 3484 52-1016',
      company_name: '',
      business_type: '',
      email: '',
      referido_por_client_id: null,
      referido_por_texto: '',
      contexto_previo: '',
      estado_inicial: 'nuevo',
      entrar_al_tablero: false,
      primer_contacto: 'ninguno',
    }, campos)
  }

  /** Nombres de los campos con error, ordenados. */
  function campos_con_error(form) {
    return Object.keys(alta.validar(form) || {}).sort()
  }

  /* ---- Listas ---- */
  igual('los cuatro orígenes externos, en orden',
    (alta.ORIGENES || []).map(function (o) { return o.value }),
    ['referido', 'whatsapp_personal', 'llamada', 'otro'])
  igual('las etiquetas de los orígenes son las del plan',
    (alta.ORIGENES || []).map(function (o) { return o.label }),
    ['Referido', 'WhatsApp de Lucas', 'Llamada', 'Otro medio'])
  igual('los tres estados iniciales posibles, «Nuevo» primero (es el default)',
    (alta.ESTADOS || []).map(function (e) { return e.value }),
    ['nuevo', 'contactado', 'link_enviado'])
  igual('«link_enviado» se muestra como «Quiere probar»',
    (alta.ESTADOS || []).filter(function (e) { return e.value === 'link_enviado' }).map(function (e) { return e.label }),
    ['Quiere probar'])

  /* ---- validar ---- */
  igual('un formulario completo no tiene errores', campos_con_error(formulario({})), [])
  igual('sin teléfono: error en phone', campos_con_error(formulario({ phone: '' })), ['phone'])
  igual('teléfono sólo con espacios: error en phone', campos_con_error(formulario({ phone: '   ' })), ['phone'])
  igual('sin nombre: error en contact_name', campos_con_error(formulario({ contact_name: '' })), ['contact_name'])
  igual('sin teléfono y sin nombre: los dos errores', campos_con_error(formulario({ phone: '', contact_name: '' })), ['contact_name', 'phone'])
  igual('origen fuera de la lista («landing» no es un origen externo): error en origen',
    campos_con_error(formulario({ origen: 'landing' })), ['origen'])
  igual('sin origen: error en origen', campos_con_error(formulario({ origen: '' })), ['origen'])
  igual('cada origen de la lista es válido',
    ['referido', 'whatsapp_personal', 'llamada', 'otro'].map(function (origen) { return campos_con_error(formulario({ origen: origen })).length }),
    [0, 0, 0, 0])
  igual('estado inicial fuera de la lista: error en estado_inicial',
    campos_con_error(formulario({ estado_inicial: 'cerrado_ganado' })), ['estado_inicial'])
  igual('contexto de 60.000 caracteres: sin error', campos_con_error(formulario({ contexto_previo: 'a'.repeat(60000) })), [])
  igual('contexto de 60.001 caracteres: error en contexto_previo',
    campos_con_error(formulario({ contexto_previo: 'a'.repeat(60001) })), ['contexto_previo'])
  igual('«referido por» de más de 120 caracteres: error en referido_por_texto',
    campos_con_error(formulario({ referido_por_texto: 'a'.repeat(121) })), ['referido_por_texto'])
  igual('cada error es un mensaje en castellano (texto no vacío)',
    Object.keys(alta.validar(formulario({ phone: '' })) || {}).every(function (campo) {
      return typeof alta.validar(formulario({ phone: '' }))[campo] === 'string' && alta.validar(formulario({ phone: '' }))[campo].length > 0
    }), true)

  /* ---- payload ---- */
  igual('el payload descarta los campos vacíos y manda entrar_al_tablero como booleano',
    ordenado(alta.payload(formulario({ company_name: '', email: null, business_type: undefined, entrar_al_tablero: undefined }))),
    ordenado({ origen: 'referido', contact_name: 'Ro', phone: '+54 9 3484 52-1016', estado_inicial: 'nuevo', entrar_al_tablero: false, primer_contacto: 'ninguno' }))
  igual('un campo con sólo espacios se descarta',
    Object.keys(alta.payload(formulario({ company_name: '   ', referido_por_texto: '  ' })) || {}).sort(),
    ['contact_name', 'entrar_al_tablero', 'estado_inicial', 'origen', 'phone', 'primer_contacto'])
  igual('entrar_al_tablero llega true cuando se tildó',
    alta.payload(formulario({ entrar_al_tablero: true })).entrar_al_tablero, true)
  igual('entrar_al_tablero llega false (y no falta) cuando no se tildó',
    [alta.payload(formulario({ entrar_al_tablero: false })).entrar_al_tablero, 'entrar_al_tablero' in alta.payload(formulario({ entrar_al_tablero: false }))],
    [false, true])
  igual('el cliente que lo refirió y el contexto viajan cuando están',
    ordenado(alta.payload(formulario({ referido_por_client_id: 12, contexto_previo: 'Usa el SIAP.', company_name: 'Kiosco Ro' }))),
    ordenado({
      origen: 'referido', contact_name: 'Ro', phone: '+54 9 3484 52-1016', estado_inicial: 'nuevo', entrar_al_tablero: false,
      primer_contacto: 'ninguno', referido_por_client_id: 12, contexto_previo: 'Usa el SIAP.', company_name: 'Kiosco Ro',
    }))
  igual('el payload no inventa claves: no manda completar_existente por su cuenta',
    'completar_existente' in alta.payload(formulario({})), false)
}

/* ================================================================================================
   2. Los archivos de la pantalla están conectados entre sí
   ================================================================================================ */
const MODAL = ['src', 'components', 'lead', 'AltaExternaModal.vue']
const LEADS = ['src', 'views', 'Leads.vue']

/* ---- El modal ---- */
cierto('existe src/components/lead/AltaExternaModal.vue', leer(...MODAL) !== null)
contiene('AltaExternaModal.vue usa la lógica de alta_externa.js', MODAL, /@\/utils\/alta_externa/)
contiene('AltaExternaModal.vue manda POST /lead/externo', MODAL, /\.post\(\s*['"`]\/lead\/externo['"`]/)
contiene('AltaExternaModal.vue maneja el 409 («lead_existente»)', MODAL, /409[\s\S]*lead_existente|lead_existente[\s\S]*409/)
contiene('AltaExternaModal.vue ofrece «Completar el lead #N»', MODAL, /Completar el lead/)
contiene('AltaExternaModal.vue reenvía con completar_existente', MODAL, /completar_existente/)
contiene('AltaExternaModal.vue navega a la conversación del lead al terminar', MODAL, /name:\s*['"]lead_conversation['"][\s\S]*lead_id/)

/* ---- La vista de Leads ---- */
contiene('Leads.vue importa AltaExternaModal', LEADS, /import\s+AltaExternaModal\s+from\s+['"]@\/components\/lead\/AltaExternaModal\.vue['"]/)
contiene('Leads.vue lo registra como componente', LEADS, /components:\s*\{[\s\S]*AltaExternaModal/)
contiene('Leads.vue monta <alta-externa-modal>', LEADS, /<alta-externa-modal|<AltaExternaModal/)
contiene('Leads.vue tiene el botón «Nuevo lead de otro medio»', LEADS, /Nuevo lead de otro medio/)

/* ---- Ajuste de interfaz de la verificación visual (E1): el modal se cierra y se limpia al terminar ---- */
const texto_del_modal = leer(...MODAL) || ''
const en_exito = texto_del_modal.indexOf("self.$emit('creado'")
const cierre = texto_del_modal.indexOf("self.$emit('close')", en_exito)
const navegar = texto_del_modal.indexOf('self.$router.push', en_exito)
cierto('AltaExternaModal.vue emite «close» después de «creado» y ANTES de navegar a la conversación',
  en_exito !== -1 && cierre !== -1 && navegar !== -1 && cierre < navegar)
contiene('AltaExternaModal.vue limpia el formulario al terminar con éxito (también al completar el existente)', MODAL, /reiniciar_formulario\(\)[\s\S]*self\.\$emit\('close'\)/)
contiene('motivo_legible traduce «no_recibe_mensajes»', MODAL, /no_recibe_mensajes:\s*['"][^'"]+['"]/)
contiene('motivo_legible traduce «ya_es_cliente»', MODAL, /ya_es_cliente:\s*['"][^'"]+['"]/)
contiene('motivo_legible traduce «primer_contacto_ya_enviado»', MODAL, /primer_contacto_ya_enviado:\s*['"][^'"]+['"]/)

/* ================================================================================================
   3. Etapa E2 — motor de compromisos (criterio CA18 del PLAN y el montaje del compromiso vigente)

   Interruptores y nombres de plantilla en la sección de Cuenta (`LeadWhatsappOnboardingSection.vue`):
     - `compromisos_activo`, `compromisos_deteccion_ia` y `compromisos_envio_automatico` (switches, apagados por defecto);
     - `compromiso_plantilla` (default `cc_coord_dia_acordado`) y `referido_plantilla` (default vacío).
     Cada uno tiene que estar en los tres lugares de la sección: el valor por defecto del formulario, la carga del GET y el
     cuerpo del PUT (si no, la pantalla los muestra pero no los guarda), y en el template con su `v-model`.
   `CompromisoVigente.vue` (fecha en palabras, acción, origen, resumen, «Cambiar fecha» y «Cancelar») lo monta la barra lateral
   de la conversación (`LeadConversationSidebar.vue`) y la ficha del tablero (`OpportunityModal.vue`). Lo usa también Juan
   (perfil «Sólo Leads»): ve, reprograma y cancela, así que el componente NO se esconde con `es_solo_leads`.
   ================================================================================================ */
const SECCION = ['src', 'components', 'account', 'sections', 'LeadWhatsappOnboardingSection.vue']
const CLAVES_DE_COMPROMISOS = [
  'compromisos_activo', 'compromisos_deteccion_ia', 'compromisos_envio_automatico', 'compromiso_plantilla', 'referido_plantilla',
]
const texto_de_la_seccion = leer(...SECCION) || ''
const inicio_del_put = texto_de_la_seccion.indexOf(".put('/settings/lead-whatsapp-onboarding'")
const bloque_del_put = inicio_del_put === -1 ? '' : texto_de_la_seccion.slice(inicio_del_put, inicio_del_put + 3000)

CLAVES_DE_COMPROMISOS.forEach(function (clave) {
  const aparece = new RegExp('\\b' + clave + '\\b', 'g')
  cierto('LeadWhatsappOnboardingSection.vue: «' + clave + '» está en el template con su v-model',
    new RegExp('v-model(\\.\\w+)*="form\\.' + clave + '"').test(texto_de_la_seccion))
  cierto('LeadWhatsappOnboardingSection.vue: «' + clave + '» se carga del GET (y está en el formulario por defecto)',
    (texto_de_la_seccion.match(aparece) || []).length >= 4)
  cierto('LeadWhatsappOnboardingSection.vue: «' + clave + '» viaja en el cuerpo del PUT', new RegExp('\\b' + clave + '\\b').test(bloque_del_put))
})
contiene('LeadWhatsappOnboardingSection.vue: la plantilla de compromisos arranca en cc_coord_dia_acordado',
  SECCION, /compromiso_plantilla:\s*['"]cc_coord_dia_acordado['"]/)
contiene('LeadWhatsappOnboardingSection.vue: los tres interruptores nacen en false',
  SECCION, /compromisos_activo:\s*false[\s\S]*compromisos_deteccion_ia:\s*false[\s\S]*compromisos_envio_automatico:\s*false|compromisos_deteccion_ia:\s*false[\s\S]*compromisos_activo:\s*false/)

const COMPROMISO = ['src', 'components', 'lead', 'CompromisoVigente.vue']
const texto_del_compromiso = leer(...COMPROMISO)
cierto('existe src/components/lead/CompromisoVigente.vue', texto_del_compromiso !== null)
contiene('CompromisoVigente.vue lee los compromisos del lead (GET /lead/{id}/compromisos)', COMPROMISO, /['"`]\/lead\/[\s\S]{0,60}compromisos/)
contiene('CompromisoVigente.vue reprograma con PUT /lead-compromisos/{id}', COMPROMISO, /\.put\(\s*[`'"]\/lead-compromisos\//)
contiene('CompromisoVigente.vue cancela con POST /lead-compromisos/{id}/cancelar', COMPROMISO, /\.post\(\s*[`'"]\/lead-compromisos\/[\s\S]{0,60}cancelar/)
contiene('CompromisoVigente.vue tiene el botón «Cambiar fecha»', COMPROMISO, /Cambiar fecha/)
contiene('CompromisoVigente.vue tiene el botón «Cancelar»', COMPROMISO, /Cancelar/)
contiene('CompromisoVigente.vue muestra el resumen del compromiso', COMPROMISO, /resumen/)
contiene('CompromisoVigente.vue muestra la acción (llamar, escribir o esperar)', COMPROMISO, /llamar[\s\S]*escribir[\s\S]*esperar/)
contiene('CompromisoVigente.vue muestra de dónde salió (origen)', COMPROMISO, /origen/)
cierto('CompromisoVigente.vue NO se esconde para el perfil «Sólo Leads» (Juan ve, reprograma y cancela)',
  texto_del_compromiso !== null && !/es_solo_leads/.test(texto_del_compromiso))

const SIDEBAR = ['src', 'components', 'lead', 'LeadConversationSidebar.vue']
contiene('LeadConversationSidebar.vue importa CompromisoVigente', SIDEBAR, /import\s+CompromisoVigente\s+from\s+['"]@\/components\/lead\/CompromisoVigente\.vue['"]/)
contiene('LeadConversationSidebar.vue lo registra como componente', SIDEBAR, /components:\s*\{[^}]*CompromisoVigente/)
contiene('LeadConversationSidebar.vue monta <compromiso-vigente>', SIDEBAR, /<compromiso-vigente|<CompromisoVigente/)

const FICHA = ['src', 'components', 'pipeline', 'OpportunityModal.vue']
contiene('OpportunityModal.vue importa CompromisoVigente', FICHA, /import\s+CompromisoVigente\s+from\s+['"]@\/components\/lead\/CompromisoVigente\.vue['"]/)
contiene('OpportunityModal.vue lo registra como componente', FICHA, /components:\s*\{[^}]*CompromisoVigente/)
contiene('OpportunityModal.vue monta <compromiso-vigente>', FICHA, /<compromiso-vigente|<CompromisoVigente/)

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
