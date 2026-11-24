<script setup>
import { computed, ref } from 'vue'
import AppIcon from './AppIcon.vue'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  name: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  icon: { type: String, default: '' },
  description: { type: String, default: '' },
  describedBy: { type: String, default: '' },
  errors: { type: Array, default: () => [] },
})
const model = defineModel({ type: String, required: true })
const visible = ref(false)
const inputId = computed(() => `auth-${props.name}`)
const descriptionIds = computed(() =>
  [
    props.description && `${inputId.value}-hint`,
    props.describedBy,
    props.errors.length && `${inputId.value}-error`,
  ]
    .filter(Boolean)
    .join(' '),
)
</script>

<template>
  <div class="auth-field">
    <label :for="inputId">{{ label }}</label>
    <div class="auth-field-control" :class="{ 'auth-field-invalid': errors.length }">
      <AppIcon v-if="icon" :name="icon" size="20" class="auth-field-icon" />
      <input
        :id="inputId"
        v-bind="$attrs"
        v-model="model"
        :name="name"
        :type="visible ? 'text' : type"
        :aria-invalid="errors.length ? 'true' : undefined"
        :aria-describedby="descriptionIds || undefined"
        required
      />
      <button
        v-if="type === 'password'"
        type="button"
        :aria-controls="inputId"
        :aria-label="
          name === 'password_confirmation'
            ? visible
              ? 'Paslēpt paroles apstiprinājumu'
              : 'Rādīt paroles apstiprinājumu'
            : visible
              ? 'Paslēpt paroli'
              : 'Rādīt paroli'
        "
        @pointerdown.prevent
        @click="visible = !visible"
      >
        <AppIcon :name="visible ? 'eyeOff' : 'eye'" size="21" />
      </button>
    </div>
    <p v-if="description" :id="`${inputId}-hint`" class="auth-field-hint">{{ description }}</p>
    <div v-if="errors.length" :id="`${inputId}-error`" class="auth-field-error" role="alert">
      <p v-for="error in errors" :key="error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.auth-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.auth-field label {
  font-size: var(--text-label);
  font-weight: 750;
  line-height: 1.35;
}
.auth-field-control {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 54px;
  border: 1px solid var(--border-input);
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
}
.auth-field-control:focus-within {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.3);
}
.auth-field-invalid {
  border-color: rgb(var(--v-theme-error));
}
.auth-field-icon {
  flex: none;
  margin-inline-start: 14px;
  color: var(--muted);
}
.auth-field input {
  flex: 1 1 0;
  min-width: 0;
  min-height: 52px;
  padding-inline: 14px;
  border-radius: inherit;
  font-size: 1rem;
  scroll-margin-block: 16px;
}
.auth-field-icon + input {
  padding-inline-start: 10px;
}
.auth-field input:focus {
  outline: none;
}
.auth-field input::placeholder {
  color: var(--muted);
  opacity: 1;
}
.auth-field button {
  display: grid;
  flex: none;
  width: 48px;
  min-height: 48px;
  margin-inline-end: 2px;
  place-items: center;
  border-radius: 12px;
  color: var(--muted);
}
.auth-field button:hover {
  color: var(--accent-text);
  background: var(--soft);
}
.auth-field-hint,
.auth-field-error {
  font-size: var(--text-small);
}
.auth-field-hint {
  color: var(--muted);
}
.auth-field-error {
  color: rgb(var(--v-theme-error));
}
</style>
