export function luminance(data) {
  const gray = new Uint8ClampedArray(data.length / 4)
  for (let i = 0; i < gray.length; i++)
    gray[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]
  return gray
}

export function filterPixels(data, width, height, mode) {
  if (mode === 'original') return data
  if (!['enhanced', 'grayscale', 'bw'].includes(mode)) throw new Error('processingFailed')
  const gray = luminance(data)
  if (mode === 'bw') {
    // Adaptive local mean: the threshold follows slow illumination changes.
    // A small offset keeps weak marks rather than forcing every gray pixel to white.
    const stride = width + 1,
      integral = new Float64Array(stride * (height + 1))
    for (let y = 0; y < height; y++) {
      let sum = 0
      for (let x = 0; x < width; x++) {
        sum += gray[y * width + x]
        integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + sum
      }
    }
    const radius = Math.max(3, Math.round(Math.min(width, height) * 0.025))
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const left = Math.max(0, x - radius),
          right = Math.min(width, x + radius + 1),
          top = Math.max(0, y - radius),
          bottom = Math.min(height, y + radius + 1)
        const mean =
          (integral[bottom * stride + right] -
            integral[top * stride + right] -
            integral[bottom * stride + left] +
            integral[top * stride + left]) /
          ((right - left) * (bottom - top))
        const value = gray[y * width + x] < Math.min(248, mean - 5) ? 0 : 255
        const i = (y * width + x) * 4
        data[i] = data[i + 1] = data[i + 2] = value
      }
  } else if (mode === 'grayscale') {
    for (let i = 0; i < gray.length; i++) data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = gray[i]
  } else {
    const histogram = new Uint32Array(256)
    for (const value of gray) histogram[value]++
    let sum = 0,
      low = 0,
      high = 255
    for (let i = 0; i < 256; i++) {
      sum += histogram[i]
      if (sum >= gray.length * 0.01) {
        low = i
        break
      }
    }
    sum = 0
    for (let i = 255; i >= 0; i--) {
      sum += histogram[i]
      if (sum >= gray.length * 0.99) {
        high = i
        break
      }
    }
    // Bound contrast expansion, preserving color and fine low-contrast structure.
    const gain = Math.min(1.25, 255 / Math.max(180, high - low)),
      black = Math.min(18, low * 0.25)
    for (let i = 0; i < data.length; i += 4)
      for (let c = 0; c < 3; c++) data[i + c] = (data[i + c] - black) * gain + 3
  }
  return data
}
