<template>
	<section class="demo-fondo-seccion" :class="'demo-fondo-seccion--' + variante">
		<div class="demo-fondo-seccion__fondo" aria-hidden="true"></div>
		<div class="demo-fondo-seccion__contenido">
			<slot />
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
 */
export default {
	name: 'FondoSeccionSticky',

	props: {
		/** apertura | bloque-1 .. bloque-5 | cierre | interludio -- selecciona el fondo generado. */
		variante: {
			type: String,
			required: true,
		},
	},
}
</script>

<style scoped>
/* min-height (no height fija): 180vh alcanza para que el pin se sienta sin ser eterno,
   pero si el contenido de la sección necesita más, el alto crece con él. */
.demo-fondo-seccion {
	position: relative;
	min-height: 180vh;
}

/* Full-bleed: .demo-scroll-dolor (el padre real de estas secciones) está limitado a
   max-width: 1080px centrado -- el fondo tiene que romper ese límite para llegar a los
   bordes del viewport, mientras el contenido (abajo) se queda adentro de esa columna
   legible. Breakout con margin, NO con left+transform: en un elemento position:sticky
   los insets (left/top/etc.) son umbrales de "a partir de dónde se pega", no offsets
   fijos como en position:relative -- left:50% con transform:translateX(-50%) deja el
   fondo descentrado (el corrimiento se clampea contra el containing block, más angosto
   que los 100vw del propio fondo). margin-left funciona igual sea cual sea el valor de
   position, así que no tiene ese problema. */
.demo-fondo-seccion__fondo {
	position: sticky;
	top: 0;
	width: 100vw;
	margin-left: calc(50% - 50vw);
	height: 100vh;
	z-index: 0;
	pointer-events: none;
}

/* Se superpone al fondo (que sí ocupa espacio de flujo pese a ser sticky) tirando hacia
   arriba la misma altura que el fondo reserva -- así el contenido queda VISUALMENTE
   encima del pin en vez de aparecer recién después de sus 100vh. Column + justify-content
   centra el bloque real (el slot) verticalmente dentro de la ventana fija del pin, sin
   forzarle un ancho de flex-row que le rompería el layout (grid/flex) que ya trae. */
.demo-fondo-seccion__contenido {
	position: relative;
	z-index: 1;
	margin-top: -100vh;
	min-height: 100vh;
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding: 10vh 0;
	box-sizing: border-box;
}
</style>
