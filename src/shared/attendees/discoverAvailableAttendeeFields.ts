import type { Attendee, AttendeeCustomField } from '../models'

/**
 * Value type for an attendee attribute when it can be inferred.
 * Custom fields may remain `unknown` when samples disagree or are empty.
 */
export type AttendeeFieldDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'unknown'

/**
 * Origin of a catalog entry on the FoxBridge Attendee model.
 *
 * - `built-in` — fixed properties on `Attendee`
 * - `derived` — composites resolved from other fields (not stored separately)
 * - `payment` — nested `Attendee.payment` snapshot
 * - `custom` — `Attendee.customFields` from registration form answers
 * - `purchase` — `Attendee.purchases` (tickets, meals, books, merchandise, etc.)
 */
export type AttendeeFieldSource =
  | 'built-in'
  | 'derived'
  | 'payment'
  | 'custom'
  | 'purchase'

/**
 * One organizer-selectable attribute for future attendee-detail highlight config.
 *
 * Designed as a plain JSON-serializable shape so Sprint 20.2 can wrap this
 * service in IPC without changing keys or return structure.
 */
export interface AvailableAttendeeField {
  /** Stable internal key for configuration storage and later value resolution. */
  key: string
  /** Human-readable label for organizers. */
  label: string
  /** Known data type when inferable; otherwise `unknown`. */
  dataType: AttendeeFieldDataType
  /** Where the value lives on / is derived from the Attendee model. */
  source: AttendeeFieldSource
  /**
   * Purchase category when `source` is `purchase`
   * (e.g. `ticket`, `mealPlan`, `individualMeal`, `registration`).
   */
  category?: string
}

/**
 * Input for discovering available fields.
 * Kept as an object so future options (e.g. eventId filter) can be added without
 * breaking callers or an IPC payload shape.
 */
export interface DiscoverAvailableAttendeeFieldsInput {
  /**
   * Imported attendees for the event. Built-in / derived / payment fields are
   * always returned even when this list is empty. Custom fields and purchase
   * line items are discovered from the union of values present on these records.
   */
  attendees: readonly Attendee[]
}

const BUILT_IN_FIELDS: readonly AvailableAttendeeField[] = [
  { key: 'id', label: 'Attendee ID', dataType: 'string', source: 'built-in' },
  {
    key: 'registrationId',
    label: 'Registration ID',
    dataType: 'string',
    source: 'built-in',
  },
  {
    key: 'confirmationCode',
    label: 'Confirmation Code',
    dataType: 'string',
    source: 'built-in',
  },
  { key: 'eventId', label: 'Event ID', dataType: 'string', source: 'built-in' },
  { key: 'firstName', label: 'First Name', dataType: 'string', source: 'built-in' },
  { key: 'lastName', label: 'Last Name', dataType: 'string', source: 'built-in' },
  { key: 'email', label: 'Email', dataType: 'string', source: 'built-in' },
  { key: 'phone', label: 'Phone', dataType: 'string', source: 'built-in' },
  {
    key: 'organization',
    label: 'Organization',
    dataType: 'string',
    source: 'built-in',
  },
  { key: 'jobTitle', label: 'Job Title', dataType: 'string', source: 'built-in' },
  {
    key: 'department',
    label: 'Department',
    dataType: 'string',
    source: 'built-in',
  },
  {
    key: 'checkedIn',
    label: 'Checked In',
    dataType: 'boolean',
    source: 'built-in',
  },
  {
    key: 'checkedInAt',
    label: 'Checked In At',
    dataType: 'string',
    source: 'built-in',
  },
  {
    key: 'badgePrinted',
    label: 'Badge Printed',
    dataType: 'boolean',
    source: 'built-in',
  },
  {
    key: 'badgePrintedAt',
    label: 'Badge Printed At',
    dataType: 'string',
    source: 'built-in',
  },
  { key: 'createdAt', label: 'Created At', dataType: 'string', source: 'built-in' },
  { key: 'updatedAt', label: 'Updated At', dataType: 'string', source: 'built-in' },
  { key: 'syncedAt', label: 'Synced At', dataType: 'string', source: 'built-in' },
]

const DERIVED_FIELDS: readonly AvailableAttendeeField[] = [
  { key: 'fullName', label: 'Full Name', dataType: 'string', source: 'derived' },
  {
    key: 'cityState',
    label: 'City + State',
    dataType: 'string',
    source: 'derived',
  },
  {
    key: 'registrationType',
    label: 'Registration Type',
    dataType: 'string',
    source: 'derived',
  },
]

const PAYMENT_FIELDS: readonly AvailableAttendeeField[] = [
  {
    key: 'payment.status',
    label: 'Payment Status',
    dataType: 'string',
    source: 'payment',
  },
  {
    key: 'payment.totalAmount',
    label: 'Payment Total',
    dataType: 'number',
    source: 'payment',
  },
  {
    key: 'payment.amountPaid',
    label: 'Amount Paid',
    dataType: 'number',
    source: 'payment',
  },
  {
    key: 'payment.balanceDue',
    label: 'Balance Due',
    dataType: 'number',
    source: 'payment',
  },
  {
    key: 'payment.currency',
    label: 'Currency',
    dataType: 'string',
    source: 'payment',
  },
  {
    key: 'payment.upstreamStatus',
    label: 'Upstream Payment Status',
    dataType: 'string',
    source: 'payment',
  },
]

/** Prefix for custom registration question field keys (matches badge field IDs). */
export const CUSTOM_FIELD_KEY_PREFIX = 'custom:'

/** Prefix for purchase / registration-selection field keys (matches badge field IDs). */
export const PURCHASE_FIELD_KEY_PREFIX = 'purchase:'

export function customAttendeeFieldKey(customFieldKey: string): string {
  return `${CUSTOM_FIELD_KEY_PREFIX}${customFieldKey}`
}

export function purchaseAttendeeFieldKey(purchaseId: string): string {
  return `${PURCHASE_FIELD_KEY_PREFIX}${purchaseId}`
}

function inferCustomValueDataType(
  value: AttendeeCustomField['value'],
): AttendeeFieldDataType | null {
  if (value == null) {
    return null
  }

  if (Array.isArray(value)) {
    return 'string[]'
  }

  const typeofValue = typeof value
  if (
    typeofValue === 'string' ||
    typeofValue === 'number' ||
    typeofValue === 'boolean'
  ) {
    return typeofValue
  }

  return 'unknown'
}

function mergeDataTypes(
  current: AttendeeFieldDataType,
  next: AttendeeFieldDataType | null,
): AttendeeFieldDataType {
  if (next == null) {
    return current
  }

  if (current === 'unknown') {
    return next
  }

  if (current === next) {
    return current
  }

  return 'unknown'
}

interface CustomFieldAccumulator {
  key: string
  label: string
  dataType: AttendeeFieldDataType
}

interface PurchaseAccumulator {
  key: string
  label: string
  category?: string
}

function collectCustomFields(
  attendees: readonly Attendee[],
): AvailableAttendeeField[] {
  const byKey = new Map<string, CustomFieldAccumulator>()

  for (const attendee of attendees) {
    for (const field of attendee.customFields) {
      const trimmedKey = field.key.trim()
      if (!trimmedKey) {
        continue
      }

      const catalogKey = customAttendeeFieldKey(trimmedKey)
      const inferred = inferCustomValueDataType(field.value)
      const existing = byKey.get(catalogKey)

      if (!existing) {
        byKey.set(catalogKey, {
          key: catalogKey,
          label: field.label.trim() || trimmedKey,
          dataType: inferred ?? 'unknown',
        })
        continue
      }

      existing.dataType = mergeDataTypes(existing.dataType, inferred)
      if (!existing.label && field.label.trim()) {
        existing.label = field.label.trim()
      }
    }
  }

  return [...byKey.values()]
    .map(
      (entry): AvailableAttendeeField => ({
        key: entry.key,
        label: entry.label,
        dataType: entry.dataType,
        source: 'custom',
      }),
    )
    .sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
    )
}

function collectPurchaseFields(
  attendees: readonly Attendee[],
): AvailableAttendeeField[] {
  const byKey = new Map<string, PurchaseAccumulator>()

  for (const attendee of attendees) {
    for (const purchase of attendee.purchases) {
      const trimmedId = purchase.id.trim()
      if (!trimmedId) {
        continue
      }

      const catalogKey = purchaseAttendeeFieldKey(trimmedId)
      const existing = byKey.get(catalogKey)
      const label = purchase.name.trim() || trimmedId

      if (!existing) {
        byKey.set(catalogKey, {
          key: catalogKey,
          label,
          category: purchase.category,
        })
        continue
      }

      if (!existing.label && label) {
        existing.label = label
      }
      if (!existing.category && purchase.category) {
        existing.category = purchase.category
      }
    }
  }

  return [...byKey.values()]
    .map(
      (entry): AvailableAttendeeField => ({
        key: entry.key,
        label: entry.label,
        // Purchases store selectable quantities; boolean checkboxes map as quantity 1.
        dataType: 'number',
        source: 'purchase',
        category: entry.category,
      }),
    )
    .sort((left, right) => {
      const categoryCompare = (left.category ?? '').localeCompare(
        right.category ?? '',
        undefined,
        { sensitivity: 'base' },
      )
      if (categoryCompare !== 0) {
        return categoryCompare
      }

      return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
    })
}

/**
 * Returns the static catalog entries that do not depend on imported attendee rows.
 * Useful for unit tests and for callers that only need the fixed Attendee surface.
 */
export function getStaticAvailableAttendeeFields(): AvailableAttendeeField[] {
  return [...BUILT_IN_FIELDS, ...DERIVED_FIELDS, ...PAYMENT_FIELDS]
}

/**
 * Discovers every meaningful Attendee attribute organizers may later choose to
 * display in the attendee details panel.
 *
 * Pure / renderer-agnostic: pass already-imported `Attendee[]`. Does not touch
 * RegFox, IPC, SQLite, or UI. Safe to call from main or renderer once attendees
 * are in memory.
 *
 * Discovery rules:
 * - Built-in, derived, and payment fields are always included.
 * - Custom registration questions are the union of `customFields` keys/labels
 *   across the provided attendees (typed from observed values when consistent).
 * - Purchase / package / meal / merchandise selections are the union of
 *   `purchases` ids across attendees (`purchase:<id>`), with optional category.
 */
export function discoverAvailableAttendeeFields(
  input: DiscoverAvailableAttendeeFieldsInput,
): AvailableAttendeeField[] {
  const attendees = input.attendees ?? []

  return [
    ...getStaticAvailableAttendeeFields(),
    ...collectPurchaseFields(attendees),
    ...collectCustomFields(attendees),
  ]
}
