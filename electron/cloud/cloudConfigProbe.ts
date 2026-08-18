import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { CloudPublicConfigDiagnostic } from '../../src/shared/models/CloudConfig'
import { formatCloudPublicConfigDiagnosticLog } from '../../src/shared/models/CloudConfig'

const DIAGNOSTIC_LOG_FILENAME = 'cloud-config-resolve.log'

function diagnosticLogPath(): string {
  return path.join(app.getPath('userData'), 'logs', DIAGNOSTIC_LOG_FILENAME)
}

/**
 * Main-process-only probe. Logs source + presence/lengths, never URL/key values.
 * Also appends one line under userData/logs so a Finder-launched app is observable.
 */
export function logSafeCloudPublicConfigDiagnostic(
  diagnostic: CloudPublicConfigDiagnostic,
): void {
  const line = formatCloudPublicConfigDiagnosticLog(diagnostic)
  console.warn(line)
  try {
    const filePath = diagnosticLogPath()
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.appendFileSync(filePath, `${line}\n`, 'utf8')
  } catch {
    // Never block Principal setup on diagnostic I/O.
  }
}
