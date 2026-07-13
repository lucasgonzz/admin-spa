# Prompt 335 — Sincronización OPCIONAL con la empresa-api del cliente (traer conteos / empujar fecha)

## Estado
bloqueado

## Descripción
Capa **opcional** sobre la mensualidad local (prompts 328/329/334): para los clientes que **ya tienen la versión de empresa-api con admin-sync** (prompt 326), permite (a) **traer los datos vivos** del cliente (cantidad de empleados, módulos ecommerce/ML/TN activos) para completar el formulario sin cargarlos a mano, y (b) **empujar la fecha de pago** (y opcionalmente los precios) al sistema del cliente, así Lucas no entra al empresa-api de cada uno.

Es explícitamente **degradable**: si la empresa-api del cliente es vieja (el endpoint admin-sync devuelve 404 / no existe) o el cliente no tiene `api_url`/`api_key`, los botones quedan deshabilitados con un aviso claro ("este cliente todavía no soporta sincronización — cargá los datos a mano"). Nada de esto bloquea la facturación ni el cálculo local.

> Se puede ejecutar **después** de tener andando la facturación. Depende de: 326 (endpoints en empresa-api), 329 (servicio local), 334 (la pestaña donde van los botones).

## Ejecución sugerida

cursor

## Modelo sugerido
`Claude Sonnet`. Llamadas HTTP salientes con degradación elegante + wiring de UI. Multi-repo (admin-api + admin-spa).

## Repositorio y rama
`admin-api` (rama `master`) **y** `admin-spa` (rama `master`). Archivos:
- `@admin-api/app/Services/SyncClientEmployeesFromEmpresaService.php` (referencia del patrón HTTP + manejo de errores)
- `@admin-api/app/Services/ClientEmpresaApiUrlResolver.php` (resolver la URL base del cliente)
- `@admin-api/app/Services/ClientMensualidadSyncService.php` (NUEVO)
- `@admin-api/app/Http/Controllers/ClientMensualidadController.php` (agregar `traer_del_cliente_json` + `actualizar_en_cliente_json`)
- `@admin-api/routes/api.php`
- `@admin-spa/src/components/client/MensualidadTab.vue` (agregar los dos botones + estado de "soportado / no soportado")

> ⚠️ **PHP 7.4 obligatorio** (admin-api).

---

## Cambio 1 — `ClientMensualidadSyncService` (admin-api)
Reusar el patrón de `SyncClientEmployeesFromEmpresaService` (URL vía `ClientEmpresaApiUrlResolver`, `Http::withHeaders(['X-Admin-Api-Key' => $client->api_key, 'Accept' => 'application/json'])->timeout(...)`). Manejo de errores uniforme, y **distinguir explícitamente el caso "no soportado"** (HTTP 404 al endpoint admin-sync, o cliente sin `api_url`/`api_key`) devolviendo `['soportado' => false, 'error' => 'El cliente no soporta sincronización todavía']` en vez de tratarlo como error genérico.

- `traer_del_cliente(Client $client): array` → GET `api/admin-sync/mensualidad-info`. Si `soportado`, mapear los conteos vivos a los campos locales: `cantidad_empleados = conteos.empleados`, `tiene_ecommerce = conteos.ecommerce > 0`, `tiene_mercado_libre = conteos.mercado_libre > 0`, `tiene_tienda_nube = conteos.tienda_nube > 0`; si el cliente trae precios, ofrecerlos también. **No** guarda solo: devuelve los valores para que el front los muestre y Lucas confirme con Guardar (o guardarlos directamente, a criterio — pero conservando la posibilidad de ajustarlos). Devolver también `afip_information` para pre-cargar fiscales si están vacíos.
- `actualizar_en_cliente(Client $client): array` → PUT `api/admin-sync/mensualidad-update` con `payment_expired_at` + precios actuales de `clients`. Si `soportado`, refleja el total recalculado que devuelve el cliente. Si no, `soportado=false`.

## Cambio 2 — Endpoints
En `ClientMensualidadController`:
```php
Route::post('client/{clientId}/mensualidad/traer-del-cliente', [ClientMensualidadController::class, 'traer_del_cliente_json']);
Route::post('client/{clientId}/mensualidad/actualizar-en-cliente', [ClientMensualidadController::class, 'actualizar_en_cliente_json']);
```
Cada uno devuelve `{ soportado: bool, ... }` para que el front sepa si degradar.

## Cambio 3 — UI en `MensualidadTab.vue` (admin-spa)
En el bloque de Mensualidad, agregar dos botones secundarios:
- **"Traer datos del cliente"** → llama `traer-del-cliente`. Si `soportado`, rellena cantidad de empleados + toggles (Lucas revisa y Guarda). Si no, deshabilitado con tooltip "El cliente todavía no soporta sincronización".
- **"Actualizar fecha en el cliente"** → confirma y llama `actualizar-en-cliente`. Si `soportado`, avisa OK. Si no, tooltip explicativo.

Detectar el soporte de forma no intrusiva (p. ej. un intento perezoso al abrir la pestaña, o al primer click) y persistir el estado en el componente. Nunca romper el flujo local si el sync no está disponible.

## Verificación
Con un cliente **actualizado** (326 desplegado en su empresa-api): "Traer datos del cliente" completa los conteos y "Actualizar fecha en el cliente" empuja la fecha. Con un cliente **viejo**: ambos botones quedan deshabilitados con el aviso, y la carga manual + facturación siguen funcionando igual.

Al terminar, pushea admin. (Deploy manual de admin-api + admin-spa.)

