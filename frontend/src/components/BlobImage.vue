<script setup>
import { useBlobUrl } from '../composables/useBlobUrl'
const props = defineProps({ blob: Blob, alt: { type: String, required: true } })
const url = useBlobUrl(() => props.blob)
</script>
<template><img v-if="url" :src="url" :alt="alt" loading="lazy" decoding="async" /></template>
