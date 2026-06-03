import { createRouter, createWebHistory } from 'vue-router'
import store from '@/store'
import routes_def from './routes'
import { setup_guard } from './guard'

const routes = routes_def.map((r) => {
  /** Definición de ruta normalizada para vue-router (soporta redirect sin component). */
  const route = {
    path: r.path,
    meta: r.meta || {},
  }
  if (r.name) {
    route.name = r.name
  }
  if (r.redirect) {
    route.redirect = r.redirect
  } else {
    route.component = r.component
  }
  return route
})

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

setup_guard(router, store)

export default router
