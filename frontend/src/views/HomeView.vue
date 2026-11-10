<script setup>
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import LocalNotice from '../components/LocalNotice.vue'
import { t } from '../locales'
import { useDraftList } from '../features/scanning/useDraftList'
const { drafts, loading, error, refresh } = useDraftList()
const steps = [
  { icon: 'camera', title: 'capture', text: 'captureText' },
  { icon: 'ocr', title: 'recognize', text: 'recognizeText' },
  { icon: 'folder', title: 'organize', text: 'organizeText' },
]
</script>

<template>
  <div class="view home-view">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">{{ t('home.eyebrow') }}</p>
        <h1 tabindex="-1">{{ t('home.title') }}</h1>
        <p class="hero-description">{{ t('home.description') }}</p>
        <v-btn to="/scan" color="primary" size="large" class="scan-cta"
          ><AppIcon name="scan" :size="21" />{{ t('common.scan') }}<AppIcon name="arrow" :size="19"
        /></v-btn>
        <p class="hero-hint">{{ t('home.scanHint') }}</p>
      </div>
      <div class="document-art" aria-hidden="true">
        <div class="art-orbit orbit-one" />
        <div class="art-orbit orbit-two" />
        <div class="art-dot dot-one" />
        <div class="art-dot dot-two" />
        <div class="art-paper paper-back" />
        <div class="art-paper paper-front">
          <span class="art-document-icon"><AppIcon name="file" :size="27" /></span
          ><span class="art-line line-short" /><span class="art-line" /><span
            class="art-line"
          /><span class="art-line line-medium" />
          <div class="art-rule" />
          <span class="art-line line-short" /><span class="art-line line-medium" /><span
            class="art-stamp"
            ><AppIcon name="check" :size="20"
          /></span>
        </div>
        <div class="art-scan-line" />
        <span class="art-floating-icon"><AppIcon name="scan" :size="27" /></span>
      </div>
    </section>

    <LocalNotice />
    <section class="documents-section">
      <div class="section-heading">
        <div>
          <h2>{{ t('home.recent') }}</h2>
          <p>{{ t('home.recentSubtitle') }}</p>
        </div>
        <v-btn to="/documents" variant="text" color="primary" class="all-documents"
          >{{ t('common.allDocuments') }}<AppIcon name="chevron" :size="18"
        /></v-btn>
      </div>
      <v-card class="bordered-card"
        ><div v-if="error" class="draft-home-summary">
          <p role="alert">{{ t(`scan.errors.${error}`) }}</p>
          <v-btn variant="text" @click="refresh">{{ t('scan.retry') }}</v-btn>
        </div>
        <p v-else-if="loading" class="draft-home-summary" role="status">{{ t('scan.loading') }}</p>
        <div v-else-if="drafts.length" class="draft-home-summary">
          <span class="step-icon"><AppIcon name="documents" /></span>
          <h3>{{ t('home.draftSummary', { count: drafts.length }) }}</h3>
          <v-btn to="/documents" variant="tonal" color="primary"
            >{{ t('common.allDocuments') }}<AppIcon name="arrow" :size="18"
          /></v-btn>
        </div>
        <EmptyState
          v-else
          compact
          :title="t('home.emptyTitle')"
          :description="t('home.emptyDescription')"
          ><v-btn to="/scan" variant="tonal" color="primary"
            ><AppIcon name="scan" :size="18" />{{ t('nav.scan') }}</v-btn
          ></EmptyState
        ></v-card
      >
    </section>
    <section class="workflow-section">
      <div class="section-heading">
        <div>
          <h2>{{ t('home.workflow') }}</h2>
          <p>{{ t('home.workflowSubtitle') }}</p>
        </div>
        <span class="subtle-label">{{ t('common.planned') }}</span>
      </div>
      <div class="workflow-grid">
        <v-card v-for="(step, index) in steps" :key="step.title" class="step-card bordered-card"
          ><div class="step-card-top">
            <span class="step-icon"><AppIcon :name="step.icon" /></span
            ><span class="step-number">0{{ index + 1 }}</span>
          </div>
          <h3>{{ t(`home.${step.title}`) }}</h3>
          <p>{{ t(`home.${step.text}`) }}</p></v-card
        >
      </div>
    </section>
  </div>
</template>
