<script setup>
import BlobImage from './BlobImage.vue'
import { documentTitle } from '../features/documents/presentation.js'
import { storageLabel } from '../features/storage/sync.js'
import { t } from '../locales'
defineProps({ item: Object, disabled: Boolean })
defineEmits(['open', 'remove'])
</script>
<template>
  <article class="saved-document-card bordered-card" data-testid="document-card">
    <button
      class="saved-document-open"
      :disabled="disabled"
      @click="$emit('open', item)"
      :aria-label="'Apskatīt dokumentu: ' + documentTitle(item.document)"
    >
      <BlobImage v-if="item.cover" :blob="item.cover" alt="" /><span class="saved-document-copy"
        ><strong>{{ documentTitle(item.document) }}</strong
        ><small
          >{{ t('grouping.types.' + (item.document.values.document_type || 'unknown')) }} ·
          {{ item.document.pageIds.length }} lapas</small
        ><span class="status-chip" :class="{ 'status-success': item.confirmed }">{{
          item.confirmed ? 'Apstiprināts' : 'Jāpārbauda dati'
        }}</span
        ><small v-if="item.memberships.length"
          >Komplektā · {{ item.memberships.map((entry) => entry.name).join(', ') }}</small
        ><small>{{ new Date(item.updatedAt).toLocaleDateString('lv-LV') }}</small
        ><small>{{
          item.draftId
            ? storageLabel('sessions', item.draftId)
            : storageLabel('collections', item.collectionId)
        }}</small
        ><small v-if="item.confirmed && item.document.values.total_amount"
          >{{ item.document.values.total_amount }} {{ item.document.values.currency }}</small
        ></span
      >
    </button>
    <div v-if="item.draftId" class="saved-document-actions">
      <button class="text-link" :disabled="disabled" @click="$emit('remove', item.draftId)">
        Dzēst sesiju
      </button>
    </div>
  </article>
</template>
<style>
.saved-document-card {
  overflow: hidden;
}
.saved-document-open {
  display: flex;
  gap: var(--space-16);
  text-align: left;
  padding: var(--space-16);
  width: 100%;
  min-height: 120px;
  color: inherit;
}
.saved-document-open img {
  width: 65px;
  height: 90px;
  object-fit: cover;
  border-radius: 10px;
  flex-shrink: 0;
}
.saved-document-copy {
  display: grid;
  gap: 7px;
  min-width: 0;
}
.saved-document-copy strong {
  overflow-wrap: anywhere;
}
.saved-document-copy small {
  color: var(--muted);
}
.saved-document-copy .status-chip {
  width: fit-content;
}
.saved-document-actions {
  border-top: 1px solid var(--border);
  padding: 0 var(--space-16);
  display: flex;
  justify-content: flex-end;
}
.saved-document-actions button {
  min-height: 44px;
  font-size: 12px;
  color: var(--muted);
}
</style>
