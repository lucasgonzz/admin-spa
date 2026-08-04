<template>
	<fondo-seccion-sticky variante="interludio">
		<div ref="contenedor" class="demo-interludio">
			<!-- Pin propio de la escena (grupo 322, prompt 05): FondoSeccionSticky.vue
			     pinnea su FONDO (el degradé de la sección), no el contenido del slot --
			     acá necesitamos que la escena SVG en sí quede clavada mientras el
			     progreso del scroll la anima, así que se agrega un segundo sticky
			     anidado. No reimplementa el pin del fondo (eso lo sigue haciendo
			     FondoSeccionSticky sin tocarlo); es un pin adicional para el primer
			     plano, que FondoSeccionSticky nunca ofreció resolver. -->
			<div class="demo-interludio__pin">
				<svg
					ref="svg"
					id="convergencia-a"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 600 620"
					class="demo-interludio__svg"
					role="img"
					aria-label="Convergencia de datos — ComercioCity"
				>
					<title>Convergencia — estado final</title>
					<defs>
						<linearGradient id="grad-linea-0" gradientUnits="userSpaceOnUse" x1="300" y1="92" x2="300" y2="300">
							<stop offset="0" stop-color="#0B84F8" stop-opacity="0.25"></stop>
							<stop offset="1" stop-color="#3A31FC" stop-opacity="1"></stop>
						</linearGradient>
						<linearGradient id="grad-linea-1" gradientUnits="userSpaceOnUse" x1="480.13" y1="196" x2="300" y2="300">
							<stop offset="0" stop-color="#0B84F8" stop-opacity="0.25"></stop>
							<stop offset="1" stop-color="#3A31FC" stop-opacity="1"></stop>
						</linearGradient>
						<linearGradient id="grad-linea-2" gradientUnits="userSpaceOnUse" x1="480.13" y1="404" x2="300" y2="300">
							<stop offset="0" stop-color="#0B84F8" stop-opacity="0.25"></stop>
							<stop offset="1" stop-color="#3A31FC" stop-opacity="1"></stop>
						</linearGradient>
						<linearGradient id="grad-linea-3" gradientUnits="userSpaceOnUse" x1="300" y1="508" x2="300" y2="300">
							<stop offset="0" stop-color="#0B84F8" stop-opacity="0.25"></stop>
							<stop offset="1" stop-color="#3A31FC" stop-opacity="1"></stop>
						</linearGradient>
						<linearGradient id="grad-linea-4" gradientUnits="userSpaceOnUse" x1="119.87" y1="404" x2="300" y2="300">
							<stop offset="0" stop-color="#0B84F8" stop-opacity="0.25"></stop>
							<stop offset="1" stop-color="#3A31FC" stop-opacity="1"></stop>
						</linearGradient>
						<linearGradient id="grad-linea-5" gradientUnits="userSpaceOnUse" x1="119.87" y1="196" x2="300" y2="300">
							<stop offset="0" stop-color="#0B84F8" stop-opacity="0.25"></stop>
							<stop offset="1" stop-color="#3A31FC" stop-opacity="1"></stop>
						</linearGradient>
						<linearGradient id="grad-nucleo" x1="0" y1="0" x2="1" y2="1">
							<stop offset="0" stop-color="#0B84F8"></stop>
							<stop offset="1" stop-color="#3A31FC"></stop>
						</linearGradient>
						<linearGradient id="cc-grad" x1="128" y1="8.5" x2="128" y2="247.5" gradientUnits="userSpaceOnUse">
							<stop offset="0" stop-color="#0B84F8"></stop>
							<stop offset="1" stop-color="#3A31FC"></stop>
						</linearGradient>
					</defs>
					<g id="escena" ref="escena">
						<g id="lineas">
							<line id="linea-stock" ref="linea_stock" x1="300" y1="92" x2="300" y2="300" stroke="url(#grad-linea-0)" stroke-width="1.25" stroke-linecap="round"></line>
							<line id="linea-precios" ref="linea_precios" x1="480.13" y1="196" x2="300" y2="300" stroke="url(#grad-linea-1)" stroke-width="1.25" stroke-linecap="round"></line>
							<line id="linea-deudas" ref="linea_deudas" x1="480.13" y1="404" x2="300" y2="300" stroke="url(#grad-linea-2)" stroke-width="1.25" stroke-linecap="round"></line>
							<line id="linea-facturas" ref="linea_facturas" x1="300" y1="508" x2="300" y2="300" stroke="url(#grad-linea-3)" stroke-width="1.25" stroke-linecap="round"></line>
							<line id="linea-proveedores" ref="linea_proveedores" x1="119.87" y1="404" x2="300" y2="300" stroke="url(#grad-linea-4)" stroke-width="1.25" stroke-linecap="round"></line>
							<line id="linea-depositos" ref="linea_depositos" x1="119.87" y1="196" x2="300" y2="300" stroke="url(#grad-linea-5)" stroke-width="1.25" stroke-linecap="round"></line>
						</g>
						<g id="nodos">
							<g id="nodo-stock" ref="nodo_stock">
								<circle cx="300" cy="92" r="13" fill="#ffffff" stroke="#d3d9e8" stroke-width="1"></circle>
								<circle cx="300" cy="92" r="3.4" fill="url(#grad-nucleo)"></circle>
								<text x="300" y="64" text-anchor="middle" font-family="Geist, system-ui, sans-serif" font-size="12" font-weight="400" letter-spacing="0.01em" fill="#566078">Stock</text>
							</g>
							<g id="nodo-precios" ref="nodo_precios">
								<circle cx="480.13" cy="196" r="13" fill="#ffffff" stroke="#d3d9e8" stroke-width="1"></circle>
								<circle cx="480.13" cy="196" r="3.4" fill="url(#grad-nucleo)"></circle>
								<text x="502.13" y="200" text-anchor="start" font-family="Geist, system-ui, sans-serif" font-size="12" font-weight="400" letter-spacing="0.01em" fill="#566078">Precios</text>
							</g>
							<g id="nodo-deudas" ref="nodo_deudas">
								<circle cx="480.13" cy="404" r="13" fill="#ffffff" stroke="#d3d9e8" stroke-width="1"></circle>
								<circle cx="480.13" cy="404" r="3.4" fill="url(#grad-nucleo)"></circle>
								<text x="502.13" y="408" text-anchor="start" font-family="Geist, system-ui, sans-serif" font-size="12" font-weight="400" letter-spacing="0.01em" fill="#566078">Deudas</text>
							</g>
							<g id="nodo-facturas" ref="nodo_facturas">
								<circle cx="300" cy="508" r="13" fill="#ffffff" stroke="#d3d9e8" stroke-width="1"></circle>
								<circle cx="300" cy="508" r="3.4" fill="url(#grad-nucleo)"></circle>
								<text x="300" y="542" text-anchor="middle" font-family="Geist, system-ui, sans-serif" font-size="12" font-weight="400" letter-spacing="0.01em" fill="#566078">Facturas</text>
							</g>
							<g id="nodo-proveedores" ref="nodo_proveedores">
								<circle cx="119.87" cy="404" r="13" fill="#ffffff" stroke="#d3d9e8" stroke-width="1"></circle>
								<circle cx="119.87" cy="404" r="3.4" fill="url(#grad-nucleo)"></circle>
								<text x="97.87" y="408" text-anchor="end" font-family="Geist, system-ui, sans-serif" font-size="12" font-weight="400" letter-spacing="0.01em" fill="#566078">Proveedores</text>
							</g>
							<g id="nodo-depositos" ref="nodo_depositos">
								<circle cx="119.87" cy="196" r="13" fill="#ffffff" stroke="#d3d9e8" stroke-width="1"></circle>
								<circle cx="119.87" cy="196" r="3.4" fill="url(#grad-nucleo)"></circle>
								<text x="97.87" y="200" text-anchor="end" font-family="Geist, system-ui, sans-serif" font-size="12" font-weight="400" letter-spacing="0.01em" fill="#566078">Depósitos</text>
							</g>
						</g>
						<g id="nucleo">
							<circle id="nucleo-halo" ref="nucleo_halo" cx="300" cy="300" r="58" fill="url(#grad-nucleo)" opacity="0.1"></circle>
							<circle id="nucleo-anillo" ref="nucleo_anillo" cx="300" cy="300" r="50" fill="none" stroke="url(#grad-nucleo)" stroke-width="1.25" opacity="0.85"></circle>
							<g id="logo" ref="logo">
								<g id="isotipo" transform="translate(261,261) scale(0.30469)">
									<g id="arco" fill="none" stroke="url(#cc-grad)" stroke-width="33" stroke-linecap="butt">
										<path id="arco-superior" d="M 61.79 49.1 A 103 103 0 0 1 187.08 43.62"></path>
										<path id="arco-izquierdo" d="M 52.67 198.24 A 103 103 0 0 1 52.67 57.76"></path>
										<path id="arco-inferior" d="M 217.2 179.5 A 103 103 0 0 1 61.79 206.9"></path>
									</g>
									<g id="barras" fill="url(#cc-grad)">
										<rect id="barra-1" x="75.5" y="140" width="28" height="52" rx="3"></rect>
										<rect id="barra-2" x="114" y="115" width="28" height="77" rx="3"></rect>
										<rect id="barra-3" x="152.5" y="93" width="28" height="99" rx="3"></rect>
									</g>
									<path id="flecha" fill="#FA7E06" d="M 205 64 L 178.5 75 Q 193.5 76.4 195.5 92 Z"></path>
								</g>
							</g>
						</g>
					</g>
				</svg>

				<!-- Panel del cierre, superpuesto (punto 3 del prompt): entra desde
				     abajo en el mismo tramo (0.90 -> 1) en que la escena se atenúa
				     detrás. Sin backdrop-filter -- la capa + la atenuación de la
				     escena hacen todo el trabajo (§12 de apple-design/SKILL.md). -->
				<div ref="panel_cierre_wrap" class="demo-interludio__panel-cierre-wrap">
					<div class="demo-interludio__panel-cierre">
						<slot name="cierre" />
					</div>
				</div>
			</div>
		</div>
	</fondo-seccion-sticky>
</template>

<script>
import FondoSeccionSticky from './FondoSeccionSticky.vue'

/** Los seis nodos, en el orden en que se escalonan (0.15 + i*0.055 cada uno). */
const NODOS = ['stock', 'precios', 'deudas', 'facturas', 'proveedores', 'depositos']

/**
 * Interludio de convergencia (grupo 322, prompt 05): entre el bloque 5 y el
 * cierre del scroll de dolor. Anima el SVG de `marca/assets/convergencia-interludio.svg`
 * (inline en el DOM, ids intactos -- ver contrato del prompt) puramente en
 * función del progreso de scroll dentro de su propia sección pinneada. Nada
 * corre solo ni en loop: si el lead frena el scroll, la animación frena.
 *
 * Prohibido explícito (mismo criterio que el prompt 01): nada de Framer
 * Motion/Motion ni librerías de springs -- todo se resuelve con un listener de
 * scroll pasivo + requestAnimationFrame + transform/opacity/stroke-dashoffset.
 */
export default {
	name: 'InterludioConvergencia',

	components: {
		FondoSeccionSticky,
	},

	/* Sin declarar esto, Vue no reconoce onCierreVisible como listener de
	   emit: lo trata como atributo fallthrough y lo cuelga como listener DOM
	   inútil en el elemento raíz (además de disparar el emit real, que sí
	   funciona sin esto -- pero es sucio dejarlo así). */
	emits: ['cierre-visible'],

	data() {
		return {
			/** Progreso normalizado [0, 1] dentro de la sección pinneada. */
			progreso: 0,
			/** Flag para no encolar más de un requestAnimationFrame por vez. */
			ticking: false,
			/** true si el sistema operativo pide reduced-motion: sin listener de scroll. */
			reduced_motion: false,
			/** Longitud real (getTotalLength) de cada una de las seis líneas, medida en mounted. */
			longitudes: {},
			/** Evita emitir el evento de tracking del cierre más de una vez. */
			cierre_visible_emitido: false,
		}
	},

	mounted() {
		const self = this

		self.reduced_motion = !!(
			typeof window !== 'undefined' &&
			window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		)

		/* Longitud real de cada línea: no hardcodear, los seis nodos no están a
		 * la misma distancia del núcleo. */
		NODOS.forEach(function (id) {
			const linea_el = self.$refs['linea_' + id]
			if (linea_el && typeof linea_el.getTotalLength === 'function') {
				const longitud = linea_el.getTotalLength()
				self.longitudes[id] = longitud
				linea_el.style.strokeDasharray = String(longitud)
				linea_el.style.strokeDashoffset = String(longitud)
			}
		})

		if (self.reduced_motion) {
			/* Estado final directo, sin listener de scroll registrado (criterio 7). */
			self.aplicar_estilos(1)
			return
		}

		/* Cálculo inicial real (no aplicar_estilos(0) a ciegas): si la página
		 * carga con esta sección ya parcialmente scrolleada -- por ejemplo al
		 * volver con el botón atrás -- la escena tiene que arrancar en el
		 * progreso que corresponde, no quedar congelada en 0 hasta el primer
		 * scroll. */
		self.calcular_progreso()
		window.addEventListener('scroll', self.on_scroll, { passive: true })
		/* El alto pinneable depende de window.innerHeight: un resize (rotar el
		 * celular, cambiar de ventana) lo invalida igual que un scroll. */
		window.addEventListener('resize', self.on_scroll, { passive: true })
	},

	beforeUnmount() {
		window.removeEventListener('scroll', this.on_scroll)
		window.removeEventListener('resize', this.on_scroll)
	},

	methods: {
		/**
		 * Handler de scroll: encola el recálculo real en requestAnimationFrame,
		 * sin recalcular en cada evento (pueden llegar decenas por segundo).
		 *
		 * @returns {void}
		 */
		on_scroll() {
			const self = this
			if (self.ticking) {
				return
			}
			self.ticking = true
			window.requestAnimationFrame(function () {
				self.calcular_progreso()
				self.ticking = false
			})
		},

		/**
		 * Progreso [0,1] según cuánto del alto "pinneable" de la sección ya se
		 * scrolleó -- 0 cuando el pin recién engancha (el contenedor toca el
		 * borde superior del viewport), 1 cuando el contenedor ya recorrió toda
		 * su altura extra y el pin está por soltarse.
		 *
		 * @returns {void}
		 */
		calcular_progreso() {
			if (!this.$refs.contenedor) {
				return
			}

			const rect = this.$refs.contenedor.getBoundingClientRect()
			const alto_pinneable = rect.height - window.innerHeight

			if (alto_pinneable <= 0) {
				this.progreso = rect.top <= 0 ? 1 : 0
				this.aplicar_estilos(this.progreso)
				return
			}

			const avance = -rect.top
			const p = Math.max(0, Math.min(1, avance / alto_pinneable))
			this.progreso = p
			this.aplicar_estilos(p)
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
		 * Escribe por `style` inline (nunca clases: el valor es continuo, no un
		 * estado discreto) la coreografía completa para un progreso dado --
		 * tabla del punto 2 del prompt.
		 *
		 * @param {number} p Progreso [0,1].
		 * @returns {void}
		 */
		aplicar_estilos(p) {
			const self = this

			/* 0.15 -> 0.70: las seis líneas se trazan escalonadas; cada nodo sube
			 * a opacidad plena cuando SU línea termina de llegar. Para p < 0.15
			 * (o antes del inicio de cada línea puntual), normalizar() da 0, que
			 * ya reproduce el estado inicial del tramo 0 -> 0.15 (nodos al 30%,
			 * líneas sin trazar) sin necesitar una rama aparte. */
			NODOS.forEach(function (id, i) {
				const inicio = 0.15 + i * 0.055
				const fin = inicio + 0.28
				const t = self.normalizar(p, inicio, fin)
				const linea_el = self.$refs['linea_' + id]
				const nodo_el = self.$refs['nodo_' + id]
				const longitud = self.longitudes[id] || 0

				if (linea_el) {
					linea_el.style.strokeDashoffset = String(longitud * (1 - t))
				}
				if (nodo_el) {
					nodo_el.style.opacity = String(0.3 + 0.7 * t)
				}
			})

			/* 0.70 -> 0.90: núcleo y logo. */
			const t_nucleo = self.normalizar(p, 0.7, 0.9)
			if (self.$refs.nucleo_halo) {
				self.$refs.nucleo_halo.style.opacity = String(0.1 + 0.5 * t_nucleo)
				self.$refs.nucleo_halo.style.transform = 'scale(' + (1 + 0.25 * t_nucleo) + ')'
			}
			if (self.$refs.nucleo_anillo) {
				self.$refs.nucleo_anillo.style.opacity = String(0.85 + 0.15 * t_nucleo)
				self.$refs.nucleo_anillo.style.transform = 'scale(' + (1 + 0.15 * t_nucleo) + ')'
			}
			if (self.$refs.logo) {
				self.$refs.logo.style.opacity = String(t_nucleo)
			}

			/* 0.90 -> 1: la escena se encoge, sube y se atenúa -- pasa a leerse
			 * como fondo -- mientras el panel del cierre entra desde abajo. El
			 * scale(0.82) + translateY(-8%) es justo lo que mantiene el logo
			 * visible por encima del panel que entra (punto 3 del prompt). */
			const t_salida = self.normalizar(p, 0.9, 1)
			if (self.$refs.escena) {
				const escala = 1 - 0.18 * t_salida
				const traslado = -8 * t_salida
				const opacidad = 1 - 0.75 * t_salida
				self.$refs.escena.style.transform = 'scale(' + escala + ') translateY(' + traslado + '%)'
				self.$refs.escena.style.opacity = String(opacidad)
				/* Sin filter en el resto del recorrido (t_salida === 0, saturate(1)
				 * sería un no-op visual) para no forzar una capa de composición
				 * de más durante el 90% del scroll en el que no hace falta. */
				self.$refs.escena.style.filter = t_salida > 0 ? 'saturate(' + (1 - 0.4 * t_salida) + ')' : 'none'
			}
			if (self.$refs.panel_cierre_wrap) {
				self.$refs.panel_cierre_wrap.style.transform = 'translateY(' + (1 - t_salida) * 100 + '%)'
				self.$refs.panel_cierre_wrap.style.opacity = String(t_salida)
			}

			/* Tracking mínimo (mismo evento y forma que los bloques 1-5 en
			 * ScrollDolor.vue): el cierre ya no tiene su propio
			 * IntersectionObserver, así que este es el único lugar que sabe
			 * cuándo "aparece" de verdad -- apenas arranca a entrar. */
			if (t_salida > 0 && !self.cierre_visible_emitido) {
				self.cierre_visible_emitido = true
				self.$emit('cierre-visible')
			}
		},
	},
}
</script>

<style scoped>
/* Alto total de la sección: 100vh de pin + el recorrido que necesita la
   coreografía completa (líneas + núcleo + salida) para sentirse acompañando
   al scroll, no apurada. */
.demo-interludio {
	position: relative;
	min-height: 260vh;
}

.demo-interludio__pin {
	position: sticky;
	top: 0;
	height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.demo-interludio__svg {
	width: min(90vw, 560px);
	height: auto;
}

/* #escena y los grupos del núcleo se escalan por JS -- origen relativo a la
   caja propia de cada uno (no al viewport del SVG), así el scale(0.82) del
   tramo de salida encoge desde su propio centro en cualquier navegador. */
#escena,
#nucleo-halo,
#nucleo-anillo {
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

.demo-interludio__panel-cierre {
	width: 100%;
	max-width: 640px;
	/* Tope duro (bug real encontrado por el checker, tres vueltas): en mobile
	   el marco de teléfono del cierre + su copy pueden medir más que el pin de
	   100vh (caso real: ~1050-1270px de contenido contra un pin de ~844px), y
	   en cualquier viewport el panel no puede invadir la franja donde cae el
	   logo tras el scale+translateY del tramo de salida. Con la escena
	   centrada (ver .demo-interludio__pin, sin tocar) 38vh de tope deja
	   clearance positivo en cualquier viewport razonable -- probado por el
	   checker desde 390x844 hasta laptops de poca altura real (~530px). Lo que
	   no entra scrollea DENTRO del panel en vez de taparla. */
	max-height: min(38vh, calc(100vh - 320px));
	overflow-y: auto;
	pointer-events: auto;
}

@media (max-width: 767.98px) {
	.demo-interludio {
		min-height: 220vh;
	}
}
</style>
