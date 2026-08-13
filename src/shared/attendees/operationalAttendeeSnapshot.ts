/**
 * FoxBridge Cloud operational attendee snapshot v1.
 *
 * Principal publishes a sanitized projection of the FoxBridge Attendee model
 * for Linked Desktops. Never includes RegFox API keys, desk tokens, or raw
 * RegFox HTTP payloads.
 *
 * Linked Desktop = full operational workstation (read of this snapshot).
 * Principal = administrative owner + RegFox registration authority.
 * Check-in WRITE from Linked is Sprint 23.5 — v1 only carries display state.
 */

import type { Attendee, AttendeeCustomField, AttendeePurchase } from '../models'
import type { AttendeePayment, PaymentStatus } from '../models/AttendeePayment'
import { createUnknownPayment } from '../models/AttendeePayment'

/** Explicit Cloud snapshot contract version for Linked reconstruction. */
export const OPERATIONAL_SNAPSHOT_VERSION = 1 as const

export type OperationalSnapshotVersion = typeof OPERATIONAL_SNAPSHOT_VERSION

/**
 * Approved structured fields that do not warrant dedicated Cloud columns.
 * Only FoxBridge Attendee-normalized data — not raw RegFox form dumps.
 */
export interface OperationalJsonV1 {
  v: 1
  firstName: string
  lastName: string
  purchases: AttendeePurchase[]
  customFields: AttendeeCustomField[]
}

export interface CloudOperationalAttendeeRow {
  attendee_id: string
  registration_id: string
  display_name: string
  email?: string | null
  qr_identifier: string
  updated_at?: string | null
  phone?: string | null
  organization?: string | null
  job_title?: string | null
  department?: string | null
  confirmation_code?: string | null
  payment_status?: string | null
  payment_total?: number | null
  payment_paid?: number | null
  payment_balance?: number | null
  payment_currency?: string | null
  payment_upstream_status?: string | null
  checked_in?: boolean | null
  checked_in_at?: string | null
  snapshot_version?: number | null
  operational_json?: OperationalJsonV1 | Record<string, unknown> | null
}

export function buildOperationalJsonV1(attendee: Attendee): OperationalJsonV1 {
  return {
    v: 1,
    firstName: attendee.firstName ?? '',
    lastName: attendee.lastName ?? '',
    purchases: (attendee.purchases ?? []).map((purchase) => ({
      id: purchase.id,
      name: purchase.name,
      quantity: purchase.quantity,
      category: purchase.category,
    })),
    customFields: (attendee.customFields ?? []).map((field) => ({
      key: field.key,
      label: field.label,
      value: field.value,
    })),
  }
}

export function parseOperationalJson(
  raw: unknown,
): OperationalJsonV1 | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const row = raw as Record<string, unknown>
  const version = row.v
  if (version !== 1 && version !== '1') {
    // Unknown / future version — Linked mapper uses column fallbacks only.
    return null
  }

  const purchases: AttendeePurchase[] = []
  if (Array.isArray(row.purchases)) {
    for (const item of row.purchases) {
      if (!item || typeof item !== 'object') continue
      const p = item as Record<string, unknown>
      const id = typeof p.id === 'string' ? p.id.trim() : ''
      const name = typeof p.name === 'string' ? p.name.trim() : ''
      const quantity =
        typeof p.quantity === 'number' ? p.quantity : Number(p.quantity)
      if (!id || !name || !Number.isFinite(quantity)) continue
      purchases.push({
        id,
        name,
        quantity,
        category: typeof p.category === 'string' ? p.category : undefined,
      })
    }
  }

  const customFields: AttendeeCustomField[] = []
  if (Array.isArray(row.customFields)) {
    for (const item of row.customFields) {
      if (!item || typeof item !== 'object') continue
      const f = item as Record<string, unknown>
      const key = typeof f.key === 'string' ? f.key.trim() : ''
      const label = typeof f.label === 'string' ? f.label.trim() : ''
      if (!key || !label) continue
      customFields.push({
        key,
        label,
        value: (f.value ?? null) as AttendeeCustomField['value'],
      })
    }
  }

  return {
    v: 1,
    firstName: typeof row.firstName === 'string' ? row.firstName : '',
    lastName: typeof row.lastName === 'string' ? row.lastName : '',
    purchases,
    customFields,
  }
}

function normalizePaymentStatus(raw: string | null | undefined): PaymentStatus {
  if (
    raw === 'paid' ||
    raw === 'pending' ||
    raw === 'cancelled' ||
    raw === 'refunded' ||
    raw === 'unknown'
  ) {
    return raw
  }
  return 'unknown'
}

export function paymentFromCloudRow(row: CloudOperationalAttendeeRow): AttendeePayment {
  const hasAnyPaymentField =
    row.payment_status != null ||
    row.payment_total != null ||
    row.payment_paid != null ||
    row.payment_balance != null ||
    row.payment_currency != null ||
    row.payment_upstream_status != null

  if (!hasAnyPaymentField) {
    return createUnknownPayment()
  }

  return {
    status: normalizePaymentStatus(row.payment_status),
    totalAmount:
      typeof row.payment_total === 'number' && Number.isFinite(row.payment_total)
        ? row.payment_total
        : null,
    amountPaid:
      typeof row.payment_paid === 'number' && Number.isFinite(row.payment_paid)
        ? row.payment_paid
        : null,
    balanceDue:
      typeof row.payment_balance === 'number' && Number.isFinite(row.payment_balance)
        ? row.payment_balance
        : null,
    currency:
      typeof row.payment_currency === 'string' && row.payment_currency.trim()
        ? row.payment_currency.trim()
        : null,
    upstreamStatus:
      typeof row.payment_upstream_status === 'string'
        ? row.payment_upstream_status
        : null,
    source: 'regfox',
  }
}

/**
 * Fields intentionally excluded from Cloud operational snapshot.
 * Documented for security / minimization audits.
 */
export const OPERATIONAL_SNAPSHOT_EXCLUSIONS = [
  'RegFox API key',
  'desk tokens / service-role',
  'raw RegFox HTTP response bodies',
  'raw form schema dumps',
  'local badgePrinted / badgePrintedAt (workstation-local in 23.4a)',
  'local printer preference',
  'unrelated sensitive answers not present on FoxBridge Attendee.customFields',
] as const
