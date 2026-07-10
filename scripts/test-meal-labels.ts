import assert from 'node:assert/strict'
import { mapRegistrantToAttendee } from '../src/integrations/regfox/mapRegistrantToAttendee.ts'
import {
  findMealPeriodInLabel,
  labelIndicatesIndividualMeal,
  resolveCanonicalMealIdFromLabel,
  resolveCanonicalPlanIdFromLabel,
  resolvePurchaseIdentity,
} from '../src/integrations/regfox/mealLabelNormalization.ts'
import { getValidatableMeals } from '../src/features/meals/mealValidation.ts'
import { resolveChronologicalOrderIndex } from '../src/features/meals/mealOrder.ts'
import type { RegFoxRegistrant } from '../src/integrations/regfox/regfoxTypes.ts'

assert.equal(findMealPeriodInLabel('Desayuno jueves'), 'breakfast')
assert.equal(findMealPeriodInLabel('COMIDA DEL VIERNES'), 'lunch')
assert.equal(findMealPeriodInLabel('Cena de gala'), 'dinner')
assert.equal(findMealPeriodInLabel('Almuerzo'), 'lunch')
assert.equal(findMealPeriodInLabel('Comida – Adulto'), 'lunch')
assert.equal(findMealPeriodInLabel('Sábado desayuno'), 'breakfast')

assert.equal(resolveCanonicalMealIdFromLabel('Desayuno jueves'), null) // no Thursday breakfast slot
assert.equal(resolveCanonicalMealIdFromLabel('Cena del jueves'), 'mealPan.thursdayDinner')
assert.equal(resolveCanonicalMealIdFromLabel('COMIDA DEL VIERNES'), 'mealPan.fridayLunch')
assert.equal(resolveCanonicalMealIdFromLabel('Viernes desayuno'), 'mealPan.fridayBreakfast')
assert.equal(resolveCanonicalMealIdFromLabel('Cena de gala'), null) // dinner, no day
assert.equal(resolveCanonicalMealIdFromLabel('Friday lunch'), 'mealPan.fridayLunch')
assert.equal(resolveCanonicalMealIdFromLabel('Thursday dinner'), 'mealPan.thursdayDinner')

assert.equal(resolveCanonicalPlanIdFromLabel('Full Meal Plan'), 'mealPan.fullMealPlan')
assert.equal(resolveCanonicalPlanIdFromLabel('Plan completo de comidas'), 'mealPan.fullMealPlan')
assert.equal(resolveCanonicalPlanIdFromLabel('Medio plan'), 'mealPan.halfMealPlan')
assert.equal(resolveCanonicalPlanIdFromLabel('Traigo mi propia comida'), 'mealPan.imBringingMyOwn')

assert.equal(labelIndicatesIndividualMeal('Almuerzo'), true)
assert.equal(labelIndicatesIndividualMeal('Corporate Registration'), false)
assert.equal(labelIndicatesIndividualMeal('Humility and How I Achieved It'), false)

assert.deepEqual(resolvePurchaseIdentity('opciones.cenaViernes', 'Cena del viernes'), {
  id: 'mealPan.fridayDinner',
  category: 'individualMeal',
})
assert.deepEqual(resolvePurchaseIdentity('opciones.planCompleto', 'Plan completo'), {
  id: 'mealPan.fullMealPlan',
  category: 'mealPlan',
})
assert.deepEqual(resolvePurchaseIdentity('registrationOptions.option1', 'Individual Registration'), {
  id: 'registrationOptions.option1',
  category: 'registration',
})
assert.deepEqual(resolvePurchaseIdentity('mealPan.fridayLunch', 'Friday lunch'), {
  id: 'mealPan.fridayLunch',
  category: 'individualMeal',
})

// English path behavior still classifies mealPan purchases.
assert.deepEqual(resolvePurchaseIdentity('mealPan.fullMealPlan', 'Full Meal Plan'), {
  id: 'mealPan.fullMealPlan',
  category: 'mealPlan',
})

const spanishRegistrant: RegFoxRegistrant = {
  id: 9001,
  fieldData: [
    { path: 'comidas.cenaJueves', label: 'Cena del jueves', value: 'true' },
    { path: 'comidas.comidaViernes', label: 'COMIDA DEL VIERNES', value: 'true' },
    { path: 'comidas.almuerzo', label: 'Almuerzo', value: 'true' },
    { path: 'planes.completo', label: 'Plan completo de comidas', value: 'true' },
    { path: 'registrationOptions.option1', label: 'Registro individual', value: 'true' },
  ],
}

const spanishAttendee = mapRegistrantToAttendee(spanishRegistrant, 'event-es')
const spanishMeals = getValidatableMeals(spanishAttendee)
const spanishMealIds = spanishMeals.map((meal) => meal.id).sort()

assert.ok(spanishMealIds.includes('mealPan.thursdayDinner'))
assert.ok(spanishMealIds.includes('mealPan.fridayLunch'))
assert.ok(spanishMealIds.includes('comidas.almuerzo')) // meal term, no day → keep path
// Full plan expands the seven canonical meals; thursday/friday already present.
assert.ok(spanishMealIds.includes('mealPan.fridayBreakfast'))
assert.ok(spanishMealIds.includes('mealPan.sabbathDinner'))
assert.equal(
  spanishAttendee.purchases.find((purchase) => purchase.name === 'Registro individual')?.category,
  'registration',
)

const englishRegistrant: RegFoxRegistrant = {
  id: 9002,
  fieldData: [
    { path: 'mealPan.fullMealPlan', label: 'Full Meal Plan', value: 'true' },
    { path: 'mealPan.fridayLunch', label: 'Friday lunch', value: 'true' },
  ],
}
const englishAttendee = mapRegistrantToAttendee(englishRegistrant, 'event-en')
const englishMealIds = getValidatableMeals(englishAttendee).map((meal) => meal.id)
assert.ok(englishMealIds.includes('mealPan.fridayLunch'))
assert.ok(englishMealIds.includes('mealPan.thursdayDinner'))
assert.ok(englishMealIds.includes('mealPan.sabbathDinner'))

assert.equal(resolveChronologicalOrderIndex('unknown', 'Comida viernes'), 5)
assert.equal(resolveChronologicalOrderIndex('mealPan.fridayLunch', 'Friday lunch'), 5)
assert.equal(resolveChronologicalOrderIndex('mealPan.fridayLunch', 'Comida viernes'), 5)

console.log('meal-label tests passed')
