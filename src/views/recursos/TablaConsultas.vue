<template>
  <div class="recursos-consultas">
    <p v-if="!filas.length" class="text-body-secondary fst-italic small mb-0">{{ vacio }}</p>

    <template v-else>
      <!-- Tablet y escritorio (≥ 768 px): tabla. -->
      <div class="table-responsive d-none d-md-block">
        <table class="table table-sm align-middle mb-0 recursos-consultas__tabla">
          <thead>
            <tr>
              <th scope="col">Consulta</th>
              <th scope="col" class="text-end">Veces</th>
              <th scope="col">Lo que devolvió el buscador</th>
              <th scope="col" class="text-end">Última</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fila in filas" :key="fila.consulta">
              <td class="recursos-consultas__consulta fw-semibold">{{ fila.consulta }}</td>
              <td class="text-end">{{ fila.veces }}</td>
              <td class="recursos-consultas__devolvio">
                <span v-if="!fila.primero_codigo" class="text-body-secondary fst-italic">nada{{ fila.sin_resultados < fila.veces ? ' (la última vez)' : '' }}</span>
                <template v-else>
                  <span class="badge text-bg-light border me-1">{{ fila.primero_codigo }}</span>
                  <span v-if="fila.primero_titulo">{{ fila.primero_titulo }}</span>
                  <span v-else class="text-body-secondary fst-italic">(el video ya no existe)</span>
                </template>
                <small v-if="fila.sin_resultados > 0 && fila.sin_resultados < fila.veces" class="d-block text-body-secondary">
                  {{ fila.sin_resultados }} de {{ fila.veces }} {{ fila.veces === 1 ? 'vez' : 'veces' }} no devolvió nada
                </small>
              </td>
              <td class="text-end text-nowrap small text-body-secondary">{{ fecha_corta(fila.ultima) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Teléfono (< 768 px): tarjetas apiladas, sin scroll horizontal. -->
      <ul class="list-group list-group-flush d-md-none recursos-consultas__tarjetas">
        <li v-for="fila in filas" :key="fila.consulta" class="list-group-item px-0">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <span class="recursos-consultas__consulta fw-semibold">{{ fila.consulta }}</span>
            <span class="badge text-bg-secondary flex-shrink-0">{{ fila.veces }} {{ fila.veces === 1 ? 'vez' : 'veces' }}</span>
          </div>
          <div class="small mt-1 recursos-consultas__devolvio">
            <span class="text-body-secondary">Devolvió: </span>
            <span v-if="!fila.primero_codigo" class="text-body-secondary fst-italic">nada{{ fila.sin_resultados < fila.veces ? ' (la última vez)' : '' }}</span>
            <template v-else>
              <span class="badge text-bg-light border me-1">{{ fila.primero_codigo }}</span>
              <span v-if="fila.primero_titulo">{{ fila.primero_titulo }}</span>
              <span v-else class="text-body-secondary fst-italic">(el video ya no existe)</span>
            </template>
          </div>
          <div v-if="fila.sin_resultados > 0 && fila.sin_resultados < fila.veces" class="small text-body-secondary">
            {{ fila.sin_resultados }} de {{ fila.veces }} {{ fila.veces === 1 ? 'vez' : 'veces' }} no devolvió nada
          </div>
          <div class="small text-body-secondary">Última: {{ fecha_corta(fila.ultima) }}</div>
        </li>
      </ul>
    </template>
  </div>
</template>

<script>
import { fecha_corta } from './recursos_admin'

/**
 * Lista de consultas de la solapa «Búsquedas» del Centro de recursos: una fila por consulta, con cuántas veces se
 * buscó, qué devolvió el buscador y cuándo fue la última. En tablet y escritorio es una tabla; en teléfono, tarjetas
 * apiladas. Todo el texto va con `{{ }}` (las consultas las escriben los clientes: nunca se interpretan como HTML).
 */
export default {
  name: 'TablaConsultasRecursos',
  props: {
    /** Filas normalizadas por `PanelBusquedas` (`consulta`, `veces`, `sin_resultados`, `primero_codigo`, `primero_titulo`, `ultima`). */
    filas: { type: Array, required: true },
    /** Texto cuando no hay filas. */
    vacio: { type: String, default: 'Nada para mostrar.' },
  },
  methods: {
    fecha_corta: fecha_corta,
  },
}
</script>

<style scoped>
.recursos-consultas__tabla th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  white-space: nowrap;
}
.recursos-consultas__consulta,
.recursos-consultas__devolvio {
  overflow-wrap: anywhere;
  min-width: 0;
}
</style>
