import { createApp } from 'vue'
import App from './App.vue'
import store from './store'
import router from './router'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

import './sass/_app.sass'
import { registerSW } from 'virtual:pwa-register'

const app = createApp(App)
app.use(store)
app.use(router)

/**
 * Configuración global de Echo (Pusher) para consumir eventos de soporte.
 * Solo se conecta si VITE_PUSHER_APP_KEY y VITE_PUSHER_APP_CLUSTER están definidos en .env;
 * de lo contrario `admin_support_echo` queda en null (sin intento de conexión).
 */
// Clave pública y clúster inyectados por Vite; sin ambos no se instancia Echo.
const pusher_app_key = import.meta.env.VITE_PUSHER_APP_KEY
const pusher_app_cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER
if (pusher_app_key && pusher_app_cluster) {
  window.Pusher = Pusher
  window.admin_support_echo = new Echo({
    broadcaster: 'pusher',
    key: pusher_app_key,
    cluster: pusher_app_cluster,
    forceTLS: true,
  })
} else {
  window.admin_support_echo = null
}

store.dispatch('auth/bootstrap')

/**
 * Registra el Service Worker con detección de nueva versión.
 * Cuando vite-plugin-pwa detecta un SW nuevo en estado `waiting`, dispara
 * onNeedRefresh: exponemos la función update_sw globalmente y avisamos a la UI
 * con un evento custom (mismo patrón desacoplado que la instalación PWA).
 */
const update_sw = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Nuevo SW listo en waiting — avisar a la UI sin acoplamiento directo
    window.__pwa_update_sw = update_sw
    window.dispatchEvent(new Event('pwa-update-available'))
  },
  onOfflineReady() {
    // no acción necesaria
  },
})

app.mount('#app')
