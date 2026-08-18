/**
 * Post-build guard: compiled dist-electron must contain the validated public
 * Cloud defaults. Runs before electron-builder signing/notarization.
 * Never prints the publishable key.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyCompiledPackagedCloudBundle, resolvePackagedCloudEnv } from './packagedCloudConfig.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const distElectronDir = join(root, 'dist-electron')
const envPath = join(root, '.env')

function collectJsFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return []
  }
  const collected: string[] = []
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      collected.push(...collectJsFiles(fullPath))
      continue
    }
    if (name.endsWith('.js') || name.endsWith('.mjs') || name.endsWith('.cjs')) {
      collected.push(fullPath)
    }
  }
  return collected
}

if (!existsSync(distElectronDir)) {
  console.error('PACKAGED CLOUD BUNDLE: MISSING — dist-electron was not produced by npm run build.')
  process.exit(1)
}

const jsFiles = collectJsFiles(distElectronDir)
if (jsFiles.length === 0) {
  console.error('PACKAGED CLOUD BUNDLE: MISSING — dist-electron contains no compiled JavaScript.')
  process.exit(1)
}

const bundleText = jsFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n')
const dotEnvContents = existsSync(envPath) ? readFileSync(envPath, 'utf8') : undefined
const env = resolvePackagedCloudEnv(process.env, dotEnvContents)
const result = verifyCompiledPackagedCloudBundle(bundleText, env)

for (const line of result.lines) {
  console.log(line)
}

if (!result.ok) {
  console.error(
    'Compiled Electron main bundle is missing required public FoxBridge Cloud defaults. Release stopped before signing.',
  )
  process.exit(1)
}
