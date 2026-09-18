<template>
  <!--
    `no_aplica` (antes del mes de inicio del cliente) y `futuro` (después del mes corriente) no
    son estados de cobranza: no hay nada que reclamar ni que festejar. Un guion gris y nada más,
    para que el ojo se vaya a los que sí importan.
  -->
  <span v-if="!estado || estado === 'no_aplica' || estado === 'futuro'" class="text-muted">—</span>
  <span
    v-else
    class="badge estado-mensualidad"
    :class="clase"
    :title="titulo"
  >{{ texto }}</span>
</template>

<script>
import { format_plata } from './plata'

/**
 * Badge de estado de un mes de mensualidad (misión modulo-cobranzas, 18/9/2026).
 *
 * Recibe el objeto `estado_de` que devuelve `CobranzasMensualidadService` (`{estado, saldo,
 * monto_esperado, monto_pagado, factura, observacion, ...}`) y lo pinta con los colores que
 * Lucas ya usa en su planilla: verde pagó, amarillo hay factura pero no pago, rojo ni una cosa
 * ni la otra. Lo usan la tabla del módulo, el modal del cliente y la pestaña Mensualidad, así
 * que un cambio de color o de texto se hace acá y sale igual en los tres lados.
 */
export default {
  name: 'EstadoMensualidadBadge',
  props: {
    /** Objeto `estado_de` de un período; puede venir null para un mes sin datos. */
    estado_de: { type: Object, default: null },
  },
  computed: {
    /**
     * Estado crudo del período.
     * @returns {string|null}
     */
    estado() {
      return this.estado_de && this.estado_de.estado ? String(this.estado_de.estado) : null
    },
    /**
     * Clases Bootstrap del badge según el estado. `parcial` lleva el amarillo de "hay algo" con
     * un borde rojo de "pero falta": es la única celda que tiene que leerse como dos cosas.
     * @returns {string}
     */
    clase() {
      if (this.estado === 'pagado') {
        return 'text-bg-success'
      }
      if (this.estado === 'facturado') {
        return 'text-bg-warning'
      }
      if (this.estado === 'pendiente') {
        return 'text-bg-danger'
      }
      if (this.estado === 'parcial') {
        return 'text-bg-warning border border-danger'
      }
      if (this.estado === 'sin_cargo') {
        return 'text-bg-secondary'
      }
      return 'text-bg-light text-dark border'
    },
    /**
     * Texto visible del badge.
     * @returns {string}
     */
    texto() {
      if (this.estado === 'pagado') {
        return 'Pagado'
      }
      if (this.estado === 'facturado') {
        return 'Facturada'
      }
      if (this.estado === 'pendiente') {
        return 'Pendiente'
      }
      if (this.estado === 'parcial') {
        return 'Parcial · faltan ' + format_plata(this.estado_de.saldo)
      }
      if (this.estado === 'sin_cargo') {
        return 'Sin cargo'
      }
      return this.estado || ''
    },
    /**
     * Tooltip con el detalle que no entra en el badge: montos, número de factura y observación.
     * @returns {string}
     */
    titulo() {
      const partes = []
      const datos = this.estado_de || {}
      if (datos.monto_esperado !== null && datos.monto_esperado !== undefined) {
        partes.push('Esperado ' + format_plata(datos.monto_esperado))
      }
      if (Number(datos.monto_pagado || 0) > 0) {
        partes.push('Pagado ' + format_plata(datos.monto_pagado))
      }
      if (datos.factura && datos.factura.cbte_numero) {
        partes.push('Factura ' + String(datos.factura.punto_venta || 0).padStart(4, '0') + '-' + String(datos.factura.cbte_numero).padStart(8, '0'))
      }
      if (datos.observacion) {
        partes.push(String(datos.observacion))
      }
      return partes.join(' · ')
    },
  },
}
</script>

<style scoped>
/* Sin mayúsculas ni negrita pesada: el badge se repite doce veces por fila y tiene que leerse
   como dato, no como alarma. El color ya dice lo que hay que decir. */
.estado-mensualidad {
  font-weight: 500;
  white-space: nowrap;
}
</style>
