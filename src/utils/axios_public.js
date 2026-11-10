/**
 * Cliente HTTP hacia admin-api para endpoints públicos (sin autenticación).
 * Deriva la baseURL a partir de VITE_API_URL eliminando el segmento /admin.
 * Se usa exclusivamente en vistas públicas como el formulario de configuración del cliente.
 */
import axios from 'axios'
import { localize_throttle_error } from '@/utils/axios'

/**
 * Base URL pública: elimina /admin del final de VITE_API_URL.
 * Ejemplo: http://localhost:8003/api/admin → http://localhost:8003/api
 */
const base_url = (import.meta.env.VITE_API_URL || '/api/admin').replace(/\/admin$/, '')

const api_public = axios.create({
  baseURL: base_url,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

/* Las vistas públicas muestran `err.response.data.message` tal cual: sin esto, el 429 del
   limitador salía en inglés en el formulario del cliente. */
api_public.interceptors.response.use(
  (response) => response,
  (error) => {
    localize_throttle_error(error)
    return Promise.reject(error)
  }
)

export default api_public
