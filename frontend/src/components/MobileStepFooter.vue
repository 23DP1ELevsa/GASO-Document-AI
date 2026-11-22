<script setup>
import WorkflowSteps from './WorkflowSteps.vue'
import AppIcon from './AppIcon.vue'
defineProps({
  state: Object,
  disabled: Boolean,
  saving: Boolean,
  dirty: Boolean,
  saved: Boolean,
  failed: Boolean,
  canSave: Boolean,
  hint: String,
})
defineEmits(['select', 'save'])
</script>

<template>
  <footer class="mobile-step-footer">
    <div class="step-footer-meta">
      <span>Solis {{ state.step }} no 4</span>
      <div class="workspace-savebar">
        <span role="status" :class="{ 'save-failed': failed }">
          <AppIcon v-if="saved && !dirty && !saving && !failed" name="check" :size="14" />
          <strong>{{
            saving
              ? 'Saglabā…'
              : failed
                ? 'Nav saglabāts'
                : dirty
                  ? 'Nesaglabāts'
                  : saved
                    ? 'Saglabāts ierīcē'
                    : 'Jauns dokuments'
          }}</strong>
        </span>
        <button
          v-if="dirty || failed"
          class="save-retry"
          :disabled="disabled || !canSave"
          :aria-label="failed ? 'Mēģināt saglabāt vēlreiz' : 'Saglabāt melnrakstu'"
          @click="$emit('save')"
        >
          {{ failed ? 'Mēģināt vēlreiz' : 'Saglabāt' }}
        </button>
      </div>
    </div>
    <WorkflowSteps :state="state" :disabled="disabled" @select="$emit('select', $event)" />
    <p v-if="hint" class="step-footer-hint">{{ hint }}</p>
    <div class="step-footer-actions"><slot /></div>
  </footer>
</template>
