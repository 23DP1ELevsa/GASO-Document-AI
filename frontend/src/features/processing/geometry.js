export const FULL_CORNERS = Object.freeze([
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
])
export const FILTERS = ['original', 'enhanced', 'grayscale', 'bw']
export const LIMITS = Object.freeze({
  sourcePixels: 16_000_000,
  sourceSide: 6000,
  outputPixels: 8_000_000,
  outputSide: 5000,
  analysisSide: 900,
  previewSide: 1200,
  resultBytes: 48 * 1024 ** 2,
})
export function defaultProcessing() {
  return {
    version: 1,
    corners: FULL_CORNERS.map((p) => ({ ...p })),
    rotation: 0,
    filter: 'original',
  }
}
export const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
export function polygonArea(points) {
  return (
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length]
      return sum + p.x * q.y - q.x * p.y
    }, 0) / 2
  )
}
export function validCorners(points) {
  return (
    Array.isArray(points) &&
    points.length === 4 &&
    points.every(
      (p) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= 0 &&
        p.x <= 1 &&
        p.y >= 0 &&
        p.y <= 1,
    ) &&
    points.every(
      (p, i) =>
        cross(p, points[(i + 1) % 4], points[(i + 2) % 4]) > 0.00005 &&
        Math.hypot(p.x - points[(i + 1) % 4].x, p.y - points[(i + 1) % 4].y) > 0.008,
    ) &&
    polygonArea(points) >= 0.002
  )
}
export function normalizeProcessing(value) {
  if (value && !validCorners(value.corners)) throw new Error('invalidQuad')
  const p = value
    ? {
        version: value.version,
        corners: value.corners?.map((point) => ({ x: point.x, y: point.y })),
        rotation: value.rotation,
        filter: value.filter,
      }
    : defaultProcessing()
  if (
    p.version !== 1 ||
    !validCorners(p.corners) ||
    ![0, 90, 180, 270].includes(p.rotation) ||
    !FILTERS.includes(p.filter)
  )
    throw new Error('invalidQuad')
  return p
}
export function isIdentity(p) {
  return (
    p.rotation === 0 &&
    p.filter === 'original' &&
    p.corners.every(
      (point, i) =>
        Math.abs(point.x - FULL_CORNERS[i].x) < 1e-9 &&
        Math.abs(point.y - FULL_CORNERS[i].y) < 1e-9,
    )
  )
}
export function processingKey(value) {
  return JSON.stringify(normalizeProcessing(value))
}

// Solve the eight homography coefficients using partial-pivot Gaussian elimination.
// Coordinates are normalized so the system is stable for both thumbnails and large rasters.
export function homography(from, to) {
  const matrix = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i],
      u = to[i].x,
      v = to[i].y
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col
    for (let row = col + 1; row < 8; row++)
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row
    if (Math.abs(matrix[pivot][col]) < 1e-10) throw new Error('invalidQuad')
    ;[matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]]
    const divisor = matrix[col][col]
    for (let j = col; j <= 8; j++) matrix[col][j] /= divisor
    for (let row = 0; row < 8; row++)
      if (row !== col) {
        const factor = matrix[row][col]
        for (let j = col; j <= 8; j++) matrix[row][j] -= factor * matrix[col][j]
      }
  }
  return [...matrix.map((row) => row[8]), 1]
}
export function project(h, x, y) {
  const divisor = h[6] * x + h[7] * y + h[8]
  if (Math.abs(divisor) < 1e-10) throw new Error('invalidQuad')
  return { x: (h[0] * x + h[1] * y + h[2]) / divisor, y: (h[3] * x + h[4] * y + h[5]) / divisor }
}
export function outputSize(
  corners,
  width,
  height,
  maxPixels = LIMITS.outputPixels,
  maxSide = LIMITS.outputSide,
) {
  if (!validCorners(corners)) throw new Error('invalidQuad')
  const distance = (a, b) => Math.hypot((a.x - b.x) * (width - 1), (a.y - b.y) * (height - 1))
  const w = 1 + Math.max(distance(corners[0], corners[1]), distance(corners[3], corners[2]))
  const h = 1 + Math.max(distance(corners[0], corners[3]), distance(corners[1], corners[2]))
  const scale = Math.min(1, Math.sqrt(maxPixels / (w * h)), maxSide / Math.max(w, h))
  return {
    width: Math.max(2, Math.floor(w * scale)),
    height: Math.max(2, Math.floor(h * scale)),
    limited: scale < 0.999,
  }
}

export function warpPixels(
  source,
  width,
  height,
  parameters,
  outWidth,
  outHeight,
  progress = () => {},
) {
  const p = normalizeProcessing(parameters)
  const h = homography(FULL_CORNERS, p.corners)
  const rotated = p.rotation === 90 || p.rotation === 270
  const baseWidth = rotated ? outHeight : outWidth,
    baseHeight = rotated ? outWidth : outHeight
  const output = new Uint8ClampedArray(outWidth * outHeight * 4)
  for (let y = 0; y < outHeight; y++) {
    if (y % 128 === 0) progress(y / outHeight)
    for (let x = 0; x < outWidth; x++) {
      let bx = x,
        by = y
      if (p.rotation === 90) {
        bx = y
        by = baseHeight - 1 - x
      } else if (p.rotation === 180) {
        bx = baseWidth - 1 - x
        by = baseHeight - 1 - y
      } else if (p.rotation === 270) {
        bx = baseWidth - 1 - y
        by = x
      }
      const uv = project(h, bx / Math.max(1, baseWidth - 1), by / Math.max(1, baseHeight - 1))
      const sx = Math.max(0, Math.min(width - 1, uv.x * (width - 1))),
        sy = Math.max(0, Math.min(height - 1, uv.y * (height - 1)))
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy),
        x1 = Math.min(width - 1, x0 + 1),
        y1 = Math.min(height - 1, y0 + 1),
        fx = sx - x0,
        fy = sy - y0
      const a = (y0 * width + x0) * 4,
        b = (y0 * width + x1) * 4,
        c = (y1 * width + x0) * 4,
        d = (y1 * width + x1) * 4,
        dest = (y * outWidth + x) * 4
      for (let channel = 0; channel < 3; channel++) {
        const sample =
          source[a + channel] * (1 - fx) * (1 - fy) +
          source[b + channel] * fx * (1 - fy) +
          source[c + channel] * (1 - fx) * fy +
          source[d + channel] * fx * fy
        const alpha =
          (source[a + 3] * (1 - fx) * (1 - fy) +
            source[b + 3] * fx * (1 - fy) +
            source[c + 3] * (1 - fx) * fy +
            source[d + 3] * fx * fy) /
          255
        output[dest + channel] = sample * alpha + 255 * (1 - alpha)
      }
      output[dest + 3] = 255
    }
  }
  return output
}
