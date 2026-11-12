<script setup>
import AppIcon from './AppIcon.vue'
import BlobImage from './BlobImage.vue'
import { t, dateTime } from '../locales'
import { draftHasDocuments } from '../features/documents/workflow.js'
defineProps({ draft: Object, busy: Boolean, resumableOnly: Boolean })
defineEmits(['open', 'remove'])
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
      <span class="subtle-label">{{
        t(draftHasDocuments(draft) ? 'workflow.preparedStatus' : 'workflow.startedStatus')
      }}</span>
      <h3>
        {{
          draft.documents?.find((item) => item.values.document_title)?.values.document_title ||
          t('workflow.draftTitle')
        }}
      </h3>
      <p>{{ t('scan.pageCount', { count: draft.pageIds.length }) }}</p>
      <p>{{ t('grouping.documentCount', { count: draft.documents?.length || 0 }) }}</p>
      <p class="draft-updated">{{ t('documents.updated') }} {{ dateTime(draft.updatedAt) }}</p>
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
