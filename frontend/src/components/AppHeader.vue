<script setup>
import AppIcon from './AppIcon.vue'
import { t } from '../locales'

defineProps({ back: Boolean, backDisabled: Boolean, offline: Boolean })
defineEmits(['back'])
</script>

<template>
  <header class="app-header">
    <div class="app-header-leading">
      <button
        v-if="back"
        type="button"
        class="icon-button"
        :aria-label="t('nav.back')"
        :disabled="backDisabled"
        @click="$emit('back')"
      >
        <AppIcon name="back" size="var(--icon-size)" />
      </button>
    </div>
    <div class="app-header-brand">
      <span class="brand-mark" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="21"
          height="21"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M7 3h7l4 4v14H7zM10 12h5M10 16h3M3 8V5a2 2 0 0 1 2-2M3 16v3a2 2 0 0 0 2 2" />
        </svg>
      </span>
      <strong>{{ t('app.name') }}</strong>
    </div>
    <span v-if="offline" class="offline-badge" role="status">
      <AppIcon name="offline" size="var(--icon-small)" />
      <span class="sr-only">{{ t('app.offline') }}</span>
    </span>
    <div id="app-header-actions" class="app-header-actions"><slot /></div>
  </header>
</template>
