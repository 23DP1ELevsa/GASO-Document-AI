<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
const props = defineProps({ active: Boolean, progress: Object })
defineEmits(['cancel'])
const statuses = {
  preparing: 'Sagatavo fotoattēlus…',
  waiting: 'AI analizē dokumentu…',
  processing: 'Apstrādā atrastos datus…',
  saving: 'Sagatavo rezultātu…',
}
const status = computed(() => statuses[props.progress?.phase] || statuses.preparing)
const measured = computed(() => props.progress?.phase === 'preparing' && props.progress.total > 0)
</script>
<template>
  <v-dialog
    :model-value="active"
    persistent
    max-width="370"
    class="ai-overlay"
    aria-labelledby="ai-status"
    :retain-focus="true"
  >
    <v-card class="ai-progress-card" role="status" aria-live="polite" aria-busy="true">
      <span class="ai-orbit"><AppIcon name="sparkles" :size="32" /></span>
      <h2 id="ai-status">{{ status }}</h2>
      <p>Dokuments tiek apstrādāts. Tas var aizņemt ilgāku laiku.</p>
      <v-progress-linear
        :indeterminate="!measured"
        :model-value="measured ? (progress.completed / progress.total) * 100 : undefined"
        rounded
        height="6"
        color="primary"
        aria-label="Dokumenta analīzes progress"
      />
      <small v-if="measured">{{ progress.completed }} no {{ progress.total }} lapām</small>
      <v-btn variant="text" @click="$emit('cancel')">Atcelt analīzi</v-btn>
    </v-card>
  </v-dialog>
</template>
<style>
.ai-overlay .v-overlay__scrim {
  background: #101a2d;
  opacity: 0.56;
  backdrop-filter: blur(8px);
}
.ai-overlay .v-overlay__content {
  margin-top: max(24px, env(safe-area-inset-top));
  margin-bottom: max(24px, env(safe-area-inset-bottom));
}
.ai-progress-card {
  padding: 32px 24px 20px;
  text-align: center;
  border-radius: 26px !important;
  gap: 18px;
}
.ai-progress-card h2 {
  font-size: 19px;
}
.ai-progress-card p {
  font-size: 14px;
  opacity: 0.7;
}
.ai-orbit {
  display: grid;
  place-items: center;
  margin: 0 auto;
  width: 72px;
  height: 72px;
  border-radius: 24px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
  animation: ai-breathe 2s ease-in-out infinite;
}
@keyframes ai-breathe {
  50% {
    transform: scale(1.08);
    opacity: 0.65;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ai-overlay *,
  .ai-orbit {
    animation: none !important;
    transition: none !important;
  }
}
</style>
