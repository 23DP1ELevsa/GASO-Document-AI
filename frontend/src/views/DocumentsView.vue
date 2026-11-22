<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import DraftCard from '../components/DraftCard.vue'
import DocumentCard from '../components/DocumentCard.vue'
import EmptyState from '../components/EmptyState.vue'
import PageHeading from '../components/PageHeading.vue'
import { useDraftList } from '../features/scanning/useDraftList.js'
import { useScanSession } from '../features/scanning/useScanSession.js'
import { loadDraft } from '../features/scanning/draftRepository.js'
import { listCollections, loadCollection } from '../features/documents/collections.js'
import {
  isConfirmationCurrent,
  documentPages,
  unassignedPages,
} from '../features/documents/model.js'
import { errorCode } from '../features/scanning/errors.js'
import { t } from '../locales'
const router = useRouter(),
  scanner = useScanSession()
const { drafts, loading, error, refresh } = useDraftList()
const items = ref([]),
  partial = ref([]),
  listing = ref(false),
  actionError = ref(''),
  success = ref('')
const sections = computed(() => [
  { title: 'Jāpārbauda', items: items.value.filter((item) => !item.confirmed) },
  { title: 'Apstiprināti dokumenti', items: items.value.filter((item) => item.confirmed) },
])
let generation = 0
async function rebuild() {
  const current = ++generation
  listing.value = true
  actionError.value = ''
  try {
    const sessions = await Promise.all(drafts.value.map((item) => loadDraft(item.id)))
    const records = new Map(),
      incomplete = []
    for (const session of sessions) {
      if (!session.documents.length || unassignedPages(session).length) incomplete.push(session)
      for (const document of session.documents.filter((item) => item.pageIds.length))
        records.set(session.id + ':' + document.id, {
          document,
          draftId: session.id,
          cover: documentPages(session, document)[0]?.thumbnail,
          confirmed: isConfirmationCurrent(session, document),
          updatedAt: document.updatedAt || session.updatedAt,
          memberships: [],
        })
    }
    for (const set of await listCollections()) {
      const collection = await loadCollection(set.id)
      for (const document of collection.documents) {
        const key = document.sessionId + ':' + document.originalDocumentId
        if (records.has(key)) records.get(key).memberships.push(set)
        else
          records.set(key, {
            document,
            collectionId: set.id,
            cover: document.pages[0]?.thumbnail,
            confirmed: isConfirmationCurrent({ pages: document.pages }, document),
            updatedAt: document.savedAt,
            memberships: [set],
          })
      }
    }
    if (current !== generation) return
    items.value = [...records.values()].sort((a, b) => b.updatedAt - a.updatedAt)
    partial.value = incomplete
  } catch (reason) {
    if (current === generation) actionError.value = t('scan.errors.' + errorCode(reason))
  } finally {
    if (current === generation) listing.value = false
  }
}
watch(drafts, rebuild, { immediate: true })
async function resume(id) {
  try {
    if (scanner.dirty.value) await scanner.save()
    await scanner.open(id)
    await router.push({ name: 'scan', query: { draft: id } })
  } catch (reason) {
    actionError.value = t('scan.errors.' + errorCode(reason))
  }
}
async function open(item) {
  try {
    if (scanner.dirty.value) await scanner.save()
    await router.push({
      name: 'document',
      params: { id: item.document.id },
      query: item.draftId ? { draft: item.draftId } : { collection: item.collectionId },
    })
  } catch (reason) {
    actionError.value = t('scan.errors.' + errorCode(reason))
  }
}
async function start() {
  try {
    if (scanner.dirty.value) await scanner.save()
    scanner.newSession()
    await router.push('/scan')
  } catch (reason) {
    actionError.value = t('scan.errors.' + errorCode(reason))
  }
}
async function remove(id) {
  if (
    !window.confirm(
      'Dzēst skenēšanas sesiju un visus tajā esošos dokumentus? Komplektos saglabātās versijas paliks pieejamas.',
    )
  )
    return
  try {
    await scanner.discard(id)
    success.value = 'Sesija dzēsta.'
    await refresh()
    await rebuild()
  } catch (reason) {
    actionError.value = t('scan.errors.' + errorCode(reason))
  }
}
</script>
<template>
  <div class="view document-list-view">
    <PageHeading :title="t('nav.documents')" description="Saglabāti tikai šajā ierīcē" />
    <div v-if="error || actionError" class="scan-error" role="alert">
      {{ actionError || t('scan.errors.' + error)
      }}<v-btn variant="text" @click="refresh">Mēģināt vēlreiz</v-btn>
    </div>
    <p v-if="success" role="status">{{ success }}</p>
    <div class="document-list-tools">
      <p class="small-muted">
        Kopā saglabāti <span class="count-badge">{{ items.length }}</span>
      </p>
      <v-btn
        v-if="items.length || partial.length"
        color="primary"
        :disabled="scanner.busy.value"
        @click="start"
        >Skenēt</v-btn
      >
    </div>
    <p v-if="loading || listing" role="status">Atver saglabātos dokumentus…</p>
    <template v-else>
      <section v-if="partial.length">
        <h2 class="draft-section-title">Nepabeigti melnraksti</h2>
        <div class="draft-grid">
          <DraftCard
            v-for="draft in partial"
            :key="draft.id"
            :draft="draft"
            :busy="scanner.busy.value"
            @open="resume"
            @remove="remove"
          />
        </div>
      </section>
      <section v-for="section in sections.filter((item) => item.items.length)" :key="section.title">
        <h2 class="draft-section-title">{{ section.title }}</h2>
        <div class="draft-grid">
          <DocumentCard
            v-for="item in section.items"
            :key="item.draftId + ':' + item.document.id"
            :item="item"
            :disabled="scanner.busy.value"
            @open="open"
            @remove="remove"
          />
        </div>
      </section>
      <EmptyState
        v-if="!partial.length && !items.length"
        title="Vēl nav saglabātu dokumentu"
        description="Nofotografējiet pirmo dokumentu. Pēc saglabāšanas tas būs pieejams šeit."
      >
        <v-btn color="primary" :disabled="scanner.busy.value" @click="start"
          >Skenēt dokumentu</v-btn
        >
      </EmptyState>
    </template>
    <p class="small-muted">Šeit glabājas fotogrāfijas un dati. PDF varat izveidot jebkurā laikā.</p>
  </div>
</template>
<style>
.document-list-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}
</style>
