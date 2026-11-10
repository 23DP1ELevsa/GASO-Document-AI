import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const lock = JSON.parse(await readFile(new URL('./ocr-assets.lock.json', import.meta.url)))
const target = path.join(root, 'public/ocr/v7-fast-4-1-0')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifest = { engine: lock.tesseractVersion, model: lock.modelVersion, files: {} }
await mkdir(path.join(target, 'core'), { recursive: true })
await mkdir(path.join(target, 'lang'), { recursive: true })
await mkdir(path.join(target, 'licenses'), { recursive: true })

async function record(name, bytes) {
  await writeFile(path.join(target, name), bytes)
  manifest.files[name] = { bytes: bytes.length, sha256: hash(bytes) }
}
for (const [pkg, version] of [
  ['tesseract.js', lock.tesseractVersion],
  ['tesseract.js-core', lock.coreVersion],
]) {
  const metadata = JSON.parse(await readFile(path.join(root, 'node_modules', pkg, 'package.json')))
  if (metadata.version !== version) throw new Error(`Expected ${pkg}@${version}; run npm ci.`)
  await copyFile(
    path.join(root, 'node_modules', pkg, pkg === 'tesseract.js' ? 'LICENSE.md' : 'LICENSE'),
    path.join(target, 'licenses', `${pkg}.txt`),
  )
}
await record(
  'worker.min.js',
  await readFile(path.join(root, 'node_modules/tesseract.js/dist/worker.min.js')),
)
// Preserve the bundled dependencies' published notices next to the worker,
// including the exact filename referenced by its minified source header.
await record(
  'worker.min.js.LICENSE.txt',
  await readFile(path.join(root, 'node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt')),
)
await copyFile(
  path.join(root, 'node_modules/tesseract.js/dist/tesseract.min.js.LICENSE.txt'),
  path.join(target, 'licenses/tesseract-api-notices.txt'),
)
// v7 adds relaxed SIMD. Each .wasm.js contains its own WebAssembly binary.
for (const variant of ['', '-simd', '-relaxedsimd', '-lstm', '-simd-lstm', '-relaxedsimd-lstm']) {
  const name = `tesseract-core${variant}.wasm.js`
  await record(
    `core/${name}`,
    await readFile(path.join(root, 'node_modules/tesseract.js-core', name)),
  )
}
for (const [name, expected] of Object.entries(lock.files)) {
  const relative = name === 'LICENSE' ? 'licenses/tessdata_fast.txt' : `lang/${name}`
  let bytes
  try {
    bytes = await readFile(path.join(target, relative))
  } catch {
    // An optional local seed is useful on restricted development machines.
    try {
      bytes = await readFile(path.join(root, '../.cache/ocr-bootstrap', name))
    } catch {
      /* Download below; the same pinned hash is required for every source. */
    }
  }
  if (!bytes || hash(bytes) !== expected) {
    const url = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${lock.commit}/${name}`
    console.log(`Downloading ${name} (${lock.modelVersion})`)
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
    if (!response.ok) throw new Error(`Cannot download ${name}: HTTP ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
  }
  if (hash(bytes) !== expected) throw new Error(`SHA-256 mismatch: ${name}`)
  await record(relative, bytes)
}
await writeFile(path.join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `Local OCR ready: ${(Object.values(manifest.files).reduce((n, f) => n + f.bytes, 0) / 1024 ** 2).toFixed(1)} MiB; all model SHA-256 checks passed.`,
)
