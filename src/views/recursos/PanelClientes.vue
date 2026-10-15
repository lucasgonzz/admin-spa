<template>
  <div class="recursos-clientes">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <p class="text-muted small mb-0">Cuánto avanzó cada cliente en el centro. Tocá un cliente para ver a cada usuario.</p>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <input
          v-model="busqueda"
          type="search"
          class="form-control form-control-sm recursos-clientes__buscar"
          placeholder="Buscar cliente por nombre"
          aria-label="Buscar cliente por nombre"
        />
        <button type="button" class="btn btn-outline-primary btn-sm" :disabled="cargando" @click="cargar">
          <span v-if="cargando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
          Actualizar
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <div v-else-if="cargando && !clientes.length" class="text-center py-5 text-muted">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
      Cargando clientes...
    </div>

    <p v-else-if="!clientes.length" class="text-muted fst-italic">No hay clientes para mostrar.</p>

    <p v-else-if="!clientes_filtrados.length" class="text-muted fst-italic">
      Ningún cliente coincide con "{{ busqueda.trim() }}".
    </p>

    <div v-else class="card border-0 recursos-panel">
      <div class="card-body">
        <p v-if="busqueda.trim()" class="small text-muted mb-2">
          {{ clientes_filtrados.length }} de {{ clientes.length }} clientes
        </p>
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0 recursos-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th class="text-end">Usuarios</th>
                <th>Avance promedio</th>
                <th class="text-end">Terminados</th>
                <th>Última actividad</th>
                <th class="text-end">Link del dueño</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="c in clientes_filtrados" :key="c.client_id">
                <tr>
                  <td>
                    <button
                      type="button"
                      class="btn btn-link btn-sm p-0 text-start"
                      :aria-expanded="abierto === c.client_id ? 'true' : 'false'"
                      @click="alternar_detalle(c)"
                    >
                      {{ abierto === c.client_id ? '▾' : '▸' }} {{ c.nombre }}
                    </button>
                  </td>
                  <td class="text-end" :class="{ 'text-muted': !c.usuarios }">{{ c.usuarios }}</td>
                  <td class="recursos-tabla__avance">
                    <div class="recursos-barra" :title="porcentaje_texto(c.avance)">
                      <div class="recursos-barra__relleno" :style="{ width: Math.min(100, c.avance) + '%' }" />
                    </div>
                    <span class="small text-muted">{{ porcentaje_texto(c.avance) }}</span>
                  </td>
                  <td class="text-end">{{ c.terminados }}</td>
                  <td class="small">{{ fecha_corta(c.ultima_actividad) }}</td>
                  <td class="text-end">
                    <button
                      type="button"
                      class="btn btn-outline-secondary btn-sm"
                      :disabled="copiando === c.client_id"
                      @click="copiar_link(c)"
                    >
                      <span v-if="copiando === c.client_id" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                      Copiar link del dueño
                    </button>
                  </td>
                </tr>
                <tr v-if="links[c.client_id]" class="recursos-tabla__detalle">
                  <td colspan="6">
                    <label class="form-label small text-muted mb-1" :for="'link-' + c.client_id">Link personal del dueño</label>
                    <input
                      :id="'link-' + c.client_id"
                      class="form-control form-control-sm"
                      type="text"
                      readonly
                      :value="links[c.client_id]"
                      @focus="$event.target.select()"
                    />
                  </td>
                </tr>
                <tr v-if="abierto === c.client_id" class="recursos-tabla__detalle">
                  <td colspan="6">
                    <div v-if="detalle_cargando" class="small text-muted">Cargando...</div>
                    <p v-else-if="!usuarios.length" class="small text-muted mb-0">Sin usuarios en el centro.</p>
                    <div v-else class="row g-3">
                      <div v-for="u in usuarios" :key="u.id" class="col-12 col-lg-6">
                        <div class="recursos-usuario">
                          <div class="d-flex flex-wrap justify-content-between gap-2 mb-2">
                            <div>
                              <b>{{ u.nombre }}</b>
                              <span v-if="u.es_dueno" class="badge text-bg-primary ms-1">Dueño</span>
                            </div>
                            <div class="small text-muted">
                              {{ porcentaje_texto(u.avance) }} · {{ u.terminados }} terminados · última actividad {{ fecha_corta(u.ultimo_ingreso) }}
                            </div>
                          </div>
                          <div v-for="carpeta in u.carpetas" :key="carpeta.nro" class="recursos-carpeta">
                            <span class="recursos-carpeta__nombre">{{ carpeta.nro }}. {{ carpeta.nombre }}</span>
                            <div class="recursos-barra recursos-barra--chica">
                              <div class="recursos-barra__relleno" :style="{ width: Math.min(100, carpeta.porcentaje) + '%' }" />
                            </div>
                            <span class="recursos-carpeta__cifra">
                              {{ porcentaje_texto(carpeta.porcentaje) }}
                              <template v-if="carpeta.total"> · {{ carpeta.terminados }}/{{ carpeta.total }}</template>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { campo, lista_de, numero, porcentaje_texto, fecha_corta, copiar_link_dueno, normalizar_texto } from './recursos_admin'

/**
 * Solapa "Clientes" del Centro de recursos: TODOS los clientes, también los que nunca entraron
 * (avance 0, sin usuarios), con su avance (`GET admin/recursos/clientes`), un buscador por
 * nombre (son decenas), el detalle por usuario y por carpeta
 * (`GET admin/recursos/clientes/{client_id}`) y, en cada fila, "Copiar link del dueño"
 * (`POST admin/recursos/clientes/{client_id}/link-dueno`).
 */
export default {
  name: 'PanelClientesRecursos',
  data() {
    return {
      /** Clientes normalizados (todos: también los que nunca entraron, con avance 0). */
      clientes: [],
      /** Texto del buscador por nombre. */
      busqueda: '',
      /** client_id con el detalle desplegado, o null. */
      abierto: null,
      /** Usuarios del cliente desplegado. */
      usuarios: [],
      /** true mientras se trae el detalle. */
      detalle_cargando: false,
      /** client_id cuyo link se está creando, o null. */
      copiando: null,
      /** Último link creado por client_id (se muestra para copiarlo a mano). */
      links: {},
      /** true mientras se carga la tabla. */
      cargando: false,
      /** Error de carga, o null. */
      error: null,
    }
  },
  computed: {
    /**
     * Clientes que coinciden con el buscador (por nombre o slug, sin acentos).
     * @returns {Array<Object>}
     */
    clientes_filtrados() {
      /** Búsqueda normalizada. */
      const q = normalizar_texto(this.busqueda.trim())
      if (!q) {
        return this.clientes
      }
      return this.clientes.filter(function (c) {
        return normalizar_texto(c.nombre + ' ' + (c.slug || '')).indexOf(q) !== -1
      })
    },
  },
  created() {
    this.cargar()
  },
  methods: {
    porcentaje_texto: porcentaje_texto,
    fecha_corta: fecha_corta,
    /**
     * Normaliza una fila de la lista de clientes.
     * @param {Object} c
     * @returns {Object}
     */
    normalizar_cliente(c) {
      return {
        client_id: campo(c, ['client_id', 'cliente.id', 'id']),
        nombre: campo(c, ['nombre', 'cliente', 'cliente.nombre', 'company_name', 'name'], '') || 'Cliente sin nombre',
        slug: campo(c, ['slug', 'cliente.slug'], ''),
        usuarios: numero(campo(c, ['usuarios', 'usuarios_count', 'cantidad_usuarios'], 0)),
        avance: numero(campo(c, ['avance_promedio', 'avance', 'porcentaje'], 0)),
        terminados: numero(campo(c, ['videos_terminados', 'terminados'], 0)),
        ultima_actividad: campo(c, ['ultima_actividad', 'ultima_actividad_at', 'ultimo_ingreso_at']),
      }
    },
    /**
     * Normaliza un usuario del detalle de un cliente.
     * @param {Object} u
     * @param {number} i Posición (por si no viene id).
     * @returns {Object}
     */
    normalizar_usuario(u, i) {
      /** Carpetas del usuario: lista, o mapa por número. */
      const crudas = u && u.carpetas
      /** Carpetas como lista. */
      const carpetas = Array.isArray(crudas) ? crudas : crudas && typeof crudas === 'object' ? Object.values(crudas) : []
      return {
        id: campo(u, ['id'], i),
        nombre: campo(u, ['nombre', 'name'], 'Usuario sin nombre'),
        es_dueno: !!campo(u, ['es_dueno'], false),
        avance: numero(campo(u, ['avance', 'porcentaje', 'avance_promedio'], 0)),
        terminados: numero(campo(u, ['terminados', 'videos_terminados'], 0)),
        ultimo_ingreso: campo(u, ['ultima_actividad', 'ultimo_ingreso_at', 'ultimo_ingreso']),
        carpetas: carpetas.map(function (c) {
          return {
            nro: campo(c, ['nro', 'carpeta']),
            nombre: campo(c, ['nombre'], ''),
            porcentaje: numero(campo(c, ['porcentaje', 'avance'], 0)),
            terminados: numero(campo(c, ['terminados'], 0)),
            total: numero(campo(c, ['total', 'videos'], 0)),
          }
        }),
      }
    },
    /**
     * Trae la lista de clientes.
     * @returns {void}
     */
    cargar() {
      const self = this
      self.cargando = true
      self.error = null
      api
        .get('/recursos/clientes', { silent_error: true })
        .then(function (res) {
          self.clientes = lista_de(res.data, ['clientes']).map(self.normalizar_cliente)
        })
        .catch(function (error) {
          self.error = resolve_error_message(error)
        })
        .then(function () {
          self.cargando = false
        })
    },
    /**
     * Despliega (o pliega) el detalle por usuario de un cliente.
     * @param {Object} c
     * @returns {void}
     */
    alternar_detalle(c) {
      const self = this
      if (self.abierto === c.client_id) {
        self.abierto = null
        return
      }
      self.abierto = c.client_id
      self.usuarios = []
      self.detalle_cargando = true
      api
        .get('/recursos/clientes/' + encodeURIComponent(c.client_id), { silent_error: true })
        .then(function (res) {
          if (self.abierto !== c.client_id) {
            return
          }
          self.usuarios = lista_de(res.data, ['usuarios']).map(self.normalizar_usuario)
        })
        .catch(function (error) {
          self.abierto = null
          window.dispatchEvent(
            new CustomEvent('admin-spa-toast', { detail: { message: resolve_error_message(error), variant: 'danger' } })
          )
        })
        .then(function () {
          self.detalle_cargando = false
        })
    },
    /**
     * Crea (o reusa) el link personal del dueño y lo copia.
     * @param {Object} c
     * @returns {void}
     */
    copiar_link(c) {
      const self = this
      self.copiando = c.client_id
      copiar_link_dueno(c.client_id)
        .then(function (r) {
          self.links[c.client_id] = r.url
        })
        .catch(function () {
          /* El toast ya lo mostró copiar_link_dueno. */
        })
        .then(function () {
          self.copiando = null
        })
    },
  },
}
</script>

<style scoped>
.recursos-panel {
  background: #ffffff;
  border: 1px solid #ededf0;
  border-radius: 0.75rem;
}
.recursos-tabla th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
  font-weight: 600;
  white-space: nowrap;
}
.recursos-clientes__buscar {
  width: 240px;
  max-width: 100%;
}
.recursos-tabla__avance {
  min-width: 160px;
}
.recursos-tabla__detalle td {
  background: #f8f9fa;
}
/* Barras en CSS a mano, como las de Tokens.vue: verde como en la página del centro. */
.recursos-barra {
  height: 8px;
  border-radius: 99px;
  background: #e6e8ec;
  overflow: hidden;
}
.recursos-barra--chica {
  height: 6px;
}
.recursos-barra__relleno {
  height: 100%;
  background: #16a34a;
  border-radius: 99px;
}
.recursos-usuario {
  background: #ffffff;
  border: 1px solid #ededf0;
  border-radius: 0.5rem;
  padding: 0.75rem;
}
.recursos-carpeta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 90px auto;
  gap: 8px;
  align-items: center;
  font-size: 0.8rem;
  padding: 2px 0;
}
.recursos-carpeta__nombre {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recursos-carpeta__cifra {
  color: #6c757d;
  white-space: nowrap;
}
</style>
