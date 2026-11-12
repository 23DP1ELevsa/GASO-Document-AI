<script setup>
import { computed, ref, watch } from 'vue'
import BlobImage from './BlobImage.vue'
import { t } from '../locales'
const props = defineProps({ pages: Array, disabled: Boolean })
const emit = defineEmits(['create'])
const starts = ref([])
watch(
  () => props.pages.map((page) => page.id).join('|'),
  () => {
    starts.value = starts.value.filter((id) => props.pages.some((page) => page.id === id))
  },
)
const count = computed(() =>
  props.pages.length ? 1 + starts.value.filter((id) => id !== props.pages[0].id).length : 0,
)
function toggle(id, checked) {
  starts.value = checked
    ? [...new Set([...starts.value, id])]
    : starts.value.filter((item) => item !== id)
}
function number(index) {
  return 1 + props.pages.slice(1, index + 1).filter((page) => starts.value.includes(page.id)).length
}
</script>
<template>
  <section v-if="pages.length" class="boundary-picker" data-testid="boundary-picker">
    <p>{{ t('workflow.groupExplanation') }}</p>
    <div class="boundary-grid">
      <article
        v-for="(page, index) in pages"
        :key="page.id"
        :class="{ 'boundary-start': index === 0 || starts.includes(page.id) }"
      >
        <BlobImage :blob="page.thumbnail" :alt="t('scan.pageNumber', { number: index + 1 })" /><span
          class="boundary-document"
          >{{ t('workflow.documentNumber', { number: number(index) }) }}</span
        >
        <p>{{ t('scan.pageNumber', { number: index + 1 }) }}</p>
        <label v-if="index"
          ><input
            type="checkbox"
            :checked="starts.includes(page.id)"
            :disabled="disabled"
            @change="toggle(page.id, $event.target.checked)"
          />{{ t('workflow.startHere') }}</label
        >
        <p v-else class="small-muted">{{ t('workflow.firstPage') }}</p>
      </article>
    </div>
    <v-btn color="primary" size="large" :disabled="disabled" @click="emit('create', starts)">{{
      t('workflow.createGroups', { count })
    }}</v-btn>
  </section>
</template>
