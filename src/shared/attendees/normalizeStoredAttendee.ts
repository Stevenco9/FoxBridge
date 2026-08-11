import type { Attendee, AttendeeCustomField, AttendeePurchase } from '../models'
import { createUnknownPayment, type AttendeePayment } from '../models/AttendeePayment'

/**
 * Normalizes unknown JSON into the platform-agnostic Attendee model.
 * Used when hydrating the Local Event Store — not tied to RegFox shapes.
 */
export function normalizeStoredAttendee(raw: unknown): Attendee | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const registrationId =
    typeof record.registrationId === 'string' ? record.registrationId.trim() : ''
  const eventId = typeof record.eventId === 'string' ? record.eventId.trim() : ''
  const firstName = typeof record.firstName === 'string' ? record.firstName : ''
  const lastName = typeof record.lastName === 'string' ? record.lastName : ''
  const email = typeof record.email === 'string' ? record.email : ''

  if (!id || !registrationId || !eventId) {
    return null
  }

  const now = new Date().toISOString()

  return {
    id,
    registrationId,
    confirmationCode:
      typeof record.confirmationCode === 'string' ? record.confirmationCode : undefined,
    eventId,
    firstName,
    lastName,
    email,
    phone: typeof record.phone === 'string' ? record.phone : undefined,
    organization:
      typeof record.organization === 'string' ? record.organization : undefined,
    jobTitle: typeof record.jobTitle === 'string' ? record.jobTitle : undefined,
    department: typeof record.department === 'string' ? record.department : undefined,
    purchases: normalizePurchases(record.purchases),
    payment: normalizePayment(record.payment),
    customFields: normalizeCustomFields(record.customFields),
    checkedIn: Boolean(record.checkedIn),
    checkedInAt:
      typeof record.checkedInAt === 'string' ? record.checkedInAt : undefined,
    badgePrinted: Boolean(record.badgePrinted),
    badgePrintedAt:
      typeof record.badgePrintedAt === 'string' ? record.badgePrintedAt : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
    syncedAt: typeof record.syncedAt === 'string' ? record.syncedAt : undefined,
    metadata:
      record.metadata && typeof record.metadata === 'object'
        ? (record.metadata as Record<string, unknown>)
        : undefined,
  }
}

function normalizePurchases(raw: unknown): AttendeePurchase[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const purchases: AttendeePurchase[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const quantity = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity)
    if (!id || !name || !Number.isFinite(quantity)) {
      continue
    }
    purchases.push({
      id,
      name,
      quantity,
      category: typeof row.category === 'string' ? row.category : undefined,
    })
  }
  return purchases
}

function normalizeCustomFields(raw: unknown): AttendeeCustomField[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const fields: AttendeeCustomField[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    const key = typeof row.key === 'string' ? row.key.trim() : ''
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    if (!key || !label) {
      continue
    }
    fields.push({
      key,
      label,
      value: (row.value ?? null) as AttendeeCustomField['value'],
    })
  }
  return fields
}

function normalizePayment(raw: unknown): AttendeePayment {
  if (!raw || typeof raw !== 'object') {
    return createUnknownPayment()
  }

  const row = raw as Record<string, unknown>
  const status = row.status
  const validStatus =
    status === 'paid' ||
    status === 'pending' ||
    status === 'cancelled' ||
    status === 'refunded' ||
    status === 'unknown'
      ? status
      : 'unknown'

  return {
    status: validStatus,
    totalAmount: typeof row.totalAmount === 'number' ? row.totalAmount : null,
    amountPaid: typeof row.amountPaid === 'number' ? row.amountPaid : null,
    balanceDue: typeof row.balanceDue === 'number' ? row.balanceDue : null,
    currency: typeof row.currency === 'string' ? row.currency : null,
    upstreamStatus:
      typeof row.upstreamStatus === 'string' ? row.upstreamStatus : null,
    source: row.source === 'regfox' ? 'regfox' : 'regfox',
  }
}
