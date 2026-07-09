import { createRegFoxServiceFromEnv } from '../src/integrations/regfox'
import {
  INDIVIDUAL_MEAL_CATEGORY,
  MEAL_CHOICE_CATEGORY,
  MEAL_PLAN_CATEGORY,
  isMealRelatedCategory,
} from '../src/integrations/regfox/mealPurchaseClassification'
import type { Attendee, AttendeeCustomField, AttendeePurchase } from '../src/shared/models'

const SENSITIVE_FIELD_PATTERN =
  /(^|\.|\b)(email|e-mail|phone|mobile|apikey|api_key|secret|password|token)($|\.|\b)/i

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/

function isSensitiveField(field: AttendeeCustomField): boolean {
  const haystack = `${field.key} ${field.label}`
  return SENSITIVE_FIELD_PATTERN.test(haystack)
}

function redactValue(value: AttendeeCustomField['value']): string {
  if (value == null) {
    return '(empty)'
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactString(String(item))).join(', ')
  }

  return redactString(String(value))
}

function redactString(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return '(empty)'
  }

  if (EMAIL_PATTERN.test(trimmed)) {
    return '[redacted email]'
  }

  if (PHONE_PATTERN.test(trimmed)) {
    return '[redacted phone]'
  }

  return trimmed
}

function formatPurchaseLine(purchase: AttendeePurchase): string {
  return `    - ${purchase.name} (id: ${purchase.id})`
}

function formatCustomField(field: AttendeeCustomField): string {
  return `    - ${field.label} (key: ${field.key}) = ${redactValue(field.value)}`
}

function getMealPlans(purchases: AttendeePurchase[]): AttendeePurchase[] {
  return purchases.filter(
    (purchase) =>
      purchase.category === MEAL_PLAN_CATEGORY || purchase.category === 'meal',
  )
}

function getIndividualMeals(purchases: AttendeePurchase[]): AttendeePurchase[] {
  return purchases.filter((purchase) => purchase.category === INDIVIDUAL_MEAL_CATEGORY)
}

function getMealChoice(purchases: AttendeePurchase[]): AttendeePurchase | undefined {
  return purchases.find((purchase) => purchase.category === MEAL_CHOICE_CATEGORY)
}

function printPurchaseSection(title: string, purchases: AttendeePurchase[]): void {
  console.log(`  ${title}:`)
  if (purchases.length === 0) {
    console.log('    (none)')
    return
  }

  for (const purchase of purchases) {
    console.log(formatPurchaseLine(purchase))
  }
}

async function main(): Promise<void> {
  const service = createRegFoxServiceFromEnv()
  const connection = await service.testConnection()

  if (!connection.success) {
    console.log(`RegFox connection failed: ${connection.message ?? 'Unknown error'}`)
    process.exitCode = 1
    return
  }

  console.log('Connected.')

  const attendees = await service.getAttendees()
  console.log(`Downloaded ${attendees.length} attendees.\n`)

  for (const attendee of attendees) {
    printAttendeeDetails(attendee)
    console.log('')
  }
}

function printAttendeeDetails(attendee: Attendee): void {
  const name = `${attendee.firstName} ${attendee.lastName}`.trim()
  console.log(`${name} (id: ${attendee.id}, registrationId: ${attendee.registrationId})`)

  const mealPlans = getMealPlans(attendee.purchases)
  const individualMeals = getIndividualMeals(attendee.purchases)
  const mealChoice = getMealChoice(attendee.purchases)
  const otherPurchases = attendee.purchases.filter(
    (purchase) => !isMealRelatedCategory(purchase.category),
  )

  printPurchaseSection('Meal plans', mealPlans)
  printPurchaseSection('Individual meals', individualMeals)
  console.log(`  Meal choice: ${mealChoice?.name ?? '(none)'}`)

  console.log('  Other purchases:')
  if (otherPurchases.length === 0) {
    console.log('    (none)')
  } else {
    for (const purchase of otherPurchases) {
      console.log(formatPurchaseLine(purchase))
    }
  }

  const safeCustomFields = attendee.customFields.filter((field) => !isSensitiveField(field))

  console.log('  Custom fields:')
  if (safeCustomFields.length === 0) {
    console.log('    (none)')
  } else {
    for (const field of safeCustomFields) {
      console.log(formatCustomField(field))
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.log(`RegFox connection failed: ${message}`)
  process.exitCode = 1
})
