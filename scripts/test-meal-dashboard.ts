import assert from 'node:assert/strict'
import {
  aggregateMealDashboard,
  calculatePercentServed,
  type MealDashboardValidationInput,
} from '../src/shared/meals/aggregateMealDashboard.ts'
import { buildEntitlementsFromAttendees } from '../src/shared/meals/buildLiveMealEntitlements.ts'
import { CANONICAL_MEAL_SERVICE_ORDER } from '../src/shared/meals/canonicalMealOrder.ts'
import { createUnknownPayment } from '../src/shared/models/AttendeePayment.ts'
import type { Attendee } from '../src/shared/models/Attendee.ts'

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

// Percent when entitlement is zero → null (no divide-by-zero)
assert.equal(calculatePercentServed(5, 0), null)
assert.equal(calculatePercentServed(0, 0), null)
assert.equal(calculatePercentServed(5, null), null)
assert.equal(calculatePercentServed(1, 4), 25)
assert.equal(calculatePercentServed(1, 3), 33.3)

// Empty validation data
{
  const result = aggregateMealDashboard({
    validations: [],
    entitlements: [],
    attendeeNamesById: new Map(),
    scannerLabelsById: new Map(),
  })
  assert.equal(result.summary.totalValidations, 0)
  assert.equal(result.summary.distinctAttendeesServed, 0)
  assert.equal(result.summary.mealsWithValidations, 0)
  assert.equal(result.summary.mostRecentValidationAt, null)
  assert.equal(result.recentScans.length, 0)
  assert.ok(result.meals.length >= CANONICAL_MEAL_SERVICE_ORDER.length)
  assert.ok(result.meals.every((row) => row.validatedCount === 0))
}

// Aggregate counts + distinct attendees + canonical order + recent newest-first
{
  const validations = [
    validation({
      attendeeId: 'qr-a',
      mealKey: 'mealPan.fridayLunch',
      validatedAt: '2026-07-10T12:00:00.000Z',
      scannerSessionId: 'sess-1',
    }),
    validation({
      attendeeId: 'qr-b',
      mealKey: 'multipleChoice.meal2',
      validatedAt: '2026-07-11T18:00:00.000Z',
    }),
    validation({
      attendeeId: 'qr-a',
      mealKey: 'planDeAlimentacinPara.comidaViernes', // child path → fridayLunch
      validatedAt: '2026-07-12T09:00:00.000Z',
    }),
    validation({
      attendeeId: 'qr-c',
      mealKey: 'multipleChoice.meal2',
      validatedAt: '2026-07-09T08:00:00.000Z',
      scannerSessionId: 'sess-missing',
    }),
  ]

  const result = aggregateMealDashboard({
    validations,
    entitlements: [
      { attendeeId: 'qr-a', mealKey: 'mealPan.fridayLunch' },
      { attendeeId: 'qr-b', mealKey: 'mealPan.fridayLunch' },
      { attendeeId: 'qr-a', mealKey: 'multipleChoice.meal2' },
      { attendeeId: 'qr-b', mealKey: 'multipleChoice.meal2' },
      { attendeeId: 'qr-c', mealKey: 'multipleChoice.meal2' },
    ],
    attendeeNamesById: new Map([
      ['qr-a', 'Ana'],
      ['qr-b', 'Bruno'],
      ['qr-c', 'Carla'],
    ]),
    scannerLabelsById: new Map([['sess-1', 'Door A']]),
  })

  assert.equal(result.summary.totalValidations, 4)
  assert.equal(result.summary.distinctAttendeesServed, 3)
  assert.equal(result.summary.mealsWithValidations, 2)
  assert.equal(result.summary.mostRecentValidationAt, '2026-07-12T09:00:00.000Z')

  const friday = result.meals.find((row) => row.mealKey === 'mealPan.fridayLunch')
  assert.ok(friday)
  assert.equal(friday.validatedCount, 2)
  assert.equal(friday.entitledCount, 2)
  assert.equal(friday.percentServed, 100)
  assert.equal(friday.mealDisplayName, 'Comida viernes')

  const wednesday = result.meals.find((row) => row.mealKey === 'multipleChoice.meal2')
  assert.ok(wednesday)
  assert.equal(wednesday.validatedCount, 2)
  assert.equal(wednesday.entitledCount, 3)
  assert.equal(wednesday.percentServed, 66.7)

  // Canonical order: Wednesday dinner before Friday lunch
  const wedIndex = result.meals.findIndex((row) => row.mealKey === 'multipleChoice.meal2')
  const friIndex = result.meals.findIndex((row) => row.mealKey === 'mealPan.fridayLunch')
  assert.ok(wedIndex < friIndex)

  // Recent scans newest first, limit respected
  assert.equal(result.recentScans[0]?.validatedAt, '2026-07-12T09:00:00.000Z')
  assert.equal(result.recentScans[0]?.attendeeDisplayName, 'Ana')
  assert.equal(result.recentScans[0]?.mealDisplayName, 'Comida viernes')
  assert.equal(result.recentScans[1]?.attendeeDisplayName, 'Bruno')

  const withScanner = result.recentScans.find((scan) => scan.validatedAt === '2026-07-10T12:00:00.000Z')
  assert.equal(withScanner?.scannerLabel, 'Door A')

  const missingScanner = result.recentScans.find(
    (scan) => scan.validatedAt === '2026-07-09T08:00:00.000Z',
  )
  assert.equal(missingScanner?.scannerLabel, null)
}

// Entitled zero → percent null on meal row
{
  const result = aggregateMealDashboard({
    validations: [
      validation({
        attendeeId: 'qr-x',
        mealKey: 'mealPan.fridayDinner',
        validatedAt: '2026-07-01T00:00:00.000Z',
      }),
    ],
    entitlements: [],
    attendeeNamesById: new Map([['qr-x', 'Ximena']]),
    scannerLabelsById: new Map(),
  })
  const dinner = result.meals.find((row) => row.mealKey === 'mealPan.fridayDinner')
  assert.ok(dinner)
  assert.equal(dinner.entitledCount, 0)
  assert.equal(dinner.percentServed, null)
  assert.equal(dinner.validatedCount, 1)
}

// Live RegFox entitlements: complete package expands to all canonical meals
{
  const attendee: Attendee = {
    id: 'reg-1',
    registrationId: 'reg-1',
    eventId: 'event',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    purchases: [
      {
        id: 'multipleChoice.meal1',
        name: 'Plan de alimentación completo (11 comidas)',
        quantity: 1,
        category: 'mealPlan',
      },
    ],
    payment: createUnknownPayment(),
    customFields: [],
    checkedIn: false,
    badgePrinted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  const entitlements = buildEntitlementsFromAttendees([attendee])
  assert.equal(entitlements.length, CANONICAL_MEAL_SERVICE_ORDER.length)
  assert.ok(entitlements.every((row) => row.attendeeId === 'reg-1'))
  assert.ok(
    entitlements.some((row) => row.mealKey === 'mealPan.fridayLunch'),
    'complete plan must entitle Friday lunch',
  )
}

console.log('Meal dashboard aggregation tests passed.')
