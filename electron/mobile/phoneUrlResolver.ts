import net from 'node:net'
import os from 'node:os'

export const MOBILE_DEV_PORT = 5174

function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  } catch {
    return url.includes('localhost') || url.includes('127.0.0.1')
  }
}

export function normalizeAppUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    return ''
  }

  return trimmed.replace(/\/+$/, '')
}

export function isPhoneAccessibleUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) {
    return false
  }

  return !isLocalhostUrl(url)
}

export function getLanIPv4(): string | null {
  const interfaces = os.networkInterfaces()

  for (const entries of Object.values(interfaces)) {
    if (!entries) {
      continue
    }

    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address
      }
    }
  }

  return null
}

export function isPortListening(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host })

    const finish = (result: boolean): void => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(1000)
    socket.on('connect', () => finish(true))
    socket.on('timeout', () => finish(false))
    socket.on('error', () => finish(false))
  })
}

export async function isMobileDevServerRunning(): Promise<boolean> {
  const lanIp = getLanIPv4()
  const localhostListening = await isPortListening(MOBILE_DEV_PORT, '127.0.0.1')

  if (!localhostListening) {
    return false
  }

  if (!lanIp) {
    return true
  }

  return isPortListening(MOBILE_DEV_PORT, lanIp)
}

export interface ResolvedPhoneUrl {
  phoneUrl: string | null
  phoneUrlSource: 'hosted' | 'lan' | null
  isLocalTesting: boolean
  mobileDevServerRunning: boolean
}

export async function resolvePhoneAccessibleUrl(
  configuredAppUrl: string | null | undefined,
): Promise<ResolvedPhoneUrl> {
  const normalizedConfigured = configuredAppUrl ? normalizeAppUrl(configuredAppUrl) : null
  const mobileDevServerRunning = await isMobileDevServerRunning()

  if (normalizedConfigured && isPhoneAccessibleUrl(normalizedConfigured)) {
    return {
      phoneUrl: normalizedConfigured,
      phoneUrlSource: 'hosted',
      isLocalTesting: false,
      mobileDevServerRunning,
    }
  }

  if (mobileDevServerRunning) {
    const lanIp = getLanIPv4()
    if (lanIp) {
      return {
        phoneUrl: `http://${lanIp}:${MOBILE_DEV_PORT}`,
        phoneUrlSource: 'lan',
        isLocalTesting: true,
        mobileDevServerRunning: true,
      }
    }
  }

  return {
    phoneUrl: null,
    phoneUrlSource: null,
    isLocalTesting: false,
    mobileDevServerRunning,
  }
}
