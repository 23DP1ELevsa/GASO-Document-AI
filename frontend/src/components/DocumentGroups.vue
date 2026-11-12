<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import BlobImage from './BlobImage.vue'
import DocumentInformation from './DocumentInformation.vue'
import {
  documentPages,
  unassignedPages,
  isAnalysisStale,
  isConfirmationCurrent,
} from '../features/documents/model.js'
import { suggestBoundaries } from '../features/documents/analysis.js'
import { t } from '../locales'

const props = defineProps({ session: Object, disabled: Boolean })
const emit = defineEmits(['change', 'analyze', 'pdf'])
const groupRoot = ref(null)
async function showInformation(id) {
  infoId.value = id
  await nextTick()
  groupRoot.value?.querySelector('[data-testid="document-information"]')?.focus()
}
defineExpose({ showInformation })
const selected = ref([]),
  targets = ref({}),
  mergeTargets = ref({}),
  infoId = ref(null),
  newTitle = ref('')
const documents = computed(() => props.session.documents)
const unassigned = computed(() => unassignedPages(props.session))
watch(
  () => documents.value.map((document) => document.id).join('|'),
  () => {
    const ids = new Set(documents.value.map((document) => document.id))
    targets.value = Object.fromEntries(
      Object.entries(targets.value).filter(([, id]) => id === '' || ids.has(id)),
    )
    mergeTargets.value = Object.fromEntries(
      Object.entries(mergeTargets.value).filter(([, id]) => ids.has(id)),
    )
    if (!ids.has(infoId.value)) infoId.value = null
  },
)
const groupPages = (document) => documentPages(props.session, document)
const title = (document) =>
  document.values.document_title ||
  t('grouping.untitled', { number: documents.value.indexOf(document) + 1 })
const selectedFor = (pages) =>
  pages.map((page) => page.id).filter((id) => selected.value.includes(id))
function toggle(id, checked) {
  selected.value = checked
    ? [...new Set([...selected.value, id])]
    : selected.value.filter((item) => item !== id)
}
function change(action, ...args) {
  emit('change', action, ...args)
  selected.value = []
}
function create() {
  change('createDocument', selectedFor(unassigned.value), newTitle.value)
  newTitle.value = ''
}
function analyze(id) {
  emit('analyze', id)
  infoId.value = id
}
function merge(document) {
  const target = documents.value.find((item) => item.id === mergeTargets.value[document.id])
  if (target && window.confirm(t('grouping.confirmMerge', { target: title(target) })))
    change('mergeDocuments', target.id, document.id)
}
function boundaries(document) {
  return suggestBoundaries(groupPages(document))
}
function applyBoundaries(document) {
  const suggestions = boundaries(document)
  if (
    !suggestions.length ||
    !window.confirm(
      t('grouping.confirmBoundaries', {
        pages: suggestions
          .map((item) => `${item.index + 1} (${item.previousNumber} → ${item.nextNumber})`)
          .join(', '),
      }),
    )
  )
    return
  const ids = [...document.pageIds]
  // Split from the end so every remaining segment still belongs to the original document.
  let end = ids.length
  for (const item of [...suggestions].reverse()) {
    change('splitDocument', document.id, ids.slice(item.index, end))
    end = item.index
  }
}
</script>
<template>
  <section
    ref="groupRoot"
    class="document-groups"
    :aria-label="t('grouping.title')"
    data-testid="document-groups"
  >
    <header>
      <h2>
        {{ t('grouping.title') }} <span class="count-badge">{{ documents.length }}</span>
      </h2>
      <p class="small-muted">{{ t('grouping.hint') }}</p>
    </header>
    <form class="group-create bordered-card" @submit.prevent="create">
      <label
        >{{ t('grouping.newTitle')
        }}<input v-model="newTitle" maxlength="2000" :disabled="disabled"
      /></label>
      <v-btn type="submit" color="primary" :disabled="disabled">{{ t('grouping.create') }}</v-btn>
      <p class="small-muted">{{ t('grouping.createHint') }}</p>
    </form>
    <div class="unassigned-pages bordered-card" data-testid="unassigned-pages">
      <h3>{{ t('grouping.unassigned') }} ({{ unassigned.length }})</h3>
      <p v-if="!unassigned.length" class="small-muted">{{ t('grouping.allAssigned') }}</p>
      <div v-for="page in unassigned" :key="page.id" class="group-page-row">
        <label class="group-page-choice"
          ><input
            type="checkbox"
            :checked="selected.includes(page.id)"
            :disabled="disabled"
            @change="toggle(page.id, $event.target.checked)"
          /><span
            >{{ t('scan.pageNumber', { number: session.pages.indexOf(page) + 1 }) }} ·
            {{ page.name }}</span
          ></label
        >
      </div>
      <div v-if="unassigned.length && documents.length" class="group-actions">
        <label
          >{{ t('grouping.moveTarget')
          }}<select v-model="targets.unassigned" :disabled="disabled">
            <option :value="undefined" disabled>{{ t('grouping.choose') }}</option>
            <option v-for="document in documents" :key="document.id" :value="document.id">
              {{ title(document) }}
            </option>
          </select></label
        >
        <v-btn
          variant="tonal"
          :disabled="disabled || !targets.unassigned || !selectedFor(unassigned).length"
          @click="change('assignPages', selectedFor(unassigned), targets.unassigned)"
          >{{ t('grouping.moveSelected') }}</v-btn
        >
      </div>
    </div>
    <article
      v-for="document in documents"
      :key="document.id"
      class="document-group-card bordered-card"
      data-testid="document-group"
    >
      <header class="document-group-heading">
        <BlobImage
          v-if="groupPages(document)[0]"
          :blob="groupPages(document)[0].thumbnail"
          :alt="t('grouping.cover')"
        />
        <div>
          <h3>{{ title(document) }}</h3>
          <p>
            {{ t(`grouping.types.${document.values.document_type || 'unknown'}`) }} ·
            {{ t('scan.pageCount', { count: document.pageIds.length }) }}
          </p>
          <p v-if="isAnalysisStale(session, document)" class="ocr-warning">
            {{ t('grouping.staleLabel') }}
          </p>
          <p v-if="isConfirmationCurrent(session, document)" class="small-muted">
            {{ t('grouping.confirmed') }}
          </p>
        </div>
      </header>
      <label class="group-name"
        >{{ t('grouping.rename')
        }}<input
          :value="document.values.document_title ?? ''"
          maxlength="2000"
          :disabled="disabled"
          @input="emit('change', 'editValue', document.id, 'document_title', $event.target.value)"
      /></label>
      <details class="group-membership" :open="!document.pageIds.length">
        <summary>{{ t('grouping.editPages') }}</summary>
        <p v-if="!document.pageIds.length" class="small-muted">{{ t('grouping.empty') }}</p>
        <div v-for="(page, index) in groupPages(document)" :key="page.id" class="group-page-row">
          <label class="group-page-choice"
            ><input
              type="checkbox"
              :checked="selected.includes(page.id)"
              :disabled="disabled"
              @change="toggle(page.id, $event.target.checked)"
            /><span>{{ index + 1 }}. {{ page.name }}</span></label
          >
          <div class="group-page-order">
            <v-btn
              variant="text"
              size="small"
              :disabled="disabled || index === 0"
              :aria-label="t('grouping.moveUp', { number: index + 1 })"
              @click="emit('change', 'reorderPage', document.id, page.id, -1)"
              >↑</v-btn
            ><v-btn
              variant="text"
              size="small"
              :disabled="disabled || index === document.pageIds.length - 1"
              :aria-label="t('grouping.moveDown', { number: index + 1 })"
              @click="emit('change', 'reorderPage', document.id, page.id, 1)"
              >↓</v-btn
            >
          </div>
        </div>
        <div v-if="document.pageIds.length" class="group-actions">
          <label
            >{{ t('grouping.moveTarget')
            }}<select v-model="targets[document.id]" :disabled="disabled">
              <option :value="undefined" disabled>{{ t('grouping.choose') }}</option>
              <option value="">{{ t('grouping.unassigned') }}</option>
              <option
                v-for="target in documents.filter((item) => item.id !== document.id)"
                :key="target.id"
                :value="target.id"
              >
                {{ title(target) }}
              </option>
            </select></label
          >
          <v-btn
            variant="tonal"
            :disabled="
              disabled ||
              targets[document.id] === undefined ||
              !selectedFor(groupPages(document)).length
            "
            @click="
              change('assignPages', selectedFor(groupPages(document)), targets[document.id] || null)
            "
            >{{ t('grouping.moveSelected') }}</v-btn
          >
          <v-btn
            variant="tonal"
            :disabled="
              disabled ||
              !selectedFor(groupPages(document)).length ||
              selectedFor(groupPages(document)).length === document.pageIds.length
            "
            @click="change('splitDocument', document.id, selectedFor(groupPages(document)))"
            >{{ t('grouping.split') }}</v-btn
          >
        </div>
        <p class="small-muted">{{ t('grouping.splitHint') }}</p>
      </details>
      <div class="group-actions">
        <v-btn
          variant="tonal"
          color="primary"
          :disabled="disabled || !document.pageIds.length"
          @click="emit('pdf', document.id, $event.currentTarget)"
          >{{ t('pdf.create') }}</v-btn
        >
        <v-btn
          variant="tonal"
          color="primary"
          :aria-expanded="infoId === document.id"
          @click="infoId = infoId === document.id ? null : document.id"
          >{{ t('grouping.information') }}</v-btn
        >
        <v-btn
          variant="text"
          :disabled="disabled || !document.pageIds.length"
          @click="analyze(document.id)"
          >{{ t('grouping.analyze') }}</v-btn
        >
        <v-btn
          v-if="boundaries(document).length"
          variant="text"
          :disabled="disabled"
          @click="applyBoundaries(document)"
          >{{ t('grouping.boundaries', { count: boundaries(document).length }) }}</v-btn
        >
      </div>
      <details class="group-other-actions">
        <summary>{{ t('grouping.otherActions') }}</summary>
        <div v-if="documents.length > 1" class="group-actions">
          <label
            >{{ t('grouping.mergeTarget')
            }}<select v-model="mergeTargets[document.id]" :disabled="disabled">
              <option :value="undefined" disabled>{{ t('grouping.choose') }}</option>
              <option
                v-for="target in documents.filter((item) => item.id !== document.id)"
                :key="target.id"
                :value="target.id"
              >
                {{ title(target) }}
              </option>
            </select></label
          >
          <v-btn
            variant="tonal"
            :disabled="disabled || !mergeTargets[document.id]"
            @click="merge(document)"
            >{{ t('grouping.merge') }}</v-btn
          >
        </div>
        <v-btn
          variant="text"
          color="error"
          :disabled="disabled"
          @click="change('deleteDocument', document.id)"
          >{{ t('grouping.delete') }}</v-btn
        >
        <p class="small-muted">{{ t('grouping.deleteHint') }}</p>
      </details>
      <DocumentInformation
        v-if="infoId === document.id"
        :document="document"
        :session="session"
        :disabled="disabled"
        @value="(key, value) => emit('change', 'editValue', document.id, key, value)"
        @analyze="emit('analyze', document.id)"
        @confirm="emit('change', 'confirmDocument', document.id)"
        @custom="(label, value) => emit('change', 'addCustomField', document.id, label, value)"
      />
    </article>
    <p class="small-muted">{{ t('grouping.saveHint') }}</p>
  </section>
</template>
