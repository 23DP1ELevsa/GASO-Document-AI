<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import PageHeading from '../components/PageHeading.vue'
import EmptyState from '../components/EmptyState.vue'
import LocalNotice from '../components/LocalNotice.vue'
import DraftCard from '../components/DraftCard.vue'
import { useDraftList } from '../features/scanning/useDraftList'
import { useScanSession } from '../features/scanning/useScanSession'
import { errorCode } from '../features/scanning/errors'
import { t } from '../locales'
const router = useRouter()
const { drafts, loading, error, refresh } = useDraftList()
const session = useScanSession()
const { busy } = session
const actionError = ref(''),
  success = ref('')
async function open(id) {
  if (
    session.dirty.value &&
    session.active.value?.id !== id &&
    !window.confirm(t('scan.confirmDiscard'))
  )
    return
  actionError.value = ''
  success.value = ''
  try {
    await session.open(id)
    await router.push({ name: 'scan', query: { draft: id } })
  } catch (reason) {
    actionError.value = t(`scan.errors.${errorCode(reason)}`)
  }
}
async function remove(id) {
  if (!window.confirm(t('documents.confirmDelete'))) return
  actionError.value = ''
  success.value = ''
  try {
    await session.discard(id)
    success.value = t('scan.deleted')
  } catch (reason) {
    actionError.value = t(`scan.errors.${errorCode(reason)}`)
  }
}
</script>
<template>
  <div class="view">
    <PageHeading
      :eyebrow="t('documents.eyebrow')"
      :title="t('documents.title')"
      :description="t('documents.description')"
    />
    <div v-if="error || actionError" class="scan-error" role="alert">
      {{ actionError || t(`scan.errors.${error}`)
      }}<v-btn v-if="error" variant="text" @click="refresh">{{ t('scan.retry') }}</v-btn>
    </div>
    <div v-if="success" class="scan-success" role="status">{{ success }}</div>
    <div class="section-heading">
      <h2>
        {{ t('documents.count') }} <span class="count-badge">{{ drafts.length }}</span>
      </h2>
      <v-btn to="/scan" variant="tonal" color="primary"
        ><AppIcon name="scan" :size="18" />{{ t('nav.scan') }}</v-btn
      >
    </div>
    <p v-if="loading" role="status" class="small-muted">{{ t('scan.loading') }}</p>
    <div v-else-if="drafts.length" class="draft-grid">
      <DraftCard
        v-for="draft in drafts"
        :key="draft.id"
        :draft="draft"
        :busy="busy"
        @open="open"
        @remove="remove"
      />
    </div>
    <v-card v-else-if="!error" class="archive-card bordered-card"
      ><EmptyState :title="t('documents.emptyTitle')" :description="t('documents.emptyDescription')"
        ><v-btn to="/scan" color="primary" size="large"
          ><AppIcon name="scan" :size="20" />{{ t('common.scan') }}</v-btn
        ></EmptyState
      ></v-card
    ><LocalNotice expanded />
    <div class="archive-future">
      <AppIcon name="sparkles" :size="23" />
      <div>
        <h3>{{ t('documents.future') }}</h3>
        <p>{{ t('documents.futureText') }}</p>
      </div>
      <span class="subtle-label">{{ t('common.planned') }}</span>
    </div>
  </div>
</template>
