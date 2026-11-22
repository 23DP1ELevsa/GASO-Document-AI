<script setup>
import AppIcon from './AppIcon.vue'
defineProps({ title: String, description: String, icon: { type: String, default: 'file' } })
</script>

<template>
  <div class="empty-state bordered-card">
    <span class="empty-icon"><AppIcon :name="icon" :size="24" /></span>
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <slot />
  </div>
</template>
