export function parseDateOnlyToUtcNoon(input: string | null | undefined): Date | null {
  if (!input) return null
  const raw = String(input).trim()
  if (!raw) return null

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00.000Z` : raw
  const parsed = new Date(normalized)
  return Number.isNaN(+parsed) ? null : parsed
}

export function formatDateOnlyForInput(value: string | Date | null | undefined): string {
  if (!value) return ''
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(+parsed)) return ''
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

export function formatDateOnlyForDisplay(
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!value) return '—'
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(+parsed)) return '—'
  return parsed.toLocaleDateString(undefined, { timeZone: 'UTC', ...(options || {}) })
}
