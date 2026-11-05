export function rectangle(a, b) {
  const clamp = n => Math.round(Math.min(1, Math.max(0, n)) * 1000000) / 1000000
  const x = Math.min(clamp(a.x), clamp(b.x))
  const y = Math.min(clamp(a.y), clamp(b.y))
  return { x, y, width: Math.round(Math.abs(clamp(a.x) - clamp(b.x)) * 1000000) / 1000000, height: Math.round(Math.abs(clamp(a.y) - clamp(b.y)) * 1000000) / 1000000 }
}

export function compareReading(expected, actual) {
  if (!expected) return null
  return actual === expected ? 'Sakrīt' : 'Nesakrīt'
}
