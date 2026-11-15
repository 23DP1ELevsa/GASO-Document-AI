<script setup>
import AppIcon from './AppIcon.vue'
import BlobImage from './BlobImage.vue'
import { computed } from 'vue'
import { t, dateTime } from '../locales'
import { draftHasDocuments, draftIsDownloaded } from '../features/documents/workflow.js'
const props = defineProps({ draft: Object, busy: Boolean, resumableOnly: Boolean })
defineEmits(['open', 'remove'])
const status = computed(() => {
  if (draftIsDownloaded(props.draft)) return 'Lejupielādēts'
  if (props.draft.workflow?.step === 4) return 'Gatavs eksportam'
  return draftHasDocuments(props.draft) ? 'Jāpārbauda dati' : 'Jāpārbauda lapas'
})
</script>
<template>
  <article class="draft-card bordered-card" data-testid="draft-card">
    <button
      class="draft-cover"
      :disabled="busy"
      :aria-label="t('documents.openDraft')"
      @click="$emit('open', draft.id)"
    >
      <BlobImage v-if="draft.cover" :blob="draft.cover" :alt="t('documents.cover')" /><AppIcon
        v-else
        name="file"
        :size="42"
      />
    </button>
    <div class="draft-card-content">
      <h3>
        {{
          draft.documents?.find((item) => item.values.document_title)?.values.document_title ||
          'Skenēts dokuments'
        }}
      </h3>
      <p class="draft-updated">{{ draft.pageIds.length }} lp. · {{ dateTime(draft.updatedAt) }}</p>
      <span class="status-chip" :class="{ 'status-success': status === 'Lejupielādēts' }">{{
        status
      }}</span>
      <div class="draft-actions">
        <v-btn color="primary" variant="tonal" :disabled="busy" @click="$emit('open', draft.id)"
          >{{ t('documents.continue') }}<AppIcon name="arrow" :size="18" /></v-btn
        ><v-btn
          v-if="!resumableOnly"
          variant="text"
          color="error"
          :disabled="busy"
          :aria-label="t('documents.deleteDraft')"
          @click="$emit('remove', draft.id)"
          ><AppIcon name="trash" :size="20"
        /></v-btn>
      </div>
    </div>
  </article>
</template>
