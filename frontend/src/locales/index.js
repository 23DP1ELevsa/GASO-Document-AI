import lv from './lv'

// Add en/ru dictionaries here when translations are available.
const messages = { lv }
export const locale = 'lv'
export function t(key, parameters = {}) {
  const value = key.split('.').reduce((value, part) => value?.[part], messages[locale]) ?? key
  return String(value).replace(/\{(\w+)\}/g, (match, name) => parameters[name] ?? match)
}

export function dateTime(value) {
  return new Intl.DateTimeFormat('lv-LV', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}
