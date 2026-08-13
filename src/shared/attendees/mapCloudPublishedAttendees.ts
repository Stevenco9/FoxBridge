import type { Attendee } from '../models'
import { INDIVIDUAL_MEAL_CATEGORY } from '../../integrations/regfox/mealPurchaseClassification'
import {
  type CloudOperationalAttendeeRow,
  parseOperationalJson,
  paymentFromCloudRow,
} from './operationalAttendeeSnapshot'

/** @deprecated Use CloudOperationalAttendeeRow — kept for older call sites. */
export type CloudPublishedAttendeeRow = CloudOperationalAttendeeRow

/** Sanitized Cloud meal entitlement row for the same conference. */
export interface CloudPublishedEntitlementRow {
  attendee_id: string
  meal_key: string
  meal_label: string
  source?: string | null
  source_plan_id?: string | null
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const trimmed = displayName.trim() || 'Unnamed'
  const space = trimmed.indexOf(' ')
  if (space <= 0) {
    return { firstName: trimmed, lastName: '' }
  }
  return {
    firstName: trimmed.slice(0, space).trim(),
    lastName: trimmed.slice(space + 1).trim(),
  }
}

/**
 * Maps Principal-published Cloud attendee + entitlement rows into FoxBridge Attendee[].
 * Linked Desktop Cloud → Local Event Store hydration (snapshot v1 + legacy fallback).
 */
export function mapCloudPublishedAttendeesToFoxBridge(input: {
  foxbridgeEventId: string
  attendees: readonly CloudOperationalAttendeeRow[]
  entitlements?: readonly CloudPublishedEntitlementRow[]
  syncedAt?: string
}): Attendee[] {
  const eventId = input.foxbridgeEventId.trim()
  if (!eventId) {
    return []
  }

  const syncedAt = input.syncedAt?.trim() || new Date().toISOString()
  const entitlements = input.entitlements ?? []

  const entitlementsByLookup = new Map<string, CloudPublishedEntitlementRow[]>()
  for (const row of entitlements) {
    const key = row.attendee_id?.trim()
    if (!key) {
      continue
    }
    const list = entitlementsByLookup.get(key) ?? []
    list.push(row)
    entitlementsByLookup.set(key, list)
  }

  const attendees: Attendee[] = []
  for (const row of input.attendees) {
    const id = row.attendee_id?.trim()
    const registrationId = row.registration_id?.trim() || id
    const qr = row.qr_identifier?.trim() || id
    if (!id || !registrationId) {
      continue
    }

    const ops = parseOperationalJson(row.operational_json)
    const split = splitDisplayName(row.display_name || 'Unnamed attendee')
    const firstName = ops?.firstName?.trim() || split.firstName
    const lastName = ops?.lastName?.trim() || split.lastName

    const purchasesFromOps = ops?.purchases ?? []
    const seenPurchase = new Set(purchasesFromOps.map((p) => p.id))
    const purchases = [...purchasesFromOps]

    const mealRows = [
      ...(entitlementsByLookup.get(id) ?? []),
      ...(qr !== id ? entitlementsByLookup.get(qr) ?? [] : []),
    ]
    for (const meal of mealRows) {
      const mealKey = meal.meal_key?.trim()
      const mealLabel = meal.meal_label?.trim() || mealKey
      if (!mealKey || !mealLabel || seenPurchase.has(mealKey)) {
        continue
      }
      seenPurchase.add(mealKey)
      purchases.push({
        id: mealKey,
        name: mealLabel,
        quantity: 1,
        category: INDIVIDUAL_MEAL_CATEGORY,
      })
    }

    const confirmation =
      row.confirmation_code?.trim() ||
      (qr !== id ? qr : undefined)

    attendees.push({
      id,
      registrationId,
      confirmationCode: confirmation || undefined,
      eventId,
      firstName,
      lastName,
      email: row.email?.trim() || '',
      phone: row.phone?.trim() || undefined,
      organization: row.organization?.trim() || undefined,
      jobTitle: row.job_title?.trim() || undefined,
      department: row.department?.trim() || undefined,
      purchases,
      payment: paymentFromCloudRow(row),
      customFields: ops?.customFields ?? [],
      checkedIn: Boolean(row.checked_in),
      checkedInAt: row.checked_in_at?.trim() || undefined,
      // Workstation-local in 23.4a — never trust Cloud for badge print history.
      badgePrinted: false,
      createdAt: syncedAt,
      updatedAt: row.updated_at?.trim() || syncedAt,
      syncedAt,
      metadata: {
        source: 'foxbridge-cloud',
        qrIdentifier: qr,
        snapshotVersion:
          typeof row.snapshot_version === 'number' ? row.snapshot_version : null,
      },
    })
  }

  return attendees
}
