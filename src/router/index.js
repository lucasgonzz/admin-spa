import { createRouter, createWebHistory } from 'vue-router'
import store from '@/store'
import routes_def from './routes'
import { setup_guard } from './guard'

/**
 * Normaliza una definición de ruta de routes.js a una ruta de vue-router.
 * Soporta redirect sin component.
 *
 * @param {object} r Definición de ruta.
 * @returns {object}
 */
function normalize_route(r) {
  const route = {
    path: r.path,
    meta: r.meta || {},
  }
  if (r.name) {
    route.name = r.name
  }
  if (r.redirect) {
    route.redirect = r.redirect
  } else if (r.component) {
    route.component = r.component
  }
  return route
}

/**
 * Aplana las rutas: cada ruta padre y sus hijos (con paths absolutos) se registran
 * como rutas de primer nivel en vue-router. El Nav usa la estructura original (con
 * children) para renderizar los submenús.
 */
const routes = []
routes_def.forEach((r) => {
  routes.push(normalize_route(r))

  if (Array.isArray(r.children)) {
    r.children.forEach((child) => {
      routes.push(normalize_route(child))
    })
  }
})

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

setup_guard(router, store)

export default router
