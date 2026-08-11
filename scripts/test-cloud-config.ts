import assert from 'node:assert/strict'
import {
  resolveCloudConnectionConfig,
  resolveCloudPrivilegedCredentials,
  resolveCloudPublicConfig,
} from '../src/shared/models/CloudConfig.ts'

assert.equal(
  resolveCloudPublicConfig({
    settingsUrl: null,
    settingsPublishableKey: null,
    packagedUrl: '',
    packagedPublishableKey: '',
    envUrl: null,
    envPublishableKey: null,
  }),
  null,
)

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

// Incomplete pairs do not resolve.
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

console.log('test-cloud-config: ok')
