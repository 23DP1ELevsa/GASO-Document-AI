import { cross, polygonArea, validCorners } from './geometry.js'
import { luminance } from './filters.js'

function hull(points) {
  const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y),
    lower = [],
    upper = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop()
    lower.push(p)
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}
function fourCorners(points) {
  const polygon = hull(points)
  const originalArea = Math.abs(polygonArea(polygon))
  while (polygon.length > 4) {
    let smallest = Infinity,
      index = 0
    for (let i = 0; i < polygon.length; i++) {
      const area = Math.abs(
        cross(
          polygon[(i + polygon.length - 1) % polygon.length],
          polygon[i],
          polygon[(i + 1) % polygon.length],
        ),
      )
      if (area < smallest) {
        smallest = area
        index = i
      }
    }
    polygon.splice(index, 1)
  }
  if (polygon.length !== 4 || polygonArea(polygon) < originalArea * 0.9) return null
  let start = 0
  for (let i = 1; i < 4; i++)
    if (polygon[i].x + polygon[i].y < polygon[start].x + polygon[start].y) start = i
  const ordered = polygon.slice(start).concat(polygon.slice(0, start))
  return refineLines(ordered, points)
}
function refineLines(corners, points) {
  const groups = [[], [], [], []]
  for (const point of points) {
    let index = 0,
      minimum = Infinity
    for (let i = 0; i < 4; i++) {
      const a = corners[i],
        b = corners[(i + 1) % 4]
      const distance = Math.abs(cross(a, b, point)) / Math.hypot(b.x - a.x, b.y - a.y)
      if (distance < minimum) {
        minimum = distance
        index = i
      }
    }
    if (minimum < 0.025) groups[index].push(point)
  }
  if (groups.some((group) => group.length < 6)) return corners
  const lines = groups.map((group) => {
    const mx = group.reduce((sum, p) => sum + p.x, 0) / group.length,
      my = group.reduce((sum, p) => sum + p.y, 0) / group.length
    let xx = 0,
      xy = 0,
      yy = 0
    for (const p of group) {
      xx += (p.x - mx) ** 2
      yy += (p.y - my) ** 2
      xy += (p.x - mx) * (p.y - my)
    }
    const theta = Math.atan2(2 * xy, xx - yy) / 2,
      a = -Math.sin(theta),
      b = Math.cos(theta)
    return { a, b, c: a * mx + b * my }
  })
  const refined = lines.map((line, i) => {
    const previous = lines[(i + 3) % 4],
      determinant = previous.a * line.b - line.a * previous.b
    if (Math.abs(determinant) < 1e-8) return { x: NaN, y: NaN }
    return {
      x: (previous.c * line.b - line.c * previous.b) / determinant,
      y: (previous.a * line.c - line.a * previous.c) / determinant,
    }
  })
  return validCorners(refined) &&
    refined.every((p, i) => Math.hypot(p.x - corners[i].x, p.y - corners[i].y) < 0.05)
    ? refined
    : corners
}
function components(mask, width, height, minCount) {
  const visited = new Uint8Array(mask.length),
    queue = new Int32Array(mask.length),
    found = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue
    let head = 0,
      tail = 1,
      count = 0
    queue[0] = start
    visited[start] = 1
    const boundary = []
    while (head < tail) {
      const index = queue[head++],
        x = index % width,
        y = Math.floor(index / width)
      count++
      let isBoundary = false
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          isBoundary = true
          continue
        }
        const next = ny * width + nx
        if (!mask[next]) isBoundary = true
        else if (!visited[next]) {
          visited[next] = 1
          queue[tail++] = next
        }
      }
      if (isBoundary && boundary.length < 16000)
        boundary.push({ x: x / (width - 1), y: y / (height - 1) })
    }
    if (count >= minCount && boundary.length >= 4) {
      const quad = fourCorners(boundary)
      if (quad) found.push(quad)
    }
  }
  return found
}

export function detectDocument(data, width, height) {
  if (width < 32 || height < 32) return { status: 'uncertain', corners: null }
  const gray = luminance(data),
    blurred = new Float32Array(gray.length),
    gradients = new Float32Array(gray.length)
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      blurred[i] =
        (gray[i - width - 1] +
          2 * gray[i - width] +
          gray[i - width + 1] +
          2 * gray[i - 1] +
          4 * gray[i] +
          2 * gray[i + 1] +
          gray[i + width - 1] +
          2 * gray[i + width] +
          gray[i + width + 1]) /
        16
    }
  let maxGradient = 0
  for (let y = 2; y < height - 2; y++)
    for (let x = 2; x < width - 2; x++) {
      const i = y * width + x
      const gx =
        -blurred[i - width - 1] +
        blurred[i - width + 1] -
        2 * blurred[i - 1] +
        2 * blurred[i + 1] -
        blurred[i + width - 1] +
        blurred[i + width + 1]
      const gy =
        -blurred[i - width - 1] -
        2 * blurred[i - width] -
        blurred[i - width + 1] +
        blurred[i + width - 1] +
        2 * blurred[i + width] +
        blurred[i + width + 1]
      gradients[i] = Math.hypot(gx, gy) / 4
      maxGradient = Math.max(maxGradient, gradients[i])
    }
  if (maxGradient < 16) return { status: 'uncertain', corners: null }
  const candidates = [],
    edgeMask = new Uint8Array(gray.length),
    threshold = Math.max(12, maxGradient * 0.18)
  for (let i = 0; i < gray.length; i++) edgeMask[i] = gradients[i] >= threshold ? 1 : 0
  candidates.push(...components(edgeMask, width, height, Math.min(width, height) * 0.8))
  // Bright connected regions complement edges when a shadow breaks a contour.
  for (const level of [140, 185, 220]) {
    const mask = Uint8Array.from(gray, (value) => (value >= level ? 1 : 0))
    candidates.push(...components(mask, width, height, width * height * 0.08))
  }
  const scored = []
  const sample = (array, x, y) =>
    array[
      Math.max(0, Math.min(height - 1, Math.round(y * (height - 1)))) * width +
        Math.max(0, Math.min(width - 1, Math.round(x * (width - 1))))
    ]
  for (const corners of candidates) {
    if (!validCorners(corners)) continue
    const area = polygonArea(corners)
    if (
      area < 0.1 ||
      area > 0.92 ||
      corners.some((p) => p.x < 0.012 || p.y < 0.012 || p.x > 0.988 || p.y > 0.988)
    )
      continue
    let support = 0,
      contrast = 0,
      insideLight = 0,
      samples = 0,
      minimumEdgeSupport = 1
    for (let edge = 0; edge < 4; edge++) {
      const a = corners[edge],
        b = corners[(edge + 1) % 4],
        dx = b.x - a.x,
        dy = b.y - a.y,
        length = Math.hypot(dx, dy)
      const nx = (-dy / length) * 0.012,
        ny = (dx / length) * 0.012
      let edgeSupport = 0
      for (let k = 2; k <= 18; k++) {
        const x = a.x + (dx * k) / 20,
          y = a.y + (dy * k) / 20
        let strongest = 0
        for (const offset of [-0.7, 0, 0.7])
          strongest = Math.max(strongest, sample(gradients, x + nx * offset, y + ny * offset))
        support += strongest >= threshold * 0.8 ? 1 : 0
        edgeSupport += strongest >= threshold * 0.8 ? 1 : 0
        const inside = sample(gray, x + nx * 1.4, y + ny * 1.4),
          outside = sample(gray, x - nx * 1.4, y - ny * 1.4)
        contrast += Math.max(0, inside - outside)
        insideLight += inside
        samples++
      }
      minimumEdgeSupport = Math.min(minimumEdgeSupport, edgeSupport / 17)
    }
    support /= samples
    contrast /= samples
    insideLight /= samples
    if (support < 0.65 || minimumEdgeSupport < 0.55 || contrast < 14 || insideLight < 100) continue
    // Geometry, edge support and inside/outside contrast dominate area.
    const score =
      support * 0.5 +
      Math.min(1, contrast / 90) * 0.3 +
      Math.min(1, area / 0.6) * 0.1 +
      Math.min(1, insideLight / 220) * 0.1
    const duplicate = scored.find((item) =>
      item.corners.every(
        (point, i) => Math.hypot(point.x - corners[i].x, point.y - corners[i].y) < 0.04,
      ),
    )
    if (duplicate) {
      if (score > duplicate.score) Object.assign(duplicate, { corners, score })
    } else scored.push({ corners, score })
  }
  scored.sort((a, b) => b.score - a.score)
  if (
    !scored.length ||
    scored[0].score < 0.72 ||
    (scored[1] && scored[0].score - scored[1].score < 0.07)
  )
    return { status: 'uncertain', corners: null }
  return { status: 'found', ...scored[0] }
}
