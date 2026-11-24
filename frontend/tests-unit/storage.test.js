import test from 'node:test'
import assert from 'node:assert/strict'
import { readRemoteImage, sha256, uploadImage } from '../src/features/storage/client.js'

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
})

test('upload sends multipart bytes once per checksum and verifies the server acknowledgment', async (t) => {
  const bytes = new Blob(['synthetic'], { type: 'image/png' })
  const checksum = await sha256(bytes)
  const mock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method === 'GET')
      return Response.json({ error: { code: 'image_missing' } }, { status: 404 })
    assert.ok(options.body instanceof FormData)
    assert.equal(await options.body.get('image').text(), 'synthetic')
    return Response.json({ sha256: checksum, size: bytes.size })
  })
  const assets = new Map()
  for (let attempt = 0; attempt < 2; attempt++)
    assert.deepEqual(await uploadImage(bytes, assets), { sha256: checksum, size: bytes.size })
  assert.equal(mock.mock.callCount(), 2)
})
