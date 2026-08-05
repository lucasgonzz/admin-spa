<template>
	<section
		ref="seccion"
		class="demo-fondo-seccion"
		:class="'demo-fondo-seccion--' + variante"
		:style="{ minHeight: recorrido_vh + 'vh' }"
	>
		<div class="demo-fondo-seccion__pin">
			<div class="demo-fondo-seccion__fondo" aria-hidden="true"></div>
			<div class="demo-fondo-seccion__contenido">
				<slot :progreso="progreso" />
			</div>
		</div>
	</section>
</template>

<script>
/**
 * Wrapper reutilizable de "scroll pinning" (grupo 322, prompt 01): envuelve una sección
 * del scroll de la página inmersiva de demo con un fondo generado por CSS que queda
 * clavado (position: sticky) mientras el contenido de esa sección pasa por encima --
 * mismo efecto que apple.com/apple-vision-pro.
 *
 * El fondo en sí (degradés + textura por variante) vive en demo-experiencia.scss,
 * seleccionado por la clase modificadora demo-fondo-seccion--<variante>: este componente
 * solo arma la estructura y el pin, no sabe nada de colores.
 *
 * CORRECTIVO (grupo 331): hasta este prompt, Apertura/Interludio calculaban su PROPIO
 * progreso midiendo un ref que vivía dentro de este mismo componente, en su día
 * position:sticky -- un elemento pinneado no puede medir su propio avance, porque su
 * rect.top no cambia mientras el pin dura. Ahora ESTE componente (que si se mueve con
 * el scroll -- solo su hijo __pin queda sticky) mide el progreso una única vez contra su
 * propia <section> y lo expone por slot escopeado: un solo motor de scroll para toda la
 * página, sin dos position:sticky anidados.
 *
 * SEGUNDO HALLAZGO, no descrito en el prompt 01 de este grupo (verificado en el
 * navegador, no solo leyendo código): el bug real de "la animación no avanza" NO era
 * ese nesting -- rect.top/rect.height ya se leían bien incluso con el bug viejo. La
 * causa real es que este admin NO scrollea el documento: <main class="app-main-scroll">
 * es el contenedor con scroll real (ver src/sass/_app.sass, html/body/#app son
 * height:100% + overflow:hidden a propósito, "comportamiento tipo app nativa"). Un
 * listener en `window` nunca recibe el evento 'scroll' de un descendiente -- no
 * burbujea hasta ahí -- así que el progreso se calculaba una sola vez al montar
 * y quedaba congelado para siempre. Por eso el listener se registra en el ancestro con
 * scroll real más cercano (encontrar_ancestro_scroll), no en window.
 *
 * CORRECTIVO (grupo 348, prompt 02): el progreso ya no se sigue del scroll de forma
 * directa. Una rueda de mouse en Windows no entrega scroll continuo sino escalones de
 * ~100px, así que mapear el scroll a progreso 1:1 hacía que la coreografía saltara de
 * pose en pose ("parece que sucede todo en seis fps", Lucas, 4/8/2026 -- con trackpad
 * se veía bien, las dos cosas eran ciertas a la vez). Ahora hay dos valores: el
 * objetivo, crudo del rect, y el renderizado, que lo persigue con amortiguación
 * exponencial en un bucle de rAF que corta solo cuando llega. El progreso además se
 * EMITE (evento `progreso`), no solo se expone por slot: consumirlo desde un template
 * ata cada frame a un render de Vue del contenido de la escena.
 */
export default {
	name: 'FondoSeccionSticky',

	props: {
		/** apertura | bloque-1 .. bloque-5 | cierre | interludio -- selecciona el fondo generado. */
		variante: {
			type: String,
			required: true,
		},
		/** Alto total de la sección en vh. 160 = 100vh visibles + 60vh de pin. Las escenas
		 *  con coreografía larga necesitan más recorrido o se sienten atropelladas (grupo 336,
		 *  prompt 02 -- antes era un valor fijo en el <style scoped>, ver comentario ahí abajo). */
		recorrido_vh: {
			type: Number,
			default: 160,
		},
	},

	emits: ['progreso'],

	data() {
		return {
			/** Progreso [0,1] RENDERIZADO: el que se expone por slot escopeado y se emite.
			 *  Persigue a progreso_objetivo con amortiguación, nunca salta a él. */
			progreso: 0,
			/** Progreso [0,1] CRUDO leído del rect en cada frame -- el valor que da el
			 *  scroll, con los escalones de la rueda del mouse incluidos. */
			progreso_objetivo: 0,
			/** Handle del requestAnimationFrame en curso, o null si el bucle está frenado.
			 *  Es también el candado que evita dos bucles en paralelo. */
			raf_id: null,
			/** Timestamp del último frame, para escalar la amortiguación por el delta real. */
			ultimo_ts: 0,
			/** true si el sistema operativo pide reduced-motion: sin listener de scroll. */
			reduced_motion: false,
			/** El ancestro con scroll real (Element) o `window` como fallback -- ver
			 *  encontrar_ancestro_scroll(). Se guarda para poder desuscribirse en beforeUnmount. */
			scroll_target: null,
		}
	},

	mounted() {
		this.reduced_motion = !!(
			typeof window !== 'undefined' &&
			window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		)

		if (this.reduced_motion) {
			/* Sin listener de scroll registrado: el progreso queda en 0 y cada hijo
			 * animado aplica su propio estado estático final (aplicar_estilos_estatico). */
			return
		}

		this.scroll_target = this.encontrar_ancestro_scroll()

		/* Cálculo inicial real (no arrancar en p=0 a ciegas): si la página carga con
		 * esta sección ya parcialmente scrolleada (recarga a media página). Acá el
		 * progreso se FIJA, no se amortigua: amortiguar desde 0 en el montaje sería
		 * una animación de arranque que nadie pidió -- la amortiguación existe para
		 * suavizar el scroll del lead, no la carga de la página. */
		this.calcular_objetivo()
		this.progreso = this.progreso_objetivo
		this.$emit('progreso', this.progreso)

		this.scroll_target.addEventListener('scroll', this.on_scroll, { passive: true })
		/* El alto pinneable depende de window.innerHeight (el pin es 100vh de VIEWPORT,
		 * no del contenedor con scroll), así que un resize invalida el cálculo igual
		 * que un scroll -- esto sí se escucha en window, es el resize del viewport. */
		window.addEventListener('resize', this.on_scroll, { passive: true })
	},

	beforeUnmount() {
		if (this.scroll_target) {
			this.scroll_target.removeEventListener('scroll', this.on_scroll)
		}
		window.removeEventListener('resize', this.on_scroll)

		/* Si el lead navega fuera de la página a mitad de una animación, el bucle
		 * sigue vivo con `self` apuntando a un componente desmontado: hay que
		 * cancelarlo explícitamente, sacar los listeners no alcanza. */
		if (this.raf_id !== null) {
			window.cancelAnimationFrame(this.raf_id)
			this.raf_id = null
		}
	},

	methods: {
		/**
		 * Sube por los ancestros de esta sección hasta encontrar el que realmente
		 * scrollea (overflow-y: auto/scroll) -- en este admin es
		 * <main class="app-main-scroll"> (ver comentario de clase arriba), pero no se
		 * hardcodea ese selector para no atar este componente a un detalle de
		 * implementación de App.vue: si algún día se usa fuera de este shell (o el
		 * shell cambia), cae a `window` como en cualquier página que sí scrollea el
		 * documento.
		 *
		 * @returns {Window|Element}
		 */
		encontrar_ancestro_scroll() {
			let nodo = this.$refs.seccion ? this.$refs.seccion.parentElement : null
			while (nodo && nodo !== document.body) {
				const overflow_y = window.getComputedStyle(nodo).overflowY
				if (overflow_y === 'auto' || overflow_y === 'scroll') {
					return nodo
				}
				nodo = nodo.parentElement
			}
			return window
		},

		/**
		 * Handler de scroll/resize: no recalcula nada, solo se asegura de que el
		 * bucle de animación esté corriendo. El recálculo pasó a vivir adentro del
		 * bucle (animar), porque el progreso ya no se sigue del evento: se persigue
		 * frame a frame aunque el scroll se haya quedado quieto.
		 *
		 * @returns {void}
		 */
		on_scroll() {
			this.arrancar_bucle()
		},

		/**
		 * Arranca el bucle de rAF si no hay uno corriendo. `raf_id` es el candado:
		 * decenas de eventos de scroll por segundo entran acá y todos menos el
		 * primero salen sin hacer nada.
		 *
		 * @returns {void}
		 */
		arrancar_bucle() {
			if (this.raf_id !== null) {
				return
			}
			this.ultimo_ts = 0
			this.raf_id = window.requestAnimationFrame(this.animar)
		},

		/**
		 * Un frame: recalcula el objetivo desde el rect, acerca el progreso
		 * renderizado, y decide si sigue o corta.
		 *
		 * @param {number} ts Timestamp que pasa requestAnimationFrame.
		 * @returns {void}
		 */
		animar(ts) {
			this.raf_id = null

			if (!this.$refs.seccion) {
				return
			}

			/* Primer frame del bucle: no hay delta previo del cual calcular, se asume
			 * un frame de 60fps. Y el delta se topea en 100ms porque una pestaña que
			 * vuelve del fondo entrega un salto enorme, que con la fórmula de abajo
			 * daría un factor ~1 -- o sea, exactamente el salto que este bucle existe
			 * para evitar. */
			const delta_ms = this.ultimo_ts ? Math.min(100, ts - this.ultimo_ts) : 16.67
			this.ultimo_ts = ts

			this.calcular_objetivo()

			/* Amortiguación exponencial hacia el objetivo. El 0.14 es el factor por frame a 60fps:
			   más bajo = más suave y más "pesado", más alto = más pegado al dedo. NO subirlo pensando
			   que "responde tarde": lo que se siente como tardanza es justamente lo que convierte los
			   escalones de la rueda del mouse en movimiento continuo (bug reportado por Lucas, 4/8/2026).
			   Escalado por el delta REAL entre frames y no por frame a secas: en un monitor de 120Hz
			   un factor fijo por frame corre la animación al doble de velocidad. */
			const factor = 1 - Math.pow(1 - 0.14, delta_ms / 16.67)
			const diferencia = this.progreso_objetivo - this.progreso

			if (Math.abs(diferencia) < 0.0005) {
				/* Llegó: se asienta en el valor exacto y el bucle CORTA. Sin este corte
				 * quedaría un rAF girando para siempre en cada una de las siete secciones
				 * de la página, con el scroll quieto y la batería del lead pagándolo. */
				if (this.progreso !== this.progreso_objetivo) {
					this.progreso = this.progreso_objetivo
					this.$emit('progreso', this.progreso)
				}
				return
			}

			this.progreso = this.progreso + diferencia * factor
			this.$emit('progreso', this.progreso)
			this.raf_id = window.requestAnimationFrame(this.animar)
		},

		/**
		 * Progreso [0,1] CRUDO según cuánto del alto "pinneable" de la sección ya se
		 * scrolleó, midiendo la propia <section> (ref="seccion") -- que NO es
		 * sticky y por lo tanto sí se mueve con el scroll, a diferencia de su
		 * hijo __pin. Escribe progreso_objetivo, nunca progreso: lo que se ve pasa
		 * por la amortiguación de animar().
		 *
		 * @returns {void}
		 */
		calcular_objetivo() {
			if (!this.$refs.seccion) {
				return
			}

			const rect = this.$refs.seccion.getBoundingClientRect()
			const alto_pinneable = rect.height - window.innerHeight

			this.progreso_objetivo = alto_pinneable > 0
				? Math.max(0, Math.min(1, -rect.top / alto_pinneable))
				: (rect.top <= 0 ? 1 : 0)
		},
	},
}
</script>

<style scoped>
/* Recorrido del pin: min-height por prop `recorrido_vh` (default 160 = 100vh visibles +
   60vh de "duración" del clavado, ver el inline style del template). Un solo hijo pinneado
   (antes había dos position:sticky hermanos -- fondo y contenido -- con el segundo
   desplazado con margin-top:-100vh; se despegaban en momentos distintos y dejaban un tramo
   de scroll sin contenido, bug real grupo 322/325). NO subir el default sin verificar en
   pantalla: cada vh de más es scroll en el que no cambia nada -- si una escena puntual
   necesita más (coreografía larga, grupo 336 prompt 02), se declara con la prop, no acá. */
.demo-fondo-seccion {
	position: relative;
}

/* Único elemento pinneado. Full-bleed acá (no en el fondo): rompe el max-width del
   padre para llegar a los bordes del viewport. margin-left y no left+transform: en un
   sticky los insets son umbrales de pegado, no offsets (ver comentario histórico de
   este mismo componente antes de este correctivo). overflow:hidden acá adentro para
   que ningún bloque (ni siquiera con contenido más alto de lo esperado) abra un
   scroll interno -- se recorta y se ve en QA. */
.demo-fondo-seccion__pin {
	position: sticky;
	top: 0;
	height: 100vh;
	width: 100vw;
	margin-left: calc(50% - 50vw);
	overflow: hidden;
}

.demo-fondo-seccion__fondo {
	position: absolute;
	inset: 0;
	z-index: 0;
	pointer-events: none;
}

/* El contenido vuelve a la columna legible: el pin es full-bleed, esto no. */
.demo-fondo-seccion__contenido {
	position: absolute;
	inset: 0;
	z-index: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	padding: 4vh 0;
	box-sizing: border-box;
}

.demo-fondo-seccion__contenido > * {
	width: 100%;
	max-width: 1080px;
	padding: 0 20px;
}

/* Apertura e interludio son escenas full-bleed (fondo/SVG a viewport completo), no
   texto de columna legible: la caja de 1080px de arriba les recortaría el fondo (deja
   de "llegar a los bordes", criterio de éxito 6 del prompt 01). Excepción DENTRO de
   este mismo <style scoped> (misma especificidad que la regla base, gana por orden de
   cascada) para no depender de !important ni de la carrera de carga entre bundles que
   ya obligó a usarlo en otro lado de esta página (ver demo-experiencia.scss). */
.demo-fondo-seccion--apertura .demo-fondo-seccion__contenido,
.demo-fondo-seccion--interludio .demo-fondo-seccion__contenido {
	padding: 0;
}

.demo-fondo-seccion--apertura .demo-fondo-seccion__contenido > *,
.demo-fondo-seccion--interludio .demo-fondo-seccion__contenido > * {
	max-width: none;
	height: 100%;
	padding: 0;
}
</style>
