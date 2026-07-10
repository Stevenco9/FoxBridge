/**
 * Safe monetary parsing and locale-aware currency formatting.
 */

/**
 * Parses a RegFox money value that may be a string or number.
 * Returns `null` for missing/invalid values — never `NaN`.
 */
export function parseMoneyValue(value: unknown): number | null {
  if (value == null) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    // Allow common thousands separators; reject currency symbols / junk.
    const normalized = trimmed.replace(/,/g, '')
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
      return null
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

/**
 * Normalizes an ISO currency code. Returns `null` when missing or unusable.
 */
export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(trimmed)) {
    return null
  }

  return trimmed
}

/**
 * Formats an amount for display. Never throws on bad currency/amount input.
 */
export function formatMoney(
  amount: number,
  currency: string | null | undefined,
): string {
  if (!Number.isFinite(amount)) {
    return '—'
  }

  const code = normalizeCurrencyCode(currency ?? null)

  if (code) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
      }).format(amount)
    } catch {
      // Invalid currency for the runtime — fall through to plain formatting.
    }
  }

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

  return code ? `${code} ${formatted}` : formatted
}
