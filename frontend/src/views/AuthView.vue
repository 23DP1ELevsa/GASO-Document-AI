<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { VForm, VTextField } from 'vuetify/components'
import PageHeading from '../components/PageHeading.vue'
import { enterAccount, sessionMessage } from '../features/auth/session.js'

const route = useRoute()
const registration = computed(() => route.name === 'register')
const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  password_confirmation: '',
})
const errors = ref({})
const message = ref('')
const busy = ref(false)
const retrySession = () => location.reload()

async function submit() {
  if (busy.value) return
  busy.value = true
  errors.value = {}
  message.value = ''
  try {
    const { email, password } = form
    await enterAccount(
      registration.value ? 'register' : 'login',
      registration.value ? form : { email, password },
    )
  } catch (error) {
    errors.value = error.fields || {}
    if (!error.fields) message.value = error.message
    busy.value = false
  }
}
</script>

<template>
  <section class="account-card">
    <PageHeading :title="registration ? 'Reģistrēties' : 'Pieslēgties'" />
    <v-alert v-if="message || sessionMessage" type="warning" variant="tonal" class="mb-4">
      {{ message || sessionMessage }}
      <v-btn v-if="sessionMessage && !message" variant="text" size="small" @click="retrySession">
        Pārbaudīt sesiju vēlreiz
      </v-btn>
    </v-alert>
    <v-form novalidate @submit.prevent="submit">
      <div v-if="registration" class="account-name">
        <v-text-field
          v-model="form.firstName"
          label="Vārds"
          autocomplete="given-name"
          :error-messages="errors.firstName"
          maxlength="80"
          required
        />
        <v-text-field
          v-model="form.lastName"
          label="Uzvārds"
          autocomplete="family-name"
          :error-messages="errors.lastName"
          maxlength="80"
          required
        />
      </div>
      <v-text-field
        v-model="form.email"
        label="Darba e-pasts"
        type="email"
        autocomplete="username"
        :error-messages="errors.email"
        maxlength="254"
        required
      />
      <v-text-field
        v-model="form.password"
        label="Parole"
        type="password"
        :autocomplete="registration ? 'new-password' : 'current-password'"
        :error-messages="errors.password"
        required
      />
      <v-text-field
        v-if="registration"
        v-model="form.password_confirmation"
        label="Paroles apstiprinājums"
        type="password"
        autocomplete="new-password"
        required
      />
      <v-btn type="submit" color="primary" block :loading="busy">
        {{ registration ? 'Reģistrēties' : 'Pieslēgties' }}
      </v-btn>
    </v-form>
    <p class="mt-4 mb-0">
      <RouterLink :to="{ name: registration ? 'login' : 'register' }">
        {{ registration ? 'Uz pieslēgšanos' : 'Izveidot kontu' }}
      </RouterLink>
    </p>
  </section>
</template>

<style scoped>
.account-card {
  max-width: 32rem;
  margin: 1.5rem auto;
}
.account-name {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: 0 1rem;
}
</style>
