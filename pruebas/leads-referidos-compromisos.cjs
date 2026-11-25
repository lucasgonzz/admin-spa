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

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
