import { getAttendeeFullName } from '../../src/features/attendees/searchAttendees'
import { getAttendeeQrValue } from '../../src/features/badge/getAttendeeQrValue'
import { getValidatableMeals } from '../../src/features/meals/mealValidation'
import type { Attendee } from '../../src/shared/models'
import type { ScannerAttendeeResponse } from '../../src/shared/models/ScannerServer'

export function buildScannerAttendeeResponse(attendee: Attendee): ScannerAttendeeResponse {
  return {
    attendeeId: getAttendeeQrValue(attendee),
    name: getAttendeeFullName(attendee) || 'Unnamed attendee',
    registrationId: attendee.registrationId,
    validatableMeals: getValidatableMeals(attendee),
  }
}
