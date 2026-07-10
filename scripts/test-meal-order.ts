import assert from 'node:assert/strict'
import {
  resolveChronologicalOrderIndex,
  sortMealsChronologically,
} from '../src/features/meals/mealOrder.ts'

function assertOrder(labels: string[], input: Array<{ mealKey: string; mealLabel: string }>): void {
  const sorted = sortMealsChronologically(input).map((meal) => meal.mealLabel)
  assert.deepEqual(sorted, labels)
}

assert.equal(resolveChronologicalOrderIndex('mealPan.thursdayDinner', 'Thursday dinner'), 0)
assert.equal(resolveChronologicalOrderIndex('wrong-key', 'Thursday Dinner'), 0)
assert.equal(resolveChronologicalOrderIndex('wrong-key', 'jueves cena'), 0)
assert.equal(resolveChronologicalOrderIndex('wrong-key', 'cena jueves'), 0)

assertOrder(
  [
    'Thursday dinner',
    'Friday breakfast',
    'Friday lunch',
    'Friday Dinner',
    'Sabbath breakfast',
    'Sabbath Dinner',
  ],
  [
    { mealKey: 'mealPan.fridayBreakfast', mealLabel: 'Friday breakfast' },
    { mealKey: 'mealPan.sabbathDinner', mealLabel: 'Sabbath Dinner' },
    { mealKey: 'wrong.thursday.key', mealLabel: 'Thursday dinner' },
    { mealKey: 'mealPan.fridayLunch', mealLabel: 'Friday lunch' },
    { mealKey: 'unknown', mealLabel: 'Sabbath breakfast' },
    { mealKey: 'mealPan.fridayDinner', mealLabel: 'Friday Dinner' },
  ],
)

assertOrder(
  [
    'Thursday Dinner',
    'Friday breakfast',
    'Friday lunch',
  ],
  [
    { mealKey: 'mealPan.fridayBreakfast', mealLabel: 'Friday breakfast' },
    { mealKey: 'wrong.thursday.key', mealLabel: 'Thursday Dinner' },
    { mealKey: 'mealPan.fridayLunch', mealLabel: 'Friday lunch' },
  ],
)

console.log('meal-order tests passed')
