<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useScanSession } from '../features/scanning/useScanSession.js'
import { t } from '../locales'
import {
  listCollections,
  createCollection,
  loadCollection,
  updateCollection,
  removeCollectionDocument,
  deleteCollection,
} from '../features/documents/collections.js'
import { readImageRecord } from '../features/scanning/draftRepository.js'
import { createPdfService } from '../features/pdf/pdfService.js'
import { collectionSnapshot } from '../features/pdf/collectionSnapshot.js'
import BlobImage from '../components/BlobImage.vue'
const route = useRoute()
const router = useRouter(),
  scanSession = useScanSession()
async function startScan() {
  if (busy.value || scanSession.busy.value) return
  if (scanSession.dirty.value && !window.confirm(t('scan.confirmDiscard'))) return
  scanSession.newSession()
  await router.push('/scan')
}
const items = ref([]),
  current = ref(null),
  name = ref(''),
  editingName = ref(''),
  creating = ref(false),
  error = ref(''),
  busy = ref(false),
  progress = ref(''),
  scansOnly = ref(false),
  pdfUrl = ref(''),
  filename = ref('')
const service = createPdfService({
  readImage: async (page) => {
    const image = await readImageRecord(page.imageRecordId)
    return image.processed || image.blob
  },
})
function closeCollection() {
  current.value = null
  clearPdf()
}
function clearPdf() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
  pdfUrl.value = ''
}
async function refresh() {
  items.value = await listCollections()
}
async function run(task) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await task()
  } catch (reason) {
    error.value = reason.message || 'Darbība neizdevās.'
  } finally {
    busy.value = false
  }
}
async function open(id) {
  clearPdf()
  current.value = await loadCollection(id)
  editingName.value = current.value.name
}
async function create() {
  await run(async () => {
    const item = await createCollection(name.value)
    creating.value = false
    name.value = ''
    await refresh()
    await open(item.id)
  })
}
async function rename() {
  await run(async () => {
    await updateCollection(current.value.id, current.value.revision, (item) => ({
      ...item,
      name: editingName.value,
    }))
    await open(current.value.id)
    await refresh()
  })
}
async function reorder(index, direction) {
  await run(async () => {
    await updateCollection(current.value.id, current.value.revision, (item) => {
      const ids = [...item.documentIds]
      const target = index + direction
      if (target < 0 || target >= ids.length) return item
      ;[ids[index], ids[target]] = [ids[target], ids[index]]
      return { ...item, documentIds: ids }
    })
    await open(current.value.id)
  })
}
async function remove(id) {
  await run(async () => {
    await removeCollectionDocument(current.value, id)
    await open(current.value.id)
    await refresh()
  })
}
async function discard() {
  if (!window.confirm('Dzēst komplektu? Atsevišķie melnraksti saglabāsies.')) return
  await run(async () => {
    await deleteCollection(current.value.id, current.value.revision)
    current.value = null
    clearPdf()
    await refresh()
  })
}
async function exportPdf(documentId) {
  await run(async () => {
    clearPdf()
    const saved = await loadCollection(current.value.id)
    const snapshot = collectionSnapshot(saved, { scansOnly: scansOnly.value, documentId })
    progress.value = 'Sagatavo PDF…'
    const result = await service.generate(snapshot, (item) => {
      progress.value = 'Sagatavo PDF · ' + item.completed + ' no ' + item.total + ' lapām'
    })
    const latest = await loadCollection(saved.id)
    if (latest.revision !== saved.revision)
      throw new Error('Komplekts ir mainīts. Izveidojiet PDF atkārtoti.')
    pdfUrl.value = URL.createObjectURL(result.blob)
    filename.value = snapshot.metadata.filename
    progress.value = ''
  })
}
onMounted(() =>
  run(async () => {
    await refresh()
    if (typeof route.query.collection === 'string') await open(route.query.collection)
  }),
)
onUnmounted(() => {
  service.dispose()
  clearPdf()
})
</script>
<template>
  <div class="view collections-view">
    <p v-if="error" class="scan-error" role="alert">{{ error }}</p>
    <template v-if="!current">
      <h2 tabindex="-1">Dokumentu komplekti</h2>
      <p>Apvienojiet saistītus dokumentus un papildiniet komplektu arī vēlāk.</p>
      <v-btn color="primary" block :disabled="busy" @click="creating = true"
        >Izveidot komplektu</v-btn
      >
      <p v-if="!items.length && !busy">Vēl nav neviena komplekta.</p>
      <button
        v-for="item in items"
        :key="item.id"
        class="collection-card bordered-card"
        :disabled="busy"
        @click="run(() => open(item.id))"
      >
        <strong>{{ item.name }}</strong
        ><small
          >{{ item.documentIds.length }} dokumenti ·
          {{ new Date(item.updatedAt).toLocaleDateString('lv-LV') }}</small
        >
      </button>
    </template>
    <template v-else>
      <v-btn variant="text" :disabled="busy" @click="closeCollection">Visi komplekti</v-btn>
      <h2 tabindex="-1">{{ current.name }}</h2>
      <form class="collection-name" @submit.prevent="rename">
        <label
          >Komplekta nosaukums<input
            v-model="editingName"
            maxlength="100"
            :disabled="busy" /></label
        ><v-btn type="submit" variant="tonal" :disabled="busy || !editingName.trim()"
          >Saglabāt nosaukumu</v-btn
        >
      </form>
      <p v-if="!current.documents.length">
        Šis komplekts ir tukšs. Pievienojiet jaunu dokumentu sadaļā Skenēt. PDF solī izvēlieties
        “Pievienot komplektam” un šo komplektu.
      </p>
      <button class="text-link" :disabled="busy" @click="startScan">
        Skenēt un pievienot dokumentu
      </button>
      <article
        v-for="(document, index) in current.documents"
        :key="document.id"
        class="collection-card bordered-card"
      >
        <BlobImage
          v-if="document.pages[0]?.thumbnail"
          :blob="document.pages[0].thumbnail"
          alt="Dokumenta priekšskatījums"
        />
        <button
          class="collection-document-open"
          :disabled="busy"
          :aria-label="
            'Apskatīt dokumentu: ' + (document.values.document_title || 'Dokuments ' + (index + 1))
          "
          @click="
            router.push({
              name: 'document',
              params: { id: document.id },
              query: { collection: current.id },
            })
          "
        >
          <h3>{{ document.values.document_title || 'Dokuments ' + (index + 1) }}</h3>
          <span>Apskatīt dokumentu →</span>
        </button>
        <p>
          {{ document.pageIds.length }} lapas ·
          {{ document.confirmed ? 'Pārbaudīts' : 'Tikai skenējums PDF' }}
        </p>
        <div class="collection-actions">
          <v-btn
            variant="text"
            :disabled="busy || !index"
            aria-label="Pārvietot augšup"
            @click="reorder(index, -1)"
            >↑</v-btn
          ><v-btn
            variant="text"
            :disabled="busy || index === current.documents.length - 1"
            aria-label="Pārvietot lejup"
            @click="reorder(index, 1)"
            >↓</v-btn
          ><v-btn variant="text" :disabled="busy" @click="exportPdf(document.id)"
            >Dokumenta PDF</v-btn
          ><v-btn variant="text" color="error" :disabled="busy" @click="remove(document.id)"
            >Izņemt</v-btn
          >
        </div>
      </article>
      <label class="analysis-consent"
        ><input v-model="scansOnly" type="checkbox" :disabled="busy" @change="clearPdf" />Tikai
        skenētās lapas</label
      >
      <v-btn
        color="primary"
        block
        :disabled="busy || !current.documents.length"
        @click="exportPdf()"
        >Izveidot komplekta PDF</v-btn
      >
      <p v-if="busy" role="status">{{ progress || 'Saglabā…' }}</p>
      <v-btn v-if="busy && progress" variant="text" @click="service.cancel()"
        >Atcelt PDF izveidi</v-btn
      >
      <a v-if="pdfUrl" class="collection-download" :href="pdfUrl" :download="filename"
        >Lejupielādēt PDF</a
      >
      <v-btn color="error" variant="text" :disabled="busy" @click="discard">Dzēst komplektu</v-btn>
    </template>
    <v-dialog v-model="creating" max-width="430" aria-label="Jauns komplekts"
      ><v-card class="collection-dialog"
        ><h2>Jauns komplekts</h2>
        <label>Komplekta nosaukums<input v-model="name" maxlength="100" /></label>
        <p v-if="error" role="alert">{{ error }}</p>
        <v-btn color="primary" :disabled="busy || !name.trim()" @click="create">Izveidot</v-btn
        ><v-btn variant="text" :disabled="busy" @click="creating = false">Atcelt</v-btn></v-card
      ></v-dialog
    >
  </div>
</template>
<style>
.collections-view {
  display: grid;
  gap: 18px;
  padding-bottom: 100px;
}
.collection-card {
  padding: 18px;
  width: 100%;
  text-align: left;
  display: grid;
  gap: 10px;
  border-radius: 20px;
}
.collection-card h2 {
  font-size: 18px;
  overflow-wrap: anywhere;
}
.collection-card img {
  height: 80px;
  width: 62px;
  object-fit: cover;
  border-radius: 8px;
}
.collection-card small {
  display: block;
  opacity: 0.65;
}
.collection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.collection-name {
  display: grid;
  gap: 12px;
}
.collection-name label {
  display: grid;
  gap: 8px;
}
.collection-name input {
  padding: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 10px;
  min-width: 0;
}
.collection-download {
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  background: rgb(var(--v-theme-primary));
  color: white;
}
</style>
