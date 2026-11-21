/*
  Prueba de aceptación CA7 de la misión embudo-whatsapp-precios (etapa E1):
  pantalla «Precios vigentes» en Cuenta del admin-spa.

  Se corre con `node pruebas/precios-vigentes.cjs`. No necesita dependencias: `admin-spa` no tiene
  corredor de tests (misma convención que pruebas/support-media.cjs).

  Qué fija:
    1. La lógica pura de `src/utils/precios_vigentes.js` (se extrae del ARCHIVO REAL, no de una copia):
       - la mitad de una implementación (628400 -> 314200, 1574300 -> 787150);
       - el abono con descuento de bienvenida (55900 al 50 % -> 27950);
       - el encadenado de rangos de los planes: 0-200 / 201-600 / 601-∞ es válido y
         0-200 / 150-600 no lo es (el backend igual responde 422, pero la pantalla no deja guardar);
       - el formato de pesos («$628.400», «$89,56») y de dólares («USD 0,0618»).
    2. Que la pantalla exista y esté registrada: los cinco componentes de la carpeta
       `precios-vigentes/`, la sección en `account_sections.js` (grupo «Leads y ventas») y su
       montaje en `Account.vue`.

  La verificación visual (tablas con los valores de CA1, editar, guardar, rango inválido sin guardar)
  la hace el Coordinador en el navegador: acá no se levanta nada.
*/
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const FUENTE = path.join(RAIZ, 'src', 'utils', 'precios_vigentes.js')

let fallos = 0
let corridas = 0

/** Compara con igualdad estricta y cuenta el resultado. */
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

/* ---- Existencia de la lógica pura: sin ella no hay nada que probar ---- */
let texto = null
try {
  texto = fs.readFileSync(FUENTE, 'utf8')
} catch (error) {
  console.log('FALLA  no existe src/utils/precios_vigentes.js (' + error.code + '): la pantalla «Precios vigentes» todavía no se construyó')
  fallos++
  corridas++
}

if (texto !== null) {
  /* Sacar el `export` de cada declaración: Node no los entiende dentro de un `new Function`. */
  texto = texto.replace(/^export /gm, '')

  const nombres = [
    'calculate_down_payment', 'calculate_discounted_fee', 'validate_plan_ranges',
    'format_pesos', 'format_usd',
  ]
  const modulo = new Function(texto + '\nreturn { ' + nombres.join(', ') + ' }')()

  /* ---- La mitad de la implementación (anticipo 50 %) ---- */
  igual('mitad de 628400', modulo.calculate_down_payment(628400, 50), 314200)
  igual('mitad de 938600', modulo.calculate_down_payment(938600, 50), 469300)
  igual('mitad de 946800', modulo.calculate_down_payment(946800, 50), 473400)
  igual('mitad de 1254600', modulo.calculate_down_payment(1254600, 50), 627300)
  igual('mitad de 1574300', modulo.calculate_down_payment(1574300, 50), 787150)
  igual('la mitad redondea a 2 decimales', modulo.calculate_down_payment(1001.02, 50), 500.51)
  igual('con otro porcentaje de anticipo', modulo.calculate_down_payment(1000, 30), 300)

  /* ---- El abono con el descuento de bienvenida ---- */
  igual('Inicial con 50 % de descuento', modulo.calculate_discounted_fee(55900, 50), 27950)
  igual('Intermedio con 50 % de descuento', modulo.calculate_discounted_fee(85400, 50), 42700)
  igual('Empresa con 50 % de descuento', modulo.calculate_discounted_fee(263000, 50), 131500)
  igual('Intermedio a 86000 con 50 %', modulo.calculate_discounted_fee(86000, 50), 43000)
  igual('sin descuento (0 %) queda el abono entero', modulo.calculate_discounted_fee(60000, 0), 60000)

  /* ---- Rangos encadenados de los planes ---- */
  const planes_validos = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: 201, hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: null },
  ]
  igual('0-200 / 201-600 / 601-∞ es válido', modulo.validate_plan_ranges(planes_validos), [])

  const planes_superpuestos = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: 150, hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: null },
  ]
  const errores_superpuestos = modulo.validate_plan_ranges(planes_superpuestos)
  cierto('0-200 / 150-600 es inválido', errores_superpuestos.length > 0)
  igual('el error apunta al plan Intermedio y a su campo «desde»',
    [errores_superpuestos[0].clave, errores_superpuestos[0].campo], ['intermedio', 'desde'])
  cierto('el error trae un mensaje legible', typeof errores_superpuestos[0].mensaje === 'string' && errores_superpuestos[0].mensaje.length > 0)

  const planes_con_hueco = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: 250, hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: null },
  ]
  cierto('0-200 / 250-600 (queda un hueco) es inválido', modulo.validate_plan_ranges(planes_con_hueco).length > 0)

  const inicial_que_no_arranca_en_cero = [
    { clave: 'inicial', desde: 5, hasta: 200 },
    { clave: 'intermedio', desde: 201, hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: null },
  ]
  cierto('Inicial tiene que arrancar en 0', modulo.validate_plan_ranges(inicial_que_no_arranca_en_cero).length > 0)

  const empresa_con_tope = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: 201, hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: 3000 },
  ]
  cierto('Empresa tiene que ser ilimitada (hasta null)', modulo.validate_plan_ranges(empresa_con_tope).length > 0)

  const hasta_menor_que_desde = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: 201, hasta: 100 },
    { clave: 'empresa', desde: 101, hasta: null },
  ]
  cierto('un «hasta» menor que su «desde» es inválido', modulo.validate_plan_ranges(hasta_menor_que_desde).length > 0)

  const con_campo_vacio = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: '', hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: null },
  ]
  cierto('un campo vacío no deja guardar', modulo.validate_plan_ranges(con_campo_vacio).length > 0)

  /* ---- Formato de pesos y dólares (separador de miles «.», decimal «,») ---- */
  igual('pesos enteros sin decimales', modulo.format_pesos(628400), '$628.400')
  igual('pesos con millones', modulo.format_pesos(1574300), '$1.574.300')
  igual('pesos con centavos', modulo.format_pesos(89.56), '$89,56')
  igual('cero pesos', modulo.format_pesos(0), '$0')
  igual('dólares con 4 decimales', modulo.format_usd(0.0618), 'USD 0,0618')
  igual('dólares sin ceros de relleno', modulo.format_usd(0.026), 'USD 0,026')

  /* ---- La pantalla: sus archivos y su registro en Cuenta ---- */
  const carpeta = path.join(RAIZ, 'src', 'components', 'account', 'sections', 'precios-vigentes')
  ;['Index.vue', 'PlanesGestion.vue', 'Adicionales.vue', 'Implementaciones.vue', 'CostosMeta.vue']
    .forEach(function (archivo) {
      cierto('existe precios-vigentes/' + archivo, fs.existsSync(path.join(carpeta, archivo)))
    })

  const secciones = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'account', 'account_sections.js'), 'utf8')
  cierto('account_sections.js registra «precios-vigentes» en «Leads y ventas»',
    /id:\s*'precios-vigentes'[\s\S]*?group:\s*'Leads y ventas'/.test(secciones))

  const cuenta = fs.readFileSync(path.join(RAIZ, 'src', 'views', 'Account.vue'), 'utf8')
  cierto('Account.vue monta la sección «precios-vigentes»', /active_section === 'precios-vigentes'/.test(cuenta))
}

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
