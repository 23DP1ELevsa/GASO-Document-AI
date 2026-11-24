<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import AuthField from '../components/AuthField.vue'
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
const formElement = ref(null)
const errors = ref({})
const message = ref('')
const busy = ref(false)
const retrySession = () => location.reload()

const passwordMinimum = 12
const passwordMaximum = 1024
// Laravel uses mb_strlen for string length and PHP trim to check required fields.
const characterCount = (value) => Array.from(value).length
// eslint-disable-next-line no-control-regex
const phpTrim = (value) => value.replace(/^[\x00\t\n\v\r ]+|[\x00\t\n\v\r ]+$/g, '')
const passwordLength = computed(() => characterCount(form.password))
const validPasswordLength = computed(
  () => passwordLength.value >= passwordMinimum && passwordLength.value <= passwordMaximum,
)
const passwordsMatch = computed(
  () => form.password !== '' && form.password === form.password_confirmation,
)
const requirements = computed(() => [
  {
    id: 'password-length',
    label: `Vismaz ${passwordMinimum} rakstzīmes (maksimāli ${passwordMaximum}).`,
    met: validPasswordLength.value,
  },
  { id: 'password-match', label: 'Abas paroles sakrīt.', met: passwordsMatch.value },
])

function clearError(field) {
  delete errors.value[field]
  if (field === 'password') delete errors.value.password_confirmation
}

function validate(emailInput) {
  const invalid = {}
  const required = 'Aizpildiet šo lauku.'
  const tooLong = (limit) => `Lauks drīkst saturēt ne vairāk kā ${limit} rakstzīmes.`
  const email = phpTrim(form.email).toLowerCase()

  if (registration.value) {
    for (const name of ['firstName', 'lastName']) {
      const value = phpTrim(form[name])
      if (!value) invalid[name] = [required]
      else if (characterCount(value) > 80) invalid[name] = [tooLong(80)]
    }
  }

  if (!email) invalid.email = [required]
  else if (characterCount(email) > 254) invalid.email = [tooLong(254)]
  else if (emailInput.validity.typeMismatch)
    invalid.email = ['Ievadiet derīgu darba e-pasta adresi.']
  else if (registration.value && !email.endsWith('@gaso.lv')) {
    invalid.email = ['Izmantojiet GASO darba e-pastu ar domēnu @gaso.lv.']
  }

  if (!phpTrim(form.password)) invalid.password = [required]
  else if (passwordLength.value > passwordMaximum) invalid.password = [tooLong(passwordMaximum)]
  else if (registration.value && passwordLength.value < passwordMinimum) {
    invalid.password = [`Parolei jābūt vismaz ${passwordMinimum} rakstzīmes garai.`]
  }

  if (registration.value) {
    if (!form.password_confirmation) invalid.password_confirmation = [required]
    else if (!passwordsMatch.value) invalid.password_confirmation = ['Paroles nesakrīt.']
  }
  return invalid
}

async function focusInvalid() {
  await nextTick()
  formElement.value?.querySelector('input[aria-invalid="true"]')?.focus()
}

async function submit(event) {
  if (busy.value) return
  message.value = ''
  // Read the form to include values supplied by password managers and WebView autofill.
  const values = Object.fromEntries(new FormData(event.currentTarget))
  Object.assign(form, values)
  errors.value = validate(event.currentTarget.elements.email)
  if (Object.keys(errors.value).length) return focusInvalid()

  busy.value = true
  try {
    await enterAccount(registration.value ? 'register' : 'login', values)
  } catch (error) {
    busy.value = false
    if (error.fields) {
      errors.value = error.fields
      await focusInvalid()
    } else {
      message.value = error.message
    }
  }
}

let focusFrame
function revealFocusedField() {
  cancelAnimationFrame(focusFrame)
  focusFrame = requestAnimationFrame(() => {
    const input = document.activeElement
    const viewport = window.visualViewport
    if (!(input instanceof HTMLInputElement) || !formElement.value?.contains(input)) return
    if (viewport && viewport.scale !== 1) return
    const top = (viewport?.offsetTop ?? 0) + 16
    const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 16
    const bounds = input.getBoundingClientRect()
    if (bounds.bottom > bottom) window.scrollBy(0, bounds.bottom - bottom)
    else if (bounds.top < top) window.scrollBy(0, bounds.top - top)
  })
}
onMounted(() => window.visualViewport?.addEventListener('resize', revealFocusedField))
onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', revealFocusedField)
  cancelAnimationFrame(focusFrame)
})
</script>

<template>
  <section class="auth-view" :class="{ 'auth-view-register': registration }">
    <PageHeading
      class="auth-heading"
      :title="registration ? 'Izveidojiet kontu' : 'Laipni lūdzam!'"
      :description="
        registration
          ? 'Reģistrējieties ar savu GASO darba e-pastu.'
          : 'Pieslēdzieties savai dokumentu darba videi.'
      "
    />
    <div v-if="message || sessionMessage" class="auth-notice" role="alert">
      <p>{{ message || sessionMessage }}</p>
      <button v-if="sessionMessage && !message" type="button" @click="retrySession">
        Pārbaudīt sesiju vēlreiz
      </button>
    </div>

    <form
      ref="formElement"
      class="auth-form"
      novalidate
      @submit.prevent="submit"
      @focusin="revealFocusedField"
    >
      <div v-if="registration" class="auth-names">
        <AuthField
          v-model="form.firstName"
          name="firstName"
          label="Vārds"
          autocomplete="given-name"
          autocapitalize="words"
          enterkeyhint="next"
          :errors="errors.firstName"
          @update:model-value="clearError('firstName')"
        />
        <AuthField
          v-model="form.lastName"
          name="lastName"
          label="Uzvārds"
          autocomplete="family-name"
          autocapitalize="words"
          enterkeyhint="next"
          :errors="errors.lastName"
          @update:model-value="clearError('lastName')"
        />
      </div>

      <AuthField
        v-model="form.email"
        name="email"
        label="Darba e-pasts"
        type="email"
        icon="mail"
        placeholder="vards.uzvards@gaso.lv"
        autocomplete="username"
        inputmode="email"
        autocapitalize="none"
        spellcheck="false"
        enterkeyhint="next"
        :description="registration ? 'Izmantojiet darba e-pastu ar domēnu @gaso.lv.' : ''"
        :errors="errors.email"
        @update:model-value="clearError('email')"
      />

      <div class="auth-password">
        <AuthField
          v-model="form.password"
          name="password"
          label="Parole"
          type="password"
          icon="lock"
          :autocomplete="registration ? 'new-password' : 'current-password'"
          :enterkeyhint="registration ? 'next' : 'go'"
          autocapitalize="none"
          spellcheck="false"
          :described-by="registration ? 'password-length' : ''"
          :errors="errors.password"
          @update:model-value="clearError('password')"
        />
        <div v-if="registration" class="auth-requirements">
          <h2>Paroles prasības</h2>
          <ul aria-live="polite">
            <li
              v-for="requirement in requirements"
              :key="requirement.id"
              :class="{ 'auth-rule-met': requirement.met }"
            >
              <AppIcon :name="requirement.met ? 'circleCheck' : 'circle'" size="16" />
              <span :id="requirement.id">
                {{ requirement.label }}
                <span class="sr-only">{{ requirement.met ? 'Izpildīta.' : 'Vēl jāizpilda.' }}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <AuthField
        v-if="registration"
        v-model="form.password_confirmation"
        name="password_confirmation"
        label="Paroles apstiprinājums"
        type="password"
        icon="lock"
        autocomplete="new-password"
        enterkeyhint="go"
        autocapitalize="none"
        spellcheck="false"
        described-by="password-match"
        :errors="errors.password_confirmation"
        @update:model-value="clearError('password_confirmation')"
      />

      <button class="auth-submit" type="submit" :disabled="busy" :aria-busy="busy">
        <v-progress-circular v-if="busy" indeterminate size="20" width="2" aria-hidden="true" />
        {{ registration ? 'Izveidot kontu' : 'Pieslēgties' }}
        <AppIcon v-if="!busy" name="arrow" size="20" />
      </button>
    </form>

    <p class="auth-switch">
      <span>{{ registration ? 'Jums jau ir konts?' : 'Vēl nav konta?' }}</span>
      <RouterLink :to="{ name: registration ? 'login' : 'register' }">
        {{ registration ? 'Pieslēgties' : 'Reģistrēties' }}
      </RouterLink>
    </p>
  </section>
</template>

<style scoped>
.auth-view {
  --auth-gap: 18px;
  min-width: 0;
  padding-top: clamp(36px, 7.5dvh, 64px);
  container-type: inline-size;
}
.auth-view-register {
  --auth-gap: 13px;
  padding-top: 24px;
}
.auth-heading {
  gap: 6px;
  margin-bottom: 28px;
}
.auth-view-register .auth-heading {
  margin-bottom: 20px;
}
.auth-heading :deep(h1) {
  font-size: clamp(1.875rem, 8.3vw, 2.25rem);
  letter-spacing: -0.055em;
}
.auth-heading :deep(p) {
  font-size: var(--text-body);
  text-wrap: pretty;
}
.auth-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--auth-gap);
}
.auth-names {
  display: grid;
  gap: var(--auth-gap);
  grid-template-columns: minmax(0, 1fr);
}
@container (min-width: 320px) {
  .auth-names {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    column-gap: 12px;
  }
}
.auth-password {
  display: grid;
  gap: 8px;
}
.auth-requirements {
  display: grid;
  gap: 4px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--soft);
  font-size: var(--text-small);
}
.auth-requirements h2 {
  font-size: inherit;
  letter-spacing: normal;
}
.auth-requirements ul {
  display: grid;
  gap: 2px;
  padding: 0;
  list-style: none;
}
.auth-requirements li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--muted);
}
.auth-requirements li svg {
  flex: none;
  margin-top: 2px;
}
.auth-requirements .auth-rule-met {
  color: var(--green-text);
}
.auth-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 54px;
  margin-top: 6px;
  padding: 10px 16px;
  border-radius: 14px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  box-shadow: var(--shadow-cta);
  font-weight: 800;
}
.auth-submit:hover:not(:disabled) {
  filter: brightness(0.92);
}
.auth-submit:disabled {
  opacity: 0.8;
}
.auth-switch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  column-gap: 4px;
  margin-top: 24px;
  padding-top: 4px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: var(--text-label);
}
.auth-view-register .auth-switch {
  margin-top: 14px;
}
.auth-switch a,
.auth-notice button {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding-inline: 6px;
  color: var(--accent-text);
  font-weight: 800;
}
.auth-switch a:hover,
.auth-notice button:hover {
  text-decoration: underline;
}
.auth-notice {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid rgba(var(--v-theme-error), 0.28);
  border-radius: var(--radius-control);
  color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), 0.08);
  font-size: var(--text-label);
}
</style>
