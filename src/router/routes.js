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
    path: '/leads',
    name: 'leads',
    text: 'Leads',
    model_name: 'lead',
    component: () => import('@/views/Leads.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'person-lines-fill' },
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
    path: '/actualizaciones',
    name: 'updates',
    text: 'Actualizaciones',
    model_name: 'update',
    component: () => import('@/views/Updates.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'arrow-up-circle' },
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
    path: '/cuenta',
    name: 'account',
    text: 'Cuenta',
    component: () => import('@/views/Account.vue'),
    meta: { requiresAuth: true, nav: true, icon: 'person-circle' },
  },
  {
    path: '/login',
    name: 'login',
    text: 'Ingresar',
    component: () => import('@/views/Login.vue'),
    meta: { guest: true, nav: false },
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
