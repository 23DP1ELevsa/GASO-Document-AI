<script setup>
import { t } from '../locales'
defineProps({ state: Object, disabled: Boolean })
defineEmits(['select'])
</script>
<template>
  <nav class="workflow-steps" :aria-label="t('workflow.navigation')">
    <ol>
      <li
        v-for="number in 4"
        :key="number"
        :class="{ current: state.step === number, complete: state.complete[number - 1] }"
      >
        <button
          :disabled="disabled || number > state.maximum"
          :aria-current="state.step === number ? 'step' : undefined"
          @click="$emit('select', number)"
        >
          <span class="sr-only">{{ t(`workflow.steps.${number}`) }}</span>
          <span
            class="step-progress-bar"
            :class="{ filled: number <= state.step }"
            aria-hidden="true"
          />
        </button>
      </li>
    </ol>
  </nav>
</template>
