<script setup>
import { OCR_LANGUAGES } from '../features/ocr/model.js'
import { t } from '../locales'
const props = defineProps({ modelValue: { type: Array, required: true }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
function toggle(lang, checked) {
  const next = checked
    ? [...props.modelValue, lang]
    : props.modelValue.filter((item) => item !== lang)
  if (next.length) emit('update:modelValue', next)
}
</script>
<template>
  <fieldset class="ocr-languages" :disabled="disabled">
    <legend>{{ t('ocr.languages') }}</legend>
    <label v-for="lang in OCR_LANGUAGES" :key="lang">
      <input
        type="checkbox"
        :checked="modelValue.includes(lang)"
        :disabled="disabled || (modelValue.length === 1 && modelValue.includes(lang))"
        @change="toggle(lang, $event.target.checked)"
      />
      {{ t(`ocr.language.${lang}`) }}
    </label>
  </fieldset>
</template>
