<script setup>
import { shallowRef, ref, watch, onScopeDispose } from 'vue'
import AppIcon from './AppIcon.vue'
import { useBlobUrl } from '../composables/useBlobUrl'
import { readOriginal } from '../features/scanning/draftRepository'
import { errorCode } from '../features/scanning/errors'
import { t } from '../locales'
const props = defineProps({ page: Object, returnFocus: Object })
function restoreFocus() {
  if (props.returnFocus?.isConnected) props.returnFocus.focus({ preventScroll: true })
}
defineEmits(['close'])
const blob = shallowRef(null),
  loading = ref(false),
  error = ref('')
const url = useBlobUrl(() => blob.value)
let generation = 0
watch(
  () => props.page,
  async (page) => {
    const current = ++generation
    blob.value = null
    error.value = ''
    loading.value = Boolean(page)
    if (!page) return
    try {
      const original = page.original || (await readOriginal(page.id))
      if (generation === current) blob.value = original
    } catch (reason) {
      if (generation === current) error.value = errorCode(reason)
    } finally {
      if (generation === current) loading.value = false
    }
  },
  { immediate: true },
)
onScopeDispose(() => {
  generation++
})
</script>
<template>
  <v-dialog
    :model-value="Boolean(page)"
    max-width="1100"
    :aria-label="t('scan.preview')"
    @update:model-value="!$event && $emit('close')"
    @after-leave="restoreFocus"
  >
    <v-card class="image-dialog"
      ><header>
        <h2>{{ page?.name }}</h2>
        <v-btn variant="text" :aria-label="t('scan.closePreview')" @click="$emit('close')"
          ><AppIcon name="close"
        /></v-btn>
      </header>
      <div v-if="loading" class="preview-loading" role="status">
        <v-progress-circular indeterminate color="primary" :aria-label="t('scan.loading')" />
        <p>{{ t('scan.loading') }}</p>
      </div>
      <p v-else-if="error" class="scan-error" role="alert">{{ t(`scan.errors.${error}`) }}</p>
      <img v-else-if="url" :src="url" :alt="t('scan.originalPreview')" />
      <p class="preview-caption">{{ t('scan.originalUnchanged') }}</p></v-card
    >
  </v-dialog>
</template>
