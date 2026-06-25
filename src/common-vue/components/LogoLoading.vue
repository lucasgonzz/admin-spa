<template>
	<!-- Transición de entrada/salida del overlay global de carga -->
	<transition name="logo-loading-fade">
		<div
			v-if="loading"
			class="logo-loading-overlay"
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<!-- Panel central: indicador + mensaje opcional -->
			<div class="logo-loading-panel">
				<!-- Spinner circular para operaciones habituales de la API -->
				<div
					class="logo-loading-spinner"
					aria-hidden="true"
				>
					<span class="logo-loading-spinner-ring"></span>
					<span class="logo-loading-spinner-ring logo-loading-spinner-ring--delayed"></span>
				</div>

				<!-- Texto descriptivo enviado desde el store (auth/message) -->
				<p
					v-if="message != ''"
					class="logo-loading-message"
				>{{ message }}</p>
			</div>
		</div>
	</transition>
</template>

<script>
/**
 * Overlay global de carga: lee auth.loading y auth.message del store.
 * Misma animación de doble anillo que empresa-spa.
 */
export default {
	name: 'LogoLoading',
	computed: {
		/**
		 * Indica si debe mostrarse el overlay (estado global de carga).
		 * @returns {boolean}
		 */
		loading() {
			return this.$store.state.auth.loading
		},
		/**
		 * Mensaje descriptivo de la operación en curso.
		 * @returns {string}
		 */
		message() {
			return this.$store.state.auth.message
		},
	},
}
</script>

<style scoped lang="scss">
$logo_loading_blue: #007bff;
$logo_loading_duration: 0.35s;
$logo_loading_spinner_size: 52px;

.logo-loading-fade-enter-active,
.logo-loading-fade-leave-active {
	transition: opacity $logo_loading_duration ease;
}

.logo-loading-fade-enter,
.logo-loading-fade-leave-to {
	opacity: 0;
}

.logo-loading-overlay {
	position: fixed;
	inset: 0;
	z-index: 10000;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 1.5rem;
	background: rgba(255, 255, 255, 0.72);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
}

.logo-loading-panel {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1.25rem;
	min-width: 220px;
	max-width: min(92vw, 360px);
	padding: 2rem 2.25rem 1.85rem;
	border-radius: 16px;
	background: #fff;
	box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06);
	border: 1px solid rgba(0, 123, 255, 0.08);
}

.logo-loading-spinner {
	position: relative;
	width: $logo_loading_spinner_size;
	height: $logo_loading_spinner_size;
}

.logo-loading-spinner-ring {
	position: absolute;
	inset: 0;
	border-radius: 50%;
	border: 3px solid transparent;
	border-top-color: $logo_loading_blue;
	animation: logo-loading-spin 0.9s cubic-bezier(0.5, 0.15, 0.35, 0.85) infinite;
}

.logo-loading-spinner-ring--delayed {
	inset: 6px;
	border-top-color: rgba($logo_loading_blue, 0.35);
	animation-duration: 1.2s;
	animation-direction: reverse;
}

@keyframes logo-loading-spin {
	to {
		transform: rotate(360deg);
	}
}

.logo-loading-message {
	margin: 0;
	font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	font-size: 0.95rem;
	font-weight: 400;
	line-height: 1.45;
	letter-spacing: 0.01em;
	color: #334155;
	text-align: center;
}
</style>
