<template>
	<fondo-seccion-sticky variante="apertura" v-slot="{ progreso }">
		<div ref="contenedor" class="demo-apertura" :data-progreso-aplicado="on_progreso(progreso)">
			<!-- Capa de fondo y forma protagonista: decorativas, sin animación
			     interna -- solo transform/opacity desde afuera, así que van como
			     <img> (el navegador las cachea y no infla el DOM). -->
			<img
				ref="capa_fondo"
				src="@/assets/apertura-capa-fondo.svg"
				alt=""
				aria-hidden="true"
				class="demo-apertura__capa-fondo"
			/>
			<img
				ref="forma_protagonista"
				src="@/assets/apertura-forma-protagonista.svg"
				alt=""
				aria-hidden="true"
				class="demo-apertura__forma-protagonista"
			/>

			<!-- Capas de cierre: inline y NO <img> a propósito -- hay que animar
			     #cierre-izquierda, #cierre-derecha y el font-size/fill-opacity de
			     #nombre-recortado desde JS, y eso es inaccesible dentro de un
			     <img>. Copiado tal cual de marca/assets/apertura-capas-de-cierre.svg
			     (ids intactos), solo agregando los ref de Vue. -->
			<svg
				ref="svg_cierre"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 1600 900"
				preserveAspectRatio="xMidYMid slice"
				class="demo-apertura__capas-cierre"
				aria-hidden="true"
			>
				<title>Capas de cierre con hueco del nombre</title>
				<defs>
					<linearGradient id="ec-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1600" y2="900">
						<stop offset="0" stop-color="#0B84F8"></stop>
						<stop offset="1" stop-color="#3A31FC"></stop>
					</linearGradient>
					<linearGradient id="ec-grad-tinte" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1600" y2="900">
						<stop offset="0" stop-color="#0B84F8" stop-opacity="0.16"></stop>
						<stop offset="1" stop-color="#3A31FC" stop-opacity="0.16"></stop>
					</linearGradient>
					<mask id="hueco-nombre" maskUnits="userSpaceOnUse" x="-800" y="-600" width="3200" height="2100">
						<rect x="-800" y="-600" width="3200" height="2100" fill="#ffffff"></rect>
						<text
							ref="nombre_recortado"
							id="nombre-recortado"
							x="800"
							y="470"
							text-anchor="middle"
							dominant-baseline="middle"
							font-family="Geist, system-ui, sans-serif"
							font-weight="600"
							letter-spacing="0.02em"
							fill="#000000"
							font-size="120"
							fill-opacity="0"
						>COMERCIOCITY</text>
					</mask>
				</defs>
				<g mask="url(#hueco-nombre)">
					<g ref="cierre_izquierda" id="cierre-izquierda">
						<path fill="url(#ec-grad-tinte)" d="M -400 -200 L 860 -200 C 1010 130, 960 310, 950 460 C 1090 620, 880 790, 1000 1100 L -400 1100 Z"></path>
						<path fill="url(#ec-grad)" d="M -400 -200 L 760 -200 C 900 120, 850 300, 840 450 C 960 590, 760 760, 880 1100 L -400 1100 Z"></path>
						<path fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" d="M 760 -200 C 900 120, 850 300, 840 450 C 960 590, 760 760, 880 1100"></path>
					</g>
					<g ref="cierre_derecha" id="cierre-derecha">
						<path fill="url(#ec-grad-tinte)" d="M 2000 -200 L 650 -200 C 570 150, 790 330, 640 480 C 500 630, 720 800, 590 1100 L 2000 1100 Z"></path>
						<path fill="url(#ec-grad)" d="M 2000 -200 L 740 -200 C 690 140, 900 320, 760 470 C 630 620, 830 790, 700 1100 L 2000 1100 Z"></path>
						<path fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" d="M 740 -200 C 690 140, 900 320, 760 470 C 630 620, 830 790, 700 1100"></path>
					</g>
				</g>
			</svg>

			<!-- Titular: texto real en el DOM, nunca parte de los SVG decorativos --
			     tiene que poder leerse con lector de pantalla y seleccionarse
			     (criterio de éxito 6). Copy transcripto sin cambios de
			     contexto/demo_pagina.md §1 y §2 (grupo 322, prompt 04), inyectado
			     por prop desde ScrollDolor.vue -- este componente no lo conoce. -->
			<header ref="titular" class="demo-bloque demo-bloque--apertura demo-apertura__titular">
				<h1 class="demo-apertura__titulo">{{ titulo }}</h1>
				<p class="demo-apertura__subtitulo">{{ subtitulo }}</p>
			</header>
		</div>
	</fondo-seccion-sticky>
</template>

<script>
import FondoSeccionSticky from './FondoSeccionSticky.vue'

/**
 * Apertura cinematográfica de la página inmersiva de demo (grupo 325, prompt
 * 03) -- reemplaza al prompt 06 del grupo 322, descartado porque los SVG no
 * existían. Ahora sí (marca/assets/apertura-*.svg, diseñados por Lucas en
 * Claude Design y calibrados visualmente ahí: no reinventar los tramos).
 *
 * CORRECTIVO (grupo 331): este componente ya NO calcula su propio progreso de
 * scroll ni tiene pin propio -- los dos vivían acá hasta este prompt y los dos
 * eran la causa de que la escena quedara congelada (ver comentario largo en
 * FondoSeccionSticky.vue). Ahora FondoSeccionSticky mide el progreso [0,1] una
 * sola vez para toda la sección y lo pasa por slot escopeado; este componente
 * solo lo consume (on_progreso) y aplica la coreografía (aplicar_estilos), que
 * no cambió en nada -- los tramos, lerp y seg siguen calibrados igual.
 * Prohibido explícito (se mantiene): nada de Framer Motion/Motion ni
 * librerías de springs -- todo transform/opacity/filter puro.
 */
export default {
	name: 'AperturaCinematografica',

	components: {
		FondoSeccionSticky,
	},

	props: {
		/** Titular de la apertura, según perfil del lead (dueño/campeón). */
		titulo: {
			type: String,
			default: '',
		},
		/** Subtítulo de la apertura, según perfil del lead. */
		subtitulo: {
			type: String,
			default: '',
		},
	},

	data() {
		return {
			/** true si el sistema operativo pide reduced-motion: sin listener de scroll. */
			reduced_motion: false,
			/** Ancho/alto reales renderizados de .demo-apertura__capas-cierre (getBoundingClientRect),
			 *  para el cálculo de tamNombre -- se recalculan en cada resize. */
			svg_w: 0,
			svg_h: 0,
			/** true mientras la sección está en viewport -- controla el will-change
			 *  de las capas animadas (criterio de éxito 7: se limpia al salir). */
			en_vista: false,
			/** Instancia del IntersectionObserver que arma en_vista. */
			observer: null,
		}
	},

	mounted() {
		const self = this

		self.reduced_motion = !!(
			typeof window !== 'undefined' &&
			window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		)

		self.medir_svg_cierre()

		if (self.reduced_motion) {
			/* Estado estático y legible, sin listener de scroll registrado
			 * (criterio de éxito 5): titular a opacity 1 sin blur ni scale, forma
			 * protagonista visible y quieta, capas de cierre fuera de cuadro
			 * (mask sin revelar el nombre). */
			self.aplicar_estilos_estatico()
			return
		}

		if (typeof IntersectionObserver !== 'undefined' && self.$refs.contenedor) {
			self.observer = new IntersectionObserver(function (entries) {
				entries.forEach(function (entry) {
					self.en_vista = entry.isIntersecting
					self.actualizar_will_change()
				})
			})
			self.observer.observe(self.$refs.contenedor)
		}

		/* El tamaño real del SVG de cierre depende de window.innerWidth/innerHeight:
		 * un resize (rotar el celular, cambiar de ventana) lo invalida. El progreso
		 * en sí ya no se recalcula acá -- lo mide FondoSeccionSticky, que tiene su
		 * propio listener de resize. */
		window.addEventListener('resize', self.on_resize, { passive: true })
	},

	beforeUnmount() {
		window.removeEventListener('resize', this.on_resize)
		if (this.observer) {
			this.observer.disconnect()
		}
	},

	methods: {
		/**
		 * Recibe el progreso [0,1] de la sección desde el slot escopeado de
		 * FondoSeccionSticky y aplica los estilos correspondientes. Se invoca desde
		 * el template (:data-progreso-aplicado) porque un valor que llega por slot
		 * escopeado no es una prop de Vue real -- no hay watch nativo posible sobre
		 * él. Vue re-evalúa esta expresión cada vez que FondoSeccionSticky actualiza
		 * su progreso (dispara un nuevo render de este slot), así que el efecto es
		 * el mismo que un watch. El atributo resultante no se usa visualmente.
		 *
		 * @param {number} p
		 * @returns {string}
		 */
		on_progreso(p) {
			this.aplicar_estilos(p)
			return ''
		},

		/**
		 * Mide el ancho/alto reales de .demo-apertura__capas-cierre: con
		 * preserveAspectRatio="slice" el viewBox se recorta, así que el tamaño
		 * del hueco del nombre tiene que medirse contra lo que realmente se ve,
		 * no contra el viewBox nominal (1600x900).
		 *
		 * @returns {void}
		 */
		medir_svg_cierre() {
			if (!this.$refs.svg_cierre) {
				return
			}
			const rect = this.$refs.svg_cierre.getBoundingClientRect()
			this.svg_w = rect.width
			this.svg_h = rect.height
		},

		/**
		 * Handler de resize: remide el SVG de cierre (el tamaño del hueco del
		 * nombre depende de eso). El recálculo del progreso lo maneja
		 * FondoSeccionSticky en su propio listener de resize.
		 *
		 * @returns {void}
		 */
		on_resize() {
			this.medir_svg_cierre()
		},

		/**
		 * Activa o limpia will-change en las capas animadas según si la sección
		 * está en viewport (criterio de éxito 7): no acumular capas de
		 * composición en las siete secciones del scroll cuando esta ya quedó
		 * atrás.
		 *
		 * @returns {void}
		 */
		actualizar_will_change() {
			const valor = this.en_vista ? 'transform, opacity, filter' : 'auto'
			const capas = [
				this.$refs.capa_fondo,
				this.$refs.forma_protagonista,
				this.$refs.titular,
				this.$refs.cierre_izquierda,
				this.$refs.cierre_derecha,
				this.$refs.nombre_recortado,
			]
			capas.forEach(function (el) {
				if (el) {
					el.style.willChange = valor
				}
			})
		},

		/**
		 * Escribe por `style` inline (nunca clases: el valor es continuo, no un
		 * estado discreto) la coreografía completa para un progreso `p` dado --
		 * fórmulas ya calibradas visualmente por Lucas en Claude Design, no
		 * reinventar los tramos.
		 *
		 * @param {number} p Progreso [0,1] dentro de la sección pinneada.
		 * @returns {void}
		 */
		aplicar_estilos(p) {
			const clamp = function (v, a, b) {
				return Math.max(a, Math.min(b, v))
			}
			const lerp = function (a, b, t) {
				return a + (b - a) * t
			}
			const easeOut = function (t) {
				return 1 - Math.pow(1 - t, 3)
			}
			const easeInOut = function (t) {
				return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
			}
			const seg = function (v, a, b) {
				return clamp((v - a) / (b - a), 0, 1)
			}

			const f = easeOut(seg(p, 0.16, 0.56)) // la forma sube y crece
			const t = easeInOut(seg(p, 0.1, 0.46)) // el titular retrocede y se desenfoca
			const c = easeInOut(seg(p, 0.46, 0.84)) // las capas se cierran
			const k = easeOut(seg(p, 0.8, 1)) // se abre el hueco de las letras

			if (this.$refs.capa_fondo) {
				const opacidad_fondo = clamp(0.55 + 0.45 * easeOut(seg(p, 0, 0.35)), 0, 1)
				const escala_fondo = lerp(1.06, 1, easeOut(seg(p, 0, 0.7))) * lerp(1, 1.1, easeOut(seg(p, 0.6, 1)))
				this.$refs.capa_fondo.style.opacity = String(opacidad_fondo)
				this.$refs.capa_fondo.style.transform = 'scale(' + escala_fondo + ')'
			}

			if (this.$refs.forma_protagonista) {
				const opacidad_forma = lerp(0, 1, easeOut(seg(p, 0.14, 0.42)))
				const traslado_y = lerp(46, 0, f)
				const escala_forma = lerp(0.34, 1, f) * lerp(1, 1.12, easeOut(seg(p, 0.6, 1)))
				this.$refs.forma_protagonista.style.opacity = String(opacidad_forma)
				this.$refs.forma_protagonista.style.transform =
					'translate(-50%, -50%) translateY(' + traslado_y + 'vh) scale(' + escala_forma + ')'
			}

			if (this.$refs.titular) {
				const opacidad_titular = lerp(1, 0, clamp(t * 1.15, 0, 1))
				this.$refs.titular.style.opacity = String(opacidad_titular)
				this.$refs.titular.style.filter = 'blur(' + 14 * t + 'px)'
				this.$refs.titular.style.transform = 'scale(' + lerp(1, 0.74, t) + ')'
			}

			if (this.$refs.cierre_izquierda) {
				this.$refs.cierre_izquierda.setAttribute('transform', 'translate(' + lerp(-1180, 0, c) + ', 0)')
			}
			if (this.$refs.cierre_derecha) {
				const c_derecha = easeInOut(seg(p, 0.49, 0.87))
				this.$refs.cierre_derecha.setAttribute('transform', 'translate(' + lerp(1180, 0, c_derecha) + ', 0)')
			}

			if (this.$refs.nombre_recortado) {
				/* El tamaño se mide contra el ancho REALMENTE visible del viewBox
				 * (preserveAspectRatio="slice" recorta) -- ver medir_svg_cierre(). */
				const w = this.svg_w || 1
				const h = this.svg_h || 1
				const escala_vista = Math.max(w / 1600, h / 900)
				const unidades_visibles = w / escala_vista
				const tam_nombre = clamp((unidades_visibles * 0.74) / (12 * 0.66), 26, 170)
				this.$refs.nombre_recortado.setAttribute('font-size', String(tam_nombre))
				this.$refs.nombre_recortado.setAttribute('fill-opacity', String(k))
			}
		},

		/**
		 * Estado final estático para prefers-reduced-motion (criterio de éxito
		 * 5): titular legible sin blur ni scale, forma protagonista visible y
		 * quieta, capas de cierre fuera de cuadro (el hueco del nombre no se
		 * revela -- la revelación es parte de la coreografía animada, no algo
		 * que reduced-motion deba mostrar de otra forma).
		 *
		 * @returns {void}
		 */
		aplicar_estilos_estatico() {
			if (this.$refs.capa_fondo) {
				this.$refs.capa_fondo.style.opacity = '1'
				this.$refs.capa_fondo.style.transform = 'none'
			}
			if (this.$refs.forma_protagonista) {
				this.$refs.forma_protagonista.style.opacity = '1'
				this.$refs.forma_protagonista.style.transform = 'translate(-50%, -50%)'
			}
			if (this.$refs.titular) {
				this.$refs.titular.style.opacity = '1'
				this.$refs.titular.style.filter = 'none'
				this.$refs.titular.style.transform = 'none'
			}
			if (this.$refs.cierre_izquierda) {
				this.$refs.cierre_izquierda.setAttribute('transform', 'translate(-1180, 0)')
			}
			if (this.$refs.cierre_derecha) {
				this.$refs.cierre_derecha.setAttribute('transform', 'translate(1180, 0)')
			}
			if (this.$refs.nombre_recortado) {
				this.$refs.nombre_recortado.setAttribute('fill-opacity', '0')
			}
		},
	},
}
</script>

<style scoped>
/* Desde el grupo 331 (correctivo) esta escena ya NO tiene pin propio ni alto
   propio -- vive dentro del único pin de FondoSeccionSticky (100vh, ver ese
   componente), que le da tamaño real (height:100% por la excepción full-bleed
   que ese mismo componente declara para la variante "apertura"). Antes tenía
   su propio position:sticky anidado dentro del pin de FondoSeccionSticky:
   un elemento pinneado no puede medir su propio avance de scroll (su rect.top
   no cambia mientras el pin dura), que era una de las causas de que la escena
   quedara congelada. */
.demo-apertura {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
}

/* Sobredimensionada (inset -4%, 108%) para que escalar por JS (transform:
   scale() en aplicar_estilos) nunca deje ver un borde -- object-fit: cover
   solo aplica a <img>, elemento reemplazado de verdad; el SVG de las capas
   de cierre no lo necesita (viewBox + preserveAspectRatio="slice" ya
   resuelve el recorte) y por eso tiene su propio bloque más abajo, sin
   sobredimensionar: esa capa no escala, tiene que cubrir el viewport
   exacto o el mask quedaría desalineado contra lo que el lead ve. */
.demo-apertura__capa-fondo {
	position: absolute;
	inset: -4%;
	width: 108%;
	height: 108%;
	object-fit: cover;
	pointer-events: none;
	transform-origin: 50% 48%;
}

.demo-apertura__capas-cierre {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
}

.demo-apertura__forma-protagonista {
	position: absolute;
	left: 50%;
	top: 50%;
	width: min(78vh, 62vw);
	height: min(78vh, 62vw);
	object-fit: contain;
	opacity: 0;
	pointer-events: none;
	transform-origin: center;
}

.demo-apertura__titular {
	position: relative;
	z-index: 2;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	gap: 16px;
	padding: 0 20px;
	transform-origin: center;
}

.demo-apertura__titulo {
	font-size: clamp(2rem, 5vw, 3.25rem);
	font-weight: 700;
	line-height: 1.15;
	/* Tracking negativo en texto display grande (§15 de apple-design/SKILL.md). */
	letter-spacing: -0.02em;
	max-width: 780px;
	margin: 0;
}

.demo-apertura__subtitulo {
	font-size: clamp(1.1rem, 2.4vw, 1.4rem);
	color: var(--demo-color-texto-suave);
	margin: 0;
}

/* Estático de verdad bajo reduced-motion (§14 de apple-design/SKILL.md): sin
   movimiento, no una versión "gentil" del mismo movimiento --
   aplicar_estilos_estatico() ya deja los valores finales por JS. El despineo
   del pin (que ya no es de este componente) lo maneja demo-experiencia.scss
   sobre .demo-fondo-seccion__pin, para las siete secciones por igual. */
</style>
