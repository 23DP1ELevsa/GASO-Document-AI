<script setup>
import AppIcon from '../components/AppIcon.vue'
import PageHeading from '../components/PageHeading.vue'
import LocalNotice from '../components/LocalNotice.vue'
import { useAppearance } from '../composables/useAppearance'
import { usePwa } from '../composables/usePwa'
import { t } from '../locales'
import { version } from '../../package.json'
const { isDark, setTheme } = useAppearance()
const { installEvent, install } = usePwa()
</script>

<template>
  <div class="view settings-view">
    <PageHeading
      :eyebrow="t('settings.eyebrow')"
      :title="t('settings.title')"
      :description="t('settings.description')"
    />
    <div class="settings-grid">
      <section>
        <h2 class="settings-label">{{ t('settings.appearance') }}</h2>
        <v-card class="settings-card bordered-card"
          ><h3>{{ t('settings.appearanceText') }}</h3>
          <div class="theme-options" role="group" :aria-label="t('settings.themeLabel')">
            <button
              v-for="mode in ['light', 'dark']"
              :key="mode"
              :aria-pressed="mode === (isDark ? 'dark' : 'light')"
              :class="['theme-option', mode, { active: mode === (isDark ? 'dark' : 'light') }]"
              @click="setTheme(mode)"
            >
              <span class="theme-preview"
                ><span class="preview-sidebar" /><span class="preview-content"
                  ><span /><span /><span /></span></span
              ><span class="theme-option-label"
                ><AppIcon :name="mode === 'light' ? 'sun' : 'moon'" :size="18" />{{
                  t(`settings.${mode}`)
                }}<AppIcon v-if="mode === (isDark ? 'dark' : 'light')" name="check" :size="17"
              /></span>
            </button>
          </div>
          <p class="small-muted">{{ t('settings.themeSaved') }}</p></v-card
        >
        <h2 class="settings-label">{{ t('settings.privacy') }}</h2>
        <v-card class="settings-card bordered-card"
          ><LocalNotice expanded />
          <div class="ai-notice">
            <span class="step-icon"><AppIcon name="sparkles" /></span>
            <div>
              <h3>{{ t('settings.aiTitle') }}</h3>
              <p>{{ t('settings.aiDescription') }}</p>
              <span class="subtle-label">{{ t('common.planned') }}</span>
            </div>
          </div></v-card
        >
      </section>
      <section>
        <h2 class="settings-label">{{ t('settings.about') }}</h2>
        <v-card class="settings-card bordered-card"
          ><div class="about-brand">
            <span class="brand-mark"><AppIcon name="scan" :size="28" /></span>
            <div>
              <h3>{{ t('app.name') }}</h3>
              <p>{{ t('app.version') }} {{ version }}</p>
            </div>
          </div>
          <p class="about-description">{{ t('settings.aboutText') }}</p>
          <span class="subtle-label">{{ t('settings.prototype') }}</span>
          <div class="settings-divider" />
          <div class="language-row">
            <span>{{ t('settings.language') }}</span
            ><strong>{{ t('settings.latvian') }}</strong>
          </div>
          <p class="small-muted">{{ t('settings.languageNote') }}</p>
          <a
            class="github-link"
            href="https://github.com/23DP1ELevsa/GASO-Document-AI"
            target="_blank"
            rel="noopener noreferrer"
            ><AppIcon name="github" :size="21" /><span
              >{{ t('settings.github') }}<small>{{ t('settings.githubHint') }}</small></span
            ><AppIcon name="external" :size="18" /></a></v-card
        ><v-card v-if="installEvent" class="settings-card install-card bordered-card"
          ><AppIcon name="download" :size="28" />
          <h3>{{ t('pwa.install') }}</h3>
          <p>{{ t('pwa.installText') }}</p>
          <v-btn color="primary" @click="install">{{ t('pwa.install') }}</v-btn></v-card
        >
      </section>
    </div>
  </div>
</template>
