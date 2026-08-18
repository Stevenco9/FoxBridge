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
assert.ok(notarizeRetry.includes('xcrun notarytool'))
assert.ok(notarizeRetry.includes('submit'))
assert.ok(notarizeRetry.includes('info'))
assert.ok(notarizeRetry.includes('notarytool log') || notarizeRetry.includes('log "$submission_id"') || notarizeRetry.includes("log \"$submission_id\""))
assert.ok(notarizeRetry.includes('--output-format json'))
assert.ok(!notarizeRetry.includes('--wait'))
assert.ok(!notarizeRetry.includes('NOTARIZE_MAX_ATTEMPTS'))
assert.ok(notarizeRetry.includes('NOTARIZE_POLL_INTERVAL_SECONDS:-60'))
assert.ok(notarizeRetry.includes('NOTARIZE_OVERALL_TIMEOUT_SECONDS:-10800'))
assert.ok(notarizeRetry.includes('NOTARIZATION SUBMITTED:'))
assert.ok(notarizeRetry.includes('NOTARIZATION STATUS:'))
assert.ok(notarizeRetry.includes('NOTARIZATION POLL RETRY'))
assert.ok(notarizeRetry.includes('NOTARIZATION ACCEPTED'))
assert.ok(notarizeRetry.includes('SIGNING SUCCESS'))
assert.ok(notarizeRetry.includes('STAPLE VERIFIED'))
assert.ok(notarizeRetry.includes('NSURLErrorDomain'))
assert.ok(notarizeRetry.includes('json_field'))
assert.ok(notarizeRetry.includes('xcrun stapler staple'))
assert.ok(!notarizeRetry.includes('altool'))
assert.ok(
  notarizeRetry.includes('no resubmit') || notarizeRetry.includes('not resubmitting') || notarizeRetry.includes('was not resubmitted'),
  'must poll an existing submission instead of resubmitting on timeout',
)
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
assert.ok(workflow.includes('does not match package.json version'))
assert.ok(workflow.includes('npx electron-builder --mac --publish never'))
assert.ok(!workflow.includes('--publish ${{ steps.publish.outputs.mode }}'))
assert.ok(!workflow.includes('mode=always'))
assert.ok(workflow.includes('scripts/publish-github-mac-release.sh'))
assert.ok(workflow.includes('scripts/verify-github-mac-release.sh') || read('scripts/publish-github-mac-release.sh').includes('verify-github-mac-release.sh'))
assert.ok(workflow.includes('Publish complete Mac asset set to GitHub Release'))
assert.ok(workflow.includes('-c.forceCodeSigning=true'))
assert.ok(workflow.includes('scripts/notarize-mac.cjs'))
assert.ok(workflow.includes('scripts/verify-mac-release.sh'))
assert.ok(workflow.includes('latest-mac.yml'))
assert.ok(workflow.includes('FoxBridge-${{ steps.version.outputs.version }}-mac-universal.dmg.blockmap'))
assert.ok(workflow.includes('FoxBridge-${{ steps.version.outputs.version }}-mac-universal.zip.blockmap'))
assert.ok(!workflow.includes('altool'))
assert.ok(workflow.includes('notary') || workflow.includes('APPLE_APP_SPECIFIC_PASSWORD'))

{
  const validateIdx = workflow.indexOf('npm run validate:packaged-cloud-env')
  const buildIdx = workflow.indexOf('run: npm run build')
  const verifyIdx = workflow.indexOf('npm run verify:packaged-cloud-bundle')
  const builderIdx = workflow.indexOf('npx electron-builder --mac --publish never')
  assert.ok(validateIdx >= 0, 'Mac workflow must validate public Cloud env before build')
  assert.ok(buildIdx >= 0)
  assert.ok(verifyIdx >= 0, 'Mac workflow must verify compiled Cloud defaults')
  assert.ok(builderIdx >= 0)
  assert.ok(validateIdx < buildIdx, 'Cloud env validation must run before npm run build')
  assert.ok(buildIdx < verifyIdx, 'compiled Cloud bundle guard must run after npm run build')
  assert.ok(verifyIdx < builderIdx, 'compiled Cloud bundle guard must run before electron-builder')
}

assert.ok(workflow.includes('vars.FOXBRIDGE_CLOUD_URL'))
assert.ok(workflow.includes('vars.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY'))
assert.ok(workflow.includes('vars.FOXBRIDGE_SCANNER_URL'))
assert.ok(workflow.includes('test:packaged-cloud-config'))

function workflowStep(source: string, name: string): string {
  const start = source.indexOf(`- name: ${name}`)
  assert.ok(start >= 0, `missing workflow step: ${name}`)
  const next = source.indexOf('\n      - name:', start + 1)
  return next >= 0 ? source.slice(start, next) : source.slice(start)
}

const validateStep = workflowStep(workflow, 'Validate packaged FoxBridge Cloud public configuration')
const buildStep = workflowStep(workflow, 'Run TypeScript check and app build')
const verifyStep = workflowStep(workflow, 'Verify compiled packaged Cloud defaults')
const signStep = workflowStep(workflow, 'Build, sign, and notarize universal Mac')
const publishStep = workflowStep(workflow, 'Publish complete Mac asset set to GitHub Release')

for (const step of [validateStep, buildStep, verifyStep]) {
  assert.ok(step.includes('vars.FOXBRIDGE_CLOUD_URL'))
  assert.ok(step.includes('vars.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY'))
  assert.ok(step.includes('vars.FOXBRIDGE_SCANNER_URL'))
  assert.ok(!step.includes('SUPABASE_SERVICE_ROLE_KEY'))
  assert.ok(!step.includes('SERVICE_ROLE'))
  assert.ok(!step.includes('REGFOX_API_KEY'))
  assert.ok(!step.includes('secrets.GITHUB_TOKEN'))
  assert.ok(!step.includes('MAC_CSC_LINK'))
  assert.ok(!step.includes('APPLE_APP_SPECIFIC_PASSWORD'))
}

assert.ok(signStep.includes('secrets.MAC_CSC_LINK'))
assert.ok(signStep.includes('secrets.APPLE_APP_SPECIFIC_PASSWORD'))
assert.ok(!signStep.includes('FOXBRIDGE_CLOUD_PUBLISHABLE_KEY'), 'signing step must not receive Cloud packaging vars')
assert.ok(publishStep.includes("github.event_name == 'push'"))
assert.ok(publishStep.includes('scripts/publish-github-mac-release.sh'))
assert.ok(!workflow.includes('electron-builder --mac --publish always'))

const validateScript = read('scripts/validate-packaged-cloud-env.ts')
assert.ok(validateScript.includes('validatePackagedCloudEnv'))
assert.ok(!validateScript.includes('console.log(process.env'))
const verifyScript = read('scripts/verify-packaged-cloud-bundle.ts')
assert.ok(verifyScript.includes('dist-electron'))
assert.ok(verifyScript.includes('verifyCompiledPackagedCloudBundle'))
assert.ok(existsSync(join(root, 'scripts/packagedCloudConfig.ts')))
assert.ok(existsSync(join(root, 'scripts/test-packaged-cloud-config.ts')))

const requiredAssets = read('scripts/mac-release-assets.sh')
assert.ok(requiredAssets.includes('FoxBridge-${version}-mac-universal.dmg'))
assert.ok(requiredAssets.includes('FoxBridge-${version}-mac-universal.dmg.blockmap'))
assert.ok(requiredAssets.includes('FoxBridge-${version}-mac-universal.zip'))
assert.ok(requiredAssets.includes('FoxBridge-${version}-mac-universal.zip.blockmap'))
assert.ok(requiredAssets.includes('latest-mac.yml'))

const publishGithub = read('scripts/publish-github-mac-release.sh')
assert.ok(publishGithub.includes('verify-local-mac-release-assets.sh'))
assert.ok(publishGithub.includes('gh release upload'))
assert.ok(publishGithub.includes('gh release create'))
assert.ok(publishGithub.includes('verify-github-mac-release.sh'))
assert.ok(publishGithub.includes('--clobber'))
assert.ok(!publishGithub.includes('npx electron-builder'))
assert.ok(!publishGithub.includes('--publish always'))

const verifyGithub = read('scripts/verify-github-mac-release.sh')
assert.ok(verifyGithub.includes('gh release view'))
assert.ok(verifyGithub.includes('mac_release_asset_names'))
assert.ok(verifyGithub.includes('incomplete'))

const verifyLocalAssets = read('scripts/verify-local-mac-release-assets.sh')
assert.ok(verifyLocalAssets.includes('openssl dgst -sha512'))
assert.ok(verifyLocalAssets.includes('path: FoxBridge-'))
assert.ok(verifyLocalAssets.includes('releaseDate'))

const verifyMac = read('scripts/verify-mac-release.sh')
assert.ok(verifyMac.includes('dmg.blockmap'))
assert.ok(verifyMac.includes('zip.blockmap'))
assert.ok(verifyMac.includes('verify-local-mac-release-assets.sh'))
assert.ok(verifyMac.includes('path: FoxBridge-${VERSION}-mac-universal.zip'))

const windowsWorkflow = read('.github/workflows/build-windows.yml')
assert.ok(windowsWorkflow.includes('npm run dist:win'))
assert.ok(windowsWorkflow.includes('artifact-only') || windowsWorkflow.includes('--publish never'))
assert.ok(windowsWorkflow.includes('vars.FOXBRIDGE_CLOUD_URL'))
assert.ok(windowsWorkflow.includes('vars.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY'))
assert.ok(windowsWorkflow.includes('vars.FOXBRIDGE_SCANNER_URL'))
assert.ok(windowsWorkflow.includes('npm run validate:packaged-cloud-env'))
assert.ok(windowsWorkflow.includes('npm run verify:packaged-cloud-bundle'))
{
  const winValidateIdx = windowsWorkflow.indexOf('npm run validate:packaged-cloud-env')
  const winBuildIdx = windowsWorkflow.indexOf('run: npm run build')
  const winVerifyIdx = windowsWorkflow.indexOf('npm run verify:packaged-cloud-bundle')
  const winDistIdx = windowsWorkflow.indexOf('npm run dist:win')
  assert.ok(winValidateIdx >= 0 && winValidateIdx < winBuildIdx)
  assert.ok(winVerifyIdx >= 0 && winBuildIdx < winVerifyIdx && winVerifyIdx < winDistIdx)
  const distStepStart = windowsWorkflow.indexOf('- name: Build Windows NSIS installer')
  const distStepEnd = windowsWorkflow.indexOf('- name: Verify compiled packaged Cloud defaults after Windows rebuild')
  const distStep = windowsWorkflow.slice(distStepStart, distStepEnd)
  assert.ok(distStep.includes('vars.FOXBRIDGE_CLOUD_URL'))
  assert.ok(distStep.includes('vars.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY'))
  assert.ok(distStep.includes('vars.FOXBRIDGE_SCANNER_URL'))
  assert.ok(!distStep.includes('SUPABASE_SERVICE_ROLE_KEY'))
  assert.ok(!windowsWorkflow.includes('SUPABASE_SERVICE_ROLE_KEY'))
}

const pkgText = read('package.json')
for (const forbidden of ['MAC_CSC_LINK', 'MAC_CSC_KEY_PASSWORD', 'APPLE_APP_SPECIFIC_PASSWORD', 'BEGIN CERTIFICATE']) {
  assert.ok(!pkgText.includes(forbidden), `package.json must not contain ${forbidden}`)
}

const gitignore = read('.gitignore')
assert.ok(gitignore.includes('*.p12'))
assert.ok(gitignore.includes('*.p8'))
assert.ok(gitignore.includes('release/'))

console.log('test-mac-release-config: ok')
