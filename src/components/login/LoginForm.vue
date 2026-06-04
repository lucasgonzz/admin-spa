<template>
  <!-- Formulario de credenciales con el mismo estilo visual que empresa-spa -->
  <div class="login-form login-form--modern">
    <div class="login-form__welcome">
      <h2 class="login-form__welcome-title">
        Bienvenido de nuevo
      </h2>
    </div>

    <!-- Campo de email del administrador -->
    <div class="login-form__field">
      <label class="login-form__label" for="login_email">
        Email
      </label>
      <div class="login-form__input-row">
        <span class="login-form__input-icon" aria-hidden="true">
          <svg class="login-form__icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
            />
          </svg>
        </span>
        <input
          id="login_email"
          v-model="email"
          class="form-control login-form__control"
          type="email"
          name="email"
          autocomplete="username"
          placeholder="Ingresá tu email"
          @keyup.enter="submit"
        />
      </div>
    </div>

    <!-- Campo de contraseña -->
    <div class="login-form__field">
      <label class="login-form__label" for="login_password">
        Contraseña
      </label>
      <div class="login-form__input-row">
        <span class="login-form__input-icon" aria-hidden="true">
          <svg class="login-form__icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="M18 8h-1V6a5 5 0 10-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 116 0v2H9V6z"
            />
          </svg>
        </span>
        <input
          id="login_password"
          v-model="password"
          class="form-control login-form__control"
          type="password"
          name="password"
          autocomplete="current-password"
          :placeholder="password_placeholder"
          @keyup.enter="submit"
        />
      </div>
    </div>

    <button
      type="button"
      class="btn btn-primary w-100 login-form__submit"
      :disabled="loading"
      @click="submit"
    >
      <span
        v-show="loading"
        class="spinner-border spinner-border-sm me-2"
        aria-hidden="true"
      />
      Iniciar sesión
    </button>

    <p v-if="error_message" class="login-form__error" role="alert">
      {{ error_message }}
    </p>
  </div>
</template>

<script>
import { get_first_nav_route } from '@/router/nav'

/**
 * Formulario de login del panel admin: credenciales email/contraseña y dispatch al store auth.
 */
export default {
  name: 'LoginForm',
  data() {
    return {
      /** Email ingresado por el administrador. */
      email: '',
      /** Contraseña ingresada por el administrador. */
      password: '',
      /** Mensaje de error visible bajo el botón de envío. */
      error_message: '',
      /** Indica que la petición de login está en curso. */
      loading: false,
    }
  },
  computed: {
    /**
     * Placeholder del campo contraseña (mismo tono que empresa-spa).
     *
     * @returns {string}
     */
    password_placeholder() {
      return 'Ingresá tu contraseña'
    },
  },
  methods: {
    /**
     * Valida campos obligatorios antes de llamar al backend.
     *
     * @returns {boolean}
     */
    check_fields() {
      if (!this.email.trim()) {
        this.error_message = 'Ingresá el email.'
        return false
      }
      if (!this.password) {
        this.error_message = 'Ingresá la contraseña.'
        return false
      }
      return true
    },
    /**
     * Envía credenciales al store auth y redirige tras login exitoso.
     *
     * @returns {void}
     */
    submit() {
      const self = this
      if (!self.check_fields() || self.loading) {
        return
      }
      self.error_message = ''
      self.loading = true
      self.$store
        .dispatch('auth/login', { email: self.email, password: self.password })
        .then(function () {
          const redirect_path = self.$route.query.redirect
          if (redirect_path) {
            self.$router.push(redirect_path)
          } else {
            const first_nav_route = get_first_nav_route()
            if (first_nav_route && first_nav_route.name) {
              self.$router.push({ name: first_nav_route.name })
            }
          }
          self.loading = false
        })
        .catch(function () {
          self.error_message = 'No se pudo ingresar. Verificá email y contraseña.'
          self.loading = false
        })
    },
  },
}
</script>

<style lang="scss">
.login-form--modern {
  padding: 2rem 1.75rem 1.75rem;

  @media screen and (min-width: 768px) {
    padding: 2.25rem 2rem 2rem;
  }
}

.login-form__welcome {
  margin-bottom: 1.5rem;
}

.login-form__welcome-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.35rem;
}

.login-form__field {
  margin-bottom: 1.15rem;
}

.login-form__label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.4rem;
}

.login-form__input-row {
  display: flex;
  align-items: center;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 0 0 0 0.65rem;
  border: 1px solid transparent;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.login-form__input-row:focus-within {
  border-color: rgba(0, 123, 255, 0.35);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.12);
}

.login-form__input-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  flex-shrink: 0;
  padding-right: 0.15rem;
}

.login-form__icon-svg {
  width: 20px;
  height: 20px;
  display: block;
}

.login-form__control {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding-left: 0.35rem !important;
  padding-right: 0.75rem !important;
  height: 46px !important;
  font-size: 0.95rem;
  color: #111827;
}

.login-form__control:focus {
  box-shadow: none !important;
}

.login-form__submit.btn {
  font-weight: 600;
  padding-top: 0.65rem;
  padding-bottom: 0.65rem;
  border-radius: 10px;
  margin-top: 0.15rem;
}

.login-form__submit.btn:disabled {
  opacity: 0.7;
}

.login-form__error {
  margin: 1rem 0 0;
  font-size: 0.875rem;
  color: #dc3545;
  text-align: center;
}
</style>
