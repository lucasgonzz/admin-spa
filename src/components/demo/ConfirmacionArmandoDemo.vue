<template>
	<escena-marca v-if="visible" class="demo-confirmacion-armando">
		<div class="demo-confirmacion-armando__texto">
			<!-- v-html sobre copy 100% fijo (nunca datos del lead ni de terceros) --
			     es la forma más simple de resaltar "tu demo" con peso tipográfico
			     dentro del título, sin partir el texto en varias interpolaciones. -->
			<h2 class="demo-confirmacion-armando__titulo" v-html="titulo_html"></h2>
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
 * contexto/demo_pagina.md §3-bis -- se transcribe, no se reescribe. El
 * contenedor (ExperienciaDemo.vue) decide cuánto dura montada (~5s) y cuándo
 * se oculta; este componente solo elige QUÉ texto mostrar y lo muestra.
 *
 * Dos variantes elegidas por turno.estado -- NUNCA por el reloj del
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
		/** Controla si la pantalla se muestra. El temporizador de ~5s vive en el contenedor. */
		visible: {
			type: Boolean,
			default: false,
		},
		/** { fecha, hora_inicio, hora_fin, estado, ingreso } del turno, tal como llega del payload. */
		turno: {
			type: Object,
			default: function () {
				return {}
			},
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
/* Pantalla completa mientras está visible (grupo 325, prompt 02): antes
   quedaba como un bloque más en el flujo normal, entre el formulario y el
   video, así que el lead veía el fondo scrolleando detrás. !important en
   position es necesario: este selector compila con su propio atributo
   data-v-* (misma especificidad, 0-2-0, que .escena-marca[data-v-*] del
   propio EscenaMarca.vue, que fija position: relative en su scoped style)
   -- sin !important, cuál de los dos gana dependería del orden de carga
   entre los dos bundles, la misma clase de problema que ya resuelve con
   !important el fallback de prefers-reduced-motion en demo-experiencia.scss. */
.demo-confirmacion-armando {
	position: fixed !important;
	inset: 0;
	z-index: 60;
}

.demo-confirmacion-armando__texto {
	text-align: center;
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.demo-confirmacion-armando__titulo {
	font-size: clamp(1.6rem, 3.6vw, 2.3rem);
	font-weight: 500;
	line-height: 1.25;
	margin: 0;
}

.demo-confirmacion-armando__titulo strong {
	font-weight: 800;
}

.demo-confirmacion-armando__parrafo {
	font-size: 1.05rem;
	line-height: 1.5;
	color: #566078;
	margin: 0;
}
</style>
