<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import DraftCard from '../components/DraftCard.vue'
import { t } from '../locales'
import { useDraftList } from '../features/scanning/useDraftList'
import { useScanSession } from '../features/scanning/useScanSession'
import { errorCode } from '../features/scanning/errors'
const { drafts, loading, error, refresh } = useDraftList()
const router = useRouter(),
  session = useScanSession(),
  actionError = ref('')
async function start() {
  if (session.busy.value) return
  if (session.dirty.value && !window.confirm(t('scan.confirmDiscard'))) return
  session.newSession()
  await router.push({ name: 'scan' })
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
  <div class="view home-view guided-home">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">{{ t('home.eyebrow') }}</p>
        <h1 tabindex="-1">{{ t('home.title') }}</h1>
        <p class="hero-description">{{ t('home.description') }}</p>
        <v-btn
          color="primary"
          size="x-large"
          class="scan-cta"
          :disabled="session.busy.value"
          @click="start"
          ><AppIcon name="scan" :size="23" />{{ t('common.scan') }}<AppIcon name="arrow" :size="20"
        /></v-btn>
        <p class="hero-hint">{{ t('home.scanHint') }}</p>
      </div>
      <div class="home-document-mark" aria-hidden="true">
        <div>
          <AppIcon name="file" :size="72" /><span /><span /><span /><b
            ><AppIcon name="check" :size="24"
          /></b>
        </div>
      </div>
    </section>
    <ol class="home-flow">
      <li v-for="number in 4" :key="number">
        <span>{{ number }}</span
        >{{ t('workflow.steps.' + number) }}
      </li>
    </ol>
    <p class="home-local"><AppIcon name="shield" :size="18" />{{ t('scan.localTitle') }}</p>
    <p v-if="error || actionError" class="scan-error" role="alert">
      {{ actionError || t('scan.errors.' + error)
      }}<v-btn v-if="error" variant="text" @click="refresh">{{ t('scan.retry') }}</v-btn>
    </p>
    <section v-if="loading || drafts.length" class="documents-section">
      <div class="section-heading">
        <h2>{{ t('workflow.resume') }}</h2>
        <v-btn to="/documents" variant="text" color="primary"
          >{{ t('common.allDocuments') }}<AppIcon name="chevron" :size="18"
        /></v-btn>
      </div>
      <p v-if="loading" role="status">{{ t('scan.loading') }}</p>
      <div v-else class="draft-grid">
        <DraftCard
          v-for="draft in drafts.slice(0, 3)"
          :key="draft.id"
          :draft="draft"
          :busy="session.busy.value"
          resumable-only
          @open="open"
        />
      </div>
    </section>
    <p v-else-if="!error" class="home-empty-hint">{{ t('home.emptyDescription') }}</p>
  </div>
</template>
