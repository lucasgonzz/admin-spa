/**
 * Rutas y metadatos del menú lateral.
 */
const routes_def = [
  // {
  //   path: '/',
  //   name: 'home',
  //   text: 'Inicio',
  //   component: () => import('@/views/Home.vue'),
  //   meta: { requiresAuth: true, nav: true, icon: 'house' },
  // },
  {
    /** Panel operativo del closer: visible para cualquier admin autenticado. */
    path: '/closer',
    name: 'closer-panel',
    text: 'Closer',
    component: () => import('@/views/CloserPanel.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'speedometer2' },
  },
  {
    path: '/leads',
    name: 'leads',
    text: 'Leads',
    model_name: 'lead',
    component: () => import('@/views/Leads.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'person-lines-fill' },
  },
  {
    /** Módulo Agente: variantes A/B de mensajes y análisis automático. */
    path: '/agente',
    name: 'agente',
    text: 'Agente',
    component: () => import('@/views/Agente.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'robot' },
  },
  {
    path: '/soporte',
    name: 'support',
    text: 'Soporte',
    component: () => import('@/views/Support.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'life-preserver' },
  },
  {
    path: '/tareas',
    name: 'tasks',
    text: 'Tareas',
    component: () => import('@/views/Tasks.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'check2-square' },
  },
  {
    path: '/task-templates',
    redirect: { path: '/cuenta', hash: '#task-templates' },
    meta: { requiresAuth: true, nav: false },
  },
  {
    path: '/versiones',
    name: 'versions',
    text: 'Versiones',
    model_name: 'version',
    component: () => import('@/views/Versions.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'box-seam' },
  },
  {
    path: '/clientes',
    name: 'clients',
    text: 'Clientes',
    model_name: 'client',
    component: () => import('@/views/Clients.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'people' },
  },
  {
    // Ítem padre con submenú: Sistema / Ecommerce. Redirige a Sistema por compatibilidad
    // con el link directo a "/instalaciones" que ya pueda existir.
    path: '/instalaciones',
    name: 'installations',
    text: 'Instalaciones',
    redirect: '/instalaciones/sistema',
    meta: { requiresAuth: true, nav: true, icon: 'cloud-download' },
    children: [
      {
        /** Listado global de instalaciones iniciales del sistema (ex ítem único "Instalaciones"). */
        path: '/instalaciones/sistema',
        name: 'installations_sistema',
        text: 'Sistema',
        component: () => import('@/views/Installations.vue'),
        meta: { requiresAuth: true, nav: false },
      },
      {
        /** Instalaciones desde cero del ecommerce (tienda-spa + tienda-api) de un cliente. */
        path: '/instalaciones/ecommerce',
        name: 'installations_ecommerce',
        text: 'Ecommerce',
        component: () => import('@/views/EcommerceInstallations.vue'),
        meta: { requiresAuth: true, nav: false },
      },
    ],
  },
  {
    /** Gestión de instalaciones de un cliente específico (sin ítem en el menú). */
    path: '/clientes/:clientId/instalaciones',
    name: 'client_installations',
    component: () => import('@/views/ClientInstallations.vue'),
    meta: { requiresAuth: true, nav: false },
  },
  {
    // Ítem padre con submenú: Actualizaciones / Sistema, Ecommerce y Demo (prompt 587;
    // Demo sumado como submódulo por pedido de Lucas, ver contexto_master.md).
    // Redirige a Sistema por compatibilidad con el link directo a "/actualizaciones"
    // que ya existe en version/extra-props/Index.vue.
    path: '/actualizaciones',
    name: 'updates',
    text: 'Actualizaciones',
    redirect: '/actualizaciones/sistema',
    meta: { requiresAuth: true, nav: true, icon: 'arrow-up-circle' },
    children: [
      {
        /** Ex "Empresa": renombrado a "Sistema" para alinear con Implementaciones. */
        path: '/actualizaciones/sistema',
        name: 'updates_sistema',
        text: 'Sistema',
        model_name: 'update',
        component: () => import('@/views/Updates.vue'),
        meta: { requiresAuth: true, nav: false },
      },
      {
        /** Submódulo de gestión de actualizaciones del ecommerce (prompt 587): crear
         * actualización eligiendo cliente, sin selector de versión (siempre master). */
        path: '/actualizaciones/ecommerce',
        name: 'updates_ecommerce',
        text: 'Ecommerce',
        component: () => import('@/views/EcommerceUpdates.vue'),
        meta: { requiresAuth: true, nav: false },
      },
      {
        /** Ex ítem único de nivel superior "Actualizaciones Demo", movido a submódulo. */
        path: '/actualizaciones/demo',
        name: 'updates_demo',
        text: 'Demo',
        model_name: 'demo_update',
        component: () => import('@/views/DemoUpdates.vue'),
        meta: { requiresAuth: true, nav: false },
      },
    ],
  },
  {
    path: '/reglas-seguimiento',
    redirect: { path: '/cuenta', hash: '#followup-rules' },
    meta: { requiresAuth: true, nav: false },
  },
  {
    path: '/protocolo-ventas',
    redirect: { path: '/cuenta', hash: '#protocol-entries' },
    meta: { requiresAuth: true, nav: false },
  },
  {
    path: '/ai-system-prompt',
    redirect: { path: '/cuenta', hash: '#ai-system-prompt' },
    meta: { requiresAuth: true, nav: false },
  },
  {
    // Ítem padre con submenú: Sistema / Ecommerce. Redirige a Sistema por compatibilidad.
    path: '/implementaciones',
    name: 'implementations',
    text: 'Implementaciones',
    redirect: '/implementaciones/sistema',
    meta: { requiresAuth: true, nav: true, icon: 'gear' },
    children: [
      {
        path: '/implementaciones/sistema',
        name: 'implementations_sistema',
        text: 'Sistema',
        component: () => import('@/views/Implementations.vue'),
        meta: { requiresAuth: true, nav: false },
      },
      {
        path: '/implementaciones/ecommerce',
        name: 'implementations_ecommerce',
        text: 'Ecommerce',
        component: () => import('@/views/EcommerceImplementations.vue'),
        meta: { requiresAuth: true, nav: false },
      },
    ],
  },
  {
    // Ítem padre con submenú: Sistema / Ecommerce (Grupo 190, Prompt 02), calcado del
    // patrón de Implementaciones. Redirige a Sistema por compatibilidad con el link
    // directo a "/env-template" que ya pueda existir. Se conserva el ícono actual.
    path: '/env-template',
    name: 'env_template',
    text: 'Plantilla .env',
    redirect: '/env-template/sistema',
    meta: { requiresAuth: true, nav: true, icon: 'file-earmark-code' },
    children: [
      {
        /** Plantilla base .env de empresa-api (ex ítem único "Plantilla .env"). */
        path: '/env-template/sistema',
        name: 'env_template_sistema',
        text: 'Sistema',
        component: () => import('@/views/EnvTemplate/Sistema.vue'),
        meta: { requiresAuth: true, nav: false },
      },
      {
        /** Plantilla base .env de tienda-api (ecommerce). */
        path: '/env-template/ecommerce',
        name: 'env_template_ecommerce',
        text: 'Ecommerce',
        component: () => import('@/views/EnvTemplate/Ecommerce.vue'),
        meta: { requiresAuth: true, nav: false },
      },
    ],
  },
  {
    /** Gestión de usuarios admin del equipo interno (CRUD + Google Calendar para closers). */
    path: '/usuarios-admin',
    name: 'admin_users',
    text: 'Usuarios admin',
    component: () => import('@/views/AdminUsers.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'people-fill' },
  },
  {
    /** Configuración fiscal (AFIP) propia de ComercioCity: fila única para la facturación de mensualidad. */
    path: '/configuracion-fiscal',
    name: 'comerciocity_afip_config',
    text: 'Configuración fiscal',
    component: () => import('@/views/ComerciocityAfipConfig.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'receipt' },
  },
  {
    path: '/cuenta',
    name: 'account',
    text: 'Cuenta',
    component: () => import('@/views/Account.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'person-circle' },
  },
  {
    /** Vista de pantalla completa de la conversación WhatsApp de un lead específico. */
    path: '/leads/:lead_id/conversacion',
    name: 'lead_conversation',
    component: () => import('@/views/LeadConversationView.vue'),
    meta: { requiresAuth: true, nav: false, hide_app_nav: true },
  },
  {
    /** Vista fullscreen de la conversación WhatsApp de una implementación. */
    path: '/implementaciones/:implementation_id/conversacion',
    name: 'implementation_conversation',
    component: () => import('@/views/ImplementationConversationView.vue'),
    meta: { requiresAuth: true, nav: false, hide_app_nav: true },
  },
  {
    path: '/login',
    name: 'login',
    text: 'Ingresar',
    component: () => import('@/views/Login.vue'),
    meta: { guest: true, nav: false },
  },
  {
    /**
     * Formulario de configuración inicial del cliente.
     * Ruta pública: no requiere autenticación ni es ruta de guest.
     * El token identifica al cliente y permite cargar/guardar sus respuestas.
     */
    path: '/configuracion/:token',
    name: 'implementation_form',
    component: () => import('@/views/ImplementationFormView.vue'),
    meta: { public: true, nav: false },
  },
]

export default routes_def

/**
 * Precarga el chunk lazy de una ruta (p. ej. al pasar el mouse por el menú lateral).
 *
 * @param {object|null} route_def Definición de ruta de routes.js
 * @returns {void}
 */
export function prefetch_route_component(route_def) {
  if (!route_def || typeof route_def.component !== 'function') {
    return
  }
  route_def.component()
}
