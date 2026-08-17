'use strict'

const { spawnSync } = require('node:child_process')
const path = require('node:path')

/**
 * electron-builder afterSign hook.
 * Signing already succeeded. Submit the .app to Apple notarytool once, poll
 * that submission id until Accepted/Invalid, then staple before DMG/ZIP.
 */
module.exports = async function notarizeMac(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') {
    console.log('Skipping notarization (unsigned local smoke).')
    return
  }

  if (
    !process.env.APPLE_ID ||
    !process.env.APPLE_APP_SPECIFIC_PASSWORD ||
    !process.env.APPLE_TEAM_ID
  ) {
    console.log('Skipping notarization (Apple credentials not set).')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  const script = path.join(__dirname, 'notarize-mac-retry.sh')

  const result = spawnSync('bash', [script, appPath], {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`Notarization failed with exit code ${result.status}`)
  }
}
