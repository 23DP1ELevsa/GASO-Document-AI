import lv from './lv'

// Add en/ru dictionaries here when translations are available.
const messages = { lv }
export const locale = 'lv'
export function t(key) {
  return key.split('.').reduce((value, part) => value?.[part], messages[locale]) ?? key
}
