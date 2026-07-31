<template>
  <!-- Marco visual de dispositivo: da la sensación premium y evita que la pieza
       se lea como una captura suelta (contexto/demo_experiencia.md §3.18) -->
  <div class="demo-marco" :class="'demo-marco--' + tipo_normalizado">
    <!-- Computadora + teléfono en composición conjunta (única combinación posible: scroll.2) -->
    <div v-if="tipo === 'computadora+telefono'" class="demo-marco__compu-wrap">
      <div class="demo-marco__pantalla-compu">
        <div class="demo-marco__pantalla-compu-inner">
          <slot name="computadora" />
        </div>
      </div>
      <div class="demo-marco__pantalla-telefono">
        <div class="demo-marco__pantalla-telefono-inner">
          <slot name="telefono" />
        </div>
      </div>
    </div>

    <!-- Solo computadora: proporción 16:9 -->
    <div v-else-if="tipo === 'computadora'" class="demo-marco__pantalla-compu">
      <div class="demo-marco__pantalla-compu-inner">
        <slot />
      </div>
    </div>

    <!-- Solo teléfono: proporción real de dispositivo móvil -->
    <div v-else class="demo-marco__pantalla-telefono">
      <div class="demo-marco__pantalla-telefono-inner">
        <slot />
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Marco visual de dispositivo (computadora y/o teléfono) que envuelve una pieza
 * multimedia del scroll de dolor de la página inmersiva de demo.
 *
 * Las proporciones (16:9 en computadora, proporción real de teléfono) y todo el
 * estilo del marco viven como variables/clases compartidas en
 * assets/scss/demo-experiencia.scss, no hardcodeadas acá — así el marco es
 * consistente entre los seis bloques del scroll y no hay que tocar este
 * componente si cambia la identidad visual.
 *
 * Responsive: en móvil el marco se achica vía CSS (max-width, aspect-ratio)
 * pero nunca se recorta ni se rota (contexto/demo_experiencia.md §3.18).
 */
export default {
  name: 'MarcoDispositivo',

  props: {
    /**
     * Tipo de marco a renderizar. 'computadora+telefono' es la única
     * combinación soportada: los dos dispositivos conviven en una
     * composición superpuesta, nunca apilados uno arriba del otro.
     */
    tipo: {
      type: String,
      required: true,
      validator: function (value) {
        return ['computadora', 'telefono', 'computadora+telefono'].includes(value)
      },
    },
  },

  computed: {
    /**
     * Sufijo de clase CSS derivado de `tipo`, reemplazando "+" por "-" para
     * obtener un nombre de clase válido (demo-marco--computadora-telefono).
     *
     * @returns {string}
     */
    tipo_normalizado() {
      return this.tipo.replace('+', '-')
    },
  },
}
</script>
