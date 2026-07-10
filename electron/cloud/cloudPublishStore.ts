import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

const STORE_FILENAME = 'cloud-publish-state.json'

export interface CloudPublishState {
  lastPublishAt: string | null
  lastPublishAttendeeCount: number | null
  lastPublishError: string | null
}

const DEFAULT_STATE: CloudPublishState = {
  lastPublishAt: null,
  lastPublishAttendeeCount: null,
  lastPublishError: null,
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), STORE_FILENAME)
}

export async function getCloudPublishState(): Promise<CloudPublishState> {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf8')
    const data = JSON.parse(raw) as Partial<CloudPublishState>
    return {
      lastPublishAt: data.lastPublishAt ?? null,
      lastPublishAttendeeCount:
        typeof data.lastPublishAttendeeCount === 'number'
          ? data.lastPublishAttendeeCount
          : null,
      lastPublishError: data.lastPublishError ?? null,
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export async function setCloudPublishSuccess(
  attendeeCount: number,
  publishedAt: string,
): Promise<void> {
  const data: CloudPublishState = {
    lastPublishAt: publishedAt,
    lastPublishAttendeeCount: attendeeCount,
    lastPublishError: null,
  }
  await fs.writeFile(getStorePath(), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export async function setCloudPublishError(message: string): Promise<void> {
  const current = await getCloudPublishState()
  const data: CloudPublishState = {
    ...current,
    lastPublishError: message,
  }
  await fs.writeFile(getStorePath(), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}
