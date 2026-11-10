export class ScanError extends Error {
  constructor(code) {
    super(code)
    this.name = 'ScanError'
    this.code = code
  }
}

export function errorCode(error) {
  if (error instanceof ScanError) return error.code
  if (error?.name === 'QuotaExceededError') return 'quota'
  return 'storage'
}
