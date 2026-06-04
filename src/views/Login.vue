<template>
  <!-- Vista de login: layout de página alineado a empresa-spa (marca, tarjeta, pie) -->
  <div class="login-page">
    <div class="login-page__inner">
      <header class="login-page__brand">
        <img src="@/assets/logo.jpg" alt="ComercioCity" />
        <p class="login-page__subtitle">
          {{ login_subtitle }}
        </p>
      </header>
      <div class="login-page__card">
        <login-form />
      </div>
      <p class="login-page__footer-note">
        Autenticación administrativa segura
      </p>
    </div>
  </div>
</template>

<script>
import LoginForm from '@/components/login/LoginForm.vue'

/**
 * Pantalla de ingreso al panel admin (contenedor visual + formulario).
 */
export default {
  name: 'ViewLogin',
  components: {
    LoginForm,
  },
  computed: {
    /**
     * Subtítulo bajo el logo (propósito del acceso).
     *
     * @returns {string}
     */
    login_subtitle() {
      return 'Acceso al panel de administración'
    },
  },
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem 1rem;
  box-sizing: border-box;
  overflow-x: hidden;
}

.login-page__inner {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-page__brand {
  text-align: center;
  margin-bottom: 1.75rem;
}

.login-page__brand img {
  margin: 0 auto 1rem;
  width: 120px;
  border-radius: 50%;
  display: block;
}

.login-page__subtitle {
  font-size: 0.95rem;
  color: #6b7280;
  margin: 0;
}

.login-page__card {
  width: 100%;
  background: #ffffff;
  border-radius: 12px;
  box-shadow:
    0 10px 40px rgba(17, 24, 39, 0.08),
    0 2px 10px rgba(17, 24, 39, 0.04);
  padding: 0;
  overflow: hidden;
}

.login-page__footer-note {
  margin-top: 1.75rem;
  font-size: 1rem;
  color: #9ca3af;
  text-align: center;
}
</style>
