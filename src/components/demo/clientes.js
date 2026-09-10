/**
 * Índice de logos de clientes reales de ComercioCity, para la sección de clientes de la
 * página de experiencia (SeccionClientes.vue).
 *
 * PORTADO de `comerciocity-web/src/data/clients.js` (10/9/2026). No es un import: los dos
 * repos no comparten nada, así que esto es una copia y hay que mantenerla a mano. Si Lucas
 * suma un cliente allá, acá no aparece solo.
 *
 * ⚠️ Los archivos NO son los mismos bytes que los de `comerciocity-web`. Allá pesan 8,9 MB
 * en total (Ferretotal solo son 1,9 MB, Chevrocar 1,4 MB). Esta página es pública y la
 * mayoría de los leads la abre del teléfono, así que entraron recomprimidos: lado largo a
 * 320 px y WebP calidad 82 → **283 KB los 38 juntos**. 320 px alcanza y sobra: el tile más
 * grande de la pared mide ~90 px de CSS, o sea 320 px cubre 2× de densidad de pantalla.
 * Los nombres también se normalizaron a slug (los originales traen espacios, mayúsculas y
 * el nombre del dueño: `"Truvari - Fernando bebidas cordoba.jpg"`).
 *
 * 🔴 Si hay que rehacerlos, se leen de `C:\wamp64\www\comerciocity-web\src\assets\clients\`
 * y se escriben acá. **Nunca al revés**: ese clon es donde Lucas trabaja a mano.
 */

/**
 * URL final del logo, resuelta por Vite. El literal de plantilla no es cosmético: Vite
 * necesita ver el patrón para armar el glob de `../../assets/clients/*.webp` en build --
 * con una variable armada por concatenación no emite ningún asset y en producción quedan
 * 35 imágenes rotas que en `npm run dev` se ven perfectas.
 *
 * @param {string} id Slug del cliente, que es también el nombre del archivo.
 * @returns {string}
 */
export function logo_cliente(id) {
  return new URL(`../../assets/clients/${id}.webp`, import.meta.url).href
}

/**
 * Los 38 logos que hay en disco, en el mismo orden que el índice de `comerciocity-web`.
 *
 * **Los nombres NO son los del índice original.** Allá varios entran con el nombre de pila
 * del dueño ("Christian", "Ernesto", "Fernando", "Roberto") porque así llegó el archivo por
 * WhatsApp. Acá va el nombre del COMERCIO, leído del propio logo: es lo que se le lee a un
 * lector de pantalla (`alt`) y "Christian" no le dice nada a nadie.
 *
 * `en_la_pared: false` marca los tres archivos que no se muestran. Los tres se revisaron
 * uno por uno mirando la imagen, no el nombre del archivo -- por el nombre no se notaba
 * ninguno de los tres:
 *
 * - `fernando` es EXACTAMENTE el mismo logo que `panchito` (Despensa Panchito; Fernando es
 *   el dueño). En la pared aparecían dos veces las mismas letras, a diez casillas de
 *   distancia.
 * - `trama-luis` no es un logo: es una pieza de un sorteo de fin de año de Trama, con
 *   "SORTEO Fin de año" y las bases arriba. El logo de Trama es `trama`.
 * - `sr-imperio` muestra **CrediHogar**, no Sr. Imperio; y `sr-imperio-gerardo` sí muestra
 *   el logo de Sr. Imperio. Como el índice de origen los da a los dos como el mismo cliente
 *   (misma casa de electrodomésticos, dos marcas), va uno solo, y va el que dice el nombre
 *   con el que figura el cliente. ⚠️ Si Lucas confirma que CrediHogar es un comercio
 *   aparte, se le saca el `en_la_pared: false` y listo -- la grilla banca cualquier número.
 */
export const clientes = [
  { id: 'golonorte', nombre: 'Distribuidora Golonorte' },
  { id: 'fenix', nombre: 'Fenix Mayorista' },
  { id: '3dtisk', nombre: '3D Tisk' },
  { id: 'angeles-bad-girls', nombre: 'Bad Girls' },
  { id: 'arfren', nombre: 'Arfren Autopartes' },
  { id: 'chevrocar', nombre: 'Chevrocar' },
  { id: 'christian', nombre: 'Distribuidora CF' },
  { id: 'desire', nombre: 'Tienda Desire' },
  { id: 'ernesto', nombre: 'Ferretería San Cayetano' },
  { id: 'ferreteria-san-blas', nombre: 'Ferretería San Blas' },
  // Mismo logo que `panchito`, letra por letra.
  { id: 'fernando', nombre: 'Despensa Panchito', en_la_pared: false },
  { id: 'ferremas', nombre: 'Ferremas' },
  { id: 'ferretotal', nombre: 'Ferretotal Matheu' },
  { id: 'mza-group', nombre: 'MZA Group' },
  { id: 'sr-imperio-gerardo', nombre: 'Sr. Imperio' },
  { id: 'golden-breeze', nombre: 'Golden Breeze' },
  { id: 'hb-distribuciones', nombre: 'HB Distribuciones' },
  { id: 'hipermax', nombre: 'Hiper-Max' },
  { id: 'ht5', nombre: 'Hitotes' },
  { id: 'innovate', nombre: 'Innovate Materiales' },
  { id: 'la-martina', nombre: 'Despensa La Martina' },
  // No es un logo: es la pieza de un sorteo de fin de año de Trama.
  { id: 'trama-luis', nombre: 'Trama Ferretería', en_la_pared: false },
  { id: 'masquito', nombre: 'Masquito' },
  { id: 'matias-galvan', nombre: 'Matías Galván' },
  { id: 'mb-malizia', nombre: 'MB Malizia' },
  { id: 'golden-bike', nombre: 'Goldenbike Tandil' },
  { id: 'oliva', nombre: 'Ferretería Oliva' },
  { id: 'distri-creo', nombre: 'Creo Distribuidora' },
  { id: 'panchito', nombre: 'Despensa Panchito' },
  { id: 'racing-carts', nombre: '2R Racing Parts' },
  { id: 'renacer-joyas', nombre: 'Renacer Joyas' },
  { id: 'roberto', nombre: 'Ferretería Rober' },
  { id: 'ffperformance', nombre: 'FF Performance' },
  // La otra marca de Sr. Imperio; ver la nota de arriba.
  { id: 'sr-imperio', nombre: 'CrediHogar', en_la_pared: false },
  { id: 'trama', nombre: 'Trama Ferretería' },
  { id: 'truvari', nombre: 'Truvari' },
  { id: 'kiosco-verde', nombre: 'Kiosco Verde' },
  { id: 'servian', nombre: 'Servian Repuestos' },
]

/**
 * Los que efectivamente van a la pared de logos: hoy **35**.
 *
 * El número no está atado a la grilla y no hace falta que sea "redondo": la pared es un
 * flex con `justify-content: center`, así que la última fila queda centrada aunque esté
 * incompleta. Se puede agregar o sacar un logo sin tocar una sola regla de CSS.
 */
export const logos_clientes = clientes
  .filter((cliente) => cliente.en_la_pared !== false)
  .map((cliente) => ({
    id: cliente.id,
    nombre: cliente.nombre,
    logo: logo_cliente(cliente.id),
  }))

/**
 * Clientes con tienda online real, portados del mismo índice.
 *
 * 🔴 `plataforma` no está en el original y se agregó acá a propósito: Racing Parts vende
 * por **Tienda Nube**, no por nuestra tienda -- está integrado al sistema (por eso figura
 * en el índice de ecommerce de la web), pero la tienda no la hicimos nosotros. Mostrarlo
 * bajo "tiendas hechas con esta plataforma" sería una afirmación falsa, así que la sección
 * filtra por `plataforma === 'comerciocity'` y el número que se muestra sale de ese filtro,
 * nunca escrito a mano. Si mañana Racing Parts pasa a nuestra tienda, se cambia el campo
 * acá y el texto de la página se corrige solo.
 */
export const clientes_ecommerce = [
  {
    id: 'ferretotal',
    nombre: 'Ferretotal',
    rubro: 'Ferretería',
    url: 'https://ferretotalmatheu.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'hb-distribuciones',
    nombre: 'HB Distribuciones',
    rubro: 'Ferretería',
    url: 'https://hb-distribuciones.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'trama',
    nombre: 'Trama',
    rubro: 'Ferretería',
    url: 'https://tramaferreteria.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'truvari',
    nombre: 'Truvari',
    rubro: 'Distribuidora de bebidas',
    url: 'https://truvaribebidas.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'fenix',
    nombre: 'Fenix',
    rubro: 'Juguetería mayorista',
    url: 'https://fenix-mayorista.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'golonorte',
    nombre: 'Golonorte',
    rubro: 'Distribuidora',
    url: 'https://golonorte.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'matias-galvan',
    nombre: 'Galván Mayorista',
    rubro: 'Distribuidora',
    url: 'https://galvanmayorista.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'racing-carts',
    nombre: 'Racing Parts',
    rubro: 'Importadora',
    url: 'https://dosrracingparts.mitiendanube.com/',
    plataforma: 'tiendanube',
  },
].map((cliente) => ({
  ...cliente,
  logo: logo_cliente(cliente.id),
}))

/** Las tiendas hechas con esta plataforma, que son las que la página puede mostrar como propias. */
export const tiendas_comerciocity = clientes_ecommerce.filter(
  (cliente) => cliente.plataforma === 'comerciocity',
)
