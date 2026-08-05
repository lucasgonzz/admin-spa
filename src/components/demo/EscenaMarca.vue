<template>
	<div class="escena-marca">
		<div class="escena-marca__fondo" aria-hidden="true">
			<span class="escena-marca__forma escena-marca__forma--1"></span>
			<span class="escena-marca__forma escena-marca__forma--2"></span>
			<span class="escena-marca__forma escena-marca__forma--3"></span>
		</div>
		<div
			v-if="atenuacion > 0"
			class="escena-marca__atenuacion"
			:style="{ background: 'rgba(248, 249, 252, ' + atenuacion + ')' }"
			aria-hidden="true"
		></div>
		<div class="escena-marca__contenido">
			<slot />
		</div>
	</div>
</template>

<script>
/**
 * Lenguaje visual de marca compartido (grupo 322, prompt 03): mismo degradé,
 * misma tipografía, mismas formas generadas por código.
 *
 * Hoy lo usa SOLO ConfirmacionArmandoDemo.vue. También era el loader de la ruta
 * pública (grupo 322, prompt 04), hasta que el grupo 355 (prompt 01) lo reemplazó
 * por PantallaCargaMarca.vue: como pantalla de carga no mostraba nada visible --
 * solo el texto para lectores de pantalla sobre las formas pulsantes -- y la carga
 * tiene que verse como la primera pantalla del scroll, con su mismo fondo.
 *
 * Deliberadamente AUTOCONTENIDO: no depende de las variables --demo-color-* de
 * demo-experiencia.scss. Esas variables solo existen dentro de
 * .demo-experiencia-page, cuya hoja de estilos es un chunk lazy de la ruta
 * /experiencia/:uuid -- pero el prompt 04 va a montar este mismo componente
 * en el bootstrap de sesión de App.vue, ANTES de que ese chunk exista. Los
 * valores de color están duplicados a propósito (marca/identidad.md:
 * #0B84F8 / #3A31FC), no referenciados.
 *
 * Puramente presentacional: no tiene prop de visibilidad. El que lo usa decide
 * si lo monta (v-if) o no -- así sirve igual para una pantalla que dura 5
 * segundos (este prompt) que para un loader que dura lo que tarde la sesión.
 */
export default {
	name: 'EscenaMarca',

	props: {
		/**
		 * Opacidad de una capa lisa del color de fondo (#f8f9fc) sobre el degradé
		 * y las formas, para que el texto de encima gane contraste. 0 = sin capa
		 * (la pantalla de carga se ve exactamente como antes de que esta prop
		 * existiera).
		 *
		 * Vive acá, y no en el que la usa, porque tiene que quedar ACOTADA a esta
		 * pantalla: el slot cae dentro de .escena-marca__contenido (max-width:
		 * 560px), así que una capa pasada por el slot no puede cubrir la escena
		 * entera sin salirse de su contenedor. Ver el comentario de
		 * .escena-marca__atenuacion en el <style> sobre por qué eso importa.
		 */
		atenuacion: {
			type: Number,
			default: 0,
		},
	},
}
</script>

<style scoped>
.escena-marca {
	position: relative;
	min-height: 100vh;
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	box-sizing: border-box;
	font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	background: #f8f9fc;
	color: #1c2333;
}

.escena-marca__fondo {
	position: absolute;
	inset: 0;
	z-index: 0;
	pointer-events: none;
}

/* Tres formas generadas por código, sin depender de ningún asset externo:
   pulsan suave en loop (grupo 322, prompt 03, punto 1). Nada de springs ni
   librerías de animación -- CSS puro, mismo criterio que el resto de la
   página inmersiva (herramientas/skills-externas/APLICABILIDAD.md). */
.escena-marca__forma {
	position: absolute;
	border-radius: 50%;
	filter: blur(70px);
	opacity: 0.45;
	animation: escena-marca-pulso 7s ease-in-out infinite;
}

.escena-marca__forma--1 {
	top: 10%;
	left: 15%;
	width: 46vw;
	height: 46vw;
	background: #0b84f8;
	animation-delay: 0s;
}

.escena-marca__forma--2 {
	bottom: 5%;
	right: 10%;
	width: 40vw;
	height: 40vw;
	background: #3a31fc;
	animation-delay: -2.3s;
}

.escena-marca__forma--3 {
	top: 40%;
	right: 30%;
	width: 30vw;
	height: 30vw;
	background: #0b84f8;
	animation-delay: -4.6s;
}

@keyframes escena-marca-pulso {
	0%,
	100% {
		transform: scale(1) translate(0, 0);
		opacity: 0.35;
	}
	50% {
		transform: scale(1.18) translate(3%, -3%);
		opacity: 0.55;
	}
}

/* ABSOLUTE, NUNCA FIXED. Se ve idéntica (esta escena ocupa el viewport entero)
   y la tentación de volver a fixed es real: fixed rompe cualquier contenedor y
   ahorra pensar dónde va la capa. Ya pasó, y costó tres correctivos.

   Historia (grupo 348, prompt 01, 4/8/2026): esta capa nació en
   ConfirmacionArmandoDemo.vue con position:fixed + inset:0, justamente para
   escaparle al max-width:560px de .escena-marca__contenido. Mientras la
   confirmación era un overlay que se desmontaba a los 5s, el velo se iba con
   ella. El correctivo del grupo 331 la dejó montada para siempre -- y desde
   entonces una capa blanca al 55% cubrió el VIEWPORT COMPLETO de la página
   inmersiva, para siempre: el marco #10131c se veía ~#8a8d95 y el degradé de
   marca salía pastel. Nada la acotaba (ningún ancestro tiene transform, filter,
   perspective ni contain, y el overflow:hidden de .escena-marca NO recorta un
   hijo fixed), y como la confirmación va última en el DOM se pintaba encima del
   scroll de dolor y del formulario.

   Acá, como hermano de __fondo y fuera de __contenido, absolute se resuelve
   contra .escena-marca (position:relative) y queda encerrada en su propia
   pantalla, que es lo que se quería desde el principio. */
.escena-marca__atenuacion {
	position: absolute;
	inset: 0;
	z-index: 0;
	pointer-events: none;
}

.escena-marca__contenido {
	position: relative;
	z-index: 1;
	width: 100%;
	max-width: 560px;
	padding: 24px;
	box-sizing: border-box;
}

/* Estático de verdad bajo reduced-motion (§14 de apple-design/SKILL.md): sin
   movimiento, no una versión "gentil" del mismo movimiento. */
@media (prefers-reduced-motion: reduce) {
	.escena-marca__forma {
		animation: none;
	}
}
</style>
