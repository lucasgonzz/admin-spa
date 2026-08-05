<template>
	<!-- Fixed y no absolute, al revés que la capa de atenuación de EscenaMarca: esta
	     pantalla tiene que cubrir el viewport entero mientras la página de abajo ya
	     está montada y entrando con su fundido, y se DESMONTA al terminar (v-if +
	     <transition> en ExperienciaDemo.vue). El problema que costó tres correctivos
	     con el velo de la confirmación era un fixed que quedaba montado para siempre;
	     acá el elemento vive lo que dura la carga y nada más. -->
	<div class="demo-carga-marca" role="status" aria-live="polite" aria-busy="true">
		<span class="visually-hidden">Cargando tu demo…</span>

		<!-- Sin mask-image: el isotipo tal cual, con sus propios colores, pulsando
		     suave. NUNCA un spinner: el pedido explícito es que el lead no vea
		     interfaz de sistema en ningún momento. -->
		<img
			src="../../assets/isotipo-comerciocity.svg"
			alt=""
			class="demo-carga-marca__isotipo-respaldo"
			aria-hidden="true"
		/>

		<!-- Con mask-image: el mismo archivo SVG recorta un div que lleva el degradé
		     animado, así el shimmer del título de la confirmación se lleva al isotipo
		     sin duplicar el asset ni tener que inyectar el SVG inline para pintarle
		     los paths por dentro. -->
		<div class="demo-carga-marca__isotipo-shimmer" aria-hidden="true"></div>
	</div>
</template>

<script>
/**
 * Pantalla de carga de la página inmersiva de demo (grupo 355, prompt 01).
 *
 * Reemplaza al `<escena-marca>` que hacía de loader desde el grupo 322 (prompt 04),
 * que no mostraba nada visible: solo el texto para lectores de pantalla sobre las
 * formas pulsantes. Lucas abría /experiencia/{uuid} y veía, en fila, el spinner del
 * admin, un fondo vacío y recién después el titular.
 *
 * Componente propio y no una variante de EscenaMarca.vue, aunque el prompt dejaba
 * las dos puertas abiertas. El motivo: EscenaMarca es deliberadamente AUTOCONTENIDA
 * (no depende de las variables --demo-color-* de demo-experiencia.scss) porque
 * también se monta fuera del chunk de esta ruta; esta pantalla, en cambio, tiene que
 * ser el fondo de la APERTURA -- los mismos dos radial-gradient de la primera
 * sección del scroll -- para que la carga y la primera pantalla se sientan la misma
 * página. Eso son variables y valores de demo-experiencia.scss. Meterle esa variante
 * a EscenaMarca le rompería el autocontenido, que es la razón por la que existe.
 */
export default {
	name: 'PantallaCargaMarca',
}
</script>

<style scoped>
.demo-carga-marca {
	position: fixed;
	inset: 0;
	z-index: 30;
	display: flex;
	align-items: center;
	justify-content: center;
	/* Exactamente el fondo de .demo-fondo-seccion--apertura (demo-experiencia.scss):
	   mismos dos radial-gradient, mismas posiciones y opacidades, sobre el mismo
	   color de fondo. Los valores se repiten porque aquella regla los declara sobre
	   .demo-fondo-seccion__fondo, un elemento de FondoSeccionSticky.vue que acá no
	   existe -- lo que se comparte es la identidad visual, no el nodo. */
	background-color: var(--demo-color-fondo, #f8f9fc);
	background-image:
		radial-gradient(120% 90% at 20% 15%, rgba(11, 132, 248, 0.35), transparent 60%),
		radial-gradient(100% 80% at 85% 90%, rgba(58, 49, 252, 0.3), transparent 55%);
}

.demo-carga-marca__isotipo-respaldo,
.demo-carga-marca__isotipo-shimmer {
	width: clamp(96px, 14vw, 160px);
	height: clamp(96px, 14vw, 160px);
}

/* Respaldo: el isotipo tal cual, pulsando. Es lo que se ve si el navegador no
   soporta mask-image (el @supports de abajo lo oculta cuando sí lo soporta). */
.demo-carga-marca__isotipo-respaldo {
	object-fit: contain;
	animation: demo-carga-marca-pulso 2.1s ease-in-out infinite;
}

/* Fuera del @supports el shimmer no se muestra: sin máscara, este div sería un
   rectángulo con el degradé, no el isotipo. */
.demo-carga-marca__isotipo-shimmer {
	display: none;
}

/* La condición se prueba con un degradé y no con una url: el minificador de la build
   deja `url('')` como `url()`, y una url vacía en un @supports es justo el tipo de
   borde donde un navegador puede evaluar cualquier cosa. Con el degradé la pregunta
   es la que importa -- "¿sabés enmascarar?" -- y no hay navegador que soporte
   mask-image con gradiente pero no con url. */
@supports (
	(-webkit-mask-image: linear-gradient(#000, #000)) or (mask-image: linear-gradient(#000, #000))
) {
	.demo-carga-marca__isotipo-respaldo {
		display: none;
	}

	.demo-carga-marca__isotipo-shimmer {
		display: block;
		-webkit-mask-image: url('../../assets/isotipo-comerciocity.svg');
		mask-image: url('../../assets/isotipo-comerciocity.svg');
		-webkit-mask-size: contain;
		mask-size: contain;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		mask-position: center;
		/* Mismo shimmer que el título de la confirmación: banda clara que recorre un
		   fondo de marca, mismo @keyframes (demo-experiencia.scss) y misma cadencia
		   de 2.1s. Lo que cambia es de qué color es lo que la banda recorre: allá el
		   texto, acá el degradé azul -> violeta del isotipo. */
		background-image: linear-gradient(
			100deg,
			var(--demo-color-azul, #0b84f8) 0%,
			var(--demo-color-azul, #0b84f8) 34%,
			#eaf3ff 50%,
			var(--demo-color-violeta, #3a31fc) 66%,
			var(--demo-color-violeta, #3a31fc) 100%
		);
		background-size: 220% 100%;
		animation: demo-confirmacion-shimmer 2.1s linear infinite;
	}
}

@keyframes demo-carga-marca-pulso {
	0%,
	100% {
		opacity: 0.55;
	}
	50% {
		opacity: 1;
	}
}

/* Estático de verdad bajo reduced-motion (§14 de apple-design/SKILL.md): el isotipo
   queda quieto y a plena opacidad, sin versión "gentil" del mismo movimiento. */
@media (prefers-reduced-motion: reduce) {
	.demo-carga-marca__isotipo-respaldo {
		animation: none;
		opacity: 1;
	}

	.demo-carga-marca__isotipo-shimmer {
		animation: none;
		background-image: linear-gradient(
			160deg,
			var(--demo-color-azul, #0b84f8) 0%,
			var(--demo-color-violeta, #3a31fc) 100%
		);
		background-size: 100% 100%;
	}
}
</style>
