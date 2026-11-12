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
          <span class="workflow-step-number" aria-hidden="true">{{
            state.complete[number - 1] && state.step !== number ? '✓' : number
          }}</span
          ><span
            >{{ t(`workflow.steps.${number}`)
            }}<small>{{
              t(
                state.complete[number - 1]
                  ? 'workflow.done'
                  : number === 3
                    ? 'workflow.optional'
                    : 'workflow.pending',
              )
            }}</small></span
          >
        </button>
      </li>
    </ol>
  </nav>
</template>
