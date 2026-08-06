<template>
	<section
		ref="seccion"
		class="demo-fondo-seccion"
		:class="'demo-fondo-seccion--' + variante"
		:style="{ minHeight: recorrido_vh + 'vh' }"
	>
		<!-- 🔴 El punto de snap NO va en la <section> ni en el pin, y esto es exactamente
		     lo que alguien va a "simplificar" (grupo 355, prompt 07). Cada sección mide
		     recorrido_vh, no 100vh: el contenido entra mientras el progreso va de 0 a
		     ENTRADA_FIN (0.42 del alto PINNEABLE desde el grupo 369, que es alto de la sección menos un
		     viewport). Alinear el borde de la sección dejaría al lead mirando el bloque a
		     mitad de entrada, que es justo lo que Lucas no quiere. Este div vacío se
		     planta a `(100% - 100vh) * snap_progreso` del tope y es el que el navegador
		     alinea: la cuenta sale sola para cualquier recorrido_vh. -->
		<div
			class="demo-fondo-seccion__snap"
			:style="{ top: 'calc((100% - 100vh) * ' + snap_progreso + ')' }"
			aria-hidden="true"
		></div>

		<div class="demo-fondo-seccion__pin">
			<div class="demo-fondo-seccion__fondo" aria-hidden="true"></div>
			<div class="demo-fondo-seccion__contenido">
				<slot :progreso="progreso" />
			</div>

			<!-- Botón de avance (grupo 369, prompt 03). Va DENTRO del pin y no en cada
			     consumidor: así aparece en toda sección sin repetirlo seis veces. Y es un
			     <button> de verdad, no un div con @click: tiene que poder pulsarse con
			     Enter y con Espacio y que un lector de pantalla lo anuncie. -->
			<button
				v-if="mostrar_boton"
				type="button"
				class="demo-fondo-seccion__avance"
				aria-label="Ir a la siguiente sección"
				@click="avanzar_seccion"
			>
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
					<path
						d="M6 9.5 12 15.5 18 9.5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	</section>
</template>

<script>
/* Tolerancia para decidir si la sección ocupa la pantalla. Chrome redondea el offset de
   scroll a PÍXELES DE DISPOSITIVO, así que después de un enganche el borde de la sección
   queda a una fracción de píxel del tope y una comparación exacta no se cumple nunca --
   el detalle medido está en el comentario largo de revisar_snap_libre(). La usan las dos
   cosas que preguntan "¿esta sección está encuadrada?": la suspensión del snap y la
   visibilidad del botón de avance. */
const TOLERANCIA_PX = 2

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
		/**
		 * Dónde cae el punto del avance guiado, en fracción del alto PINNEABLE de la
		 * sección (grupo 355, prompt 07). El default es ENTRADA_FIN de ScrollDolor.vue:
		 * el progreso en el que el contenido ya terminó de entrar. El interludio pasa 0
		 * -- ahí el lead tiene que aterrizar con la coreografía en su punto inicial,
		 * para recorrerla entera con su propio scroll ("debería dejar la animación en
		 * el punto inicial y ahí sí darle control total al usuario", Lucas, 5/8/2026).
		 *
		 * 🔴 Este default y ENTRADA_FIN de ScrollDolor.vue son el mismo número escrito
		 * en dos archivos, y tienen que moverse juntos: si la entrada se estira y el
		 * enganche se queda, el lead aterriza con el bloque a medio entrar -- justo lo
		 * que el grupo 355 vino a arreglar. El grupo 369 (prompt 04) los movió de 0.28
		 * a 0.42. Y no se adelanta para incluir el desfase de la pieza (0.495) por el
		 * criterio 2 de ese prompt: donde está, la pieza llega al 99,43% de su entrada
		 * en el aterrizaje, el mismo número de antes. Mover el enganche NO cambia la
		 * velocidad de la entrada, sólo cuándo termina dentro del gesto -- la cuenta
		 * completa, con los dos errores que se cometieron al hacerla, está en el bloque
		 * de constantes de ScrollDolor.vue.
		 */
		snap_progreso: {
			type: Number,
			default: 0.42,
		},
		/**
		 * true en las secciones que suspenden el avance guiado MIENTRAS ocupan la
		 * pantalla: se llega a ellas con el gesto guiado, y de ahí en adelante el
		 * scroll es libre hasta que la sección se termina. Hoy solo el interludio.
		 * Es una prop y no una excepción por `variante` a propósito: la razón es de
		 * comportamiento, no de qué fondo usa la sección.
		 */
		snap_libre_mientras_ocupa: {
			type: Boolean,
			default: false,
		},
		/**
		 * false en las secciones que NO llevan el botón de avance (grupo 369, prompt
		 * 03). Hoy solo el interludio: ahí el scroll es libre a propósito y un botón que
		 * se saltea la escena entera contradice exactamente eso.
		 *
		 * No hace falta apagarlo en la última sección del recorrido: eso lo resuelve
		 * solo `hay_siguiente()` del avance guiado, que es el que sabe si queda algún
		 * destino más abajo.
		 */
		boton_avance: {
			type: Boolean,
			default: true,
		},
	},

	/* El avance guiado lo provee ExperienciaDemo.vue. `default: null` para que este
	   componente siga sirviendo fuera de esa página: sin avance, no hay botón. */
	inject: {
		avance_guiado: {
			default: null,
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
			/** true en las secciones que suspenden el avance guiado mientras están a la
			 *  vista (punto_snap:false, hoy solo el interludio). */
			vigila_snap: false,
			/**
			 * true mientras ESTA sección ocupa la pantalla (grupo 369, prompt 03). De
			 * esto depende que se vea su botón de avance: si el botón se atara solo a
			 * estar montado, scrolleando rápido quedarían seis botones flotando a la vez
			 * -- dos pines pueden estar parcialmente visibles durante la transición.
			 */
			seccion_encuadrada: false,
			/**
			 * true si el avance guiado tiene algún destino más abajo. Se refresca cuando
			 * la sección se encuadra, no en cada frame: es una consulta al DOM.
			 */
			queda_siguiente: false,
		}
	},

	computed: {
		/**
		 * @returns {boolean}
		 */
		mostrar_boton() {
			return !!(
				this.boton_avance &&
				this.avance_guiado &&
				this.seccion_encuadrada &&
				this.queda_siguiente
			)
		},
	},

	mounted() {
		this.reduced_motion = !!(
			typeof window !== 'undefined' &&
			window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		)

		if (this.reduced_motion) {
			/* Sin listener de scroll registrado: el progreso queda en 0 y cada hijo
			 * animado aplica su propio estado estático final (aplicar_estilos_estatico).
			 *
			 * El botón de avance sí tiene que estar (grupo 369, prompt 03): sin listener
			 * no hay forma de saber cuándo la sección se encuadra, y bajo esta preferencia
			 * los pines pasan a `position: static`, así que cada sección ocupa su propio
			 * tramo del documento y nunca hay dos a la vista. Se da por encuadrada. */
			this.seccion_encuadrada = true
			this.revisar_siguiente()
			return
		}

		this.scroll_target = this.encontrar_ancestro_scroll()
		this.vigilar_seccion_sin_snap()
		this.revisar_encuadre()

		/* Cálculo inicial real (no arrancar en p=0 a ciegas): si la página carga con
		 * esta sección ya parcialmente scrolleada (recarga a media página). Acá el
		 * progreso se FIJA, no se amortigua: amortiguar desde 0 en el montaje sería
		 * una animación de arranque que nadie pidió -- la amortiguación existe para
		 * suavizar el scroll del lead, no la carga de la página. */
		this.calcular_objetivo()
		this.progreso = this.progreso_objetivo

		/* El AVISO va en nextTick, el cálculo de arriba no (grupo 349, prompt 01).
		 * Vue corre el mounted() del hijo ANTES que el del padre, así que emitir acá
		 * mismo le llega al consumidor antes de que haya terminado de armarse: en
		 * InterludioPortal, aplicar_estilos() corría con this.pares todavía en []
		 * -- leer_contrato_svg() se ejecuta en el mounted() del padre -- y la
		 * coreografía se quedaba sin pose inicial. Un callback de nextTick registrado
		 * acá corre cuando el flush terminó, o sea después del mounted del padre.
		 * NO sacar el nextTick: sin él, el primer emit se pierde en silencio, que es
		 * el peor modo de falla (no hay error, solo una escena que salta después). */
		const self = this
		this.$nextTick(function () {
			self.$emit('progreso', self.progreso)
		})

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

		/* La clase vive en el scroller del admin entero: si esta sección se desmonta
		 * con el snap suspendido, hay que devolverlo. */
		if (this.vigila_snap) {
			this.vigila_snap = false
			this.alternar_snap_libre(false)
		}

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
		 * Apaga el avance guiado mientras ESTA sección está en pantalla, y solo para
		 * las que declaran `punto_snap: false` -- hoy el interludio (grupo 355,
		 * prompt 07).
		 *
		 * Por qué hace falta, medido en el navegador y no deducido: con
		 * `scroll-snap-type: y mandatory`, un tramo largo SIN puntos de snap no es un
		 * tramo libre. Chrome busca igual el punto más apropiado y tira para allá:
		 * pidiendo la mitad del interludio (scrollTop 9360) terminaba en 11022, y
		 * pidiendo el 25% (8520) terminaba en 6534. O sea, la coreografía entera
		 * quedaba inalcanzable -- justo lo que el prompt marca como inaceptable.
		 * Bajar toda la página a `proximity` tampoco sirve: con secciones de 1280px un
		 * gesto corto no llega a la zona de enganche y el lead vuelve a quedarse a
		 * mitad de camino, que es el problema original de Lucas.
		 *
		 * Así que el snap se apaga y se prende según dónde está el lead. La clase va
		 * sobre el scroller compartido del admin, y se retira en beforeUnmount.
		 *
		 * @returns {void}
		 */
		vigilar_seccion_sin_snap() {
			if (!this.snap_libre_mientras_ocupa || !this.$refs.seccion) {
				return
			}
			this.vigila_snap = true
			this.revisar_snap_libre()
		},

		/**
		 * Suspende o repone el snap según si esta sección está a la vista. Se resuelve
		 * con un rect en el evento de scroll y no con un IntersectionObserver a
		 * propósito: el observer entrega sus entradas dentro del ciclo de render del
		 * navegador, que en una pestaña en segundo plano no corre -- y entonces el
		 * lead que vuelve a la pestaña se encuentra el snap en el estado equivocado.
		 * El evento de scroll llega siempre. Es un rect por evento y solo en la
		 * sección del interludio.
		 *
		 * @returns {void}
		 */
		revisar_snap_libre() {
			if (!this.vigila_snap || !this.$refs.seccion) {
				return
			}
			const rect = this.$refs.seccion.getBoundingClientRect()
			const alto_visible =
				this.scroll_target && this.scroll_target !== window
					? this.scroll_target.clientHeight
					: window.innerHeight

			/* El snap se suspende SOLO mientras esta sección ocupa la pantalla entera,
			 * o sea desde que su borde superior llega al tope hasta que su borde
			 * inferior se va. Ni un píxel antes.
			 *
			 * La primera versión anticipaba una pantalla a cada lado, y estaba mal
			 * (medido por el checker): las secciones miden 1,6 pantallas, así que ese
			 * margen se tragaba los puntos de snap de la sección anterior y del cierre
			 * -- subiendo, el bloque 5 se salteaba entero. El margen existía para poder
			 * ENTRAR al interludio con el snap activo; eso ahora lo resuelve el propio
			 * interludio teniendo su punto en snap_progreso = 0: el gesto guiado
			 * aterriza justo en su comienzo, que es donde el lead tiene que tomar el
			 * control. Desde ahí, esta condición ya es verdadera.
			 *
			 * 🔴 La tolerancia no es cosmética. Chrome redondea el offset de scroll a
			 * PÍXELES DE DISPOSITIVO: con la pantalla al 125% (el default de Windows) el
			 * snap deposita el scroll una décima de píxel POR ARRIBA del borde de la
			 * sección, así que un `rect.top <= 0` exacto no se cumple nunca y el snap
			 * no llega a suspenderse -- el lead pasa del bloque 5 al cierre de un tic y
			 * se saltea la coreografía entera. Medido a dpr 1.25: tope en 9538.5,
			 * aterrizaje en 9538.4, rect.top = +0.1.
			 *
			 * Y no es solo cosa del 125%: barriendo 4 escalas por 10 alturas de
			 * viewport, la condición sin tolerancia fallaba en 15 de las 40
			 * combinaciones, incluidas varias a dpr 1. El residuo máximo medido fue
			 * 0,44px y el techo teórico es un píxel de dispositivo (1/dpr), así que 2px
			 * cubre todos los casos; el falso positivo más cercano -- que el snap se
			 * suspendiera estando parado en otra sección -- queda a 715px.
			 *
			 * La constante se mudó al ámbito del módulo (grupo 369, prompt 03): la misma
			 * pregunta la hace ahora la visibilidad del botón de avance. */
			this.alternar_snap_libre(
				rect.top <= TOLERANCIA_PX && rect.bottom >= alto_visible - TOLERANCIA_PX
			)
		},

		/**
		 * Actualiza si esta sección ocupa la pantalla, que es lo que decide si se ve su
		 * botón de avance (grupo 369, prompt 03). Mismo criterio y misma tolerancia que
		 * revisar_snap_libre -- es la misma pregunta -- pero se resuelve para TODA
		 * sección, no solo para la del interludio.
		 *
		 * Un rect por evento de scroll y por sección. Se prefiere eso a un
		 * IntersectionObserver por el mismo motivo que allá abajo: el observer no entrega
		 * nada en una pestaña que no se está renderizando, y el lead que vuelve a la
		 * pestaña se encontraría el botón en el estado equivocado.
		 *
		 * @returns {void}
		 */
		revisar_encuadre() {
			if (!this.boton_avance || !this.avance_guiado || !this.$refs.seccion) {
				return
			}
			const rect = this.$refs.seccion.getBoundingClientRect()
			const alto_visible =
				this.scroll_target && this.scroll_target !== window
					? this.scroll_target.clientHeight
					: window.innerHeight
			const encuadrada = rect.top <= TOLERANCIA_PX && rect.bottom >= alto_visible - TOLERANCIA_PX

			if (encuadrada === this.seccion_encuadrada) {
				return
			}
			this.seccion_encuadrada = encuadrada
			if (encuadrada) {
				this.revisar_siguiente()
			}
		},

		/**
		 * Le pregunta al avance guiado si queda alguna sección más abajo. Es lo que hace
		 * que el botón no aparezca en la última del recorrido, sin que este componente
		 * tenga que saber cuántas secciones hay ni en qué orden.
		 *
		 * @returns {void}
		 */
		revisar_siguiente() {
			this.queda_siguiente = !!(this.avance_guiado && this.avance_guiado.hay_siguiente())
		},

		/**
		 * El botón dispara EL MISMO avance que un gesto de scroll: mismo cerrojo y misma
		 * cola de uno, así que pulsarlo diez veces seguidas no salta diez secciones
		 * (criterio 3 del prompt 03).
		 *
		 * @returns {void}
		 */
		avanzar_seccion() {
			if (this.avance_guiado) {
				this.avance_guiado.avanzar(1)
			}
		},

		/**
		 * Prende o apaga la clase que suspende el snap en el scroller.
		 *
		 * @param {boolean} libre
		 * @returns {void}
		 */
		alternar_snap_libre(libre) {
			if (!this.scroll_target || !this.scroll_target.classList) {
				return
			}
			this.scroll_target.classList.toggle('demo-scroll-guiado--libre', !!libre)
		},

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
			this.revisar_snap_libre()
			this.revisar_encuadre()
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

/* El punto al que engancha el scroll guiado (grupo 355, prompt 07). Sin alto ni ancho
   visibles: es una marca de posición, no una caja. El `top` lo pone el componente con
   la prop snap_progreso, contra (100% - 100vh), que es el alto pinneable de esta
   sección -- o sea lo que el lead scrollea mientras el contenido está clavado. */
.demo-fondo-seccion__snap {
	position: absolute;
	left: 0;
	width: 1px;
	height: 1px;
	pointer-events: none;
	scroll-snap-align: start;
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

/* Botón de avance (grupo 369, prompt 03). Sutil: un chevron fino en el tono suave de la
   paleta dentro de un círculo apenas insinuado. Sin sombra, sin relleno de color, sin
   texto -- si se nota más que el contenido de la sección, está mal.

   44x44 REALES y no un círculo chico con área de toque aparte: es el mismo número que
   pide la guía de accesibilidad para el dedo, y la mayoría de los leads entra desde el
   teléfono. El z-index 2 lo pone por encima del contenido (que es 1) pero el botón vive
   abajo al centro, donde ninguna de las siete secciones dibuja nada clickeable. */
.demo-fondo-seccion__avance {
	position: absolute;
	z-index: 2;
	left: 50%;
	bottom: clamp(20px, 4vh, 40px);
	transform: translateX(-50%);
	width: 44px;
	height: 44px;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	border: 1px solid rgba(86, 96, 120, 0.28);
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.42);
	color: var(--demo-color-texto-suave);
	cursor: pointer;
	animation: demo-latido-avance 2s ease-in-out infinite;
	transition: opacity 0.2s ease, border-color 0.2s ease;
}

/* Al pasar el mouse el latido se detiene y el botón se afirma: deja de invitar porque
   el lead ya lo encontró. */
.demo-fondo-seccion__avance:hover {
	animation-play-state: paused;
	opacity: 1;
	border-color: rgba(86, 96, 120, 0.55);
}

/* Foco visible, y no el outline del navegador: el anillo de la marca, y con la misma
   forma redonda del botón. */
.demo-fondo-seccion__avance:focus-visible {
	animation-play-state: paused;
	opacity: 1;
	outline: none;
	box-shadow: 0 0 0 3px rgba(11, 132, 248, 0.35);
}

@media (prefers-reduced-motion: reduce) {
	/* Quieto y visible: el latido es exactamente el tipo de movimiento en bucle que esta
	   preferencia pide evitar. */
	.demo-fondo-seccion__avance {
		animation: none;
		opacity: 1;
	}
}
</style>
