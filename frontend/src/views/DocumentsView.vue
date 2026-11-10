<script setup>
import AppIcon from '../components/AppIcon.vue'
import PageHeading from '../components/PageHeading.vue'
import EmptyState from '../components/EmptyState.vue'
import LocalNotice from '../components/LocalNotice.vue'
import { t } from '../locales'
</script>

<template>
  <div class="view">
    <PageHeading
      :eyebrow="t('documents.eyebrow')"
      :title="t('documents.title')"
      :description="t('documents.description')"
    /><v-card class="archive-card bordered-card"
      ><div class="archive-header">
        <span><AppIcon name="documents" :size="20" />{{ t('documents.count') }}</span
        ><span class="count-badge">0</span>
      </div>
      <EmptyState :title="t('documents.emptyTitle')" :description="t('documents.emptyDescription')"
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
