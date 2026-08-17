/**
 * Sprint 24.1 — Mac release pipeline configuration checks.
 *
 * Asserts electron-builder + workflow wiring. Does not require Apple
 * credentials and does not produce installers.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

const pkg = JSON.parse(read('package.json')) as {
  name: string
  version: string
  scripts: Record<string, string>
  build: {
    appId: string
    productName: string
    artifactName: string
    afterSign?: string
    mac: {
      target: Array<{ target: string; arch: string[] }>
      identity?: string | null
      hardenedRuntime?: boolean
      entitlements?: string
      entitlementsInherit?: string
      notarize?: boolean
    }
    dmg?: { writeUpdateInfo?: boolean }
    publish?: Array<{
      provider?: string
      owner?: string
      repo?: string
      private?: boolean
    }>
  }
}

assert.equal(pkg.name, 'foxbridge', 'Electron userData folder is derived from package name')
assert.equal(pkg.build.appId, 'com.foxbridge.desktop')
assert.equal(pkg.build.productName, 'FoxBridge')
assert.equal(pkg.build.artifactName, '${productName}-${version}-${os}-${arch}.${ext}')
assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'package.json version is canonical semver')

const macTargets = pkg.build.mac.target
assert.ok(macTargets.some((t) => t.target === 'dmg' && t.arch.length === 1 && t.arch[0] === 'universal'))
assert.ok(macTargets.some((t) => t.target === 'zip' && t.arch.length === 1 && t.arch[0] === 'universal'))
for (const target of macTargets) {
  assert.deepEqual(target.arch, ['universal'], `${target.target} must be universal-only`)
}

assert.notEqual(pkg.build.mac.identity, null, 'production identity must not be explicitly null')
assert.equal(pkg.build.mac.hardenedRuntime, true)
assert.equal(pkg.build.mac.notarize, false, 'electron-builder built-in notarize is a single attempt; afterSign owns retries')
assert.equal(pkg.build.afterSign, 'scripts/notarize-mac.cjs')
assert.equal(pkg.build.mac.entitlements, 'build/entitlements.mac.plist')
assert.equal(pkg.build.mac.entitlementsInherit, 'build/entitlements.mac.inherit.plist')
assert.equal(pkg.build.dmg?.writeUpdateInfo, true)

const publish = pkg.build.publish ?? []
assert.equal(publish.length, 1)
assert.equal(publish[0]?.provider, 'github')
assert.equal(publish[0]?.owner, 'Stevenco9')
assert.equal(publish[0]?.repo, 'FoxBridge')
assert.equal(publish[0]?.private, false)

assert.equal(existsSync(join(root, 'build/entitlements.mac.plist')), true)
assert.equal(existsSync(join(root, 'build/entitlements.mac.inherit.plist')), true)

for (const relative of ['build/entitlements.mac.plist', 'build/entitlements.mac.inherit.plist']) {
  const plist = read(relative)
  assert.ok(plist.includes('com.apple.security.cs.allow-jit'))
  assert.ok(plist.includes('com.apple.security.cs.allow-unsigned-executable-memory'))
  assert.ok(plist.includes('com.apple.security.cs.disable-library-validation'))
  assert.ok(!plist.includes('com.apple.security.app-sandbox'), `${relative} must not enable App Sandbox`)
}

assert.ok(pkg.scripts['dist:mac']?.includes('dist-mac-unsigned.sh'))
assert.ok(pkg.scripts['dist:mac:release']?.includes('dist-mac-release.sh'))
assert.ok(pkg.scripts['dist:win']?.includes('--publish never'))
assert.ok(pkg.scripts['pack:mac']?.includes('CSC_IDENTITY_AUTO_DISCOVERY=false'))
assert.ok(pkg.scripts['pack:mac']?.includes('--publish never'))

const unsignedScript = read('scripts/dist-mac-unsigned.sh')
assert.ok(unsignedScript.includes('CSC_IDENTITY_AUTO_DISCOVERY=false'))
assert.ok(unsignedScript.includes('--publish never'))
assert.ok(unsignedScript.includes('-c.mac.notarize=false'))

const releaseScript = read('scripts/dist-mac-release.sh')
assert.ok(releaseScript.includes('-c.forceCodeSigning=true'))
assert.ok(releaseScript.includes('--publish never'))
assert.ok(releaseScript.includes('CSC_LINK'))

const afterSign = read('scripts/notarize-mac.cjs')
assert.ok(afterSign.includes('notarize-mac-retry.sh'))
assert.ok(afterSign.includes('CSC_IDENTITY_AUTO_DISCOVERY'))
assert.ok(!afterSign.includes('altool'))

const notarizeRetry = read('scripts/notarize-mac-retry.sh')
assert.ok(notarizeRetry.includes('xcrun notarytool submit'))
assert.ok(notarizeRetry.includes('--wait'))
assert.ok(notarizeRetry.includes('NOTARIZE_MAX_ATTEMPTS:-3'))
assert.ok(notarizeRetry.includes('BACKOFF_SECONDS=(60 180)'))
assert.ok(notarizeRetry.includes('NOTARIZATION SUBMITTED'))
assert.ok(notarizeRetry.includes('NOTARIZATION RETRY'))
assert.ok(notarizeRetry.includes('NOTARIZATION ACCEPTED'))
assert.ok(notarizeRetry.includes('SIGNING SUCCESS'))
assert.ok(notarizeRetry.includes('STAPLE VERIFIED'))
assert.ok(notarizeRetry.includes('NSURLErrorDomain'))
assert.ok(notarizeRetry.includes('is_deterministic_failure'))
assert.ok(notarizeRetry.includes('status:[[:space:]]*Invalid'))
assert.ok(notarizeRetry.includes('xcrun stapler staple'))
assert.ok(!notarizeRetry.includes('altool'))
assert.ok(existsSync(join(root, 'scripts/notarize-mac-retry.sh')))
assert.ok(existsSync(join(root, 'scripts/notarize-mac.cjs')))

const workflow = read('.github/workflows/release-mac.yml')
assert.ok(workflow.includes('workflow_dispatch'))
assert.ok(workflow.includes("tags:"))
assert.ok(workflow.includes('macos-latest'))
assert.ok(workflow.includes('actions/setup-python@v5'))
assert.ok(workflow.includes("python-version: '3.11'"))
assert.ok(workflow.includes('PYTHON_311="$(which python)"'))
assert.ok(workflow.includes('-m pip install --upgrade setuptools'))
assert.ok(workflow.includes('import distutils'))
assert.ok(workflow.includes('NODE_GYP_FORCE_PYTHON='))
assert.ok(workflow.includes('npm_config_python'))
assert.ok(workflow.includes('echo "NODE_GYP_FORCE_PYTHON=$NODE_GYP_FORCE_PYTHON"'))
{
  const pythonIdx = workflow.indexOf('actions/setup-python@v5')
  const setuptoolsIdx = workflow.indexOf('-m pip install --upgrade setuptools')
  const distutilsIdx = workflow.indexOf('import distutils')
  const forcePythonIdx = workflow.indexOf('NODE_GYP_FORCE_PYTHON=')
  const diagnosticIdx = workflow.indexOf('echo "NODE_GYP_FORCE_PYTHON=$NODE_GYP_FORCE_PYTHON"')
  const npmCiIdx = workflow.indexOf('run: npm ci')
  assert.ok(pythonIdx >= 0 && pythonIdx < npmCiIdx, 'Python 3.11 must be set up before npm ci')
  assert.ok(setuptoolsIdx >= 0 && setuptoolsIdx < npmCiIdx, 'setuptools must be installed before npm ci')
  assert.ok(distutilsIdx >= 0 && distutilsIdx < npmCiIdx, 'distutils import must be verified before npm ci')
  assert.ok(forcePythonIdx >= 0 && forcePythonIdx < npmCiIdx, 'NODE_GYP_FORCE_PYTHON must be exported before npm ci')
  assert.ok(diagnosticIdx >= 0 && diagnosticIdx < npmCiIdx, 'Python diagnostic must run before npm ci')
}
assert.ok(workflow.includes('secrets.MAC_CSC_LINK'))
assert.ok(workflow.includes('secrets.MAC_CSC_KEY_PASSWORD'))
assert.ok(workflow.includes('secrets.APPLE_ID'))
assert.ok(workflow.includes('secrets.APPLE_APP_SPECIFIC_PASSWORD'))
assert.ok(workflow.includes('secrets.APPLE_TEAM_ID'))
assert.ok(workflow.includes('mode=never'))
assert.ok(workflow.includes('mode=always'))
assert.ok(workflow.includes('does not match package.json version'))
assert.ok(workflow.includes('npx electron-builder --mac --publish'))
assert.ok(workflow.includes('-c.forceCodeSigning=true'))
assert.ok(workflow.includes('scripts/notarize-mac.cjs'))
assert.ok(workflow.includes('scripts/verify-mac-release.sh'))
assert.ok(workflow.includes('latest-mac.yml'))
assert.ok(!workflow.includes('altool'))
assert.ok(workflow.includes('notary') || workflow.includes('APPLE_APP_SPECIFIC_PASSWORD'))

const windowsWorkflow = read('.github/workflows/build-windows.yml')
assert.ok(windowsWorkflow.includes('npm run dist:win'))
assert.ok(windowsWorkflow.includes('artifact-only') || windowsWorkflow.includes('--publish never'))

const pkgText = read('package.json')
for (const forbidden of ['MAC_CSC_LINK', 'MAC_CSC_KEY_PASSWORD', 'APPLE_APP_SPECIFIC_PASSWORD', 'BEGIN CERTIFICATE']) {
  assert.ok(!pkgText.includes(forbidden), `package.json must not contain ${forbidden}`)
}

const gitignore = read('.gitignore')
assert.ok(gitignore.includes('*.p12'))
assert.ok(gitignore.includes('*.p8'))
assert.ok(gitignore.includes('release/'))

console.log('test-mac-release-config: ok')
