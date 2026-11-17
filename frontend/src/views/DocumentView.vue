<script setup>
import { computed, ref, shallowRef, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loadDraft, listDrafts } from '../features/scanning/draftRepository.js'
import { listCollections, loadCollection } from '../features/documents/collections.js'
import { isConfirmationCurrent, documentPages } from '../features/documents/model.js'
import { documentTitle } from '../features/documents/presentation.js'
import { useScanSession } from '../features/scanning/useScanSession.js'
import DocumentInformation from '../components/DocumentInformation.vue'
import ImagePreviewDialog from '../components/ImagePreviewDialog.vue'
import BlobImage from '../components/BlobImage.vue'
import SavedDocumentPdf from '../components/SavedDocumentPdf.vue'
import AddToCollection from '../components/AddToCollection.vue'
const route = useRoute(),
  router = useRouter(),
  scanner = useScanSession()
const saved = shallowRef(null),
  item = shallowRef(null),
  loading = ref(true),
  error = ref(''),
  pdf = ref(false),
  preview = shallowRef(null),
  trigger = shallowRef(null),
  editable = ref(false),
  memberships = ref([]),
  collectionName = ref('')
let generation = 0
const frozen = computed(() => Boolean(route.query.collection))
const pages = computed(() =>
  saved.value && item.value ? documentPages(saved.value, item.value) : [],
)
const confirmed = computed(
  () => saved.value && item.value && isConfirmationCurrent(saved.value, item.value),
)
const controller = { active: saved, dirty: ref(false), busy: ref(false) }
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  pdf.value = false
  preview.value = null
  try {
    let session, document
    if (frozen.value) {
      const collection = await loadCollection(route.query.collection)
      document = collection.documents.find((entry) => entry.id === route.params.id)
      if (!document) throw new Error('Dokuments nav atrasts komplektā.')
      session = {
        id: document.sessionId,
        revision: 1,
        pages: document.pages,
        documents: [document],
      }
      collectionName.value = collection.name
    } else {
      session = await loadDraft(route.query.draft)
      document = session.documents.find((entry) => entry.id === route.params.id)
      if (!document) throw new Error('Dokuments nav atrasts.')
    }
    const drafts = await listDrafts()
    const source = drafts.find((draft) => draft.id === document.sessionId)
    const canEdit = Boolean(
      source?.documents.some((entry) => entry.id === (document.originalDocumentId || document.id)),
    )
    const sets = await listCollections(),
      links = []
    for (const set of sets) {
      const full = await loadCollection(set.id)
      if (
        full.documents.some(
          (entry) =>
            entry.sessionId === document.sessionId &&
            (entry.originalDocumentId || entry.id) === (document.originalDocumentId || document.id),
        )
      )
        links.push(set)
    }
    if (current !== generation) return
    saved.value = session
    item.value = document
    editable.value = canEdit
    memberships.value = links
  } catch (reason) {
    if (current === generation) error.value = reason.message || 'Dokumentu neizdevās atvērt.'
  } finally {
    if (current === generation) loading.value = false
  }
}
function back() {
  router.push(
    frozen.value
      ? { name: 'collections', query: { collection: route.query.collection } }
      : route.query.from === 'scan'
        ? { name: 'scan', query: { draft: route.query.draft } }
        : { name: 'documents' },
  )
}
async function edit() {
  try {
    if (scanner.dirty.value) await scanner.save()
    await scanner.open(item.value.sessionId)
    const id = item.value.originalDocumentId || item.value.id
    if (!scanner.active.value.documents.some((entry) => entry.id === id))
      throw new Error('Sākotnējais dokuments vairs nav pieejams.')
    scanner.setWorkflow({ step: 3, documentId: id })
    await scanner.save()
    await router.push({ name: 'scan', query: { draft: item.value.sessionId } })
  } catch (reason) {
    error.value = reason.message || 'Neizdevās atvērt rediģēšanu.'
  }
}
function show(page, event) {
  trigger.value = event.currentTarget
  preview.value = page
}
watch(() => route.fullPath, load, { immediate: true })
function deviceBack(event) {
  event.preventDefault()
  if (preview.value) preview.value = null
  else if (pdf.value) pdf.value = false
  else back()
}
onMounted(() => window.addEventListener('gaso:back', deviceBack))
onUnmounted(() => {
  generation++
  window.removeEventListener('gaso:back', deviceBack)
})
</script>
<template>
  <div class="view document-detail" data-testid="document-detail">
    <nav class="detail-navigation" aria-label="Dokumenta navigācija">
      <v-btn variant="text" @click="back">Atpakaļ</v-btn
      ><v-btn variant="text" to="/">Uz sākumu</v-btn>
    </nav>
    <p v-if="loading" role="status">Atver dokumentu…</p>
    <p v-if="error" class="scan-error" role="alert">{{ error }}</p>
    <template v-if="!loading && item">
      <header class="detail-heading">
        <h2>{{ documentTitle(item) }}</h2>
        <span class="status-chip" :class="{ 'status-success': confirmed }">{{
          confirmed ? 'Apstiprināts' : 'Jāpārbauda dati'
        }}</span>
        <p class="small-muted">
          {{
            new Date(item.savedAt || item.updatedAt || item.createdAt).toLocaleDateString('lv-LV')
          }}
          · {{ pages.length }} lapas
        </p>
      </header>
      <div class="detail-pages">
        <button
          v-for="(page, index) in pages"
          :key="page.id"
          :aria-label="'Apskatīt lapu ' + (index + 1)"
          @click="show(page, $event)"
        >
          <BlobImage :blob="page.thumbnail" alt="" /><span>{{ index + 1 }}. lapa</span>
        </button>
      </div>
      <v-btn variant="tonal" block @click="show(pages[0], $event)">Apskatīt oriģinālu</v-btn>
      <DocumentInformation :document="item" :session="saved" read-only />
      <section v-if="memberships.length" class="detail-memberships">
        <h3>Dokumentu komplekti</h3>
        <RouterLink
          v-for="set in memberships"
          :key="set.id"
          :to="{ name: 'collections', query: { collection: set.id } }"
          >{{ set.name }}</RouterLink
        >
      </section>
      <p v-if="frozen" class="small-muted">
        Komplektā saglabāta dokumenta versija. Sākotnējā melnraksta labojumi to nemaina.
      </p>
      <v-btn color="primary" block size="large" @click="pdf = true">Izveidot PDF</v-btn>
      <v-btn v-if="editable" variant="tonal" block @click="edit">{{
        frozen ? 'Rediģēt sākotnējo dokumentu' : 'Rediģēt'
      }}</v-btn>
      <AddToCollection v-if="!frozen" :controller="controller" :document-id="item.id" />
    </template>
    <ImagePreviewDialog
      :page="preview"
      :pages="pages"
      :return-focus="trigger"
      @select="preview = $event"
      @close="preview = null"
    />
    <SavedDocumentPdf
      v-if="pdf && item"
      :session="saved"
      :document-id="item.id"
      :frozen="frozen"
      :confirmed="Boolean(confirmed)"
      @close="pdf = false"
    />
  </div>
</template>
<style>
.document-detail {
  display: grid;
  gap: 18px;
  padding-bottom: 36px;
}
.detail-navigation {
  display: flex;
  justify-content: space-between;
}
.detail-heading {
  display: grid;
  gap: 10px;
}
.detail-heading h2 {
  font-size: 23px;
  overflow-wrap: anywhere;
}
.detail-heading .status-chip {
  width: fit-content;
}
.detail-pages {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 4px;
}
.detail-pages button {
  flex-shrink: 0;
  display: grid;
  gap: 8px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 14px;
  min-width: 90px;
}
.detail-pages img {
  width: 95px;
  height: 126px;
  object-fit: cover;
  border-radius: 8px;
}
.detail-memberships {
  display: grid;
  gap: 12px;
}
.detail-memberships a {
  min-height: 44px;
  padding: 10px 0;
}
</style>
