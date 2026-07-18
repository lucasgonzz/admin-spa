/**
 * Definición de todas las secciones y preguntas del formulario de configuración inicial.
 * Es la única fuente de verdad para labels, tipos y lógica condicional.
 * Para cambiar un texto o agregar una opción, editar solo este archivo.
 */

/**
 * Array de secciones del formulario, cada una con su id, título y lista de preguntas.
 * Las preguntas con `show_if` solo se muestran si la respuesta de la clave indicada
 * coincide con el valor esperado.
 *
 * @type {Array<{
 *   id: string,
 *   title: string,
 *   questions: Array<{
 *     key: string,
 *     label: string,
 *     hint?: string,
 *     type: 'opcion'|'texto'|'texto_largo'|'tabla_empleados'|'tabla_listas'|'tabla_sucursales'|'tabla_descuentos'|'select_empleado',
 *     required: boolean,
 *     options?: Array<{value: string, label: string}>,
 *     show_if?: {key: string, value: string}
 *   }>
 * }>}
 */
export const SECTIONS = [
  {
    id: 'precios',
    title: 'Precios',
    questions: [
      {
        key: 'price_mode',
        label: '¿Cómo manejás los precios de tus productos?',
        hint: 'Podés cambiar esto después si tu negocio evoluciona.',
        type: 'opcion',
        required: true,
        options: [
          { value: 'single', label: 'Un único precio de venta por producto' },
          { value: 'lists',  label: 'Varias listas de precios con distintos márgenes (ej: Minorista / Mayorista)' },
        ],
      },
      {
        key: 'price_lists',
        label: 'Listas de precios',
        hint: 'Podés ponerle a cada lista un margen de ganancia por defecto (es opcional). Ese margen se usa cuando creás un artículo y no le cargás un margen propio para esa lista: el sistema toma este por defecto. Si lo dejás vacío, cargás el margen a mano en cada artículo.',
        type: 'tabla_listas',
        required: false,
        show_if: { key: 'price_mode', value: 'lists' },
      },
      {
        // ¿Comprás mercadería en dólares?
        key: 'costos_en_dolares',
        label: '¿Comprás mercadería en dólares?',
        hint: 'Si activás esto, vas a poder marcar en cada artículo si su costo es en dólares. El sistema toma ese costo en dólares y lo cotiza para calcular el precio de venta.',
        type: 'opcion',
        required: true,
        options: [
          { value: 'no', label: 'No, siempre compro en pesos' },
          { value: 'yes', label: 'Sí, compro parte o toda la mercadería en dólares' },
        ],
      },
      {
        // Condicionada a costos_en_dolares = yes
        key: 'cotizar_precios_en_dolares',
        label: 'Para los productos con costo en dólares, ¿cómo querés el precio de venta?',
        hint: 'Cotizado a pesos deja el precio final en pesos, calculado con la cotización del día. En dólares deja el precio final en dólares y se cotiza recién al momento de vender.',
        type: 'opcion',
        required: true,
        show_if: { key: 'costos_en_dolares', value: 'yes' },
        options: [
          { value: 'yes', label: 'Cotizado a pesos (el precio final queda en pesos)' },
          { value: 'no', label: 'En dólares (el precio final queda en dólares)' },
        ],
      },
    ],
  },
  {
    id: 'stock',
    title: 'Stock',
    questions: [
      {
        key: 'stock_mode',
        label: '¿Cómo administrás tu stock?',
        type: 'opcion',
        required: true,
        options: [
          { value: 'single',   label: 'Un único stock por producto (todo en un solo lugar)' },
          { value: 'deposits', label: 'Tengo más de una sucursal o depósito y necesito dividir el stock' },
        ],
      },
      {
        key: 'deposit_names',
        label: 'Sucursales o depósitos',
        hint: 'Ingresá el nombre de cada una tal como querés que aparezca en el sistema.',
        type: 'tabla_sucursales',
        required: false,
        show_if: { key: 'stock_mode', value: 'deposits' },
      },
    ],
  },
  {
    id: 'ventas',
    title: 'Ventas',
    questions: [
      {
        // ¿Hacés ventas en dólares?
        key: 'ventas_en_dolares',
        label: '¿Hacés ventas en dólares?',
        hint: 'Si activás esto, al cargar una venta vas a poder elegir la moneda. Si un producto tiene precio en pesos y vendés en dólares, el sistema divide el precio por la cotización; si tiene precio en dólares y vendés en pesos, lo cotiza a pesos.',
        type: 'opcion',
        required: true,
        options: [
          { value: 'no', label: 'No, siempre vendo en pesos' },
          { value: 'yes', label: 'Sí, a veces vendo en dólares' },
        ],
      },
      {
        key: 'payment_discounts',
        label: '¿Aplicás descuentos o recargos según el método de pago?',
        hint: 'Ejemplo: efectivo con 10% de descuento, tarjeta con 5% de recargo. Si cobrás igual sin importar cómo te pagan, dejá la tabla vacía.',
        type: 'tabla_descuentos',
        required: false,
      },
      {
        key: 'apply_iva',
        label: '¿Querés aplicar IVA al precio de tus productos?',
        hint: 'Podés cambiarlo individualmente por producto en cualquier momento.',
        type: 'opcion',
        required: true,
        options: [
          { value: 'yes', label: 'Sí, aplicar IVA a los precios' },
          { value: 'no',  label: 'No aplicar IVA' },
        ],
      },
      {
        key: 'ask_quantity',
        label: 'Al cargar una venta, ¿querés que el sistema te pregunte la cantidad de cada producto?',
        hint: 'Siempre podés editar la cantidad después de agregar el producto.',
        type: 'opcion',
        required: true,
        options: [
          { value: 'ask', label: 'Sí, preguntarme siempre la cantidad' },
          { value: 'one', label: 'No, agregar siempre con 1 unidad' },
        ],
      },
      {
        key: 'default_cuenta_corriente',
        label: '¿Cómo querés que funcionen las cuentas corrientes?',
        hint: 'La cuenta corriente permite que el cliente te pague después. Podés habilitarla o deshabilitarla por cliente.',
        type: 'opcion',
        required: true,
        options: [
          { value: 'default_on',  label: 'Por defecto la venta va a cuenta corriente (lo cambio manualmente si no quiero)' },
          { value: 'default_off', label: 'Por defecto no va a cuenta corriente (lo cambio manualmente si quiero)' },
        ],
      },
    ],
  },
  {
    id: 'empresa',
    title: 'Tu empresa',
    questions: [
      {
        key: 'company_name',
        label: 'Nombre de la empresa',
        hint: 'Así va a aparecer en tus comprobantes y en el sistema.',
        type: 'texto',
        required: true,
      },
      {
        // Número de documento o CUIT para login
        key: 'doc_number',
        label: 'Número de documento / CUIT',
        hint: 'Es el número que vas a usar para ingresar al sistema.',
        type: 'texto',
        required: true,
      },
      {
        // Email de contacto, se precarga desde el backend
        key: 'email',
        label: 'Email',
        hint: 'Acá te va a llegar la información de acceso. Por defecto es el mismo que usaste para agendar la demo; podés cambiarlo si querés.',
        type: 'texto',
        required: true,
      },
      {
        key: 'address_company',
        label: 'Dirección',
        hint: 'Dirección fiscal o del local principal.',
        type: 'texto',
        required: false,
      },
      {
        // Link de Facebook para tienda online
        key: 'facebook',
        label: 'Facebook',
        hint: 'Link de tu página de Facebook. Se usa en tu tienda online si la activás.',
        type: 'texto',
        required: false,
      },
      {
        // Link de Instagram para tienda online
        key: 'instagram',
        label: 'Instagram',
        hint: 'Link de tu perfil de Instagram. Se usa en tu tienda online si la activás.',
        type: 'texto',
        required: false,
      },
    ],
  },
  {
    id: 'equipo',
    title: 'Tu equipo',
    questions: [
      {
        key: 'employees',
        label: 'Empleados que van a usar el sistema',
        hint: 'Incluíte vos también. Cada uno tendrá su propio perfil para que puedas administrar permisos y saber quién hizo cada acción. Si no tenés el DNI o teléfono de alguno, podés completarlo después.',
        type: 'tabla_empleados',
        required: false,
      },
      {
        key: 'migration_responsible',
        label: '¿Quién se va a encargar de enviarnos los archivos con la información del negocio?',
        hint: 'Esta persona recibirá las instrucciones por WhatsApp para enviarnos los archivos de productos, clientes y proveedores.',
        type: 'select_empleado',
        required: true,
      },
    ],
  },
]
