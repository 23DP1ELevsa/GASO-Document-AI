<script setup>
import { ref, computed, onMounted, onScopeDispose } from 'vue'
import { validCorners } from '../features/processing/geometry'
import { t } from '../locales'
const props = defineProps({
  corners: Array,
  url: String,
  width: Number,
  height: Number,
  disabled: Boolean,
})
const emit = defineEmits(['update'])
const viewport = ref(null),
  board = ref(null),
  viewportWidth = ref(320),
  windowHeight = ref(window.innerHeight),
  zoom = ref(1),
  rejected = ref(false)
const fittedWidth = computed(() =>
  Math.max(
    20,
    Math.min(
      viewportWidth.value - 56,
      ((Math.min(520, windowHeight.value * 0.48) - 56) * props.width) / props.height,
    ),
  ),
)
let observer,
  drag = null
function resize() {
  viewportWidth.value = viewport.value?.clientWidth || 320
  windowHeight.value = window.innerHeight
}
onMounted(() => {
  resize()
  observer = new ResizeObserver(resize)
  observer.observe(viewport.value)
  window.addEventListener('resize', resize)
})
onScopeDispose(() => {
  observer?.disconnect()
  window.removeEventListener('resize', resize)
})
function attempt(index, x, y) {
  if (props.disabled) return
  const next = props.corners.map((point, i) =>
    i === index ? { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) } : { ...point },
  )
  rejected.value = !validCorners(next)
  if (!rejected.value) emit('update', next)
}
function start(event, index) {
  if (props.disabled || event.button > 0) return
  event.preventDefault()
  drag = { index, pointer: event.pointerId }
  event.currentTarget.setPointerCapture(event.pointerId)
}
function move(event) {
  if (!drag || drag.pointer !== event.pointerId) return
  const rect = board.value.getBoundingClientRect()
  attempt(
    drag.index,
    (event.clientX - rect.left) / rect.width,
    (event.clientY - rect.top) / rect.height,
  )
}
function end(event) {
  if (drag?.pointer === event.pointerId) {
    drag = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }
}
function keyboard(event, index) {
  const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  if (!steps[event.key]) return
  event.preventDefault()
  const step = event.shiftKey ? 0.01 : 0.002,
    point = props.corners[index]
  attempt(index, point.x + steps[event.key][0] * step, point.y + steps[event.key][1] * step)
}
function numeric(index, axis, value) {
  if (value === '' || props.disabled) return
  const number = Number(value) / 100
  emit(
    'update',
    props.corners.map((point, i) => (i === index ? { ...point, [axis]: number } : { ...point })),
  )
  rejected.value = false
}
</script>
<template>
  <div class="corner-picker">
    <div class="editor-zoom">
      <label for="editor-zoom">{{ t('editor.zoom') }}</label
      ><input
        id="editor-zoom"
        v-model.number="zoom"
        type="range"
        min="1"
        max="3"
        step=".25"
        :disabled="disabled"
      /><output for="editor-zoom">{{ Math.round(zoom * 100) }}%</output>
    </div>
    <p id="corner-instructions" class="small-muted">{{ t('editor.dragHint') }}</p>
    <div ref="viewport" class="corner-viewport">
      <div
        ref="board"
        class="corner-board"
        data-testid="corner-board"
        :style="{ width: `${fittedWidth * zoom}px`, aspectRatio: `${width} / ${height}` }"
      >
        <img :src="url" :alt="t('editor.original')" draggable="false" />
        <svg class="corner-outline" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          <polygon
            :points="corners.map((point) => `${point.x},${point.y}`).join(' ')"
            :class="{ invalid: !validCorners(corners) }"
          />
        </svg>
        <button
          v-for="(point, index) in corners"
          :key="index"
          class="corner-handle"
          :data-testid="`corner-${index}`"
          :style="{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }"
          :aria-label="t('editor.corner', { number: index + 1 })"
          aria-describedby="corner-instructions"
          :disabled="disabled"
          @pointerdown="start($event, index)"
          @pointermove="move"
          @pointerup="end"
          @pointercancel="end"
          @keydown="keyboard($event, index)"
        >
          {{ index + 1 }}
        </button>
      </div>
    </div>
    <p v-if="rejected" class="editor-validation" role="status">
      {{ t('scan.errors.invalidQuad') }}
    </p>
    <details class="corner-numeric">
      <summary>{{ t('editor.coordinates') }}</summary>
      <div class="corner-numeric-grid">
        <fieldset v-for="(point, index) in corners" :key="index">
          <legend>{{ t('editor.corner', { number: index + 1 }) }}</legend>
          <label v-for="axis in ['x', 'y']" :key="axis"
            >{{ axis.toUpperCase() }} (%)<input
              type="number"
              min="0"
              max="100"
              step="0.1"
              :aria-label="t('editor.axis', { number: index + 1, axis: axis.toUpperCase() })"
              :value="Math.round(point[axis] * 10000) / 100"
              :disabled="disabled"
              @input="numeric(index, axis, $event.target.value)"
          /></label>
        </fieldset>
      </div>
    </details>
  </div>
</template>
