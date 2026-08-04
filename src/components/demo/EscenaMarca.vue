<template>
	<div class="escena-marca">
		<div class="escena-marca__fondo" aria-hidden="true">
			<span class="escena-marca__forma escena-marca__forma--1"></span>
			<span class="escena-marca__forma escena-marca__forma--2"></span>
			<span class="escena-marca__forma escena-marca__forma--3"></span>
		</div>
		<div class="escena-marca__contenido">
			<slot />
		</div>
	</div>
</template>

<script>
/**
 * Lenguaje visual de marca compartido (grupo 322, prompt 03): mismo degradé,
 * misma tipografía, mismas formas generadas por código -- lo usan tanto
 * ConfirmacionArmandoDemo.vue (este prompt) como el loader de la ruta pública
 * (prompt 04 de este mismo grupo, que lo reutiliza en vez de duplicar el CSS).
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
