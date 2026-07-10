import assert from 'node:assert/strict'
import {
  buildMealDisplayModel,
  describeMealDisplayOrder,
} from '../apps/mobile/src/models/mealDisplayModel.ts'
import {
  CANONICAL_MEAL_SERVICE_ORDER,
  CANONICAL_MEAL_SERVICE_LABELS,
} from '../src/shared/meals/canonicalMealOrder.ts'

const EXPECTED_IDS = [...CANONICAL_MEAL_SERVICE_ORDER]
const EXPECTED_LABELS = EXPECTED_IDS.map((id) => CANONICAL_MEAL_SERVICE_LABELS[id]!)

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = (i * 7 + 3) % (i + 1)
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

function adultCanonicalRows() {
  return EXPECTED_IDS.map((mealKey) => ({
    mealKey,
    mealLabel: CANONICAL_MEAL_SERVICE_LABELS[mealKey]!,
    source: 'mealPlan',
    sourcePlanId: 'multipleChoice.meal1',
  }))
}

function childrenLegacyRows() {
  return [
    {
      mealKey: 'planDeAlimentacinPara.cenaMircoles',
      mealLabel: 'Cena miércoles',
      source: 'mealPlan',
    },
    {
      mealKey: 'planDeAlimentacinPara.desayunoJueves',
      mealLabel: 'Desayuno jueves',
      source: 'mealPlan',
    },
    {
      mealKey: 'planDeAlimentacinPara.comidaJueves',
      mealLabel: 'Comida jueves',
      source: 'mealPlan',
    },
    {
      mealKey: 'planDeAlimentacinPara.cenaJueves',
      mealLabel: 'Cena jueves',
      source: 'mealPlan',
    },
    {
      mealKey: 'planDeAlimentacinPara.desayunoViernes',
      mealLabel: 'Desayuno viernes',
      source: 'mealPlan',
    },
    {
      mealKey: 'planDeAlimentacinPara.comidaViernes',
      mealLabel: 'Comida viernes',
      source: 'mealPlan',
    },
    {
      mealKey: 'planDeAlimentacinPara.cenaViernes',
      mealLabel: 'Cena viernes',
      source: 'mealPlan',
    },
    {
      mealKey: 'planDeAlimentacinPara.desayunoSbado',
      mealLabel: 'Desayuno sábado',
      source: 'mealPlan',
    },
    {
      mealKey: 'planDeAlimentacinPara.comidaSbado',
      mealLabel: 'Comida sábado',
      source: 'mealPlan',
    },
    {
      mealKey: 'planDeAlimentacinPara.cenaSbado',
      mealLabel: 'Cena sábado',
      source: 'mealPlan',
    },
    {
      mealKey: 'planDeAlimentacinPara.desayunoDomingo',
      mealLabel: 'Desayuno domingo',
      source: 'mealPlan',
    },
  ]
}

function assertDisplayOrder(
  rows: ReturnType<typeof adultCanonicalRows>,
  validations: Array<{ mealKey: string; mealLabel: string; validatedAt: string }> = [],
): void {
  const displayed = buildMealDisplayModel(rows, validations)
  assert.deepEqual(
    displayed.map((meal) => meal.mealKey),
    EXPECTED_IDS,
  )
  assert.deepEqual(
    displayed.map((meal) => meal.mealLabel),
    EXPECTED_LABELS,
  )

  const trace = describeMealDisplayOrder(displayed)
  assert.deepEqual(
    trace.map((row) => row.canonicalOrder),
    EXPECTED_IDS.map((_, index) => index),
  )
}

// 1. Adult complete-plan rows in random order
assertDisplayOrder(shuffle(adultCanonicalRows()))

// 2. Children’s legacy-path rows in random order
assertDisplayOrder(shuffle(childrenLegacyRows()))

// 3. Mixed canonical and legacy duplicate rows
assertDisplayOrder(
  shuffle([
    ...adultCanonicalRows(),
    ...childrenLegacyRows(),
    {
      mealKey: 'multipleChoice.meal1',
      mealLabel: 'Plan de alimentación completo (11 comidas)',
      source: 'mealPlan',
    },
  ]),
)

// 4. Some meals already validated — status changes, order does not
{
  const displayed = buildMealDisplayModel(shuffle(adultCanonicalRows()), [
    {
      mealKey: 'mealPan.fridayLunch',
      mealLabel: 'Comida viernes',
      validatedAt: '2026-07-10T12:00:00.000Z',
    },
    {
      mealKey: 'multipleChoice.meal2',
      mealLabel: 'Cena miércoles',
      validatedAt: '2026-07-10T12:01:00.000Z',
    },
  ])
  assert.deepEqual(
    displayed.map((meal) => meal.mealKey),
    EXPECTED_IDS,
  )
  assert.equal(displayed[0]?.status, 'already_validated')
  assert.equal(displayed[5]?.status, 'already_validated')
  assert.equal(displayed[1]?.status, 'available')
}

// 5. Alphabetical Supabase row order
assertDisplayOrder(
  [...adultCanonicalRows()].sort((a, b) => a.mealLabel.localeCompare(b.mealLabel)),
)

// 6. Timestamp-like insertion order (newest first)
assertDisplayOrder([...adultCanonicalRows()].reverse())

// 7. Adult and child final display arrays are identical
{
  const adult = buildMealDisplayModel(shuffle(adultCanonicalRows()))
  const child = buildMealDisplayModel(shuffle(childrenLegacyRows()))
  assert.deepEqual(
    adult.map((meal) => meal.mealKey),
    child.map((meal) => meal.mealKey),
  )
  assert.deepEqual(
    adult.map((meal) => meal.mealLabel),
    child.map((meal) => meal.mealLabel),
  )
}

// 8. No later grouping/status enrichment changes order
{
  const first = buildMealDisplayModel(shuffle(adultCanonicalRows()))
  const second = buildMealDisplayModel(first.map((meal) => ({
    mealKey: meal.mealKey,
    mealLabel: meal.mealLabel,
    source: meal.source,
  })), [
    {
      mealKey: 'mealPan.sabbathDinner',
      mealLabel: 'Cena sábado',
      validatedAt: '2026-07-10T18:00:00.000Z',
    },
  ])
  assert.deepEqual(
    second.map((meal) => meal.mealKey),
    first.map((meal) => meal.mealKey),
  )
}

console.log('mobile-meal-display-order tests passed')
