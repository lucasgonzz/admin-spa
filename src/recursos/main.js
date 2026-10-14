/**
 * Entrada de la página pública del centro de recursos (`recursos.html`, segunda entrada de Vite
 * de admin-spa; misión centro-de-recursos-clientes, 13/10/2026).
 *
 * 🔴 A propósito NO importa nada del admin: ni el router, ni el store, ni Bootstrap, ni
 * `src/sass/_app.sass` (que pone `overflow: hidden` en html/body/#app), ni el registro del
 * service worker (`virtual:pwa-register`). La página vive en otro dominio y la usan clientes:
 * lleva sus propios estilos —los del prototipo aprobado— y no se instala como la app del admin.
 */
import { createApp } from 'vue'
import App from './App.vue'
import { iniciar_tema } from './tema'
import './estilos.css'

/* El tema ya está puesto en <html> por el script inline de recursos.html; esto lo toma y escucha al
   navegador (misión centro-recursos-soporte-y-tema, 14/10/2026). */
iniciar_tema()
createApp(App).mount('#app')
