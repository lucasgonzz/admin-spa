<template>
	<!-- La atenuación de la escena de marca detrás del texto (capa sólida
	     semitransparente, nunca backdrop-filter: §12 de la skill +
	     APLICABILIDAD.md) la pinta ahora EscenaMarca por prop, acotada a su
	     propia pantalla. Antes era un div de este componente con position:fixed
	     y cubría el viewport entero de la página inmersiva para siempre --
	     grupo 348, prompt 01. El valor se mantiene en el 0.55 de siempre: ese
	     correctivo arregla el alcance de la capa, no su intensidad. -->
	<escena-marca class="demo-confirmacion-armando" :atenuacion="0.55">
		<div
			ref="texto"
			class="demo-confirmacion-armando__texto"
			:class="{ 'demo-confirmacion-armando__texto--visible': visible }"
		>
			<!-- v-html sobre copy 100% fijo (nunca datos del lead ni de terceros) --
			     es la forma más simple de resaltar "tu demo" con peso tipográfico
			     dentro del título, sin partir el texto en varias interpolaciones. -->
			<!-- El shimmer ya no se prende y se apaga (grupo 355, prompt 10): corre en
			     loop mientras la pantalla esté a la vista. La clase queda fija, y el
			     @media (prefers-reduced-motion: reduce) del <style> lo sigue anulando. -->
			<h2
				class="demo-confirmacion-armando__titulo demo-confirmacion-armando__titulo--shimmer"
				v-html="titulo_html"
			></h2>
			<p v-if="parrafo_reserva" class="demo-confirmacion-armando__parrafo">{{ parrafo_reserva }}</p>
		</div>

		<!-- La invitación al video sale del bloque del título (grupo 348, prompt 06):
		     compartiendo contenedor y animación entraba junto con él y competía en vez
		     de sucederlo, y es justo lo que tiene que enganchar al lead para que siga
		     bajando. Ahora es el segundo momento de la pantalla -- separación real y
		     entrada propia, a los 3s (grupo 355, prompt 10: "durante los primeros tres
		     segundos lo único que se vea sea ese título"). El párrafo de la reserva se
		     queda arriba: es parte del mensaje de confirmación, no de la invitación.

		     v-if y no solo una clase: con el elemento en el DOM desde el principio, su
		     margen y su alto reservan un hueco visible debajo del título durante esos
		     tres segundos. -->
		<p
			v-if="invitacion_visible"
			class="demo-confirmacion-armando__invitacion"
		>
			Mientras tanto, mirá esta introducción: te contamos para qué sirve la demo, qué podés
			probar adentro y cómo trabajamos.
		</p>
	</escena-marca>
</template>

<script>
import EscenaMarca from './EscenaMarca.vue'
/* El retraso ya no se declara acá: vive en tiempos-confirmacion.js junto al del
   scroll al video, que se deriva de él (grupo 370, correctivo 8, prompt 06). Los dos
   momentos son la misma secuencia contada desde el mismo instante, en dos archivos. */
import { RETRASO_INVITACION_MS } from './tiempos-confirmacion'

/**
 * Pantalla de confirmación "armando tu demo" (grupo 322, prompt 03), copy de
 * contexto/demo_pagina.md §3-bis -- se transcribe, no se reescribe.
 *
 * CORRECTIVO (grupo 331): deja de ser un overlay `position: fixed` que el
 * contenedor monta y desmonta -- ahora es el primer tramo (100dvh) de la
 * "vista posterior" a la confirmación del formulario (ver ExperienciaDemo.vue),
 * y el contenedor la mantiene montada mientras `intro_desbloqueada` sea true.
 * El mensaje ya no desaparece a los ~5s. Y desde el grupo 355 (prompt 10) el
 * shimmer del título tampoco se apaga: corre en loop mientras la pantalla esté
 * a la vista, así que dejó de existir el prop que lo prendía y lo apagaba.
 *
 * Dos variantes de copy elegidas por turno.estado -- NUNCA por el reloj del
 * navegador, mismo criterio que ya usa BotonAcceso.vue para sus cuatro
 * estados. El motivo (demo_pagina.md §3-bis): el formulario no dispara el
 * demo setup (regla formulario + T-15, lo que pase último), así que un lead
 * que completa el formulario un día antes vería "estamos preparando tu
 * demo" -- falso -- si solo hubiera una variante.
 */
export default {
	name: 'ConfirmacionArmandoDemo',

	components: {
		EscenaMarca,
	},

	props: {
		/** { fecha, hora_inicio, hora_fin, estado, ingreso } del turno, tal como llega del payload. */
		turno: {
			type: Object,
			default: function () {
				return {}
			},
		},
	},

	data() {
		return {
			/**
			 * true cuando .demo-confirmacion-armando__texto ya entró en el viewport --
			 * dispara la animación de entrada (grupo 336, correctivo 7). Esta pantalla
			 * está al fondo de un scroll largo (después de las 7 secciones del scroll de
			 * dolor) y el scrollIntoView que la trae tarda más que la propia animación
			 * -- si esta arrancara al montarse (como al principio), terminaría entera
			 * antes de que el lead viera el primer píxel. Mismo patrón que ya usa
			 * ScrollDolor.vue para los bloques 1-5 (IntersectionObserver + clase
			 * --visible), en vez de animar al montar.
			 */
			visible: false,
			/**
			 * true cuando entra la invitación a mirar el video, RETRASO_INVITACION_MS
			 * después de que el bloque del título se volvió visible (grupo 348, prompt
			 * 06; el retraso pasó a 3s en el grupo 355, prompt 10). Secuencia
			 * pedida por Lucas: título con el shimmer del armado, pausa, y recién
			 * después la invitación.
			 */
			invitacion_visible: false,
			/** Instancia del IntersectionObserver que dispara la animación de entrada. */
			observer: null,
			/** Handle del setTimeout de la invitación, para poder cancelarlo al desmontar. */
			invitacion_timeout: null,
		}
	},

	mounted() {
		const self = this

		const reduced_motion = !!(
			typeof window !== 'undefined' &&
			window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		)

		if (reduced_motion || typeof IntersectionObserver === 'undefined') {
			/* Sin animación que disparar: el texto ya queda visible de una por CSS
			 * bajo reduced-motion (ver <style scoped>), y sin IntersectionObserver
			 * (navegador viejo) no hay forma de saber cuándo entra en viewport --
			 * mejor mostrarlo directo que dejarlo invisible para siempre. */
			self.visible = true
			/* Sin secuencia temporal tampoco: los dos bloques aparecen de entrada. La
			 * separación visual entre el mensaje y la invitación se mantiene igual --
			 * lo que se saca es la espera, no la jerarquía. */
			self.invitacion_visible = true
			return
		}

		self.observer = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) {
					return
				}
				self.visible = true
				/* La invitación entra DESPUÉS: tres segundos en los que el lead solo
				 * ve el título con el shimmer corriendo (grupo 355, prompt 10; antes
				 * eran 900ms y se leían como parte del mismo momento). Los 3s de acá y
				 * los 5s del scroll al video (ExperienciaDemo) se cuentan desde el mismo
				 * punto: no son 3 y después 5 más. Colgado del observer y no de mounted() por el mismo
				 * motivo que la animación de arriba (grupo 336, correctivo 7): al
				 * montarse, el scrollIntoView todavía está en camino y la secuencia
				 * entera se consumiría antes de que el lead vea el primer píxel. */
				if (!self.invitacion_visible && self.invitacion_timeout === null) {
					self.invitacion_timeout = window.setTimeout(function () {
						self.invitacion_visible = true
						self.invitacion_timeout = null
					}, RETRASO_INVITACION_MS)
				}
				/* Una vez que se vio, no hace falta seguir observando -- la sección no
				 * se desmonta (queda montada para siempre, ver comentario de la clase
				 * de este componente) así que sin esto el observer seguiría vivo sin
				 * ningún propósito. */
				self.observer.disconnect()
			})
		})

		if (self.$refs.texto) {
			self.observer.observe(self.$refs.texto)
		}
	},

	beforeUnmount() {
		if (this.observer) {
			this.observer.disconnect()
		}
		/* Mismo criterio que confirmacion_timeout en ExperienciaDemo.vue: navegar
		 * fuera de la página durante ese segundo no puede dejar un timer corriendo
		 * contra un componente que ya no existe. */
		if (this.invitacion_timeout !== null) {
			window.clearTimeout(this.invitacion_timeout)
			this.invitacion_timeout = null
		}
	},

	computed: {
		/**
		 * true si el turno está activo AHORA (el lead entra ya) -- mismo criterio
		 * que BotonAcceso.vue: el estado siempre lo decide el backend.
		 *
		 * @returns {boolean}
		 */
		es_turno_activo() {
			return !!(this.turno && this.turno.estado === 'activo')
		},

		/**
		 * Título con "tu demo" resaltado por peso tipográfico (nunca mayúsculas,
		 * demo_pagina.md §3-bis). HTML fijo, no interpola nada del lead.
		 *
		 * @returns {string}
		 */
		titulo_html() {
			return this.es_turno_activo
				? 'Estamos preparando <strong>tu demo</strong>.'
				: '<strong>Tu demo</strong> queda armada con lo que nos contaste.'
		},

		/**
		 * Duración del turno en texto ("1 hora", "1 h 30 min", "45 minutos"),
		 * calculada de turno.hora_inicio/hora_fin -- NUNCA hardcodeada. Cadena
		 * vacía si faltan datos o el cálculo no da positivo.
		 *
		 * @returns {string}
		 */
		duracion_texto() {
			const minutos_inicio = this.parsear_minutos(this.turno && this.turno.hora_inicio)
			const minutos_fin = this.parsear_minutos(this.turno && this.turno.hora_fin)
			if (minutos_inicio === null || minutos_fin === null) {
				return ''
			}

			const total = minutos_fin - minutos_inicio
			if (total <= 0) {
				return ''
			}

			const horas = Math.floor(total / 60)
			const minutos = total % 60

			if (horas > 0 && minutos > 0) {
				return horas + ' h ' + minutos + ' min'
			}
			if (horas > 0) {
				return horas === 1 ? '1 hora' : horas + ' horas'
			}
			return minutos + ' minutos'
		},

		/**
		 * "hoy" / "mañana" / día de la semana en minúscula, calculado contra la
		 * fecha actual en zona Argentina (no la del navegador del lead) -- mismo
		 * espíritu que fecha_hora_inicio de BotonAcceso.vue. Cadena vacía si
		 * falta turno.fecha o no se pudo parsear.
		 *
		 * @returns {string}
		 */
		dia_texto() {
			const fecha = this.turno && this.turno.fecha
			if (!fecha) {
				return ''
			}

			const fecha_solo = new Date(fecha + 'T00:00:00-03:00')
			if (isNaN(fecha_solo.getTime())) {
				return ''
			}

			const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
			const ahora = new Date()
			const hoy_str = formatter.format(ahora)
			const manana_str = formatter.format(new Date(ahora.getTime() + 24 * 60 * 60 * 1000))

			if (fecha === hoy_str) {
				return 'hoy'
			}
			if (fecha === manana_str) {
				return 'mañana'
			}

			// getDay() lee el día en el huso del NAVEGADOR, no en el de Argentina: con
			// fecha_solo fijada a las 03:00 UTC, un lead en un huso más al oeste (Chile,
			// Bolivia, Perú, Colombia, México, EE.UU.) vería el día anterior. Intl con
			// timeZone explícito, igual que el formatter de hoy_str/manana_str arriba,
			// saca el nombre del día ya resuelto en zona Argentina.
			const nombre_dia = new Intl.DateTimeFormat('es-AR', {
				timeZone: 'America/Argentina/Buenos_Aires',
				weekday: 'long',
			}).format(fecha_solo)
			return nombre_dia
		},

		/**
		 * Párrafo de la reserva (variante a o b, demo_pagina.md §3-bis). Cadena
		 * vacía si no hay datos suficientes para armarlo -- preferible una frase
		 * menos que un "durante undefined" (detalle explícito del prompt).
		 *
		 * @returns {string}
		 */
		parrafo_reserva() {
			const duracion = this.duracion_texto
			if (!duracion) {
				return ''
			}

			if (this.es_turno_activo) {
				return 'Durante ' + duracion + ' va a estar reservada exclusivamente para vos, para que la pruebes con casos de tu negocio.'
			}

			const dia = this.dia_texto
			const hora = this.turno && this.turno.hora_inicio
			if (!dia || !hora) {
				return ''
			}

			return 'El ' + dia + ' a las ' + hora + ' va a estar reservada exclusivamente para vos, durante ' + duracion + ', para que la pruebes con casos de tu negocio.'
		},
	},

	methods: {
		/**
		 * Parsea una hora "HH:MM" a minutos totales desde medianoche.
		 *
		 * @param {string|undefined} hora_str
		 * @returns {number|null}
		 */
		parsear_minutos: function (hora_str) {
			if (!hora_str) {
				return null
			}
			const partes = String(hora_str).split(':')
			if (partes.length !== 2) {
				return null
			}
			const horas = parseInt(partes[0], 10)
			const minutos = parseInt(partes[1], 10)
			if (isNaN(horas) || isNaN(minutos)) {
				return null
			}
			return horas * 60 + minutos
		},
	},
}
</script>

<style scoped>
/* CORRECTIVO (grupo 331): ya no es una capa fija a pantalla completa (grupo
   325, prompt 02) -- ahora es el primer tramo, en flujo normal, de la vista
   posterior a la confirmación del formulario (ver ExperienciaDemo.vue). Se
   queda con el position:relative + flex centrado que ya trae .escena-marca
   por default; solo hace falta el alto de viewport completo, con 100dvh como
   preferido (barra de direcciones móvil) y 100vh como fallback -- el orden
   importa: un navegador sin soporte de dvh ignora esa declaración entera y
   se queda con la de arriba. */
.demo-confirmacion-armando {
	min-height: 100vh;
	min-height: 100dvh;
}

.demo-confirmacion-armando__texto {
	position: relative;
	z-index: 1;
	text-align: center;
	display: flex;
	flex-direction: column;
	gap: 14px;
	/* CORRECTIVO (grupo 336, correctivo 7): invisible hasta que el IntersectionObserver
	   de mounted() confirme que el elemento realmente entra en el viewport -- animar
	   directo al montarse (v-if) corría la animación entera MIENTRAS el scrollIntoView
	   todavía estaba en camino (la sección queda a ~13.000px scroll abajo, ~1.4s de
	   smooth scroll contra 1.2s de animación): el lead nunca llegaba a verla, la
	   encontraba ya en su estado final. */
	opacity: 0;
}

/* Misma animación de entrada que la apertura del scroll de dolor (grupo 336, prompt 03:
   "las dos pantallas se sientan de la misma familia"), keyframe compartido en
   demo-experiencia.scss -- ver el comentario ahí sobre por qué un @keyframes no puede
   vivir en un <style scoped> si lo usa más de un componente. */
.demo-confirmacion-armando__texto--visible {
	animation: demo-apertura-entrada 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.demo-confirmacion-armando__titulo {
	font-size: clamp(1.6rem, 3.6vw, 2.3rem);
	font-weight: 500;
	line-height: 1.25;
	margin: 0;
	/* Color sólido de base -- lo que se ve si el @supports de abajo no aplica
	   (navegador sin background-clip: text) y también bajo reduced-motion. */
	color: var(--demo-color-texto);
}

.demo-confirmacion-armando__titulo strong {
	font-weight: 800;
}

/* Shimmer tipo skeleton (pedido de Lucas): un brillo recorre el título
   mientras el armado está en curso. Envuelto en @supports a propósito --
   background-clip: text + color: transparent deja el título INVISIBLE en un
   navegador que no soporte el clip, así que la regla completa (incluido
   color: transparent) solo se aplica si el navegador puede pintar el texto
   con ella. El color sólido de arriba queda de base fuera de este bloque. */
@supports ((-webkit-background-clip: text) or (background-clip: text)) {
	.demo-confirmacion-armando__titulo--shimmer {
		background: linear-gradient(
			100deg,
			var(--demo-color-texto) 0%,
			var(--demo-color-texto) 38%,
			var(--demo-color-azul) 50%,
			var(--demo-color-texto) 62%,
			var(--demo-color-texto) 100%
		);
		background-size: 220% 100%;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		animation: demo-confirmacion-shimmer 2.1s linear infinite;
	}
}

/* El @keyframes demo-confirmacion-shimmer se mudó a demo-experiencia.scss (grupo 355,
   prompt 01): la pantalla de carga de la página (PantallaCargaMarca.vue) usa el mismo
   efecto sobre el isotipo, y dos declaraciones del mismo nombre en dos <style scoped>
   distintos se pisan entre sí -- Vue no acota los nombres de @keyframes. La animación
   de acá arriba lo sigue usando igual: el archivo compartido ya está importado por
   ExperienciaDemo.vue, que es quien monta esta pantalla. */

.demo-confirmacion-armando__parrafo {
	font-size: 1.05rem;
	line-height: 1.5;
	/* #566078 sobre la zona más intensa del degradé, incluso atenuada por la
	   capa de EscenaMarca (:atenuacion="0.55"), no alcanza AA -- #3d4657 sí
	   (medido contra el peor caso: azul de marca #0b84f8 detrás de la capa
	   rgba(248,249,252,0.55)). */
	color: #3d4657;
	margin: 0;
	position: relative;
	z-index: 1;
}

/* La invitación al video: segundo momento de la pantalla (grupo 348, prompt 06).
   Un escalón más de presencia que el párrafo de la reserva -- cuerpo más grande y
   color más firme -- sin llegar al del título: sigue siendo texto de apoyo, pero
   no una nota al pie. La separación se declara acá y no como gap del contenedor
   de arriba porque este párrafo ya NO vive adentro de ese contenedor: es hermano
   de .demo-confirmacion-armando__texto, dentro del slot de EscenaMarca. */
.demo-confirmacion-armando__invitacion {
	animation: demo-confirmacion-invitacion 0.8s ease both;
	margin: clamp(40px, 8vh, 88px) 0 0;
	font-size: clamp(1.1rem, 1.6vw, 1.25rem);
	line-height: 1.5;
	text-align: center;
	/* Un paso más oscuro que el #3d4657 del párrafo de la reserva, medido contra
	   el mismo peor caso (azul de marca detrás de la atenuación de EscenaMarca). */
	color: #2b3448;
	position: relative;
	z-index: 1;
}

/* Un fundido y nada más (grupo 355, prompt 10): el fundido + zoom + desenfoque de
   demo-apertura-entrada es el gesto con el que entra un titular, y acá lo que entra
   es un segundo momento tranquilo, tres segundos después. Se aplica sobre el
   elemento base porque ahora aparece con v-if -- la animación corre al montarse.

   Este @keyframes SÍ puede vivir en un <style scoped>, a diferencia de los otros dos
   de la página: un @keyframes scoped no queda acotado al componente, y eso importa
   cuando dos archivos declaran el mismo nombre. Este lo usa solo esta pantalla y el
   nombre no existe en ningún otro lado. */
@keyframes demo-confirmacion-invitacion {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}

/* Estático de verdad bajo reduced-motion (§14 de apple-design/SKILL.md): sin
   shimmer y sin el recorte de fondo que lo sostiene. Sin !important: esta
   regla vive en el mismo archivo y con la misma especificidad (0-2-0) que la
   del @supports de arriba -- gana por orden de cascada (va despues), no hace
   falta forzarla; !important acá sería ruido, no protección real. */
@media (prefers-reduced-motion: reduce) {
	.demo-confirmacion-armando__titulo--shimmer {
		background: none;
		-webkit-background-clip: initial;
		background-clip: initial;
		color: var(--demo-color-texto);
		animation: none;
	}

	.demo-confirmacion-armando__texto,
	.demo-confirmacion-armando__invitacion {
		animation: none;
		opacity: 1;
		transform: none;
		filter: none;
	}
}
</style>
