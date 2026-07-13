import type { Attendee, AttendeePurchase } from '../../shared/models'

/**
 * Normalizes purchase labels for fuzzy matching: lowercase, strip diacritics,
 * drop punctuation, collapse whitespace.
 */
export function normalizePurchaseLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasWholeWord(normalizedLabel: string, token: string): boolean {
  const words = normalizedLabel.split(' ').filter(Boolean)
  return words.some((word) => word === token)
}

/**
 * True when a purchase label refers to the book “Consejos sobre Agricultura.”
 * Requires both meaningful terms (`consejos` and `agricultura`) as whole words
 * so unrelated agriculture products do not match.
 */
export function isConsejosSobreAgriculturaLabel(label: string): boolean {
  const normalized = normalizePurchaseLabel(label)
  if (!normalized) {
    return false
  }

  return hasWholeWord(normalized, 'consejos') && hasWholeWord(normalized, 'agricultura')
}

export function hasAgricultureBookPurchase(
  purchases: readonly AttendeePurchase[],
): boolean {
  return purchases.some((purchase) => isConsejosSobreAgriculturaLabel(purchase.name))
}

export function hasConsejosSobreAgriculturaPurchase(attendee: Attendee): boolean {
  return hasAgricultureBookPurchase(attendee.purchases)
}

export const AGRICULTURE_BOOK_TITLE = 'Consejos sobre Agricultura'
export const AGRICULTURE_BOOK_ARIA_LABEL = 'Purchased Consejos sobre Agricultura'
