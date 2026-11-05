import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rectangle, compareReading } from '../src/crop.js'

test('crop handles reverse dragging and clamps outside points', () => {
  assert.deepEqual(rectangle({ x: 1.2, y: .8 }, { x: -.2, y: .1 }), { x: 0, y: .1, width: 1, height: .7 })
})
test('ground truth preserves leading zeroes and treats null as failure', () => {
  assert.equal(compareReading('03874', '03874'), 'Sakrīt')
  assert.equal(compareReading('03874', '3874'), 'Nesakrīt')
  assert.equal(compareReading('03874', null), 'Nesakrīt')
  assert.equal(compareReading('', null), null)
})
