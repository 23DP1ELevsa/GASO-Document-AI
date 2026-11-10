<script setup>
import AppIcon from './AppIcon.vue'
defineProps({ title: String, description: String, compact: Boolean })
</script>

<template>
  <div class="empty-state" :class="{ compact }">
    <div class="empty-art" aria-hidden="true">
      <div class="empty-sheet"><AppIcon name="file" :size="34" /></div>
      <span class="empty-spark">+</span>
    </div>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <slot />
  </div>
</template>
