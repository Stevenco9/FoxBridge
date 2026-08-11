import assert from 'node:assert/strict'
import {
  buildScannerPairingUrl,
  pairingBlockMessage,
  pairingPublishWarningMessage,
} from '../src/shared/pairing/pairingMessages.ts'

assert.equal(
  buildScannerPairingUrl('https://scanner.example.com/', 'abc_TOKEN-1'),
  'https://scanner.example.com/pair?token=abc_TOKEN-1',
)

assert.equal(
  buildScannerPairingUrl('https://scanner.example.com', 'a+b/c'),
  'https://scanner.example.com/pair?token=a%2Bb%2Fc',
)

// QR must never be a bare Cloud URL or embed conference / desk secrets.
const url = buildScannerPairingUrl('https://scanner.example.com', 'rawTokenOnly')
assert.ok(url.startsWith('https://scanner.example.com/pair?token='))
assert.equal(url.includes('service_role'), false)
assert.equal(url.includes('anon'), false)
assert.equal(url.includes('conference'), false)
assert.equal(url.includes('desk'), false)

assert.ok(pairingBlockMessage('not_enrolled').includes('Desktop registration'))
assert.ok(pairingBlockMessage('scanner_url_missing').includes('setup person'))
assert.ok(pairingBlockMessage('no_attendees').includes('attendees'))
assert.ok(pairingPublishWarningMessage().includes('latest attendee'))

console.log('test-pairing: ok')
