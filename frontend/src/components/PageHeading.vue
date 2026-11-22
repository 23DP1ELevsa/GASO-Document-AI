<script setup>
import { ref } from 'vue'

defineProps({ title: String, description: String, hero: Boolean })
const heading = ref(null)
defineExpose({ focusHeading: () => heading.value?.focus({ preventScroll: true }) })
</script>

<template>
  <div class="page-heading" :class="{ 'page-heading-hero': hero }">
    <h1 ref="heading" tabindex="-1">
      <slot>{{ title }}</slot>
    </h1>
    <p v-if="description" class="page-description">{{ description }}</p>
  </div>
</template>
