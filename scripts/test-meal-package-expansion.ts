import assert from 'node:assert/strict'
import { mapRegistrantToAttendee } from '../src/integrations/regfox/mapRegistrantToAttendee.ts'
import {
  CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  COMPLETE_ELEVEN_MEAL_EXPANSION,
  COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  expandCompleteMealPackage,
  isCompleteElevenMealPackage,
  resolvePurchaseIdentity,
} from '../src/integrations/regfox/mealLabelNormalization.ts'
import {
  CANONICAL_MEAL_SERVICE_LABELS,
  CANONICAL_MEAL_SERVICE_ORDER,
} from '../src/shared/meals/canonicalMealOrder.ts'
import { MEAL_PAN_INDIVIDUAL_MEAL_IDS } from '../src/integrations/regfox/mealPurchaseClassification.ts'
import {
  buildMealValidationKey,
  getValidatableMeals,
  isMealValidated,
} from '../src/features/meals/mealValidation.ts'
import type { RegFoxRegistrant } from '../src/integrations/regfox/regfoxTypes.ts'

const EXPECTED_LABELS = [
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
]

assert.equal(COMPLETE_ELEVEN_MEAL_EXPANSION.length, 11)
assert.deepEqual([...COMPLETE_ELEVEN_MEAL_EXPANSION], [...CANONICAL_MEAL_SERVICE_ORDER])
assert.equal(COMPLETE_ELEVEN_MEAL_PACKAGE_PATH, 'multipleChoice.meal1')
assert.equal(
  CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  'planDeAlimentacinPara.planDeAlimentacinCompleto',
)

assert.equal(
  isCompleteElevenMealPackage(
    'multipleChoice.meal1',
    'Plan de alimentación completo (11 comidas)',
  ),
  true,
)
assert.equal(
  isCompleteElevenMealPackage(
    'planDeAlimentacinPara.planDeAlimentacinCompleto',
    'Plan de alimentación completo para los niños. (11 comidas)',
  ),
  true,
)
assert.equal(
  isCompleteElevenMealPackage(
    'other.path',
    'Plan de alimentación completo (11 comidas)',
  ),
  true,
)
assert.equal(isCompleteElevenMealPackage('multipleChoice.meal2', 'Cena miércoles'), false)

const adultExpanded = expandCompleteMealPackage(
  'multipleChoice.meal1',
  'Plan de alimentación completo (11 comidas)',
)
const childrenExpanded = expandCompleteMealPackage(
  'planDeAlimentacinPara.planDeAlimentacinCompleto',
  'Plan de alimentación completo para los niños. (11 comidas)',
)
assert.ok(adultExpanded)
assert.ok(childrenExpanded)
assert.deepEqual([...adultExpanded], [...COMPLETE_ELEVEN_MEAL_EXPANSION])
assert.deepEqual([...childrenExpanded], [...adultExpanded])

assert.deepEqual(
  resolvePurchaseIdentity(
    'multipleChoice.meal1',
    'Plan de alimentación completo (11 comidas)',
  ),
  { id: COMPLETE_ELEVEN_MEAL_PACKAGE_PATH, category: 'mealPlan' },
)
assert.deepEqual(
  resolvePurchaseIdentity(
    'planDeAlimentacinPara.planDeAlimentacinCompleto',
    'Plan de alimentación completo para los niños. (11 comidas)',
  ),
  { id: CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH, category: 'mealPlan' },
)

const adultRegistrant: RegFoxRegistrant = {
  id: 9101,
  fieldData: [
    {
      path: 'multipleChoice.meal1',
      label: 'Plan de alimentación completo (11 comidas)',
      value: 'true',
    },
  ],
}
const adultMeals = getValidatableMeals(mapRegistrantToAttendee(adultRegistrant, 'event-mx'))
assert.equal(adultMeals.length, 11)
assert.equal(
  adultMeals.some((meal) => meal.id === COMPLETE_ELEVEN_MEAL_PACKAGE_PATH),
  false,
)
assert.equal(
  adultMeals.some((meal) => /11 comidas|plan de alimentación completo/i.test(meal.name)),
  false,
)
assert.deepEqual(
  adultMeals.map((meal) => meal.id),
  [...COMPLETE_ELEVEN_MEAL_EXPANSION],
)
assert.deepEqual(
  adultMeals.map((meal) => meal.name),
  EXPECTED_LABELS,
)

const childrenRegistrant: RegFoxRegistrant = {
  id: 9106,
  fieldData: [
    {
      path: 'planDeAlimentacinPara.planDeAlimentacinCompleto',
      label: 'Plan de alimentación completo para los niños. (11 comidas)',
      value: 'true',
    },
  ],
}
const childrenMeals = getValidatableMeals(mapRegistrantToAttendee(childrenRegistrant, 'event-mx'))
assert.equal(childrenMeals.length, 11)
assert.equal(
  childrenMeals.some((meal) => meal.id === CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH),
  false,
)
assert.equal(
  childrenMeals.some((meal) => /11 comidas|niños/i.test(meal.name)),
  false,
)
assert.deepEqual(
  childrenMeals.map((meal) => meal.id),
  adultMeals.map((meal) => meal.id),
)
assert.deepEqual(childrenMeals.map((meal) => meal.id), [...COMPLETE_ELEVEN_MEAL_EXPANSION])

// Labels containing “niños” must not affect order.
const ninosLabeled = childrenMeals.map((meal) => ({
  mealKey: meal.id,
  mealLabel: `Plan niños — ${meal.name}`,
}))
assert.deepEqual(
  ninosLabeled
    .slice()
    .reverse()
    .sort((a, b) => {
      return (
        COMPLETE_ELEVEN_MEAL_EXPANSION.indexOf(a.mealKey) -
        COMPLETE_ELEVEN_MEAL_EXPANSION.indexOf(b.mealKey)
      )
    })
    .map((meal) => meal.mealKey),
  [...COMPLETE_ELEVEN_MEAL_EXPANSION],
)

// À la carte children’s meals use the same chronological order.
const childALaCarte: RegFoxRegistrant = {
  id: 9110,
  fieldData: [
    {
      path: 'planDeAlimentacinPara.comidaViernes',
      label: 'Comida viernes',
      value: 'true',
    },
    {
      path: 'planDeAlimentacinPara.cenaMircoles',
      label: 'Cena miércoles',
      value: 'true',
    },
    {
      path: 'planDeAlimentacinPara.desayunoDomingo',
      label: 'Desayuno domingo',
      value: 'true',
    },
  ],
}
const childALaCarteMeals = getValidatableMeals(mapRegistrantToAttendee(childALaCarte, 'event-mx'))
assert.deepEqual(
  childALaCarteMeals.map((meal) => meal.id),
  ['multipleChoice.meal2', 'mealPan.fridayLunch', 'multipleChoice.desayunoDomingo'],
)

// Adult + children packages on one registration → still 11 unique meals.
const bothPackages: RegFoxRegistrant = {
  id: 9107,
  fieldData: [
    {
      path: 'multipleChoice.meal1',
      label: 'Plan de alimentación completo (11 comidas)',
      value: 'true',
    },
    {
      path: 'planDeAlimentacinPara.planDeAlimentacinCompleto',
      label: 'Plan de alimentación completo para los niños. (11 comidas)',
      value: 'true',
    },
  ],
}
const bothMeals = getValidatableMeals(mapRegistrantToAttendee(bothPackages, 'event-mx'))
assert.equal(bothMeals.length, 11)

// Package + à la carte duplicate → 11 unique meals.
const packagePlusDuplicate: RegFoxRegistrant = {
  id: 9103,
  fieldData: [
    {
      path: 'multipleChoice.meal1',
      label: 'Plan de alimentación completo (11 comidas)',
      value: 'true',
    },
    {
      path: 'multipleChoice.cenaJueves',
      label: 'Cena jueves',
      value: 'true',
    },
  ],
}
const deduped = getValidatableMeals(mapRegistrantToAttendee(packagePlusDuplicate, 'event-mx'))
assert.equal(deduped.length, 11)
assert.equal(deduped.filter((meal) => meal.id === 'mealPan.thursdayDinner').length, 1)
assert.equal(
  deduped.find((meal) => meal.id === 'mealPan.thursdayDinner')?.source,
  'individual',
)

// À la carte–only meals use the same chronological sorting.
const aLaCarte: RegFoxRegistrant = {
  id: 9108,
  fieldData: [
    { path: 'multipleChoice.comidaViernes', label: 'Comida viernes', value: 'true' },
    { path: 'multipleChoice.meal2', label: 'Cena miércoles', value: 'true' },
    { path: 'multipleChoice.desayunoDomingo', label: 'Desayuno domingo', value: 'true' },
  ],
}
const aLaCarteMeals = getValidatableMeals(mapRegistrantToAttendee(aLaCarte, 'event-mx'))
assert.deepEqual(
  aLaCarteMeals.map((meal) => meal.id),
  [
    'multipleChoice.meal2',
    'mealPan.fridayLunch',
    'multipleChoice.desayunoDomingo',
  ],
)

// Misclassified stale package as individualMeal still expands and hides package.
const stalePackageAsIndividual: RegFoxRegistrant = {
  id: 9109,
  fieldData: [],
}
const staleAttendee = mapRegistrantToAttendee(stalePackageAsIndividual, 'event-mx')
staleAttendee.purchases.push({
  id: COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  name: 'Plan de alimentación completo (11 comidas)',
  quantity: 1,
  category: 'individualMeal',
})
const recovered = getValidatableMeals(staleAttendee)
assert.equal(recovered.length, 11)
assert.equal(
  recovered.some((meal) => meal.id === COMPLETE_ELEVEN_MEAL_PACKAGE_PATH),
  false,
)

// English full meal plan still expands to the seven mealPan meals.
const englishRegistrant: RegFoxRegistrant = {
  id: 9104,
  fieldData: [
    { path: 'mealPan.fullMealPlan', label: 'Full Meal Plan', value: 'true' },
  ],
}
const englishMeals = getValidatableMeals(mapRegistrantToAttendee(englishRegistrant, 'event-en'))
assert.equal(englishMeals.length, 7)
assert.ok(englishMeals.every((meal) => meal.id.startsWith('mealPan.')))
assert.ok(englishMeals.some((meal) => meal.id === 'mealPan.thursdayDinner'))
assert.ok(englishMeals.some((meal) => meal.id === 'mealPan.sabbathDinner'))

// Spanish individual meal still maps.
const spanishIndividual: RegFoxRegistrant = {
  id: 9105,
  fieldData: [
    { path: 'multipleChoice.desayunoViernes', label: 'Desayuno viernes', value: 'true' },
  ],
}
const spanishMeals = getValidatableMeals(mapRegistrantToAttendee(spanishIndividual, 'event-mx'))
assert.equal(spanishMeals.length, 1)
assert.equal(spanishMeals[0]?.id, 'mealPan.fridayBreakfast')

// Independent validation keys.
const attendeeId = '9101'
const validated = new Set<string>()
validated.add(buildMealValidationKey(attendeeId, adultMeals[0]!.id))
assert.equal(isMealValidated(validated, attendeeId, adultMeals[0]!.id), true)
assert.equal(isMealValidated(validated, attendeeId, adultMeals[1]!.id), false)

for (const mealId of COMPLETE_ELEVEN_MEAL_EXPANSION) {
  assert.ok(CANONICAL_MEAL_SERVICE_LABELS[mealId])
  if (mealId.startsWith('mealPan.')) {
    assert.ok(MEAL_PAN_INDIVIDUAL_MEAL_IDS.has(mealId))
  }
}

console.log('meal-package-expansion tests passed')
