<script setup>
import { computed, ref } from 'vue'
import BlobImage from './BlobImage.vue'
import DocumentInformation from './DocumentInformation.vue'
import { documentPages, isConfirmationCurrent } from '../features/documents/model.js'
const props = defineProps({
  session: Object,
  document: Object,
  disabled: Boolean,
  aiConsent: Boolean,
  aiFailed: Boolean,
})
const emit = defineEmits(['consent', 'select', 'preview', 'recognize', 'change'])
const information = ref(null)
defineExpose({ focusInvalid: () => information.value?.focusInvalid() })
const pages = computed(() => documentPages(props.session, props.document))
const documents = computed(() => props.session.documents.filter((item) => item.pageIds.length))
</script>
<template>
  <section class="workflow-review">
    <label v-if="documents.length > 1" class="workflow-document-select"
      >Dokuments
      <select
        :value="document.id"
        :disabled="disabled"
        @change="emit('select', $event.target.value)"
      >
        <option v-for="(item, index) in documents" :key="item.id" :value="item.id">
          {{ item.values.document_title || 'Dokuments ' + (index + 1)
          }}{{ isConfirmationCurrent(session, item) ? ' · Apstiprināts' : '' }}
        </option>
      </select>
    </label>
    <div class="review-preview-strip">
      <button
        v-for="(page, index) in pages"
        :key="page.id"
        :disabled="disabled"
        :aria-label="'Apskatīt lapu ' + (index + 1)"
        @click="emit('preview', page, $event.currentTarget)"
      >
        <BlobImage :blob="page.thumbnail" alt="" /><span>{{ index + 1 }}</span>
      </button>
    </div>
    <v-btn
      v-if="pages.length"
      variant="text"
      :disabled="disabled"
      @click="emit('preview', pages[0], $event.currentTarget)"
      >Apskatīt oriģinālu</v-btn
    >
    <component :is="document.analysis ? 'details' : 'div'" class="bordered-card analysis-choice">
      <summary v-if="document.analysis">Analizēt atkārtoti</summary>
      <h3>AI dokumenta analīze</h3>
      <p>
        Šī dokumenta fotoattēli tiks nosūtīti OpenAI. Izmantojiet tikai dokumentus, kuru nosūtīšana
        ir atļauta.
      </p>
      <label class="analysis-consent"
        ><input
          type="checkbox"
          :checked="aiConsent"
          :disabled="disabled"
          @change="emit('consent', $event.target.checked)"
        />Piekrītu šī dokumenta fotoattēlu nosūtīšanai OpenAI.</label
      >
      <v-btn color="primary" :disabled="disabled || !aiConsent" @click="emit('recognize')">{{
        document.analysis ? 'Analizēt atkārtoti' : 'Analizēt dokumentu'
      }}</v-btn>
      <p v-if="aiFailed" role="status">
        Varat aizpildīt informāciju manuāli vai saglabāt tikai skenējumu.
      </p>
    </component>
    <DocumentInformation
      ref="information"
      :key="document.id"
      :document="document"
      :session="session"
      :disabled="disabled"
      managed
      @value="(key, value) => emit('change', 'editValue', document.id, key, value)"
      @custom="(label, value) => emit('change', 'addCustomField', document.id, label, value)"
      @rename="(key, label) => emit('change', 'renameCustomField', document.id, key, label)"
      @remove="(key) => emit('change', 'removeCustomField', document.id, key)"
      @review="(key) => emit('change', 'reviewAttribute', document.id, key)"
    />
  </section>
</template>
