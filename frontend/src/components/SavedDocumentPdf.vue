<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { createPdfService } from '../features/pdf/pdfService.js'
import { createExportSnapshot } from '../features/pdf/model.js'
import { readImageRecord, loadDraft } from '../features/scanning/draftRepository.js'
import { resolveDocumentImage } from '../features/processing/imageSource.js'
import { processingJob } from '../features/processing/processor.js'
const props = defineProps({
  session: Object,
  documentId: String,
  frozen: Boolean,
  confirmed: Boolean,
})
const emit = defineEmits(['close'])
const busy = ref(false),
  error = ref(''),
  url = ref(''),
  filename = ref('Dokuments.pdf'),
  scansOnly = ref(!props.confirmed),
  progress = ref('')
let disposed = false
const service = createPdfService({
  readImage: async (page) =>
    resolveDocumentImage(page, {
      readImageRecord: () => readImageRecord(page.imageRecordId || page.id),
      processingJob,
    }),
})
const embeddedViewer = ref(navigator.pdfViewerEnabled === true)
function clear() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
}
async function checkSource() {
  if (!props.frozen && (await loadDraft(props.session.id)).revision !== props.session.revision)
    throw new Error('Dokuments ir mainīts. Atveriet to atkārtoti.')
}
async function generate() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  clear()
  try {
    await checkSource()
    const snapshot = createExportSnapshot(props.session, props.documentId, {
      includeInformation: !scansOnly.value,
      quality: 'high',
    })
    snapshot.pages = snapshot.pages.map((page) => ({
      ...page,
      imageRecordId: props.session.pages.find((item) => item.id === page.id)?.imageRecordId,
    }))
    const result = await service.generate(snapshot, (item) => {
      progress.value = 'Sagatavo PDF · ' + item.completed + ' no ' + item.total + ' lapām'
    })
    await checkSource()
    if (disposed) return
    filename.value = snapshot.metadata.filename
    url.value = URL.createObjectURL(result.blob)
  } catch (reason) {
    if (!disposed)
      error.value =
        reason.message === 'cancelled'
          ? 'PDF izveide atcelta.'
          : 'Neizdevās izveidot PDF. ' + (reason.message || '')
  } finally {
    busy.value = false
  }
}
async function download(event, newTab = false) {
  event.preventDefault()
  try {
    await checkSource()
    if (newTab) window.open(url.value, '_blank', 'noopener,noreferrer')
    else {
      const link = document.createElement('a')
      link.href = url.value
      link.download = filename.value
      link.click()
    }
  } catch (reason) {
    event.preventDefault()
    clear()
    error.value = reason.message
  }
}
onMounted(generate)
onUnmounted(() => {
  disposed = true
  service.dispose()
  clear()
})
</script>
<template>
  <v-dialog
    :model-value="true"
    max-width="430"
    aria-label="PDF eksports"
    @update:model-value="!$event && emit('close')"
  >
    <v-card class="saved-pdf-dialog"
      ><header>
        <h2>PDF eksports</h2>
        <v-btn variant="text" aria-label="Aizvērt PDF" @click="emit('close')">Aizvērt</v-btn>
      </header>
      <label
        ><input
          v-model="scansOnly"
          type="checkbox"
          :disabled="busy || !confirmed"
          @change="generate"
        />
        Tikai skenētās lapas</label
      >
      <div v-if="busy" class="pdf-progress" role="status">
        <p>{{ progress || 'Sagatavo PDF…' }}</p>
        <v-progress-linear indeterminate color="primary" /><v-btn
          variant="text"
          @click="service.cancel()"
          >Atcelt izveidi</v-btn
        >
      </div>
      <p v-if="error" class="scan-error" role="alert">{{ error }}</p>
      <template v-if="url">
        <iframe
          v-if="embeddedViewer"
          :src="`${url}#view=FitH`"
          title="PDF priekšskatījums"
          @error="embeddedViewer = false"
        />
        <a class="collection-download" :href="url" :download="filename" @click="download"
          >Lejupielādēt PDF</a
        ><a :href="url" target="_blank" rel="noopener noreferrer" @click="download($event, true)"
          >Atvērt PDF jaunā cilnē</a
        ></template
      >
      <v-btn v-if="error" variant="tonal" :disabled="busy" @click="generate">Mēģināt vēlreiz</v-btn>
      <p class="small-muted">PDF tiek izveidots no saglabātajām fotogrāfijām un atribūtiem.</p>
    </v-card>
  </v-dialog>
</template>
<style>
.saved-pdf-dialog {
  padding: 20px;
  gap: 18px;
  border-radius: 24px !important;
}
.saved-pdf-dialog header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
  align-items: center;
  justify-content: space-between;
}
.saved-pdf-dialog iframe {
  display: block;
  width: 100%;
  height: 40vh;
  border: 0;
}
</style>
