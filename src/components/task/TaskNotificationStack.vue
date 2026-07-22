<template>
  <!--
    Pila de avisos in-app de tareas asignadas, fija arriba a la derecha.
    Pedido explícito de Lucas: tiene que ser "molesta" — no desaparece sola, solo se
    cierra con la X o navegando a la tarea. Se monta una sola vez de forma global (App.vue).
  -->
  <div v-if="visible_notifications.length > 0" class="task-notification-stack">
    <transition-group name="task-notification-card" tag="div" class="task-notification-stack__list">
      <div
        v-for="notification in visible_notifications"
        :key="notification.id"
        class="task-notification-card"
        @click="on_card_click(notification)"
      >
        <button
          type="button"
          class="task-notification-card__close"
          aria-label="Cerrar aviso"
          @click.stop="on_close_click(notification)"
        >
          <i class="bi bi-x-lg" aria-hidden="true" />
        </button>
        <div class="task-notification-card__title">
          {{ notification_task(notification).title || 'Tarea asignada' }}
        </div>
        <div v-if="notification_task(notification).content" class="task-notification-card__content">
          {{ notification_task(notification).content }}
        </div>
        <div class="task-notification-card__meta">
          {{ notification_creator_name(notification) }} · {{ time_ago(notification.created_at) }}
        </div>
      </div>
    </transition-group>

    <!-- Solo con más de 4 pendientes a la vez: resumen + cerrar todas -->
    <div v-if="hidden_count > 0" class="task-notification-stack__footer">
      <span class="task-notification-stack__more">+{{ hidden_count }} más</span>
      <button
        type="button"
        class="task-notification-stack__close-all"
        @click="on_close_all_click"
      >
        Cerrar todas
      </button>
    </div>
  </div>
</template>

<script>
import routes from '@/router/routes'
import { time_ago } from '@/utils/relative_time'
import { play_notification_sound } from '@/utils/notification_sound'

/** Cantidad máxima de tarjetas visibles al mismo tiempo (el resto queda en "+N más"). */
const MAX_VISIBLE_CARDS = 4
/** Intervalo (ms) para alternar el título de la pestaña mientras haya avisos pendientes. */
const TITLE_FLICKER_INTERVAL_MS = 2000

/**
 * Componente global (montado una sola vez desde App.vue) que muestra la pila de
 * notificaciones in-app de tareas asignadas al admin autenticado.
 *
 * Responsabilidades:
 *  - Cargar los avisos pendientes al iniciar sesión (fetch_pending).
 *  - Suscribirse al canal privado `admin.{id}` para recibir avisos en tiempo real.
 *  - Reproducir un sonido y alternar el título de la pestaña mientras haya pendientes,
 *    para que sea difícil no darse cuenta ("molesta", pedido textual de Lucas).
 *  - Delegar en el store (`task_notification`) marcar como visto uno o todos los avisos.
 */
export default {
  name: 'TaskNotificationStack',

  data() {
    return {
      /** Título original del documento, guardado al montar para poder restaurarlo. */
      original_document_title: '',
      /** Referencia del setInterval que alterna el título; null si no está corriendo. */
      title_flicker_interval_id: null,
      /** Canal privado de Echo actualmente suscripto (o null si no hay ninguno). */
      subscribed_channel: null,
      /** Id del admin al que corresponde `subscribed_channel` (para poder hacer leave al cambiar). */
      subscribed_admin_id: null,
    }
  },

  computed: {
    /**
     * Notificaciones pendientes del admin autenticado (orden: más reciente primero).
     *
     * @returns {Array}
     */
    pending_notifications() {
      return this.$store.state.task_notification.models
    },
    /**
     * Primeras `MAX_VISIBLE_CARDS` notificaciones a mostrar como tarjeta completa.
     *
     * @returns {Array}
     */
    visible_notifications() {
      return this.pending_notifications.slice(0, MAX_VISIBLE_CARDS)
    },
    /**
     * Cantidad de notificaciones pendientes que no entran en la pila visible.
     *
     * @returns {number}
     */
    hidden_count() {
      return Math.max(0, this.pending_notifications.length - MAX_VISIBLE_CARDS)
    },
    /**
     * Id del admin autenticado; null hasta que /me resuelva (o si no hay sesión).
     *
     * @returns {number|string|null}
     */
    current_admin_id() {
      return this.$store.state.auth.admin ? this.$store.state.auth.admin.id : null
    },
    /**
     * Path del módulo de tareas, resuelto desde la definición de rutas (no hardcodeado).
     *
     * @returns {string}
     */
    tasks_route_path() {
      let matched_path = '/tareas'
      routes.forEach(function (r) {
        if (r.name === 'tasks' && r.path) {
          matched_path = r.path
        }
      })
      return matched_path
    },
  },

  watch: {
    /**
     * Al aparecer/desaparecer el admin autenticado (login, logout, cambio de cuenta):
     * cargar pendientes y (re)suscribirse al canal correcto, dejando antes el anterior.
     */
    current_admin_id: {
      immediate: true,
      handler() {
        this.rebuild_socket_subscription()
      },
    },
    /**
     * Prende o apaga el parpadeo del título según haya o no notificaciones pendientes.
     *
     * @param {number} new_length
     */
    'pending_notifications.length': function (new_length) {
      if (new_length > 0) {
        this.start_title_flicker()
      } else {
        this.stop_title_flicker()
      }
    },
  },

  mounted() {
    // Guardar el título original antes de que el parpadeo pueda llegar a modificarlo.
    this.original_document_title = document.title
  },

  beforeUnmount() {
    this.teardown_socket_subscription()
    this.stop_title_flicker()
  },

  methods: {
    /**
     * Extrae el objeto tarea de una notificación con fallback defensivo (nunca debería
     * faltar, pero evita romper el render si llega un payload incompleto).
     *
     * @param {Object} notification
     * @returns {Object}
     */
    notification_task(notification) {
      return (notification && notification.task) || {}
    },
    /**
     * Nombre de quien creó la tarea, con fallback genérico si no vino en el payload.
     *
     * @param {Object} notification
     * @returns {string}
     */
    notification_creator_name(notification) {
      const task = this.notification_task(notification)
      return (task.created_by_admin && task.created_by_admin.name) || 'Alguien'
    },
    /**
     * Wrapper del helper compartido de tiempo relativo (ver relative_time.js).
     *
     * @param {string|null} value
     * @returns {string}
     */
    time_ago(value) {
      return time_ago(value)
    },
    /**
     * Clic en el cuerpo de la tarjeta: marca como vista y navega al módulo de tareas.
     *
     * @param {Object} notification
     * @returns {void}
     */
    on_card_click(notification) {
      this.$store.dispatch('task_notification/mark_seen', notification.id).catch(function () {
        return null
      })
      this.$router.push(this.tasks_route_path)
    },
    /**
     * Clic en la X: marca como vista, sin navegar.
     *
     * @param {Object} notification
     * @returns {void}
     */
    on_close_click(notification) {
      this.$store.dispatch('task_notification/mark_seen', notification.id).catch(function () {
        return null
      })
    },
    /**
     * Botón "Cerrar todas": marca todas las pendientes como vistas de una sola vez.
     *
     * @returns {void}
     */
    on_close_all_click() {
      this.$store.dispatch('task_notification/mark_all_seen').catch(function () {
        return null
      })
    },
    /**
     * Arranca el intervalo que alterna el título de la pestaña entre el original y
     * "(N) Tarea nueva". No hace nada si ya está corriendo.
     *
     * @returns {void}
     */
    start_title_flicker() {
      if (this.title_flicker_interval_id) {
        return
      }
      const self = this
      /** Alterna entre mostrar el contador y el título original en cada tick. */
      let showing_alert_title = false
      this.title_flicker_interval_id = window.setInterval(function () {
        const pending_count = self.pending_notifications.length
        if (pending_count === 0) {
          // Defensivo: si por algún motivo el watch no llegó a frenar el intervalo.
          self.stop_title_flicker()
          return
        }
        showing_alert_title = !showing_alert_title
        document.title = showing_alert_title
          ? '(' + pending_count + ') Tarea nueva'
          : self.original_document_title
      }, TITLE_FLICKER_INTERVAL_MS)
    },
    /**
     * Frena el parpadeo del título y restaura el título original del documento.
     *
     * @returns {void}
     */
    stop_title_flicker() {
      if (this.title_flicker_interval_id) {
        window.clearInterval(this.title_flicker_interval_id)
        this.title_flicker_interval_id = null
      }
      document.title = this.original_document_title
    },
    /**
     * Handler del evento de websocket `.AdminTaskNotificationCreated`: agrega la
     * notificación recién creada al store y reproduce el sonido de aviso.
     *
     * @param {Object} event_data  Payload Echo: { notification: {...} }.
     * @returns {void}
     */
    handle_notification_created(event_data) {
      const notification = event_data && event_data.notification ? event_data.notification : null
      if (!notification || notification.id == null) {
        return
      }
      this.$store.commit('task_notification/add_model', notification)
      play_notification_sound()
    },
    /**
     * Deja el canal privado suscripto (si había alguno) y limpia las referencias.
     *
     * @returns {void}
     */
    teardown_socket_subscription() {
      const echo = window.admin_support_echo
      if (echo && this.subscribed_admin_id != null) {
        // Los canales privados se registran internamente con el prefijo "private-";
        // echo.leave() lo necesita para desuscribir correctamente (mismo patrón que
        // useLeadSocket.js / CloserPanel.vue).
        echo.leave('private-admin.' + this.subscribed_admin_id)
      }
      this.subscribed_channel = null
      this.subscribed_admin_id = null
    },
    /**
     * Reconstruye la suscripción al canal privado del admin autenticado: carga los
     * avisos pendientes (cubre el caso "quedaron sin ver mientras no había sesión") y,
     * si hay Echo disponible, se suscribe al canal `admin.{id}` para recibir los nuevos
     * en tiempo real. Tolera `window.admin_support_echo` null (sin credenciales de
     * Pusher configuradas): en ese caso los avisos igual aparecen en la próxima carga.
     *
     * @returns {void}
     */
    rebuild_socket_subscription() {
      this.teardown_socket_subscription()

      const admin_id = this.current_admin_id
      if (admin_id == null || admin_id === '') {
        // Sin sesión: vaciar lo que hubiera quedado de un admin anterior.
        this.$store.commit('task_notification/clear_models')
        return
      }

      this.$store.dispatch('task_notification/fetch_pending').catch(function () {
        return null
      })

      const echo = window.admin_support_echo
      if (!echo) {
        // Sin Pusher configurado: no hay tiempo real, pero fetch_pending ya cubrió
        // lo que había quedado pendiente.
        return
      }

      this.subscribed_admin_id = admin_id
      this.subscribed_channel = echo.private('admin.' + admin_id)
      this.subscribed_channel.listen('.AdminTaskNotificationCreated', this.handle_notification_created)
    },
  },
}
</script>

<style scoped>
.task-notification-stack {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 3050;
  width: min(360px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.task-notification-stack__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.task-notification-card {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  padding: 12px 32px 10px 14px;
  cursor: pointer;
}

.task-notification-card__close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #6c757d;
  border-radius: 50%;
  font-size: 0.85rem;
}

.task-notification-card__close:hover {
  background: #f1f3f5;
  color: #212529;
}

.task-notification-card__title {
  font-weight: 600;
  font-size: 0.92rem;
  color: #212529;
  padding-right: 8px;
}

.task-notification-card__content {
  margin-top: 4px;
  font-size: 0.85rem;
  color: #495057;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-notification-card__meta {
  margin-top: 6px;
  font-size: 0.75rem;
  color: #868e96;
}

.task-notification-stack__footer {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 999px;
  padding: 6px 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.task-notification-stack__more {
  font-size: 0.8rem;
  color: #495057;
  font-weight: 600;
}

.task-notification-stack__close-all {
  border: none;
  background: transparent;
  color: #0d6efd;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0;
}

.task-notification-stack__close-all:hover {
  text-decoration: underline;
}

/* Animación de entrada: deslizamiento corto desde la derecha con fade (sin rebote). */
.task-notification-card-enter-active {
  transition: transform 0.22s ease-out, opacity 0.22s ease-out;
}

.task-notification-card-enter-from {
  transform: translateX(24px);
  opacity: 0;
}

.task-notification-card-leave-active {
  transition: transform 0.16s ease-in, opacity 0.16s ease-in;
  position: absolute;
}

.task-notification-card-leave-to {
  opacity: 0;
}

@media (max-width: 480px) {
  .task-notification-stack {
    left: 16px;
    right: 16px;
    width: auto;
    align-items: stretch;
  }
}
</style>
