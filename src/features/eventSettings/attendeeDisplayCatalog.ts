import type {
  AvailableAttendeeField,
  AttendeeFieldSource,
} from '../../shared/attendees/discoverAvailableAttendeeFields'

export interface AttendeeFieldGroup {
  id: AttendeeFieldSource
  label: string
  fields: AvailableAttendeeField[]
}

const GROUP_ORDER: readonly { id: AttendeeFieldSource; label: string }[] = [
  { id: 'built-in', label: 'Built-in' },
  { id: 'derived', label: 'Derived' },
  { id: 'payment', label: 'Payment' },
  { id: 'purchase', label: 'Purchases' },
  { id: 'custom', label: 'Custom Registration' },
]

/**
 * Groups discovered fields into organizer-facing categories.
 * Empty groups are omitted.
 */
export function groupAvailableAttendeeFields(
  fields: readonly AvailableAttendeeField[],
): AttendeeFieldGroup[] {
  const bySource = new Map<AttendeeFieldSource, AvailableAttendeeField[]>()

  for (const field of fields) {
    const list = bySource.get(field.source)
    if (list) {
      list.push(field)
    } else {
      bySource.set(field.source, [field])
    }
  }

  return GROUP_ORDER.flatMap((group) => {
    const groupFields = bySource.get(group.id)
    if (!groupFields || groupFields.length === 0) {
      return []
    }

    return [
      {
        id: group.id,
        label: group.label,
        fields: groupFields,
      },
    ]
  })
}

/**
 * Keys already taken by other rows in the configured list.
 */
export function getSelectedKeysExcludingIndex(
  fieldKeys: readonly string[],
  excludeIndex: number,
): Set<string> {
  const taken = new Set<string>()
  fieldKeys.forEach((key, index) => {
    if (index === excludeIndex) {
      return
    }
    const trimmed = key.trim()
    if (trimmed) {
      taken.add(trimmed)
    }
  })
  return taken
}

/**
 * First catalog key not already selected, or null when the list is full.
 */
export function findFirstUnusedFieldKey(
  catalog: readonly AvailableAttendeeField[],
  selectedKeys: readonly string[],
): string | null {
  const taken = new Set(
    selectedKeys.map((key) => key.trim()).filter(Boolean),
  )

  for (const field of catalog) {
    if (!taken.has(field.key)) {
      return field.key
    }
  }

  return null
}

export function labelForFieldKey(
  catalogByKey: ReadonlyMap<string, AvailableAttendeeField>,
  key: string,
): string {
  const trimmed = key.trim()
  if (!trimmed) {
    return 'Select a field…'
  }

  const match = catalogByKey.get(trimmed)
  if (match?.label.trim()) {
    return match.label
  }

  return `Unavailable — ${trimmed}`
}
