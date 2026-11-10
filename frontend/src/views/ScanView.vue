<script setup>
import AppIcon from '../components/AppIcon.vue'
import PageHeading from '../components/PageHeading.vue'
import { t } from '../locales'
</script>

<template>
  <div class="view">
    <PageHeading
      :eyebrow="t('scan.eyebrow')"
      :title="t('scan.title')"
      :description="t('scan.description')"
    />
    <div class="scan-layout">
      <v-card class="capture-card bordered-card"
        ><div class="scan-preview">
          <span class="scan-corner top-left" /><span class="scan-corner top-right" /><span
            class="scan-corner bottom-left"
          /><span class="scan-corner bottom-right" /><span class="capture-icon"
            ><AppIcon name="scan" :size="62"
          /></span>
          <h2>{{ t('scan.cameraTitle') }}</h2>
          <p>{{ t('scan.cameraDescription') }}</p>
          <span class="coming-badge">{{ t('common.soon') }}</span>
        </div>
        <div class="capture-actions">
          <v-btn disabled size="large" color="primary" block
            ><AppIcon name="camera" :size="20" />{{ t('scan.camera') }}</v-btn
          ><v-btn disabled size="large" variant="outlined" block
            ><AppIcon name="gallery" :size="20" />{{ t('scan.gallery') }}</v-btn
          >
        </div>
        <p class="capture-note">{{ t('scan.note') }}</p></v-card
      >
      <div class="scan-side">
        <v-card class="pages-card bordered-card"
          ><div class="section-heading">
            <h2>{{ t('scan.preview') }}</h2>
            <span class="count-badge">0</span>
          </div>
          <div class="pages-empty">
            <AppIcon name="layers" :size="37" />
            <h3>{{ t('scan.noPages') }}</h3>
            <p>{{ t('scan.noPagesText') }}</p>
          </div></v-card
        ><v-card class="future-card bordered-card"
          ><p class="eyebrow">{{ t('common.next') }}</p>
          <div
            v-for="feature in [
              { icon: 'layers', title: 'multipage', text: 'multipageText' },
              { icon: 'crop', title: 'crop', text: 'cropText' },
            ]"
            :key="feature.title"
            class="future-row"
          >
            <AppIcon :name="feature.icon" />
            <div>
              <h3>{{ t(`scan.${feature.title}`) }}</h3>
              <p>{{ t(`scan.${feature.text}`) }}</p>
            </div>
          </div></v-card
        >
      </div>
    </div>
  </div>
</template>
