/*
  Prueba de aceptación CA16 de la misión embudo-whatsapp-precios (etapa E2):
  Cuenta → Onboarding de leads con el interruptor del flujo de entrada nuevo y el textarea
  de textos precargados de los anuncios.

  Se corre con `node pruebas/flujo-entrada.cjs`. No necesita dependencias: `admin-spa` no tiene
  corredor de tests (misma convención que pruebas/precios-vigentes.cjs y pruebas/solo-leads.cjs).

  Qué fija (todo sobre el ARCHIVO REAL, `LeadWhatsappOnboardingSection.vue`):
    1. El switch «Flujo de entrada nuevo (dos caminos)» ligado a `form.flujo_entrada_activo`,
       con su texto de ayuda de una línea.
    2. El textarea «Textos precargados de los anuncios» ligado a `form.flujo_textos_precargados`.
    3. La lectura: `apply_from_response` toma `flujo_entrada_activo` (default false si la API es
       vieja y no lo manda: un «Guardar» no debe prender el flujo sin que nadie lo toque) y
       `flujo_textos_precargados` (default vacío).
    4. El guardado: el PUT manda las dos claves (la API las trata como `sometimes`).
    5. Las etiquetas de estado («Conversando», «Link enviado», «Implementación pedida», «En prueba»)
       viven en el catálogo de la API (§2.2.1 del plan): el SPA NO las repite ni deja las viejas
       fijas en la ficha del lead (guarda de regresión, hoy en verde).

  La verificación visual (switch, textarea, etiquetas en el select de estado y en la tarjeta
  «Otros», en los tres anchos) la hace el Coordinador en el navegador: acá no se levanta nada.
  No hay lógica pura nueva en `src/utils/` para E2: el plan no la ubica ahí.
*/
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')

let fallos = 0
let corridas = 0

/** Afirma que una condición sea verdadera y cuenta el resultado. */
function cierto(descripcion, condicion) {
  corridas++
  if (!condicion) {
    fallos++
    console.log('FALLA  ' + descripcion)
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

/** Devuelve el cuerpo de un método del componente (desde su nombre hasta el siguiente método de 4 espacios). */
function cuerpo_de_metodo(texto, nombre) {
  const inicio = texto.search(new RegExp('^    ' + nombre + '\\(', 'm'))
  if (inicio === -1) {
    return ''
  }
  const resto = texto.slice(inicio + 1)
  const fin = resto.search(/^    [a-z_]+\(.*\) \{/m)
  return fin === -1 ? resto : resto.slice(0, fin)
}

const componente = leer('src', 'components', 'account', 'sections', 'LeadWhatsappOnboardingSection.vue')
cierto('existe LeadWhatsappOnboardingSection.vue', componente !== null)

if (componente !== null) {
  const plantilla = componente.slice(0, componente.indexOf('</template>\n\n<script>'))
  const apply = cuerpo_de_metodo(componente, 'apply_from_response')
  const guardar = cuerpo_de_metodo(componente, 'on_save')

  /* ---- 1. Switch del flujo de entrada ---- */
  cierto('la plantilla tiene el rótulo «Flujo de entrada nuevo (dos caminos)»',
    plantilla.indexOf('Flujo de entrada nuevo (dos caminos)') !== -1)
  cierto('el switch está ligado a form.flujo_entrada_activo (v-model)',
    /v-model="form\.flujo_entrada_activo"/.test(plantilla))
  cierto('el switch es un checkbox de Bootstrap (form-switch)',
    /form-switch[\s\S]{0,400}flujo_entrada_activo|flujo_entrada_activo[\s\S]{0,400}type="checkbox"/.test(plantilla)
      && plantilla.indexOf('form-switch') !== -1)
  cierto('el switch se deshabilita mientras se guarda (:disabled="saving")',
    /flujo_entrada_activo[\s\S]{0,300}:disabled="saving"/.test(plantilla))
  cierto('el texto de ayuda del switch: «todo lead nuevo recibe la presentación y las dos formas de arrancar; el link va a pedido»',
    plantilla.indexOf('todo lead nuevo recibe la presentación y las dos formas de arrancar') !== -1
      && plantilla.indexOf('el link va a pedido') !== -1)

  /* ---- 2. Textarea de textos precargados ---- */
  cierto('la plantilla tiene el rótulo «Textos precargados de los anuncios»',
    plantilla.indexOf('Textos precargados de los anuncios') !== -1)
  cierto('el textarea está ligado a form.flujo_textos_precargados (v-model)',
    /<textarea[^>]*v-model="form\.flujo_textos_precargados"/.test(plantilla.replace(/\n\s*/g, ' ')))
  cierto('el textarea explica que va un texto por línea',
    /una? por línea|uno por línea|cada línea/i.test(plantilla))

  /* ---- 3. Lectura (GET) ---- */
  cierto('el formulario inicial declara flujo_entrada_activo en false (apagado por defecto)',
    /form: \{[\s\S]*?flujo_entrada_activo: false/.test(componente))
  cierto('el formulario inicial declara flujo_textos_precargados vacío',
    /form: \{[\s\S]*?flujo_textos_precargados: ''/.test(componente))
  cierto('apply_from_response lee data.flujo_entrada_activo',
    /data\.flujo_entrada_activo/.test(apply))
  cierto('apply_from_response convierte flujo_entrada_activo a boolean con default false (API vieja)',
    /typeof data\.flujo_entrada_activo !== 'undefined'[\s\S]{0,80}!!data\.flujo_entrada_activo[\s\S]{0,40}false/.test(apply)
      || /!!\(data && data\.flujo_entrada_activo\)/.test(apply))
  cierto('apply_from_response lee data.flujo_textos_precargados con default vacío',
    /data\.flujo_textos_precargados\) \|\| ''/.test(apply))

  /* ---- 4. Guardado (PUT) ---- */
  cierto('el PUT manda flujo_entrada_activo como boolean',
    /flujo_entrada_activo: !!self\.form\.flujo_entrada_activo/.test(guardar))
  cierto('el PUT manda flujo_textos_precargados',
    /flujo_textos_precargados: self\.form\.flujo_textos_precargados/.test(guardar))
  cierto('el PUT sigue yendo a /settings/lead-whatsapp-onboarding',
    guardar.indexOf("'/settings/lead-whatsapp-onboarding'") !== -1)
}

/* ---- 5. Etiquetas de estado: viven en el catálogo de la API ---- */
const archivos_de_estado = [
  ['src', 'views', 'Leads.vue'],
  ['src', 'components', 'lead', 'extra-props', 'Index.vue'],
]
archivos_de_estado.forEach(function (partes) {
  const texto = leer(...partes)
  const nombre = partes.join('/')
  cierto(nombre + ' existe', texto !== null)
  if (texto !== null) {
    cierto(nombre + ' no deja fija la etiqueta vieja «Contactado» (viene del catálogo: «Conversando»)',
      !/['">]Contactado['"<]/.test(texto))
    cierto(nombre + ' no deja fija la etiqueta vieja «Prueba activa» (viene del catálogo: «En prueba»)',
      !/['">]Prueba activa['"<]/.test(texto))
    cierto(nombre + ' no repite las etiquetas nuevas (las pinta desde el catálogo de la API)',
      texto.indexOf('Link enviado') === -1 && texto.indexOf('Implementación pedida') === -1)
  }
})

console.log('\n' + (corridas - fallos) + '/' + corridas + ' chequeos ok, ' + fallos + ' en rojo')
process.exit(fallos > 0 ? 1 : 0)
