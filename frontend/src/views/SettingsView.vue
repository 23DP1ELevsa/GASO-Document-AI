<script setup>
import AppIcon from '../components/AppIcon.vue'
import LocalNotice from '../components/LocalNotice.vue'
import OcrSettingsCard from '../components/OcrSettingsCard.vue'
import { useAppearance } from '../composables/useAppearance'
import { usePwa } from '../composables/usePwa'
import { t } from '../locales'
import { usePdfPreferences } from '../features/pdf/usePdfPreferences'
const { mode: defaultMode, setMode, error: pdfSettingsError } = usePdfPreferences()
const { isDark, setTheme } = useAppearance()
const { installEvent, install } = usePwa()
</script>

<template>
  <div class="view settings-view">
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
              <span class="theme-option-label"
                ><AppIcon :name="mode === 'light' ? 'sun' : 'moon'" :size="18" />{{
                  t(`settings.${mode}`)
                }}<AppIcon v-if="mode === (isDark ? 'dark' : 'light')" name="check" :size="17"
              /></span>
            </button>
          </div>
        </v-card>
        <h2 class="settings-label">{{ t('ocr.settingsTitle') }}</h2>
        <OcrSettingsCard />
        <h2 class="settings-label">Noklusējuma PDF</h2>
        <v-card class="settings-card bordered-card">
          <div class="segmented-control" role="group" aria-label="Noklusējuma PDF">
            <button
              v-for="choice in [
                ['info', 'Ar informāciju'],
                ['scan', 'Tikai skenējums'],
              ]"
              :key="choice[0]"
              :aria-pressed="defaultMode === choice[0]"
              @click="setMode(choice[0])"
            >
              {{ choice[1] }}
            </button>
          </div>
          <p v-if="pdfSettingsError" role="alert" class="scan-error">
            Neizdevās saglabāt PDF iestatījumu.
          </p>
        </v-card>
        <v-card class="settings-card bordered-card settings-privacy"
          ><LocalNotice expanded
        /></v-card>
        <v-card v-if="installEvent" class="settings-card bordered-card"
          ><h3>{{ t('pwa.install') }}</h3>
          <p>{{ t('pwa.installText') }}</p>
          <v-btn color="primary" @click="install">{{ t('pwa.install') }}</v-btn></v-card
        >
        <a
          class="settings-project-link"
          href="https://github.com/23DP1ELevsa/GASO-Document-AI"
          target="_blank"
          rel="noopener noreferrer"
          ><AppIcon name="github" :size="18" />Projekts GitHub<AppIcon name="external" :size="16"
        /></a>
      </section>
    </div>
  </div>
</template>
