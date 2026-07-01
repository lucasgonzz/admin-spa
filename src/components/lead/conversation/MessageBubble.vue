<template>
  <!-- Eventos de cambio de estado: separador visual, no burbuja -->
  <div v-if="is_status_event" class="wa-status-event">
    <div class="wa-status-event-line" />
    <span class="wa-status-event-text">{{ message.content }}</span>
    <div class="wa-status-event-line" />
  </div>

  <!--
    Varios WhatsApp en un mismo registro (separador \n---\n) se muestran como burbujas
    independientes; metadatos y acciones quedan solo en la última burbuja del grupo.
  -->
  <div
    v-else
    class="wa-message-stack"
    :class="[
      'wa-message-stack--' + bubble_side,
      { 'wa-message-stack--split': is_split_message_display }
    ]"
  >
    <div
      v-for="segment in display_bubble_segments"
      :key="segment.key"
      class="wa-bubble-row"
      :class="[
        'wa-bubble-row--' + bubble_side,
        { 'wa-bubble-row--in-stack': is_split_message_display }
      ]"
    >
    <div class="wa-bubble-shell" :class="'wa-bubble-shell--' + bubble_side">
      <div class="wa-bubble" :class="bubble_style_class">
        <!-- Nombre del emisor dentro de la burbuja (solo mensajes de sistema / IA) -->
        <div v-if="segment.is_first && show_sender_name_in_bubble" class="wa-sender-name">
          {{ sender_label }}
        </div>
        <div
          v-if="segment.is_first && is_audio_message && !has_local_attachment"
          class="wa-audio-missing text-muted small mb-1">
          🎤 Audio recibido — transcripción abajo. El archivo aún no está en el servidor.
        </div>
        <!-- Reproductor de audio o enlace al adjunto (documento, imagen, video) -->
        <template v-if="segment.is_first && has_local_attachment">
          <audio-player
            v-if="is_audio_message"
            :src="attachment_open_url(message.attachments[0])"
            :is_outgoing="bubble_side === 'out'"
          />
          <a
            v-else-if="is_image_message"
            :href="attachment_open_url(message.attachments[0])"
            target="_blank"
            rel="noopener noreferrer"
            class="wa-attachment-image-link"
            title="Abrir imagen en nueva pestaña">
            <img
              :src="attachment_open_url(message.attachments[0])"
              class="wa-attachment-image"
              :alt="attachment_display_name(message.attachments[0])" />
          </a>
          <a
            v-else
            :href="attachment_open_url(message.attachments[0])"
            target="_blank"
            rel="noopener noreferrer"
            class="wa-file-attachment"
            :title="'Abrir ' + attachment_display_name(message.attachments[0])">
            <i class="bi wa-file-attachment-icon" :class="attachment_icon_class(message.attachments[0])" aria-hidden="true" />
            <span class="wa-file-attachment-name">{{ attachment_display_name(message.attachments[0]) }}</span>
          </a>
        </template>
        <!-- Modo lectura: una burbuja por cada parte del mensaje (o una sola si no hay separador) -->
        <div
          v-if="!editing && show_message_text && segment.display_text"
          class="message-text"
          :class="{ 'message-text--not-sent': is_not_sent_suggestion }"
        >
          {{ segment.display_text }}
        </div>
        <!-- Modo edición: textarea precargado con el content original de la sugerencia -->
        <textarea
          v-else-if="editing && segment.is_first"
          v-model="edited_text"
          class="form-control form-control-sm wa-edit-textarea"
          :rows="textarea_rows"
          :style="{ width: textarea_width }"
          :disabled="busy"
        />
        <div v-if="segment.is_last && pipeline_status_change_label" class="wa-extra mt-1">
          <span class="badge bg-info text-dark wa-badge-tight" :title="pipeline_status_change_title">
            {{ pipeline_status_change_label }}
          </span>
        </div>
        <div v-if="segment.is_last && message.marca_demo_ingreso_confirmado" class="wa-extra mt-1">
          <span class="badge bg-success wa-badge-tight">✓ Ingreso a demo confirmado</span>
        </div>
        <div v-if="segment.is_last && message.marca_demo_terminada_confirmada" class="wa-extra mt-1">
          <span class="badge bg-success wa-badge-tight">✓ Demo terminada confirmada</span>
        </div>
        <div v-if="segment.is_last && message.requiere_verificacion" class="wa-extra mt-1">
          <span class="badge bg-warning text-dark wa-badge-tight">Requiere verificación con Lucas</span>
        </div>
        <div
          v-if="segment.is_last && admin_notifications_parsed.length > 0"
          class="wa-extra mt-1 d-flex flex-wrap gap-1"
        >
          <span
            v-for="(n, idx) in admin_notifications_parsed"
            :key="idx"
            class="badge bg-secondary wa-badge-tight"
            :title="'Admins notificados: ' + n.admins.join(', ')"
          >
            <i class="bi bi-bell-fill me-1" aria-hidden="true" />{{ n.evento }} → {{ n.admins.join(', ') }}
          </span>
        </div>
        <div v-if="segment.is_last && message.ai_reasoning" class="wa-extra mt-1">
          <button
            type="button"
            class="btn btn-link wa-link-tight p-0"
            :title="show_reasoning ? 'Ocultar razonamiento de Claude' : 'Ver razonamiento de Claude'"
            :aria-label="show_reasoning ? 'Ocultar razonamiento de Claude' : 'Ver razonamiento de Claude'"
            @click="toggle_reasoning"
          >
            <i
              class="bi"
              :class="show_reasoning ? 'bi-chevron-up' : 'bi-lightbulb'"
              aria-hidden="true"
            />
          </button>
          <div v-show="show_reasoning" class="wa-reasoning text-muted border-top mt-1 pt-1">
            {{ message.ai_reasoning }}
          </div>
        </div>
        <!-- Snapshot del calendario Google del closer (debug de disponibilidad) -->
        <div v-if="segment.is_last && calendar_snapshot_parsed" class="wa-extra mt-1">
          <button
            type="button"
            class="btn btn-link wa-link-tight p-0"
            :title="show_calendar_snapshot ? 'Ocultar eventos del calendario' : 'Ver eventos del calendario del closer'"
            :aria-label="show_calendar_snapshot ? 'Ocultar eventos del calendario' : 'Ver eventos del calendario del closer'"
            @click="toggle_calendar_snapshot"
          >
            <i
              class="bi"
              :class="show_calendar_snapshot ? 'bi-chevron-up' : 'bi-calendar3'"
              aria-hidden="true"
            />
          </button>
          <div v-show="show_calendar_snapshot" class="wa-calendar-snapshot text-muted border-top mt-1 pt-1">
            <div class="small">
              <div class="mb-1 text-muted" style="font-size: 0.75rem;">
                Consultado {{ calendar_snapshot_fecha }}
              </div>
              <div
                v-if="!calendar_snapshot_parsed.closers || calendar_snapshot_parsed.closers.length === 0"
                class="text-muted mb-2"
                style="font-size: 0.78rem;"
              >
                Sin closers con calendario consultable
                <span v-if="calendar_snapshot_parsed.nota"> ({{ calendar_snapshot_parsed.nota }})</span>
              </div>
              <div v-for="closer in calendar_snapshot_parsed.closers" :key="closer.admin_id" class="mb-2">
                <div class="fw-semibold" style="font-size: 0.8rem;">
                  {{ closer.nombre }}
                  <span class="badge ms-1" :class="calendar_estado_badge_class(closer.estado)">
                    {{ calendar_estado_label(closer.estado) }}
                  </span>
                </div>
                <div v-if="closer.eventos && closer.eventos.length > 0">
                  <div
                    v-for="(ev, idx) in closer.eventos"
                    :key="idx"
                    style="font-size: 0.78rem;"
                  >
                    {{ ev.fecha }}: {{ ev.inicio }} – {{ ev.fin }}
                    <span v-if="ev.nombre" class="text-muted"> · {{ ev.nombre }}</span>
                  </div>
                </div>
                <div v-else-if="closer.estado === 'sin_calendario'" class="text-warning" style="font-size: 0.78rem;">
                  Sin calendario conectado - esta capa no aplica
                </div>
                <div v-else-if="closer.estado === 'cacheado'" class="text-muted" style="font-size: 0.78rem;">
                  (cacheado - sin detalle de eventos)
                </div>
                <div v-else-if="closer.estado === 'consultado'" class="text-muted" style="font-size: 0.78rem;">
                  Sin eventos en las fechas consultadas
                </div>
              </div>
              <!-- Config del closer al momento de la consulta (debug disponibilidad) -->
              <div v-if="calendar_snapshot_parsed.closer_config" class="mt-2 border-top pt-1">
                <div class="fw-semibold mb-1" style="font-size: 0.78rem;">Config del closer</div>
                <div style="font-size: 0.75rem; font-family: monospace; white-space: pre-wrap;">{{ closer_config_text }}</div>
              </div>
              <!-- Demos ya agendadas al consultar disponibilidad -->
              <div v-if="calendar_snapshot_parsed.demos_agendadas" class="mt-2 border-top pt-1">
                <div class="fw-semibold mb-1" style="font-size: 0.78rem;">
                  Demos agendadas al consultar
                  <span class="badge bg-secondary ms-1">{{ calendar_snapshot_parsed.demos_agendadas.length }}</span>
                </div>
                <div v-if="calendar_snapshot_parsed.demos_agendadas.length === 0" class="text-muted" style="font-size: 0.75rem;">
                  Ninguna
                </div>
                <div
                  v-for="(d, idx) in calendar_snapshot_parsed.demos_agendadas"
                  :key="idx"
                  style="font-size: 0.75rem;"
                >
                  Lead #{{ d.lead_id }} {{ d.contact_name }} — Demo #{{ d.demo_id }} — {{ d.demo_date }} {{ d.demo_start_time }}–{{ d.demo_end_time }}
                </div>
              </div>
              <!-- Slots exactos enviados a Claude en la segunda llamada -->
              <div v-if="calendar_snapshot_parsed.slots_disponibles" class="mt-2 border-top pt-1">
                <div class="fw-semibold mb-1" style="font-size: 0.78rem;">Slots enviados a Claude</div>
                <div
                  v-for="(fechas, demo_id) in calendar_snapshot_parsed.slots_disponibles"
                  :key="demo_id"
                  class="mb-1"
                >
                  <div class="text-muted" style="font-size: 0.72rem;">Demo #{{ demo_id }}</div>
                  <div
                    v-for="(slots, fecha) in fechas"
                    :key="fecha"
                    style="font-size: 0.75rem;"
                  >
                    {{ fecha }}: {{ slots.length > 0 ? slots.join(', ') : '(sin slots)' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="segment.is_last && show_pending_suggestion_actions" class="wa-actions d-flex flex-wrap gap-1 align-items-center">
          <template v-if="!editing">
            <button
              type="button"
              class="btn btn-success btn-sm wa-btn-tight d-inline-flex align-items-center justify-content-center"
              :disabled="busy || !has_sendable_text"
              title="Enviar sugerencia por WhatsApp"
              aria-label="Enviar sugerencia por WhatsApp"
              @click="on_enviar"
            >
              <i class="bi bi-send" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="btn btn-outline-primary btn-sm wa-btn-tight d-inline-flex align-items-center justify-content-center"
              :disabled="busy"
              title="Editar sugerencia antes de enviar"
              aria-label="Editar sugerencia antes de enviar"
              @click="on_start_edit"
            >
              <i class="bi bi-pencil" aria-hidden="true" />
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="btn btn-success btn-sm wa-btn-tight d-inline-flex align-items-center justify-content-center"
              :disabled="busy || !has_edited_text_for_send"
              title="Guardar texto editado y enviar por WhatsApp"
              aria-label="Guardar texto editado y enviar por WhatsApp"
              @click="on_guardar_y_enviar"
            >
              <i class="bi bi-send-check" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm wa-btn-tight d-inline-flex align-items-center justify-content-center"
              :disabled="busy"
              title="Cancelar edición"
              aria-label="Cancelar edición"
              @click="on_cancel_edit"
            >
              <i class="bi bi-x-lg" aria-hidden="true" />
            </button>
          </template>
        </div>
        <div v-if="segment.is_last && show_auto_send_timer_block" class="wa-auto-send-timer mt-1">
          <div class="wa-auto-send-timer-row d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span class="wa-auto-send-timer-label text-muted small">
              <template v-if="show_auto_send_countdown">
                Envío automático en <strong class="wa-auto-send-seconds">{{ auto_send_remaining_seconds }}</strong> s
              </template>
              <template v-else-if="show_auto_send_dispatching">Enviando automáticamente…</template>
            </span>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm wa-btn-tight d-inline-flex align-items-center justify-content-center"
              :disabled="busy"
              title="Cancelar el envío automático por WhatsApp"
              aria-label="Cancelar el envío automático por WhatsApp"
              @click="on_cancelar_envio_automatico"
            >
              <i class="bi bi-stop-circle" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div
          v-else-if="segment.is_last && show_pending_confirmation_label"
          class="wa-pending-confirmation text-muted">
          Esperando confirmación
        </div>
        <div v-if="segment.is_last && is_not_sent_suggestion" class="wa-not-sent-banner text-muted small mt-1">
          <i class="bi bi-x-circle me-1" aria-hidden="true" />
          Sugerencia no enviada al lead
        </div>
        <!-- Banner que indica que el mensaje está excluido del historial enviado a Claude -->
        <div v-if="segment.is_last && message.deleted_from_context" class="wa-excluded-banner text-danger small mt-1">
          <i class="bi bi-trash-fill me-1" aria-hidden="true" />
          Excluido del contexto de IA
        </div>
        <div v-if="segment.is_last && show_whatsapp_delivery_error" class="wa-delivery-error text-danger small mt-1">
          No enviado por WhatsApp
        </div>
        <div v-if="segment.is_last && status_badge_text" class="wa-extra mt-1">
          <span class="badge wa-badge-tight" :class="status_badge_class">{{ status_badge_text }}</span>
        </div>
        <!-- Hora y estado de entrega dentro de la burbuja (estilo WhatsApp) -->
        <div class="wa-bubble-footer">
          <button
            v-if="segment.is_last"
            type="button"
            class="btn btn-link wa-ctx-toggle p-0"
            :class="message.deleted_from_context ? 'wa-ctx-toggle--excluded text-danger' : 'wa-ctx-toggle--included text-muted'"
            :title="message.deleted_from_context
              ? 'Este mensaje está excluido del contexto de Claude. Clic para volver a incluirlo.'
              : 'Excluir este mensaje del contexto de Claude (no lo verá al generar sugerencias)'"
            :disabled="busy"
            @click="on_toggle_deleted_from_context"
          >
            <i
              class="bi"
              :class="message.deleted_from_context ? 'bi-trash-fill' : 'bi-trash'"
              aria-hidden="true"
            />
          </button>
          <span
            v-if="segment.is_last && show_sending_indicator"
            class="wa-meta-sending"
            aria-label="Enviando"
          >Enviando…</span>
          <span v-if="formatted_time_short" class="wa-bubble-time">{{ formatted_time_short }}</span>
          <span
            v-if="whatsapp_check_state"
            class="wa-meta-delivery"
            :title="whatsapp_delivery_title"
          >
            <i
              v-if="whatsapp_check_state === 'enviado'"
              class="bi bi-check2 wa-tick-single"
              aria-hidden="true"
            />
            <i
              v-else-if="whatsapp_check_state === 'entregado'"
              class="bi bi-check2-all wa-tick-double-gray"
              aria-hidden="true"
            />
            <i
              v-else-if="whatsapp_check_state === 'leido'"
              class="bi bi-check2-all wa-tick-double"
              aria-hidden="true"
            />
            <i
              v-else-if="whatsapp_check_state === 'fallido'"
              class="bi bi-exclamation-circle wa-tick-failed"
              aria-hidden="true"
            />
          </span>
        </div>
      </div>
      <!-- Reacción del lead sobre este mensaje (estilo pill de WhatsApp) -->
      <div
        v-if="segment.is_last && has_lead_reaction"
        class="wa-reaction-pill"
        :title="lead_reaction_title"
        aria-label="Reacción del lead"
      >
        {{ message.lead_reaction_emoji }}
      </div>
    </div>
    </div>
  </div>
</template>

<script>
import AudioPlayer from '@/components/lead/conversation/AudioPlayer.vue'

/**
 * Burbuja de mensaje de la conversación WhatsApp (lead, setter, sistema / IA).
 */
export default {
  name: 'LeadMessageBubble',
  components: { AudioPlayer },
  emits: ['enviar', 'guardar_y_enviar', 'cancelar_envio_automatico', 'toggle_deleted_from_context'],
  props: {
    /** Fila `lead_messages` desde la API. */
    message: { type: Object, required: true },
    /** true mientras corre aprobar/rechazar para este ítem. */
    busy: { type: Boolean, default: false },
    /** Timestamp actual (ms) del padre para countdown de auto-envío. */
    now_tick: { type: Number, default: 0 },
    /** Segundos configurados antes del envío automático (fallback si falta ai_auto_send_at en el mensaje). */
    auto_send_delay_seconds: { type: Number, default: 0 },
  },
  data() {
    return {
      /** Controla panel colapsable del razonamiento de Claude. */
      show_reasoning: false,
      /** Controla panel colapsable del snapshot del calendario del closer. */
      show_calendar_snapshot: false,
      /** true cuando el setter está editando una sugerencia antes de enviar. */
      editing: false,
      /** Texto en edición (precargado con content original). */
      edited_text: '',
    }
  },
  computed: {
    /**
     * Lado del hilo estilo WhatsApp: entrante (lead) izquierda; saliente (setter/sistema) derecha.
     *
     * @returns {'in'|'out'}
     */
    bubble_side() {
      if (this.message.sender === 'lead') {
        return 'in'
      }
      return 'out'
    },
    /**
     * Clases de estilo según emisor, lado y variantes (sugerencia, seguimiento, excluido).
     *
     * @returns {string}
     */
    bubble_style_class() {
      var classes = ['wa-bubble--' + this.bubble_side]
      if (this.message.deleted_from_context) {
        classes.push('wa-bubble--excluded')
      }
      if (this.message.sender === 'sistema') {
        if (this.is_followup_suggestion) {
          classes.push('wa-bubble--followup')
        } else if (this.is_not_sent_suggestion) {
          classes.push('wa-bubble--not-sent')
        } else if (this.message.status === 'sugerido') {
          classes.push('wa-bubble--suggestion')
        }
      }
      return classes.join(' ')
    },
    /**
     * true si se muestra el nombre del emisor dentro de la burbuja (mensajes de sistema / IA).
     *
     * @returns {boolean}
     */
    show_sender_name_in_bubble() {
      return this.message.sender === 'sistema'
    },
    /**
     * true si la sugerencia de Claude quedó marcada como no enviada al lead.
     *
     * @returns {boolean}
     */
    is_not_sent_suggestion() {
      if (this.message.sender !== 'sistema') {
        return false
      }
      return this.message.status === 'rechazado'
    },
    /**
     * true si el mensaje fue generado por el chequeo automático de inactividad.
     * @returns {boolean}
     */
    is_followup_suggestion() {
      return Boolean(this.message.is_followup)
    },
    /**
     * true si el mensaje es un evento de cambio de estado del lead (ej: "Lead pasado a En Pausa").
     * Estos mensajes se muestran como separadores visuales, no como burbujas de WhatsApp.
     * @returns {boolean}
     */
    is_status_event() {
      return Boolean(this.message.is_status_event)
    },
    /**
     * Etiqueta legible del emisor.
     * @returns {string}
     */
    sender_label() {
      const s = this.message.sender
      if (s === 'lead') {
        if (this.is_audio_message) {
          return 'Lead · audio'
        }
        return 'Lead'
      }
      if (s === 'setter') {
        return 'Setter'
      }
      if (s === 'sistema') {
        if (this.is_followup_suggestion) {
          return 'Sistema / IA (seguimiento)'
        }
        return 'Sistema / IA'
      }
      return s || '—'
    },
    /**
     * Hora corta para el pie de la burbuja (estilo WhatsApp).
     *
     * @returns {string}
     */
    formatted_time_short() {
      const raw = this.message.created_at
      if (!raw) {
        return ''
      }
      try {
        const d = new Date(raw)
        if (isNaN(d.getTime())) {
          return ''
        }
        return d.toLocaleTimeString('es-AR', {
          hour: 'numeric',
          minute: '2-digit',
        })
      } catch (e) {
        return ''
      }
    },
    /**
     * Fecha/hora completa (reservado para tooltips u otros usos).
     *
     * @returns {string}
     */
    formatted_time() {
      const raw = this.message.created_at
      if (!raw) {
        return ''
      }
      try {
        const d = new Date(raw)
        if (isNaN(d.getTime())) {
          return String(raw)
        }
        return d.toLocaleString('es-AR')
      } catch (e) {
        return String(raw)
      }
    },
    /**
     * Texto a mostrar y copiar: edited_content si existe, sino content.
     * @returns {string}
     */
    effective_content() {
      const edited = ((this.message.edited_content || '') + '').trim()
      if (edited !== '') {
        return edited
      }
      return (this.message.content || '') + ''
    },
    /**
     * Partes del mensaje partidas por el separador "\n---\n" (múltiples mensajes en uno).
     * Si no hay separador, devuelve un array de un solo elemento.
     * @returns {string[]}
     */
    message_parts() {
      const text = (this.effective_content || '') + ''
      return text
        .split(/\n---\n/)
        .map(function (p) { return p.trim() })
        .filter(function (p) { return p !== '' })
    },
    /**
     * true cuando el contenido se muestra como varias burbujas separadas (separador \n---\n).
     *
     * @returns {boolean}
     */
    is_split_message_display() {
      if (this.editing) {
        return false
      }
      if (!this.show_message_text) {
        return false
      }
      return this.message_parts.length > 1
    },
    /**
     * Segmentos de visualización: una entrada por burbuja en pantalla.
     * Metadatos y acciones usan is_first / is_last para ubicarse solo donde corresponde.
     *
     * @returns {Array<{key: string, display_text: string, is_first: boolean, is_last: boolean}>}
     */
    display_bubble_segments() {
      /* Modo edición: una sola burbuja con el textarea del contenido completo. */
      if (this.editing) {
        return [{
          key: 'edit',
          display_text: '',
          is_first: true,
          is_last: true,
        }]
      }

      /* Varios WhatsApp en un registro: una burbuja independiente por parte. */
      if (this.is_split_message_display) {
        var split_segments = []
        var parts = this.message_parts
        for (var i = 0; i < parts.length; i++) {
          split_segments.push({
            key: 'part-' + i,
            display_text: parts[i],
            is_first: i === 0,
            is_last: i === parts.length - 1,
          })
        }
        return split_segments
      }

      /* Mensaje único (sin separador o sin texto visible). */
      var single_text = ''
      if (this.show_message_text) {
        single_text = this.effective_content
      }
      return [{
        key: 'single',
        display_text: single_text,
        is_first: true,
        is_last: true,
      }]
    },
    /**
     * true si el mensaje fue aprobado con texto distinto al sugerido original.
     * @returns {boolean}
     */
    was_sent_with_adjustment() {
      const edited = ((this.message.edited_content || '') + '').trim()
      return edited !== ''
    },
    /**
     * Etiqueta del cambio de estado sugerido por Claude en este mensaje.
     * @returns {string}
     */
    pipeline_status_change_label() {
      const label = (this.message.suggested_lead_status_label || '') + ''
      if (label.trim() === '') {
        return ''
      }
      return 'Cambio de estado: ' + label.trim()
    },
    /**
     * Tooltip con slug del estado sugerido (depuración / soporte).
     * @returns {string}
     */
    pipeline_status_change_title() {
      const slug = (this.message.suggested_lead_status || '') + ''
      if (slug.trim() === '') {
        return ''
      }
      return 'Estado sugerido: ' + slug.trim()
    },
    /**
     * true si el mensaje es saliente (setter o sistema / cloud).
     * @returns {boolean}
     */
    is_outgoing_message() {
      return this.message.sender === 'setter' || this.message.sender === 'sistema'
    },
    /**
     * Leyenda bajo Enviar / Editar mientras la sugerencia de Claude no se envió.
     * @returns {boolean}
     */
    show_pending_confirmation_label() {
      if (this.busy) {
        return false
      }
      return this.message.sender === 'sistema' && this.message.status === 'sugerido'
    },
    /**
     * Mientras el setter confirma el envío (request en curso).
     * @returns {boolean}
     */
    show_sending_indicator() {
      if (!this.busy) {
        return false
      }
      return this.message.sender === 'sistema' && this.message.status === 'sugerido'
    },
    /**
     * Estado visual del check de entrega WhatsApp según whatsapp_delivery_status del backend.
     * null = no mostrar ícono (mensaje entrante, no enviado o sin whatsapp_message_id).
     *
     * @returns {'enviado'|'entregado'|'leido'|'fallido'|null}
     */
    whatsapp_check_state() {
      if (!this.is_outgoing_message) {
        return null
      }
      if (this.message.status !== 'enviado') {
        return null
      }
      if (!this.message.whatsapp_message_id) {
        return null
      }
      const delivery_status = this.message.whatsapp_delivery_status
      if (delivery_status === 'fallido') {
        return 'fallido'
      }
      if (delivery_status === 'leido') {
        return 'leido'
      }
      if (delivery_status === 'entregado') {
        return 'entregado'
      }
      /* null o ausente: mensajes históricos o webhook de entrega aún no llegó. */
      return 'enviado'
    },
    /**
     * Mensaje saliente marcado enviado pero sin id de Meta/Kapso.
     * Los eventos de cambio de estado nunca muestran este banner aunque no tengan whatsapp_message_id.
     * @returns {boolean}
     */
    show_whatsapp_delivery_error() {
      if (this.is_status_event) return false
      if (!this.is_outgoing_message) {
        return false
      }
      if (this.message.status !== 'enviado') {
        return false
      }
      return !this.message.whatsapp_message_id
    },
    /**
     * true si el lead reaccionó a este mensaje con un emoji de WhatsApp.
     * @returns {boolean}
     */
    has_lead_reaction() {
      var emoji = this.message.lead_reaction_emoji
      return typeof emoji === 'string' && emoji.trim() !== ''
    },
    /**
     * Tooltip de la reacción del lead (fecha si está disponible).
     * @returns {string}
     */
    lead_reaction_title() {
      if (!this.has_lead_reaction) {
        return ''
      }
      var at = this.message.lead_reaction_at
      if (at) {
        try {
          var d = new Date(at)
          if (!isNaN(d.getTime())) {
            return 'El lead reaccionó · ' + d.toLocaleString('es-AR')
          }
        } catch (e) {
          /* fallback abajo */
        }
      }
      return 'El lead reaccionó a este mensaje'
    },
    /**
     * Tooltip del check de WhatsApp según whatsapp_check_state.
     * @returns {string}
     */
    whatsapp_delivery_title() {
      const state = this.whatsapp_check_state
      if (!state) {
        return ''
      }
      if (state === 'enviado') {
        return 'Enviado por WhatsApp al lead'
      }
      if (state === 'entregado') {
        var delivered_label = 'Entregado al lead'
        var delivered_at = this.format_delivery_timestamp(this.message.whatsapp_delivered_at)
        if (delivered_at) {
          return delivered_label + ' · ' + delivered_at
        }
        return delivered_label
      }
      if (state === 'leido') {
        var seen_label = 'Visto por el lead'
        var seen_at = this.format_delivery_timestamp(this.message.whatsapp_seen_at)
        if (seen_at) {
          return seen_label + ' · ' + seen_at
        }
        return seen_label
      }
      if (state === 'fallido') {
        return 'No se pudo entregar el mensaje'
      }
      return ''
    },
    /**
     * Badge solo para estados excepcionales (p. ej. rechazado).
     * @returns {string}
     */
    status_badge_text() {
      const st = this.message.status
      if (st === 'rechazado' && this.message.sender === 'sistema') {
        return 'No enviado'
      }
      if (st === 'rechazado') {
        return 'Rechazado'
      }
      return ''
    },
    /**
     * Clase Bootstrap del badge según estado (naranja si hubo ajuste).
     * @returns {string}
     */
    status_badge_class() {
      if (this.is_not_sent_suggestion) {
        return 'bg-secondary text-white'
      }
      if (this.message.status === 'aprobado' && this.was_sent_with_adjustment) {
        return 'bg-warning text-dark'
      }
      return 'bg-secondary'
    },
    /**
     * Acciones Enviar / Editar para sugerencias de Claude aún no enviadas por WhatsApp.
     * @returns {boolean}
     */
    show_pending_suggestion_actions() {
      if (this.message.sender !== 'sistema') {
        return false
      }
      return this.message.status === 'sugerido'
    },
    /**
     * Timestamp ISO del envío automático programado (null si no aplica).
     *
     * @returns {number}
     */
    auto_send_at_ms() {
      const raw = this.message.ai_auto_send_at
      if (!raw) {
        return 0
      }
      const parsed = new Date(raw).getTime()
      if (isNaN(parsed)) {
        return 0
      }
      return parsed
    },
    /**
     * Timestamp efectivo del auto-envío: usa ai_auto_send_at o estima desde created_at + demora configurada.
     *
     * @returns {number}
     */
    effective_auto_send_at_ms() {
      if (this.auto_send_at_ms > 0) {
        return this.auto_send_at_ms
      }
      if (!this.show_pending_suggestion_actions) {
        return 0
      }
      if (this.message.requiere_verificacion) {
        return 0
      }
      const delay_seconds = parseInt(this.auto_send_delay_seconds, 10)
      if (isNaN(delay_seconds) || delay_seconds <= 0) {
        return 0
      }
      const raw_created = this.message.created_at
      if (!raw_created) {
        return 0
      }
      const created_ms = new Date(raw_created).getTime()
      if (isNaN(created_ms)) {
        return 0
      }
      return created_ms + delay_seconds * 1000
    },
    /**
     * true si hay envío automático programado para esta sugerencia (con o sin segundos restantes).
     *
     * @returns {boolean}
     */
    show_auto_send_timer_block() {
      if (!this.show_pending_suggestion_actions) {
        return false
      }
      if (this.message.requiere_verificacion) {
        return false
      }
      return this.effective_auto_send_at_ms > 0
    },
    show_auto_send_countdown() {
      if (!this.show_auto_send_timer_block) {
        return false
      }
      return this.effective_auto_send_at_ms > this.now_tick
    },
    /**
     * true cuando venció el timer y el job de auto-envío debería estar ejecutándose.
     *
     * @returns {boolean}
     */
    show_auto_send_dispatching() {
      if (!this.show_auto_send_timer_block) {
        return false
      }
      return this.effective_auto_send_at_ms <= this.now_tick
    },
    /**
     * Segundos restantes hasta el envío automático por WhatsApp.
     *
     * @returns {number}
     */
    auto_send_remaining_seconds() {
      if (!this.show_auto_send_countdown) {
        return 0
      }
      const remaining_ms = this.effective_auto_send_at_ms - this.now_tick
      if (remaining_ms <= 0) {
        return 0
      }
      return Math.ceil(remaining_ms / 1000)
    },
    /**
     * Ancho del textarea de edición calculado a partir del texto más largo del mensaje.
     * Se clampea entre MIN_WIDTH y el 80% del viewport para no romper la burbuja.
     * @returns {string} Valor CSS en píxeles, p. ej. "320px".
     */
    textarea_width() {
      /* Ancho mínimo útil para editar cómodamente. */
      var MIN_WIDTH = 280
      /* Ancho máximo: 80% del viewport (igual que max-width de .wa-message-stack). */
      var MAX_WIDTH = Math.floor(window.innerWidth * 0.8)
      /* Texto base: si ya se editó usar ese; sino el contenido original. */
      var text = (this.message.content || '') + ''
      /* Línea más larga para estimar el ancho requerido. */
      var lines = text.split('\n')
      var longest_line = ''
      var i = 0
      for (i = 0; i < lines.length; i = i + 1) {
        if (lines[i].length > longest_line.length) {
          longest_line = lines[i]
        }
      }
      /* Factor de fuente: ~8.5px por carácter a 15px + padding horizontal. */
      var estimated = Math.ceil(longest_line.length * 8.5) + 32
      var computed_width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, estimated))
      return computed_width + 'px'
    },
    /**
     * Cantidad de filas del textarea según el número de líneas del mensaje.
     * Clampea entre 3 y 12 para evitar textareas demasiado pequeños o enormes.
     * @returns {number}
     */
    textarea_rows() {
      var text = (this.message.content || '') + ''
      var line_count = text.split('\n').length
      /* Mínimo 3 filas; máximo 12; +1 para que no quede justo al límite. */
      return Math.max(3, Math.min(line_count + 1, 12))
    },
    /**
     * Texto no vacío para enviar sin editar.
     * @returns {boolean}
     */
    has_sendable_text() {
      return ((this.message.content || '') + '').trim() !== ''
    },
    /**
     * Texto no vacío en el textarea de edición.
     * @returns {boolean}
     */
    has_edited_text_for_send() {
      return (this.edited_text || '').trim() !== ''
    },
    /**
     * true si el mensaje tiene adjunto persistido en admin-api.
     * @returns {boolean}
     */
    has_local_attachment() {
      return !!(this.message.attachments && this.message.attachments.length)
    },
    /**
     * Audio de WhatsApp: kind audio/ptt/voice o mime del adjunto.
     * @returns {boolean}
     */
    is_audio_message() {
      const kind = ((this.message.kind || '') + '').toLowerCase()
      if (kind === 'audio' || kind === 'ptt' || kind === 'voice') {
        return true
      }
      const att = this.message.attachments && this.message.attachments[0]
      if (att && att.mime && String(att.mime).indexOf('audio/') === 0) {
        return true
      }
      return false
    },
    /**
     * true si el mensaje es una imagen con adjunto local.
     * @returns {boolean}
     */
    is_image_message() {
      const kind = ((this.message.kind || '') + '').toLowerCase()
      if (kind === 'image') {
        return true
      }
      const att = this.message.attachments && this.message.attachments[0]
      if (att && att.mime && String(att.mime).indexOf('image/') === 0) {
        return true
      }
      return false
    },
    /**
     * true si el contenido es el placeholder legado de Kapso (Document attached… URL: …).
     * @returns {boolean}
     */
    is_kapso_media_placeholder() {
      const text = ((this.effective_content || '') + '').trim()
      if (text === '') {
        return false
      }
      return /\b(document|image|video|audio)\s+attached\b/i.test(text)
    },
    /**
     * true si el contenido es el placeholder genérico del webhook ([DOCUMENT recibido…]).
     * @returns {boolean}
     */
    is_generic_media_placeholder() {
      const text = ((this.effective_content || '') + '').trim()
      if (text === '') {
        return false
      }
      /* Placeholder de audio saliente desde admin (setter). */
      if (text === '[Audio enviado]') {
        return true
      }
      return /^\[[A-Z_ ]+ recibido por WhatsApp\]$/i.test(text)
    },
    /**
     * Muestra el bloque de texto: oculta placeholders de Kapso cuando ya hay adjunto local.
     * @returns {boolean}
     */
    show_message_text() {
      const text = ((this.effective_content || '') + '').trim()
      if (text === '') {
        return false
      }
      if (this.has_local_attachment) {
        if (this.is_kapso_media_placeholder || this.is_generic_media_placeholder) {
          return false
        }
      }
      return true
    },
    /**
     * Snapshot del calendario Google parseado desde JSON (null si no aplica).
     * Truthy también con closers vacíos o estados de diagnóstico (sin_calendario, etc.).
     * @returns {Object|null}
     */
    calendar_snapshot_parsed() {
      if (!this.message.calendar_snapshot) {
        return null
      }
      try {
        var parsed = null
        if (typeof this.message.calendar_snapshot === 'string') {
          parsed = JSON.parse(this.message.calendar_snapshot)
        } else {
          parsed = this.message.calendar_snapshot
        }
        if (!parsed || typeof parsed !== 'object') {
          return null
        }
        /* Mostrar desplegable aunque closers esté vacío o solo tenga nota de diagnóstico. */
        if (!parsed.closers) {
          parsed.closers = []
        }
        return parsed
      } catch (e) {
        return null
      }
    },
    /**
     * Eventos de notificación a admins disparados al procesar este mensaje.
     * @returns {Array<{evento: string, admins: string[]}>}
     */
    admin_notifications_parsed() {
      if (!this.message.admin_notifications) {
        return []
      }
      try {
        var parsed = typeof this.message.admin_notifications === 'string'
          ? JSON.parse(this.message.admin_notifications)
          : this.message.admin_notifications
        if (!Array.isArray(parsed)) {
          return []
        }
        return parsed.filter(function (n) {
          return n && Array.isArray(n.admins) && n.admins.length > 0
        })
      } catch (e) {
        return []
      }
    },
    /**
     * Fecha/hora legible de cuándo se consultó el calendario Google.
     * @returns {string}
     */
    calendar_snapshot_fecha() {
      if (!this.calendar_snapshot_parsed || !this.calendar_snapshot_parsed.consultado_en) {
        return ''
      }
      try {
        return new Date(this.calendar_snapshot_parsed.consultado_en).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch (e) {
        return this.calendar_snapshot_parsed.consultado_en
      }
    },
    /**
     * Texto legible de la config del closer guardada en el snapshot.
     * @returns {string}
     */
    closer_config_text() {
      var cfg = this.calendar_snapshot_parsed ? this.calendar_snapshot_parsed.closer_config : null
      if (!cfg) {
        return ''
      }
      var lines = []
      Object.entries(cfg).forEach(function (entry) {
        lines.push(entry[0] + ': ' + entry[1])
      })
      return lines.join('\n')
    },
  },
  watch: {
    /**
     * Al cambiar el mensaje (refresh desde API), salir del modo edición.
     */
    'message.id'() {
      this.editing = false
      this.edited_text = ''
    },
    'message.status'() {
      this.editing = false
      this.edited_text = ''
    },
  },
  methods: {
    /**
     * Formatea fecha/hora de entrega o lectura WhatsApp para tooltips (mismo criterio que lead_reaction_at).
     *
     * @param {string|null|undefined} raw Timestamp ISO desde la API.
     * @returns {string} Texto legible o cadena vacía si no aplica.
     */
    format_delivery_timestamp(raw) {
      if (!raw) {
        return ''
      }
      try {
        var d = new Date(raw)
        if (isNaN(d.getTime())) {
          return ''
        }
        return d.toLocaleString('es-AR')
      } catch (e) {
        return ''
      }
    },
    /**
     * Alterna visibilidad del bloque de razonamiento.
     * @returns {void}
     */
    toggle_reasoning() {
      this.show_reasoning = !this.show_reasoning
    },
    /**
     * Alterna visibilidad del bloque de snapshot del calendario del closer.
     * @returns {void}
     */
    toggle_calendar_snapshot() {
      this.show_calendar_snapshot = !this.show_calendar_snapshot
    },
    /**
     * Etiqueta legible del estado de consulta Google por closer.
     * @param {string} estado
     * @returns {string}
     */
    calendar_estado_label(estado) {
      const labels = {
        consultado: 'OK',
        sin_calendario: 'sin calendario',
        token_revocado: 'token revocado',
        error_api: 'error API',
        cacheado: 'cacheado',
      }
      return labels[estado] || estado
    },
    /**
     * Clase Bootstrap del badge según estado de consulta Google.
     * @param {string} estado
     * @returns {string}
     */
    calendar_estado_badge_class(estado) {
      const classes = {
        consultado: 'bg-success',
        cacheado: 'bg-secondary',
        sin_calendario: 'bg-warning text-dark',
        token_revocado: 'bg-danger',
        error_api: 'bg-danger',
      }
      return classes[estado] || 'bg-secondary'
    },
    /**
     * Activa modo edición con el content original de la sugerencia.
     * @returns {void}
     */
    on_start_edit() {
      this.editing = true
      this.edited_text = (this.message.content || '') + ''
    },
    /**
     * Sale del modo edición sin aprobar.
     * @returns {void}
     */
    on_cancel_edit() {
      this.editing = false
      this.edited_text = ''
    },
    /**
     * Envía la sugerencia tal como la generó Claude.
     * @returns {void}
     */
    on_enviar() {
      this.$emit('enviar')
    },
    /**
     * Envía el texto editado en el textarea.
     * @returns {void}
     */
    on_guardar_y_enviar() {
      const text = (this.edited_text || '').trim()
      if (!text) {
        return
      }
      this.$emit('guardar_y_enviar', text)
    },
    /**
     * Pide al padre cancelar el envío automático programado de esta sugerencia.
     *
     * @returns {void}
     */
    on_cancelar_envio_automatico() {
      this.$emit('cancelar_envio_automatico')
    },
    /**
     * Solicita al padre alternar si el mensaje se incluye o excluye del contexto de Claude.
     *
     * @returns {void}
     */
    on_toggle_deleted_from_context() {
      this.$emit('toggle_deleted_from_context')
    },
    /**
     * URL para abrir el adjunto: prioriza public_url firmada de la API.
     *
     * @param {Object} attachment Fila lead_message_attachments.
     * @returns {string}
     */
    attachment_open_url(attachment) {
      const signed_url = ((attachment && attachment.public_url) || '') + ''
      if (signed_url.trim() !== '') {
        return signed_url.trim()
      }
      return this.attachment_url(attachment)
    },
    /**
     * Nombre legible del archivo para la UI.
     *
     * @param {Object} attachment Fila lead_message_attachments.
     * @returns {string}
     */
    attachment_display_name(attachment) {
      const from_api = ((attachment && attachment.display_filename) || '') + ''
      if (from_api.trim() !== '') {
        return from_api.trim()
      }
      const path = ((attachment && attachment.path) || '') + ''
      if (path) {
        const parts = path.split('/')
        const basename = parts[parts.length - 1]
        if (basename) {
          return basename
        }
      }
      return 'Adjunto'
    },
    /**
     * Ícono Bootstrap según extensión o mime del adjunto.
     *
     * @param {Object} attachment Fila lead_message_attachments.
     * @returns {string}
     */
    attachment_icon_class(attachment) {
      const filename = this.attachment_display_name(attachment).toLowerCase()
      const mime = (((attachment && attachment.mime) || '') + '').toLowerCase()
      let extension = ''
      const dot_index = filename.lastIndexOf('.')
      if (dot_index >= 0) {
        extension = filename.substring(dot_index + 1)
      }

      if (extension === 'pdf' || mime.indexOf('pdf') >= 0) {
        return 'bi-file-earmark-pdf-fill text-danger'
      }
      if (extension === 'xls' || extension === 'xlsx' || extension === 'csv' || mime.indexOf('spreadsheet') >= 0 || mime.indexOf('excel') >= 0) {
        return 'bi-file-earmark-excel-fill text-success'
      }
      if (extension === 'doc' || extension === 'docx' || mime.indexOf('word') >= 0) {
        return 'bi-file-earmark-word-fill text-primary'
      }
      if (extension === 'ppt' || extension === 'pptx' || mime.indexOf('presentation') >= 0 || mime.indexOf('powerpoint') >= 0) {
        return 'bi-file-earmark-ppt-fill text-warning'
      }
      if (extension === 'zip' || extension === 'rar' || extension === '7z' || mime.indexOf('zip') >= 0) {
        return 'bi-file-earmark-zip-fill text-secondary'
      }
      if (mime.indexOf('video/') === 0 || extension === 'mp4' || extension === 'mov' || extension === 'webm') {
        return 'bi-file-earmark-play-fill text-info'
      }
      return 'bi-file-earmark-fill text-secondary'
    },
    /**
     * URL pública del adjunto en admin-api (/storage/...), fallback si no hay public_url.
     *
     * @param {Object} attachment Fila lead_message_attachments.
     * @returns {string}
     */
    attachment_url(attachment) {
      let base_url = import.meta.env.VITE_BACKEND_BASE_URL || ''
      if (!base_url) {
        const api_url = import.meta.env.VITE_API_URL || ''
        if (api_url) {
          base_url = api_url.replace(/\/api\/admin\/?$/i, '')
        }
      }
      return base_url.replace(/\/$/, '') + '/storage/' + attachment.path
    },
  },
}
</script>

<style scoped>
/* Separador de evento de cambio de estado (ej: "Lead pasado a En Pausa") */
.wa-status-event {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.15rem 0.5rem;
  width: 100%;
  align-self: stretch;
}
.wa-status-event-line {
  flex: 1;
  height: 1px;
  background: rgba(17, 27, 33, 0.15);
}
.wa-status-event-text {
  font-size: 0.72rem;
  color: rgba(17, 27, 33, 0.45);
  white-space: nowrap;
  user-select: none;
  font-style: italic;
}
/* Agrupa varias burbujas del mismo registro lead_messages (separador \n---\n). */
.wa-message-stack {
  display: flex;
  flex-direction: column;
  /* Único límite horizontal respecto al hilo: hasta 80% del área de conversación. */
  max-width: 80%;
  width: fit-content;
}
.wa-message-stack--in {
  align-self: flex-start;
  align-items: flex-start;
}
.wa-message-stack--out {
  align-self: flex-end;
  align-items: flex-end;
}
.wa-message-stack--split {
  gap: 0.25rem;
}
/* Burbujas estilo WhatsApp Web (modo claro). */
.wa-bubble-row {
  display: flex;
  flex-direction: column;
  /* Hereda el tope del stack; no repetir % aquí (evita encogimiento doble). */
  max-width: 100%;
  width: fit-content;
}
.wa-bubble-row--in-stack {
  width: 100%;
}
/* El espaciado vertical entre burbujas lo define gap en .wa-date-section. */
.wa-bubble-row--in {
  align-self: flex-start;
  align-items: flex-start;
}
.wa-bubble-row--out {
  align-self: flex-end;
  align-items: flex-end;
}
.wa-bubble {
  position: relative;
  /* inline-block + max-width evita que el footer flotante encoja la burbuja. */
  display: inline-block;
  vertical-align: top;
  width: auto;
  max-width: 100%;
  font-size: 0.9375rem;
  line-height: 1.35;
  padding: 0.35rem 0.45rem 0.2rem 0.55rem;
  border: none;
  box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13);
  color: #111b21;
}
/* Entrante (lead): blanco con cola superior izquierda. */
.wa-bubble--in {
  background: #ffffff;
  border-radius: 0 7.5px 7.5px 7.5px;
}
.wa-bubble--in::before {
  content: '';
  position: absolute;
  top: 0;
  left: -8px;
  width: 8px;
  height: 13px;
  background: linear-gradient(225deg, #ffffff 50%, transparent 50%);
}
/* Saliente (setter / sistema): verde claro con cola superior derecha. */
.wa-bubble--out {
  background: #d9fdd3;
  border-radius: 7.5px 0 7.5px 7.5px;
}
.wa-bubble--out::before {
  content: '';
  position: absolute;
  top: 0;
  right: -8px;
  width: 8px;
  height: 13px;
  background: linear-gradient(135deg, #d9fdd3 50%, transparent 50%);
}
.wa-bubble--followup {
  background: #fff4ce;
}
.wa-bubble--followup::before {
  background: linear-gradient(135deg, #fff4ce 50%, transparent 50%);
}
.wa-bubble--suggestion {
  box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13), inset 0 0 0 1px rgba(11, 20, 26, 0.06);
}
.wa-sender-name {
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.2;
  color: #e542a3;
  margin-bottom: 0.15rem;
}
.message-text {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  padding-right: 0.15rem;
}
.wa-bubble-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 3px;
  margin-top: 1px;
  margin-left: 1.5rem;
  float: right;
  clear: both;
}
.wa-bubble-time {
  font-size: 0.6875rem;
  line-height: 1.15;
  color: rgba(17, 27, 33, 0.45);
  white-space: nowrap;
  user-select: none;
}
.wa-attachment-image-link {
  display: inline-block;
  margin-bottom: 0.25rem;
  max-width: min(100%, 320px);
}
.wa-attachment-image {
  display: block;
  max-width: 100%;
  max-height: 180px;
  border-radius: 6px;
  object-fit: cover;
}
.wa-file-attachment {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.25rem;
  padding: 0.35rem 0.55rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.55);
  color: inherit;
  text-decoration: none;
  max-width: 100%;
}
.wa-file-attachment:hover {
  background: rgba(255, 255, 255, 0.85);
  color: inherit;
  text-decoration: none;
}
.wa-file-attachment-icon {
  font-size: 1.35rem;
  flex-shrink: 0;
}
.wa-file-attachment-name {
  font-size: 0.85rem;
  line-height: 1.25;
  word-break: break-word;
}
.wa-edit-textarea {
  font-size: 0.9375rem;
  line-height: 1.35;
  resize: vertical;
  min-height: 4.5rem;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  display: block;
}
.wa-extra {
  font-size: 0.875rem;
}
.wa-link-tight {
  font-size: 0.7rem;
}
.wa-reasoning {
  font-size: 0.875rem;
  line-height: 1.3;
  max-height: 120px;
  overflow-y: auto;
}
/* Snapshot de disponibilidad: más altura y saltos de línea legibles entre secciones. */
.wa-calendar-snapshot {
  font-size: 0.875rem;
  line-height: 1.8;
  white-space: pre-wrap;
  max-height: 480px;
  overflow-y: auto;
}
.wa-actions {
  margin-top: 0.35rem;
  clear: both;
}
.wa-btn-tight.btn-sm {
  font-size: 0.9rem;
  padding: 0.1rem 0.42rem;
  line-height: 1.2;
  min-width: 1.85rem;
  min-height: 1.85rem;
}
.wa-badge-tight {
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.15em 0.45em;
}
.wa-pending-confirmation {
  font-size: 0.75rem;
  line-height: 1.2;
  margin-top: 0.25rem;
  font-style: italic;
  clear: both;
}
.wa-auto-send-timer {
  padding-top: 0.2rem;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
  clear: both;
}
.wa-auto-send-timer-label {
  font-style: italic;
  line-height: 1.25;
}
.wa-auto-send-seconds {
  display: inline-block;
  min-width: 1.4rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.wa-bubble--not-sent {
  opacity: 0.78;
  background: #f0f2f5 !important;
}
.wa-bubble--not-sent::before {
  background: linear-gradient(135deg, #f0f2f5 50%, transparent 50%) !important;
}
.message-text--not-sent {
  text-decoration: line-through;
  text-decoration-color: rgba(108, 117, 125, 0.75);
}
.wa-not-sent-banner {
  font-style: italic;
  line-height: 1.25;
  clear: both;
}
.wa-meta-sending {
  font-size: 0.6875rem;
  font-style: italic;
  color: rgba(17, 27, 33, 0.45);
  animation: wa-sending-pulse 1.2s ease-in-out infinite;
}
@keyframes wa-sending-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}
.wa-meta-delivery {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  white-space: nowrap;
}
.wa-tick-single {
  font-size: 0.95rem;
  color: #8696a0;
}
.wa-tick-double-gray {
  font-size: 0.95rem;
  color: #8696a0;
}
.wa-tick-double {
  font-size: 0.95rem;
  color: #53bdeb;
}
.wa-tick-failed {
  font-size: 0.95rem;
  color: #dc3545;
}
.wa-delivery-error {
  font-size: 0.75rem;
  clear: both;
}
/* Burbuja excluida del contexto de Claude. */
.wa-bubble--excluded {
  opacity: 0.62;
  box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13), inset 0 0 0 1px rgba(220, 53, 69, 0.35);
}
.wa-excluded-banner {
  font-style: italic;
  line-height: 1.25;
  clear: both;
}
/* Toggle de exclusión del contexto (admin), discreto en el pie de la burbuja. */
.wa-ctx-toggle {
  font-size: 0.65rem;
  line-height: 1;
  opacity: 0;
  text-decoration: none !important;
  vertical-align: middle;
  transition: opacity 0.15s;
}
.wa-bubble-row:hover .wa-ctx-toggle,
.wa-ctx-toggle--excluded {
  opacity: 0.75;
}
.wa-ctx-toggle:hover,
.wa-ctx-toggle--excluded {
  opacity: 1;
}
/* Contenedor burbuja + pill de reacción. */
.wa-bubble-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  width: fit-content;
  max-width: 100%;
}
.wa-bubble-shell--in {
  align-items: flex-start;
}
.wa-bubble-shell--out {
  align-items: flex-end;
}
.wa-reaction-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.65rem;
  min-height: 1.35rem;
  margin-top: -0.55rem;
  padding: 0.1rem 0.35rem;
  font-size: 0.95rem;
  line-height: 1;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  z-index: 1;
}
.wa-bubble-shell--in .wa-reaction-pill {
  margin-left: 0.45rem;
}
.wa-bubble-shell--out .wa-reaction-pill {
  margin-right: 0.45rem;
}
</style>

