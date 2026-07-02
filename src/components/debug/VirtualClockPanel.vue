<template>
	<div class="virtual-clock-root">
		<!-- FAB botón de reloj (siempre visible mientras el componente existe) -->
		<button type="button" class="virtual-clock-fab" @click="panel_open = !panel_open">
		<i class="bi bi-clock-history" aria-hidden="true" />
		<span v-if="is_active" class="virtual-clock-fab__dot" />
	</button>

	<!-- Panel lateral -->
	<div v-if="panel_open" class="virtual-clock-panel">
		<div class="virtual-clock-panel__header">
			<span>⏱ Reloj Virtual</span>
			<button type="button" class="btn btn-sm btn-link p-0" @click="panel_open = false">✕</button>
		</div>

		<!-- Estado actual -->
		<div class="virtual-clock-panel__status">
			<div v-if="is_active" class="badge bg-danger">ACTIVO</div>
			<div v-else class="badge bg-secondary">INACTIVO</div>
			<div class="small text-muted mt-1">
				<span v-if="is_active">Virtual: {{ virtual_time }}</span>
				<span v-else>Real: {{ real_time }}</span>
			</div>
		</div>

		<!-- Control -->
		<div class="virtual-clock-panel__control">
			<label class="form-label small">Saltar a:</label>
			<input
				type="datetime-local"
				class="form-control form-control-sm"
				v-model="datetime_input"
				step="60"
			/>
			<div class="d-flex gap-2 mt-2">
				<button class="btn btn-sm btn-primary" type="button" :disabled="loading" @click="on_activate_click">
					Activar
				</button>
				<button
					v-if="is_active"
					class="btn btn-sm btn-outline-secondary"
					type="button"
					:disabled="loading"
					@click="deactivate"
				>
					Desactivar
				</button>
			</div>
		</div>

		<!-- Selector de lead -->
		<div class="virtual-clock-panel__lead-selector">
			<label class="form-label small">Lead con demo agendada:</label>
			<select class="form-select form-select-sm" v-model="selected_lead_id">
				<option :value="null">— Seleccionar lead —</option>
				<option v-for="lead in leads" :key="lead.id" :value="lead.id">
					{{ lead.contact_name || lead.company_name || '#' + lead.id }}
					({{ lead.demo_date }} {{ lead.demo_start_time }})
				</option>
			</select>
		</div>

		<!-- Timeline del lead seleccionado -->
		<div v-if="selected_lead && timeline.length" class="virtual-clock-panel__timeline">
			<div class="small fw-semibold mb-2">Hitos de la demo:</div>
			<div
				v-for="hito in timeline"
				:key="hito.key"
				class="virtual-clock-panel__hito"
			>
				<div class="d-flex align-items-center justify-content-between gap-2">
					<div>
						<span class="me-1">{{ hito.icon }}</span>
						<span class="small">{{ hito.label }}</span>
						<div class="text-muted" style="font-size:0.72rem">{{ hito.datetime_str }}</div>
					</div>
					<button
						class="btn btn-sm btn-outline-primary flex-shrink-0"
						type="button"
						:disabled="loading"
						@click="jump_to(hito.datetime_str)"
					>
						→
					</button>
				</div>
			</div>
		</div>
	</div>
	</div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Panel de control del tiempo virtual (debug local): FAB, salto temporal y timeline de hitos de demo.
 */
export default {
	name: 'VirtualClockPanel',
	props: {
		/** Hora virtual activa en el servidor o null si el reloj es real. */
		virtual_time: {
			type: String,
			default: null,
		},
		/** true cuando el backend tiene un override de tiempo virtual. */
		is_active: {
			type: Boolean,
			default: false,
		},
		/** Hora real del servidor (referencia cuando no hay override). */
		real_time: {
			type: String,
			default: '',
		},
	},
	emits: ['updated'],
	data() {
		return {
			/** Visibilidad del panel lateral. */
			panel_open: false,
			/** Valor del input datetime-local para saltar a una fecha/hora. */
			datetime_input: '',
			/** true mientras hay una petición al endpoint de tiempo virtual. */
			loading: false,
			/** Leads en estado demo_agendada cargados desde la API. */
			leads: [],
			/** Id del lead seleccionado en el dropdown de timeline. */
			selected_lead_id: null,
			/** Parámetros de demo usados para calcular hitos del timeline. */
			demo_settings: {
				recordatorio_manana_hora: '09:00',
				recordatorio_minutos_antes: 15,
				duracion_minutos: 60,
			},
		}
	},
	computed: {
		/**
		 * Lead actualmente seleccionado en el dropdown.
		 *
		 * @returns {Object|null}
		 */
		selected_lead() {
			if (!this.selected_lead_id) {
				return null
			}
			var found = null
			this.leads.forEach(function (lead) {
				if (lead.id === this.selected_lead_id) {
					found = lead
				}
			}.bind(this))
			return found
		},
		/**
		 * Hitos calculados para la demo del lead seleccionado.
		 *
		 * @returns {Array<{label: string, datetime_str: string, icon: string, key: string}>}
		 */
		timeline() {
			var lead = this.selected_lead
			if (!lead || !lead.demo_date || !lead.demo_start_time) {
				return []
			}
			var demo_date = String(lead.demo_date).substring(0, 10)
			var demo_start_time = String(lead.demo_start_time).substring(0, 5)
			var settings = this.demo_settings
			var minutos_antes = settings.recordatorio_minutos_antes
			var manana_hora = settings.recordatorio_manana_hora || '09:00'
			var duracion = settings.duracion_minutos

			return [
				{
					label: 'Recordatorio matutino',
					datetime_str: demo_date + ' ' + manana_hora + ':00',
					icon: '🌅',
					key: 'manana',
				},
				{
					label: 'Recordatorio pre-demo (' + minutos_antes + ' min antes)',
					datetime_str: this.add_minutes_to_time(demo_date, demo_start_time, -minutos_antes),
					icon: '⏰',
					key: 'pre_demo',
				},
				{
					label: 'Check de ingreso a la demo',
					datetime_str: demo_date + ' ' + demo_start_time + ':00',
					icon: '▶️',
					key: 'ingreso',
				},
				{
					label: 'Check de fin de demo',
					datetime_str: this.add_minutes_to_time(demo_date, demo_start_time, duracion),
					icon: '✅',
					key: 'fin',
				},
			]
		},
	},
	mounted() {
		this.load_leads()
		this.load_demo_settings()
	},
	methods: {
		/**
		 * Base URL de la API sin el sufijo /admin (endpoints /api/debug/*).
		 *
		 * @returns {string}
		 */
		debug_api_base() {
			var admin_base = import.meta.env.VITE_API_URL || '/api/admin'
			var root = admin_base.replace(/\/admin\/?$/, '')
			return root || '/api'
		},
		/**
		 * Suma o resta minutos a una fecha+hora y devuelve string YYYY-MM-DD HH:mm:ss.
		 *
		 * @param {string} date_str Fecha YYYY-MM-DD.
		 * @param {string} time_str Hora HH:mm.
		 * @param {number} delta_minutes Minutos a sumar (negativo para restar).
		 * @returns {string}
		 */
		add_minutes_to_time(date_str, time_str, delta_minutes) {
			var base = new Date(date_str + 'T' + time_str + ':00')
			var shifted = new Date(base.getTime() + delta_minutes * 60000)
			var y = shifted.getFullYear()
			var m = String(shifted.getMonth() + 1).padStart(2, '0')
			var d = String(shifted.getDate()).padStart(2, '0')
			var h = String(shifted.getHours()).padStart(2, '0')
			var min = String(shifted.getMinutes()).padStart(2, '0')
			var s = String(shifted.getSeconds()).padStart(2, '0')
			return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s
		},
		/**
		 * Carga leads con demo agendada para el selector del timeline.
		 *
		 * @returns {void}
		 */
		load_leads() {
			var self = this
			api
				.get('/lead', {
					params: { status: 'demo_agendada', with_demo: true },
					silent_error: true,
				})
				.then(function (response) {
					var body = response.data || {}
					var pack = body.models
					if (pack && pack.data) {
						self.leads = pack.data
					} else {
						self.leads = pack || []
					}
				})
				.catch(function () {
					/* Sin leads o error de red: ignorar silenciosamente. */
				})
		},
		/**
		 * Carga settings de demo (duración, recordatorios) para calcular hitos.
		 *
		 * @returns {void}
		 */
		load_demo_settings() {
			var self = this
			var defaults = {
				recordatorio_manana_hora: '09:00',
				recordatorio_minutos_antes: 15,
				duracion_minutos: 60,
			}
			api
				.get('/settings/lead-demo', { silent_error: true })
				.then(function (response) {
					var data = response.data || {}
					self.demo_settings = {
						recordatorio_manana_hora: data.recordatorio_manana_hora || defaults.recordatorio_manana_hora,
						recordatorio_minutos_antes:
							data.recordatorio_minutos_antes != null
								? parseInt(data.recordatorio_minutos_antes, 10)
								: defaults.recordatorio_minutos_antes,
						duracion_minutos:
							data.duracion_minutos != null
								? parseInt(data.duracion_minutos, 10)
								: defaults.duracion_minutos,
					}
				})
				.catch(function () {
					self.demo_settings = defaults
				})
		},
		/**
		 * Activa el tiempo virtual en la fecha/hora indicada.
		 *
		 * @param {string} datetime_str
		 * @returns {void}
		 */
		activate(datetime_str) {
			var self = this
			self.loading = true
			api
				.post(
					'/debug/virtual-time',
					{ datetime: datetime_str },
					{ baseURL: self.debug_api_base() }
				)
				.then(function (response) {
					self.$emit('updated', {
						is_active: true,
						virtual_time: response.data.virtual_time,
						real_time: self.real_time,
					})
				})
				.finally(function () {
					self.loading = false
				})
		},
		/**
		 * Desactiva el override de tiempo virtual.
		 *
		 * @returns {void}
		 */
		deactivate() {
			var self = this
			self.loading = true
			api
				.delete('/debug/virtual-time', { baseURL: self.debug_api_base() })
				.then(function () {
					self.$emit('updated', {
						is_active: false,
						virtual_time: null,
						real_time: self.real_time,
					})
				})
				.finally(function () {
					self.loading = false
				})
		},
		/**
		 * Salta al hito indicado activando el tiempo virtual en ese momento.
		 *
		 * @param {string} datetime_str
		 * @returns {void}
		 */
		jump_to(datetime_str) {
			this.activate(datetime_str)
		},
		/**
		 * Valida el input y activa el tiempo virtual.
		 *
		 * @returns {void}
		 */
		on_activate_click() {
			if (!this.datetime_input || String(this.datetime_input).trim() === '') {
				return
			}
			this.activate(this.datetime_input)
		},
	},
}
</script>

<style lang="scss" scoped>
.virtual-clock-fab {
	position: fixed;
	bottom: 20px;
	left: 20px;
	z-index: 1500;
	width: 44px;
	height: 44px;
	border-radius: 50%;
	background: #198754;
	color: #fff;
	border: none;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.1rem;
	cursor: pointer;
	transition: background 0.15s;

	&:hover {
		background: #157347;
	}
}

.virtual-clock-fab__dot {
	position: absolute;
	top: 6px;
	right: 6px;
	width: 9px;
	height: 9px;
	border-radius: 50%;
	background: #dc3545;
	border: 2px solid #198754;
}

.virtual-clock-panel {
	position: fixed;
	bottom: 74px;
	left: 20px;
	z-index: 1500;
	width: 300px;
	max-height: 70vh;
	overflow-y: auto;
	background: #fff;
	border: 1px solid #dee2e6;
	border-radius: 10px;
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
	padding: 12px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.virtual-clock-panel__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-weight: 600;
	font-size: 0.9rem;
}

.virtual-clock-panel__hito {
	padding: 6px 0;
	border-bottom: 1px solid #f0f0f0;

	&:last-child {
		border-bottom: none;
	}
}
</style>
