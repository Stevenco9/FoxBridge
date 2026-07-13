import assert from 'node:assert/strict'
import { createUnknownPayment } from '../src/shared/models/AttendeePayment.ts'
import type { Attendee, AttendeePurchase } from '../src/shared/models/Attendee.ts'
import {
  hasAgricultureBookPurchase,
  hasConsejosSobreAgriculturaPurchase,
  isConsejosSobreAgriculturaLabel,
  normalizePurchaseLabel,
} from '../src/features/attendees/agricultureBookPurchase.ts'
import { mapRegistrantToAttendee } from '../src/integrations/regfox/mapRegistrantToAttendee.ts'
import type { RegFoxRegistrant } from '../src/integrations/regfox/regfoxTypes.ts'

/** Live RegFox product label for the Ellen White agriculture book add-on. */
const REGFOX_BOOK_LABEL =
  'Libro de "Consejos sobre Agricultura" de Ellen White'

function purchase(name: string, id = name): AttendeePurchase {
  return { id, name, quantity: 1, category: 'addon' }
}

function attendeeWithPurchases(purchases: AttendeePurchase[]): Attendee {
  return {
    id: 'a1',
    registrationId: '1',
    eventId: 'event',
    firstName: 'María',
    lastName: 'López',
    email: 'test@example.com',
    purchases,
    payment: createUnknownPayment(),
    customFields: [],
    checkedIn: false,
    badgePrinted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

// Exact Spanish product name
assert.equal(isConsejosSobreAgriculturaLabel('Consejos sobre Agricultura'), true)

// Different capitalization
assert.equal(isConsejosSobreAgriculturaLabel('CONSEJOS SOBRE AGRICULTURA'), true)

// Accented / unaccented variants (normalization strips accents from both sides)
assert.equal(normalizePurchaseLabel('Agricultúra'), 'agricultura')
assert.equal(isConsejosSobreAgriculturaLabel('Consejos sobre Agricultúra'), true)
assert.equal(isConsejosSobreAgriculturaLabel('consejos sobre agricultura'), true)

// Extra punctuation and spaces
assert.equal(
  isConsejosSobreAgriculturaLabel('  Consejos,  sobre   Agricultura.  '),
  true,
)

// Prefixed libro / punctuation variants
assert.equal(isConsejosSobreAgriculturaLabel('Libro Consejos sobre Agricultura'), true)
assert.equal(isConsejosSobreAgriculturaLabel('Libro - Consejos sobre Agricultura'), true)
assert.equal(isConsejosSobreAgriculturaLabel('Consejos de Agricultura'), true)
assert.equal(
  isConsejosSobreAgriculturaLabel('Consejos sobre agricultura - libro'),
  true,
)

// Exact live RegFox quantity add-on label
assert.equal(isConsejosSobreAgriculturaLabel(REGFOX_BOOK_LABEL), true)

// Unrelated agriculture product must not match
assert.equal(isConsejosSobreAgriculturaLabel('Curso de Agricultura Orgánica'), false)
assert.equal(isConsejosSobreAgriculturaLabel('Agricultura'), false)
assert.equal(isConsejosSobreAgriculturaLabel('Consejos de viaje'), false)
assert.equal(isConsejosSobreAgriculturaLabel(''), false)

// No purchases
assert.equal(hasAgricultureBookPurchase([]), false)
assert.equal(hasConsejosSobreAgriculturaPurchase(attendeeWithPurchases([])), false)

// Multiple purchases including the book
{
  const purchases = [
    purchase('Registro de adultos', 'ticket'),
    purchase('Consejos sobre Agricultura', 'book'),
    purchase('Plan de alimentación completo (11 comidas)', 'meals'),
  ]
  assert.equal(hasAgricultureBookPurchase(purchases), true)
  assert.equal(hasConsejosSobreAgriculturaPurchase(attendeeWithPurchases(purchases)), true)
}

// Multiple purchases without the book
{
  const purchases = [
    purchase('Registro de adultos', 'ticket'),
    purchase('Curso de Agricultura Orgánica', 'course'),
  ]
  assert.equal(hasAgricultureBookPurchase(purchases), false)
}

// List/detail display gating: only purchasers surface as true
{
  const buyer = attendeeWithPurchases([purchase('Libro Consejos sobre Agricultura')])
  const nonBuyer = attendeeWithPurchases([purchase('Habitación compartida')])
  assert.equal(hasConsejosSobreAgriculturaPurchase(buyer), true)
  assert.equal(hasConsejosSobreAgriculturaPurchase(nonBuyer), false)
}

// Quantity add-on mapping: RegFox stores the book as value "1", not checkbox true
{
  const registrant: RegFoxRegistrant = {
    id: 1,
    displayId: '01TESTBOOK',
    status: 'pending offline payment',
    amount: '250.00',
    total: '250.00',
    outstandingAmount: '0',
    currency: 'MXN',
    levelLabel: 'Registro de adultos',
    levelKey: 'adultos',
    fieldData: [
      {
        path: 'seleccioneSusComplementos.libroRecopilatorioDeConsejos',
        label: REGFOX_BOOK_LABEL,
        value: '1',
      },
      {
        path: 'seleccioneSusComplementos.libroRecopilatorioDeConsejos.variant',
        value: '1',
      },
      {
        path: 'seleccioneSusComplementos',
        label: 'Seleccione sus complementos',
        value: '1',
      },
      {
        path: 'address.postalCode',
        label: 'ZIP/Postal Code',
        value: '29750',
      },
    ],
  }

  const mapped = mapRegistrantToAttendee(registrant, 'event-mx')
  const bookPurchase = mapped.purchases.find((p) => p.name === REGFOX_BOOK_LABEL)

  assert.ok(bookPurchase, 'book quantity field should map to a purchase')
  assert.equal(bookPurchase.quantity, 1)
  assert.equal(hasConsejosSobreAgriculturaPurchase(mapped), true)
  assert.equal(
    mapped.purchases.some((p) => p.name === 'Seleccione sus complementos'),
    false,
    'parent complement counter must not become a purchase',
  )
  assert.equal(
    mapped.customFields.some((f) => f.label === REGFOX_BOOK_LABEL),
    false,
    'book purchase must not also appear as a custom field',
  )
}

console.log('Agriculture book purchase tests passed.')
