<script setup>
import AppIcon from './AppIcon.vue'
defineProps({ filename: String, warning: String, disabled: Boolean })
defineEmits(['next', 'back'])
</script>
<template>
  <section class="export-complete">
    <span class="complete-symbol"><AppIcon name="check" :size="44" /></span>
    <h2>Gatavs!</h2>
    <p>PDF nodots jūsu ierīces lejupielādēm.</p>
    <div class="complete-file">
      <AppIcon name="file" :size="24" /><span>{{ filename }}</span
      ><AppIcon name="check" :size="18" />
    </div>
    <p v-if="warning" class="scan-error" role="alert">{{ warning }}</p>
    <p class="small-muted">Dokumentu varēsiet turpināt rediģēt sadaļā “Dokumenti”.</p>
    <div class="complete-actions">
      <v-btn color="primary" block size="x-large" :disabled="disabled" @click="$emit('next')"
        ><AppIcon name="camera" :size="20" />Skenēt nākamo dokumentu</v-btn
      >
      <v-btn to="/documents" variant="text" block :disabled="disabled">Uz dokumentiem</v-btn>
      <button class="text-link" :disabled="disabled" @click="$emit('back')">
        Izveidot PDF vēlreiz
      </button>
    </div>
  </section>
</template>
