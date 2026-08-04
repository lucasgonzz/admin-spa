<template>
	<escena-marca class="demo-confirmacion-armando">
		<!-- Atenúa la escena de marca detrás del texto (grupo 331, correctivo):
		     capa sólida semitransparente, nunca backdrop-filter (§12 de la skill +
		     APLICABILIDAD.md) -- el degradé sigue visible pero deja de competir
		     con el texto. position:fixed para que cubra el viewport completo sin
		     quedar acotada por el max-width de .escena-marca__contenido. -->
		<div class="demo-confirmacion-armando__atenuacion" aria-hidden="true"></div>
		<div class="demo-confirmacion-armando__texto">
			<!-- v-html sobre copy 100% fijo (nunca datos del lead ni de terceros) --
			     es la forma más simple de resaltar "tu demo" con peso tipográfico
			     dentro del título, sin partir el texto en varias interpolaciones. -->
			<h2
				class="demo-confirmacion-armando__titulo"
				:class="{ 'demo-confirmacion-armando__titulo--shimmer': shimmer_activo }"
				v-html="titulo_html"
			></h2>
			<p v-if="parrafo_reserva" class="demo-confirmacion-armando__parrafo">{{ parrafo_reserva }}</p>
			<p class="demo-confirmacion-armando__parrafo">
				Mientras tanto, mirá esta introducción: te contamos para qué sirve la demo, qué podés
				probar adentro y cómo trabajamos.
			</p>
		</div>
	</escena-marca>
</template>

<script>
import EscenaMarca from './EscenaMarca.vue'

/**
 * Pantalla de confirmación "armando tu demo" (grupo 322, prompt 03), copy de
 * contexto/demo_pagina.md §3-bis -- se transcribe, no se reescribe.
 *
 * CORRECTIVO (grupo 331): deja de ser un overlay `position: fixed` que el
 * contenedor monta y desmonta -- ahora es el primer tramo (100dvh) de la
 * "vista posterior" a la confirmación del formulario (ver ExperienciaDemo.vue),
 * y el contenedor la mantiene montada mientras `intro_desbloqueada` sea true.
 * El mensaje ya no desaparece a los ~5s: lo único que se apaga es el shimmer
 * del título (`shimmer_activo`), que pasa a color sólido porque el proceso ya
 * terminó -- el lead puede volver a subir y seguir leyéndolo.
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
		/** true mientras dura el proceso de armado (~5s tras enviar el formulario):
		 *  el título muestra el shimmer tipo skeleton. false de ahí en más (incluida
		 *  la visita de un lead que ya había completado el formulario antes: para
		 *  ese lead no hay ningún proceso en curso que anunciar). */
		shimmer_activo: {
			type: Boolean,
			default: false,
		},
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

/* Atenúa la escena de marca (degradé + formas) detrás del texto -- el
   subtítulo #3d4657 no alcanza contraste AA contra la zona más intensa del
   degradé sin esto. position:fixed (no absolute): rompe el max-width:560px
   de .escena-marca__contenido (que es el positioning context más cercano)
   para cubrir el viewport completo, "a todo el ancho" como pide el prompt.
   z-index explícito + position:relative en __texto (ver esa regla) para que
   el orden de pintado no dependa de que ninguno de los dos sea position:auto. */
.demo-confirmacion-armando__atenuacion {
	position: fixed;
	inset: 0;
	z-index: 0;
	background: rgba(248, 249, 252, 0.55);
	pointer-events: none;
}

.demo-confirmacion-armando__texto {
	position: relative;
	z-index: 1;
	text-align: center;
	display: flex;
	flex-direction: column;
	gap: 14px;
	/* Misma animación de entrada que la apertura del scroll de dolor (grupo 336, prompt
	   03: "las dos pantallas se sientan de la misma familia"), keyframe compartido en
	   demo-experiencia.scss. Corre una sola vez al montarse -- esta sección recién
	   existe en el DOM cuando el lead confirma el formulario (v-if en
	   ExperienciaDemo.vue), así que "al montarse" es exactamente "apenas se ve". */
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

@keyframes demo-confirmacion-shimmer {
	from {
		background-position: 180% 0;
	}
	to {
		background-position: -80% 0;
	}
}

.demo-confirmacion-armando__parrafo {
	font-size: 1.05rem;
	line-height: 1.5;
	/* #566078 sobre la zona más intensa del degradé, incluso atenuada por la
	   capa de arriba, no alcanza AA -- #3d4657 sí (medido contra el peor caso:
	   azul de marca #0b84f8 detrás de la capa rgba(248,249,252,0.55)). */
	color: #3d4657;
	margin: 0;
	position: relative;
	z-index: 1;
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

	.demo-confirmacion-armando__texto {
		animation: none;
		opacity: 1;
		transform: none;
		filter: none;
	}
}
</style>
