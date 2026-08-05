<template>
	<!-- El progreso llega por EVENTO, no por slot escopeado (grupo 348, prompt 02).
	     Consumirlo en el template obligaba a Vue a re-renderizar este slot -- un SVG
	     de ~130 nodos -- en cada frame del scroll, solo para llamar a un método que
	     escribe estilos inline. El slot escopeado sigue existiendo en
	     FondoSeccionSticky para el que lo necesite; acá no se usa a propósito. -->
	<!-- recorrido_vh 420 y no 320 (grupo 348, prompt 04): en unidades de progreso no
	     entraban a la vez la meseta de nombre solo y un panel que entrara MÁS lento que
	     antes. Ver la tabla de tramos en aplicar_estilos(). Cada vh de más es scroll en
	     el que no cambia nada, así que se subió solo lo necesario.
	     El scroll real es `progreso × (recorrido_vh − 100)`, porque el pin ocupa 100vh
	     fijos: con 420 el progreso se recorre en 320vh, no en 420 (grupo 354, que corrige
	     esta cuenta). Meseta 0.10 × 320 = 32.0vh; panel 0.06 × 320 = 19.2vh, contra los
	     15.4vh de antes del 348-04. -->
	<fondo-seccion-sticky variante="interludio" :recorrido_vh="420" @progreso="on_progreso">
		<div ref="contenedor" class="demo-interludio">
				<!-- SVG copiado tal cual de marca/assets/interludio-portal.svg (ids y
				     data-* intactos, es el contrato) -- role="img" + aria-label en vez de
				     aria-hidden: las doce etiquetas de los íconos son contenido con
				     significado (criterio de éxito 9), así que la escena entera no puede
				     quedar oculta para un lector de pantalla. El aria-label ya trae la
				     frase que describe la transformación completa. -->
				<svg
					ref="svg"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="-24 -12 1048 586"
					preserveAspectRatio="xMidYMid meet"
					class="demo-portal__svg"
					role="img"
					aria-label="El trabajo disperso atraviesa el arco, sale ordenado y el arco se cierra sobre la escena"
				>
					<defs>
						<linearGradient id="brandStroke" gradientUnits="userSpaceOnUse" x1="-6" y1="-12" x2="6" y2="12">
							<stop offset="0" stop-color="#0B84F8"></stop>
							<stop offset="1" stop-color="#3A31FC"></stop>
						</linearGradient>
						<linearGradient id="brandArc" gradientUnits="userSpaceOnUse" x1="-90" y1="-150" x2="70" y2="150">
							<stop offset="0" stop-color="#0B84F8"></stop>
							<stop offset="1" stop-color="#3A31FC"></stop>
						</linearGradient>
						<linearGradient id="brandRing" gradientUnits="userSpaceOnUse" x1="-118" y1="-118" x2="90" y2="118">
							<stop offset="0" stop-color="#0B84F8"></stop>
							<stop offset="1" stop-color="#3A31FC"></stop>
						</linearGradient>
						<radialGradient id="haloC">
							<stop offset="0" stop-color="#3A31FC" stop-opacity="0.13"></stop>
							<stop offset="0.5" stop-color="#0B84F8" stop-opacity="0.06"></stop>
							<stop offset="1" stop-color="#0B84F8" stop-opacity="0"></stop>
						</radialGradient>
						<linearGradient id="ccV3" gradientUnits="userSpaceOnUse" x1="128" y1="8.5" x2="128" y2="247.5">
							<stop offset="0" stop-color="#0B84F8"></stop>
							<stop offset="1" stop-color="#3A31FC"></stop>
						</linearGradient>
					</defs>

					<g id="escena">
						<g ref="panorama" id="panorama">
							<g id="plano-lejos">
								<g id="horizonte" fill="none" stroke="#9AA3B5" stroke-width="1">
									<path d="M 60 470 L 960 470" opacity="0.16"></path>
									<path d="M 210 502 L 900 502" opacity="0.1"></path>
									<path d="M 40 526 Q 500 452 960 526" opacity="0.12"></path>
								</g>
								<g id="zona-orden" fill="none" stroke="url(#brandStroke)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
									<g ref="orden_1" id="orden-1" data-h="700,168" data-sc="1.9">
										<rect x="-8" y="-1" width="16" height="10" rx="1"></rect>
										<path d="M -8 3 L 8 3"></path>
										<path d="M -3 -7 L -0.5 -4.5 L 4 -10"></path>
									</g>
									<g ref="orden_2" id="orden-2" data-h="900,168" data-sc="1.9">
										<path d="M -8 -9 L 3 -9 L 9 -3 L 0 6 L -8 -2 Z"></path>
										<circle cx="-4" cy="-5" r="1.3"></circle>
										<path d="M -9 10 L 9 10"></path>
									</g>
									<g ref="orden_3" id="orden-3" data-h="700,300" data-sc="1.9">
										<path d="M -10 -8 L 10 -8 L 10 6 L -10 6 Z"></path>
										<path d="M -6 -3 L 6 -3"></path>
										<path d="M -6 1 L 6 1"></path>
									</g>
									<g ref="orden_4" id="orden-4" data-h="900,300" data-sc="1.9">
										<path d="M -7 -10 L 7 -10 L 7 10 L -7 10 Z"></path>
										<path d="M -4 -4 L 4 -4"></path>
										<path d="M -4 2 L 4 2"></path>
									</g>
									<g ref="orden_5" id="orden-5" data-h="700,432" data-sc="1.9">
										<circle cx="0" cy="-6" r="3.5"></circle>
										<path d="M -7 2 A 7 7 0 0 1 7 2"></path>
										<path d="M -8 8 L 8 8"></path>
									</g>
									<g ref="orden_6" id="orden-6" data-h="900,432" data-sc="1.9">
										<path d="M -9 -4 L 0 -9 L 9 -4"></path>
										<path d="M -7 -1 L 7 -1 L 7 6 L -7 6 Z"></path>
										<path d="M -8 10 L 8 10"></path>
									</g>
								</g>
								<g id="etiquetas-orden" font-family="Geist, system-ui, sans-serif" font-size="12" fill="#3A31FC" letter-spacing="0.2">
									<g ref="lblo_1" id="lblo-1" data-h="700,210"><text text-anchor="middle">compra registrada</text></g>
									<g ref="lblo_2" id="lblo-2" data-h="900,210"><text text-anchor="middle">precios actualizados</text></g>
									<g ref="lblo_3" id="lblo-3" data-h="700,342"><text text-anchor="middle">pedidos que entran solos</text></g>
									<g ref="lblo_4" id="lblo-4" data-h="900,342"><text text-anchor="middle">venta facturada</text></g>
									<g ref="lblo_5" id="lblo-5" data-h="700,474"><text text-anchor="middle">cuenta corriente de clientes</text></g>
									<g ref="lblo_6" id="lblo-6" data-h="900,474"><text text-anchor="middle">cuenta corriente de proveedores</text></g>
								</g>
							</g>

							<g id="plano-medio">
								<g ref="portal" id="portal" data-open="0.72,0.72" transform="translate(500,281)">
									<g ref="portal_luz" id="portal-luz">
										<circle r="200" fill="url(#haloC)" opacity="1"></circle>
										<circle r="112" fill="#ffffff" stroke="url(#brandArc)" stroke-width="2.5"></circle>
										<path d="M 146 -46 A 154 154 0 0 1 46 146" fill="none" stroke="url(#brandArc)" stroke-width="6" stroke-linecap="round" opacity="1"></path>
										<path d="M -146 46 A 154 154 0 0 1 -46 -146" fill="none" stroke="url(#brandArc)" stroke-width="6" stroke-linecap="round" opacity="1"></path>
										<circle r="138" fill="none" stroke="url(#brandArc)" stroke-width="1" opacity="0.28"></circle>
										<g id="arco-pulsos" fill="none" stroke="url(#brandArc)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="13 100">
											<path ref="arco_pulso_1" id="arco-pulso-1" pathLength="100" d="M -118 0 A 118 118 0 0 1 118 0 A 118 118 0 0 1 -118 0" opacity="0"></path>
											<path ref="arco_pulso_2" id="arco-pulso-2" pathLength="100" d="M -118 0 A 118 118 0 0 1 118 0 A 118 118 0 0 1 -118 0" opacity="0"></path>
											<path ref="arco_pulso_3" id="arco-pulso-3" pathLength="100" d="M -118 0 A 118 118 0 0 1 118 0 A 118 118 0 0 1 -118 0" opacity="0"></path>
											<path ref="arco_pulso_4" id="arco-pulso-4" pathLength="100" d="M -118 0 A 118 118 0 0 1 118 0 A 118 118 0 0 1 -118 0" opacity="0"></path>
											<path ref="arco_pulso_5" id="arco-pulso-5" pathLength="100" d="M -118 0 A 118 118 0 0 1 118 0 A 118 118 0 0 1 -118 0" opacity="0"></path>
											<path ref="arco_pulso_6" id="arco-pulso-6" pathLength="100" d="M -118 0 A 118 118 0 0 1 118 0 A 118 118 0 0 1 -118 0" opacity="0"></path>
										</g>
									</g>
									<g id="logo" transform="translate(-46,-46) scale(0.359)">
										<g fill="none" stroke="url(#ccV3)" stroke-width="33" stroke-linecap="butt">
											<path d="M 61.79 49.1 A 103 103 0 0 1 187.08 43.62"></path>
											<path d="M 52.67 198.24 A 103 103 0 0 1 52.67 57.76"></path>
											<path d="M 217.2 179.5 A 103 103 0 0 1 61.79 206.9"></path>
										</g>
										<g fill="url(#ccV3)">
											<rect x="75.5" y="140" width="28" height="52" rx="3"></rect>
											<rect x="114" y="115" width="28" height="77" rx="3"></rect>
											<rect x="152.5" y="93" width="28" height="99" rx="3"></rect>
										</g>
										<path fill="#FA7E06" d="M 205 64 L 178.5 75 Q 193.5 76.4 195.5 92 Z"></path>
									</g>
								</g>
							</g>

							<g id="plano-cerca">
								<g id="zona-caos" fill="none" stroke="#9AA3B5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
									<g ref="caos_1" id="caos-1" data-h="128,96,-12" data-sc="1.9">
										<rect x="-8" y="-1" width="16" height="10" rx="1"></rect>
										<path d="M -8 3 L 8 3"></path>
										<path d="M 0 -11 L 0 -4 M -3 -7 L 0 -4 L 3 -7"></path>
									</g>
									<g ref="caos_2" id="caos-2" data-h="286,112,9" data-sc="1.9">
										<path d="M -8 -9 L 3 -9 L 9 -3 L 0 6 L -8 -2 Z"></path>
										<circle cx="-4" cy="-5" r="1.3"></circle>
										<path d="M -9 9 L -4 5.5 L 0 10 L 5 6 L 9 9.5"></path>
									</g>
									<g ref="caos_3" id="caos-3" data-h="108,206,15" data-sc="1.9">
										<path d="M -10 -8 L 10 -8 L 10 4 L -2 4 L -6 9 L -6 4 L -10 4 Z"></path>
										<path d="M -6 -4 L 6 -4"></path>
										<path d="M -6 0 L 2 0"></path>
									</g>
									<g ref="caos_4" id="caos-4" data-h="262,222,-8" data-sc="1.9">
										<path d="M -7 -10 L 7 -10 L 7 10 L -7 10 Z"></path>
										<path d="M -4 -4 C -2 -6.5 0 -1.5 2 -4 C 3 -5.2 4 -4.2 4.5 -3.6"></path>
										<path d="M -4 2 C -2 -0.5 0 4.5 2 2 C 3 0.8 4 1.8 4.5 2.4"></path>
									</g>
									<g ref="caos_5" id="caos-5" data-h="140,318,7" data-sc="1.9">
										<circle cx="0" cy="-6" r="3.5"></circle>
										<path d="M -7 2 A 7 7 0 0 1 7 2"></path>
										<path d="M -8 8 L -3 6 L 2 10 L 8 7"></path>
									</g>
									<g ref="caos_6" id="caos-6" data-h="288,352,-13" data-sc="1.9">
										<path d="M -9 -4 L 0 -9 L 9 -4"></path>
										<path d="M -7 -1 L 7 -1 L 7 6 L -7 6 Z"></path>
										<path d="M -8 10 L -2 10 M 1 10 L 8 10"></path>
									</g>
								</g>
								<g id="etiquetas" font-family="Geist, system-ui, sans-serif" font-size="12" fill="#566078" letter-spacing="0.2">
									<g ref="lbl_1" id="lbl-1" data-h="128,138"><text text-anchor="middle">mercadería que entra</text></g>
									<g ref="lbl_2" id="lbl-2" data-h="286,156"><text text-anchor="middle">precios que cambian</text></g>
									<g ref="lbl_3" id="lbl-3" data-h="108,248"><text text-anchor="middle">pedidos por whatsapp</text></g>
									<g ref="lbl_4" id="lbl-4" data-h="266,266"><text text-anchor="middle">ventas anotadas a mano</text></g>
									<g ref="lbl_5" id="lbl-5" data-h="140,360"><text text-anchor="middle">lo que te deben</text></g>
									<g ref="lbl_6" id="lbl-6" data-h="288,394"><text text-anchor="middle">lo que debés</text></g>
								</g>
							</g>
						</g>

						<!-- id="arco-envolvente" queda en el grupo EXTERIOR, con el
						     translate(500,281) fijo como atributo XML -- el ref que
						     escala por JS va en un grupo INTERIOR sin transform propio.
						     Si se aplicara style.transform directo sobre el grupo que
						     ya trae el atributo transform="...", el transform de CSS
						     REEMPLAZA (no compone con) el atributo XML y el anillo
						     saltaría al origen del SVG en vez de quedarse centrado. -->
						<g id="arco-envolvente" transform="translate(500,281)">
							<g ref="arco_envolvente" id="arco-envolvente-escala">
								<circle r="118" fill="url(#haloC)" opacity="1"></circle>
								<circle r="118" pathLength="100" fill="none" stroke="url(#brandRing)" stroke-width="8" stroke-linecap="butt" stroke-dasharray="28 22 28 22"></circle>
								<circle r="138" fill="none" stroke="url(#brandRing)" stroke-width="1" opacity="0.3"></circle>
							</g>
						</g>

						<!-- y=240 y no 189.4 (grupo 348, prompt 04): a la altura vieja la caja
						     del texto se METÍA dentro del trazo del anillo cerrado -- medido,
						     -7.3 unidades de viewBox en el peor caso tipográfico. Es la "barra
						     azul muy cerca del nombre" que reportó Lucas el 4/8/2026. Bajarlo
						     hacia el centro del anillo (281) más la escala 1.95 de
						     ESCALA_ARCO_FINAL dan +29.2 unidades de separación en ese mismo peor
						     caso. El ancho de la caja no depende de la fuente: textLength con
						     lengthAdjust lo fija en 344.9 exactas. -->
						<g ref="nombre_final" id="nombre-final">
							<text x="500" y="240" text-anchor="middle" font-family="Geist, system-ui, sans-serif" font-size="53.9" font-weight="600" letter-spacing="0" textLength="344.9" lengthAdjust="spacingAndGlyphs" fill="#3A31FC">ComercioCity</text>
						</g>
					</g>
				</svg>

				<!-- Panel del cierre, superpuesto (se mantiene igual que antes, grupo
				     322 prompt 05 punto 3): entra desde abajo en el mismo tramo
				     (0.85 -> 1) en que la escena se atenúa y el arco se cierra detrás.
				     Sin backdrop-filter -- la capa + la atenuación de la escena de
				     atrás hacen todo el trabajo (§12 de apple-design/SKILL.md). -->
				<div ref="panel_cierre_wrap" class="demo-interludio__panel-cierre-wrap">
					<div class="demo-interludio__panel-cierre">
						<slot name="cierre" />
					</div>
				</div>
		</div>
	</fondo-seccion-sticky>
</template>

<script>
import FondoSeccionSticky from './FondoSeccionSticky.vue'

/** Los seis pares caos/orden, en el orden en que se escalonan. */
const INDICES = [1, 2, 3, 4, 5, 6]

/**
 * Escala final del anillo envolvente (grupo 348, prompt 04; antes 1.87).
 *
 * NO es un número libre: junto con la altura del nombre (y=240 en el SVG) es lo
 * que le da aire al texto dentro del anillo. Geometría, toda en unidades del
 * viewBox: centro (500,281), trazo grueso r=118 con stroke 8 -- su borde interior
 * escalado queda en (118 - 4) * escala --, y la caja del nombre mide 344.9 de
 * ancho exactas (textLength + lengthAdjust, independiente de la fuente) por
 * ~0.85em + 0.25em de alto en el peor caso tipográfico.
 *
 * Con 1.87 y el nombre en y=189.4 la separación era de -7.3: la caja se metía
 * DENTRO del trazo, que es lo que Lucas vio el 4/8/2026. Con 1.95 y y=240 la
 * separación mínima medida es +29.2 (y +31.6 con métricas típicas), por encima de
 * las 24 unidades pedidas. El anillo entero sigue entrando en el viewBox: su
 * borde superior queda en y=10.9, contra el -12 del viewBox.
 *
 * Si se cambia una de las dos cosas -- esta escala o la altura del nombre --, hay
 * que volver a medir la otra y actualizar estos números.
 */
const ESCALA_ARCO_FINAL = 1.95

/**
 * Escena del portal (grupo 325, prompt 04): reemplaza entero a
 * InterludioConvergencia.vue (grupo 322, prompt 05), que queda borrado --
 * junto con su bug conocido del logo del núcleo que no llegaba a verse.
 *
 * Narrativa: el trabajo diario disperso (#zona-caos) entra por la izquierda,
 * es succionado de a uno por el portal (#portal-luz) y sale ordenado del
 * otro lado (#zona-orden). Al final el arco (#arco-envolvente) se despega,
 * crece 1.95x (ESCALA_ARCO_FINAL) y encapsula todo el panorama, que retrocede y se atenúa,
 * mientras #nombre-final revela "ComercioCity" sobre el anillo cerrado --
 * gesto deliberadamente opuesto al nombre-como-hueco de la apertura
 * (AperturaCinematografica.vue, prompt 03 de este mismo grupo), para que
 * las dos escenas no repitan el mismo truco visual.
 *
 * CORRECTIVO (grupo 331): este componente ya NO calcula su propio progreso de
 * scroll ni tiene pin propio -- los dos vivían acá hasta este prompt y los dos
 * eran la causa de que la escena quedara congelada (ver comentario largo en
 * FondoSeccionSticky.vue). Ahora FondoSeccionSticky mide el progreso [0,1] una
 * sola vez para toda la sección y lo pasa por el evento `progreso` (grupo 348,
 * prompt 02 -- antes era por slot escopeado, ver on_progreso); este componente
 * solo lo consume (on_progreso) y aplica la coreografía (aplicar_estilos), que
 * no cambió en nada. Prohibido explícito (se mantiene): nada de Framer
 * Motion/Motion ni librerías de springs -- todo transform/opacity/filter
 * puro, escrito por `style` inline porque el valor es continuo, nunca clases.
 */
export default {
	name: 'InterludioPortal',

	components: {
		FondoSeccionSticky,
	},

	emits: ['cierre-visible'],

	data() {
		return {
			/** true si el sistema operativo pide reduced-motion: sin listener de scroll. */
			reduced_motion: false,
			/** Los seis pares { n, caos, lbl, orden, lblo, x, y, rot, sc }, leídos de
			 *  data-h/data-sc en mounted() -- nunca hardcodeados (son el contrato del SVG). */
			pares: [],
			/** { sx, sy } leído de data-open de #portal -- escala de #portal-luz "encendido". */
			portal_abierto: { sx: 1, sy: 1 },
			/** Evita emitir el evento de tracking del cierre más de una vez. */
			cierre_visible_emitido: false,
			/**
			 * Último progreso [0,1] recibido por el evento de FondoSeccionSticky.
			 * Existe para que este componente no dependa del orden de montaje: si el
			 * progreso llegó antes de que mounted() leyera el contrato del SVG, se
			 * aplica al final de mounted() con este valor (grupo 349, prompt 01).
			 */
			ultimo_progreso: 0,
		}
	},

	mounted() {
		const self = this

		self.reduced_motion = !!(
			typeof window !== 'undefined' &&
			window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		)

		self.leer_contrato_svg()

		if (self.reduced_motion) {
			/* Estado estático correspondiente a progreso = 1, sin listener de
			 * scroll registrado (criterio de éxito 8): panorama atenuado, arco
			 * cerrado, nombre visible, cierre encima. */
			self.aplicar_estilos(1)
			return
		}

		/* Pose inicial, ahora que el contrato del SVG ya está leído (grupo 349,
		 * prompt 01). Ninguno de los elementos del SVG trae transform ni opacidad
		 * en el markup: si nadie aplica la coreografía antes del primer scroll, la
		 * escena se ve con los 24 elementos apilados en la esquina del viewBox y
		 * pega un salto cuando el progreso empieza a llegar. Se usa el último valor
		 * recibido y no un 0 fijo, porque la página puede haber cargado con esta
		 * sección ya parcialmente scrolleada. Idempotente: aplicar_estilos() escribe
		 * la pose absoluta de un p dado, no incrementos. */
		self.aplicar_estilos(self.ultimo_progreso)

		/* Sin listener propio de scroll/resize: el progreso [0,1] lo calcula
		 * FondoSeccionSticky (una sola vez para toda la sección, ya amortiguado)
		 * y llega acá por el evento `progreso` -- ver on_progreso(). */
	},

	methods: {
		/**
		 * Recibe el progreso [0,1] de la sección por el evento `progreso` de
		 * FondoSeccionSticky y aplica la coreografía. Antes se invocaba desde el
		 * template (:data-progreso-aplicado) sobre el valor del slot escopeado: eso
		 * funcionaba, pero ataba cada frame de scroll a un render de Vue del SVG
		 * entero. Por evento, el frame solo escribe estilos inline sobre nodos que
		 * ya existen, que es lo único que aplicar_estilos() necesita.
		 *
		 * @param {number} p
		 * @returns {void}
		 */
		on_progreso(p) {
			if (this.reduced_motion) {
				return
			}
			/* Se guarda SIEMPRE, incluso si este evento llegó antes de que mounted()
			 * leyera el contrato del SVG: en ese caso aplicar_estilos() de acá abajo
			 * no hace nada (pares está vacío) y el que aplica es el propio mounted(),
			 * con este mismo valor. */
			this.ultimo_progreso = p
			this.aplicar_estilos(p)
		},

		/**
		 * Lee del propio DOM los data-h/data-sc de los seis pares caos/orden y
		 * el data-open de #portal -- "usarlo como origen de los desplazamientos
		 * en vez de volver a medir" (contrato del prompt): nunca duplicar estos
		 * números a mano en JS.
		 *
		 * @returns {void}
		 */
		leer_contrato_svg() {
			const self = this

			self.pares = INDICES.map(function (n) {
				const caos = self.$refs['caos_' + n]
				const orden = self.$refs['orden_' + n]
				const lbl = self.$refs['lbl_' + n]
				const lblo = self.$refs['lblo_' + n]
				const pulso = self.$refs['arco_pulso_' + n]

				const h_caos = (caos.getAttribute('data-h') || '0,0,0').split(',').map(Number)
				const h_orden = (orden.getAttribute('data-h') || '0,0').split(',').map(Number)
				const sc = parseFloat(caos.getAttribute('data-sc') || '1')

				return {
					n: n,
					caos: caos,
					lbl: lbl,
					orden: orden,
					lblo: lblo,
					pulso: pulso,
					caos_x: h_caos[0],
					caos_y: h_caos[1],
					caos_rot: h_caos[2],
					orden_x: h_orden[0],
					orden_y: h_orden[1],
					sc: sc,
				}
			})

			if (self.$refs.portal) {
				const abierto = (self.$refs.portal.getAttribute('data-open') || '1,1').split(',').map(Number)
				self.portal_abierto = { sx: abierto[0], sy: abierto[1] }
			}
		},

		/**
		 * Normaliza `p` al rango [0,1] dentro de [inicio, fin] -- 0 antes de
		 * `inicio`, 1 después de `fin`, interpolación lineal en el medio.
		 *
		 * @param {number} p
		 * @param {number} inicio
		 * @param {number} fin
		 * @returns {number}
		 */
		normalizar(p, inicio, fin) {
			if (p <= inicio) {
				return 0
			}
			if (p >= fin) {
				return 1
			}
			return (p - inicio) / (fin - inicio)
		},

		/**
		 * Escribe por `style`/atributo inline (nunca clases: el valor es
		 * continuo) la coreografía completa para un progreso `p` dado -- tabla
		 * del prompt, ids y data-* leídos en leer_contrato_svg().
		 *
		 * @param {number} p Progreso [0,1] dentro de la sección pinneada.
		 * @returns {void}
		 */
		aplicar_estilos(p) {
			const self = this
			const lerp = function (a, b, t) {
				return a + (b - a) * t
			}
			const easeOut = function (t) {
				return 1 - Math.pow(1 - t, 3)
			}
			const easeIn = function (t) {
				return t * t * t
			}
			/* Arranque Y final suaves (grupo 348, prompt 04). La usa el panel del
			 * cierre: con easeOut el gesto más rápido es el arranque, y la tarjeta
			 * "aparecía" de golpe en vez de subir. Pedido de Lucas, 4/8/2026. */
			const easeInOut = function (t) {
				return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
			}

			/* 0.12 -> 0.26: el portal se enciende. Antes de 0.12 queda apagado
			 * (opacity 0, escala 0); el "encendido" pleno usa la escala de
			 * data-open, no la escala 1 nativa de los paths. Recorrido largo
			 * (grupo 336, prompt 02): tabla de tramos redistribuida entera para
			 * que los ~15 eventos de esta coreografía tengan lugar donde ocurrir
			 * -- antes vivían en 60vh de pin efectivo, después en 220vh y desde
			 * el grupo 348 en 320vh (recorrido_vh 420 menos los 100vh que ocupa
			 * el pin, ver la fórmula en la tabla de tramos de más abajo). */
			const t_portal = easeOut(self.normalizar(p, 0.12, 0.26))
			if (self.$refs.portal_luz) {
				self.$refs.portal_luz.style.opacity = String(t_portal)
				self.$refs.portal_luz.style.transform =
					'scale(' + self.portal_abierto.sx * t_portal + ', ' + self.portal_abierto.sy * t_portal + ')'
			}

			/* 0.26 -> 0.62: los seis del caos, succionados de a uno, escalonados
			 * ~0.06 de progreso entre uno y otro (duración = paso: los seis llenan
			 * la ventana exacta, sin solapar entre sí -- "succión" rápida y seca).
			 * 0.46 -> 0.78: sus seis gemelos, armados del otro lado -- mismo
			 * índice N, ventana más lenta (duración 0.16) y con más solape entre
			 * consecutivos ("se arman", asentamiento) que se superpone a propósito
			 * con la de la succión para que el emparejamiento se note (criterio de
			 * éxito 3), pero desfasada en el tiempo (arranca en 0.46, la succión
			 * ya arrancó en 0.26). */
			const CAOS_INICIO = 0.26
			const CAOS_DURACION = 0.06
			const CAOS_PASO = (0.62 - CAOS_DURACION - CAOS_INICIO) / (INDICES.length - 1)
			const ORDEN_INICIO = 0.46
			const ORDEN_DURACION = 0.16
			const ORDEN_PASO = (0.78 - ORDEN_DURACION - ORDEN_INICIO) / (INDICES.length - 1)

			self.pares.forEach(function (par, i) {
				const caos_ini = CAOS_INICIO + i * CAOS_PASO
				const u_caos = self.normalizar(p, caos_ini, caos_ini + CAOS_DURACION)
				/* La etiqueta se apaga ANTES que el ícono (primera mitad de la
				 * ventana); el ícono se desplaza hacia el centro del portal
				 * acelerando (easeIn: "cae" hacia adentro) mientras se achica y
				 * se desvanece un poco después que su etiqueta. */
				const opacidad_lbl = 1 - easeOut(self.normalizar(u_caos, 0, 0.5))
				const opacidad_caos = 1 - easeOut(self.normalizar(u_caos, 0.15, 1))
				const avance_caos = easeIn(u_caos)
				const x_caos = lerp(par.caos_x, 500, avance_caos)
				const y_caos = lerp(par.caos_y, 281, avance_caos)
				const escala_caos = lerp(par.sc, 0, avance_caos)

				if (par.caos) {
					par.caos.setAttribute(
						'transform',
						'translate(' + x_caos + ',' + y_caos + ') rotate(' + lerp(par.caos_rot, 0, avance_caos) + ') scale(' + escala_caos + ')'
					)
					par.caos.style.opacity = String(opacidad_caos)
				}
				if (par.lbl) {
					par.lbl.setAttribute('transform', 'translate(' + par.caos_x + ',' + par.caos_y + ')')
					par.lbl.style.opacity = String(opacidad_lbl)
				}

				/* Al entrar cada uno (cola de su propia ventana) se enciende su
				 * arco-pulso: un flash breve que recorre el anillo del portal una
				 * vez y se apaga -- ventana propia, angosta, pegada al final de la
				 * ventana del ícono ("al entrar cada uno"). Achicada a la mitad del
				 * CAOS_DURACION nuevo (grupo 336, prompt 02: la ventana del caos se
				 * acortó a 0.06 para la succión escalonada) -- si midiera lo mismo
				 * que la ventana entera dejaría de ser una "cola", ocuparía todo. */
				const PULSO_DURACION = CAOS_DURACION / 2
				const pulso_ini = caos_ini + CAOS_DURACION - PULSO_DURACION
				const u_pulso = self.normalizar(p, pulso_ini, pulso_ini + PULSO_DURACION)
				if (par.pulso) {
					/* Envolvente triangular: sube y baja dentro de la propia ventana,
					 * así que para cualquier p posterior ya quedó en 0 sin necesitar
					 * una rama aparte. */
					const opacidad_pulso = u_pulso <= 0.5 ? u_pulso * 2 : (1 - u_pulso) * 2
					par.pulso.style.opacity = String(Math.max(0, opacidad_pulso))
					par.pulso.style.strokeDashoffset = String(-100 * easeOut(u_pulso))
				}

				const orden_ini = ORDEN_INICIO + i * ORDEN_PASO
				const u_orden = self.normalizar(p, orden_ini, orden_ini + ORDEN_DURACION)
				/* El ícono primero, la etiqueta después (segunda mitad). */
				const opacidad_orden = easeOut(self.normalizar(u_orden, 0, 0.6))
				const opacidad_lblo = easeOut(self.normalizar(u_orden, 0.4, 1))
				const avance_orden = easeOut(u_orden)
				const x_orden = lerp(500, par.orden_x, avance_orden)
				const y_orden = lerp(281, par.orden_y, avance_orden)
				const escala_orden = lerp(0, par.sc, avance_orden)

				if (par.orden) {
					par.orden.setAttribute('transform', 'translate(' + x_orden + ',' + y_orden + ') scale(' + escala_orden + ')')
					par.orden.style.opacity = String(opacidad_orden)
				}
				if (par.lblo) {
					par.lblo.setAttribute('transform', 'translate(' + par.orden_x + ',' + par.orden_y + ')')
					par.lblo.style.opacity = String(opacidad_lblo)
				}
			})

			/* TRAMO FINAL, redistribuido entero (grupo 348, prompt 04). Antes era
			 * arco 0.78->0.93, nombre 0.88->0.96 y panel 0.93->1: el nombre terminaba
			 * de aparecer cuando el panel ya venía subiendo desde hacía 0.03, y entre
			 * "nombre completo" y "fin de la sección" quedaban 0.04 de progreso. Lucas,
			 * 4/8/2026: "quiero que quede más tiempo ComercioCity".
			 *
			 * Ahora:
			 *   0.78 -> 0.84  el arco se despega y crece (mismo inicio que antes: NO se
			 *                 corre hacia atrás, o se solaparía con el armado de los seis
			 *                 del orden, que termina en 0.78 y vive dentro de #panorama --
			 *                 se estarían armando mientras el panorama se atenúa).
			 *   0.80 -> 0.84  el nombre aparece, solapado a propósito con el cierre del
			 *                 arco, y termina junto con él.
			 *   0.84 -> 0.94  MESETA: anillo cerrado y nombre completo, sin nada más
			 *                 entrando. Es el momento de marca de toda la página.
			 *   0.94 -> 1     el panel del cierre, con easeInOut para que suba en vez de
			 *                 aparecer.
			 *
			 * 🔴 PARA PASAR DE PROGRESO A SCROLL, LA FÓRMULA ES `progreso × (recorrido_vh
			 * − 100)`, NO `progreso × recorrido_vh`. FondoSeccionSticky mide
			 * `alto_pinneable = rect.height − window.innerHeight` y el pin ocupa 100vh
			 * fijos, así que con recorrido_vh 420 el progreso 0→1 se recorre en 320vh.
			 * El prompt 348-04 hizo esta cuenta mal, se creyó una meseta de 33.6vh que en
			 * realidad medía 25.6vh, y con eso justificó bajar la meseta de 0.10 a 0.08 de
			 * progreso. Corregido en el grupo 354.
			 *
			 * Con la fórmula correcta: meseta 0.10 × 320 = 32.0vh, panel 0.06 × 320 =
			 * 19.2vh contra los 15.4vh que tenía antes del 348-04 (0.07 × 220) -- entra
			 * más lento, que era la condición dura. El recorrido de la sección subió de
			 * 320vh a 420vh (pin efectivo: de 220 a 320), o sea la coreografía anterior
			 * conserva sus tramos en progreso pero se recorre en un 45% más de scroll. */
			const k_arco = easeOut(self.normalizar(p, 0.78, 0.84))
			const k_nombre = easeOut(self.normalizar(p, 0.80, 0.84))
			const k_panel = easeInOut(self.normalizar(p, 0.94, 1))

			if (self.$refs.arco_envolvente) {
				self.$refs.arco_envolvente.style.transform = 'scale(' + lerp(1, ESCALA_ARCO_FINAL, k_arco) + ')'
			}
			if (self.$refs.panorama) {
				self.$refs.panorama.style.transform = 'scale(' + lerp(1, 0.86, k_arco) + ')'
				self.$refs.panorama.style.opacity = String(lerp(1, 0.22, k_arco))
				self.$refs.panorama.style.filter = k_arco > 0 ? 'saturate(' + lerp(1, 0.65, k_arco) + ')' : 'none'
			}
			if (self.$refs.nombre_final) {
				self.$refs.nombre_final.style.opacity = String(k_nombre)
			}
			if (self.$refs.panel_cierre_wrap) {
				self.$refs.panel_cierre_wrap.style.transform = 'translateY(' + (1 - k_panel) * 100 + '%)'
				self.$refs.panel_cierre_wrap.style.opacity = String(k_panel)
			}

			if (k_panel > 0 && !self.cierre_visible_emitido) {
				self.cierre_visible_emitido = true
				self.$emit('cierre-visible')
			}
		},
	},
}
</script>

<style scoped>
/* Desde el grupo 331 (correctivo) esta escena ya NO tiene pin propio ni alto
   propio -- vive dentro del único pin de FondoSeccionSticky (100vh, ver ese
   componente), que le da tamaño real (height:100% por la excepción full-bleed
   que ese mismo componente declara para la variante "interludio"). Antes
   tenía su propio position:sticky anidado dentro del pin de FondoSeccionSticky
   (mismo patrón que InterludioConvergencia.vue, la escena que reemplazó):
   un elemento pinneado no puede medir su propio avance de scroll, que era una
   de las causas de que la escena quedara congelada. display:flex acá (antes
   en el pin propio) sigue centrando el SVG dentro del espacio disponible. */
.demo-interludio {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

/* viewBox -24 -12 1048 586 (~1.79:1, mucho más ancho que alto). Full-bleed real
   (grupo 336, prompt 02): width/height 100% del contenedor -- .demo-interludio ya
   recibe height:100% por la excepción full-bleed de FondoSeccionSticky.vue para la
   variante "interludio", pero esa excepción solo alcanza al HIJO DIRECTO del
   contenido (.demo-interludio), no al SVG que vive un nivel más adentro. Antes el
   SVG se acotaba a 94vw/1040px con height:auto -- mucho más chico que la ventana
   disponible, la escena quedaba como un círculo chico en el centro. preserveAspectRatio
   "xMidYMid meet" (en el <svg>, sin recortar) hace que en pantallas más "cuadradas"
   que el viewBox sobre alto en vez de recortar ninguna etiqueta. */
.demo-portal__svg {
	width: 100%;
	height: 100%;
}

/* #panorama, #nucleo-halo y #nucleo-anillo (transform-box/transform-origin
   de la escena vieja) ya no existen en este SVG: la escala JS de #panorama,
   #arco-envolvente y #portal-luz necesita el mismo ajuste de caja/origen,
   ahora con los ids de esta escena. */
#panorama,
#arco-envolvente-escala,
#portal-luz {
	transform-box: fill-box;
	transform-origin: center;
}

.demo-interludio__panel-cierre-wrap {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	padding: 24px 20px 6vh;
	box-sizing: border-box;
	/* Estado inicial: fuera de pantalla y transparente -- aplicar_estilos() lo
	   trae con el progreso, nunca con transition (el valor ya llega continuo). */
	transform: translateY(100%);
	opacity: 0;
	pointer-events: none;
}

</style>
