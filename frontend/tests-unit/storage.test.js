import test from 'node:test'
import assert from 'node:assert/strict'
import {
  lookupImages,
  readRemoteImage,
  sha256,
  uploadImage,
} from '../src/features/storage/client.js'
import { mapConcurrent } from '../src/features/storage/images.js'

test('the image transport hashes source bytes and verifies downloads before returning a Blob', async (t) => {
  const bytes = new Blob(['abc'], { type: 'image/png' })
  const checksum = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  assert.equal(await sha256(bytes), checksum)
  const image = { sha256: checksum, size: 3, mime: 'image/png' }
  let content = bytes
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/storage/v1/images/' + checksum)
    assert.equal(options.headers['X-GASO-Storage'], '1')
    assert.equal(options.cache, 'no-store')
    return new Response(content, { headers: { 'X-Content-SHA256': checksum } })
  })
  assert.equal(await (await readRemoteImage(image)).text(), 'abc')
  content = new Blob(['bad'], { type: 'image/png' })
  await assert.rejects(readRemoteImage(image), { code: 'image_integrity_error' })
  content = new Blob(['abc'], { type: 'image/jpeg' })
  await assert.rejects(readRemoteImage(image), { code: 'image_integrity_error' })
  content = new Blob(['ab'], { type: 'image/png' })
  await assert.rejects(readRemoteImage(image), { code: 'image_integrity_error' })
})

test('concurrent calls share one multipart upload per checksum and verify the acknowledgment', async (t) => {
  const bytes = new Blob(['synthetic'], { type: 'image/png' })
  const checksum = await sha256(bytes)
  const descriptor = { sha256: checksum, size: bytes.size, mime: bytes.type }
  const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/storage/v1/assets/' + checksum)
    assert.equal(options.method, 'POST')
    assert.ok(options.body instanceof FormData)
    assert.equal(await options.body.get('image').text(), 'synthetic')
    return Response.json(descriptor)
  })
  const assets = new Map()
  assert.deepEqual(
    await Promise.all(Array.from({ length: 4 }, () => uploadImage(checksum, bytes, assets))),
    Array(4).fill(descriptor),
  )
  assert.equal(mock.mock.callCount(), 1)
  await assert.rejects(uploadImage(checksum, new Blob(['bad']), assets), {
    code: 'image_integrity_error',
  })
})

test('a checksum batch distinguishes verified, missing and corrupted images', async (t) => {
  const hashes = ['a', 'b', 'c'].map((letter) => letter.repeat(64))
  const descriptor = { sha256: hashes[0], size: 42, mime: 'image/jpeg' }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/storage/v1/assets/check')
    assert.deepEqual(JSON.parse(options.body), { hashes })
    return Response.json({ assets: [descriptor], invalid: [hashes[2]] })
  })
  const result = await lookupImages(hashes)
  assert.deepEqual(result.assets, new Map([[hashes[0], descriptor]]))
  assert.deepEqual(result.invalid, new Set([hashes[2]]))
  assert.equal(result.assets.has(hashes[1]), false)
})

test('aborting bounded work drains active tasks without starting more', async () => {
  const controller = new AbortController()
  let count = 0
  let finished = 0
  const work = mapConcurrent(Array(10).fill(null), controller.signal, async () => {
    count++
    await new Promise((resolve) => setImmediate(resolve))
    finished++
    controller.abort()
  })
  await assert.rejects(work, { name: 'AbortError' })
  assert.equal(count, 4)
  assert.equal(finished, count)
})
