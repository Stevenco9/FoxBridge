import type { Attendee } from '../../shared/models'

function buildSearchText(attendee: Attendee): string {
  const parts: string[] = [
    attendee.firstName,
    attendee.lastName,
    `${attendee.firstName} ${attendee.lastName}`.trim(),
    attendee.email,
    attendee.phone ?? '',
    attendee.organization ?? '',
    attendee.jobTitle ?? '',
    attendee.department ?? '',
    attendee.confirmationCode ?? '',
    attendee.registrationId,
    ...attendee.purchases.map(
      (purchase) => `${purchase.name} ${purchase.category ?? ''}`.trim(),
    ),
    ...attendee.customFields.map((field) => {
      const value = Array.isArray(field.value)
        ? field.value.join(' ')
        : String(field.value ?? '')
      return `${field.label} ${value}`.trim()
    }),
  ]

  return parts.join(' ').toLowerCase()
}

export function searchAttendees(
  attendees: Attendee[],
  query: string,
): Attendee[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return attendees
  }

  return attendees.filter((attendee) =>
    buildSearchText(attendee).includes(normalizedQuery),
  )
}

export function getAttendeeFullName(attendee: Attendee): string {
  return `${attendee.firstName} ${attendee.lastName}`.trim()
}
