<script setup>
import { ref } from 'vue'
import {
  listCollections,
  createCollection,
  addDocumentToCollection,
} from '../features/documents/collections.js'
const props = defineProps({ controller: Object, documentId: String })
const open = ref(false),
  items = ref([]),
  chosen = ref(''),
  name = ref(''),
  error = ref(''),
  status = ref(''),
  saving = ref(false),
  addedId = ref(null)
async function show() {
  error.value = ''
  try {
    items.value = await listCollections()
    chosen.value = items.value[0]?.id || ''
    open.value = true
  } catch {
    error.value = 'Neizdevās atvērt komplektus.'
  }
}
async function add() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    if (props.controller.dirty.value) await props.controller.save()
    let id = chosen.value
    if (!id) id = (await createCollection(name.value)).id
    await addDocumentToCollection(id, props.controller.active.value.id, props.documentId)
    open.value = false
    status.value = 'Dokuments pievienots komplektam.'
    addedId.value = id
  } catch (reason) {
    error.value = reason.message || 'Neizdevās saglabāt komplektu.'
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <div class="collection-add">
    <v-btn variant="tonal" block @click="show">Pievienot komplektam</v-btn>
    <p v-if="status" role="status">{{ status }}</p>
    <RouterLink
      v-if="addedId"
      class="text-link"
      :to="{ name: 'collections', query: { collection: addedId } }"
      >Apskatīt komplektu</RouterLink
    >
    <p v-if="error && !open" role="alert">{{ error }}</p>
    <v-dialog v-model="open" :persistent="saving" aria-label="Pievienot komplektam">
      <v-card class="collection-dialog app-dialog"
        ><h2>Pievienot komplektam</h2>
        <label
          >Komplekts<select v-model="chosen" :disabled="saving">
            <option value="">Jauns komplekts</option>
            <option v-for="item in items" :value="item.id" :key="item.id">{{ item.name }}</option>
          </select></label
        >
        <label v-if="!chosen"
          >Komplekta nosaukums<input v-model="name" maxlength="100" :disabled="saving"
        /></label>
        <p v-if="error" role="alert">{{ error }}</p>
        <v-btn color="primary" :disabled="saving || (!chosen && !name.trim())" @click="add"
          >Pievienot</v-btn
        >
        <v-btn variant="text" :disabled="saving" @click="open = false">Atcelt</v-btn>
      </v-card>
    </v-dialog>
  </div>
</template>
<style>
.collection-add {
  margin-bottom: 16px;
}
.collection-dialog label {
  display: grid;
  gap: var(--space-8);
}
</style>
