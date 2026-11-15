<script setup>
import AppIcon from './AppIcon.vue'
import { ref } from 'vue'
const heading = ref(null)
defineExpose({ focusHeading: () => heading.value?.focus({ preventScroll: true }) })
defineProps({ title: String, subtitle: String, back: Boolean, brand: Boolean })
defineEmits(['back'])
</script>

<template>
  <header class="mobile-header" :class="{ 'brand-header': brand }">
    <button v-if="back" class="icon-button" aria-label="Atpakaļ" @click="$emit('back')">
      <AppIcon name="back" :size="20" />
    </button>
    <span v-if="brand" class="brand-mark" aria-hidden="true"
      ><svg
        viewBox="0 0 24 24"
        width="21"
        height="21"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="M7 3h7l4 4v14H7zM10 12h5M10 16h3M3 8V5a2 2 0 0 1 2-2M3 16v3a2 2 0 0 0 2 2" /></svg
    ></span>
    <div class="mobile-header-copy">
      <strong v-if="brand">GASO Dokumenti</strong>
      <h1 v-else ref="heading" tabindex="-1">{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <slot />
  </header>
</template>
