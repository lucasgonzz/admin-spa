# Admin SPA (Vue 3)

SPA de administración conectada a `admin-api` (Sanctum token).

## Desarrollo

1. En `admin-api`, configurar `ADMIN_SPA_URL` en `.env` (p. ej. `http://localhost:5173`) y `php artisan serve` (o vhost WAMP).
2. Copiar `.env.example` a `.env` y ajustar `VITE_API_URL` (debe apuntar al prefijo `.../api/admin`).
3. `npm install` y `npm run dev`.

## Build / PWA

- `npm run build` genera `dist/` con service worker (Workbox).
- Instalar en móvil: desde el navegador, “Añadir a la pantalla de inicio”.

## Estructura

- `src/common-vue/`: componentes reutilizables (View, tabla, filtros, modales, store factory).
- `src/store/`: módulos por recurso (`version`, `client`, `update`) con `__base_store.js`.
- `src/models`: no se usan archivos locales; el esquema sale del API `GET /api/admin/meta/{model}`.
