import assert from 'node:assert/strict'
import {
  buildMealDetailReport,
  filterMealDetailAttendees,
  mealKeysMatchingCanonical,
  sortMealDetailAttendees,
} from '../src/shared/meals/buildMealDetailReport.ts'
import { calculatePercentServed } from '../src/shared/meals/aggregateMealDashboard.ts'
import type { MealDashboardValidationInput } from '../src/shared/meals/aggregateMealDashboard.ts'

function validation(
  partial: Partial<MealDashboardValidationInput> &
    Pick<MealDashboardValidationInput, 'attendeeId' | 'mealKey' | 'validatedAt'>,
): MealDashboardValidationInput {
  return {
    mealLabel: partial.mealLabel ?? partial.mealKey,
    scannerSessionId: partial.scannerSessionId ?? null,
    ...partial,
  }
}

// Canonical display name + child-path key matching
assert.equal(
  buildMealDetailReport({
    mealKey: 'mealPan.fridayLunch',
    entitlements: [],
    validations: [],
    attendeeNamesById: new Map(),
    scannerLabelsById: new Map(),
    entitlementSource: 'regfox_cache',
  }).mealDisplayName,
  'Comida viernes',
)
assert.ok(mealKeysMatchingCanonical('mealPan.fridayLunch').includes('mealPan.fridayLunch'))
assert.ok(
  mealKeysMatchingCanonical('mealPan.fridayLunch').includes(
    'planDeAlimentacinPara.comidaViernes',
  ),
)

// Zero entitlement → percent null
assert.equal(calculatePercentServed(0, 0), null)
assert.equal(
  buildMealDetailReport({
    mealKey: 'mealPan.fridayLunch',
    entitlements: [],
    validations: [],
    attendeeNamesById: new Map(),
    scannerLabelsById: new Map(),
    entitlementSource: 'regfox_cache',
  }).percentServed,
  null,
)

{
  const report = buildMealDetailReport({
    mealKey: 'mealPan.fridayLunch',
    entitlements: [
      { attendeeId: 'qr-a', mealKey: 'mealPan.fridayLunch' },
      { attendeeId: 'qr-b', mealKey: 'planDeAlimentacinPara.comidaViernes' },
      { attendeeId: 'qr-c', mealKey: 'mealPan.fridayLunch' },
      { attendeeId: 'qr-other', mealKey: 'mealPan.fridayDinner' }, // other meal
    ],
    validations: [
      validation({
        attendeeId: 'qr-a',
        mealKey: 'mealPan.fridayLunch',
        validatedAt: '2026-07-12T12:00:00.000Z',
        scannerSessionId: 'sess-1',
      }),
      // Duplicate for qr-a — earlier time wins for served-at
      validation({
        attendeeId: 'qr-a',
        mealKey: 'planDeAlimentacinPara.comidaViernes',
        validatedAt: '2026-07-12T10:00:00.000Z',
        scannerSessionId: 'sess-2',
      }),
      validation({
        attendeeId: 'qr-orphan',
        mealKey: 'mealPan.fridayLunch',
        validatedAt: '2026-07-12T09:00:00.000Z',
      }),
    ],
    attendeeNamesById: new Map([
      ['qr-a', 'Ana'],
      ['qr-b', 'Bruno'],
      // qr-c missing → Unknown attendee
    ]),
    scannerLabelsById: new Map([
      ['sess-1', 'Door A'],
      ['sess-2', 'Door B'],
    ]),
    entitlementSource: 'regfox_cache',
    refreshedAt: '2026-07-17T00:00:00.000Z',
  })

  assert.equal(report.totalEntitled, 3)
  assert.equal(report.totalServed, 1)
  assert.equal(report.totalNotServed, 2)
  assert.equal(report.percentServed, 33.3)
  assert.equal(report.attendees.length, 3)

  const ana = report.attendees.find((row) => row.attendeeId === 'qr-a')
  assert.ok(ana)
  assert.equal(ana.status, 'served')
  assert.equal(ana.validatedAt, '2026-07-12T10:00:00.000Z')
  assert.equal(ana.scannerLabel, 'Door B')
  assert.equal(ana.rawValidationCount, 2)
  assert.equal(ana.attendeeDisplayName, 'Ana')

  const bruno = report.attendees.find((row) => row.attendeeId === 'qr-b')
  assert.ok(bruno)
  assert.equal(bruno.status, 'not_served')
  assert.equal(bruno.validatedAt, null)

  const carla = report.attendees.find((row) => row.attendeeId === 'qr-c')
  assert.ok(carla)
  assert.equal(carla.attendeeDisplayName, 'Unknown attendee')
  assert.equal(carla.status, 'not_served')

  // Orphan validation (not entitled) must not create a list row
  assert.equal(
    report.attendees.some((row) => row.attendeeId === 'qr-orphan'),
    false,
  )

  // Filters
  assert.equal(filterMealDetailAttendees(report.attendees, 'served', '').length, 1)
  assert.equal(filterMealDetailAttendees(report.attendees, 'not_served', '').length, 2)
  assert.equal(filterMealDetailAttendees(report.attendees, 'all', 'bru').length, 1)
  assert.equal(filterMealDetailAttendees(report.attendees, 'all', 'zzz').length, 0)

  // Sort name A–Z / Z–A
  const byNameAsc = sortMealDetailAttendees(report.attendees, 'name_asc')
  assert.deepEqual(
    byNameAsc.map((row) => row.attendeeDisplayName),
    ['Ana', 'Bruno', 'Unknown attendee'],
  )
  const byNameDesc = sortMealDetailAttendees(report.attendees, 'name_desc')
  assert.equal(byNameDesc[0]?.attendeeDisplayName, 'Unknown attendee')

  // Sort served newest — not-served after served
  const withSecondServed = buildMealDetailReport({
    mealKey: 'mealPan.fridayLunch',
    entitlements: [
      { attendeeId: 'qr-a', mealKey: 'mealPan.fridayLunch' },
      { attendeeId: 'qr-b', mealKey: 'mealPan.fridayLunch' },
      { attendeeId: 'qr-c', mealKey: 'mealPan.fridayLunch' },
    ],
    validations: [
      validation({
        attendeeId: 'qr-a',
        mealKey: 'mealPan.fridayLunch',
        validatedAt: '2026-07-12T10:00:00.000Z',
      }),
      validation({
        attendeeId: 'qr-b',
        mealKey: 'mealPan.fridayLunch',
        validatedAt: '2026-07-12T12:00:00.000Z',
      }),
    ],
    attendeeNamesById: new Map([
      ['qr-a', 'Ana'],
      ['qr-b', 'Bruno'],
      ['qr-c', 'Carla'],
    ]),
    scannerLabelsById: new Map(),
    entitlementSource: 'regfox_cache',
  })

  const newest = sortMealDetailAttendees(withSecondServed.attendees, 'served_newest')
  assert.deepEqual(
    newest.map((row) => row.attendeeDisplayName),
    ['Bruno', 'Ana', 'Carla'],
  )
  const oldest = sortMealDetailAttendees(withSecondServed.attendees, 'served_oldest')
  assert.deepEqual(
    oldest.map((row) => row.attendeeDisplayName),
    ['Ana', 'Bruno', 'Carla'],
  )
}

console.log('Meal detail report tests passed.')
