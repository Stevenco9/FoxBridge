const VALIDATABLE_MEAL_ORDER = [
  'mealPan.thursdayDinner',
  'mealPan.fridayBreakfast',
  'mealPan.fridayLunch',
  'mealPan.fridayDinner',
  'mealPan.sabbathBreakfast',
  'mealPan.sabbathLuch',
  'mealPan.sabbathDinner',
] as const

const VALIDATABLE_MEAL_DEFINITIONS: Record<string, string> = {
  'mealPan.thursdayDinner': 'Thursday dinner',
  'mealPan.fridayBreakfast': 'Friday breakfast',
  'mealPan.fridayLunch': 'Friday lunch',
  'mealPan.fridayDinner': 'Friday Dinner',
  'mealPan.sabbathBreakfast': 'Sabbath breakfast',
  'mealPan.sabbathLuch': 'Sabbath luch',
  'mealPan.sabbathDinner': 'Sabbath Dinner',
}

export interface ChronologicalMealSortInput {
  mealKey: string
  mealLabel: string
}

const DAY_TOKENS: readonly { index: number; tokens: readonly string[] }[] = [
  { index: 0, tokens: ['thursday', 'jueves'] },
  { index: 1, tokens: ['friday', 'viernes'] },
  { index: 2, tokens: ['sabbath', 'sábado', 'sabado'] },
]

const MEAL_TOKENS: readonly { index: number; tokens: readonly string[] }[] = [
  { index: 0, tokens: ['breakfast', 'desayuno'] },
  { index: 1, tokens: ['lunch', 'almuerzo'] },
  { index: 2, tokens: ['dinner', 'cena'] },
]

const UNRECOGNIZED_SORT_BASE = 1_000

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function normalizeMealLabel(value: string): string {
  return normalizeToken(value).replace(/\s+/g, ' ')
}

function resolveKnownMealKeyIndex(mealKey: string): number | null {
  const trimmedKey = mealKey.trim()
  const exactIndex = VALIDATABLE_MEAL_ORDER.indexOf(
    trimmedKey as (typeof VALIDATABLE_MEAL_ORDER)[number],
  )
  if (exactIndex >= 0) {
    return exactIndex
  }

  const normalizedKey = normalizeToken(trimmedKey)
  const caseInsensitiveIndex = VALIDATABLE_MEAL_ORDER.findIndex(
    (candidate) => normalizeToken(candidate) === normalizedKey,
  )
  if (caseInsensitiveIndex >= 0) {
    return caseInsensitiveIndex
  }

  return null
}

function resolveKnownMealLabelIndex(mealLabel: string): number | null {
  const normalizedLabel = normalizeMealLabel(mealLabel)
  if (!normalizedLabel) {
    return null
  }

  for (let index = 0; index < VALIDATABLE_MEAL_ORDER.length; index += 1) {
    const mealId = VALIDATABLE_MEAL_ORDER[index]
    const canonicalLabel = VALIDATABLE_MEAL_DEFINITIONS[mealId]
    if (canonicalLabel && normalizeMealLabel(canonicalLabel) === normalizedLabel) {
      return index
    }
  }

  return null
}

function findTokenIndex(
  normalizedLabel: string,
  tokenGroups: readonly { index: number; tokens: readonly string[] }[],
): number | null {
  for (const group of tokenGroups) {
    if (group.tokens.some((token) => normalizedLabel.includes(normalizeToken(token)))) {
      return group.index
    }
  }

  return null
}

function buildParsedSlotIndexLookup(): Map<string, number> {
  const lookup = new Map<string, number>()

  for (let index = 0; index < VALIDATABLE_MEAL_ORDER.length; index += 1) {
    const mealId = VALIDATABLE_MEAL_ORDER[index]
    const canonicalLabel = VALIDATABLE_MEAL_DEFINITIONS[mealId]
    if (!canonicalLabel) {
      continue
    }

    const normalizedCanonical = normalizeMealLabel(canonicalLabel)
    const dayIndex = findTokenIndex(normalizedCanonical, DAY_TOKENS)
    const mealIndex = findTokenIndex(normalizedCanonical, MEAL_TOKENS)
    if (dayIndex == null || mealIndex == null) {
      continue
    }

    lookup.set(`${dayIndex}:${mealIndex}`, index)
  }

  return lookup
}

const PARSED_SLOT_TO_ORDER_INDEX = buildParsedSlotIndexLookup()

function resolveParsedLabelIndex(mealLabel: string): number | null {
  const normalizedLabel = normalizeMealLabel(mealLabel)
  if (!normalizedLabel) {
    return null
  }

  const dayIndex = findTokenIndex(normalizedLabel, DAY_TOKENS)
  const mealIndex = findTokenIndex(normalizedLabel, MEAL_TOKENS)
  if (dayIndex == null || mealIndex == null) {
    return null
  }

  return PARSED_SLOT_TO_ORDER_INDEX.get(`${dayIndex}:${mealIndex}`) ?? null
}

export function resolveChronologicalOrderIndex(mealKey: string, mealLabel: string): number {
  const knownKeyIndex = resolveKnownMealKeyIndex(mealKey)
  if (knownKeyIndex != null) {
    return knownKeyIndex
  }

  const knownLabelIndex = resolveKnownMealLabelIndex(mealLabel)
  if (knownLabelIndex != null) {
    return knownLabelIndex
  }

  const parsedLabelIndex = resolveParsedLabelIndex(mealLabel)
  if (parsedLabelIndex != null) {
    return parsedLabelIndex
  }

  return UNRECOGNIZED_SORT_BASE
}

export function compareMealsChronologically(
  left: ChronologicalMealSortInput,
  right: ChronologicalMealSortInput,
): number {
  const leftIndex = resolveChronologicalOrderIndex(left.mealKey, left.mealLabel)
  const rightIndex = resolveChronologicalOrderIndex(right.mealKey, right.mealLabel)

  if (leftIndex !== rightIndex) {
    if (
      leftIndex >= UNRECOGNIZED_SORT_BASE &&
      rightIndex >= UNRECOGNIZED_SORT_BASE
    ) {
      return left.mealLabel.localeCompare(right.mealLabel, undefined, { sensitivity: 'base' })
    }

    return leftIndex - rightIndex
  }

  return left.mealLabel.localeCompare(right.mealLabel, undefined, { sensitivity: 'base' })
}

export function sortMealsChronologically<T extends ChronologicalMealSortInput>(
  meals: T[],
): T[] {
  return [...meals].sort(compareMealsChronologically)
}
