<template>
  <div class="p-3">
    <!-- Indicador de carga inicial del snapshot de mensualidad -->
    <div v-if="loading" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando mensualidad...</p>
    </div>

    <!-- Sin cliente guardado todavía: no hay id para consultar el snapshot -->
    <p v-else-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para gestionar su mensualidad.
    </p>

    <!-- Error de carga del snapshot -->
    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <div v-else>
      <!-- ============================================================ -->
      <!-- Bloque 1: Mensualidad (cálculo local, independiente de la    -->
      <!-- facturación). Guarda inputs + fecha + datos fiscales.        -->
      <!-- ============================================================ -->
      <div class="card mb-3">
        <div class="card-header bg-white">
          <strong>Mensualidad</strong>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <!-- Fecha de próximo pago con botones de referencia para atrasar/adelantar 1 mes -->
            <div class="col-md-4">
              <label class="form-label small mb-1 fw-semibold">Fecha de próximo pago</label>
              <div class="input-group">
                <input v-model="form.payment_expired_at" type="date" class="form-control" />
              </div>
              <div class="btn-group btn-group-sm mt-1" role="group">
                <button type="button" class="btn btn-outline-secondary" @click="ajustar_mes(-1)">
                  Atrasar 1 mes
                </button>
                <button type="button" class="btn btn-outline-secondary" @click="ajustar_mes(1)">
                  Adelantar 1 mes
                </button>
              </div>
            </div>

            <!-- Primer mes que se cobra (misión modulo-cobranzas, 18/9/2026). Es lo que le dice
                 al módulo Cobranzas desde qué mes reclamar: antes de este mes cada período es
                 "no aplica" y no pinta la fila de rojo. Viaja al PUT como YYYY-MM-01. -->
            <div class="col-md-4">
              <label class="form-label small mb-1 fw-semibold">Se cobra desde</label>
              <input v-model="form.mensualidad_inicio" type="month" class="form-control" />
              <div class="form-text small">Primer mes de mensualidad. Vacío = no se le reclaman meses.</div>
            </div>

            <!-- Cantidad de empleados: input principal para clientes viejos, se carga a mano -->
            <div class="col-md-4">
              <label class="form-label small mb-1 fw-semibold">Cantidad de empleados</label>
              <input
                v-model.number="form.cantidad_empleados"
                type="number"
                min="0"
                step="1"
                class="form-control"
              />
            </div>

            <!-- Precios vigentes, SOLO LECTURA (misión modulo-cobranzas, 18/9/2026). Antes se
                 editaban acá y no quedaba rastro de cuándo ni cuánto cambiaron; ahora cada cambio
                 es una "actualización de precios" (bloque de más abajo) que aplica los precios y
                 deja el historial. Los valores siguen en `form` porque el PUT los manda tal cual
                 y el backend los sigue aceptando: no se rompe nada para el SPA que ya está en
                 producción. -->
            <div class="col-12">
              <hr class="my-2" />
              <div class="d-flex flex-wrap align-items-baseline gap-2 mb-2">
                <span class="small fw-semibold">Precios vigentes</span>
                <span class="text-muted small">Se cambian registrando una actualización de precios, más abajo.</span>
              </div>
              <div class="row g-2 precios-vigentes">
                <div class="col-6 col-md">
                  <div class="text-muted small">Plan</div>
                  <div class="fw-semibold">${{ format_numero(form.precio_plan) }}</div>
                </div>
                <div class="col-6 col-md">
                  <div class="text-muted small">Por cuenta</div>
                  <div class="fw-semibold">${{ format_numero(form.precio_por_cuenta) }}</div>
                </div>
                <div class="col-4 col-md">
                  <div class="text-muted small">Ecommerce</div>
                  <div class="fw-semibold">
                    ${{ format_numero(precio_ecommerce_efectivo) }}
                    <span v-if="form.precio_ecommerce === null" class="text-muted small fw-normal">(por defecto)</span>
                  </div>
                </div>
                <div class="col-4 col-md">
                  <div class="text-muted small">Mercado Libre</div>
                  <div class="fw-semibold">
                    ${{ format_numero(precio_mercado_libre_efectivo) }}
                    <span v-if="form.precio_mercado_libre === null" class="text-muted small fw-normal">(por defecto)</span>
                  </div>
                </div>
                <div class="col-4 col-md">
                  <div class="text-muted small">Tienda Nube</div>
                  <div class="fw-semibold">
                    ${{ format_numero(precio_tienda_nube_efectivo) }}
                    <span v-if="form.precio_tienda_nube === null" class="text-muted small fw-normal">(por defecto)</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Toggles de módulos: se editan a mano (sin datos vivos, salvo el sync opcional del 335).
                 Los precios individuales de cada módulo ya no se tocan acá: van con la actualización. -->
            <div class="col-12">
              <hr class="my-2" />
              <div class="row g-3">
                <div class="col-md-4">
                  <div class="form-check form-switch">
                    <input
                      id="mensualidad-ecommerce"
                      v-model="form.tiene_ecommerce"
                      class="form-check-input"
                      type="checkbox"
                    />
                    <label class="form-check-label small" for="mensualidad-ecommerce">Ecommerce</label>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-check form-switch">
                    <input
                      id="mensualidad-mercado-libre"
                      v-model="form.tiene_mercado_libre"
                      class="form-check-input"
                      type="checkbox"
                    />
                    <label class="form-check-label small" for="mensualidad-mercado-libre">Mercado Libre</label>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-check form-switch">
                    <input
                      id="mensualidad-tienda-nube"
                      v-model="form.tiene_tienda_nube"
                      class="form-check-input"
                      type="checkbox"
                    />
                    <label class="form-check-label small" for="mensualidad-tienda-nube">Tienda Nube</label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Desglose reactivo: se recalcula en el front con cada cambio, sin esperar al backend -->
            <div class="col-12">
              <table class="table table-sm table-bordered mt-2 mb-0 small">
                <thead>
                  <tr class="table-light">
                    <th>Concepto</th>
                    <th>Precio unitario</th>
                    <th>Cuentas</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Plan (sistema)</td>
                    <td>${{ format_numero(form.precio_plan) }}</td>
                    <td>—</td>
                    <td>${{ format_numero(desglose.plan) }}</td>
                  </tr>
                  <tr>
                    <td>Empleados</td>
                    <td>${{ format_numero(form.precio_por_cuenta) }}</td>
                    <td>{{ form.cantidad_empleados || 0 }}</td>
                    <td>${{ format_numero(desglose.empleados) }}</td>
                  </tr>
                  <tr :class="{ 'text-muted': !form.tiene_ecommerce }">
                    <td>Ecommerce</td>
                    <td>${{ format_numero(precio_ecommerce_efectivo) }}</td>
                    <td>{{ form.tiene_ecommerce ? 1 : 0 }}</td>
                    <td>${{ format_numero(desglose.ecommerce) }}</td>
                  </tr>
                  <tr :class="{ 'text-muted': !form.tiene_mercado_libre }">
                    <td>Mercado Libre</td>
                    <td>${{ format_numero(precio_mercado_libre_efectivo) }}</td>
                    <td>{{ form.tiene_mercado_libre ? 1 : 0 }}</td>
                    <td>${{ format_numero(desglose.mercado_libre) }}</td>
                  </tr>
                  <tr :class="{ 'text-muted': !form.tiene_tienda_nube }">
                    <td>Tienda Nube</td>
                    <td>${{ format_numero(precio_tienda_nube_efectivo) }}</td>
                    <td>{{ form.tiene_tienda_nube ? 1 : 0 }}</td>
                    <td>${{ format_numero(desglose.tienda_nube) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="table-primary fw-bold">
                    <td colspan="3">Total mensualidad (calculado localmente)</td>
                    <td>${{ format_numero(total_local) }}</td>
                  </tr>
                </tfoot>
              </table>
              <p class="text-muted small mb-0 mt-1">
                El total definitivo lo confirma el backend al guardar (puede diferir por redondeo).
              </p>
            </div>
          </div>

          <!-- ============================================================ -->
          <!-- Actualizaciones de precio (misión modulo-cobranzas, 18/9/26). -->
          <!-- Cada cambio de precio se registra como una actualización con  -->
          <!-- fecha; la que lleva el check "oficial" es la que cuenta para  -->
          <!-- saber hace cuánto no se actualiza la mensualidad y cuándo     -->
          <!-- toca la próxima (cada N meses, según el contrato; IPC).       -->
          <!-- ============================================================ -->
          <div class="border-top pt-3 mt-3">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
              <strong class="small">Actualizaciones de precio</strong>
              <span v-if="resumen_actualizacion && resumen_actualizacion.meses" class="text-muted small">
                · cada {{ resumen_actualizacion.meses }} meses según contrato
              </span>
              <button
                type="button"
                class="btn btn-outline-primary btn-sm ms-auto"
                :disabled="registrando_actualizacion"
                @click="alternar_form_actualizacion"
              >
                {{ mostrar_form_actualizacion ? 'Cancelar' : 'Nueva actualización de precios' }}
              </button>
            </div>

            <!-- Línea de estado: cuándo fue la última oficial y cuándo toca la próxima -->
            <p v-if="!resumen_actualizacion" class="text-muted small mb-2">Sin datos de actualización.</p>
            <p v-else-if="resumen_actualizacion.sin_oficial" class="small mb-2 text-danger">
              <i class="bi bi-exclamation-circle me-1"></i>Sin actualización oficial registrada.
            </p>
            <p v-else class="small mb-2 d-flex flex-wrap align-items-center gap-2">
              <span>
                Última actualización oficial: <strong>{{ formatear_fecha_corta(resumen_actualizacion.ultima_oficial_fecha) }}</strong>
                <span class="text-muted"> · {{ texto_hace_meses(resumen_actualizacion.ultima_oficial_fecha) }}</span>
                <span v-if="resumen_actualizacion.proxima_fecha" class="text-muted">
                  · próxima {{ formatear_fecha_corta(resumen_actualizacion.proxima_fecha) }}
                </span>
              </span>
              <span v-if="resumen_actualizacion.vencida" class="badge text-bg-danger">Vencida</span>
              <span
                v-else-if="resumen_actualizacion.dias_restantes !== null && resumen_actualizacion.dias_restantes !== undefined && resumen_actualizacion.dias_restantes <= 30"
                class="badge text-bg-warning"
              >Vence en {{ resumen_actualizacion.dias_restantes }} días</span>
              <span v-else class="badge text-bg-success">Al día</span>
            </p>

            <!-- Formulario colapsable de la nueva actualización. Los cinco precios arrancan con
                 los vigentes: lo normal es tocar uno o dos y dejar el resto. -->
            <div v-if="mostrar_form_actualizacion" class="bg-light rounded p-3 mb-3">
              <div class="row g-2">
                <div class="col-6 col-md-2">
                  <label class="form-label small mb-1">Fecha</label>
                  <input v-model="form_actualizacion.fecha" type="date" class="form-control form-control-sm" />
                </div>
                <div class="col-6 col-md-2">
                  <label class="form-label small mb-1">Plan</label>
                  <input v-model.number="form_actualizacion.precio_plan" type="number" min="0" step="0.01" class="form-control form-control-sm" />
                </div>
                <div class="col-6 col-md-2">
                  <label class="form-label small mb-1">Por cuenta</label>
                  <input v-model.number="form_actualizacion.precio_por_cuenta" type="number" min="0" step="0.01" class="form-control form-control-sm" />
                </div>
                <div class="col-6 col-md-2">
                  <label class="form-label small mb-1">Ecommerce</label>
                  <input v-model.number="form_actualizacion.precio_ecommerce" type="number" min="0" step="0.01" class="form-control form-control-sm" placeholder="Por defecto" />
                </div>
                <div class="col-6 col-md-2">
                  <label class="form-label small mb-1">Mercado Libre</label>
                  <input v-model.number="form_actualizacion.precio_mercado_libre" type="number" min="0" step="0.01" class="form-control form-control-sm" placeholder="Por defecto" />
                </div>
                <div class="col-6 col-md-2">
                  <label class="form-label small mb-1">Tienda Nube</label>
                  <input v-model.number="form_actualizacion.precio_tienda_nube" type="number" min="0" step="0.01" class="form-control form-control-sm" placeholder="Por defecto" />
                </div>
                <div class="col-12 col-md-8">
                  <label class="form-label small mb-1">Observación</label>
                  <input v-model="form_actualizacion.observacion" type="text" class="form-control form-control-sm" placeholder="Opcional: motivo, índice aplicado, acuerdo con el cliente" />
                </div>
                <div class="col-12 col-md-4 d-flex align-items-end">
                  <div class="form-check">
                    <input
                      id="actualizacion-oficial"
                      v-model="form_actualizacion.es_oficial"
                      class="form-check-input"
                      type="checkbox"
                    />
                    <label class="form-check-label small" for="actualizacion-oficial">
                      Es la actualización oficial de la mensualidad
                    </label>
                  </div>
                </div>
              </div>
              <div class="d-flex justify-content-end mt-2">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  :disabled="registrando_actualizacion"
                  @click="registrar_actualizacion"
                >
                  {{ registrando_actualizacion ? 'Registrando...' : 'Registrar actualización' }}
                </button>
              </div>
            </div>

            <!-- Historial, la más reciente primero -->
            <div v-if="cargando_actualizaciones" class="text-muted small">
              <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              Cargando actualizaciones...
            </div>
            <p v-else-if="actualizaciones.length === 0" class="text-muted small mb-0">
              Todavía no hay actualizaciones de precio registradas para este cliente.
            </p>
            <div v-else class="table-responsive">
              <table class="table table-sm table-bordered small mb-0 align-middle">
                <thead>
                  <tr class="table-light">
                    <th>Fecha</th>
                    <th class="text-end">Plan</th>
                    <th class="text-end">Por cuenta</th>
                    <th class="text-end">Ecommerce</th>
                    <th class="text-end">ML</th>
                    <th class="text-end">TN</th>
                    <th>Oficial</th>
                    <th>Observación</th>
                    <th>Admin</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="actualizacion in actualizaciones" :key="actualizacion.id">
                    <td class="text-nowrap">{{ formatear_fecha_corta(actualizacion.fecha) }}</td>
                    <td class="text-end">${{ format_numero(actualizacion.precio_plan) }}</td>
                    <td class="text-end">${{ format_numero(actualizacion.precio_por_cuenta) }}</td>
                    <td class="text-end">{{ precio_opcional(actualizacion.precio_ecommerce) }}</td>
                    <td class="text-end">{{ precio_opcional(actualizacion.precio_mercado_libre) }}</td>
                    <td class="text-end">{{ precio_opcional(actualizacion.precio_tienda_nube) }}</td>
                    <td>
                      <!-- El badge es un botón: alterna el check oficial con un PATCH. -->
                      <button
                        type="button"
                        class="btn btn-sm p-0 border-0 bg-transparent"
                        :disabled="actualizacion_en_curso_id === actualizacion.id"
                        :title="actualizacion.es_oficial ? 'Quitar la marca de oficial' : 'Marcar como la actualización oficial'"
                        @click="alternar_oficial(actualizacion)"
                      >
                        <span class="badge" :class="actualizacion.es_oficial ? 'text-bg-primary' : 'text-bg-light text-muted border'">
                          {{ actualizacion.es_oficial ? 'Oficial' : 'No oficial' }}
                        </span>
                      </button>
                    </td>
                    <td class="small">{{ actualizacion.observacion || '' }}</td>
                    <td class="small text-muted text-nowrap">{{ actualizacion.admin_nombre || '—' }}</td>
                    <td class="text-end text-nowrap">
                      <button
                        type="button"
                        class="btn btn-outline-danger btn-sm py-0"
                        title="Eliminar esta actualización (no revierte los precios)"
                        :disabled="actualizacion_en_curso_id === actualizacion.id"
                        @click="eliminar_actualizacion(actualizacion)"
                      >
                        <i class="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- ============================================================ -->
          <!-- Sincronización OPCIONAL con la empresa-api del cliente        -->
          <!-- (prompt 335). Se degrada sola si el cliente no la soporta:    -->
          <!-- los botones quedan deshabilitados con un aviso, sin romper el -->
          <!-- flujo de carga manual + guardado de arriba.                  -->
          <!-- ============================================================ -->
          <div class="d-flex flex-wrap gap-2 align-items-center mt-3 border-top pt-3">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              :disabled="sync_no_soportado || trayendo_del_cliente"
              :title="sync_no_soportado ? sync_no_soportado_motivo : ''"
              @click="traer_del_cliente"
            >
              {{ trayendo_del_cliente ? 'Trayendo...' : 'Traer datos del cliente' }}
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              :disabled="sync_no_soportado || actualizando_en_cliente"
              :title="sync_no_soportado ? sync_no_soportado_motivo : ''"
              @click="actualizar_en_cliente"
            >
              {{ actualizando_en_cliente ? 'Actualizando...' : 'Actualizar fecha en el cliente' }}
            </button>
            <!-- Aviso cuando ya se detectó que el cliente no soporta sincronización -->
            <span v-if="sync_no_soportado" class="text-muted small fst-italic">
              {{ sync_no_soportado_motivo }}
            </span>
          </div>

          <div class="d-flex justify-content-end mt-3">
            <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="guardar">
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Bloque nuevo: Pagos de la mensualidad (misión modulo-         -->
      <!-- cobranzas, 18/9/2026). Un renglón por mes con el estado que   -->
      <!-- calcula el backend (pagado / facturada / pendiente / parcial  -->
      <!-- / sin cargo), lo esperado, lo pagado y la factura si la hay.  -->
      <!-- Es la misma información que la fila del cliente en el módulo  -->
      <!-- Cobranzas, pero mes a mes y con los pagos desplegables.       -->
      <!-- ============================================================ -->
      <div class="card mb-3">
        <div class="card-header bg-white d-flex flex-wrap align-items-center gap-2">
          <strong>Pagos de la mensualidad</strong>
          <button
            type="button"
            class="btn btn-outline-primary btn-sm ms-auto"
            @click="abrir_registrar_pago(null)"
          >
            <i class="bi bi-cash-coin me-1"></i>Registrar pago
          </button>
        </div>
        <div class="card-body">
          <div v-if="cargando_periodos" class="text-muted small">
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            Cargando meses...
          </div>

          <!-- Sin mes de inicio no hay nada que reclamar: se le dice al operador qué cargar. -->
          <p v-else-if="periodos_visibles.length === 0" class="text-muted small mb-0">
            <span v-if="!form.mensualidad_inicio">
              Este cliente no tiene cargado desde qué mes se cobra. Completá "Se cobra desde" y guardá.
            </span>
            <span v-else>No hay meses para mostrar.</span>
          </p>

          <div v-else class="table-responsive">
            <table class="table table-sm table-bordered small mb-0 align-middle">
              <thead>
                <tr class="table-light">
                  <th>Mes</th>
                  <th>Estado</th>
                  <th class="text-end">Esperado</th>
                  <th class="text-end">Pagado</th>
                  <th>Factura</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="periodo in periodos_visibles" :key="periodo.periodo">
                  <tr :class="clase_fila_periodo(periodo)">
                    <td class="text-nowrap">
                      {{ etiqueta_larga(periodo.periodo) }}
                      <span v-if="periodo.periodo === mes_corriente_actual" class="text-muted">· actual</span>
                    </td>
                    <td>
                      <estado-mensualidad-badge :estado_de="periodo" />
                      <div v-if="periodo.observacion" class="text-muted small">{{ periodo.observacion }}</div>
                    </td>
                    <td class="text-end">{{ periodo.monto_esperado !== null && periodo.monto_esperado !== undefined ? '$' + format_numero(periodo.monto_esperado) : '—' }}</td>
                    <td class="text-end">{{ Number(periodo.monto_pagado || 0) > 0 ? '$' + format_numero(periodo.monto_pagado) : '—' }}</td>
                    <td class="text-nowrap">{{ periodo.factura ? formatear_comprobante(periodo.factura) : '—' }}</td>
                    <td class="text-end text-nowrap">
                      <!-- Acciones por mes. Se ocultan las que no tienen sentido en ese estado
                           en vez de deshabilitarlas: cinco botones grises por fila es ruido. -->
                      <button
                        v-if="periodo.estado !== 'no_aplica'"
                        type="button"
                        class="btn btn-outline-primary btn-sm py-0"
                        title="Registrar un pago de este mes"
                        :disabled="periodo_en_curso === periodo.periodo"
                        @click="abrir_registrar_pago(periodo)"
                      >
                        <i class="bi bi-cash-coin"></i>
                      </button>
                      <button
                        v-if="periodo.estado === 'pendiente' || periodo.estado === 'facturado' || periodo.estado === 'parcial'"
                        type="button"
                        class="btn btn-outline-secondary btn-sm py-0 ms-1"
                        title="Marcar el mes como sin cargo"
                        :disabled="periodo_en_curso === periodo.periodo"
                        @click="marcar_periodo(periodo, 'sin_cargo')"
                      >
                        Sin cargo
                      </button>
                      <button
                        v-if="periodo.estado === 'pagado' || periodo.estado === 'sin_cargo'"
                        type="button"
                        class="btn btn-outline-secondary btn-sm py-0 ms-1"
                        title="Volver a dejar el mes pendiente"
                        :disabled="periodo_en_curso === periodo.periodo"
                        @click="marcar_periodo(periodo, 'pendiente')"
                      >
                        Reabrir
                      </button>
                      <button
                        v-if="periodo.pagos && periodo.pagos.length"
                        type="button"
                        class="btn btn-link btn-sm py-0 ms-1 text-decoration-none"
                        :title="periodo_expandido === periodo.periodo ? 'Ocultar los pagos' : 'Ver los pagos de este mes'"
                        @click="alternar_pagos(periodo)"
                      >
                        {{ periodo.pagos.length }} {{ periodo.pagos.length === 1 ? 'pago' : 'pagos' }}
                        <i class="bi" :class="periodo_expandido === periodo.periodo ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
                      </button>
                    </td>
                  </tr>
                  <!-- Pagos del mes, desplegados debajo de la fila -->
                  <tr v-if="periodo_expandido === periodo.periodo && periodo.pagos && periodo.pagos.length">
                    <td colspan="6" class="bg-light">
                      <div v-for="pago in periodo.pagos" :key="pago.id" class="d-flex flex-wrap align-items-center gap-2 py-1">
                        <span class="text-nowrap">{{ pago.fecha_pago ? formatear_fecha_corta(pago.fecha_pago) : 'Sin fecha' }}</span>
                        <span class="fw-semibold text-nowrap">{{ pago.monto !== null && pago.monto !== undefined ? '$' + format_numero(pago.monto) : 'Sin importe' }}</span>
                        <span v-if="pago.medio" class="text-muted">{{ pago.medio }}</span>
                        <span v-if="pago.observacion" class="text-muted">{{ pago.observacion }}</span>
                        <span v-if="pago.importado" class="badge text-bg-light text-muted border">Importado</span>
                        <button
                          type="button"
                          class="btn btn-outline-danger btn-sm py-0 ms-auto"
                          title="Eliminar este pago"
                          :disabled="periodo_en_curso === periodo.periodo"
                          @click="eliminar_pago(periodo, pago)"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Bloque 2: Facturación. Tiene su propio botón Guardar (más    -->
      <!-- abajo) que dispara la misma acción que el de la tarjeta      -->
      <!-- Mensualidad: los datos fiscales viven en el mismo form y     -->
      <!-- viajan en el mismo PUT (mismo método guardar(), mismo flag   -->
      <!-- saving compartido) — no depende del botón de la otra tarjeta.-->
      <!-- ============================================================ -->
      <div class="card">
        <div class="card-header bg-white">
          <strong>Facturación</strong>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <!-- Datos fiscales del receptor -->
            <!-- CUIT + botón que trae de ARCA el resto de los datos fiscales.
                 El botón solo se habilita con 11 dígitos cargados, para no gastar
                 un request contra ARCA con un CUIT a medio escribir. -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">CUIT del cliente</label>
              <div class="input-group">
                <input v-model="form.afip_cuit" type="text" class="form-control" placeholder="20-12345678-9" />
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :disabled="obteniendo_datos_afip || !cuit_consultable"
                  @click="obtener_datos_afip"
                >
                  {{ obteniendo_datos_afip ? 'Consultando...' : 'Obtener datos' }}
                </button>
              </div>
              <div class="form-text small">
                Trae de ARCA la razón social, el domicilio y la condición IVA. Después hay que apretar Guardar.
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Razón social</label>
              <input v-model="form.afip_razon_social" type="text" class="form-control" />
            </div>
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Condición IVA</label>
              <select v-model="form.afip_condicion_iva" class="form-select">
                <option value="">Sin definir</option>
                <option value="Monotributista">Monotributista</option>
                <option value="Responsable inscripto">Responsable inscripto</option>
                <option value="Consumidor final">Consumidor final</option>
                <option value="Exento">Exento</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Domicilio</label>
              <input v-model="form.afip_domicilio" type="text" class="form-control" />
            </div>
          </div>

          <!-- Guardado propio de la tarjeta Facturación: misma acción que el botón de
               Mensualidad (mismo guardar(), mismo PUT), para que estos datos no dependan
               visualmente del botón de la otra tarjeta. -->
          <div class="d-flex justify-content-end mt-3">
            <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="guardar">
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>

          <hr class="my-3" />

          <!-- Total a facturar: siempre el confirmado por el backend, no el local -->
          <p class="mb-2">
            Total a facturar: <strong>${{ format_numero(record_total_mensualidad) }}</strong>
          </p>

          <!-- Resultado de la última emisión intentada en esta sesión -->
          <div v-if="factura_result" class="mb-3">
            <div v-if="factura_result.ok" class="alert alert-success py-2 small mb-0">
              <span v-if="factura_result.ya_facturado">Este período ya estaba facturado.</span>
              <span v-else>Factura emitida correctamente.</span>
              CAE: <strong>{{ factura_result.cae }}</strong> — Comprobante N°
              <strong>{{ factura_result.cbte_numero }}</strong>
              <div class="mt-2">
                <button
                  type="button"
                  class="btn btn-outline-success btn-sm"
                  :disabled="viendo_pdf_invoice_id === factura_result.invoice_id"
                  @click="ver_pdf(factura_result.invoice_id)"
                >
                  {{ viendo_pdf_invoice_id === factura_result.invoice_id ? 'Abriendo...' : 'Ver PDF' }}
                </button>
              </div>
            </div>
            <div v-else class="alert alert-danger py-2 small mb-0">
              {{ factura_result.error_message || 'No se pudo emitir la factura.' }}
            </div>
          </div>

          <!-- Mes que se factura (misión modulo-cobranzas, 18/9/2026): antes el POST no mandaba
               período y el backend asumía el mes corriente; ahora se elige, para poder facturar
               un mes atrasado sin esperar a que cambie el calendario. -->
          <div class="d-flex flex-wrap align-items-end gap-2">
            <div>
              <label class="form-label small mb-1 fw-semibold">Mes a facturar</label>
              <input v-model="periodo_factura" type="month" class="form-control form-control-sm" />
            </div>
            <button
              type="button"
              class="btn btn-warning btn-sm"
              :disabled="emitiendo_factura || !periodo_factura"
              @click="emitir_factura"
            >
              {{ emitiendo_factura ? 'Emitiendo...' : 'Emitir factura' }}
            </button>
          </div>

          <!-- ============================================================ -->
          <!-- Historial de facturas emitidas (prompt 365). Se carga al      -->
          <!-- montar el componente y se refresca tras cada emisión OK,     -->
          <!-- para no depender de reabrir el modal para verla.             -->
          <!-- ============================================================ -->
          <hr class="my-3" />
          <p class="mb-2"><strong>Facturas emitidas</strong></p>

          <!-- Estado de carga del historial -->
          <div v-if="cargando_facturas" class="text-muted small">
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            Cargando facturas...
          </div>

          <!-- Historial vacío: todavía no se emitió ninguna factura para este cliente -->
          <p v-else-if="facturas.length === 0" class="text-muted small mb-0">
            Todavía no se emitieron facturas para este cliente.
          </p>

          <!-- Tabla de historial: incluye autorizadas y rechazadas. Dentro de .table-responsive
               para que en teléfono scrollee ella y no el modal entero. -->
          <div v-else class="table-responsive">
          <table class="table table-sm table-bordered small mb-0">
            <thead>
              <tr class="table-light">
                <th>Período</th>
                <th>Comprobante</th>
                <th>Fecha</th>
                <th>Importe</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="factura in facturas" :key="factura.id">
                <td>{{ factura.periodo }}</td>
                <!-- Comprobante formateado 0002-00000014, o — si fue rechazada antes de numerarse -->
                <td>{{ formatear_comprobante(factura) }}</td>
                <td>{{ formatear_fecha(factura.created_at) }}</td>
                <td>${{ format_numero(factura.importe_total) }}</td>
                <td>
                  <span v-if="factura.resultado === 'A'" class="badge bg-success">Autorizada</span>
                  <span v-else class="badge bg-danger">Rechazada</span>
                  <!-- Homologación no tiene validez fiscal: distinguirla siempre a la vista -->
                  <span v-if="!factura.afip_produccion" class="badge bg-secondary ms-1">Homologación</span>
                  <div v-if="factura.resultado !== 'A' && factura.error_message" class="text-muted small">
                    {{ factura.error_message }}
                  </div>
                </td>
                <td>
                  <button
                    v-if="factura.resultado === 'A' && factura.cae"
                    type="button"
                    class="btn btn-outline-success btn-sm"
                    :disabled="viendo_pdf_invoice_id === factura.id"
                    @click="ver_pdf(factura.id)"
                  >
                    {{ viendo_pdf_invoice_id === factura.id ? 'Abriendo...' : 'Ver PDF' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de registrar pago, apilado sobre el modal del cliente (stack_level 1). Se monta una
         sola vez y se rearma en cada apertura con el mes y el monto de la fila clickeada. -->
    <registrar-pago-modal
      v-if="record && record.id"
      :show="modal_pago.show"
      :cliente="record"
      :periodo="modal_pago.periodo"
      :monto_esperado="modal_pago.monto_esperado"
      :stack_level="1"
      @update:show="modal_pago.show = $event"
      @saved="on_pago_guardado"
    />
  </div>
</template>

<script>
import api, { admin_api_origin, resolve_error_message } from '@/utils/axios'
import RegistrarPagoModal from '@/components/cobranzas/RegistrarPagoModal.vue'
import EstadoMensualidadBadge from '@/components/cobranzas/EstadoMensualidadBadge.vue'
import { etiqueta_larga, formatear_fecha, hoy_iso, mes_corriente, primer_dia_de, texto_hace_meses } from '@/components/cobranzas/meses'

/**
 * Pestaña "Mensualidad" del detalle del cliente (admin-spa).
 *
 * Tres bloques con acciones propias, sobre un mismo formulario:
 *  1. Mensualidad: formulario con desglose reactivo calculado en el front,
 *     que se guarda vía PUT admin/client/{id}/mensualidad (el total final
 *     lo confirma siempre el backend, en `ClientMensualidadService`). Tiene
 *     su propio botón Guardar. Desde la misión modulo-cobranzas (18/9/2026)
 *     los precios son de solo lectura acá: se cambian registrando una
 *     "actualización de precios" (POST .../mensualidad/actualizaciones), que
 *     aplica los precios al cliente y deja historial con fecha y check de
 *     oficial, para saber hace cuánto no se actualiza la mensualidad.
 *  2. Pagos de la mensualidad (misión modulo-cobranzas): un renglón por mes
 *     con el estado que calcula `CobranzasMensualidadService` y los pagos
 *     registrados; desde acá se registra un pago, se marca un mes sin cargo
 *     o se reabre.
 *  3. Facturación: los datos fiscales (CUIT, razón social, condición IVA,
 *     domicilio) viven en el mismo `form` y viajan en el mismo PUT, así que
 *     tiene su propio botón Guardar que dispara exactamente `guardar()` —
 *     no depende de que el usuario apriete el botón de la otra tarjeta.
 *     Además emite la Factura C vía POST admin/client/{id}/emitir-factura
 *     (AfipFacturacionService) y permite descargar el PDF ya autorizado.
 *
 * Es autónoma: no llama a la empresa-api del cliente (esa sincronización
 * opcional de conteos vivos vive aparte, prompt 335).
 *
 * El `record` puede venir del modal genérico de Clientes (el borrador del
 * ResourceView) o del modal chico del módulo Cobranzas (`{id, name,
 * company_name}`): acá solo se usan esas tres claves.
 */
export default {
  name: 'ClientMensualidadTab',
  components: { RegistrarPagoModal, EstadoMensualidadBadge },
  props: {
    /** Cliente actualmente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // ---- Actualizaciones de precio (misión modulo-cobranzas) ----
      // Resumen `{ultima_oficial_fecha, meses, proxima_fecha, vencida, dias_restantes, sin_oficial}`;
      // llega en el snapshot (`actualizacion`) y en cada respuesta de las rutas de actualizaciones.
      resumen_actualizacion: null,
      // Historial de actualizaciones, la más reciente primero.
      actualizaciones: [],
      // true mientras se carga el historial.
      cargando_actualizaciones: false,
      // true mientras se muestra el formulario colapsable de nueva actualización.
      mostrar_form_actualizacion: false,
      // true mientras corre el POST de la nueva actualización.
      registrando_actualizacion: false,
      // id de la actualización sobre la que corre un PATCH/DELETE (null = ninguna), para
      // deshabilitar solo esa fila.
      actualizacion_en_curso_id: null,
      // Formulario de la nueva actualización; se rearma con los precios vigentes al abrirlo.
      form_actualizacion: {
        fecha: '',
        precio_plan: 0,
        precio_por_cuenta: 0,
        precio_ecommerce: null,
        precio_mercado_libre: null,
        precio_tienda_nube: null,
        es_oficial: true,
        observacion: '',
      },
      // ---- Pagos de la mensualidad (misión modulo-cobranzas) ----
      // Lista de `estado_de` mes a mes (con `pagos`), tal como la devuelve GET .../mensualidad/periodos.
      periodos: [],
      // true mientras se cargan los meses.
      cargando_periodos: false,
      // Período (`YYYY-MM`) cuyos pagos están desplegados (null = ninguno).
      periodo_expandido: null,
      // Período sobre el que corre un PUT/DELETE (null = ninguno), para deshabilitar solo esa fila.
      periodo_en_curso: null,
      // Mes corriente según el backend (cae al del navegador hasta que responda).
      mes_corriente_actual: mes_corriente(),
      // Estado del modal "Registrar pago" apilado sobre este modal.
      modal_pago: { show: false, periodo: '', monto_esperado: null },
      // Mes que se factura con "Emitir factura" (`YYYY-MM`); default el corriente.
      periodo_factura: mes_corriente(),
      // true mientras se carga el snapshot inicial de mensualidad.
      loading: false,
      // Mensaje de error si falla la carga inicial (null = sin error).
      load_error: null,
      // true mientras se guarda el formulario (PUT mensualidad).
      saving: false,
      // true mientras se emite la factura (POST emitir-factura).
      emitiendo_factura: false,
      // true mientras se consulta el padrón de ARCA (botón "Obtener datos").
      obteniendo_datos_afip: false,
      // id de la factura cuyo PDF se está abriendo (null = ninguna); por fila, no global,
      // para no deshabilitar el botón de "Ver PDF" de las demás filas del historial.
      viendo_pdf_invoice_id: null,
      // Total de mensualidad confirmado por el backend (el que se factura realmente).
      record_total_mensualidad: 0,
      // Resultado de la última emisión de factura intentada en esta sesión del modal.
      factura_result: null,
      // Historial completo de facturas emitidas para este cliente (GET client/{id}/facturas, prompt 364).
      facturas: [],
      // true mientras se carga el historial de facturas.
      cargando_facturas: false,
      // true mientras se consultan los conteos vivos del cliente (botón "Traer datos del cliente").
      trayendo_del_cliente: false,
      // true mientras se empuja la fecha/precios al cliente (botón "Actualizar fecha en el cliente").
      actualizando_en_cliente: false,
      /**
       * null mientras no se detectó todavía si el cliente soporta la sincronización
       * (prompt 335); true si ya se comprobó que NO la soporta (versión antigua de
       * empresa-api o sin api_url/api_key). Se detecta de forma perezosa en el
       * primer intento, sin bloquear la carga de la pestaña.
       */
      sync_no_soportado: false,
      // Motivo devuelto por el backend cuando el cliente no soporta sincronización, para el tooltip/aviso.
      sync_no_soportado_motivo: '',
      /**
       * Inputs de mensualidad + datos fiscales del receptor, precargados desde
       * el backend al montar. Se editan a mano (sin datos vivos del cliente).
       */
      form: {
        payment_expired_at: '',
        // Primer mes que se cobra, como `YYYY-MM` (input type=month); viaja al PUT como YYYY-MM-01.
        mensualidad_inicio: '',
        precio_plan: 0,
        precio_por_cuenta: 0,
        cantidad_empleados: 0,
        tiene_ecommerce: false,
        tiene_mercado_libre: false,
        tiene_tienda_nube: false,
        precio_ecommerce: null,
        precio_mercado_libre: null,
        precio_tienda_nube: null,
        afip_cuit: '',
        afip_razon_social: '',
        afip_condicion_iva: '',
        afip_domicilio: '',
      },
    }
  },
  computed: {
    /**
     * Si el CUIT cargado tiene los 11 dígitos que ARCA necesita para responder.
     * Se cuentan solo los dígitos: el campo acepta guiones y puntos.
     * @returns {boolean}
     */
    cuit_consultable() {
      return String(this.form.afip_cuit || '').replace(/\D/g, '').length === 11
    },
    /**
     * Precio efectivo de Ecommerce: el individual si está cargado, sino
     * precio_por_cuenta como fallback (misma regla que empresa-api).
     * @returns {number}
     */
    precio_ecommerce_efectivo() {
      return this.form.precio_ecommerce !== null && this.form.precio_ecommerce !== ''
        ? Number(this.form.precio_ecommerce)
        : Number(this.form.precio_por_cuenta || 0)
    },
    /**
     * Precio efectivo de Mercado Libre: idem Ecommerce.
     * @returns {number}
     */
    precio_mercado_libre_efectivo() {
      return this.form.precio_mercado_libre !== null && this.form.precio_mercado_libre !== ''
        ? Number(this.form.precio_mercado_libre)
        : Number(this.form.precio_por_cuenta || 0)
    },
    /**
     * Precio efectivo de Tienda Nube: idem Ecommerce.
     * @returns {number}
     */
    precio_tienda_nube_efectivo() {
      return this.form.precio_tienda_nube !== null && this.form.precio_tienda_nube !== ''
        ? Number(this.form.precio_tienda_nube)
        : Number(this.form.precio_por_cuenta || 0)
    },
    /**
     * Desglose reactivo local (previsualización), con la misma fórmula que
     * `ClientMensualidadService::calcular_total` de admin-api: plan fijo +
     * empleados por precio_por_cuenta + un cargo por cada módulo activo.
     * @returns {{plan: number, empleados: number, ecommerce: number, mercado_libre: number, tienda_nube: number}}
     */
    desglose() {
      const precio_plan = Number(this.form.precio_plan || 0)
      const precio_por_cuenta = Number(this.form.precio_por_cuenta || 0)
      const cantidad_empleados = Number(this.form.cantidad_empleados || 0)
      return {
        plan: precio_plan,
        empleados: precio_por_cuenta * cantidad_empleados,
        ecommerce: this.form.tiene_ecommerce ? this.precio_ecommerce_efectivo : 0,
        mercado_libre: this.form.tiene_mercado_libre ? this.precio_mercado_libre_efectivo : 0,
        tienda_nube: this.form.tiene_tienda_nube ? this.precio_tienda_nube_efectivo : 0,
      }
    },
    /**
     * Total calculado localmente en vivo (previsualización, no reemplaza al
     * total confirmado por el backend tras guardar).
     * @returns {number}
     */
    total_local() {
      const d = this.desglose
      return d.plan + d.empleados + d.ecommerce + d.mercado_libre + d.tienda_nube
    },
    /**
     * Meses de la tabla de pagos: los que devolvió el backend, sin los futuros (no hay nada que
     * hacer con ellos y solo alejan el mes actual de la vista) ni los `no_aplica` (sin mes de
     * inicio cargado el backend devuelve un año entero de "—", que es ruido: mejor la tabla vacía
     * con el aviso de qué cargar), y del más reciente al más viejo, porque lo que se viene a
     * mirar es el mes en curso, no agosto del año pasado. Un pago por adelantado se registra
     * igual con el botón de arriba, eligiendo el mes en el modal.
     * @returns {Array<Object>}
     */
    periodos_visibles() {
      const self = this
      return this.periodos
        .filter(function (periodo) {
          return periodo &&
            periodo.estado !== 'futuro' &&
            periodo.estado !== 'no_aplica' &&
            periodo.periodo <= self.mes_corriente_actual
        })
        .slice()
        .sort(function (a, b) {
          return a.periodo < b.periodo ? 1 : a.periodo > b.periodo ? -1 : 0
        })
    },
  },
  watch: {
    /** Si cambia el cliente abierto en el modal, recarga el snapshot. */
    'record.id': function (new_id, old_id) {
      if (new_id && new_id !== old_id) {
        this.cargar_mensualidad()
        // Nuevo cliente: recarga también su historial de facturas (si no, se vería el del cliente anterior).
        this.cargar_facturas()
        // Y las dos listas nuevas de la misión modulo-cobranzas, por el mismo motivo.
        this.cargar_actualizaciones()
        this.cargar_periodos()
        this.mostrar_form_actualizacion = false
        this.periodo_expandido = null
        // Nuevo cliente: se vuelve a detectar el soporte de sincronización desde cero.
        this.sync_no_soportado = false
        this.sync_no_soportado_motivo = ''
      }
    },
  },
  mounted() {
    this.cargar_mensualidad()
    this.cargar_facturas()
    this.cargar_actualizaciones()
    this.cargar_periodos()
  },
  methods: {
    etiqueta_larga,
    texto_hace_meses,
    /**
     * Fecha `YYYY-MM-DD` o ISO como dd/mm/yyyy, sin pasar por `new Date` (ver meses.js).
     * @param {string|null} fecha
     * @returns {string}
     */
    formatear_fecha_corta(fecha) {
      return formatear_fecha(fecha)
    },
    /**
     * Precio opcional de un módulo en el historial: "$X" o "—" cuando la actualización lo dejó
     * en el fallback de precio por cuenta.
     * @param {number|string|null} valor
     * @returns {string}
     */
    precio_opcional(valor) {
      if (valor === null || valor === undefined || valor === '') {
        return '—'
      }
      return '$' + this.format_numero(valor)
    },
    /**
     * Toast global del admin.
     * @param {string} message
     * @param {string} [variant] variante Bootstrap (success por defecto)
     * @returns {void}
     */
    avisar(message, variant) {
      window.dispatchEvent(new CustomEvent('admin-spa-toast', {
        detail: { message: String(message), variant: variant || 'success' },
      }))
    },
    // ------------------------------------------------------------------
    // Actualizaciones de precio (misión modulo-cobranzas, 18/9/2026)
    // ------------------------------------------------------------------
    /**
     * Carga el historial de actualizaciones y el resumen de la última oficial
     * (GET client/{id}/mensualidad/actualizaciones).
     * @returns {void}
     */
    cargar_actualizaciones() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      const client_id = this.record.id
      self.cargando_actualizaciones = true
      api
        .get('/client/' + client_id + '/mensualidad/actualizaciones', { silent_error: true })
        .then(function (res) {
          self.cargando_actualizaciones = false
          // Se cambió de cliente mientras respondía: no es la lista de este.
          if (!self.record || self.record.id !== client_id) {
            return
          }
          self.aplicar_actualizaciones(res.data || {})
        })
        .catch(function () {
          self.cargando_actualizaciones = false
          self.avisar('No se pudo cargar el historial de actualizaciones de precio.', 'danger')
        })
    },
    /**
     * Vuelca `{actualizaciones, resumen}` de cualquier respuesta de las rutas de actualizaciones.
     * @param {Object} data
     * @returns {void}
     */
    aplicar_actualizaciones(data) {
      if (Array.isArray(data.actualizaciones)) {
        this.actualizaciones = data.actualizaciones
      }
      if (data.resumen) {
        this.resumen_actualizacion = data.resumen
      }
    },
    /**
     * Abre o cierra el formulario de nueva actualización. Al abrirlo se precargan los precios
     * vigentes y la fecha de hoy: lo normal es tocar uno o dos valores y registrar.
     * @returns {void}
     */
    alternar_form_actualizacion() {
      if (this.mostrar_form_actualizacion) {
        this.mostrar_form_actualizacion = false
        return
      }
      this.form_actualizacion = {
        fecha: hoy_iso(),
        precio_plan: Number(this.form.precio_plan || 0),
        precio_por_cuenta: Number(this.form.precio_por_cuenta || 0),
        precio_ecommerce: this.form.precio_ecommerce,
        precio_mercado_libre: this.form.precio_mercado_libre,
        precio_tienda_nube: this.form.precio_tienda_nube,
        es_oficial: true,
        observacion: '',
      }
      this.mostrar_form_actualizacion = true
    },
    /**
     * Registra la actualización (POST client/{id}/mensualidad/actualizaciones). El backend
     * aplica los precios al cliente y devuelve el snapshot nuevo, que se vuelca al form para
     * que los precios vigentes y el desglose cambien en el acto.
     * @returns {void}
     */
    registrar_actualizacion() {
      const self = this
      if (!this.record || !this.record.id || this.registrando_actualizacion) {
        return
      }
      const f = this.form_actualizacion
      /** Normaliza un precio opcional: '' o null → null (fallback a precio por cuenta). */
      const opcional = function (valor) {
        return valor === '' || valor === null || valor === undefined ? null : Number(valor)
      }
      self.registrando_actualizacion = true
      api
        .post('/client/' + this.record.id + '/mensualidad/actualizaciones', {
          fecha: f.fecha || hoy_iso(),
          precio_plan: Number(f.precio_plan || 0),
          precio_por_cuenta: Number(f.precio_por_cuenta || 0),
          precio_ecommerce: opcional(f.precio_ecommerce),
          precio_mercado_libre: opcional(f.precio_mercado_libre),
          precio_tienda_nube: opcional(f.precio_tienda_nube),
          es_oficial: !!f.es_oficial,
          observacion: f.observacion || null,
        }, { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          self.registrando_actualizacion = false
          self.mostrar_form_actualizacion = false
          if (data.snapshot) {
            self.aplicar_snapshot(data.snapshot)
          }
          self.aplicar_actualizaciones(data)
          // Los montos esperados de los meses sin fila propia salen del total: se refrescan.
          self.cargar_periodos()
          self.avisar('Actualización registrada. Total confirmado: $' + self.format_numero(self.record_total_mensualidad))
        })
        .catch(function (error) {
          self.registrando_actualizacion = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * Alterna el check "oficial" de una actualización (PATCH .../actualizaciones/{id}).
     * @param {Object} actualizacion
     * @returns {void}
     */
    alternar_oficial(actualizacion) {
      const self = this
      if (!this.record || !this.record.id || !actualizacion || this.actualizacion_en_curso_id) {
        return
      }
      self.actualizacion_en_curso_id = actualizacion.id
      api
        .patch('/client/' + this.record.id + '/mensualidad/actualizaciones/' + actualizacion.id, {
          es_oficial: !actualizacion.es_oficial,
        }, { silent_error: true })
        .then(function (res) {
          self.actualizacion_en_curso_id = null
          self.aplicar_actualizaciones(res.data || {})
        })
        .catch(function (error) {
          self.actualizacion_en_curso_id = null
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * Elimina una actualización del historial (DELETE .../actualizaciones/{id}). No revierte
     * los precios del cliente: si se quiere volver atrás, se registra otra actualización.
     * @param {Object} actualizacion
     * @returns {void}
     */
    eliminar_actualizacion(actualizacion) {
      const self = this
      if (!this.record || !this.record.id || !actualizacion || this.actualizacion_en_curso_id) {
        return
      }
      const confirmado = window.confirm(
        '¿Eliminar la actualización del ' + formatear_fecha(actualizacion.fecha) + '? ' +
        'Se borra del historial; los precios actuales del cliente no cambian.'
      )
      if (!confirmado) {
        return
      }
      self.actualizacion_en_curso_id = actualizacion.id
      api
        .delete('/client/' + this.record.id + '/mensualidad/actualizaciones/' + actualizacion.id, { silent_error: true })
        .then(function (res) {
          self.actualizacion_en_curso_id = null
          self.aplicar_actualizaciones(res.data || {})
          self.avisar('Actualización eliminada.')
        })
        .catch(function (error) {
          self.actualizacion_en_curso_id = null
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    // ------------------------------------------------------------------
    // Pagos de la mensualidad (misión modulo-cobranzas, 18/9/2026)
    // ------------------------------------------------------------------
    /**
     * Carga los meses con su estado y sus pagos (GET client/{id}/mensualidad/periodos, con el
     * rango por defecto del backend: desde el inicio de la mensualidad hasta tres meses adelante).
     * @returns {void}
     */
    cargar_periodos() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      const client_id = this.record.id
      self.cargando_periodos = true
      api
        .get('/client/' + client_id + '/mensualidad/periodos', { silent_error: true })
        .then(function (res) {
          self.cargando_periodos = false
          if (!self.record || self.record.id !== client_id) {
            return
          }
          const data = res.data || {}
          self.periodos = Array.isArray(data.periodos) ? data.periodos : []
          if (data.mes_corriente) {
            self.mes_corriente_actual = String(data.mes_corriente)
          }
        })
        .catch(function () {
          self.cargando_periodos = false
          self.avisar('No se pudieron cargar los meses de la mensualidad.', 'danger')
        })
    },
    /**
     * Clase de la fila de un mes, con los mismos colores que la tabla del módulo Cobranzas.
     * @param {Object} periodo `estado_de`
     * @returns {string}
     */
    clase_fila_periodo(periodo) {
      if (!periodo) {
        return ''
      }
      if (periodo.estado === 'pagado') {
        return 'table-success'
      }
      if (periodo.estado === 'facturado' || periodo.estado === 'parcial') {
        return 'table-warning'
      }
      if (periodo.estado === 'pendiente') {
        return 'table-danger'
      }
      return ''
    },
    /**
     * Abre el modal de registrar pago para un mes (o para el corriente si no se pasa ninguno),
     * prefijando el monto esperado de ese mes o, si no lo hay, el total de la mensualidad.
     * @param {Object|null} periodo `estado_de` de la fila, o null desde el botón del encabezado
     * @returns {void}
     */
    abrir_registrar_pago(periodo) {
      const esperado = periodo && periodo.monto_esperado !== null && periodo.monto_esperado !== undefined
        ? periodo.monto_esperado
        : this.record_total_mensualidad
      this.modal_pago = {
        show: true,
        periodo: periodo ? periodo.periodo : this.mes_corriente_actual,
        monto_esperado: esperado,
      }
    },
    /**
     * El modal registró un pago: el backend devolvió el `estado_de` del mes recalculado.
     * @param {Object|null} periodo_actualizado
     * @returns {void}
     */
    on_pago_guardado(periodo_actualizado) {
      this.reemplazar_periodo(periodo_actualizado)
    },
    /**
     * Reemplaza (o agrega) un mes en la lista con el `estado_de` fresco del backend. Si el mes
     * no estaba en la lista (un pago por adelantado fuera del rango), se recarga todo.
     * @param {Object|null} periodo_actualizado
     * @returns {void}
     */
    reemplazar_periodo(periodo_actualizado) {
      if (!periodo_actualizado || !periodo_actualizado.periodo) {
        this.cargar_periodos()
        return
      }
      let reemplazado = false
      this.periodos = this.periodos.map(function (periodo) {
        if (periodo.periodo === periodo_actualizado.periodo) {
          reemplazado = true
          return periodo_actualizado
        }
        return periodo
      })
      if (!reemplazado) {
        this.cargar_periodos()
      }
    },
    /**
     * Marca un mes como sin cargo o lo reabre como pendiente (PUT .../periodos/{periodo}).
     * @param {Object} periodo `estado_de` de la fila
     * @param {string} estado `sin_cargo` | `pendiente`
     * @returns {void}
     */
    marcar_periodo(periodo, estado) {
      const self = this
      if (!this.record || !this.record.id || !periodo || this.periodo_en_curso) {
        return
      }
      if (estado === 'pendiente') {
        const confirmado = window.confirm(
          '¿Reabrir ' + etiqueta_larga(periodo.periodo) + '? El mes vuelve a quedar pendiente.'
        )
        if (!confirmado) {
          return
        }
      }
      self.periodo_en_curso = periodo.periodo
      api
        .put('/client/' + this.record.id + '/mensualidad/periodos/' + periodo.periodo, {
          estado: estado,
        }, { silent_error: true })
        .then(function (res) {
          self.periodo_en_curso = null
          self.reemplazar_periodo((res.data && res.data.periodo) || null)
          self.avisar(estado === 'sin_cargo' ? etiqueta_larga(periodo.periodo) + ' quedó sin cargo.' : etiqueta_larga(periodo.periodo) + ' quedó pendiente.')
        })
        .catch(function (error) {
          self.periodo_en_curso = null
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * Despliega o pliega los pagos de un mes.
     * @param {Object} periodo
     * @returns {void}
     */
    alternar_pagos(periodo) {
      this.periodo_expandido = this.periodo_expandido === periodo.periodo ? null : periodo.periodo
    },
    /**
     * Elimina un pago de un mes (DELETE .../pagos/{pagoId}); el backend recalcula el estado.
     * @param {Object} periodo `estado_de` del mes
     * @param {Object} pago fila de `periodo.pagos`
     * @returns {void}
     */
    eliminar_pago(periodo, pago) {
      const self = this
      if (!this.record || !this.record.id || !pago || this.periodo_en_curso) {
        return
      }
      const confirmado = window.confirm(
        '¿Eliminar el pago de ' + (pago.monto !== null && pago.monto !== undefined ? '$' + this.format_numero(pago.monto) : 'sin importe') +
        ' de ' + etiqueta_larga(periodo.periodo) + '? El estado del mes se recalcula.'
      )
      if (!confirmado) {
        return
      }
      self.periodo_en_curso = periodo.periodo
      api
        .delete('/client/' + this.record.id + '/mensualidad/pagos/' + pago.id, { silent_error: true })
        .then(function (res) {
          self.periodo_en_curso = null
          self.reemplazar_periodo((res.data && res.data.periodo) || null)
          self.avisar('Pago eliminado.')
        })
        .catch(function (error) {
          self.periodo_en_curso = null
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * Formatea un número para mostrarlo con separador de miles y sin decimales,
     * igual criterio visual que la Blade de referencia de empresa-api.
     * @param {number|string|null} valor
     * @returns {string}
     */
    format_numero(valor) {
      const numero = Number(valor || 0)
      return numero.toLocaleString('es-AR', { maximumFractionDigits: 0 })
    },
    /**
     * Formatea el número de comprobante como lo muestra el PDF: punto de
     * venta a 4 dígitos + número a 8 dígitos (ej: 0002-00000014). Si la
     * factura fue rechazada antes de numerarse (`cbte_numero` null), muestra "—".
     * @param {Object} factura Fila del historial (punto_venta, cbte_numero).
     * @returns {string}
     */
    formatear_comprobante(factura) {
      if (!factura || factura.cbte_numero === null || factura.cbte_numero === undefined) {
        return '—'
      }
      const punto_venta = String(factura.punto_venta || 0).padStart(4, '0')
      const numero = String(factura.cbte_numero).padStart(8, '0')
      return punto_venta + '-' + numero
    },
    /**
     * Formatea una fecha ISO (`created_at`) como dd/mm/yyyy para la tabla de historial.
     * @param {string} fecha_iso
     * @returns {string}
     */
    formatear_fecha(fecha_iso) {
      if (!fecha_iso) {
        return ''
      }
      const fecha = new Date(fecha_iso)
      const dd = String(fecha.getDate()).padStart(2, '0')
      const mm = String(fecha.getMonth() + 1).padStart(2, '0')
      const yyyy = fecha.getFullYear()
      return dd + '/' + mm + '/' + yyyy
    },
    /**
     * Carga el historial completo de facturas emitidas para este cliente
     * (GET client/{id}/facturas, prompt 364), incluidas las rechazadas.
     * @returns {void}
     */
    cargar_facturas() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.cargando_facturas = true
      api
        .get('/client/' + this.record.id + '/facturas')
        .then(function (res) {
          self.facturas = (res.data && res.data.facturas) || []
          self.cargando_facturas = false
        })
        .catch(function () {
          self.cargando_facturas = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'No se pudo cargar el historial de facturas.', variant: 'danger' },
          }))
        })
    },
    /**
     * Carga el snapshot de mensualidad del cliente (GET admin/client/{id}/mensualidad)
     * y precarga el formulario.
     * @returns {void}
     */
    cargar_mensualidad() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.loading = true
      self.load_error = null
      api
        .get('/client/' + this.record.id + '/mensualidad')
        .then(function (res) {
          self.aplicar_snapshot(res.data || {})
          self.loading = false
        })
        .catch(function () {
          self.load_error = 'No se pudo cargar la mensualidad de este cliente.'
          self.loading = false
        })
    },
    /**
     * Vuelca un snapshot recibido del backend (GET o PUT mensualidad) al formulario.
     * @param {Object} snapshot
     * @returns {void}
     */
    aplicar_snapshot(snapshot) {
      this.form = {
        /* La fecha viene en formato ISO (con hora); nos quedamos solo con la parte de fecha para el input type=date */
        payment_expired_at: snapshot.payment_expired_at ? String(snapshot.payment_expired_at).slice(0, 10) : '',
        /* Primer mes que se cobra: el backend guarda un date (YYYY-MM-01); el input type=month quiere YYYY-MM. */
        mensualidad_inicio: snapshot.mensualidad_inicio ? String(snapshot.mensualidad_inicio).slice(0, 7) : '',
        precio_plan: Number(snapshot.precio_plan || 0),
        precio_por_cuenta: Number(snapshot.precio_por_cuenta || 0),
        cantidad_empleados: Number(snapshot.cantidad_empleados || 0),
        tiene_ecommerce: !!snapshot.tiene_ecommerce,
        tiene_mercado_libre: !!snapshot.tiene_mercado_libre,
        tiene_tienda_nube: !!snapshot.tiene_tienda_nube,
        precio_ecommerce: snapshot.precio_ecommerce !== null && snapshot.precio_ecommerce !== undefined ? Number(snapshot.precio_ecommerce) : null,
        precio_mercado_libre: snapshot.precio_mercado_libre !== null && snapshot.precio_mercado_libre !== undefined ? Number(snapshot.precio_mercado_libre) : null,
        precio_tienda_nube: snapshot.precio_tienda_nube !== null && snapshot.precio_tienda_nube !== undefined ? Number(snapshot.precio_tienda_nube) : null,
        afip_cuit: snapshot.afip_cuit || '',
        afip_razon_social: snapshot.afip_razon_social || '',
        afip_condicion_iva: snapshot.afip_condicion_iva || '',
        afip_domicilio: snapshot.afip_domicilio || '',
      }
      this.record_total_mensualidad = Number(snapshot.total_mensualidad || 0)
      /* El snapshot trae el resumen de actualización desde la misión modulo-cobranzas; un backend
         viejo no lo manda y en ese caso se conserva lo que ya hubiera. */
      if (snapshot.actualizacion) {
        this.resumen_actualizacion = snapshot.actualizacion
      }
    },
    /**
     * Cuerpo del PUT de mensualidad: el form tal cual, con `mensualidad_inicio` convertido de
     * `YYYY-MM` (input type=month) a `YYYY-MM-01` (date del backend), o null si está vacío.
     * @returns {Object}
     */
    armar_payload_mensualidad() {
      return Object.assign({}, this.form, {
        mensualidad_inicio: this.form.mensualidad_inicio ? primer_dia_de(this.form.mensualidad_inicio) : null,
      })
    },
    /**
     * Suma o resta un mes a `form.payment_expired_at`, cuidando el overflow
     * de fin de mes (ej: 31 de enero - 1 mes → último día de diciembre).
     * @param {number} delta Cantidad de meses a sumar (negativo para restar).
     * @returns {void}
     */
    ajustar_mes(delta) {
      // Fecha base: la cargada en el form, o la fecha actual si está vacía.
      const partes = this.form.payment_expired_at ? this.form.payment_expired_at.split('-').map(Number) : null
      const base = partes && partes.length === 3 ? new Date(partes[0], partes[1] - 1, partes[2]) : new Date()

      const dia_original = base.getDate()
      base.setMonth(base.getMonth() + delta)
      // Si el día cambió por overflow (ej. 31 -> 3), retrocede al último día del mes destino.
      if (base.getDate() !== dia_original) {
        base.setDate(0)
      }

      const yyyy = base.getFullYear()
      const mm = String(base.getMonth() + 1).padStart(2, '0')
      const dd = String(base.getDate()).padStart(2, '0')
      this.form.payment_expired_at = yyyy + '-' + mm + '-' + dd
    },
    /**
     * Guarda los inputs de mensualidad + fecha + datos fiscales
     * (PUT admin/client/{id}/mensualidad). El total definitivo lo confirma
     * siempre el backend (ClientMensualidadService::calcular_total).
     * @returns {void}
     */
    guardar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.saving = true
      api
        .put('/client/' + this.record.id + '/mensualidad', self.armar_payload_mensualidad())
        .then(function (res) {
          self.aplicar_snapshot(res.data || {})
          self.saving = false
          // Si cambió "Se cobra desde" o el total, los meses de la tarjeta de pagos cambian con ellos.
          self.cargar_periodos()
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: {
              message: 'Datos guardados. Total confirmado: $' + self.format_numero(self.record_total_mensualidad),
              variant: 'success',
            },
          }))
        })
        .catch(function () {
          self.saving = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'No se pudo guardar la mensualidad.', variant: 'danger' },
          }))
        })
    },
    /**
     * Botón "Obtener datos": consulta el padrón de ARCA por el CUIT cargado y
     * completa con la respuesta los demás campos fiscales del formulario.
     *
     * NO guarda: deja los datos en el formulario para que se revisen y se
     * confirmen con el botón "Guardar" de esta misma tarjeta. Es lo que hace el
     * modal equivalente de VENDER en empresa-spa.
     *
     * Un campo que ARCA devuelva vacío no pisa lo que ya estuviera cargado a
     * mano (pasa con el domicilio de algunos contribuyentes, y con la condición
     * IVA cuando ARCA no la puede determinar): borrar un dato bueno con un
     * vacío sería peor que dejarlo desactualizado.
     *
     * El CUIT sí se reescribe con el que devuelve ARCA, que viene solo en
     * dígitos: es la forma en la que hay que guardarlo para facturar.
     *
     * @returns {void}
     */
    obtener_datos_afip() {
      const self = this
      if (!this.record || !this.record.id || !this.cuit_consultable) {
        return
      }

      /* 🔴 Cliente al que pertenece ESTE request. Este componente no se desmonta al
         cambiar de cliente —hay un watcher sobre `record.id` que solo recarga el
         snapshot—, así que sin esta guarda una respuesta de ARCA que llega tarde
         escribiría los datos fiscales del cliente anterior sobre el formulario del
         que está abierto ahora. Si además se apretara Guardar, la Factura C saldría
         a nombre del contribuyente equivocado: un comprobante fiscal real mal emitido. */
      const client_id = this.record.id

      /* Solo dígitos: el campo acepta guiones y puntos, y un CUIT pegado de una
         planilla o de un mail suele traer espacios. La ruta matchea `[0-9\-\.]+`,
         así que un espacio daría un 404 que en pantalla parece "ARCA está caída". */
      const cuit = String(this.form.afip_cuit).replace(/\D/g, '')

      self.obteniendo_datos_afip = true
      api
        // Timeout propio de esta llamada: la instancia global de axios no define
        // ninguno, y sin esto una conexión colgada deja el botón en "Consultando..."
        // hasta que se recargue la página.
        .get('/client/' + client_id + '/mensualidad/datos-afip/' + cuit, { timeout: 60000 })
        .then(function (res) {
          self.obteniendo_datos_afip = false

          // Se cambió de cliente mientras ARCA respondía: la respuesta ya no
          // corresponde al formulario que se está viendo y se descarta entera.
          if (!self.record || self.record.id !== client_id) {
            return
          }

          const data = res.data || {}

          // ARCA contesta 200 tanto si encontró al contribuyente como si no;
          // lo que distingue los dos casos es `hubo_un_error`.
          if (data.hubo_un_error) {
            window.dispatchEvent(new CustomEvent('admin-spa-toast', {
              detail: { message: data.error || 'ARCA no devolvió datos para ese CUIT.', variant: 'danger' },
            }))
            return
          }

          const datos = data.datos || {}
          let completados = 0

          // El CUIT no cuenta como dato completado: solo se normaliza a dígitos,
          // que es la forma en la que hay que guardarlo para poder facturar.
          if (datos.cuit) {
            self.form.afip_cuit = datos.cuit
          }
          if (datos.razon_social) {
            self.form.afip_razon_social = datos.razon_social
            completados++
          }
          if (datos.domicilio) {
            self.form.afip_domicilio = datos.domicilio
            completados++
          }
          if (datos.condicion_iva) {
            self.form.afip_condicion_iva = datos.condicion_iva
            completados++
          }

          // Hay contribuyentes que ARCA reconoce pero de los que no devuelve
          // ninguno de estos tres datos. Sin este aviso el formulario queda igual
          // que antes y el toast verde haría pensar que el botón no anduvo.
          if (completados === 0) {
            window.dispatchEvent(new CustomEvent('admin-spa-toast', {
              detail: {
                message: 'ARCA reconoce el CUIT pero no devolvió razón social, domicilio ni condición IVA. Cargalos a mano.',
                variant: 'warning',
              },
            }))
            return
          }

          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'Datos traídos de ARCA. Revisalos y apretá Guardar.', variant: 'success' },
          }))
        })
        .catch(function () {
          self.obteniendo_datos_afip = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'No se pudo consultar a ARCA.', variant: 'danger' },
          }))
        })
    },
    /**
     * Emite la Factura C de la mensualidad del cliente (POST emitir-factura),
     * previa alerta de confirmación porque genera un comprobante fiscal real
     * e irreversible. No toca la fecha de pago.
     * @returns {void}
     */
    emitir_factura() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }

      const confirmado = window.confirm(
        '¿Emitir la factura de la mensualidad de ' +
          (this.record.company_name || this.record.name || 'este cliente') +
          ' por $' +
          this.format_numero(this.record_total_mensualidad) +
          ' (' + etiqueta_larga(this.periodo_factura) + ')' +
          '? Genera un comprobante fiscal real e irreversible.'
      )
      if (!confirmado) {
        return
      }

      self.emitiendo_factura = true
      self.factura_result = null
      api
        // El período viaja explícito (misión modulo-cobranzas); el backend ya lo aceptaba con
        // default al mes corriente, así que un SPA viejo sigue andando igual.
        .post('/client/' + this.record.id + '/emitir-factura', { periodo: this.periodo_factura })
        .then(function (res) {
          self.factura_result = res.data || null
          self.emitiendo_factura = false
          if (self.factura_result && self.factura_result.ok) {
            window.dispatchEvent(new CustomEvent('admin-spa-toast', {
              detail: {
                message: self.factura_result.ya_facturado
                  ? 'Este período ya estaba facturado.'
                  : 'Factura emitida correctamente (CAE ' + self.factura_result.cae + ').',
                variant: 'success',
              },
            }))
            // Refresca el historial para que la factura recién emitida aparezca sin recargar el modal.
            self.cargar_facturas()
            // Y los meses: el facturado pasa de rojo a amarillo.
            self.cargar_periodos()
          } else {
            window.dispatchEvent(new CustomEvent('admin-spa-toast', {
              detail: {
                message: (self.factura_result && self.factura_result.error_message) || 'No se pudo emitir la factura.',
                variant: 'danger',
              },
            }))
          }
        })
        .catch(function (error) {
          self.emitiendo_factura = false
          const mensaje =
            error && error.response && error.response.data && error.response.data.error_message
              ? error.response.data.error_message
              : 'No se pudo emitir la factura.'
          self.factura_result = { ok: false, error_message: mensaje }
        })
    },
    /**
     * Abre en una pestaña nueva el PDF ya autorizado de una factura emitida.
     * En vez de descargarlo por blob, pide un token de vista de un solo uso
     * (POST .../pdf-access-token, autenticado) y arma la URL pública de
     * `pdf-view/{token}` (prompt 362/363) para que el navegador la renderice
     * de forma nativa; desde ahí el usuario descarga con el visor propio si
     * quiere. La ruta de vista no vive bajo el prefijo /api/admin del cliente
     * axios compartido, por eso se arma con `admin_api_origin()`.
     *
     * Parametrizado por `invoice_id` (prompt 365) para poder abrir el PDF de
     * cualquier fila del historial, no solo de la última emisión de la
     * sesión; el estado de "abriendo" se guarda por factura
     * (`viendo_pdf_invoice_id`) para no deshabilitar los botones de las demás.
     * @param {number} invoice_id Id de la factura (MensualidadInvoice) a visualizar.
     * @returns {void}
     */
    ver_pdf(invoice_id) {
      const self = this
      if (!this.record || !this.record.id || !invoice_id) {
        return
      }
      self.viendo_pdf_invoice_id = invoice_id
      api
        .post('/client/' + this.record.id + '/factura/' + invoice_id + '/pdf-access-token')
        .then(function (response) {
          const token = response.data && response.data.token
          if (!token) {
            throw new Error('Sin token')
          }
          // Ruta pública registrada fuera del grupo `admin` (sin Sanctum):
          // api/client/.../pdf-view/{token}, no api/admin/client/...
          const url =
            admin_api_origin() +
            '/api/client/' + self.record.id +
            '/factura/' + invoice_id +
            '/pdf-view/' + token
          window.open(url, '_blank')
        })
        .catch(function () {
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'No se pudo abrir el PDF de la factura.', variant: 'danger' },
          }))
        })
        .then(function () {
          self.viendo_pdf_invoice_id = null
        })
    },
    /**
     * Trae del empresa-api del cliente los conteos vivos (empleados,
     * ecommerce, mercado libre, tienda nube) y los precarga en el formulario
     * para que Lucas los revise y confirme con "Guardar" (prompt 335, capa
     * opcional). Si el cliente no soporta sincronización (versión vieja o
     * sin api_url/api_key), deshabilita los botones con el aviso devuelto.
     * @returns {void}
     */
    traer_del_cliente() {
      const self = this
      if (!this.record || !this.record.id || this.sync_no_soportado) {
        return
      }
      self.trayendo_del_cliente = true
      api
        .post('/client/' + this.record.id + '/mensualidad/traer-del-cliente')
        .then(function (res) {
          const data = res.data || {}
          self.trayendo_del_cliente = false
          if (!data.soportado) {
            self.marcar_sync_no_soportado(data.error)
            return
          }
          // Se rellenan solo cantidad de empleados y toggles de módulos (conteos vivos);
          // los precios y datos fiscales los revisa Lucas antes de Guardar.
          self.form.cantidad_empleados = Number(data.cantidad_empleados || 0)
          self.form.tiene_ecommerce = !!data.tiene_ecommerce
          self.form.tiene_mercado_libre = !!data.tiene_mercado_libre
          self.form.tiene_tienda_nube = !!data.tiene_tienda_nube
          // Datos fiscales: solo se precargan los campos que están vacíos en admin, sin pisar lo ya cargado.
          if (data.afip_information) {
            if (!self.form.afip_cuit && data.afip_information.cuit) {
              self.form.afip_cuit = data.afip_information.cuit
            }
            if (!self.form.afip_razon_social && data.afip_information.razon_social) {
              self.form.afip_razon_social = data.afip_information.razon_social
            }
            if (!self.form.afip_condicion_iva && data.afip_information.condicion_iva) {
              self.form.afip_condicion_iva = data.afip_information.condicion_iva
            }
            if (!self.form.afip_domicilio && data.afip_information.domicilio_comercial) {
              self.form.afip_domicilio = data.afip_information.domicilio_comercial
            }
          }
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: {
              message: 'Datos traídos del cliente. Revisá y presioná Guardar para confirmarlos.',
              variant: 'success',
            },
          }))
        })
        .catch(function () {
          self.trayendo_del_cliente = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'No se pudo consultar la mensualidad del cliente.', variant: 'danger' },
          }))
        })
    },
    /**
     * Empuja al empresa-api del cliente la fecha de próximo pago y los
     * precios actuales ya guardados en admin (prompt 335, capa opcional),
     * previa confirmación porque sobrescribe datos en el sistema del
     * cliente. Si no soporta sincronización, deshabilita los botones con el
     * aviso devuelto.
     * @returns {void}
     */
    actualizar_en_cliente() {
      const self = this
      if (!this.record || !this.record.id || this.sync_no_soportado) {
        return
      }
      const confirmado = window.confirm(
        '¿Actualizar la fecha de próximo pago y los precios en el sistema de ' +
          (this.record.company_name || this.record.name || 'este cliente') +
          '?'
      )
      if (!confirmado) {
        return
      }
      self.actualizando_en_cliente = true
      api
        .post('/client/' + this.record.id + '/mensualidad/actualizar-en-cliente')
        .then(function (res) {
          const data = res.data || {}
          self.actualizando_en_cliente = false
          if (!data.soportado) {
            self.marcar_sync_no_soportado(data.error)
            return
          }
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: {
              message: 'Fecha y precios actualizados en el sistema del cliente.',
              variant: 'success',
            },
          }))
        })
        .catch(function () {
          self.actualizando_en_cliente = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'No se pudo actualizar la mensualidad en el cliente.', variant: 'danger' },
          }))
        })
    },
    /**
     * Marca el cliente actual como no soportado para sincronización,
     * deshabilitando ambos botones con el motivo devuelto por el backend
     * (versión antigua de empresa-api o configuración faltante).
     * @param {string} [motivo]
     * @returns {void}
     */
    marcar_sync_no_soportado(motivo) {
      this.sync_no_soportado = true
      this.sync_no_soportado_motivo = motivo || 'Este cliente todavía no soporta sincronización — cargá los datos a mano.'
    },
  },
}
</script>

<style scoped>
/* Precios vigentes de solo lectura: se leen como dato, no como campo. Tamaño de input para que
   la fila no cambie de altura respecto de los campos que tiene al lado. */
.precios-vigentes .fw-semibold {
  font-size: 1rem;
  line-height: 1.5;
}
</style>
