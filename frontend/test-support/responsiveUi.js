import { expect } from '@playwright/test'
import { aiResult, image } from './uxFixtures.js'

export const longTitle = 'Rēķins — ' + 'DokumentaReģistrācijasNumurs'.repeat(4)
export const longLabel = 'DarījumaIdentifikators'.repeat(4)
export const longValue = 'LV2026-AKTS'.repeat(18)
export const longEvidence = 'Avots: ' + 'REFERENCE2026'.repeat(18)

export function responsiveResult() {
  const result = aiResult()
  result.attributes.document_title = longTitle
  result.dynamic_attributes[0].value = longTitle
  Object.assign(result.dynamic_attributes.at(-1), {
    label: longLabel,
    value: longValue,
    page: 1,
    evidence: longEvidence,
  })
  return result
}

export async function scanPages(page) {
  const file = await image()
  const photos = Array.from({ length: 7 }, (_, index) => ({
    ...file,
    name: `${index + 1}-${longTitle}.png`,
  }))
  const input = page.getByTestId('gallery-input')
  await input.setInputFiles(photos)
  await expect(page.getByTestId('page-card')).toHaveCount(photos.length)
}

export async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const issues = []
    if (root.scrollWidth > root.clientWidth) {
      issues.push(`document (${root.scrollWidth} > ${root.clientWidth})`)
    }
    const dialogs = document.querySelectorAll('.v-overlay--active > .v-overlay__content')
    const regions = [...document.querySelectorAll('.workspace'), ...dialogs]
    for (const region of regions) {
      for (const el of [region, ...region.querySelectorAll('*')]) {
        if (!(el instanceof HTMLElement) || !el.getClientRects().length) continue
        const closed = el.parentElement?.closest('details:not([open])')
        if (closed && el.closest('summary') !== closed.querySelector(':scope > summary')) continue
        if (el.matches('.sr-only, .v-btn__overlay, .v-btn__underlay')) continue
        // The corner handles extend past the image into the surrounding viewport padding.
        if (el.closest('.corner-board, .v-ripple__container')) continue
        // Vuetify clips the moving bars inside the progress track during its animation.
        if (el.matches('.v-progress-linear__indeterminate > div')) continue
        // The corner viewport can pan once the user changes the zoom level.
        if (
          el.matches('.corner-viewport') &&
          el.parentElement.querySelector('input[type="range"]')?.value > 1
        )
          continue
        const { left, right, width } = el.getBoundingClientRect()
        if (width > 0 && (left < -1 || right > root.clientWidth + 1)) {
          issues.push(
            `${el.tagName.toLowerCase()} (${Math.round(left)}–${Math.round(right)} outside viewport)`,
          )
        }
        // Single-line controls scroll their own text, and the circular indicator rotates its SVG.
        if (
          !el.matches('input, select, .v-progress-circular') &&
          el.clientWidth &&
          el.scrollWidth - el.clientWidth > 1
        ) {
          issues.push(
            `${el.tagName.toLowerCase()}.${el.classList[0] || '(unstyled)'} (${el.scrollWidth} > ${el.clientWidth})`,
          )
        }
      }
      const { left, right } = region.getBoundingClientRect()
      if (left < -1 || right > root.clientWidth + 1) {
        issues.push(
          `${region.classList[0]} (${Math.round(left)}–${Math.round(right)} outside viewport)`,
        )
      }
    }
    return issues
  })
}
