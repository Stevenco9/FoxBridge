import assert from 'node:assert/strict'
import {
  resolveChronologicalOrderIndex,
  sortMealsChronologically,
} from '../src/features/meals/mealOrder.ts'
import {
  CANONICAL_MEAL_SERVICE_ORDER,
  getCanonicalMealOrderIndex,
  normalizeAndSortMealEntitlements,
  sortMealsByCanonicalOrder,
} from '../src/shared/meals/canonicalMealOrder.ts'

function assertOrder(labels: string[], input: Array<{ mealKey: string; mealLabel: string }>): void {
  const sorted = sortMealsChronologically(input).map((meal) => meal.mealLabel)
  assert.deepEqual(sorted, labels)
}

assert.equal(resolveChronologicalOrderIndex('mealPan.thursdayDinner', 'Thursday dinner'), 3)
assert.equal(resolveChronologicalOrderIndex('wrong-key', 'Cena jueves'), 3)
assert.equal(resolveChronologicalOrderIndex('wrong-key', 'cena jueves'), 3)
assert.equal(
  getCanonicalMealOrderIndex('planDeAlimentacinPara.cenaJueves'),
  3,
)

assertOrder(
  [
    'Cena miércoles',
    'Desayuno jueves',
    'Comida jueves',
    'Cena jueves',
    'Desayuno viernes',
    'Comida viernes',
    'Cena viernes',
    'Desayuno sábado',
    'Comida sábado',
    'Cena sábado',
    'Desayuno domingo',
  ],
  [
    { mealKey: 'mealPan.fridayBreakfast', mealLabel: 'Desayuno viernes' },
    { mealKey: 'mealPan.sabbathDinner', mealLabel: 'Cena sábado' },
    { mealKey: 'multipleChoice.meal2', mealLabel: 'Cena miércoles' },
    { mealKey: 'mealPan.fridayLunch', mealLabel: 'Comida viernes' },
    { mealKey: 'multipleChoice.desayunoDomingo', mealLabel: 'Desayuno domingo' },
    { mealKey: 'mealPan.fridayDinner', mealLabel: 'Cena viernes' },
    { mealKey: 'multipleChoice.desayunoJueves', mealLabel: 'Desayuno jueves' },
    { mealKey: 'mealPan.sabbathBreakfast', mealLabel: 'Desayuno sábado' },
    { mealKey: 'multipleChoice.meal3', mealLabel: 'Comida jueves' },
    { mealKey: 'mealPan.sabbathLuch', mealLabel: 'Comida sábado' },
    { mealKey: 'mealPan.thursdayDinner', mealLabel: 'Cena jueves' },
  ],
)

// Randomized row order (simulating Supabase) sorts back to canonical IDs.
const scrambled = [...CANONICAL_MEAL_SERVICE_ORDER]
  .reverse()
  .map((mealKey) => ({
    mealKey,
    mealLabel: `niños label should not matter ${mealKey}`,
  }))
assert.deepEqual(
  sortMealsByCanonicalOrder(scrambled).map((meal) => meal.mealKey),
  [...CANONICAL_MEAL_SERVICE_ORDER],
)

// Legacy children paths normalize + sort into the same order.
const legacyChildRows = [
  {
    mealKey: 'planDeAlimentacinPara.comidaViernes',
    mealLabel: 'Comida viernes',
  },
  {
    mealKey: 'planDeAlimentacinPara.cenaMircoles',
    mealLabel: 'Cena miércoles',
  },
  {
    mealKey: 'planDeAlimentacinPara.desayunoDomingo',
    mealLabel: 'Desayuno domingo',
  },
]
assert.deepEqual(
  normalizeAndSortMealEntitlements(legacyChildRows).map((meal) => meal.mealKey),
  ['multipleChoice.meal2', 'mealPan.fridayLunch', 'multipleChoice.desayunoDomingo'],
)

// Unknown package keys are filtered; other unknown legacy keys sort after canonical meals.
const withPackage = normalizeAndSortMealEntitlements([
  { mealKey: 'multipleChoice.meal1', mealLabel: 'Plan de alimentación completo (11 comidas)' },
  { mealKey: 'mealPan.fridayLunch', mealLabel: 'Comida viernes' },
  { mealKey: 'unknown.legacy', mealLabel: 'Mystery' },
])
assert.deepEqual(
  withPackage.map((meal) => meal.mealKey),
  ['mealPan.fridayLunch', 'unknown.legacy'],
)
assert.equal(getCanonicalMealOrderIndex('mealPan.fridayLunch'), 5)
assert.equal(getCanonicalMealOrderIndex('unknown.legacy'), null)

assert.deepEqual(
  sortMealsChronologically(scrambled).map((meal) => meal.mealKey),
  sortMealsByCanonicalOrder(scrambled).map((meal) => meal.mealKey),
)

// Mobile normalize path uses the same shared configuration.
assert.deepEqual(
  normalizeAndSortMealEntitlements(scrambled).map((meal) => meal.mealKey),
  [...CANONICAL_MEAL_SERVICE_ORDER],
)

console.log('meal-order tests passed')
