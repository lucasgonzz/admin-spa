/**
 * Mixin con la lógica de negocio del panel de acciones editables (prompt 323).
 *
 * Se separa de Index.vue para que el orquestador de la carpeta quede limpio (solo
 * registra sub-componentes y arma el layout), sin lógica de negocio ni llamadas
 * directas a la API, tal como exige el CLAUDE.md del workspace para componentes
 * con Index.vue orquestador.
 *
 * Expone el estado de cada control, el payload final `final_actions` (contrato
 * del prompt 320) y la carga de disponibilidad de demos (endpoint del prompt 321).
 */
export default {
  props: {
    /** Fila lead_messages con pending_actions a precargar. */
    message: { type: Object, required: true },
    /** Estado actual del lead (slug); se usa para no preseleccionar un "cambio de estado" que ya es el actual. */
    lead_status: { type: String, default: '' },
    /** true mientras se envía el mensaje (bloquea todos los controles del panel). */
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:final_actions'],
  data() {
    return {
      /** Slug del estado sugerido a aplicar al aprobar (null = sin cambio). */
      estado_sugerido: null,
      /** Selección de demo a agendar { demo_id, demo_date, demo_start_time } o null. */
      agendar_demo: null,
      /** true si se debe agendar aunque el horario elegido no figure libre. */
      forzar_slot: false,
      /** true si se debe enviar el Mail 1 (acceso a la demo) al aprobar. */
      enviar_mail_demo: true,
      /** Nombre de contacto a guardar en el lead (vacío = no tocar). */
      guardar_nombre: '',
      /** Email de contacto a guardar en el lead (vacío = no tocar). */
      guardar_email: '',
      /** true si el paquete debe cancelar/reagendar una demo ya existente. */
      cancelar_demo: false,
      /** true si se debe reenviar el Mail 1 a un lead que ya tiene demo agendada (no intenta nueva agenda). */
      reenviar_mail_demo: false,
      /** true si el lead necesita intervención humana antes de seguir. */
      requiere_intervencion_humana: false,
      /** Motivo de la intervención humana (texto libre). */
      motivo_intervencion: '',
      /** Catálogo de demos disponibles: [{ demo_id, label }] (panel_availability_json). */
      demos: [],
      /** Slots libres por demo y fecha: { [demo_id]: { 'Y-m-d': ['HH:MM', ...] } }. */
      slots: {},
    }
  },
  computed: {
    /**
     * Catálogo de estados del pipeline de leads, mismo origen que el badge de la burbuja
     * (meta/properties('lead'), campo status). Evita duplicar un catálogo hardcodeado.
     * @returns {Array<{value: string, text: string}>}
     */
    status_options() {
      var props = this.$store.getters['meta/properties']('lead') || []
      var i = 0
      for (i = 0; i < props.length; i = i + 1) {
        if (props[i] && props[i].key === 'status') {
          return props[i].options || []
        }
      }
      return []
    },
    /**
     * Paquete final a mandar al aprobar (`final_actions`, contrato del prompt 320).
     * Se recalcula ante cualquier cambio de control y se emite al padre.
     * @returns {Object}
     */
    final_actions() {
      return {
        /*
         * FIX (prompt 348): apply_pending_actions() interpreta `estado_sugerido: null` como "el admin
         * no tocó el estado → se conserva el de Claude", NO como "no cambiar el estado". Con el select
         * en "— sin cambio —" el backend aplicaba igual el estado crudo de Claude: la opción vacía era
         * una trampa. Mandando el estado ACTUAL del lead, apply_parsed_response() calcula
         * $estado === $previous_status y no lo mueve (ni genera badge de cambio), sin tocar el backend.
         * Si por lo que sea no tenemos el estado actual, se cae al comportamiento anterior (null).
         */
        estado_sugerido: this.estado_sugerido || this.lead_status || null,
        agendar_demo: this.agendar_demo && this.agendar_demo.demo_id
          ? {
            demo_id: this.agendar_demo.demo_id,
            demo_date: this.agendar_demo.demo_date || '',
            demo_start_time: this.agendar_demo.demo_start_time || '',
          }
          : null,
        forzar_slot: Boolean(this.forzar_slot),
        enviar_mail_demo: Boolean(this.enviar_mail_demo),
        reenviar_mail_demo: Boolean(this.reenviar_mail_demo),
        guardar_nombre: (this.guardar_nombre || '').trim() || null,
        guardar_email: (this.guardar_email || '').trim() || null,
        cancelar_demo: Boolean(this.cancelar_demo),
        requiere_intervencion_humana: Boolean(this.requiere_intervencion_humana),
        motivo_intervencion: (this.motivo_intervencion || '').trim() || null,
      }
    },
  },
  watch: {
    /** Reenvía al padre cada vez que cambia algún control del panel. */
    final_actions: {
      immediate: true,
      handler(value) {
        this.$emit('update:final_actions', value)
      },
    },
    /** Si cambia el mensaje mostrado (nuevo hilo o refresh), recarga precarga y disponibilidad. */
    'message.id': {
      immediate: true,
      handler() {
        this.preload_from_pending_actions()
        this.load_availability()
      },
    },
  },
  methods: {
    /**
     * Precarga los controles con lo que sugirió Claude en pending_actions; deja los campos
     * vacíos cuando Claude no sugirió esa acción (el admin puede completarlos igual).
     * @returns {void}
     */
    preload_from_pending_actions() {
      var pending = this.message && this.message.pending_actions ? this.message.pending_actions : {}
      if (typeof pending === 'string') {
        try {
          pending = JSON.parse(pending)
        } catch (e) {
          pending = {}
        }
      }
      pending = pending || {}

      /*
       * FIX (prompt 348): el select se precarga con `message.suggested_lead_status` — la MISMA
       * fuente que alimenta el badge "Cambio de estado: …" de la burbuja, y que el backend ya
       * calculó contra el estado previo del lead y pasó por la guardia de "no retroceder de tramo"
       * (ver create_pending_agendamiento_message / apply_parsed_response en LeadAiService).
       *
       * NO se compara contra `lead_status`: en el tramo de agenda el lead YA fue movido a
       * `solicita_disponibilidad` en el momento de generar el mensaje (FIX del 6/7/2026, la única
       * transición que se aplica sin esperar la aprobación), así que compararlo anulaba la
       * preselección justo en el caso más frecuente y dejaba el select en "— sin cambio —"
       * contradiciendo al badge. Reaplicar un estado que el lead ya tiene es idempotente en el
       * backend ($estado === $previous_status → no se guarda cambio).
       *
       * Fallback a `pending_actions.estado_sugerido` solo si el mensaje no trae la columna
       * (registros viejos, previos a la migración de suggested_lead_status).
       */
      var suggested_status = (this.message && this.message.suggested_lead_status)
        ? String(this.message.suggested_lead_status)
        : ''
      if (suggested_status === '' && pending.estado_sugerido) {
        suggested_status = String(pending.estado_sugerido)
      }
      this.estado_sugerido = suggested_status !== '' ? suggested_status : null
      this.agendar_demo = pending.agendar_demo
        ? {
          demo_id: pending.agendar_demo.demo_id,
          demo_date: pending.agendar_demo.demo_date || '',
          demo_start_time: pending.agendar_demo.demo_start_time || '',
        }
        : null
      this.forzar_slot = Boolean(pending.forzar_slot)
      /* Default ON cuando Claude iba a mandarlo (o cuando el campo no vino informado). */
      this.enviar_mail_demo = pending.enviar_mail_demo !== undefined
        ? Boolean(pending.enviar_mail_demo)
        : true
      /* Default OFF: solo se prende si Claude explícitamente lo sugirió (Mail 1 para demo existente). */
      this.reenviar_mail_demo = Boolean(pending.reenviar_mail_demo)
      this.guardar_nombre = pending.guardar_nombre || ''
      this.guardar_email = pending.guardar_email || ''
      this.cancelar_demo = Boolean(pending.cancelar_demo)
      this.requiere_intervencion_humana = Boolean(pending.requiere_intervencion_humana)
      this.motivo_intervencion = pending.motivo_intervencion || ''
    },
    /**
     * Trae demos y slots libres para poblar el selector de agendamiento (endpoint del prompt 321).
     * @returns {void}
     */
    load_availability() {
      var self = this
      var lead_id = this.message && this.message.lead_id
      if (!lead_id) {
        return
      }
      this.$store.dispatch('lead/fetch_panel_availability', lead_id)
        .then(function (result) {
          self.demos = result.demos || []
          self.slots = result.slots || {}
        })
        .catch(function () {
          /* Sin disponibilidad: el control de demo queda deshabilitado con aviso. */
          self.demos = []
          self.slots = {}
        })
    },
  },
}
