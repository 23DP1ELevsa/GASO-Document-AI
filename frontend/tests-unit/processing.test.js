import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FULL_CORNERS,
  defaultProcessing,
  validCorners,
  homography,
  project,
  outputSize,
  warpPixels,
  LIMITS,
} from '../src/features/processing/geometry.js'
import { filterPixels } from '../src/features/processing/filters.js'
import { detectDocument } from '../src/features/processing/detectDocument.js'

function raster(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const rgb = pixel(x, y)
      data.set([...rgb, 255], (y * width + x) * 4)
    }
  return data
}
const quad = [
  { x: 0.19, y: 0.14 },
  { x: 0.82, y: 0.21 },
  { x: 0.75, y: 0.88 },
  { x: 0.12, y: 0.76 },
]
function inside(points, x, y) {
  return points.every((a, i) => {
    const b = points[(i + 1) % 4]
    return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= 0
  })
}
function photo({ background = 45, shadow = false, points = quad, frame = false } = {}) {
  const width = 320,
    height = 280
  return {
    width,
    height,
    data: raster(width, height, (x, y) => {
      const u = x / (width - 1),
        v = y / (height - 1)
      const paper = inside(points, u, v)
      const value = paper
        ? shadow
          ? 155 + 85 * u
          : 238
        : frame && (x < 4 || y < 4 || x > width - 5 || y > height - 5)
          ? 240
          : background
      return [value, value, value]
    }),
  }
}
test('convex quadrilateral validation rejects crossings, reversed points, collapsed edges and out-of-bounds values', () => {
  assert.equal(validCorners(FULL_CORNERS), true)
  assert.equal(validCorners(quad), true)
  for (const points of [
    [quad[0], quad[2], quad[1], quad[3]],
    [...quad].reverse(),
    [quad[0], quad[0], quad[2], quad[3]],
    [{ x: -1, y: 0 }, ...quad.slice(1)],
    [{ x: NaN, y: 0 }, ...quad.slice(1)],
  ])
    assert.equal(validCorners(points), false)
})
test('homography recovers an independent projective mapping, including its interior', () => {
  const known = (x, y) => ({
    x: (0.6 * x + 0.1 * y + 0.1) / (0.2 * x + 0.1 * y + 1),
    y: (0.7 * y + 0.2) / (0.2 * x + 0.1 * y + 1),
  })
  const h = homography(
    FULL_CORNERS,
    FULL_CORNERS.map((p) => known(p.x, p.y)),
  )
  for (const [x, y] of [
    [0, 0],
    [1, 1],
    [0.37, 0.63],
    [0.5, 0.5],
  ]) {
    const actual = project(h, x, y),
      expected = known(x, y)
    assert.ok(Math.abs(actual.x - expected.x) < 1e-10)
    assert.ok(Math.abs(actual.y - expected.y) < 1e-10)
  }
})
test('perspective warp samples known source coordinates with bilinear interpolation', () => {
  const data = raster(101, 101, (x, y) => [x * 2, y * 2, 77])
  const parameters = {
    ...defaultProcessing(),
    corners: [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.8 },
    ],
  }
  const output = warpPixels(data, 101, 101, parameters, 61, 71)
  for (const [index, expected] of [
    [0, [40, 40, 77]],
    [60, [160, 20, 77]],
    [70 * 61 + 60, [180, 180, 77]],
    [70 * 61, [20, 160, 77]],
  ])
    assert.deepEqual([...output.slice(index * 4, index * 4 + 3)], expected)
})
test('rotation uses exact right-angle coordinate permutations', () => {
  const data = raster(2, 3, (x, y) => [1 + y * 2 + x, 0, 0])
  for (const [rotation, width, height, expected] of [
    [0, 2, 3, [1, 2, 3, 4, 5, 6]],
    [90, 3, 2, [5, 3, 1, 6, 4, 2]],
    [180, 2, 3, [6, 5, 4, 3, 2, 1]],
    [270, 3, 2, [2, 4, 6, 1, 3, 5]],
  ]) {
    const output = warpPixels(data, 2, 3, { ...defaultProcessing(), rotation }, width, height)
    assert.deepEqual(
      [...output].filter((_, i) => i % 4 === 0),
      expected,
    )
  }
})
test('output dimensions follow selected sides and cap resources without forcing paper proportions', () => {
  const receipt = outputSize(
    [
      { x: 0.4, y: 0.05 },
      { x: 0.6, y: 0.05 },
      { x: 0.6, y: 0.95 },
      { x: 0.4, y: 0.95 },
    ],
    2000,
    3000,
  )
  assert.ok(receipt.height / receipt.width > 6)
  const large = outputSize(FULL_CORNERS, 8000, 5000)
  assert.ok(large.width * large.height <= LIMITS.outputPixels + 5000)
  assert.ok(Math.max(large.width, large.height) <= LIMITS.outputSide)
  assert.equal(large.limited, true)
})
test('color, grayscale, enhanced and adaptive binary filters have distinct verifiable behavior', () => {
  const colored = raster(32, 32, (x, y) => [100 + x, 120 + y, 140])
  assert.deepEqual(filterPixels(colored.slice(), 32, 32, 'original'), colored)
  const gray = filterPixels(colored.slice(), 32, 32, 'grayscale')
  for (let i = 0; i < gray.length; i += 4)
    assert.ok(gray[i] === gray[i + 1] && gray[i] === gray[i + 2])
  const enhanced = filterPixels(colored.slice(), 32, 32, 'enhanced')
  assert.notDeepEqual(enhanced, colored)
  assert.ok(enhanced[0] < enhanced[1] && enhanced[1] < enhanced[2])
  const uneven = raster(120, 80, (x, y) => {
    const paper = 140 + x * 0.7
    const value = y === 40 || x === 60 ? paper - 18 : paper
    return [value, value, value]
  })
  const bw = filterPixels(uneven, 120, 80, 'bw')
  assert.equal(bw[(40 * 120 + 20) * 4], 0)
  assert.equal(bw[(20 * 120 + 20) * 4], 255)
  assert.ok([...bw].every((value, i) => i % 4 === 3 || value === 0 || value === 255))
})
test('automatic detection finds a slanted page on a dark background', () => {
  const image = photo(),
    result = detectDocument(image.data, image.width, image.height)
  assert.equal(result.status, 'found')
  result.corners.forEach((p, i) => assert.ok(Math.hypot(p.x - quad[i].x, p.y - quad[i].y) < 0.025))
})
test('automatic detection handles a shaded page and ignores a larger frame at the image boundary', () => {
  for (const options of [{ shadow: true }, { frame: true }]) {
    const image = photo(options),
      result = detectDocument(image.data, image.width, image.height)
    assert.equal(result.status, 'found')
    result.corners.forEach((p, i) => assert.ok(Math.hypot(p.x - quad[i].x, p.y - quad[i].y) < 0.04))
  }
})
test('light low-contrast and blank backgrounds return uncertainty instead of a fabricated quadrilateral', () => {
  for (const image of [
    photo({ background: 234 }),
    { width: 120, height: 160, data: raster(120, 160, () => [240, 240, 240]) },
  ]) {
    const result = detectDocument(image.data, image.width, image.height)
    assert.equal(result.status, 'uncertain')
    assert.equal(result.corners, null)
  }
})

test('a light background with visible borders can be detected, while two equally plausible pages remain manual', () => {
  const image = photo({ background: 190 })
  assert.equal(detectDocument(image.data, image.width, image.height).status, 'found')
  const width = 320,
    height = 240
  const left = [
    { x: 0.08, y: 0.15 },
    { x: 0.43, y: 0.15 },
    { x: 0.43, y: 0.85 },
    { x: 0.08, y: 0.85 },
  ]
  const right = left.map((p) => ({ x: p.x + 0.49, y: p.y }))
  const two = raster(width, height, (x, y) => {
    const value =
      inside(left, x / (width - 1), y / (height - 1)) ||
      inside(right, x / (width - 1), y / (height - 1))
        ? 240
        : 50
    return [value, value, value]
  })
  const result = detectDocument(two, width, height)
  assert.equal(result.status, 'uncertain')
  assert.equal(result.corners, null)
})
