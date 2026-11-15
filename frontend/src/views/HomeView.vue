<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import DraftCard from '../components/DraftCard.vue'
import { t } from '../locales'
import { useDraftList } from '../features/scanning/useDraftList'
import { useScanSession } from '../features/scanning/useScanSession'
import { errorCode } from '../features/scanning/errors'
import { draftIsDownloaded } from '../features/documents/workflow.js'
const { drafts, loading, error, refresh } = useDraftList()
const unfinished = computed(() =>
  drafts.value.filter((draft) => draft.pageIds.length && !draftIsDownloaded(draft)),
)
const router = useRouter(),
  session = useScanSession(),
  actionError = ref('')
async function start(source = null) {
  if (session.busy.value) return
  if (session.dirty.value && !window.confirm(t('scan.confirmDiscard'))) return
  session.newSession()
  await router.push({ name: 'scan', query: source ? { source } : {} })
}
async function open(id) {
  if (
    session.dirty.value &&
    session.active.value?.id !== id &&
    !window.confirm(t('scan.confirmDiscard'))
  )
    return
  try {
    await session.open(id)
    await router.push({ name: 'scan', query: { draft: id } })
  } catch (reason) {
    actionError.value = t('scan.errors.' + errorCode(reason))
  }
}
</script>
<template>
  <div class="view home-view">
    <h1 tabindex="-1">Dokuments gatavs<br />dažos soļos</h1>
    <p class="home-description">Nofotografējiet, pārbaudiet un saglabājiet PDF.</p>
    <button
      class="home-scan-card"
      :disabled="session.busy.value"
      aria-label="Skenēt dokumentu"
      @click="start()"
    >
      <span class="home-camera-icon"><AppIcon name="camera" :size="28" /></span>
      <strong>Skenēt dokumentu</strong>
      <span>Rēķins, līgums vai iesniegums</span>
    </button>
    <v-btn
      class="home-gallery secondary-button"
      block
      size="x-large"
      variant="outlined"
      :disabled="session.busy.value"
      @click="start('gallery')"
      ><AppIcon name="gallery" :size="20" />Pievienot no galerijas</v-btn
    >
    <p v-if="error || actionError" class="scan-error" role="alert">
      {{ actionError || t('scan.errors.' + error)
      }}<v-btn v-if="error" variant="text" @click="refresh">{{ t('scan.retry') }}</v-btn>
    </p>
    <section v-if="loading || unfinished.length" class="home-resume">
      <h2>Turpināt iesākto</h2>
      <p v-if="loading" role="status">{{ t('scan.loading') }}</p>
      <div v-else class="draft-grid">
        <DraftCard
          v-for="draft in unfinished.slice(0, 2)"
          :key="draft.id"
          :draft="draft"
          :busy="session.busy.value"
          resumable-only
          @open="open"
        />
      </div>
    </section>
    <div v-else-if="!error" class="home-empty-note">
      <AppIcon name="file" :size="23" />
      <p>
        Jūsu nākamais dokuments sākas šeit.<br /><span
          >Nofotografējiet to vai pievienojiet no galerijas.</span
        >
      </p>
    </div>
    <p class="home-privacy">
      <AppIcon name="shield" :size="16" />Dokumenti tiek apstrādāti tikai šajā ierīcē
    </p>
  </div>
</template>
