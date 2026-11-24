<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { VAvatar, VForm, VTextField } from 'vuetify/components'
import PageHeading from '../components/PageHeading.vue'
import { account } from '../features/auth/scope.js'
import { accountAction, logoutAccount } from '../features/auth/session.js'
import { listDrafts } from '../features/scanning/draftRepository.js'
import { useScanSession } from '../features/scanning/useScanSession.js'
import { listCollections, loadCollection } from '../features/documents/collections.js'

const user = account.value
const session = useScanSession()
const initials = [user.firstName, user.lastName]
  .map((name) => [...name][0]?.toLocaleUpperCase('lv'))
  .join('')
const createdAt = user.createdAt
  ? new Intl.DateTimeFormat('lv-LV', { dateStyle: 'long' }).format(new Date(user.createdAt))
  : '—'
const local = ref(null)
const remote = ref(null)
const form = reactive({ current_password: '', password: '', password_confirmation: '' })
const errors = ref({})
const message = ref('')
const success = ref('')
const action = ref('')
const busy = computed(() => Boolean(action.value))

onMounted(async () => {
  const localCounts = Promise.all([listDrafts(), listCollections()]).then(
    async ([drafts, collections]) => {
      const documents = new Set(
        drafts.flatMap((draft) =>
          (draft.documents || [])
            .filter((document) => document.pageIds.length)
            .map((document) => JSON.stringify([draft.id, document.id])),
        ),
      )
      for (const collection of await Promise.all(collections.map(({ id }) => loadCollection(id)))) {
        for (const document of collection.documents)
          documents.add(JSON.stringify([document.sessionId, document.originalDocumentId]))
      }
      local.value = { documents: documents.size, collections: collections.length }
    },
  )
  const remoteCounts = accountAction('stats').then((counts) => {
    remote.value = counts
  })
  await Promise.allSettled([localCounts, remoteCounts])
})

async function run(name, work) {
  if (busy.value) return
  action.value = name
  message.value = ''
  success.value = ''
  errors.value = {}
  try {
    await work()
  } catch (error) {
    errors.value = error.fields || {}
    if (!error.fields) message.value = error.message
  } finally {
    action.value = ''
  }
}

const password = () =>
  run('password', async () => {
    await accountAction('password', { method: 'PUT', data: form })
    for (const field of Object.keys(form)) form[field] = ''
    success.value = 'Parole mainīta. Pārējās konta sesijas ir atsauktas.'
  })

const revoke = () =>
  run('revoke', async () => {
    await accountAction('sessions/revoke', { method: 'POST' })
    success.value = 'Pārējās konta sesijas ir atsauktas.'
  })

const logout = () =>
  run('logout', async () => {
    if (session.busy.value)
      throw new Error('Pagaidiet, līdz pašreizējā dokumenta darbība ir pabeigta.')
    if (session.dirty.value) await session.save()
    await logoutAccount()
  })
</script>

<template>
  <section class="profile">
    <PageHeading title="Mans profils" />
    <v-card variant="outlined" class="pa-4 mb-4">
      <div class="profile-identity">
        <v-avatar color="primary" size="52" aria-hidden="true">{{ initials }}</v-avatar>
        <div>
          <h2>{{ user.firstName }} {{ user.lastName }}</h2>
          <p>{{ user.email }}</p>
        </div>
      </div>
      <dl class="profile-details">
        <div>
          <dt>Konts izveidots</dt>
          <dd>{{ createdAt }}</dd>
        </div>
        <div>
          <dt>Dokumenti ierīcē</dt>
          <dd>{{ local?.documents ?? '—' }}</dd>
        </div>
        <div>
          <dt>Komplekti ierīcē</dt>
          <dd>{{ local?.collections ?? '—' }}</dd>
        </div>
        <div v-if="remote">
          <dt>Dokumenti serverī</dt>
          <dd>{{ remote.documents }}</dd>
        </div>
        <div v-if="remote">
          <dt>Komplekti serverī</dt>
          <dd>{{ remote.collections }}</dd>
        </div>
      </dl>
    </v-card>
    <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
    <v-alert v-if="success" type="success" variant="tonal" class="mb-4" role="status">{{
      success
    }}</v-alert>
    <v-card variant="outlined" class="pa-4 mb-4">
      <h2 class="mb-4">Mainīt paroli</h2>
      <v-form novalidate @submit.prevent="password">
        <v-text-field
          v-model="form.current_password"
          label="Pašreizējā parole"
          type="password"
          autocomplete="current-password"
          :error-messages="errors.current_password"
          required
        />
        <v-text-field
          v-model="form.password"
          label="Jaunā parole"
          type="password"
          autocomplete="new-password"
          :error-messages="errors.password"
          required
        />
        <v-text-field
          v-model="form.password_confirmation"
          label="Jaunās paroles apstiprinājums"
          type="password"
          autocomplete="new-password"
          required
        />
        <v-btn type="submit" color="primary" :disabled="busy" :loading="action === 'password'"
          >Mainīt paroli</v-btn
        >
      </v-form>
    </v-card>
    <div class="profile-actions">
      <v-btn variant="outlined" :disabled="busy" :loading="action === 'revoke'" @click="revoke"
        >Atsaukt pārējās sesijas</v-btn
      >
      <v-btn color="primary" :disabled="busy" :loading="action === 'logout'" @click="logout"
        >Izrakstīties</v-btn
      >
    </div>
  </section>
</template>

<style scoped>
.profile {
  max-width: 40rem;
  margin-inline: auto;
}
.profile-identity,
.profile-actions,
.profile-details {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}
.profile-identity > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.profile-details {
  margin-top: 1rem;
}
.profile-details dd {
  font-weight: 700;
}
</style>
