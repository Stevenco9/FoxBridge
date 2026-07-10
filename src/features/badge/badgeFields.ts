import type { Attendee, AttendeeCustomField } from '../../shared/models'
import { getAttendeeFullName } from '../attendees/searchAttendees'

export interface BadgeFieldDefinition {
  id: string
  label: string
  resolve: (attendee: Attendee) => string
}

export interface BadgeLayoutSelection {
  top: string[]
  middle: string[]
  bottom: string[]
}

export const MAX_FIELDS_PER_SLOT = 3

export const NONE_FIELD_ID = ''

export const DEFAULT_BADGE_LAYOUT: BadgeLayoutSelection = {
  top: ['full-name', '', ''],
  middle: ['city-state', '', ''],
  bottom: ['registration-type', '', ''],
}

const STANDARD_FIELD_CANDIDATES: BadgeFieldDefinition[] = [
  {
    id: 'full-name',
    label: 'Full Name',
    resolve: (attendee) => getAttendeeFullName(attendee),
  },
  {
    id: 'confirmation-code',
    label: 'Confirmation Code',
    resolve: (attendee) => attendee.confirmationCode ?? '',
  },
  {
    id: 'first-name',
    label: 'First Name',
    resolve: (attendee) => attendee.firstName,
  },
  {
    id: 'last-name',
    label: 'Last Name',
    resolve: (attendee) => attendee.lastName,
  },
  {
    id: 'email',
    label: 'Email',
    resolve: (attendee) => attendee.email,
  },
  {
    id: 'phone',
    label: 'Phone',
    resolve: (attendee) => attendee.phone ?? '',
  },
  {
    id: 'organization',
    label: 'Organization',
    resolve: (attendee) => attendee.organization ?? '',
  },
  {
    id: 'job-title',
    label: 'Job Title',
    resolve: (attendee) => attendee.jobTitle ?? '',
  },
  {
    id: 'department',
    label: 'Department',
    resolve: (attendee) => attendee.department ?? '',
  },
  {
    id: 'city-state',
    label: 'City + State',
    resolve: getCityState,
  },
  {
    id: 'registration-type',
    label: 'Registration Type',
    resolve: getRegistrationType,
  },
]

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

function findCustomFieldValue(attendee: Attendee, paths: string[]): string | undefined {
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
      return String(match.value)
    }
  }

  return undefined
}

function customFieldId(key: string): string {
  return `custom:${key}`
}

function purchaseFieldId(id: string): string {
  return `purchase:${id}`
}

function hasDisplayValue(value: AttendeeCustomField['value']): boolean {
  if (value == null) {
    return false
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed !== '' && trimmed !== 'true'
  }

  if (typeof value === 'boolean') {
    return value !== true
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return true
}

function formatCustomFieldValue(value: AttendeeCustomField['value']): string {
  if (value == null) {
    return ''
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value).trim()
}

function buildCustomFieldDefinition(field: AttendeeCustomField): BadgeFieldDefinition {
  return {
    id: customFieldId(field.key),
    label: field.label,
    resolve: (attendee) => {
      const match = attendee.customFields.find((item) => item.key === field.key)
      if (!match || !hasDisplayValue(match.value)) {
        return ''
      }

      return formatCustomFieldValue(match.value)
    },
  }
}

function buildPurchaseFieldDefinition(
  purchaseId: string,
  label: string,
): BadgeFieldDefinition {
  return {
    id: purchaseFieldId(purchaseId),
    label,
    resolve: (attendee) => {
      const purchase = attendee.purchases.find((item) => item.id === purchaseId)
      return purchase?.name.trim() ?? ''
    },
  }
}

const STANDARD_FIELD_ORDER: string[] = [
  'full-name',
  'confirmation-code',
  'first-name',
  'last-name',
  'email',
  'phone',
  'organization',
  'job-title',
  'department',
  'city-state',
  'registration-type',
]

function orderBadgeFields(
  fields: BadgeFieldDefinition[],
  attendee: Attendee,
): BadgeFieldDefinition[] {
  const standardRank = new Map(STANDARD_FIELD_ORDER.map((fieldId, index) => [fieldId, index]))
  const purchaseRank = new Map(
    attendee.purchases.map((purchase, index) => [purchaseFieldId(purchase.id), index]),
  )
  const customRank = new Map(
    attendee.customFields.map((field, index) => [customFieldId(field.key), index]),
  )

  return [...fields].sort((left, right) => {
    const leftRank = getBadgeFieldRank(left, standardRank, purchaseRank, customRank)
    const rightRank = getBadgeFieldRank(right, standardRank, purchaseRank, customRank)

    if (leftRank.group !== rightRank.group) {
      return leftRank.group - rightRank.group
    }

    if (leftRank.index !== rightRank.index) {
      return leftRank.index - rightRank.index
    }

    return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
  })
}

function getBadgeFieldRank(
  field: BadgeFieldDefinition,
  standardRank: Map<string, number>,
  purchaseRank: Map<string, number>,
  customRank: Map<string, number>,
): { group: number; index: number } {
  const standardIndex = standardRank.get(field.id)
  if (standardIndex != null) {
    return { group: 0, index: standardIndex }
  }

  if (field.id.startsWith('purchase:')) {
    return {
      group: 1,
      index: purchaseRank.get(field.id) ?? Number.MAX_SAFE_INTEGER,
    }
  }

  if (field.id.startsWith('custom:')) {
    return {
      group: 2,
      index: customRank.get(field.id) ?? Number.MAX_SAFE_INTEGER,
    }
  }

  return { group: 3, index: 0 }
}

/**
 * Returns badge field options for a single attendee, including only fields
 * that currently have values on that attendee.
 */
export function getAvailableBadgeFields(attendee: Attendee): BadgeFieldDefinition[] {
  const fields: BadgeFieldDefinition[] = []
  const seenIds = new Set<string>()
  const seenLabels = new Set<string>()

  const addField = (field: BadgeFieldDefinition): void => {
    if (seenIds.has(field.id)) {
      return
    }

    const value = field.resolve(attendee).trim()
    if (!value) {
      return
    }

    const normalizedLabel = field.label.trim().toLowerCase()
    if (seenLabels.has(normalizedLabel)) {
      return
    }

    seenIds.add(field.id)
    seenLabels.add(normalizedLabel)
    fields.push(field)
  }

  for (const field of STANDARD_FIELD_CANDIDATES) {
    addField(field)
  }

  for (const purchase of attendee.purchases) {
    if (!purchase.name.trim()) {
      continue
    }

    addField(buildPurchaseFieldDefinition(purchase.id, purchase.name))
  }

  for (const customField of attendee.customFields) {
    if (!hasDisplayValue(customField.value)) {
      continue
    }

    addField(buildCustomFieldDefinition(customField))
  }

  return orderBadgeFields(fields, attendee)
}

export function resolveBadgeFieldValue(
  attendee: Attendee,
  fieldId: string,
  availableFields: BadgeFieldDefinition[],
): string {
  if (!fieldId || fieldId === NONE_FIELD_ID) {
    return ''
  }

  const field = availableFields.find((item) => item.id === fieldId)
  if (!field) {
    return ''
  }

  return field.resolve(attendee).trim()
}

export function normalizeSlotFields(fields: string[]): string[] {
  const slots = fields.slice(0, MAX_FIELDS_PER_SLOT)
  while (slots.length < MAX_FIELDS_PER_SLOT) {
    slots.push(NONE_FIELD_ID)
  }
  return slots
}

export function resolveBadgeFieldValues(
  attendee: Attendee,
  fieldIds: string[],
  availableFields: BadgeFieldDefinition[],
): string[] {
  return normalizeSlotFields(fieldIds)
    .map((fieldId) => resolveBadgeFieldValue(attendee, fieldId, availableFields))
    .filter((value) => value !== '')
}
