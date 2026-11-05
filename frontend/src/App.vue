<script setup>
import { computed, ref, watch } from 'vue'
import { rectangle, compareReading } from './crop.js'

const file = ref(null), source = ref(null), crop = ref({ x: .1, y: .3, width: .8, height: .2 })
const preview = ref(null), result = ref(null), busy = ref(false), error = ref(''), notice = ref('')
const consent = ref(false), expected = ref(''), records = ref([]), variants = ref([])
const options = ref({ max_edge: 1600, brightness: 0, contrast: 0, angle: 0, denoise: false })
const perspective = ref(false), points = ref([[0,0],[1,0],[1,1],[0,1]])
const labels = ['Augšējais kreisais', 'Augšējais labais', 'Apakšējais labais', 'Apakšējais kreisais']
let start = null
const cropStyle = computed(() => ({ left: `${crop.value.x * 100}%`, top: `${crop.value.y * 100}%`, width: `${crop.value.width * 100}%`, height: `${crop.value.height * 100}%` }))
const comparison = computed(() => compareReading(expected.value, result.value?.reading))

watch([crop, options, perspective, points], () => {
  preview.value = null; consent.value = false; result.value = null; variants.value = []
}, { deep: true, flush: 'sync' })

async function post(path, extra = {}, selectedOptions = options.value) {
  const form = new FormData()
  form.append('image', file.value)
  for (const [key, value] of Object.entries({ ...crop.value, ...selectedOptions, ...extra })) form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : value)
  if (perspective.value) points.value.forEach((p, i) => p.forEach((n, j) => form.append(`points[${i}][${j}]`, n)))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 65000)
  try {
    const response = await fetch(`/api/${path}`, { method: 'POST', body: form, headers: { Accept: 'application/json' }, signal: controller.signal })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.message || (response.status === 413 ? 'Attēls pārsniedz servera augšupielādes limitu.' : 'Servera kļūda. Mēģiniet vēlreiz.'))
    return data
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Pārsniegts gaidīšanas laiks. Varat mēģināt vēlreiz.')
    throw e
  } finally { clearTimeout(timer) }
}

async function run(action) {
  busy.value = true; error.value = ''
  try { await action() } catch (e) { error.value = e.message || 'Savienojuma kļūda.' } finally { busy.value = false }
}

async function selectFile(event) {
  const selected = event.target.files?.[0]
  source.value = null; preview.value = null; result.value = null; variants.value = []; consent.value = false; expected.value = ''; notice.value = ''; error.value = ''
  file.value = null
  if (!selected) return
  if (selected.size > 20 * 1024 * 1024) { error.value = 'Maksimālais faila izmērs ir 20 MB.'; return }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { error.value = 'Izvēlieties JPEG, PNG vai WebP attēlu.'; return }
  file.value = selected
  await run(async () => {
    const data = await post('inspect')
    source.value = data
    crop.value = data.suggested_crop || { x: .1, y: .3, width: .8, height: .2 }
    points.value = [[0,0],[1,0],[1,1],[0,1]]; perspective.value = false
    notice.value = data.suggested_crop ? 'Atrasts eksperimentāls lodziņa ieteikums. Pārbaudiet un koriģējiet to.' : 'Lodziņu nevar droši noteikt. Iezīmējiet tikai ciparu lodziņu.'
  })
}

function position(event) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return { x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) }
}
function pointerDown(event) {
  if (busy.value) return
  start = position(event); event.currentTarget.setPointerCapture(event.pointerId)
}
function pointerMove(event) { if (start && !busy.value) crop.value = rectangle(start, position(event)) }
function pointerUp(event) { if (start) { pointerMove(event); start = null } }

function makePreview() { return run(async () => { preview.value = await post('preview'); consent.value = false }) }
function recognize() {
  if (!preview.value || !consent.value) return
  return run(async () => {
    result.value = await post('recognize', { privacy_confirmed: true })
    records.value.unshift({ name: file.value.name, expected: expected.value, reading: result.value.reading, comparison: compareReading(expected.value, result.value.reading), ...options.value, cost: result.value.estimated_cost_usd })
  })
}
function compareVariants() {
  return run(async () => {
    variants.value = []
    for (const edge of [1024, 1600, 2048]) {
      for (const contrast of [0, 10]) {
        const image = await post('preview', {}, { ...options.value, max_edge: edge, contrast })
        variants.value.push({ edge, contrast, ...image })
      }
    }
  })
}
function useVariant(variant) {
  options.value = { ...options.value, max_edge: variant.edge, contrast: variant.contrast }
  preview.value = { data_url: variant.data_url, width: variant.width, height: variant.height, bytes: variant.bytes }
}
</script>

<template>
  <main>
    <header><p class="eyebrow">Trello #07 · #08</p><h1>GASO Meter AI</h1><p>Gāzes skaitītāja veselo m³ atpazīšanas un attēlu optimizācijas prototips</p></header>
    <p class="info">Izmantojiet tikai savus vai atļautus testēšanas attēlus. Attēli netiek pastāvīgi saglabāti. OpenAI saņem tikai apstiprināto fragmentu.</p>
    <label class="upload">1. Izvēlieties fotogrāfiju (JPEG, PNG, WebP; līdz 20 MB)<input aria-label="Fotogrāfija" type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy" @change="selectFile"></label>
    <p v-if="busy" role="status">Apstrādā…</p><p v-if="error" class="error" role="alert">{{ error }}</p>
    <template v-if="source">
      <section><h2>2. Atlasiet ciparu lodziņu</h2><p>{{ notice }}</p><p>Velciet pāri attēlam, lai iezīmētu jaunu apgabalu. Precīzai korekcijai izmantojiet koordinātas (0–1). Atlasiet tikai rādījumu lodziņu, saglabājot redzamu decimālatdalītāju.</p>
        <div class="selection" :class="{ disabled: busy }" @pointerdown.prevent="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="start = null">
          <img :src="source.original.data_url" alt="Sākotnējais attēls ar koriģētu orientāciju" draggable="false"><div class="crop" :style="cropStyle"></div>
        </div>
        <p>Oriģināls: {{ source.source_width }} × {{ source.source_height }} px. Priekšskatījums ir samazināts; apgriešana izmanto oriģinālu.</p>
        <fieldset :disabled="busy" class="controls"><label v-for="(label, key) in { x: 'X', y: 'Y', width: 'Platums', height: 'Augstums' }" :key="key">{{ label }}<input v-model.number="crop[key]" type="number" min="0" max="1" step="0.001" :aria-label="label"></label></fieldset>
      </section>
      <section><h2>3. Optimizācija</h2><fieldset :disabled="busy" class="controls">
        <label>Maksimālā mala<select v-model.number="options.max_edge"><option v-for="n in [1024,1600,2048]" :key="n" :value="n">{{ n }} px</option></select></label>
        <label>Gaišums (−30…30)<input v-model.number="options.brightness" type="number" min="-30" max="30"></label>
        <label>Kontrasts (0…15)<input v-model.number="options.contrast" type="number" min="0" max="15"></label>
        <label>Slīpums (−10…10°)<input v-model.number="options.angle" type="number" min="-10" max="10" step="0.5"></label>
        <label class="check"><input v-model="options.denoise" type="checkbox">Viegla trokšņu izlīdzināšana</label>
        <label class="check"><input v-model="perspective" type="checkbox">Perspektīvas korekcija</label>
      </fieldset>
      <fieldset v-if="perspective" :disabled="busy"><legend>Stūri attiecībā pret atlasīto fragmentu (0–1)</legend><p>Ievadiet lodziņa četrus stūrus pulksteņrādītāja virzienā. Sāciet ar augšējo kreiso.</p><div class="controls"><label v-for="(p, i) in points" :key="i">{{ labels[i] }}<span class="point"><input v-model.number="p[0]" type="number" min="0" max="1" step="0.01" :aria-label="labels[i] + ' X'"><input v-model.number="p[1]" type="number" min="0" max="1" step="0.01" :aria-label="labels[i] + ' Y'"></span></label></div></fieldset>
      <p>Vispirms izmēģiniet bez korekcijām. Salīdziniet ciparu formas ar oriģinālu; izplūdušus ciparus uzlabojumi nevar droši atjaunot.</p>
      <div class="actions"><button :disabled="busy" @click="makePreview">Sagatavot fragmentu</button><button :disabled="busy" class="secondary" @click="compareVariants">Salīdzināt 6 izmēra / kontrasta variantus</button></div>
      <div v-if="variants.length" class="variants"><article v-for="v in variants" :key="`${v.edge}-${v.contrast}`"><img :src="v.data_url" alt="Optimizācijas variants"><p>Limits {{ v.edge }} px · kontrasts {{ v.contrast }}<br>{{ v.width }} × {{ v.height }} px · {{ (v.bytes/1024).toFixed(1) }} KB</p><button :disabled="busy" class="secondary" @click="useVariant(v)">Izvēlēties variantu</button></article></div>
      </section>
      <section v-if="preview"><h2>4. Pārbaudiet fragmentu un atpazīstiet</h2><img class="fragment" :src="preview.data_url" alt="MI nosūtāmais fragments"><p>{{ preview.width }} × {{ preview.height }} px · {{ (preview.bytes/1024).toFixed(1) }} KB</p>
        <fieldset :disabled="busy"><label class="check"><input v-model="consent" type="checkbox">Apstiprinu: šajā fragmentā ir tikai ciparu lodziņš; nav personas datu, adreses, sērijas numura vai citas nevajadzīgas informācijas. Man ir atļauja izmantot šo fotogrāfiju.</label>
        <label>Zināmais pareizais rādījums (neobligāts; netiek nosūtīts MI)<input v-model="expected" type="text" inputmode="numeric" pattern="[0-9]{1,12}" maxlength="12" placeholder="03874"></label></fieldset>
        <button :disabled="busy || !consent" @click="recognize">Sākt MI atpazīšanu (maksas API)</button>
        <div v-if="result" aria-live="polite"><p v-if="result.reading !== null" class="reading">{{ result.reading }} <small>m³</small></p><p v-else class="error">Rādījumu nevar droši atpazīt. Koriģējiet fragmentu vai izvēlieties skaidrāku attēlu un mēģiniet vēlreiz.</p><p v-if="comparison">Salīdzinājums: {{ comparison }}</p><p>Modelis: {{ result.model }}</p><p v-if="result.tokens">Tokeni: ievade {{ result.tokens.input }} (kešoti {{ result.tokens.cached_input }}), izvade {{ result.tokens.output }}.</p><p>Aprēķinātās izmaksas: {{ result.estimated_cost_usd === null ? 'nav aprēķināmas; serverī konfigurējiet modeļa cenas' : '$' + result.estimated_cost_usd.toFixed(8) }}</p></div>
      </section>
    </template>
    <section v-if="records.length"><h2>Šīs sesijas salīdzinājumi</h2><p>Tabula atrodas tikai pārlūka atmiņā. Aizverot vai pārlādējot lapu, dati pazūd.</p><div class="table"><table><thead><tr><th>Fails</th><th>Zināmais</th><th>MI</th><th>Sakrīt</th><th>Limits / kontrasts</th></tr></thead><tbody><tr v-for="(r,i) in records" :key="i"><td>{{ r.name }}</td><td>{{ r.expected || '—' }}</td><td>{{ r.reading ?? 'Nav salasāms' }}</td><td>{{ r.comparison || '—' }}</td><td>{{ r.max_edge }} / {{ r.contrast }}</td></tr></tbody></table></div><button class="secondary" :disabled="busy" @click="records = []">Notīrīt tabulu</button></section>
  </main>
</template>
