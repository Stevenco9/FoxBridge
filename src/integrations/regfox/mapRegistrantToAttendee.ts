import type { Attendee, AttendeeCustomField, AttendeePurchase } from '../../shared/models'
import { resolvePurchaseIdentity } from './mealLabelNormalization'
import type { RegFoxFieldDataItem, RegFoxRegistrant } from './regfoxTypes'

const STANDARD_FIELD_PATHS = new Set([
  'firstname',
  'first',
  'lastname',
  'last',
  'email',
  'phone',
  'company',
  'organization',
  'jobtitle',
  'department',
])

/**
 * Maps a RegFox registrant record to FoxBridge's internal Attendee model.
 */
export function mapRegistrantToAttendee(
  registrant: RegFoxRegistrant,
  eventId: string,
): Attendee {
  const fieldData = normalizeFieldData(registrant.fieldData)
  const now = new Date().toISOString()

  const firstName =
    getFieldValue(fieldData, 'name.first', 'firstName', 'registrants.firstName') ??
    registrant.billing?.firstName ??
    ''

  const lastName =
    getFieldValue(fieldData, 'name.last', 'lastName', 'registrants.lastName') ??
    registrant.billing?.lastName ??
    ''

  const email =
    registrant.orderEmail ??
    getFieldValue(fieldData, 'email', 'registrants.email') ??
    ''

  const phone =
    registrant.billing?.phone ?? getFieldValue(fieldData, 'phone', 'registrants.phone')

  const organization =
    registrant.billing?.organization ??
    registrant.billing?.company ??
    getFieldValue(fieldData, 'organization', 'company', 'registrants.company')

  const jobTitle = getFieldValue(fieldData, 'jobTitle', 'registrants.jobTitle')
  const department = getFieldValue(fieldData, 'department', 'registrants.department')

  return {
    id: String(registrant.id ?? registrant.displayId ?? crypto.randomUUID()),
    registrationId: String(registrant.id ?? ''),
    confirmationCode: registrant.displayId ?? registrant.orderNumber,
    eventId,
    firstName,
    lastName,
    email,
    phone,
    organization,
    jobTitle,
    department,
    purchases: mapPurchases(registrant, fieldData),
    customFields: mapCustomFields(fieldData),
    checkedIn: registrant.checkedIn ?? false,
    checkedInAt: registrant.dateCheckedIn,
    badgePrinted: false,
    createdAt: registrant.dateCreated ?? now,
    updatedAt: registrant.dateUpdated ?? registrant.dateCreated ?? now,
  }
}

function normalizeFieldData(
  fieldData: RegFoxRegistrant['fieldData'],
): RegFoxFieldDataItem[] {
  if (!fieldData) {
    return []
  }

  if (Array.isArray(fieldData)) {
    return fieldData
  }

  return []
}

function getFieldValue(
  fieldData: RegFoxFieldDataItem[],
  ...paths: string[]
): string | undefined {
  for (const path of paths) {
    const normalizedPath = path.toLowerCase()
    const match = fieldData.find((field) => {
      const fieldPath = field.path?.toLowerCase() ?? ''
      return (
        fieldPath === normalizedPath ||
        fieldPath.endsWith(`.${normalizedPath}`) ||
        fieldPath.split('.').pop() === normalizedPath
      )
    })

    if (match?.value != null && String(match.value).trim() !== '') {
      return String(match.value).trim()
    }
  }

  return undefined
}

function mapPurchases(
  registrant: RegFoxRegistrant,
  fieldData: RegFoxFieldDataItem[],
): AttendeePurchase[] {
  const purchases: AttendeePurchase[] = []

  if (registrant.levelLabel) {
    purchases.push({
      id: registrant.levelKey ?? registrant.levelLabel,
      name: registrant.levelLabel,
      quantity: 1,
      category: 'ticket',
    })
  }

  for (const field of fieldData) {
    if (field.value !== 'true' && field.value !== true) {
      continue
    }

    if (!field.label || !field.path) {
      continue
    }

    const identity = resolvePurchaseIdentity(field.path, field.label)

    purchases.push({
      id: identity.id,
      name: field.label,
      quantity: 1,
      category: identity.category,
    })
  }

  return purchases
}

function mapCustomFields(fieldData: RegFoxFieldDataItem[]): AttendeeCustomField[] {
  return fieldData
    .filter((field) => {
      const path = field.path?.toLowerCase() ?? ''
      const leaf = path.split('.').pop() ?? path
      return field.path && field.label && !STANDARD_FIELD_PATHS.has(leaf)
    })
    .filter((field) => field.value !== 'true' && field.value !== true)
    .map((field) => ({
      key: field.path!,
      label: field.label!,
      value: field.value ?? null,
    }))
}
