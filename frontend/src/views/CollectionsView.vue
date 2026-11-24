<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useScanSession } from '../features/scanning/useScanSession.js'
import { t } from '../locales'
import { storageLabel } from '../features/storage/sync.js'
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
import EmptyState from '../components/EmptyState.vue'
import PageHeading from '../components/PageHeading.vue'
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
const heading = ref(null)
const opening = ref(false)
let loadGeneration = 0
const collectionId = computed(() =>
  route.name === 'collections' && typeof route.query.collection === 'string'
    ? route.query.collection
    : null,
)
const service = createPdfService({
  readImage: async (page) => {
    const image = await readImageRecord(page.imageRecordId)
    return image.processed || image.blob
  },
})
function goBack() {
  if (router.options.history.state.back === '/collections') router.back()
  else return router.replace({ name: 'collections' })
}
defineExpose({ goBack, backDisabled: busy })
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
  const generation = loadGeneration
  clearPdf()
  const item = await loadCollection(id)
  if (generation !== loadGeneration || collectionId.value !== id) return
  current.value = item
  editingName.value = item.name
}
function showCollection(id) {
  return router.push({ name: 'collections', query: { collection: id } })
}
watch(
  collectionId,
  async (id, previous, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
      loadGeneration++
    })
    error.value = ''
    current.value = null
    clearPdf()
    opening.value = id !== null
    if (id !== null) {
      try {
        await open(id)
      } catch (reason) {
        if (!cancelled) error.value = reason.message || 'Komplektu neizdevās atvērt.'
      } finally {
        if (!cancelled) opening.value = false
      }
    }
    await nextTick()
    if (!cancelled && previous !== undefined && route.name === 'collections')
      heading.value?.focusHeading()
  },
  { immediate: true },
)
async function create() {
  await run(async () => {
    const item = await createCollection(name.value)
    creating.value = false
    name.value = ''
    await refresh()
    if (route.name === 'collections' && !collectionId.value) await showCollection(item.id)
  })
}
async function rename() {
  await run(async () => {
    const { id, revision } = current.value
    await updateCollection(id, revision, (item) => ({
      ...item,
      name: editingName.value,
    }))
    if (collectionId.value === id) await open(id)
    await refresh()
  })
}
async function reorder(index, direction) {
  await run(async () => {
    const { id, revision } = current.value
    await updateCollection(id, revision, (item) => {
      const ids = [...item.documentIds]
      const target = index + direction
      if (target < 0 || target >= ids.length) return item
      ;[ids[index], ids[target]] = [ids[target], ids[index]]
      return { ...item, documentIds: ids }
    })
    if (collectionId.value === id) await open(id)
  })
}
async function remove(id) {
  await run(async () => {
    const collection = current.value
    await removeCollectionDocument(collection, id)
    if (collectionId.value === collection.id) await open(collection.id)
    await refresh()
  })
}
async function discard() {
  if (!window.confirm('Dzēst komplektu? Atsevišķie melnraksti saglabāsies.')) return
  await run(async () => {
    const { id, revision } = current.value
    await deleteCollection(id, revision)
    await refresh()
    if (collectionId.value === id) await goBack()
  })
}
async function exportPdf(documentId) {
  await run(async () => {
    const id = current.value.id
    const generation = loadGeneration
    clearPdf()
    try {
      const saved = await loadCollection(id)
      const snapshot = collectionSnapshot(saved, { scansOnly: scansOnly.value, documentId })
      progress.value = 'Sagatavo PDF…'
      const result = await service.generate(snapshot, (item) => {
        progress.value = 'Sagatavo PDF · ' + item.completed + ' no ' + item.total + ' lapām'
      })
      if (generation !== loadGeneration) return
      const latest = await loadCollection(saved.id)
      if (generation !== loadGeneration) return
      if (latest.revision !== saved.revision)
        throw new Error('Komplekts ir mainīts. Izveidojiet PDF atkārtoti.')
      pdfUrl.value = URL.createObjectURL(result.blob)
      filename.value = snapshot.metadata.filename
    } catch (reason) {
      if (generation === loadGeneration) throw reason
    } finally {
      progress.value = ''
    }
  })
}
function deviceBack(event) {
  if (!collectionId.value) return
  event.preventDefault()
  if (!busy.value) goBack()
}
onMounted(() => {
  window.addEventListener('gaso:back', deviceBack)
  run(refresh)
})
onUnmounted(() => {
  window.removeEventListener('gaso:back', deviceBack)
  service.dispose()
  clearPdf()
})
</script>
<template>
  <div class="view collections-view">
    <PageHeading
      ref="heading"
      :title="current?.name || (collectionId ? 'Dokumentu komplekts' : t('nav.collections'))"
      :description="
        collectionId
          ? undefined
          : 'Apvienojiet saistītus dokumentus un papildiniet komplektu arī vēlāk.'
      "
    />
    <p v-if="error" class="scan-error" role="alert">{{ error }}</p>
    <p v-if="opening" class="small-muted" role="status">Atver komplektu…</p>
    <template v-if="collectionId === null">
      <v-btn color="primary" block :disabled="busy" @click="creating = true"
        >Izveidot komplektu</v-btn
      >
      <EmptyState v-if="!items.length && !busy" icon="folder" title="Vēl nav neviena komplekta." />
      <button
        v-for="item in items"
        :key="item.id"
        class="collection-card bordered-card"
        :disabled="busy"
        @click="showCollection(item.id)"
      >
        <strong>{{ item.name }}</strong
        ><small
          >Dokumenti: {{ item.documentIds.length }} ·
          {{ new Date(item.updatedAt).toLocaleDateString('lv-LV') }}</small
        >
        <small>{{ storageLabel('collections', item.id) }}</small>
      </button>
    </template>
    <template v-else-if="current">
      <p class="small-muted">{{ storageLabel('collections', current.id) }}</p>
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
          {{ t('scan.pageCount', { count: document.pageIds.length }) }} ·
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
    <v-dialog v-model="creating" aria-label="Jauns komplekts"
      ><v-card class="collection-dialog app-dialog"
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
.collection-card {
  padding: var(--space-16);
  width: 100%;
  text-align: left;
  display: grid;
  gap: var(--space-8);
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
  color: var(--muted);
}
.collection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.collection-name {
  display: grid;
  gap: var(--space-12);
}
.collection-name label {
  display: grid;
  gap: var(--space-8);
}
.collection-download {
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  background: rgb(var(--v-theme-primary));
  color: white;
}
</style>
