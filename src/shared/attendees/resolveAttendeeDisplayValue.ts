import type { Attendee, AttendeeCustomField } from '../models'
import {
  CUSTOM_FIELD_KEY_PREFIX,
  PURCHASE_FIELD_KEY_PREFIX,
  type AvailableAttendeeField,
} from './discoverAvailableAttendeeFields'
import { formatMoney } from '../payments/money'
import { getPaymentStatusLabel } from '../payments/normalizePayment'

function getAttendeeFullName(attendee: Attendee): string {
  return `${attendee.firstName} ${attendee.lastName}`.trim()
}

/**
 * One resolved Quick Info row ready for the details panel.
 * Only meaningful values are included (callers may also filter empties).
 */
export interface ResolvedAttendeeDisplayItem {
  key: string
  label: string
  /** One or more display lines (arrays become multiple lines). */
  lines: string[]
}

export type ResolveAttendeeDisplayValueResult =
  | { kind: 'empty' }
  | { kind: 'lines'; lines: string[] }

function findCustomFieldValue(
  attendee: Attendee,
  paths: string[],
): string | undefined {
  for (const path of paths) {
    const normalizedPath = path.toLowerCase()
    const match = attendee.customFields.find((field) => {
      const fieldPath = field.key.toLowerCase()
      const fieldLabel = field.label.toLowerCase()
      return (
        fieldPath === normalizedPath ||
        fieldPath.endsWith(`.${normalizedPath}`) ||
        fieldLabel === normalizedPath
      )
    })

    if (match?.value != null && String(match.value).trim() !== '') {
      return String(match.value).trim()
    }
  }

  return undefined
}

function getCityState(attendee: Attendee): string {
  const city = findCustomFieldValue(attendee, ['city', 'address.city', 'billing.city'])
  const state = findCustomFieldValue(attendee, ['state', 'address.state', 'billing.state'])

  if (city && state) {
    return `${city}, ${state}`
  }

  return city ?? state ?? ''
}

function getRegistrationType(attendee: Attendee): string {
  if (attendee.purchases.length === 0) {
    return ''
  }

  return attendee.purchases.map((purchase) => purchase.name).join(', ')
}

/**
 * Formats a purchase quantity per Sprint 20.4 rules.
 * Returns null when there is nothing meaningful to show.
 */
export function formatPurchaseQuantity(quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null
  }

  if (quantity === 1) {
    return 'Purchased'
  }

  return `${quantity} Purchased`
}

/**
 * Formats a custom / primitive value for Quick Info.
 * Returns empty when the value should be omitted.
 */
export function formatAttendeeDisplayPrimitive(
  value: AttendeeCustomField['value'] | boolean | number | string | null | undefined,
): ResolveAttendeeDisplayValueResult {
  if (value == null) {
    return { kind: 'empty' }
  }

  if (typeof value === 'boolean') {
    if (!value) {
      return { kind: 'empty' }
    }
    return { kind: 'lines', lines: ['✓ Yes'] }
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { kind: 'empty' }
    }
    return { kind: 'lines', lines: [String(value)] }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return { kind: 'empty' }
    }
    return { kind: 'lines', lines: [trimmed] }
  }

  if (Array.isArray(value)) {
    const lines = value
      .map((item) => String(item).trim())
      .filter((item) => item !== '')
    if (lines.length === 0) {
      return { kind: 'empty' }
    }
    return { kind: 'lines', lines }
  }

  return { kind: 'empty' }
}

function resolveBuiltIn(
  attendee: Attendee,
  key: string,
): ResolveAttendeeDisplayValueResult {
  switch (key) {
    case 'id':
      return formatAttendeeDisplayPrimitive(attendee.id)
    case 'registrationId':
      return formatAttendeeDisplayPrimitive(attendee.registrationId)
    case 'confirmationCode':
      return formatAttendeeDisplayPrimitive(attendee.confirmationCode)
    case 'eventId':
      return formatAttendeeDisplayPrimitive(attendee.eventId)
    case 'firstName':
      return formatAttendeeDisplayPrimitive(attendee.firstName)
    case 'lastName':
      return formatAttendeeDisplayPrimitive(attendee.lastName)
    case 'email':
      return formatAttendeeDisplayPrimitive(attendee.email)
    case 'phone':
      return formatAttendeeDisplayPrimitive(attendee.phone)
    case 'organization':
      return formatAttendeeDisplayPrimitive(attendee.organization)
    case 'jobTitle':
      return formatAttendeeDisplayPrimitive(attendee.jobTitle)
    case 'department':
      return formatAttendeeDisplayPrimitive(attendee.department)
    case 'checkedIn':
      return formatAttendeeDisplayPrimitive(attendee.checkedIn)
    case 'checkedInAt':
      return formatAttendeeDisplayPrimitive(attendee.checkedInAt)
    case 'badgePrinted':
      return formatAttendeeDisplayPrimitive(attendee.badgePrinted)
    case 'badgePrintedAt':
      return formatAttendeeDisplayPrimitive(attendee.badgePrintedAt)
    case 'createdAt':
      return formatAttendeeDisplayPrimitive(attendee.createdAt)
    case 'updatedAt':
      return formatAttendeeDisplayPrimitive(attendee.updatedAt)
    case 'syncedAt':
      return formatAttendeeDisplayPrimitive(attendee.syncedAt)
    default:
      return { kind: 'empty' }
  }
}

function resolveDerived(
  attendee: Attendee,
  key: string,
): ResolveAttendeeDisplayValueResult {
  switch (key) {
    case 'fullName':
      return formatAttendeeDisplayPrimitive(getAttendeeFullName(attendee))
    case 'cityState':
      return formatAttendeeDisplayPrimitive(getCityState(attendee))
    case 'registrationType':
      return formatAttendeeDisplayPrimitive(getRegistrationType(attendee))
    default:
      return { kind: 'empty' }
  }
}

function resolvePayment(
  attendee: Attendee,
  key: string,
): ResolveAttendeeDisplayValueResult {
  const payment = attendee.payment

  switch (key) {
    case 'payment.status':
      return formatAttendeeDisplayPrimitive(getPaymentStatusLabel(payment.status))
    case 'payment.totalAmount':
      if (payment.totalAmount == null) {
        return { kind: 'empty' }
      }
      return formatAttendeeDisplayPrimitive(
        formatMoney(payment.totalAmount, payment.currency),
      )
    case 'payment.amountPaid':
      if (payment.amountPaid == null) {
        return { kind: 'empty' }
      }
      return formatAttendeeDisplayPrimitive(
        formatMoney(payment.amountPaid, payment.currency),
      )
    case 'payment.balanceDue':
      if (payment.balanceDue == null) {
        return { kind: 'empty' }
      }
      return formatAttendeeDisplayPrimitive(
        formatMoney(payment.balanceDue, payment.currency),
      )
    case 'payment.currency':
      return formatAttendeeDisplayPrimitive(payment.currency)
    case 'payment.upstreamStatus':
      return formatAttendeeDisplayPrimitive(payment.upstreamStatus)
    default:
      return { kind: 'empty' }
  }
}

function resolveCustom(
  attendee: Attendee,
  catalogKey: string,
): ResolveAttendeeDisplayValueResult {
  const customKey = catalogKey.slice(CUSTOM_FIELD_KEY_PREFIX.length)
  if (!customKey) {
    return { kind: 'empty' }
  }

  const match = attendee.customFields.find((field) => field.key === customKey)
  if (!match) {
    return { kind: 'empty' }
  }

  return formatAttendeeDisplayPrimitive(match.value)
}

function resolvePurchase(
  attendee: Attendee,
  catalogKey: string,
): ResolveAttendeeDisplayValueResult {
  const purchaseId = catalogKey.slice(PURCHASE_FIELD_KEY_PREFIX.length)
  if (!purchaseId) {
    return { kind: 'empty' }
  }

  const purchase = attendee.purchases.find((item) => item.id === purchaseId)
  if (!purchase) {
    return { kind: 'empty' }
  }

  const formatted = formatPurchaseQuantity(purchase.quantity)
  if (!formatted) {
    return { kind: 'empty' }
  }

  return { kind: 'lines', lines: [formatted] }
}

/**
 * Resolves one Sprint 20.1 catalog key against an Attendee into display lines.
 */
export function resolveAttendeeDisplayValue(
  attendee: Attendee,
  fieldKey: string,
): ResolveAttendeeDisplayValueResult {
  const key = fieldKey.trim()
  if (!key) {
    return { kind: 'empty' }
  }

  if (key.startsWith(CUSTOM_FIELD_KEY_PREFIX)) {
    return resolveCustom(attendee, key)
  }

  if (key.startsWith(PURCHASE_FIELD_KEY_PREFIX)) {
    return resolvePurchase(attendee, key)
  }

  if (key.startsWith('payment.')) {
    return resolvePayment(attendee, key)
  }

  if (key === 'fullName' || key === 'cityState' || key === 'registrationType') {
    return resolveDerived(attendee, key)
  }

  return resolveBuiltIn(attendee, key)
}

/**
 * Resolves an ordered list of configured field keys into Quick Info rows.
 * Skips keys with no meaningful value. Labels prefer the discovery catalog,
 * then live attendee field/purchase names, then a clear unavailable fallback.
 */
export function resolveDisplayLabel(
  attendee: Attendee,
  fieldKey: string,
  catalogByKey: ReadonlyMap<string, AvailableAttendeeField>,
): string {
  const key = fieldKey.trim()
  if (!key) {
    return 'Select a field…'
  }

  const fromCatalog = catalogByKey.get(key)
  if (fromCatalog?.label.trim()) {
    return fromCatalog.label
  }

  if (key.startsWith(CUSTOM_FIELD_KEY_PREFIX)) {
    const customKey = key.slice(CUSTOM_FIELD_KEY_PREFIX.length)
    const match = attendee.customFields.find((field) => field.key === customKey)
    if (match?.label.trim()) {
      return match.label.trim()
    }
  }

  if (key.startsWith(PURCHASE_FIELD_KEY_PREFIX)) {
    const purchaseId = key.slice(PURCHASE_FIELD_KEY_PREFIX.length)
    const purchase = attendee.purchases.find((item) => item.id === purchaseId)
    if (purchase?.name.trim()) {
      return purchase.name.trim()
    }
  }

  return `Unavailable — ${key}`
}

export function resolveAttendeeDisplayItems(
  attendee: Attendee,
  fieldKeys: readonly string[],
  catalogByKey: ReadonlyMap<string, AvailableAttendeeField>,
): ResolvedAttendeeDisplayItem[] {
  const items: ResolvedAttendeeDisplayItem[] = []

  for (const fieldKey of fieldKeys) {
    const key = fieldKey.trim()
    if (!key) {
      continue
    }

    const resolved = resolveAttendeeDisplayValue(attendee, key)
    if (resolved.kind === 'empty' || resolved.lines.length === 0) {
      continue
    }

    items.push({
      key,
      label: resolveDisplayLabel(attendee, key, catalogByKey),
      lines: resolved.lines,
    })
  }

  return items
}
