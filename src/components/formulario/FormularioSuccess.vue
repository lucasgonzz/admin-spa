<template>
  <!-- Pantalla de felicitación que se muestra cuando el formulario fue enviado -->
  <div class="formulario-success">
    <div class="formulario-success__card">
      <!-- Ícono visual de éxito -->
      <div class="formulario-success__icon">
        <i class="bi bi-check-circle-fill"></i>
      </div>

      <!-- Título personalizado con el nombre del cliente -->
      <h1 class="formulario-success__title">
        ¡Listo<template v-if="client_name">, {{ client_name }}</template>!
      </h1>

      <!-- Mensaje de confirmación -->
      <p class="formulario-success__body">
        Recibimos toda la información de tu empresa.
      </p>

      <p class="formulario-success__body">
        Martín se va a poner en contacto con vos por WhatsApp en breve para contarte los próximos pasos.
      </p>

      <p class="formulario-success__footer">
        ¡Gracias por confiar en ComercioCity!
      </p>
    </div>
  </div>
</template>

<script>
/**
 * Pantalla de éxito que se muestra cuando el formulario fue enviado correctamente
 * o cuando el cliente vuelve a abrir el link después de haberlo enviado.
 *
 * @prop {string} client_name - Nombre del cliente para personalizar el mensaje.
 */
export default {
  name: 'FormularioSuccess',

  props: {
    /**
     * Nombre del cliente para personalizar el título del mensaje de éxito.
     * Si no se provee, se omite el nombre del título.
     */
    client_name: {
      type: String,
      default: '',
    },
  },
}
</script>

<style scoped>
/* Pantalla completa centrada */
.formulario-success {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: linear-gradient(180deg, #eef2ff 0%, #f8f9fc 50%, #f0f4f8 100%);
}

/* Tarjeta central del mensaje */
.formulario-success__card {
  max-width: 480px;
  width: 100%;
  text-align: center;
  padding: 40px 32px;
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(13, 110, 253, 0.08);
  box-shadow: 0 8px 32px rgba(13, 110, 253, 0.1);
}

/* Ícono grande en color de éxito */
.formulario-success__icon {
  font-size: 3.5rem;
  color: #198754;
  margin-bottom: 20px;
}

/* Título principal */
.formulario-success__title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #212529;
  margin-bottom: 16px;
}

/* Párrafos del mensaje */
.formulario-success__body {
  font-size: 1rem;
  color: #495057;
  line-height: 1.6;
  margin-bottom: 12px;
}

/* Cierre del mensaje */
.formulario-success__footer {
  font-size: 1rem;
  font-weight: 600;
  color: var(--bs-primary);
  margin-top: 20px;
  margin-bottom: 0;
}
</style>
