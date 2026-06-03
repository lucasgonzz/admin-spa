<template>
  <div class="container py-4">
    <base-card class="mx-auto" card_class="mx-auto" style="max-width: 24rem">
      <h1 class="h4 mb-3">Ingreso admin</h1>
      <form @submit.prevent="submit">
        <base-input
          input_id="e"
          v-model="email"
          label="Email"
          :required="true"
          autocomplete="username"
        />
        <base-input
          input_id="p"
          v-model="password"
          type="password"
          label="Contraseña"
          :required="true"
          autocomplete="current-password"
        />
        <base-button
          type="submit"
          button_class="btn-primary w-100"
          :disabled="loading"
        >
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </base-button>
        <p v-if="err" class="text-danger small mt-2 mb-0">{{ err }}</p>
      </form>
    </base-card>
  </div>
</template>

<script>
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import { get_first_nav_route } from '@/router/nav'

/**
 * Login: token en localStorage vía store auth.
 */
export default {
  name: 'ViewLogin',
  components: {
    BaseInput,
    BaseButton,
    BaseCard,
  },
  data() {
    return {
      email: '',
      password: '',
      err: '',
      loading: false,
    }
  },
  methods: {
    submit() {
      const self = this
      self.err = ''
      self.loading = true
      this.$store
        .dispatch('auth/login', { email: this.email, password: this.password })
        .then(function () {
          const r = self.$route.query.redirect
          if (r) {
            self.$router.push(r)
          } else {
            const first_nav_route = get_first_nav_route()
            if (first_nav_route && first_nav_route.name) {
              self.$router.push({ name: first_nav_route.name })
            }
          }
          self.loading = false
        })
        .catch(function () {
          self.err = 'No se pudo ingresar.'
          self.loading = false
        })
    },
  },
}
</script>
