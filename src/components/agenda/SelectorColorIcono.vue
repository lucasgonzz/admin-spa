<template>
  <!--
    "Color e ícono" de Structured: los 9 colores de la paleta, el buscador de íconos, las pestañas
    de categorías y la grilla de íconos por categoría (Bootstrap Icons, no los de Structured).
    Elegir un color o un ícono lo aplica enseguida al formulario del panel (se guarda con
    "Guardar cambios" / "Crear tarea").
  -->
  <div class="ag-selector" role="dialog" aria-label="Color e ícono" @mousedown.stop>
    <div class="ag-selector__cabecera">
      <span class="ag-selector__titulo">Color e ícono</span>
      <button type="button" class="ag-selector__cerrar" aria-label="Cerrar" @click="$emit('cerrar')">
        <i class="bi bi-x-lg" aria-hidden="true" />
      </button>
    </div>

    <!-- Colores -->
    <div class="ag-selector__colores" role="radiogroup" aria-label="Color">
      <button
        v-for="opcion in paleta"
        :key="'ag-sel-c-' + opcion.clave"
        type="button"
        role="radio"
        class="ag-selector__color"
        :class="{ 'ag-selector__color--activo': opcion.clave === color }"
        :style="{ backgroundColor: opcion.hex }"
        :aria-checked="opcion.clave === color ? 'true' : 'false'"
        :aria-label="opcion.nombre"
        :title="opcion.nombre"
        @click="$emit('elegir-color', opcion.clave)"
      />
    </div>

    <!-- Buscador -->
    <label class="ag-selector__buscador">
      <i class="bi bi-search" aria-hidden="true" />
      <input
        v-model="busqueda"
        type="search"
        class="ag-selector__input"
        placeholder="Buscar íconos"
        aria-label="Buscar íconos"
      />
    </label>

    <!-- Pestañas de categorías -->
    <div v-if="busqueda.trim() === ''" class="ag-selector__pestanas" role="tablist" aria-label="Categorías de íconos">
      <button
        v-for="categoria in categorias"
        :key="'ag-sel-p-' + categoria.clave"
        type="button"
        role="tab"
        class="ag-selector__pestana"
        :class="{ 'ag-selector__pestana--activa': categoria.clave === categoria_activa }"
        :aria-selected="categoria.clave === categoria_activa ? 'true' : 'false'"
        :aria-label="categoria.nombre"
        :title="categoria.nombre"
        @click="ir_a_categoria(categoria.clave)"
      >
        <i class="bi" :class="'bi-' + categoria.icono" aria-hidden="true" />
      </button>
    </div>

    <!-- Íconos -->
    <div ref="lista" class="ag-selector__lista" @scroll="on_scroll_lista">
      <template v-if="busqueda.trim() !== ''">
        <p v-if="resultados.length === 0" class="ag-selector__sin-resultados">No hay íconos con «{{ busqueda }}».</p>
        <div v-else class="ag-selector__grilla">
          <button
            v-for="nombre in resultados"
            :key="'ag-sel-r-' + nombre"
            type="button"
            class="ag-selector__icono"
            :class="{ 'ag-selector__icono--activo': nombre === icono }"
            :aria-label="nombre"
            :title="nombre"
            @click="$emit('elegir-icono', nombre)"
          >
            <i class="bi" :class="'bi-' + nombre" aria-hidden="true" />
          </button>
        </div>
      </template>
      <template v-else>
        <section
          v-for="categoria in categorias"
          :key="'ag-sel-s-' + categoria.clave"
          :ref="'seccion_' + categoria.clave"
          class="ag-selector__seccion"
          :data-clave="categoria.clave"
        >
          <p class="ag-selector__seccion-titulo">
            <i class="bi" :class="'bi-' + categoria.icono" aria-hidden="true" />
            {{ categoria.nombre }}
          </p>
          <div class="ag-selector__grilla">
            <button
              v-for="item in categoria.iconos"
              :key="'ag-sel-i-' + item[0]"
              type="button"
              class="ag-selector__icono"
              :class="{ 'ag-selector__icono--activo': item[0] === icono }"
              :aria-label="item[1]"
              :title="item[1]"
              @click="$emit('elegir-icono', item[0])"
            >
              <i class="bi" :class="'bi-' + item[0]" aria-hidden="true" />
            </button>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script>
import { PALETA, CATEGORIAS_ICONOS, buscar_iconos } from './agenda_utils'

export default {
  name: 'AgendaSelectorColorIcono',
  props: {
    /** Clave del color elegido. */
    color: { type: String, required: true },
    /** Nombre del ícono elegido (sin "bi-"). */
    icono: { type: String, required: true },
  },
  emits: ['elegir-color', 'elegir-icono', 'cerrar'],
  data() {
    return {
      /** Texto del buscador de íconos. */
      busqueda: '',
      /** Categoría resaltada en las pestañas (la que está arriba en la lista). */
      categoria_activa: CATEGORIAS_ICONOS[0].clave,
    }
  },
  computed: {
    /**
     * Paleta de colores.
     *
     * @returns {Array<Object>}
     */
    paleta() {
      return PALETA
    },
    /**
     * Categorías del catálogo de íconos.
     *
     * @returns {Array<Object>}
     */
    categorias() {
      return CATEGORIAS_ICONOS
    },
    /**
     * Íconos que coinciden con la búsqueda.
     *
     * @returns {string[]}
     */
    resultados() {
      return buscar_iconos(this.busqueda)
    },
  },
  mounted() {
    /* Abre en la categoría del ícono actual, para que se vea cuál está elegido. */
    const self = this
    let categoria_del_icono = null
    CATEGORIAS_ICONOS.forEach(function (categoria) {
      categoria.iconos.forEach(function (item) {
        if (item[0] === self.icono && !categoria_del_icono) {
          categoria_del_icono = categoria.clave
        }
      })
    })
    if (categoria_del_icono) {
      self.$nextTick(function () {
        self.ir_a_categoria(categoria_del_icono)
      })
    }
  },
  methods: {
    /**
     * Lleva la lista a la sección de una categoría.
     *
     * @param {string} clave
     * @returns {void}
     */
    ir_a_categoria(clave) {
      const lista = this.$refs.lista
      const refs = this.$refs['seccion_' + clave]
      const seccion = Array.isArray(refs) ? refs[0] : refs
      this.categoria_activa = clave
      if (!lista || !seccion) {
        return
      }
      lista.scrollTop = seccion.offsetTop - lista.offsetTop
    },
    /**
     * Al scrollear la lista, la pestaña activa sigue a la sección que quedó arriba.
     *
     * @returns {void}
     */
    on_scroll_lista() {
      const lista = this.$refs.lista
      if (!lista || this.busqueda.trim() !== '') {
        return
      }
      const tope = lista.scrollTop + 8
      let activa = CATEGORIAS_ICONOS[0].clave
      const secciones = lista.querySelectorAll('[data-clave]')
      for (let i = 0; i < secciones.length; i++) {
        if (secciones[i].offsetTop - lista.offsetTop <= tope) {
          activa = secciones[i].getAttribute('data-clave')
        }
      }
      this.categoria_activa = activa
    },
  },
}
</script>

<style scoped>
.ag-selector {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 360px;
  max-width: calc(100vw - 24px);
  padding: 16px;
  border: 1px solid var(--ag-borde);
  border-radius: 20px;
  background: var(--ag-superficie);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  color: var(--ag-texto);
}

.ag-selector__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ag-selector__titulo {
  font-size: 16px;
  font-weight: 700;
}

.ag-selector__cerrar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #48484a;
  border-radius: 50%;
  background: transparent;
  color: #b4b4b6;
  font-size: 11px;
  cursor: pointer;
}

.ag-selector__colores {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--ag-borde);
  border-radius: 24px;
}

.ag-selector__color {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.ag-selector__color:hover {
  transform: scale(1.1);
}

.ag-selector__color--activo {
  box-shadow: inset 0 0 0 2px var(--ag-superficie), 0 0 0 2px #fff;
}

.ag-selector__buscador {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  margin: 0;
  padding: 0 16px;
  border: 1px solid var(--ag-borde);
  border-radius: 21px;
  color: #b4b4b6;
}

.ag-selector__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ag-texto);
  font-size: 14px;
  outline: none;
}

.ag-selector__input::placeholder {
  color: var(--ag-apagado);
}

.ag-selector__pestanas {
  display: flex;
  gap: 2px;
  padding: 4px;
  overflow-x: auto;
  border: 1px solid var(--ag-borde);
  border-radius: 22px;
  scrollbar-width: none;
}

.ag-selector__pestana {
  display: inline-flex;
  flex: 1 0 34px;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: #d8d8da;
  font-size: 15px;
  cursor: pointer;
}

.ag-selector__pestana--activa {
  background: var(--ag-salmon);
  color: #fff;
}

.ag-selector__lista {
  position: relative;
  max-height: 290px;
  margin-right: -8px;
  padding-right: 8px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.ag-selector__seccion-titulo {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 12px 8px;
  color: #b4b4b6;
  font-size: 12px;
  font-weight: 600;
}

.ag-selector__grilla {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}

.ag-selector__icono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid #48484a;
  border-radius: 50%;
  background: transparent;
  color: #fff;
  font-size: 17px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.ag-selector__icono:hover {
  background: rgba(255, 255, 255, 0.08);
}

.ag-selector__icono--activo,
.ag-selector__icono--activo:hover {
  border-color: var(--ag-salmon);
  background: var(--ag-salmon);
}

.ag-selector__sin-resultados {
  margin: 8px;
  color: var(--ag-apagado);
  font-size: 13px;
}
</style>
