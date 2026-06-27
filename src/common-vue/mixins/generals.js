import moment from 'moment'

/**
 * Mixins comunes: helpers de formato reutilizables en tablas y vistas.
 */
export default {
  methods: {
    /**
     * Nombre de ruta / modelo en formato string.
     * @param {string} model_name
     * @returns {string}
     */
    route_string(model_name) {
      return model_name
    },
    /**
     * Formatea una fecha ISO/SQL a texto legible (DD/MM/YY).
     * Con `complete` incluye hora, minutos y segundos.
     *
     * @param {string|Date|null} d valor de fecha del modelo
     * @param {boolean} complete si debe incluir hora completa
     * @returns {string}
     */
    date(d, complete = false) {
      if (d) {
        if (complete) {
          return moment(d).format('DD/MM/YY h:mm:ss')
        }
        return moment(d).format('DD/MM/YY')
      }
      return ''
    },
    /**
     * Formatea una fecha con abreviatura del día de la semana en español.
     * Usado por columnas con `type: 'day'` (p. ej. Fecha demo en leads).
     *
     * @param {string|Date|null} d valor de fecha del modelo
     * @returns {string} texto tipo `24/06/26 (Mar)` o cadena vacía si no hay fecha
     */
    date_with_weekday(d) {
      if (!d) return ''
      // Abreviaturas en español alineadas con moment.day() (0 = domingo).
      var weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      var m = moment(d)
      var weekday = weekdays[m.day()]
      return m.format('DD/MM/YY') + ' (' + weekday + ')'
    },
  },
}
