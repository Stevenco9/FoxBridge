/**
 * Sprint 24.4A — packaged public Cloud configuration guards.
 */

import assert from 'node:assert/strict'
import {
  bundleContainsLiteral,
  findCompiledPrivilegedCloudKey,
  resolvePackagedCloudEnv,
  validateHttpsPublicUrl,
  validatePackagedCloudEnv,
  validatePublishableKey,
  verifyCompiledPackagedCloudBundle,
} from './packagedCloudConfig.ts'

function serviceRoleJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ role: 'service_role', iss: 'supabase' })).toString(
    'base64url',
  )
  return `${header}.${payload}.signature`
}

function anonJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ role: 'anon', iss: 'supabase' })).toString(
    'base64url',
  )
  return `${header}.${payload}.signature`
}

const validEnv = {
  FOXBRIDGE_CLOUD_URL: 'https://okprojhostxx.supabase.co',
  FOXBRIDGE_CLOUD_PUBLISHABLE_KEY: 'sb_publishable_TestKeyForUnitTestsOnly12',
  FOXBRIDGE_SCANNER_URL: 'https://fox-bridge.vercel.app',
}

assert.deepEqual(
  resolvePackagedCloudEnv(
    {},
    [
      'FOXBRIDGE_CLOUD_URL=https://from-file-host.supabase.co',
      'FOXBRIDGE_CLOUD_PUBLISHABLE_KEY=sb_publishable_FromFileKeyValue1234',
      'FOXBRIDGE_SCANNER_URL=https://from-file-scanner.vercel.app',
    ].join('\n'),
  ),
  {
    FOXBRIDGE_CLOUD_URL: 'https://from-file-host.supabase.co',
    FOXBRIDGE_CLOUD_PUBLISHABLE_KEY: 'sb_publishable_FromFileKeyValue1234',
    FOXBRIDGE_SCANNER_URL: 'https://from-file-scanner.vercel.app',
  },
)
assert.equal(
  resolvePackagedCloudEnv(
    { FOXBRIDGE_CLOUD_URL: '' },
    'FOXBRIDGE_CLOUD_URL=https://from-file-host.supabase.co',
  ).FOXBRIDGE_CLOUD_URL,
  '',
  'empty CI variable must not fall back to a local .env value',
)

assert.equal(validateHttpsPublicUrl('https://okprojhostxx.supabase.co', 'FOXBRIDGE_CLOUD_URL').ok, true)
assert.equal(validateHttpsPublicUrl('', 'FOXBRIDGE_CLOUD_URL').ok, false)
assert.equal(validateHttpsPublicUrl('http://okprojhostxx.supabase.co', 'FOXBRIDGE_CLOUD_URL').ok, false)
assert.equal(
  validateHttpsPublicUrl('https://xyzcompany.supabase.co', 'FOXBRIDGE_CLOUD_URL').ok,
  false,
)
assert.equal(
  validateHttpsPublicUrl('https://your-project.supabase.co', 'FOXBRIDGE_CLOUD_URL').ok,
  false,
)
assert.equal(
  validateHttpsPublicUrl('https://example.supabase.co', 'FOXBRIDGE_CLOUD_URL').ok,
  false,
)
assert.ok(
  validateHttpsPublicUrl('', 'FOXBRIDGE_CLOUD_URL').message.includes('FOXBRIDGE_CLOUD_URL'),
)

assert.equal(
  validatePublishableKey('sb_publishable_TestKeyForUnitTestsOnly12', 'FOXBRIDGE_CLOUD_PUBLISHABLE_KEY')
    .ok,
  true,
)
assert.equal(validatePublishableKey(anonJwt(), 'FOXBRIDGE_CLOUD_PUBLISHABLE_KEY').ok, true)
assert.equal(validatePublishableKey('', 'FOXBRIDGE_CLOUD_PUBLISHABLE_KEY').ok, false)
assert.equal(validatePublishableKey('short', 'FOXBRIDGE_CLOUD_PUBLISHABLE_KEY').ok, false)
assert.equal(
  validatePublishableKey(
    'sb_secret_thislookslikeaprivilegedkey',
    'FOXBRIDGE_CLOUD_PUBLISHABLE_KEY',
  ).ok,
  false,
)
assert.equal(validatePublishableKey(serviceRoleJwt(), 'FOXBRIDGE_CLOUD_PUBLISHABLE_KEY').ok, false)
assert.equal(
  validatePublishableKey('YOUR_ANON_OR_PUBLISHABLE_KEY_VALUE', 'FOXBRIDGE_CLOUD_PUBLISHABLE_KEY').ok,
  false,
)

const missing = validatePackagedCloudEnv({})
assert.equal(missing.ok, false)
assert.ok(missing.lines.some((line) => line.includes('FOXBRIDGE_CLOUD_URL')))
assert.ok(missing.lines.some((line) => line.includes('FOXBRIDGE_CLOUD_PUBLISHABLE_KEY')))
assert.ok(missing.lines.some((line) => line.includes('FOXBRIDGE_SCANNER_URL')))
assert.equal(
  missing.lines.join('\n').includes('sb_publishable_'),
  false,
  'guard output must not print a publishable key',
)

const valid = validatePackagedCloudEnv(validEnv)
assert.equal(valid.ok, true)
assert.deepEqual(valid.lines, [
  'PACKAGED CLOUD CONFIG: URL OK',
  'PACKAGED CLOUD CONFIG: PUBLISHABLE KEY OK',
  'PACKAGED CLOUD CONFIG: SCANNER URL OK',
])
assert.equal(valid.lines.join('\n').includes(validEnv.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY), false)
assert.equal(valid.lines.join('\n').includes(validEnv.FOXBRIDGE_CLOUD_URL), false)

const compiled = [
  `const cloudUrl="${validEnv.FOXBRIDGE_CLOUD_URL}".trim()||""`,
  `const publishableKey="${validEnv.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY}".trim()||""`,
  `const scannerUrl="${validEnv.FOXBRIDGE_SCANNER_URL}".trim()||""`,
].join('\n')

assert.equal(bundleContainsLiteral(compiled, validEnv.FOXBRIDGE_CLOUD_URL), true)
assert.equal(findCompiledPrivilegedCloudKey(compiled), null)

const bundleOk = verifyCompiledPackagedCloudBundle(compiled, validEnv)
assert.equal(bundleOk.ok, true)
assert.ok(bundleOk.lines.includes('PACKAGED CLOUD BUNDLE: URL OK'))
assert.ok(bundleOk.lines.includes('PACKAGED CLOUD BUNDLE: PUBLISHABLE KEY OK'))
assert.ok(bundleOk.lines.includes('PACKAGED CLOUD BUNDLE: SCANNER URL OK'))
assert.ok(bundleOk.lines.includes('PACKAGED CLOUD BUNDLE: NO PRIVILEGED KEYS'))
assert.equal(bundleOk.lines.join('\n').includes(validEnv.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY), false)

const emptyCompiled = 'const cloudUrl="".trim()||"",publishableKey="".trim()||""'
const bundleMissing = verifyCompiledPackagedCloudBundle(emptyCompiled, validEnv)
assert.equal(bundleMissing.ok, false)
assert.ok(bundleMissing.lines.some((line) => line.includes('FOXBRIDGE_CLOUD_URL')))
assert.ok(bundleMissing.lines.some((line) => line.includes('FOXBRIDGE_CLOUD_PUBLISHABLE_KEY')))
assert.ok(bundleMissing.lines.some((line) => line.includes('FOXBRIDGE_SCANNER_URL')))
assert.equal(bundleMissing.lines.join('\n').includes(validEnv.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY), false)

const secretCompiled = `${compiled}\nconst leaked="sb_secret_thislookslikeaprivilegedkey"`
const bundleSecret = verifyCompiledPackagedCloudBundle(secretCompiled, validEnv)
assert.equal(bundleSecret.ok, false)
assert.ok(bundleSecret.lines.some((line) => line.includes('PRIVILEGED KEY DETECTED')))
assert.equal(bundleSecret.lines.join('\n').includes('sb_secret_thislookslikeaprivilegedkey'), false)

console.log('test-packaged-cloud-config: ok')
