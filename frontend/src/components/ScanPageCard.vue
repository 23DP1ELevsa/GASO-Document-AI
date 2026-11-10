<script setup>
import AppIcon from './AppIcon.vue'
import { ref } from 'vue'
import BlobImage from './BlobImage.vue'
import { t } from '../locales'
defineProps({ page: Object, index: Number, count: Number, busy: Boolean })
const card = ref(null)
defineEmits(['preview', 'move', 'replace', 'remove', 'edit'])
</script>
<template>
  <article
    ref="card"
    class="scan-page-card bordered-card"
    data-testid="page-card"
    :aria-label="t('scan.pageNumber', { number: index + 1 })"
  >
    <button
      class="page-image-button"
      :disabled="busy"
      :aria-label="t('scan.openPreview', { number: index + 1 })"
      @click="$emit('preview', page, $event.currentTarget)"
    >
      <BlobImage :blob="page.thumbnail" :alt="t('scan.pageNumber', { number: index + 1 })" />
      <span class="page-number">{{ index + 1 }}</span
      ><span class="page-expand"><AppIcon name="expand" :size="18" /></span>
    </button>
    <div class="page-card-info">
      <h3 :title="page.name">{{ page.name }}</h3>
      <p>
        {{ page.processedWidth || page.width }} × {{ page.processedHeight || page.height }} px ·
        {{ (page.size / 1024 / 1024).toFixed(1) }} MiB
      </p>
      <span v-if="page.processing" class="processed-label">{{ t('editor.processed') }}</span>
    </div>
    <div class="page-card-actions">
      <v-btn
        variant="text"
        :disabled="busy || index === 0"
        :aria-label="t('scan.moveUp', { number: index + 1 })"
        @click="$emit('move', page.id, -1)"
        ><AppIcon name="up" :size="19"
      /></v-btn>
      <v-btn
        variant="text"
        :disabled="busy || index === count - 1"
        :aria-label="t('scan.moveDown', { number: index + 1 })"
        @click="$emit('move', page.id, 1)"
        ><AppIcon name="down" :size="19"
      /></v-btn>
      <v-menu :close-on-content-click="true"
        ><template #activator="{ props }"
          ><v-btn
            v-bind="props"
            variant="text"
            :disabled="busy"
            :aria-label="t('scan.pageActions', { number: index + 1 })"
            ><AppIcon name="more" :size="20" /></v-btn
        ></template>
        <div class="page-action-menu">
          <v-btn
            variant="text"
            block
            @click="$emit('edit', page, card.querySelector('.page-image-button'))"
            ><AppIcon name="crop" :size="18" />{{ t('editor.edit') }}</v-btn
          >
          <v-btn variant="text" block @click="$emit('replace', page.id)"
            ><AppIcon name="replace" :size="18" />{{ t('scan.replace') }}</v-btn
          ><v-btn variant="text" block color="error" @click="$emit('remove', page.id)"
            ><AppIcon name="trash" :size="18" />{{ t('scan.removePage') }}</v-btn
          >
        </div></v-menu
      >
    </div>
  </article>
</template>
