import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface PrintCompletionContext {
  requestedDeviceName?: string
}

/**
 * Best-effort detection of the printer used for the last completed print job.
 * Platform adapters can be extended without changing badge print orchestration.
 */
export async function captureSelectedPrinterName(
  context: PrintCompletionContext,
): Promise<string | null> {
  const platformName = await captureFromPlatform()
  if (platformName) {
    return platformName
  }

  return context.requestedDeviceName ?? null
}

async function captureFromPlatform(): Promise<string | null> {
  switch (process.platform) {
    case 'darwin':
      return captureFromCupsRecentJob()
    case 'win32':
      return null
    default:
      return null
  }
}

async function captureFromCupsRecentJob(): Promise<string | null> {
  const activeJob = await readCupsJobQueue('-W', 'not-completed')
  if (activeJob) {
    return activeJob
  }

  return readCupsJobQueue('-W', 'completed')
}

async function readCupsJobQueue(...args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('lpstat', [...args, '-o'])
    const firstLine = stdout
      .trim()
      .split('\n')
      .find((line) => line.trim().length > 0)

    if (!firstLine) {
      return null
    }

    const jobId = firstLine.split(/\s+/)[0]
    if (!jobId) {
      return null
    }

    const queueName = jobId.replace(/-\d+$/, '')
    return queueName || null
  } catch {
    return null
  }
}
