<script setup>
import AppIcon from './AppIcon.vue'
import BlobImage from './BlobImage.vue'
defineProps({ pages: Array, disabled: Boolean })
defineEmits(['camera', 'gallery', 'continue', 'edit'])
</script>

<template>
  <section class="capture-panel" aria-label="Dokumenta fotografēšana">
    <div class="capture-viewfinder">
      <div class="capture-frame" aria-hidden="true">
        <i /><i /><i /><i /><AppIcon name="file" :size="74" />
      </div>
      <h2>Novietojiet visu lapu rāmī</h2>
      <p>Pieskarieties fotografēšanas pogai, lai atvērtu ierīces kameru.</p>
      <button class="capture-gallery-link" :disabled="disabled" @click="$emit('gallery')">
        <AppIcon name="gallery" :size="18" />Varat arī izvēlēties attēlus no galerijas
      </button>
    </div>
    <div v-if="pages.length" class="capture-thumbnails" aria-label="Pievienotās lapas">
      <button
        v-for="(page, index) in pages"
        :key="page.id"
        :disabled="disabled"
        :aria-label="`Rediģēt ${index + 1}. lapu`"
        @click="$emit('edit', page, $event.currentTarget, true)"
      >
        <BlobImage :blob="page.thumbnail" alt="" /><span>{{ index + 1 }}</span>
      </button>
    </div>
  </section>
</template>
