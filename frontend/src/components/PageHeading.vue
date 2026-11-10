<script setup>
defineProps({ eyebrow: String, title: String, description: String })
</script>

<template>
  <header class="page-heading">
    <p class="eyebrow">{{ eyebrow }}</p>
    <h1 tabindex="-1">{{ title }}</h1>
    <p class="page-description">{{ description }}</p>
  </header>
</template>
