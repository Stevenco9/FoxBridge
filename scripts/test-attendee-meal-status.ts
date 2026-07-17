import assert from 'node:assert/strict'
import { buildAttendeeMealStatusReport } from '../src/shared/meals/buildAttendeeMealStatus.ts'

{
  const report = buildAttendeeMealStatusReport({
    entitledMeals: [
      { id: 'mealPan.fridayLunch', name: 'Friday Lunch', source: 'mealPlan' },
      { id: 'mealPan.fridayDinner', name: 'Friday Dinner', source: 'individual' },
      { id: 'planDeAlimentacinPara.comidaViernes', name: 'Child lunch', source: 'mealPlan' }, // duplicate canonical
      { id: 'mealPan.sabbathDinner', name: 'Sabbath Dinner', source: 'mealPlan' },
    ],
    validations: [
      {
        mealKey: 'mealPan.fridayLunch',
        validatedAt: '2026-07-12T12:00:00.000Z',
        scannerLabel: 'Phone A',
      },
      {
        mealKey: 'planDeAlimentacinPara.comidaViernes',
        validatedAt: '2026-07-12T10:00:00.000Z',
        scannerLabel: 'Phone B',
      },
      {
        mealKey: 'mealPan.thursdayDinner',
        validatedAt: '2026-07-11T18:00:00.000Z',
        scannerLabel: 'Orphan',
      },
    ],
  })

  assert.equal(report.summary.totalPurchased, 3)
  assert.equal(report.summary.totalServed, 1)
  assert.equal(report.summary.totalNotServed, 2)

  const lunch = report.rows.find((row) => row.mealKey === 'mealPan.fridayLunch')
  assert.ok(lunch)
  assert.equal(lunch.status, 'served')
  assert.equal(lunch.validatedAt, '2026-07-12T10:00:00.000Z')
  assert.equal(lunch.scannerLabel, 'Phone B')
  assert.equal(lunch.mealDisplayName, 'Comida viernes')

  const dinner = report.rows.find((row) => row.mealKey === 'mealPan.fridayDinner')
  assert.ok(dinner)
  assert.equal(dinner.status, 'not_served')
  assert.equal(dinner.validatedAt, null)

  const sabbath = report.rows.find((row) => row.mealKey === 'mealPan.sabbathDinner')
  assert.ok(sabbath)
  assert.equal(sabbath.status, 'not_served')

  assert.equal(
    report.rows.some((row) => row.mealKey === 'mealPan.thursdayDinner'),
    false,
  )
}

{
  const empty = buildAttendeeMealStatusReport({
    entitledMeals: [],
    validations: [
      {
        mealKey: 'mealPan.fridayLunch',
        validatedAt: '2026-07-12T12:00:00.000Z',
      },
    ],
  })
  assert.equal(empty.summary.totalPurchased, 0)
  assert.equal(empty.rows.length, 0)
}

console.log('Attendee meal status tests passed.')
