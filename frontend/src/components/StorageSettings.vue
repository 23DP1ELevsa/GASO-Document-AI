<script setup>
import { computed, onMounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { createBackup, restoreBackup } from '../features/storage/backup.js'
import { setSyncEnabled } from '../features/storage/queue.js'
import {
  cancelStorage,
  checkStorage,
  conflictingEntries,
  migrateLocal,
  resolveConflict,
  restoreFromServer,
  serverStorageEnabled,
  storageAction,
  storageConnection,
  syncEntries,
  syncNow,
} from '../features/storage/sync.js'

const feedback = ref('')
const failed = ref(false)
const checking = ref(false)
const backupBusy = ref(false)
const backupInput = ref(null)
const running = computed(() => Boolean(storageAction.value) || backupBusy.value || checking.value)
const modal = computed(() => ['migration', 'restore'].includes(storageAction.value))
const details = {
  connected: 'Savienots ar MongoDB',
  unchecked: 'Pārbauda savienojumu…',
  storage_disabled: 'Servera glabāšana Laravel iestatījumos ir izslēgta.',
  storage_not_configured: 'Pārbaudiet MongoDB iestatījumus Laravel .env failā.',
  storage_driver_missing: 'PHP nepieciešams MongoDB paplašinājums.',
  storage_unavailable: 'MongoDB savienojums nav pieejams.',
  access_denied: 'Servera glabāšana pieejama localhost.',
  sync_busy: 'Notiek sinhronizācija. Mēģiniet vēlreiz pēc tās pabeigšanas.',
  revision_conflict: 'Servera versija ir mainījusies. Pārbaudiet konfliktu vēlreiz.',
  local_revision_conflict: 'Lokālā versija ir mainījusies. Pārbaudiet konfliktu vēlreiz.',
  input_too_large: 'Pārsniegts servera augšupielādes izmēra limits.',
  invalid_input:
    'Serveris noraidīja nosūtītos datus. Pārbaudiet faila izmēru un PHP augšupielādes iestatījumus.',
  invalid_image: 'Serveris noraidīja attēla formātu vai izmērus.',
  image_integrity_error: 'Attēla izmērs, formāts vai kontrolsumma nesakrīt.',
  local_data_missing: 'Lokālajam ierakstam trūkst datu vai attēlu.',
  invalid_backup: 'Rezerves kopijas fails ir nederīgs.',
  backup_requires_empty: 'Rezerves kopiju var atvērt tukšā pārlūka profilā.',
}
const firstError = computed(
  () => syncEntries.value.find((entry) => entry.status === 'error')?.error,
)
const pending = computed(
  () =>
    syncEntries.value.filter((entry) => ['pending', 'syncing', 'error'].includes(entry.status))
      .length,
)

function showError(error) {
  failed.value = true
  feedback.value = details[error.code] || 'Darbību neizdevās pabeigt. Mēģiniet vēlreiz.'
}
async function connection() {
  checking.value = true
  try {
    await checkStorage()
  } finally {
    checking.value = false
  }
}
onMounted(connection)

function switchMode(event) {
  feedback.value = ''
  try {
    const enabled = !serverStorageEnabled.value
    if (enabled && !window.confirm('Ieslēgt automātisku turpmāko izmaiņu augšupielādi MongoDB?'))
      return
    setSyncEnabled(enabled)
  } catch (error) {
    showError(error)
  } finally {
    event.target.checked = serverStorageEnabled.value
  }
}

async function run(work, success) {
  failed.value = false
  feedback.value = ''
  try {
    const value = await work()
    if (success) feedback.value = success(value)
  } catch (error) {
    if (error.name === 'AbortError')
      feedback.value = 'Darbība apturēta. Nepabeigtos ierakstus var sinhronizēt atkārtoti.'
    else showError(error)
  }
}

function migrate() {
  if (
    window.confirm(
      'Augšupielādēt šajā ierīcē saglabātās sesijas, komplektus un fotoattēlus uz MongoDB?',
    )
  )
    run(migrateLocal)
}

function resolve(entry, choice) {
  return run(() =>
    resolveConflict(entry, choice, (remote) => {
      const label = remote.updatedAt
        ? ' (' + new Date(remote.updatedAt).toLocaleString('lv-LV') + ')'
        : ''
      let question = remote.deleted
        ? 'Serverī ieraksts ir dzēsts.'
        : 'Servera revīzija ' + remote.revision + label + '.'
      question +=
        choice === 'device'
          ? ' Aizstāt servera stāvokli ar ierīces stāvokli?'
          : ' Aizstāt ierīces stāvokli ar servera stāvokli? Vispirms varat izveidot lokālu rezerves kopiju.'
      return window.confirm(question)
    }),
  )
}

function backup() {
  backupBusy.value = true
  return run(async () => {
    const url = URL.createObjectURL(await createBackup())
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'gaso-dokumenti-' + new Date().toISOString().slice(0, 10) + '.gaso-backup'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }).finally(() => {
    backupBusy.value = false
  })
}

function importBackup(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  backupBusy.value = true
  run(
    () => restoreBackup(file),
    () => 'Lokālā rezerves kopija atjaunota.',
  ).finally(() => {
    backupBusy.value = false
  })
}
</script>

<template>
  <h2 class="settings-label">Datu glabāšana</h2>
  <v-card class="settings-card bordered-card">
    <p role="status">{{ details[storageConnection] || details.storage_unavailable }}</p>
    <v-btn variant="text" :disabled="running" @click="connection">Pārbaudīt savienojumu</v-btn>
    <label class="analysis-consent">
      <input type="checkbox" :checked="serverStorageEnabled" @change="switchMode" />
      Sinhronizēt turpmākās izmaiņas ar MongoDB
    </label>
    <p v-if="pending" role="status">Rindā {{ pending }} ieraksti.</p>
    <p v-if="firstError" role="alert">
      {{ details[firstError] || 'Sinhronizācija pārtrūka. Mēģiniet vēlreiz.' }}
    </p>
    <div class="storage-actions">
      <v-btn variant="tonal" :disabled="running" @click="backup"
        >Lejupielādēt lokālo rezerves kopiju</v-btn
      >
      <v-btn variant="text" :disabled="running" @click="backupInput.click()"
        >Atvērt lokālo rezerves kopiju</v-btn
      >
      <input ref="backupInput" hidden type="file" accept=".gaso-backup" @change="importBackup" />
      <v-btn variant="tonal" :disabled="running || !serverStorageEnabled" @click="migrate"
        >Migrēt lokālos dokumentus</v-btn
      >
      <v-btn variant="text" :disabled="running || !serverStorageEnabled" @click="run(syncNow)"
        >Sinhronizēt tagad</v-btn
      >
      <v-btn
        variant="tonal"
        :disabled="running"
        @click="run(restoreFromServer, (count) => 'Atjaunoti ' + count + ' ieraksti.')"
        >Atjaunot no MongoDB</v-btn
      >
      <v-btn v-if="storageAction === 'sync'" variant="text" @click="cancelStorage"
        >Apturēt sinhronizāciju</v-btn
      >
    </div>
    <p v-if="feedback" :role="failed ? 'alert' : 'status'">{{ feedback }}</p>
    <section v-if="conflictingEntries.length">
      <h3>Datu konflikti</h3>
      <article v-for="entry in conflictingEntries" :key="entry.id" class="storage-conflict">
        <p>{{ entry.kind === 'sessions' ? 'Sesija' : 'Komplekts' }} {{ entry.rootId }}</p>
        <v-btn
          variant="text"
          :disabled="running || !serverStorageEnabled"
          @click="resolve(entry, 'device')"
          >Paturēt ierīces versiju</v-btn
        >
        <v-btn variant="text" :disabled="running" @click="resolve(entry, 'server')"
          >Ielādēt servera versiju</v-btn
        >
      </article>
    </section>
  </v-card>
  <v-dialog
    :model-value="modal"
    persistent
    max-width="370"
    class="ai-overlay"
    aria-labelledby="storage-operation"
  >
    <v-card class="ai-progress-card" role="status" aria-live="polite" aria-busy="true">
      <span class="ai-orbit"><AppIcon name="documents" :size="32" /></span>
      <h2 id="storage-operation">
        {{ storageAction === 'restore' ? 'Atjauno dokumentus…' : 'Augšupielādē dokumentus…' }}
      </h2>
      <v-progress-linear
        indeterminate
        rounded
        height="6"
        color="primary"
        aria-label="Datu glabāšanas progress"
      />
      <v-btn variant="text" @click="cancelStorage">Apturēt</v-btn>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.storage-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}
.storage-conflict {
  padding-block: var(--space-8);
  overflow-wrap: anywhere;
}
</style>
