import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolvePublishAttendeeSnapshot,
  wouldPublishCrossEventLeak,
} from '../src/shared/attendees/publishAttendeeIdentity.ts'
import type { Attendee } from '../src/shared/models/Attendee.ts'
import { createUnknownPayment } from '../src/shared/models/AttendeePayment.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function attendee(partial: Partial<Attendee> & Pick<Attendee, 'id' | 'eventId'>): Attendee {
  const now = '2026-08-13T00:00:00.000Z'
  return {
    id: partial.id,
    registrationId: partial.registrationId ?? partial.id,
    eventId: partial.eventId,
    firstName: partial.firstName ?? 'Test',
    lastName: partial.lastName ?? 'User',
    email: partial.email ?? '',
    purchases: partial.purchases ?? [
      {
        id: 'meal-1',
        name: 'Meal',
        quantity: 1,
        category: 'individualMeal',
      },
    ],
    payment: createUnknownPayment(),
    customFields: [],
    checkedIn: false,
    badgePrinted: false,
    createdAt: now,
    updatedAt: now,
  }
}

// --- A → B: stale A cache must never be accepted as B publish source ---
assert.equal(
  wouldPublishCrossEventLeak({
    sessionEventId: 'event-b',
    cacheEventId: 'event-a',
    cacheAttendees: [attendee({ id: 'a1', eventId: 'event-a', firstName: 'Ada' })],
  }),
  true,
  'stale A cache during B session is a cross-event leak risk',
)

const abortStale = resolvePublishAttendeeSnapshot({
  sessionEventId: 'event-b',
  sessionConferenceId: 'conf-b',
  deskConferenceId: 'conf-b',
  storeAttendees: [attendee({ id: 'a1', eventId: 'event-a', firstName: 'Ada' })],
})
assert.equal(abortStale.ok, false, 'store rows from Event A abort Event B publish')

const emptyB = resolvePublishAttendeeSnapshot({
  sessionEventId: 'event-b',
  sessionConferenceId: 'conf-b',
  deskConferenceId: 'conf-b',
  storeAttendees: [],
})
assert.equal(emptyB.ok, false, 'empty B store aborts rather than falling back to A')

const okB = resolvePublishAttendeeSnapshot({
  sessionEventId: 'event-b',
  sessionConferenceId: 'conf-b',
  deskConferenceId: 'conf-b',
  storeAttendees: [attendee({ id: 'b1', eventId: 'event-b', firstName: 'Bea' })],
})
assert.equal(okB.ok, true)
if (okB.ok) {
  assert.equal(okB.attendees.length, 1)
  assert.equal(okB.attendees[0]?.id, 'b1')
  assert.equal(okB.conferenceId, 'conf-b')
  assert.equal(okB.eventId, 'event-b')
}

const conferenceMismatch = resolvePublishAttendeeSnapshot({
  sessionEventId: 'event-b',
  sessionConferenceId: 'conf-b',
  deskConferenceId: 'conf-a',
  storeAttendees: [attendee({ id: 'b1', eventId: 'event-b' })],
})
assert.equal(conferenceMismatch.ok, false, 'session/desk conference mismatch aborts')

// Reverse B → A isolation
const okA = resolvePublishAttendeeSnapshot({
  sessionEventId: 'event-a',
  sessionConferenceId: 'conf-a',
  deskConferenceId: 'conf-a',
  storeAttendees: [attendee({ id: 'a1', eventId: 'event-a' })],
})
assert.equal(okA.ok, true)
if (okA.ok) {
  assert.equal(okA.attendees[0]?.id, 'a1')
}

// --- Static wiring ---
const publishRepo = read('electron/cloud/publishAttendeesRepository.ts')
assert.equal(publishRepo.includes('resolvePublishAttendeeSnapshot'), true)
assert.equal(publishRepo.includes('getEventAttendees(session.eventId)'), true)
assert.equal(
  /sourceAttendees = attendees \?\? getAttendeeCache\(\)/.test(publishRepo),
  false,
  'must not publish whatever is currently cached',
)
assert.equal(publishRepo.includes('replaceConferenceAttendees'), true)

const edgePublish = read('supabase/functions/desktop-publish/index.ts')
assert.equal(edgePublish.includes('attendees delete failed'), true)
assert.equal(edgePublish.includes(".delete()\n      .eq('conference_id', conferenceId)"), true)

const settingsService = read('electron/settings/settingsService.ts')
assert.equal(settingsService.includes('clearAttendeeCache'), true)
assert.equal(
  settingsService.includes('session?.eventId === foxEvent.id'),
  true,
  'connectRegFox must not publish under a stale session event',
)

console.log('test-publish-event-isolation: ok')
