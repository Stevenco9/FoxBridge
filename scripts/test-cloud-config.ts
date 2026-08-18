import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatCloudPublicConfigDiagnosticLog,
  inspectCloudPublicConfig,
  MISSING_PUBLIC_CLOUD_CONFIG_MESSAGE,
  resolveCloudConnectionConfig,
  resolveCloudPrivilegedCredentials,
  resolveCloudPublicConfig,
  takeResolvedPublicConfig,
  type ResolveCloudPublicConfigInput,
} from '../src/shared/models/CloudConfig.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const emptyInput: ResolveCloudPublicConfigInput = {
  settingsUrl: null,
  settingsPublishableKey: null,
  packagedUrl: '',
  packagedPublishableKey: '',
  envUrl: null,
  envPublishableKey: null,
}

assert.equal(resolveCloudPublicConfig(emptyInput), null)

// Settings override wins over packaged defaults.
assert.deepEqual(
  resolveCloudPublicConfig({
    settingsUrl: 'https://settings.example',
    settingsPublishableKey: 'settings-key',
    packagedUrl: 'https://packaged.example',
    packagedPublishableKey: 'packaged-key',
    envUrl: 'https://env.example',
    envPublishableKey: 'env-key',
  }),
  {
    cloudUrl: 'https://settings.example',
    publishableKey: 'settings-key',
    source: 'settings',
  },
)

// Packaged defaults when settings are empty.
assert.deepEqual(
  resolveCloudPublicConfig({
    settingsUrl: null,
    settingsPublishableKey: null,
    packagedUrl: 'https://packaged.example',
    packagedPublishableKey: 'packaged-key',
    envUrl: 'https://env.example',
    envPublishableKey: 'env-key',
  }),
  {
    cloudUrl: 'https://packaged.example',
    publishableKey: 'packaged-key',
    source: 'packaged_default',
  },
)

// Env fallback for local development.
assert.deepEqual(
  resolveCloudPublicConfig({
    settingsUrl: ' ',
    settingsPublishableKey: null,
    packagedUrl: '',
    packagedPublishableKey: '',
    envUrl: 'https://env.example',
    envPublishableKey: 'env-key',
  }),
  {
    cloudUrl: 'https://env.example',
    publishableKey: 'env-key',
    source: 'env',
  },
)

// Incomplete pairs at every layer do not resolve.
assert.equal(
  resolveCloudPublicConfig({
    settingsUrl: 'https://settings.example',
    settingsPublishableKey: null,
    packagedUrl: 'https://packaged.example',
    packagedPublishableKey: '',
    envUrl: 'https://env.example',
    envPublishableKey: null,
  }),
  null,
)

assert.deepEqual(
  resolveCloudPrivilegedCredentials({
    secretsPrivilegedKey: 'secret-key',
    envPrivilegedKey: 'env-privileged',
  }),
  { privilegedKey: 'secret-key', source: 'secrets' },
)

assert.deepEqual(
  resolveCloudPrivilegedCredentials({
    secretsPrivilegedKey: null,
    envPrivilegedKey: 'env-privileged',
  }),
  { privilegedKey: 'env-privileged', source: 'env' },
)

assert.equal(
  resolveCloudPrivilegedCredentials({
    secretsPrivilegedKey: null,
    envPrivilegedKey: null,
  }),
  null,
)

const publicConfig = resolveCloudPublicConfig({
  settingsUrl: null,
  settingsPublishableKey: null,
  packagedUrl: 'https://packaged.example',
  packagedPublishableKey: 'packaged-key',
  envUrl: null,
  envPublishableKey: null,
})

// Privileged ops require both public + privileged; packaged defaults alone are not enough.
assert.equal(
  resolveCloudConnectionConfig({
    publicConfig,
    privileged: null,
  }),
  null,
)

assert.deepEqual(
  resolveCloudConnectionConfig({
    publicConfig,
    privileged: { privilegedKey: 'local-privileged', source: 'secrets' },
  }),
  {
    cloudUrl: 'https://packaged.example',
    publishableKey: 'packaged-key',
    privilegedKey: 'local-privileged',
    publicSource: 'packaged_default',
    privilegedSource: 'secrets',
  },
)

// --- Sprint 24.4A runtime diagnostic (inspect uses the same trimmed inputs) ---

const packagedOnly = inspectCloudPublicConfig({
  settingsUrl: null,
  settingsPublishableKey: null,
  packagedUrl: 'https://packaged.example',
  packagedPublishableKey: 'packaged-key',
  envUrl: null,
  envPublishableKey: null,
})
assert.equal(packagedOnly.diagnostic.source, 'packaged_default')
assert.equal(packagedOnly.config?.source, 'packaged_default')
assert.equal(packagedOnly.diagnostic.settingsUrlPresent, false)
assert.equal(packagedOnly.diagnostic.settingsKeyPresent, false)
assert.equal(packagedOnly.diagnostic.packagedUrlPresent, true)
assert.equal(packagedOnly.diagnostic.packagedKeyPresent, true)
assert.equal(packagedOnly.diagnostic.envUrlPresent, false)
assert.equal(packagedOnly.diagnostic.envKeyPresent, false)
assert.equal(packagedOnly.diagnostic.packagedPresentButUnresolved, false)

const incompleteSettingsCompletePackaged = inspectCloudPublicConfig({
  settingsUrl: 'https://settings.example',
  settingsPublishableKey: '  ',
  packagedUrl: 'https://packaged.example',
  packagedPublishableKey: 'packaged-key',
  envUrl: 'https://env.example',
  envPublishableKey: 'env-key',
})
assert.equal(incompleteSettingsCompletePackaged.diagnostic.source, 'packaged_default')
assert.equal(incompleteSettingsCompletePackaged.config?.source, 'packaged_default')
assert.equal(incompleteSettingsCompletePackaged.diagnostic.settingsUrlPresent, true)
assert.equal(incompleteSettingsCompletePackaged.diagnostic.settingsKeyPresent, false)
assert.equal(incompleteSettingsCompletePackaged.diagnostic.packagedUrlPresent, true)
assert.equal(incompleteSettingsCompletePackaged.diagnostic.packagedKeyPresent, true)
assert.equal(
  resolveCloudPublicConfig({
    settingsUrl: 'https://settings.example',
    settingsPublishableKey: null,
    packagedUrl: 'https://packaged.example',
    packagedPublishableKey: 'packaged-key',
    envUrl: null,
    envPublishableKey: null,
  })?.source,
  'packaged_default',
)

const completeSettings = inspectCloudPublicConfig({
  settingsUrl: 'https://settings.example',
  settingsPublishableKey: 'settings-key',
  packagedUrl: 'https://packaged.example',
  packagedPublishableKey: 'packaged-key',
  envUrl: 'https://env.example',
  envPublishableKey: 'env-key',
})
assert.equal(completeSettings.diagnostic.source, 'settings')
assert.equal(completeSettings.config?.source, 'settings')

const envOnly = inspectCloudPublicConfig({
  settingsUrl: null,
  settingsPublishableKey: null,
  packagedUrl: '',
  packagedPublishableKey: '',
  envUrl: 'https://env.example',
  envPublishableKey: 'env-key',
})
assert.equal(envOnly.diagnostic.source, 'env')
assert.equal(envOnly.config?.source, 'env')

const allIncomplete = inspectCloudPublicConfig({
  settingsUrl: 'https://settings.example',
  settingsPublishableKey: null,
  packagedUrl: 'https://packaged.example',
  packagedPublishableKey: '',
  envUrl: 'https://env.example',
  envPublishableKey: '   ',
})
assert.equal(allIncomplete.config, null)
assert.equal(allIncomplete.diagnostic.source, 'none')
assert.equal(allIncomplete.diagnostic.packagedUrlPresent, true)
assert.equal(allIncomplete.diagnostic.packagedKeyPresent, false)
assert.equal(allIncomplete.diagnostic.packagedPresentButUnresolved, false)

assert.doesNotThrow(() => takeResolvedPublicConfig(packagedOnly))
assert.deepEqual(takeResolvedPublicConfig(packagedOnly), {
  cloudUrl: 'https://packaged.example',
  publishableKey: 'packaged-key',
})
assert.equal(takeResolvedPublicConfig(packagedOnly).cloudUrl.endsWith('/'), false)

assert.throws(
  () => takeResolvedPublicConfig(allIncomplete),
  (error: unknown) =>
    error instanceof Error && error.message === MISSING_PUBLIC_CLOUD_CONFIG_MESSAGE,
)

const rawUrl = 'https://secret-project-host.supabase.co/rest/v1'
const rawPublishable = 'sb_publishable_DoNotLogThisClientKeyValue'
const rawSecret = 'sb_secret_DoNotLogThisPrivilegedKeyValue'
const rawJwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature'
const rawDesk = 'desk-token-should-never-appear'
const rawRegFox = 'regfox-api-key-should-never-appear'

const secretInspection = inspectCloudPublicConfig({
  settingsUrl: null,
  settingsPublishableKey: null,
  packagedUrl: rawUrl,
  packagedPublishableKey: rawPublishable,
  envUrl: null,
  envPublishableKey: rawSecret,
})
const sneakyDiagnostic = {
  ...secretInspection.diagnostic,
  cloudUrl: rawUrl,
  publishableKey: rawPublishable,
  privilegedKey: rawSecret,
  deskToken: rawDesk,
  regfoxApiKey: rawRegFox,
  serviceRoleKey: rawJwt,
}
const logLine = formatCloudPublicConfigDiagnosticLog(sneakyDiagnostic)
assert.equal(logLine.startsWith('[cloud-config] resolve {'), true)
assert.equal(logLine.includes('"source":"packaged_default"'), true)
assert.equal(logLine.includes('"packagedUrlPresent":true'), true)
assert.equal(logLine.includes('"packagedKeyPresent":true'), true)
assert.equal(logLine.includes(rawUrl), false)
assert.equal(logLine.includes(rawPublishable), false)
assert.equal(logLine.includes(rawSecret), false)
assert.equal(logLine.includes('sb_secret_'), false)
assert.equal(logLine.includes(rawJwt), false)
assert.equal(logLine.includes('service_role'), false)
assert.equal(logLine.includes(rawDesk), false)
assert.equal(logLine.includes(rawRegFox), false)
assert.equal(logLine.includes('secret-project-host'), false)
assert.equal(/https:\/\//.test(logLine), false)

const desktopApi = readFileSync(join(root, 'electron/cloud/desktopCloudApi.ts'), 'utf8')
const requireFn = desktopApi.slice(
  desktopApi.indexOf('function requirePublicConfig()'),
  desktopApi.indexOf('function requireDeskCredential()'),
)
assert.ok(requireFn.includes('inspectFoxBridgeCloudPublicConfig()'))
assert.ok(requireFn.includes('logSafeCloudPublicConfigDiagnostic(inspection.diagnostic)'))
assert.ok(requireFn.includes('takeResolvedPublicConfig(inspection)'))
assert.equal(requireFn.includes('console.warn(inspection'), false)
assert.equal(requireFn.includes('inspection.config'), false)

const probe = readFileSync(join(root, 'electron/cloud/cloudConfigProbe.ts'), 'utf8')
assert.ok(probe.includes('formatCloudPublicConfigDiagnosticLog'))
assert.ok(probe.includes('console.warn(line)'))
assert.ok(probe.includes('cloud-config-resolve.log'))
assert.equal(probe.includes('diagnostic.cloudUrl'), false)
assert.equal(probe.includes('diagnostic.publishableKey'), false)

console.log('test-cloud-config: ok')
