/**
 * Las nueve preguntas del formulario de configuración de la demo, con sus opciones y sus
 * defaults. Es la ÚNICA copia de estos textos en el repo.
 *
 * 🔴 POR QUÉ VIVE ACÁ Y NO ADENTRO DE `FormularioConfiguracion.vue`: la tabla la necesitan DOS
 * archivos y desde dos lados distintos del sistema. `FormularioConfiguracion.vue` la usa para la
 * página inmersiva, que es lo que ve el lead; `components/lead/DemoFormRespuestas.vue` la usa para
 * la tarjeta del modal del lead, donde Lucas revisa y corrige esas mismas respuestas. Dos copias
 * de estos textos coincidirían por casualidad, no por construcción — y la tarjeta tiene que
 * mostrar exactamente la pregunta que el lead leyó, o Lucas estaría corrigiendo una respuesta a
 * una pregunta que nadie hizo.
 *
 * Es el mismo criterio que `estados-turno.js` y `tiempos-confirmacion.js` en esta misma carpeta:
 * si un texto, un número o una regla los necesitan dos archivos, no se copian — se comparten, y
 * así no se pueden desincronizar.
 *
 * Los textos se transcriben de `contexto/demo_pagina.md` §3 (repo claude-comerciocity): no se
 * reescriben ni se "mejoran" acá.
 */

/**
 * Las dos opciones de cada pregunta sí/no del formulario, con booleanos JS
 * NATIVOS como valor -- nunca strings 'si'/'no'.
 *
 * Contrato con el backend (contexto/demo_experiencia.md, prompt 05 §1-bis,
 * ya verificado contra el código mergeado de admin-api): las ocho preguntas
 * sí/no se validan con `sometimes|boolean` de Laravel, que acepta
 * true/false/1/0/"1"/"0" y NADA MÁS. Un intento anterior de este prompt usó
 * strings 'si'/'no' acá y el POST moría siempre con 422 -- y además las ocho
 * preguntas quedaban sin preseleccionar, porque `false === 'no'` da `false`.
 * Se comparte la misma referencia entre las ocho preguntas booleanas.
 */
export const OPCIONES_SI_NO = [
  { texto: 'Sí', valor: true },
  { texto: 'No', valor: false },
]

/**
 * Única pregunta no booleana del formulario: `tipo_precios` sigue siendo
 * string ('unico' | 'listas'), tal como lo valida el backend
 * (`sometimes|string|in:unico,listas`) y lo devuelve LeadDemoFormMapper.
 */
export const OPCIONES_TIPO_PRECIOS = [
  { texto: 'Un precio', valor: 'unico' },
  { texto: 'Varias listas', valor: 'listas' },
]

/**
 * Las nueve preguntas del formulario, en el mismo orden y con el mismo texto
 * que contexto/demo_pagina.md §3 (repo claude-comerciocity) -- se transcribe,
 * no se reescribe. Cada `clave` coincide exactamente con la clave que usa el
 * payload del GET/POST del backend (`LeadDemoFormMapper`).
 *
 * `descripcion` (grupo 322, prompt 02): texto secundario opcional, debajo de
 * la pregunta -- `null` en las seis que no lo llevan. Es solo texto visible,
 * no viaja en el POST ni tiene nada que ver con `clave`/`opciones`/`default`.
 */
export const PREGUNTAS = [
  {
    clave: 'tipo_precios',
    pregunta: '¿Tenés un precio por producto, o distintas listas según el cliente?',
    descripcion: null,
    opciones: OPCIONES_TIPO_PRECIOS,
  },
  {
    clave: 'costos_en_dolares',
    pregunta: '¿Manejás costos en dólares?',
    descripcion: 'Es para saber si el sistema tiene que cotizar tus costos en dólares con una cotización global o con una cotización propia de cada proveedor.',
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'descuentos_por_metodo_pago',
    pregunta: '¿Aplicás descuentos o recargos según el método de pago?',
    descripcion: null,
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'usa_cuentas_corrientes_clientes',
    pregunta: '¿Tenés clientes que se llevan la mercadería y te pagan después?',
    descripcion: 'Es para saber si vas a necesitar mover pagos y comprobantes entre las cuentas corrientes de tus clientes.',
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'usa_cuentas_corrientes_proveedores',
    pregunta: '¿Le comprás a proveedores y les pagás después?',
    descripcion: 'Es para saber si vas a necesitar mover pagos y comprobantes entre las cuentas corrientes de tus proveedores.',
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'usa_presupuestos',
    pregunta: '¿Pasás presupuestos antes de cerrar una venta?',
    descripcion: null,
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'registra_compras',
    pregunta: '¿Querés llevar el registro de lo que le comprás a tus proveedores?',
    descripcion: null,
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'usa_ecommerce',
    pregunta: '¿Vendés por internet, o te gustaría?',
    descripcion: null,
    opciones: OPCIONES_SI_NO,
  },
  {
    clave: 'usa_depositos',
    pregunta: '¿Tenés más de un depósito o sucursal?',
    descripcion: null,
    opciones: OPCIONES_SI_NO,
  },
]

/**
 * Defaults locales de cada pregunta -- SOLO como respaldo si `respuestas`
 * llegara sin alguna clave (no debería pasar: el GET siempre trae las nueve,
 * con los defaults del catálogo ya aplicados por
 * `LeadDemoFormMapper::from_lead()`). Booleanos JS nativos para las ocho
 * preguntas sí/no (mismos valores de la tabla de demo_pagina.md §3);
 * `tipo_precios` sigue siendo string.
 */
export const DEFAULTS = {
  tipo_precios: 'unico',
  costos_en_dolares: false,
  descuentos_por_metodo_pago: true,
  usa_cuentas_corrientes_clientes: true,
  usa_cuentas_corrientes_proveedores: true,
  usa_presupuestos: false,
  registra_compras: true,
  usa_ecommerce: true,
  usa_depositos: false,
}
