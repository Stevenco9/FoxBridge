/**
 * Pre-build guard: fail closed if production public Cloud env is missing/invalid.
 * Prints status lines only — never the publishable key or full URL values.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePackagedCloudEnv, validatePackagedCloudEnv } from './packagedCloudConfig.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const envPath = join(root, '.env')
const dotEnvContents = existsSync(envPath) ? readFileSync(envPath, 'utf8') : undefined
const env = resolvePackagedCloudEnv(process.env, dotEnvContents)
const result = validatePackagedCloudEnv(env)
for (const line of result.lines) {
  console.log(line)
}

if (!result.ok) {
  console.error(
    'Packaged FoxBridge Cloud public configuration is missing or invalid. Set GitHub Actions repository Variables FOXBRIDGE_CLOUD_URL, FOXBRIDGE_CLOUD_PUBLISHABLE_KEY, and FOXBRIDGE_SCANNER_URL.',
  )
  process.exit(1)
}
